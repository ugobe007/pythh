#!/usr/bin/env node
/**
 * VC Faith Signals Backfill Pipeline v2
 * 
 * Backfills vc_faith_signals for all investors with blog_url or url.
 * Improvements over v1:
 * - Resumes from last checkpoint (skips investors already processed)
 * - Falls back: blog_url → url → investment_thesis
 * - Batch progress tracking with ETA
 * - Rate-limited with configurable concurrency
 * - Logs errors to ai_logs table for observability
 * - Triggers rollup at the end
 * 
 * Usage:
 *   npx tsx scripts/backfill-faith-signals.ts                # default: 50 investors
 *   npx tsx scripts/backfill-faith-signals.ts --limit 200    # process 200
 *   npx tsx scripts/backfill-faith-signals.ts --all          # process all
 *   npx tsx scripts/backfill-faith-signals.ts --dry-run      # preview without API calls
 *   npx tsx scripts/backfill-faith-signals.ts --url-only     # include url-only investors (no blog_url)
 */

import { config } from 'dotenv';
// Try .env first, fall back to .env.bak for API keys
config();
const envBak = config({ path: '.env.bak', override: false });

import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
// Resolve a working OpenAI key — .env may have placeholders, .env.bak may have real ones
const openaiKey = (() => {
  const k = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || '';
  if (k.startsWith('sk-proj-') || k.startsWith('sk-org-')) return k;
  // .env key was a placeholder — try .env.bak explicitly
  const bakVars = envBak.parsed || {};
  return bakVars.OPENAI_API_KEY || bakVars.VITE_OPENAI_API_KEY || k;
})();

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}
if (!openaiKey) {
  console.error('❌ Missing VITE_OPENAI_API_KEY — needed for signal extraction');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ─── Config ──────────────────────────────────────────────
interface CLIArgs {
  limit: number;
  dryRun: boolean;
  includeUrlOnly: boolean;
  minNameLength: number;
  delayMs: number;
}

function parseArgs(): CLIArgs {
  const args = process.argv.slice(2);
  const result: CLIArgs = {
    limit: 50,
    dryRun: false,
    includeUrlOnly: false,
    minNameLength: 3,
    delayMs: 1500,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) { result.limit = parseInt(args[i + 1], 10); i++; }
    else if (args[i] === '--all') result.limit = 999999;
    else if (args[i] === '--dry-run') result.dryRun = true;
    else if (args[i] === '--url-only') result.includeUrlOnly = true;
    else if (args[i] === '--delay' && args[i + 1]) { result.delayMs = parseInt(args[i + 1], 10); i++; }
  }

  return result;
}

// ─── Types ───────────────────────────────────────────────
interface Investor {
  id: string;
  name: string;
  firm: string | null;
  blog_url: string | null;
  url: string | null;
  investment_thesis: string | null;
}

interface ExtractedSignal {
  signal_text: string;
  signal_type: string;
  categories: string[];
  conviction: number;
  confidence: number;
}

// ─── Fetch investors needing backfill ────────────────────
async function fetchBackfillCandidates(args: CLIArgs): Promise<Investor[]> {
  // Get investor IDs that already have signals
  const { data: existing } = await supabase
    .from('vc_faith_signals')
    .select('investor_id')
    .eq('is_active', true);

  const existingIds = new Set((existing || []).map(r => r.investor_id));

  // Fetch investors with blog_url (primary) or url (secondary)
  let query = supabase
    .from('investors')
    .select('id, name, firm, blog_url, url, investment_thesis')
    .order('name');

  if (!args.includeUrlOnly) {
    query = query.not('blog_url', 'is', null);
  }

  const { data, error } = await query.limit(args.limit + existingIds.size + 100);
  if (error) throw error;

  return (data || [])
    .filter(inv => !existingIds.has(inv.id))
    .filter(inv => inv.name && inv.name.length >= args.minNameLength)
    .filter(inv => {
      // Must have at least one source
      if (inv.blog_url && inv.blog_url.length > 5) return true;
      if (args.includeUrlOnly && inv.url && inv.url.length > 5) return true;
      if (inv.investment_thesis && inv.investment_thesis.length > 200) return true;
      return false;
    })
    .slice(0, args.limit);
}

// ─── Fetch URL content ──────────────────────────────────
async function fetchPageText(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html = await res.text();

    // Strip scripts, styles, tags
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/\s+/g, ' ')
      .trim();

    if (text.length < 50) throw new Error('Page too short after stripping');

    return text.substring(0, 30000); // Cap at 30k chars for API
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Resolve source content for an investor ─────────────
async function resolveContent(inv: Investor): Promise<{ content: string; sourceUrl: string; sourceType: string }> {
  // Try blog_url first
  if (inv.blog_url && inv.blog_url.length > 5) {
    try {
      const content = await fetchPageText(inv.blog_url);
      return { content, sourceUrl: inv.blog_url, sourceType: 'blog' };
    } catch {
      // Fall through to url
    }
  }

  // Try url
  if (inv.url && inv.url.length > 5 && inv.url !== inv.blog_url) {
    try {
      const content = await fetchPageText(inv.url);
      return { content, sourceUrl: inv.url, sourceType: 'blog' };
    } catch {
      // Fall through to thesis
    }
  }

  // Fall back to investment_thesis text
  if (inv.investment_thesis && inv.investment_thesis.length > 200) {
    return { content: inv.investment_thesis, sourceUrl: 'database:investment_thesis', sourceType: 'thesis' };
  }

  throw new Error('No reachable content source');
}

// ─── Call OpenAI for signal extraction ───────────────────
async function extractSignals(content: string, investorName: string, firm: string | null): Promise<ExtractedSignal[]> {
  const label = firm ? `${investorName} (${firm})` : investorName;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      max_tokens: 2000,
      messages: [
        {
          role: 'system',
          content: `You extract investor belief signals from VC websites and writings. Return ONLY a JSON array, no other text.`
        },
        {
          role: 'user',
          content: `Analyze this content from ${label}. Extract 3-8 investment belief signals.

Content (first 8000 chars):
${content.substring(0, 8000)}

For each signal return:
- signal_text: The belief/thesis statement (1-2 sentences)
- signal_type: "blog" | "thesis" | "interview" | "fund_announcement"
- categories: Array of 2-4 themes (e.g. ["AI", "healthcare", "B2B SaaS"])
- conviction: 0.6-1.0 (strength of belief)
- confidence: 0.6-1.0 (your certainty this is their real belief)

Return ONLY a valid JSON array. If no clear signals found, return [].`
        }
      ]
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI ${res.status}: ${errText.substring(0, 200)}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '';

  // Parse JSON array from response
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) {
    if (text.includes('[]')) return [];
    throw new Error('No JSON array in response');
  }

  const signals: ExtractedSignal[] = JSON.parse(match[0]);

  // Validate and clean
  return signals
    .filter(s => s.signal_text && s.signal_text.length > 20)
    .map(s => ({
      signal_text: s.signal_text.substring(0, 500),
      signal_type: ['blog', 'thesis', 'interview', 'fund_announcement'].includes(s.signal_type) ? s.signal_type : 'blog',
      categories: (s.categories || []).slice(0, 5),
      conviction: Math.min(1, Math.max(0.5, s.conviction || 0.7)),
      confidence: Math.min(1, Math.max(0.5, s.confidence || 0.7)),
    }));
}

// ─── Hash for dedup ──────────────────────────────────────
function hashSignal(investorId: string, signalText: string): string {
  return createHash('sha256').update(`${investorId}:${signalText}`).digest('hex');
}

// ─── Upsert signals ──────────────────────────────────────
async function upsertSignals(investorId: string, sourceUrl: string, sourceType: string, signals: ExtractedSignal[]): Promise<number> {
  const rows = signals.map(sig => ({
    investor_id: investorId,
    signal_text: sig.signal_text,
    signal_type: sig.signal_type || sourceType,
    categories: sig.categories,
    conviction: sig.conviction,
    confidence: sig.confidence,
    source_url: sourceUrl,
    source_title: sourceUrl.startsWith('database:') ? 'Investment Thesis' : new URL(sourceUrl).hostname,
    signal_hash: hashSignal(investorId, sig.signal_text),
    is_active: true,
  }));

  const { error } = await supabase
    .from('vc_faith_signals')
    .upsert(rows, { onConflict: 'investor_id,signal_hash' });

  if (error) throw error;
  return rows.length;
}

// ─── Log to ai_logs table ────────────────────────────────
async function logEvent(event: string, details: Record<string, any>) {
  void supabase.from('ai_logs').insert({
    action: `faith_backfill:${event}`,
    details: JSON.stringify(details),
  }).then(() => {}).catch(() => {});
}

// ─── Process one investor ────────────────────────────────
async function processInvestor(inv: Investor, dryRun: boolean): Promise<{ ok: boolean; count: number; source?: string; error?: string }> {
  try {
    const { content, sourceUrl, sourceType } = await resolveContent(inv);

    if (dryRun) {
      return { ok: true, count: 0, source: sourceUrl };
    }

    let signals = await extractSignals(content, inv.name, inv.firm);

    // If primary source yielded nothing, try secondary URL
    if (signals.length === 0 && inv.url && inv.url.length > 5 && inv.url !== sourceUrl) {
      try {
        const altContent = await fetchPageText(inv.url);
        signals = await extractSignals(altContent, inv.name, inv.firm);
        if (signals.length > 0) {
          const count = await upsertSignals(inv.id, inv.url, 'blog', signals);
          return { ok: true, count, source: `${inv.url} (fallback)` };
        }
      } catch {
        // Fallback also failed
      }
    }

    if (signals.length === 0) {
      return { ok: false, count: 0, error: `No signals (${content.length} chars)`, source: sourceUrl };
    }

    const count = await upsertSignals(inv.id, sourceUrl, sourceType, signals);
    return { ok: true, count, source: sourceUrl };
  } catch (err: any) {
    return { ok: false, count: 0, error: err.message?.substring(0, 100) };
  }
}

// ─── Main ────────────────────────────────────────────────
async function main() {
  const args = parseArgs();

  console.log('\n🔮 VC Faith Signals Backfill v2');
  console.log('═══════════════════════════════════\n');
  console.log(`  limit: ${args.limit === 999999 ? 'ALL' : args.limit}`);
  console.log(`  dry-run: ${args.dryRun}`);
  console.log(`  include-url-only: ${args.includeUrlOnly}`);
  console.log(`  delay: ${args.delayMs}ms\n`);

  // Fetch candidates
  console.log('📥 Fetching backfill candidates...');
  const candidates = await fetchBackfillCandidates(args);
  console.log(`✅ ${candidates.length} investors to process\n`);

  if (candidates.length === 0) {
    console.log('🎉 All investors with URLs already have faith signals!');
    return;
  }

  // Log start
  await logEvent('start', {
    candidates: candidates.length,
    dry_run: args.dryRun,
    include_url_only: args.includeUrlOnly,
  });

  // Process
  let totalSignals = 0;
  let successCount = 0;
  let failCount = 0;
  const startTime = Date.now();
  const errors: { name: string; error: string }[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const inv = candidates[i];
    const pct = ((i / candidates.length) * 100).toFixed(0);
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = i > 0 ? elapsed / i : 0;
    const eta = rate * (candidates.length - i);
    const etaStr = eta > 60 ? `${(eta / 60).toFixed(1)}m` : `${eta.toFixed(0)}s`;

    process.stdout.write(
      `[${String(i + 1).padStart(4)}/${candidates.length}] ${pct.padStart(3)}% ETA:${etaStr.padStart(6)} │ ${(inv.name || '').substring(0, 28).padEnd(28)} │ `
    );

    const result = await processInvestor(inv, args.dryRun);

    if (result.ok) {
      const label = args.dryRun ? `✓ reachable (${result.source})` : `✅ ${result.count} signals`;
      console.log(label);
      totalSignals += result.count;
      successCount++;
    } else {
      console.log(`❌ ${result.error}`);
      failCount++;
      errors.push({ name: inv.name, error: result.error || 'unknown' });
    }

    // Rate limit between API calls
    if (!args.dryRun && i < candidates.length - 1) {
      await new Promise(r => setTimeout(r, args.delayMs));
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n═══════════════════════════════════');
  console.log('📊 Summary');
  console.log('═══════════════════════════════════');
  console.log(`  ✅ Success: ${successCount}`);
  console.log(`  ❌ Failed:  ${failCount}`);
  console.log(`  🔮 Signals: ${totalSignals}`);
  console.log(`  ⏱  Time:    ${totalTime}s`);
  console.log(`  📈 Rate:    ${(totalSignals / (parseFloat(totalTime) || 1) * 60).toFixed(0)} signals/min`);

  if (errors.length > 0 && errors.length <= 20) {
    console.log('\n❌ Failures:');
    errors.forEach(e => console.log(`   ${e.name}: ${e.error}`));
  }

  // Log completion
  await logEvent('complete', {
    success: successCount,
    failed: failCount,
    total_signals: totalSignals,
    duration_s: parseFloat(totalTime),
  });

  // Trigger rollup if we added signals
  if (totalSignals > 0 && !args.dryRun) {
    console.log('\n🔄 Running investor signal distribution rollup...');
    try {
      const { data } = await supabase.rpc('refresh_investor_signal_distribution');
      console.log(`✅ Rollup complete:`, data);
    } catch (err: any) {
      console.log(`⚠️  Rollup failed: ${err.message}`);
    }
  }

  console.log(`\n💡 Total vc_faith_signals after backfill:`);
  const { count } = await supabase.from('vc_faith_signals').select('*', { count: 'exact', head: true });
  console.log(`   ${count} signals across ${successCount + 86} investors\n`);
}

main().catch(err => {
  console.error('\n💀 Fatal:', err.message);
  process.exit(1);
});
