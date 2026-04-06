#!/usr/bin/env node
/**
 * Backfill startup_uploads.tagline when missing or very short (< minLen) from narrative text.
 * Priority: description → pitch → extracted_data.description → value_proposition (first 400 chars).
 * Takes first sentence (up to maxLen chars) as candidate.
 *
 * Default: dry-run (no writes). Use --apply to update.
 *
 *   node scripts/backfill-tagline-from-description.js
 *   node scripts/backfill-tagline-from-description.js --apply
 *   node scripts/backfill-tagline-from-description.js --apply --status=approved --limit=2000
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ quiet: true });

const PAGE = 1000;
const DEFAULT_MIN_EXISTING = 8;
const MIN_CANDIDATE = 20;
const MAX_CANDIDATE = 220;

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

function parseArgs(argv) {
  const out = {
    apply: false,
    status: 'approved',
    limit: null,
    minExisting: DEFAULT_MIN_EXISTING,
  };
  for (const a of argv) {
    if (a === '--apply') out.apply = true;
    else if (a.startsWith('--status=')) out.status = a.slice('--status='.length) || 'approved';
    else if (a.startsWith('--limit=')) out.limit = Math.max(0, parseInt(a.slice('--limit='.length), 10) || 0);
    else if (a.startsWith('--min-existing=')) out.minExisting = Math.max(0, parseInt(a.slice('--min-existing='.length), 10) || 0);
  }
  return out;
}

function narrativeSource(row) {
  const ed = row.extracted_data && typeof row.extracted_data === 'object' ? row.extracted_data : {};
  /** Prefer founder-ish fields before raw article body (description is often RSS). */
  const pick = [
    typeof ed.value_proposition === 'string' ? ed.value_proposition.slice(0, 600) : '',
    row.pitch,
    ed.pitch,
    row.description,
    ed.description,
  ]
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .find(Boolean);
  return pick || '';
}

/** First sentence or first maxLen chars; strip HTML-ish noise */
function firstSentence(raw, maxLen) {
  let t = raw.replace(/<[^>]{0,200}>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  const m = t.match(/^.{1,400}?[.!?](?=\s|$)/);
  const s = m ? m[0].trim() : t;
  return s.length > maxLen ? s.slice(0, maxLen).replace(/\s+\S*$/, '').trim() : s;
}

function needsBackfill(tagline, minExisting) {
  const t = typeof tagline === 'string' ? tagline.trim() : '';
  return t.length < minExisting;
}

async function fetchPage(supabase, statusFilter, from) {
  let q = supabase
    .from('startup_uploads')
    .select('id,tagline,description,pitch,extracted_data,status')
    .order('id', { ascending: true })
    .range(from, from + PAGE - 1);
  if (statusFilter !== 'all') q = q.eq('status', statusFilter);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_KEY / VITE_SUPABASE_ANON_KEY');
    process.exit(1);
  }
  if (args.apply && !process.env.SUPABASE_SERVICE_KEY) {
    console.warn('⚠️  --apply strongly prefers SUPABASE_SERVICE_KEY for RLS writes.');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  let from = 0;
  const candidates = [];
  let scanned = 0;

  for (;;) {
    const batch = await fetchPage(supabase, args.status, from);
    if (batch.length === 0) break;
    scanned += batch.length;

    for (const row of batch) {
      if (!needsBackfill(row.tagline, args.minExisting)) continue;
      const src = narrativeSource(row);
      const cand = firstSentence(src, MAX_CANDIDATE);
      if (cand.length < MIN_CANDIDATE) continue;
      candidates.push({ id: row.id, tagline: cand, preview: cand.slice(0, 100) });
      if (args.limit != null && candidates.length >= args.limit) break;
    }

    if (args.limit != null && candidates.length >= args.limit) break;
    if (batch.length < PAGE) break;
    from += batch.length;
  }

  console.log('\n📝 Tagline backfill from description / pitch / extracted text');
  console.log(`Mode:      ${args.apply ? 'APPLY' : 'DRY RUN'}`);
  console.log(`Status:    ${args.status}`);
  console.log(`Scanned:   ${scanned} rows`);
  console.log(`Candidates:${candidates.length} (tagline < ${args.minExisting} chars, candidate ≥ ${MIN_CANDIDATE})`);
  if (candidates.length) {
    console.log('\nSample:');
    for (const c of candidates.slice(0, 5)) {
      console.log(`  ${c.id.slice(0, 8)}…  ${c.preview}${c.tagline.length > 100 ? '…' : ''}`);
    }
  }

  if (!args.apply || candidates.length === 0) {
    if (!args.apply) console.log('\nRun with --apply to write tagline on startup_uploads.\n');
    return;
  }

  let ok = 0;
  let fail = 0;
  for (const c of candidates) {
    const { error } = await supabase.from('startup_uploads').update({ tagline: c.tagline }).eq('id', c.id);
    if (error) {
      fail += 1;
      console.error(`  ❌ ${c.id}: ${error.message}`);
    } else {
      ok += 1;
    }
  }
  console.log(`\n✅ Updated ${ok}  ❌ ${fail}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
