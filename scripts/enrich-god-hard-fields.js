#!/usr/bin/env node
/**
 * Enrich sparse startup_uploads fields that GOD scoring reads:
 * tagline, pitch, website, founders — sourced from description / extracted_data.
 *
 * Run before infer-traction-flags + god-score-formula:
 *   node scripts/enrich-god-hard-fields.js [--dry-run] [--limit=N]
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BATCH_SIZE = 50;
const SELECT = [
  'id', 'name', 'pitch', 'description', 'tagline', 'website', 'founders', 'extracted_data',
].join(', ');

function hasText(v, min = 20) {
  return typeof v === 'string' && v.trim().length >= min;
}

function firstSentence(text, maxLen = 160) {
  if (!text) return null;
  const t = text.trim();
  const m = t.match(/^[^.!?\n]+[.!?]?/);
  const s = (m ? m[0] : t.slice(0, maxLen)).trim();
  return s.length >= 12 ? s.slice(0, maxLen) : null;
}

function inferWebsite(startup, ext) {
  const candidates = [
    startup.website,
    ext.website,
    ext.url,
    ext.canonical_url,
    ext.source_url,
  ].filter((u) => typeof u === 'string' && u.trim().length > 8);
  for (const raw of candidates) {
    const u = raw.trim();
    if (/^https?:\/\//i.test(u)) return u;
    if (u.includes('.') && !u.includes(' ')) return `https://${u.replace(/^\/\//, '')}`;
  }
  return null;
}

function normalizeFounders(raw) {
  if (!raw) return null;
  const list = Array.isArray(raw) ? raw : [raw];
  const out = list
    .map((f) => {
      if (typeof f === 'string') return { name: f.trim() };
      if (f && typeof f === 'object') {
        const name = f.name || f.full_name || f.fullName;
        if (!name || typeof name !== 'string') return null;
        return {
          name: name.trim(),
          role: f.role || f.title || undefined,
          background: f.background || f.bio || undefined,
        };
      }
      return null;
    })
    .filter(Boolean);
  return out.length ? out : null;
}

function inferFounders(startup, ext) {
  return normalizeFounders(startup.founders)
    || normalizeFounders(ext.founders)
    || normalizeFounders(ext.team)
    || normalizeFounders(ext.founder_names);
}

function buildEnrichment(startup) {
  const ext = startup.extracted_data || {};
  const updates = {};
  const reasons = [];

  const desc = hasText(startup.description, 30) ? startup.description.trim() : null;
  const extDesc = hasText(ext.description, 30) ? ext.description.trim() : null;
  const body = desc || extDesc;

  if (!hasText(startup.tagline, 12) && body) {
    const tag = firstSentence(body, 140);
    if (tag) {
      updates.tagline = tag;
      reasons.push('tagline←description');
    }
  }

  if (!hasText(startup.pitch, 40)) {
    const fromTagline = hasText(startup.tagline, 20) ? startup.tagline.trim() : updates.tagline;
    const pitch = fromTagline && body && body.length > fromTagline.length + 20
      ? `${fromTagline} ${body.slice(0, 400)}`.trim().slice(0, 500)
      : (body || fromTagline);
    if (pitch && pitch.length >= 40) {
      updates.pitch = pitch.slice(0, 800);
      reasons.push('pitch←text');
    }
  }

  if (!hasText(startup.website, 8)) {
    const site = inferWebsite(startup, ext);
    if (site) {
      updates.website = site;
      reasons.push('website←extracted');
    }
  }

  const founders = inferFounders(startup, ext);
  const existing = Array.isArray(startup.founders) ? startup.founders : [];
  if (founders && founders.length > 0 && existing.length === 0) {
    updates.founders = founders;
    reasons.push('founders←extracted');
  }

  return { updates, reasons };
}

async function fetchApproved(limit) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const to = limit ? Math.min(from + 999, limit - 1) : from + 999;
    const { data, error } = await supabase
      .from('startup_uploads')
      .select(SELECT)
      .eq('status', 'approved')
      .order('id', { ascending: true })
      .range(from, to);
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < 1000 || (limit && rows.length >= limit)) break;
  }
  return limit ? rows.slice(0, limit) : rows;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;

  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║  ENRICH GOD HARD FIELDS (tagline, pitch, website, founders) ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log(`  Dry run: ${dryRun}`);
  if (limit) console.log(`  Limit:   ${limit}`);
  console.log('');

  const startups = await fetchApproved(limit);
  console.log(`📦 Loaded ${startups.length} approved startups\n`);

  const stats = { tagline: 0, pitch: 0, website: 0, founders: 0, changed: 0, errors: 0 };
  const pending = [];

  for (const startup of startups) {
    const { updates, reasons } = buildEnrichment(startup);
    if (!Object.keys(updates).length) continue;
    stats.changed++;
    for (const key of Object.keys(updates)) {
      if (stats[key] != null) stats[key]++;
    }
    pending.push({ id: startup.id, name: startup.name, updates, reasons });
    if (stats.changed <= 8) {
      console.log(`  → ${startup.name}: ${reasons.join(', ')}`);
    }
  }

  if (stats.changed > 8) {
    console.log(`  … and ${stats.changed - 8} more`);
  }

  if (!dryRun && pending.length > 0) {
    console.log(`\n💾 Applying ${pending.length} updates…\n`);
    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
      const batch = pending.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async ({ id, updates }) => {
          const { error } = await supabase.from('startup_uploads').update(updates).eq('id', id);
          if (error) stats.errors++;
        })
      );
    }
  }

  console.log('\n── Summary ──');
  console.log(`  Rows changed: ${stats.changed}`);
  console.log(`  tagline:      ${stats.tagline}`);
  console.log(`  pitch:        ${stats.pitch}`);
  console.log(`  website:      ${stats.website}`);
  console.log(`  founders:     ${stats.founders}`);
  if (!dryRun) console.log(`  Errors:       ${stats.errors}`);

  if (dryRun) {
    console.log('\n  DRY RUN — re-run without --dry-run to apply.');
  } else {
    console.log('\n  Next: node scripts/backfill-startup-metrics.js');
    console.log('        node scripts/infer-traction-flags.js');
    console.log('        node scripts/core/god-score-formula.js');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
