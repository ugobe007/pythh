#!/usr/bin/env tsx
/**
 * Faith Validation Engine
 * -----------------------
 * Cross-references VC faith signals with portfolio exhaust + startups to create faith_alignment_matches.
 * This is a lightweight heuristic pass; refine later with embeddings.
 *
 * Usage:
 *   ENV_FILE=.env.bak npx tsx scripts/faith-validation-engine.ts --limit 200
 */

import { config } from 'dotenv';
config({ path: '.env.bak' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_KEY as string
);

interface Startup {
  id: string;
  name: string;
  description?: string | null;
  sectors?: string[] | null;
  total_god_score?: number | null;
  stage?: number | null;
}

interface FaithSignal {
  id: string;
  investor_id: string;
  signal_text: string;
  categories: string[] | null;
  conviction: number;
  confidence: number;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts: Record<string, number> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      opts.limit = Number(args[i + 1]);
      i++;
    }
  }
  return opts;
}

async function loadStartups(limit: number) {
  const { data, error } = await supabase
    .from('startup_uploads')
    .select('id,name,description,sectors,total_god_score,stage')
    .in('status', ['approved', 'published'])
    .limit(limit);

  if (error) throw error;
  return (data || []) as Startup[];
}

async function loadFaithSignals() {
  const { data, error } = await supabase
    .from('vc_faith_signals')
    .select('id,investor_id,signal_text,categories,conviction,confidence')
    .eq('is_active', true)
    .gte('confidence', 0.6)
    .limit(5000);

  if (error) throw error;
  return (data || []) as FaithSignal[];
}

function scoreAlignment(signal: FaithSignal, startup: Startup) {
  const text = signal.signal_text.toLowerCase();
  const sectors = (startup.sectors || []).map(s => s.toLowerCase());

  let score = 0;
  const reasons: string[] = [];

  for (const sector of sectors) {
    if (sector && text.includes(sector)) {
      score = Math.max(score, 65);
      reasons.push(`Matches sector mention: ${sector}`);
    }
  }

  if (startup.description) {
    const desc = startup.description.toLowerCase();
    if (text.includes('ai') && desc.includes('ai')) {
      score = Math.max(score, 70);
      reasons.push('AI theme alignment');
    }
    if (text.includes('infrastructure') && desc.includes('infrastructure')) {
      score = Math.max(score, 72);
      reasons.push('Infrastructure alignment');
    }
    if (text.includes('climate') && desc.includes('climate')) {
      score = Math.max(score, 68);
      reasons.push('Climate alignment');
    }
  }

  // Conviction/Confidence weighting
  const weight = ((signal.conviction || 0.7) + (signal.confidence || 0.7)) / 2;
  score = score * weight;

  // Bonus for GOD score presence
  if (startup.total_god_score && startup.total_god_score > 70) {
    score += 5;
    reasons.push('High GOD score bonus');
  }

  return { score: Math.min(100, Math.max(0, Math.round(score))), reasons };
}

async function upsertAlignment(startup: Startup, investorId: string, score: number, reasons: string[], signalIds: string[]) {
  const { error } = await supabase
    .from('faith_alignment_matches')
    .upsert({
      startup_id: startup.id,
      investor_id: investorId,
      faith_alignment_score: score,
      rationale: { reasons },
      signal_ids: signalIds,
      confidence: 0.7,
      match_source: 'heuristic_v1'
    }, { onConflict: 'startup_id,investor_id' });

  if (error) throw error;
}

async function main() {
  const { limit = 200 } = parseArgs();
  console.log(`🔎 Running faith validation across ${limit} startups`);

  const [startups, faithSignals] = await Promise.all([
    loadStartups(limit),
    loadFaithSignals()
  ]);

  const signalsByInvestor = faithSignals.reduce<Record<string, FaithSignal[]>>((acc, sig) => {
    acc[sig.investor_id] = acc[sig.investor_id] || [];
    acc[sig.investor_id].push(sig);
    return acc;
  }, {});

  console.log(`📊 Processing ${startups.length} startups × ${Object.keys(signalsByInvestor).length} investors...\n`);

  let totalMatches = 0;
  let processedCount = 0;

  for (const startup of startups) {
    processedCount++;
    if (processedCount % 50 === 0) {
      console.log(`⏳ Processed ${processedCount}/${startups.length} startups, ${totalMatches} matches so far...`);
    }

    for (const [investorId, signals] of Object.entries(signalsByInvestor)) {
      let bestScore = 0;
      const reasons: string[] = [];
      const matchedSignals: string[] = [];

      for (const sig of signals) {
        const { score, reasons: signalReasons } = scoreAlignment(sig, startup);
        if (score > 50) {
          matchedSignals.push(sig.id);
          reasons.push(...signalReasons);
          bestScore = Math.max(bestScore, score);
        }
      }

      if (bestScore > 0 && matchedSignals.length) {
        await upsertAlignment(startup, investorId, bestScore, Array.from(new Set(reasons)), matchedSignals);
        totalMatches++;
      }
    }
  }

  console.log(`\n✅ Complete! Stored/updated ${totalMatches} faith_alignment_matches`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
