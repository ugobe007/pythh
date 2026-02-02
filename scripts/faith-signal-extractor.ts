#!/usr/bin/env tsx
/**
 * Faith Signal Extractor (Claude-powered)
 * ---------------------------------------
 * Pulls interview/blog content, extracts VC belief statements, and upserts into vc_faith_signals.
 *
 * Usage:
 *   ENV_FILE=.env.bak ANTHROPIC_API_KEY=... npx tsx scripts/faith-signal-extractor.ts \
 *     --investor-id <uuid> \
 *     --investor-name "Sequoia Capital" \
 *     --url "https://a16z.com/ai-manifesto/"
 */

import { config } from 'dotenv';
config({ path: '.env.bak' });
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('Set ANTHROPIC_API_KEY in env');
  process.exit(1);
}
const anthropicKey = process.env.ANTHROPIC_API_KEY as string;

const supabase = createClient(
  process.env.VITE_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_KEY as string
);

interface FaithSignal {
  signal_text: string;
  signal_type: 'thesis' | 'interview' | 'blog' | 'fund_announcement' | 'tweet' | 'podcast';
  categories: string[];
  conviction: number; // 0-1
  confidence: number; // 0-1
  source_url?: string;
  source_title?: string;
  published_at?: string;
  tags?: string[];
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--') && args[i + 1] && !args[i + 1].startsWith('--')) {
      opts[args[i].replace('--', '')] = args[i + 1];
      i++;
    }
  }
  return opts;
}

async function fetchTextFromUrl(url: string) {
  const res = await fetch(url, { headers: { 'User-Agent': 'HotHoneyFaithSignal/1.0' } });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  const html = await res.text();
  // Basic strip of tags; for now keep simple
  return html.replace(/<[^>]+>/g, ' ');
}

async function callClaude(content: string, investorName: string): Promise<FaithSignal[]> {
  const prompt = `You are extracting VC belief statements ("faith signals").
Return JSON array with fields: signal_text, signal_type (thesis|interview|blog|fund_announcement|tweet|podcast), categories (array of short tags), conviction (0-1), confidence (0-1), source_title, published_at (ISO if available).
Only include specific belief statements made by ${investorName}.`;

  const body = {
    model: process.env.CLAUDE_MODEL || 'claude-3-sonnet-20240229',
    max_tokens: 800,
    temperature: 0,
    system: prompt,
    messages: [
      { role: 'user', content: content.slice(0, 12000) }
    ]
  };

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01'
    } as Record<string, string>,
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Claude API error: ${res.status} ${res.statusText} ${text}`);
  }

  const data: any = await res.json();
  const raw = data?.content?.[0]?.text || data?.content || '';
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to parse Claude output, got:', raw);
    return [];
  }
}

function hashSignal(investorId: string, text: string) {
  return createHash('sha256').update(`${investorId}|${text}`).digest('hex');
}

async function upsertSignals(investorId: string, signals: FaithSignal[], sourceUrl?: string) {
  let added = 0;
  let skipped = 0;

  for (const sig of signals) {
    const signal_hash = hashSignal(investorId, sig.signal_text);
    const { error } = await supabase.from('vc_faith_signals').upsert({
      investor_id: investorId,
      signal_type: sig.signal_type,
      signal_text: sig.signal_text,
      signal_hash,
      categories: sig.categories || [],
      tags: sig.tags || [],
      conviction: Math.min(Math.max(sig.conviction ?? 0.7, 0), 1),
      confidence: Math.min(Math.max(sig.confidence ?? 0.7, 0), 1),
      source_url: sig.source_url || sourceUrl,
      source_title: sig.source_title,
      published_at: sig.published_at,
      is_active: true
    }, { onConflict: 'investor_id,signal_hash' });

    if (error) {
      if (error.code === '23505') {
        skipped++;
        continue;
      }
      console.error(`❌ Upsert failed: ${error.message}`);
      skipped++;
      continue;
    }

    added++;
  }

  return { added, skipped };
}

async function main() {
  const args = parseArgs();
  const investorId = args['investor-id'];
  const investorName = args['investor-name'] || 'Unknown Investor';
  const url = args.url;

  if (!investorId || !url) {
    console.log('Usage: --investor-id <uuid> --investor-name "Name" --url <source>');
    process.exit(1);
  }

  console.log(`🔎 Extracting faith signals for ${investorName}`);
  const text = await fetchTextFromUrl(url);
  const signals = await callClaude(text, investorName);

  if (!signals.length) {
    console.log('No signals returned by Claude');
    process.exit(0);
  }

  const { added, skipped } = await upsertSignals(investorId, signals, url);
  console.log(`✅ Added ${added}, skipped ${skipped}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
