#!/usr/bin/env node
/**
 * Export startup_investor_matches joined with match_feedback rows for offline ML / labeling.
 * Explanations (reasoning, why_you_match, fit_analysis) are the primary text targets for
 * training explainers or evaluating decay vs created_at.
 *
 *   node scripts/export-match-ml-sample.js --out=tmp/matches.jsonl --limit=2000
 *   node scripts/export-match-ml-sample.js --json   # summary stats to stdout only
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ quiet: true });

const PAGE = 500;
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

function parseArgs(argv) {
  const out = { limit: 2000, outPath: null, jsonSummary: false };
  for (const a of argv) {
    if (a === '--json') out.jsonSummary = true;
    else if (a.startsWith('--limit=')) out.limit = Math.max(1, parseInt(a.slice('--limit='.length), 10) || 2000);
    else if (a.startsWith('--out=')) out.outPath = a.slice('--out='.length) || null;
  }
  return out;
}

async function fetchMatches(supabase, limit) {
  const rows = [];
  let from = 0;
  while (rows.length < limit) {
    const take = Math.min(PAGE, limit - rows.length);
    const { data, error } = await supabase
      .from('startup_investor_matches')
      .select(
        'id, startup_id, investor_id, match_score, confidence_level, reasoning, why_you_match, fit_analysis, algorithm_version, created_at, updated_at, status, feature_snapshot',
      )
      .order('created_at', { ascending: false })
      .range(from, from + take - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < take) break;
    from += data.length;
  }
  return rows.slice(0, limit);
}

async function fetchFeedbackForMatches(supabase, matchIds) {
  if (matchIds.length === 0) return [];
  const out = [];
  const chunk = 200;
  for (let i = 0; i < matchIds.length; i += chunk) {
    const slice = matchIds.slice(i, i + chunk);
    const { data, error } = await supabase.from('match_feedback').select('*').in('match_id', slice);
    if (error) throw new Error(error.message);
    out.push(...(data || []));
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_KEY / VITE_SUPABASE_ANON_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  (async () => {
    const matches = await fetchMatches(supabase, args.limit);
    const feedback = await fetchFeedbackForMatches(
      supabase,
      matches.map((m) => m.id),
    );
    const fbByMatch = new Map();
    for (const f of feedback) {
      if (!f.match_id) continue;
      if (!fbByMatch.has(f.match_id)) fbByMatch.set(f.match_id, []);
      fbByMatch.get(f.match_id).push(f);
    }

    const withText = matches.filter(
      (m) => (m.reasoning && String(m.reasoning).trim()) || (m.why_you_match && m.why_you_match.length),
    ).length;
    const withFb = matches.filter((m) => fbByMatch.has(m.id)).length;

    const summary = {
      generated_at: new Date().toISOString(),
      match_rows: matches.length,
      matches_with_reasoning_or_why: withText,
      matches_with_feedback: withFb,
      feedback_rows: feedback.length,
    };

    if (args.jsonSummary) {
      console.log(JSON.stringify(summary, null, 2));
      return;
    }

    const lines = [];
    for (const m of matches) {
      const rec = {
        match_id: m.id,
        startup_id: m.startup_id,
        investor_id: m.investor_id,
        match_score: m.match_score,
        confidence_level: m.confidence_level,
        reasoning: m.reasoning,
        why_you_match: m.why_you_match,
        fit_analysis: m.fit_analysis,
        algorithm_version: m.algorithm_version,
        created_at: m.created_at,
        updated_at: m.updated_at,
        status: m.status,
        feedback: fbByMatch.get(m.id) || [],
      };
      lines.push(JSON.stringify(rec));
    }

    const payload = lines.join('\n') + '\n';
    if (args.outPath) {
      const abs = path.resolve(args.outPath);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, payload, 'utf8');
      console.error(`Wrote ${abs} (${lines.length} lines)`);
    } else {
      process.stdout.write(payload);
    }
    console.error(JSON.stringify(summary));
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

main();
