#!/usr/bin/env node
/**
 * AUDIT SIGNAL GAPS — Ontology Expansion Tool
 * ─────────────────────────────────────────────────────────────────────────────
 * Mines real sentences from startup_uploads.extracted_data and discovered_startups
 * to find high-frequency phrases that the ontology cannot currently classify.
 *
 * Steps:
 *   1. Pull raw text from the DB
 *   2. Sentence-split and run through parseSignal()
 *   3. Collect all unclassified_signal sentences
 *   4. Extract bigrams / trigrams and rank by frequency
 *   5. Report candidate patterns for ontology expansion
 *   6. With --apply: automatically append high-confidence patterns to signalOntology.js
 *
 * Usage:
 *   node scripts/audit-signal-gaps.js              # report only
 *   node scripts/audit-signal-gaps.js --apply      # report + auto-expand ontology
 *   node scripts/audit-signal-gaps.js --min-freq 5 # only show phrases seen 5+ times
 */

'use strict';
require('dotenv').config();

const fs             = require('fs');
const path           = require('path');
const { createClient } = require('@supabase/supabase-js');
const { parseSignal }  = require('../lib/signalParser');

const REQUIRED_ENV = ['VITE_SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
for (const k of REQUIRED_ENV) {
  if (!process.env[k]) { console.error(`❌ Missing ${k}`); process.exit(1); }
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function argVal(flag, fallback = null) {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : fallback;
}
const APPLY     = process.argv.includes('--apply');
const MIN_FREQ  = +(argVal('--min-freq',  '3'));
const SAMPLE    = +(argVal('--sample',    '3000'));

// ── Sentence splitter (same as ingest scripts) ─────────────────────────────
function splitSentences(text) {
  return text
    .replace(/([.!?])\s+(?=[A-Z])/g, '$1\n')
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.length >= 15 && s.length <= 600);
}

function toStr(v) {
  if (!v) return '';
  if (typeof v === 'string') return v.trim();
  if (Array.isArray(v)) return v.map(toStr).filter(Boolean).join('. ');
  if (typeof v === 'object') return Object.values(v).map(toStr).filter(Boolean).join('. ');
  return String(v).trim();
}

// ── N-gram extraction ──────────────────────────────────────────────────────
const STOPWORDS = new Set([
  'the','a','an','and','or','but','is','are','was','were','be','been','being',
  'have','has','had','do','does','did','will','would','could','should','may','might',
  'of','in','on','at','to','for','with','by','from','up','about','into','through',
  'we','our','us','they','their','it','its','this','that','these','those',
  'i','you','he','she','they','who','which','what','when','where','how',
  'not','no','more','most','also','very','just','only','even','so','than',
  'all','any','each','both','few','some','such','other','same','new',
]);

function extractNgrams(sentence, n) {
  const words = sentence.toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w));

  const grams = [];
  for (let i = 0; i <= words.length - n; i++) {
    const gram = words.slice(i, i + n).join(' ');
    if (gram.replace(/\s/g, '').length > 4) grams.push(gram);
  }
  return grams;
}

function topN(freqMap, n = 50) {
  return Object.entries(freqMap)
    .filter(([, v]) => v >= MIN_FREQ)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

// ── Map candidate phrase to likely signal class ────────────────────────────
const CLASS_HINTS = [
  [/(rais|funding|invest|round|series|capital|seed|valuat)/i,           'fundraising_signal'],
  [/(acquir|merg|bought|acquisition|takeover)/i,                         'acquisition_signal'],
  [/(launch|ship|release|deploy|rollout|product|feature|update)/i,       'product_signal'],
  [/(hire|hiring|recruit|team|staff|headcount|talent|engineer)/i,        'growth_signal'],
  [/(expand|growth|scale|enterprise|market|region|geographic)/i,         'expansion_signal'],
  [/(layoff|restructur|cut|downsize|runway|burn|survival|closing)/i,     'distress_signal'],
  [/(partner|integrat|ecosystem|alliance|collaborat)/i,                  'expansion_signal'],
  [/(evaluat|pilot|poc|proof|assess|consider|exploring|looking for)/i,   'buyer_signal'],
  [/(revenue|customer|client|mrr|arr|retention|churn|pipeline)/i,        'growth_signal'],
  [/(ipo|listing|exit|strategic alternative|banker|advisor)/i,           'exit_signal'],
  [/(efficient|profitab|margin|unit economics|burn reduction)/i,          'efficiency_signal'],
];

function inferClass(phrase) {
  for (const [re, cls] of CLASS_HINTS) {
    if (re.test(phrase)) return cls;
  }
  return 'product_signal'; // safe default
}

// ── Escape for regex ───────────────────────────────────────────────────────
function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Append new patterns to signalOntology.js ─────────────────────────────
function appendToOntology(candidates) {
  const ontologyPath = path.join(__dirname, '../lib/signalOntology.js');
  const content = fs.readFileSync(ontologyPath, 'utf8');

  const header = `
  // ── Auto-expanded patterns (audit-signal-gaps.js ${new Date().toISOString().split('T')[0]}) ────────────────────────────────────`;
  const newPatterns = candidates.map(({ phrase, signal_class, freq }) => {
    const escaped = escapeRe(phrase);
    const certainty = Math.min(0.70, 0.45 + freq * 0.02);
    return `  ['${escaped}',\n    { signal_class: '${signal_class}', base_certainty: ${certainty.toFixed(2)}, action_tag: 'action_inferred', meaning: 'auto-mined: ${phrase}' }],`;
  }).join('\n');

  // Insert before the last ]; in ACTION_MAP
  const insertPoint = content.lastIndexOf('];', content.indexOf('module.exports'));
  if (insertPoint === -1) {
    console.error('   ❌ Could not find insertion point in signalOntology.js');
    return 0;
  }

  const updated = content.slice(0, insertPoint) + header + '\n' + newPatterns + '\n\n' + content.slice(insertPoint);
  fs.writeFileSync(ontologyPath, updated);
  return candidates.length;
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🔬 SIGNAL ONTOLOGY GAP AUDIT');
  console.log('═'.repeat(60));
  console.log(`Mode:          ${APPLY ? '✍️  APPLY (auto-expand ontology)' : '🔍 REPORT ONLY'}`);
  console.log(`Min frequency: ${MIN_FREQ}x`);
  console.log(`Sample size:   ${SAMPLE} startup records`);
  console.log('═'.repeat(60) + '\n');

  // ── Collect raw sentences ────────────────────────────────────────────────
  console.log('📥 Loading startup text...');
  const TEXT_FIELDS = ['description','pitch','problem','solution','value_proposition','tagline','market'];

  const allSentences = [];

  // From startup_uploads
  let offset = 0;
  const PAGE = 500;
  while (allSentences.length < SAMPLE) {
    const { data: rows } = await supabase
      .from('startup_uploads')
      .select('extracted_data, name')
      .eq('status', 'approved')
      .not('extracted_data', 'is', null)
      .range(offset, offset + PAGE - 1);
    if (!rows?.length) break;
    for (const r of rows) {
      const ed = r.extracted_data || {};
      const text = TEXT_FIELDS.map(f => toStr(ed[f])).filter(Boolean).join('. ');
      if (text.length < 20) continue;
      for (const s of splitSentences(text)) allSentences.push({ sentence: s, name: r.name });
    }
    if (rows.length < PAGE) break;
    offset += PAGE;
  }

  // From discovered_startups (with description)
  const { data: disco } = await supabase
    .from('discovered_startups')
    .select('name, description, article_title')
    .not('description', 'is', null)
    .limit(2000);
  for (const r of (disco || [])) {
    const text = [r.article_title, r.description].filter(Boolean).join('. ');
    for (const s of splitSentences(text)) allSentences.push({ sentence: s, name: r.name });
  }

  console.log(`   Total sentences collected: ${allSentences.length.toLocaleString()}\n`);

  // ── Parse and collect unclassified ──────────────────────────────────────
  console.log('⚡ Running signal parser on all sentences...');
  const unclassified = [];
  const classified   = [];
  let total = 0;

  for (const { sentence, name } of allSentences) {
    total++;
    try {
      const sig = parseSignal(sentence, { actor_context: name });
      if (!sig || sig.primary_signal === 'unclassified_signal' || !sig.primary_signal) {
        unclassified.push(sentence);
      } else {
        classified.push({ sentence, cls: sig.primary_signal, conf: sig.confidence });
      }
    } catch { /* skip bad sentences */ }
  }

  const classRate = total > 0 ? Math.round(classified.length / total * 100) : 0;
  console.log(`   Total parsed:      ${total.toLocaleString()}`);
  console.log(`   Classified:        ${classified.length.toLocaleString()} (${classRate}%)`);
  console.log(`   Unclassified:      ${unclassified.length.toLocaleString()} (${100 - classRate}%)`);

  // ── Show top classified signal classes ───────────────────────────────────
  const classDist = {};
  for (const { cls } of classified) classDist[cls] = (classDist[cls] || 0) + 1;
  console.log('\n📊 Current classification distribution:');
  Object.entries(classDist).sort((a,b)=>b[1]-a[1]).forEach(([k,v]) => {
    const pct = Math.round(v/classified.length*100);
    console.log(`   ${String(v).padStart(5)}  ${k}  (${pct}%)`);
  });

  // ── N-gram analysis on unclassified ──────────────────────────────────────
  console.log('\n🔍 Mining unclassified sentences for recurring patterns...');
  const bigrams  = {};
  const trigrams = {};

  for (const s of unclassified) {
    for (const g of extractNgrams(s, 2)) bigrams[g]  = (bigrams[g]  || 0) + 1;
    for (const g of extractNgrams(s, 3)) trigrams[g] = (trigrams[g] || 0) + 1;
  }

  const topBigrams  = topN(bigrams,  50);
  const topTrigrams = topN(trigrams, 50);

  console.log(`\n   Top bigrams  (freq >= ${MIN_FREQ}):`);
  topBigrams.slice(0, 20).forEach(([g, c]) => console.log(`     ${String(c).padStart(4)}x  "${g}"`));

  console.log(`\n   Top trigrams (freq >= ${MIN_FREQ}):`);
  topTrigrams.slice(0, 20).forEach(([g, c]) => console.log(`     ${String(c).padStart(4)}x  "${g}"`));

  // ── Sample unclassified sentences ─────────────────────────────────────────
  console.log('\n📝 Sample unclassified sentences:');
  const sample = unclassified.slice(0, 15);
  sample.forEach((s, i) => console.log(`  ${String(i+1).padStart(2)}. ${s.slice(0, 120)}`));

  // ── Build expansion candidates ────────────────────────────────────────────
  // Use trigrams with high frequency as candidate patterns
  const expansionCandidates = topTrigrams
    .filter(([g, freq]) => freq >= Math.max(MIN_FREQ, 4))
    .map(([phrase, freq]) => ({
      phrase,
      freq,
      signal_class: inferClass(phrase),
    }))
    .slice(0, 30);

  console.log(`\n✨ Expansion candidates (${expansionCandidates.length}):`);
  expansionCandidates.forEach(({ phrase, freq, signal_class }) =>
    console.log(`   ${String(freq).padStart(4)}x  "${phrase}"  → ${signal_class}`)
  );

  // ── Coverage improvement estimate ─────────────────────────────────────────
  const coveredByNew = unclassified.filter(s => {
    const sl = s.toLowerCase();
    return expansionCandidates.some(c => sl.includes(c.phrase));
  }).length;
  console.log(`\n📈 Estimated new coverage from expansion: +${coveredByNew} sentences (+${Math.round(coveredByNew/total*100)}%)`);
  console.log(`   New classification rate would be: ~${classRate + Math.round(coveredByNew/total*100)}%`);

  // ── Apply: append to ontology ─────────────────────────────────────────────
  if (APPLY && expansionCandidates.length > 0) {
    console.log('\n🔧 Appending patterns to lib/signalOntology.js...');
    const added = appendToOntology(expansionCandidates);
    console.log(`   ✅ Added ${added} new patterns to ontology.`);
    console.log('   Re-run ingest-pythh-signals.js to pick up new classifications.');
  } else if (!APPLY) {
    console.log('\n💡 Run with --apply to auto-append these patterns to signalOntology.js.');
  }

  console.log('\n' + '═'.repeat(60));
}

main().catch(err => { console.error('❌ Fatal:', err.message); process.exit(1); });
