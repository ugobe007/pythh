#!/usr/bin/env node
/**
 * CLEAN EXTRACTED DATA
 * ─────────────────────────────────────────────────────────────────────────────
 * Strips HTML artifacts and noise from startup_uploads.extracted_data text
 * fields so the signal parser gets clean input.
 *
 * The audit showed ~75% of "unclassified" sentences are HTML fragments:
 *   <head> <meta charset=...>
 *   script var gform gform document...
 *   > <head><meta charset=
 *
 * This script cleans those up in-place so re-running ingest produces better
 * signal coverage without any ontology changes.
 *
 * Usage:
 *   node scripts/clean-extracted-data.js          # dry-run (shows stats)
 *   node scripts/clean-extracted-data.js --apply  # write cleaned data
 */

'use strict';
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const REQUIRED_ENV = ['VITE_SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
for (const k of REQUIRED_ENV) {
  if (!process.env[k]) { console.error(`❌ Missing ${k}`); process.exit(1); }
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const DRY_RUN = !process.argv.includes('--apply');

// ── Aggressive text cleaning ──────────────────────────────────────────────
function cleanText(text) {
  if (!text || typeof text !== 'string') return text;

  let t = text;

  // Strip full HTML tags and attributes
  t = t.replace(/<[^>]{0,500}>/g, ' ');

  // Strip HTML entities
  t = t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
       .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
       .replace(/&[a-z]+;/g, ' ');

  // Strip JavaScript artifacts
  t = t.replace(/\bvar\s+[a-z_$][\w$]*\s*=/gi, ' ');
  t = t.replace(/\b(gform|addEventListener|document\.|window\.|function\s*\()/g, ' ');
  t = t.replace(/[{}\[\]]/g, ' ');

  // Strip URLs
  t = t.replace(/https?:\/\/[^\s]+/g, ' ');

  // Strip bare CSS/JSON fragments
  t = t.replace(/[a-zA-Z-]+\s*:\s*[a-zA-Z0-9#%"',\s]+;/g, ' ');

  // Collapse whitespace
  t = t.replace(/\s{2,}/g, ' ').trim();

  // Return null if still garbage (too short or high special-char ratio)
  if (t.length < 15) return null;
  const specialRatio = (t.match(/[^a-zA-Z0-9\s.,!?;:'"()-]/g) || []).length / t.length;
  if (specialRatio > 0.25) return null;

  return t;
}

function cleanField(val) {
  if (!val) return val;
  if (typeof val === 'string') return cleanText(val);
  if (Array.isArray(val)) return val.map(cleanField).filter(Boolean);
  if (typeof val === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(val)) out[k] = cleanField(v);
    return out;
  }
  return val;
}

const TEXT_FIELDS = ['description', 'pitch', 'problem', 'solution', 'value_proposition', 'tagline', 'market', 'web_signals', 'execution_signals'];

function isHtmlGarbage(text) {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase();
  return lower.includes('<head') || lower.includes('<meta') || lower.includes('gform') ||
         lower.includes('addeventlistener') || lower.includes('document.') ||
         lower.includes('charset=') || /var\s+[a-z]/.test(lower);
}

function needsCleaning(ed) {
  if (!ed || typeof ed !== 'object') return false;
  for (const f of TEXT_FIELDS) {
    if (isHtmlGarbage(ed[f])) return true;
  }
  return false;
}

async function main() {
  console.log('\n🧹 EXTRACTED DATA CLEANER');
  console.log('═'.repeat(60));
  console.log(`Mode: ${DRY_RUN ? '🔍 DRY-RUN' : '✍️  APPLY'}`);
  console.log('═'.repeat(60) + '\n');

  let offset = 0;
  const PAGE = 500;
  let total = 0, dirty = 0, cleaned = 0, errors = 0;
  const toUpdate = [];

  console.log('📥 Scanning startup_uploads...');

  while (true) {
    const { data: rows } = await supabase
      .from('startup_uploads')
      .select('id, extracted_data')
      .eq('status', 'approved')
      .not('extracted_data', 'is', null)
      .range(offset, offset + PAGE - 1);

    if (!rows?.length) break;
    total += rows.length;

    for (const row of rows) {
      if (!needsCleaning(row.extracted_data)) continue;
      dirty++;

      // Clean each text field
      const cleaned_ed = { ...row.extracted_data };
      let changed = false;
      for (const f of TEXT_FIELDS) {
        if (!cleaned_ed[f]) continue;
        const original = typeof cleaned_ed[f] === 'string' ? cleaned_ed[f] : JSON.stringify(cleaned_ed[f]);
        const clean = cleanField(cleaned_ed[f]);
        const cleanStr = typeof clean === 'string' ? clean : JSON.stringify(clean);
        if (cleanStr !== original) {
          cleaned_ed[f] = clean;
          changed = true;
        }
      }

      if (changed) {
        cleaned++;
        toUpdate.push({ id: row.id, extracted_data: cleaned_ed });
      }
    }

    process.stdout.write(`\r   Scanned: ${total}, Dirty: ${dirty}, To clean: ${cleaned}  `);
    if (rows.length < PAGE) break;
    offset += PAGE;
  }

  console.log(`\n\n   Total scanned:   ${total.toLocaleString()}`);
  console.log(`   Dirty records:   ${dirty.toLocaleString()}`);
  console.log(`   To update:       ${cleaned.toLocaleString()}`);

  if (!toUpdate.length) {
    console.log('\n✅ Nothing to clean.');
    return;
  }

  if (DRY_RUN) {
    console.log('\n   Sample dirty record (before):');
    const sample = toUpdate[0];
    const ed = sample.extracted_data;
    const field = TEXT_FIELDS.find(f => isHtmlGarbage(ed[f]));
    if (field) console.log(`   [${field}]: "${String(ed[field]).slice(0,150)}"`);
    console.log('\n💡 Run with --apply to clean these records.');
    return;
  }

  // Apply in batches
  console.log('\n🔧 Applying updates...');
  const BATCH = 50;
  for (let i = 0; i < toUpdate.length; i += BATCH) {
    const batch = toUpdate.slice(i, i + BATCH);
    await Promise.all(batch.map(r =>
      supabase.from('startup_uploads').update({ extracted_data: r.extracted_data }).eq('id', r.id)
    ));
    process.stdout.write(`\r   Updated: ${Math.min(i + BATCH, toUpdate.length)}/${toUpdate.length}  `);
  }

  console.log(`\n\n✅ Cleaned ${cleaned} startup records.`);
  console.log('   Re-run: node scripts/ingest-pythh-signals.js --apply --skip-existing --limit 14000');
  console.log('═'.repeat(60));
}

main().catch(err => { console.error('❌ Fatal:', err.message); process.exit(1); });
