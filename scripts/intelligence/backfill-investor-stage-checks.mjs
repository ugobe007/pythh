#!/usr/bin/env node
/**
 * Evidence-first investor stage/check-size backfill.
 *
 * Reads only an investor's official website, updates only missing fields, and
 * records the supporting sentence + URL in vc_intelligence.investment_signals.
 * No LLM inference is used: if the official source is ambiguous, the field
 * remains unknown.
 *
 * Usage:
 *   node scripts/intelligence/backfill-investor-stage-checks.mjs --limit=25
 *   node scripts/intelligence/backfill-investor-stage-checks.mjs --apply --limit=25
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: '.env.save', override: false });

const APPLY = process.argv.includes('--apply');
const LIMIT = Math.max(
  1,
  Number.parseInt(process.argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1] || '25', 10),
);
const DELAY = Math.max(
  0,
  Number.parseInt(process.argv.find((arg) => arg.startsWith('--delay='))?.split('=')[1] || '500', 10),
);
const cleanEnvValue = (value) => String(value || '').trim().replace(/^=+/, '').replace(/^["']|["']$/g, '');
const configuredUrl = cleanEnvValue(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
const SUPABASE_URL = /^https?:\/\//i.test(configuredUrl)
  ? configuredUrl
  : 'https://unkpogyhhjbvxxjvmxlt.supabase.co';
const SUPABASE_KEY = cleanEnvValue(process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('SUPABASE_URL and service key are required');
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function cleanText(html) {
  return String(html || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function relevantOfficialLinks(html, baseUrl) {
  const base = new URL(baseUrl);
  const links = [...String(html || '').matchAll(/href=["']([^"'#]+)["']/gi)]
    .map((match) => {
      try {
        return new URL(match[1], base);
      } catch {
        return null;
      }
    })
    .filter((url) => url && url.origin === base.origin)
    .filter((url) => /(invest|criteria|approach|apply|entrepreneur|founder|faq|thesis|about)/i.test(url.pathname))
    .map((url) => url.href.replace(/#.*$/, ''));
  return [...new Set([base.href, ...links])].slice(0, 5);
}

function normalizeStageEvidence(sentence) {
  const lower = sentence.toLowerCase();
  const strategyContext =
    /\b(?:we|our|firm|fund)\s+(?:typically\s+)?(?:invest|back|focus|target|support)/i.test(lower) ||
    /\binvest(?:s|ing|ment)?\s+(?:at|in|from|across)\b/i.test(lower) ||
    /\bfocus(?:ed)?\s+on\b/i.test(lower) ||
    /\b(?:pre[- ]?seed|seed|series\s+[abc]|growth[- ]stage)\s+(?:investor|fund|venture|companies)\b/i.test(lower);
  if (!strategyContext) return [];
  const stages = [];
  if (/\b(pre[- ]?seed|angel|friends and family)\b/i.test(lower)) stages.push('pre-seed');
  const withoutPreSeed = lower.replace(/pre[- ]?seed/g, '');
  if (/\bseed(?:-stage|-round)?\b/i.test(withoutPreSeed)) stages.push('seed');
  if (/\bseries\s*a\b/i.test(lower)) stages.push('series-a');
  if (/\bseries\s*b\b/i.test(lower)) stages.push('series-b');
  if (/\bseries\s*c\b/i.test(lower)) stages.push('series-c');
  if (/\b(growth[- ]stage|growth equity|late[- ]stage)\b/i.test(lower)) stages.push('growth');
  if (/\bfrom\s+pre[- ]?seed\s+to\s+series\s*[abc]\b/i.test(lower)) stages.push('seed');
  if (/\bfrom\s+(?:pre[- ]?seed|seed)\s+to\s+series\s*[abc]\b/i.test(lower)) stages.push('series-a');
  if (/\bfrom\s+(?:pre[- ]?seed|seed|series\s*a)\s+to\s+series\s*c\b/i.test(lower)) stages.push('series-b');
  return [...new Set(stages)];
}

function parseUsd(raw, suffix) {
  const amount = Number.parseFloat(String(raw).replace(/,/g, ''));
  if (!Number.isFinite(amount)) return null;
  const factor = /^b/i.test(suffix) ? 1_000_000_000 : /^m/i.test(suffix) ? 1_000_000 : /^k/i.test(suffix) ? 1_000 : 1;
  return Math.round(amount * factor);
}

function extractEvidence(text, sourceUrl) {
  const sentences = text.match(/[^.!?]{20,400}[.!?]/g) || [];
  let stage = null;
  let check = null;

  for (const rawSentence of sentences) {
    const sentence = rawSentence.trim();
    if (!stage) {
      const stages = normalizeStageEvidence(sentence);
      if (stages.length) stage = { value: stages, evidence: sentence, source_url: sourceUrl };
    }
    if (!check && /(check|ticket|invest(?:ment)?|commit|write)/i.test(sentence)) {
      const range = sentence.match(
        /\$\s*([\d,.]+)\s*(k|m|b|thousand|million|billion)?\s*(?:-|–|—|to|and)\s*\$?\s*([\d,.]+)\s*(k|m|b|thousand|million|billion)?/i,
      );
      if (range) {
        const min = parseUsd(range[1], range[2] || range[4]);
        const max = parseUsd(range[3], range[4] || range[2]);
        if (min && max && min <= max && max <= 1_000_000_000) {
          check = { min_usd: min, max_usd: max, evidence: sentence, source_url: sourceUrl };
        }
      }
    }
    if (stage && check) break;
  }
  return { stage, check };
}

async function researchOfficialSite(rawUrl) {
  const start = new URL(rawUrl);
  if (!/^https?:$/.test(start.protocol)) return { stage: null, check: null };
  const first = await fetch(start.href, {
    headers: { 'User-Agent': 'PythhInvestorResearch/1.0 (+https://pythh.ai)' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!first.ok || !/text\/html/i.test(first.headers.get('content-type') || '')) {
    return { stage: null, check: null };
  }
  const homepage = await first.text();
  const pages = relevantOfficialLinks(homepage, first.url);
  let result = extractEvidence(cleanText(homepage), first.url);

  for (const pageUrl of pages.slice(1)) {
    if (result.stage && result.check) break;
    try {
      const response = await fetch(pageUrl, {
        headers: { 'User-Agent': 'PythhInvestorResearch/1.0 (+https://pythh.ai)' },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok || !/text\/html/i.test(response.headers.get('content-type') || '')) continue;
      const evidence = extractEvidence(cleanText(await response.text()), response.url);
      result = {
        stage: result.stage || evidence.stage,
        check: result.check || evidence.check,
      };
    } catch {
      // Ambiguous or unavailable sources remain unknown.
    }
  }
  return result;
}

async function recordEvidence(investor, evidence) {
  const { data: existing } = await sb
    .from('vc_intelligence')
    .select('id, investment_signals, source_count')
    .eq('investor_id', investor.id)
    .maybeSingle();

  const signals = Array.isArray(existing?.investment_signals) ? existing.investment_signals : [];
  const additions = [];
  if (evidence.stage) {
    additions.push({
      signal: 'verified_stage_focus',
      value: evidence.stage.value,
      evidence_quote: evidence.stage.evidence,
      source_url: evidence.stage.source_url,
      verified_at: new Date().toISOString(),
    });
  }
  if (evidence.check) {
    additions.push({
      signal: 'verified_check_size',
      value: { min_usd: evidence.check.min_usd, max_usd: evidence.check.max_usd },
      evidence_quote: evidence.check.evidence,
      source_url: evidence.check.source_url,
      verified_at: new Date().toISOString(),
    });
  }
  if (!additions.length) return;

  const investmentSignals = [
    ...signals.filter((item) => !['verified_stage_focus', 'verified_check_size'].includes(item?.signal)),
    ...additions,
  ];
  if (existing?.id) {
    await sb
      .from('vc_intelligence')
      .update({
        investment_signals: investmentSignals,
        source_count: Math.max(Number(existing.source_count) || 0, additions.length),
        scraped_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
  } else {
    await sb.from('vc_intelligence').insert({
      investor_id: investor.id,
      firm_name: investor.firm || investor.name,
      firm_url: investor.url,
      investment_signals: investmentSignals,
      source_count: additions.length,
      scraped_at: new Date().toISOString(),
      confidence: 0.9,
    });
  }
}

async function main() {
  const { data, error } = await sb
    .from('investors')
    .select('id, name, firm, url, stage, check_size_min, check_size_max, entity_gate, status')
    .not('url', 'is', null)
    .or('stage.eq.{},and(check_size_min.is.null,check_size_max.is.null)')
    .order('investor_score', { ascending: false, nullsFirst: false })
    .limit(LIMIT);
  if (error) throw error;

  const investors = (data || [])
    .filter((investor) => investor.entity_gate !== 'junk' && investor.status !== 'inactive')
    .filter((investor) =>
      !Array.isArray(investor.stage) ||
      investor.stage.length === 0 ||
      (investor.check_size_min == null && investor.check_size_max == null),
    )
    .slice(0, LIMIT);

  console.log(`\nInvestor stage/check backfill · ${APPLY ? 'APPLY' : 'dry-run'} · ${investors.length} records\n`);
  let stageUpdates = 0;
  let checkUpdates = 0;

  for (const [index, investor] of investors.entries()) {
    let evidence = { stage: null, check: null };
    try {
      evidence = await researchOfficialSite(investor.url);
    } catch {
      // Official site unavailable: do not infer.
    }

    const patch = {};
    if ((!Array.isArray(investor.stage) || !investor.stage.length) && evidence.stage) {
      patch.stage = evidence.stage.value;
      stageUpdates += 1;
    }
    if (investor.check_size_min == null && investor.check_size_max == null && evidence.check) {
      patch.check_size_min = evidence.check.min_usd;
      patch.check_size_max = evidence.check.max_usd;
      checkUpdates += 1;
    }

    console.log(
      `[${index + 1}/${investors.length}] ${investor.firm || investor.name}: ` +
      `${patch.stage ? `stage ${patch.stage.join(', ')}` : 'stage unchanged'} · ` +
      `${patch.check_size_min ? `check $${patch.check_size_min}–$${patch.check_size_max}` : 'check unchanged'}`,
    );
    if (patch.stage) {
      console.log(`  source: ${evidence.stage.source_url}`);
      console.log(`  evidence: ${evidence.stage.evidence.slice(0, 240)}`);
    }
    if (patch.check_size_min) {
      console.log(`  source: ${evidence.check.source_url}`);
      console.log(`  evidence: ${evidence.check.evidence.slice(0, 240)}`);
    }

    if (APPLY && Object.keys(patch).length) {
      const { error: updateError } = await sb
        .from('investors')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', investor.id);
      if (updateError) throw updateError;
      await recordEvidence(investor, evidence);
    }
    if (DELAY) await sleep(DELAY);
  }

  console.log(`\n${APPLY ? 'Updated' : 'Would update'}: stage ${stageUpdates} · check size ${checkUpdates}\n`);
}

main().catch((error) => {
  console.error('Fatal:', error.message);
  process.exit(1);
});
