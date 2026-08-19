#!/usr/bin/env node
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { normalizeEntityName } = require('../server/lib/fundingEvidenceLedger.js');
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and service-role key are required');
const db = createClient(url, key, { auth: { persistSession: false } });

const targets = [
  'Gradient', 'Horizon', 'Y Combinator', 'Citius', 'BTG Pactual', 'GIC', 'Monashees',
  'Pacific Alliance Ventures', 'Portage', 'Apollo Global Management', 'Hamilton Lane', 'Broadhaven Ventures',
];

const targetAliases = new Map([
  ['Gradient', ['Gradient', 'Gradient Ventures']],
  ['Horizon', ['Horizon', 'Horizon Ventures']],
  ['Y Combinator', ['Y Combinator', 'YC']],
  ['Pacific Alliance Ventures', ['Pacific Alliance Ventures', 'PAV']],
  ['Portage', ['Portage', 'Portage Ventures']],
]);

function isExactAlias(value, aliases) {
  const raw = String(value || '').trim();
  if (!raw) return false;
  const rawLower = raw.toLowerCase();
  const rawNormalized = normalizeEntityName(raw);
  return aliases.some(alias => {
    const aliasText = String(alias).trim();
    return rawLower === aliasText.toLowerCase()
      || (rawNormalized && rawNormalized === normalizeEntityName(aliasText));
  });
}

async function main() {
  const investors = [];
  for (let offset = 0; offset < 50000; offset += 1000) {
    const { data, error } = await db.from('investors')
      .select('id,name,firm,url,sectors,stage,geography_focus,check_size_min,check_size_max,status,is_verified,created_at')
      .range(offset, offset + 999);
    if (error) throw error;
    investors.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  const reports = [];
  for (const target of targets) {
    const normalized = normalizeEntityName(target);
    const aliases = targetAliases.get(target) || [target];
    const candidates = investors.filter(row =>
      [row.name, row.firm].some(value => isExactAlias(value, aliases))
    );
    const ids = candidates.map(row => row.id);
    let referenceCounts = new Map();
    if (ids.length) {
      const [{ data: matches }, { data: participants }, { data: snapshots }] = await Promise.all([
        db.from('startup_investor_matches').select('investor_id').in('investor_id', ids),
        db.from('funding_evidence_participants').select('investor_id').in('investor_id', ids),
        db.from('funding_prediction_snapshots').select('investor_id').in('investor_id', ids),
      ]);
      for (const id of ids) referenceCounts.set(id, {
        matches: (matches || []).filter(row => row.investor_id === id).length,
        participants: (participants || []).filter(row => row.investor_id === id).length,
        snapshots: (snapshots || []).filter(row => row.investor_id === id).length,
      });
    }
    reports.push({ target, normalized, candidate_count: candidates.length, candidates: candidates.map(row => ({ ...row, references: referenceCounts.get(row.id) || { matches: 0, participants: 0, snapshots: 0 } })) });
  }
  console.log(JSON.stringify({ investors_scanned: investors.length, targets: reports }, null, 2));
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
