#!/usr/bin/env node
/**
 * Discover VC / Family Office (and other capital-provider) names mentioned in
 * funding news that are NOT yet in `investors`.
 *
 * Sources:
 *   - funding_evidence_participants with investor_id IS NULL
 *   - optional: recent FUNDING startup_events lead/participant text
 *
 * Classification uses lib/capitalProviderClassifier.js (FO vs VC vs angel…).
 *
 * Usage:
 *   node scripts/discover-missing-capital-providers.mjs
 *   node scripts/discover-missing-capital-providers.mjs --days=60 --min-events=1
 *   node scripts/discover-missing-capital-providers.mjs --provider-type=family_office
 *   node scripts/discover-missing-capital-providers.mjs --out=reports/missing-capital-providers.json
 *
 * Does NOT insert investors. Feed high-confidence firm rows into
 * seed-missing-funding-investor-profiles.mjs or funding:coverage:investors:resolve.
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  normalizeEntityName,
  stripInvestorHeadlineNoise,
  isPlausibleInvestorEntityName,
} = require('../server/lib/fundingEvidenceLedger.js');
const {
  classifyCapitalProvider,
  providerTypeToInvestorType,
} = require('../lib/capitalProviderClassifier.js');

function parseArg(prefix, fallback = null) {
  const hit = process.argv.find((a) => a.startsWith(`${prefix}=`));
  if (!hit) return fallback;
  return hit.slice(prefix.length + 1).trim() || fallback;
}

const DAYS = Number(parseArg('--days', '90')) || 90;
const MIN_EVENTS = Number(parseArg('--min-events', '1')) || 1;
const PROVIDER_FILTER = parseArg('--provider-type', null); // e.g. family_office, vc
const OUT =
  parseArg('--out') ||
  `reports/missing-capital-providers-${new Date().toISOString().slice(0, 10)}.json`;
const INCLUDE_EVENTS = process.argv.includes('--include-events');

const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const sinceIso = new Date(Date.now() - DAYS * 864e5).toISOString();

async function fetchAll(table, select, configure = (q) => q) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    let q = sb.from(table).select(select).range(offset, offset + 999);
    q = configure(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
    if (offset > 50000) break;
  }
  return rows;
}

function investorIndexKeys(row) {
  const keys = new Set();
  for (const raw of [row.name, row.firm]) {
    const cleaned = stripInvestorHeadlineNoise(raw);
    const n1 = normalizeEntityName(raw);
    const n2 = normalizeEntityName(cleaned);
    if (n1) keys.add(n1);
    if (n2) keys.add(n2);
    const lower = String(raw || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
    if (lower) keys.add(lower);
  }
  return keys;
}

async function main() {
  console.log(`\n══ Missing capital providers (last ${DAYS}d since ${sinceIso.slice(0, 10)}) ══\n`);

  const [participants, events, investors] = await Promise.all([
    fetchAll(
      'funding_evidence_participants',
      'id,funding_event_id,investor_id,investor_name_raw,participant_role,participation_relation,evidence_phrase,created_at',
      (q) =>
        q
          .is('investor_id', null)
          .not('participation_relation', 'is', null)
          .neq('participant_role', 'unknown')
          .gte('created_at', sinceIso),
    ),
    fetchAll(
      'funding_evidence_events',
      'id,startup_id,startup_name_raw,round_type,amount_usd,announced_at,verification_status,source_url,source_title',
      (q) => q.gte('announced_at', sinceIso).neq('verification_status', 'rejected'),
    ),
    fetchAll('investors', 'id,name,firm,type,investor_type,status,is_individual', (q) =>
      q.not('status', 'in', '("inactive","rejected","deleted")'),
    ),
  ]);

  const eventById = new Map(events.map((e) => [e.id, e]));
  const knownKeys = new Set();
  for (const inv of investors) {
    for (const k of investorIndexKeys(inv)) knownKeys.add(k);
  }

  const groups = new Map();

  function bump(rawName, meta) {
    let cleaned = stripInvestorHeadlineNoise(rawName) || String(rawName || '').trim();
    // Extraction debris glued onto firm names
    cleaned = cleaned
      .replace(/\s+with\s+the\s+participation\s+of\b.*$/i, '')
      .replace(/\s+followed(?:\s+by)?\s*$/i, '')
      .replace(/\s+on\s+behalf\s+of\b.*$/i, '')
      .trim();
    if (!cleaned || !isPlausibleInvestorEntityName(cleaned)) return;
    const normalized = normalizeEntityName(cleaned);
    if (!normalized || knownKeys.has(normalized)) return;
    // Also skip if lowercase display matches a known firm
    const lower = cleaned.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (knownKeys.has(lower)) return;

    const phrase = meta.phrase || '';
    const classified = classifyCapitalProvider(cleaned, phrase);
    if (PROVIDER_FILTER && classified.provider_type !== PROVIDER_FILTER) return;

    const cur = groups.get(normalized) || {
      normalized_name: normalized,
      display_names: new Set(),
      provider_type: classified.provider_type,
      confidence: classified.confidence,
      reasons: new Set(classified.reasons),
      suggested_investor_type: classified.suggested_investor_type,
      event_ids: new Set(),
      startups: new Set(),
      roles: new Set(),
      evidence: [],
      in_db: false,
    };

    // Prefer higher-confidence classification if FO/sovereign beats generic VC
    if (classified.confidence > cur.confidence) {
      cur.provider_type = classified.provider_type;
      cur.confidence = classified.confidence;
      cur.suggested_investor_type = classified.suggested_investor_type;
    }
    for (const r of classified.reasons) cur.reasons.add(r);

    cur.display_names.add(cleaned);
    if (meta.eventId) cur.event_ids.add(meta.eventId);
    if (meta.startup) cur.startups.add(meta.startup);
    if (meta.role) cur.roles.add(meta.role);
    if (cur.evidence.length < 4 && (meta.phrase || meta.source_url)) {
      cur.evidence.push({
        startup: meta.startup || null,
        announced_at: meta.announced_at || null,
        role: meta.role || null,
        source_url: meta.source_url || null,
        phrase: meta.phrase || null,
      });
    }
    groups.set(normalized, cur);
  }

  for (const p of participants) {
    const event = eventById.get(p.funding_event_id);
    if (!event) continue;
    bump(p.investor_name_raw, {
      eventId: event.id,
      startup: event.startup_name_raw,
      announced_at: event.announced_at,
      role: p.participant_role,
      phrase: p.evidence_phrase || event.source_title,
      source_url: event.source_url,
    });
  }

  // Optional: pull firm-like tokens from recent FUNDING headlines not yet in ledger
  if (INCLUDE_EVENTS) {
    const raiseEvents = await fetchAll(
      'startup_events',
      'id,subject,object,source_title,source_url,created_at,round',
      (q) =>
        q
          .gte('created_at', sinceIso)
          .in('event_type', ['FUNDING', 'INVESTMENT'])
          .order('created_at', { ascending: false }),
    );
    const leadRe =
      /\b(?:led by|co-led by|led the round|backing from|participation from|joined by)\s+([A-Z][\w&.''\-\s,]+?)(?:\s+(?:with|to|in|for)\b|$)/g;
    for (const e of raiseEvents) {
      const text = `${e.source_title || ''} ${e.object || ''}`;
      let m;
      leadRe.lastIndex = 0;
      while ((m = leadRe.exec(text)) !== null) {
        const chunk = m[1].replace(/\s+/g, ' ').trim();
        // Split "A and B, C and D" on "and" and comma
        for (const part of chunk.split(/\s+and\s+|,\s*/i)) {
          bump(part, {
            eventId: e.id,
            startup: e.subject,
            announced_at: e.created_at,
            role: 'unknown',
            phrase: e.source_title,
            source_url: e.source_url,
          });
        }
      }
    }
  }

  const priority = [...groups.values()]
    .map((g) => ({
      normalized_name: g.normalized_name,
      display_names: [...g.display_names],
      provider_type: g.provider_type,
      confidence: Number(g.confidence.toFixed(2)),
      reasons: [...g.reasons],
      suggested_investor_type: g.suggested_investor_type || providerTypeToInvestorType(g.provider_type),
      event_count: g.event_ids.size,
      startup_count: g.startups.size,
      roles: [...g.roles],
      next_action:
        g.provider_type === 'family_office'
          ? 'seed_family_office_profile'
          : g.provider_type === 'vc' && g.confidence >= 0.7
            ? 'seed_vc_profile'
            : g.provider_type === 'angel'
              ? 'review_as_individual_angel'
              : 'manual_review',
      evidence: g.evidence,
    }))
    .filter((g) => g.event_count >= MIN_EVENTS)
    .sort((a, b) => {
      const foA = a.provider_type === 'family_office' ? 1 : 0;
      const foB = b.provider_type === 'family_office' ? 1 : 0;
      const leadA = a.roles.some((r) => r === 'lead' || r === 'co_lead') ? 1 : 0;
      const leadB = b.roles.some((r) => r === 'lead' || r === 'co_lead') ? 1 : 0;
      return (
        foB - foA ||
        b.event_count - a.event_count ||
        leadB - leadA ||
        b.confidence - a.confidence ||
        a.normalized_name.localeCompare(b.normalized_name)
      );
    });

  const byType = {};
  for (const row of priority) {
    byType[row.provider_type] = (byType[row.provider_type] || 0) + 1;
  }

  const report = {
    generated_at: new Date().toISOString(),
    window_days: DAYS,
    since: sinceIso.slice(0, 10),
    investors_in_db: investors.length,
    unmatched_participants_scanned: participants.length,
    missing_capital_providers: priority.length,
    by_provider_type: byType,
    family_offices: priority.filter((p) => p.provider_type === 'family_office'),
    high_confidence_vcs: priority.filter(
      (p) => p.provider_type === 'vc' && p.confidence >= 0.7 && p.event_count >= 1,
    ),
    priority: priority.slice(0, 200),
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));

  console.log(`Wrote ${OUT}`);
  console.log('Counts:', {
    investors_in_db: report.investors_in_db,
    unmatched_participants: report.unmatched_participants_scanned,
    missing: report.missing_capital_providers,
    by_type: byType,
  });

  console.log('\nFamily offices (missing from DB):');
  const fos = report.family_offices.slice(0, 20);
  if (!fos.length) console.log('  (none classified in this window)');
  for (const f of fos) {
    console.log(
      `  - ${f.display_names[0]}  events=${f.event_count}  conf=${f.confidence}  [${f.reasons.join(',')}]`,
    );
  }

  console.log('\nHigh-confidence VCs (missing from DB):');
  for (const v of report.high_confidence_vcs.slice(0, 25)) {
    console.log(
      `  - ${v.display_names[0]}  events=${v.event_count}  roles=${v.roles.join('|') || '—'}  conf=${v.confidence}`,
    );
  }

  console.log('\nTop missing (all types):');
  for (const p of priority.slice(0, 20)) {
    console.log(
      `  ${String(p.event_count).padStart(3)}  ${p.provider_type.padEnd(14)}  ${p.display_names[0]}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
