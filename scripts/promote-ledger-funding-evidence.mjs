#!/usr/bin/env node
/**
 * Promote issuer-primary funding_evidence_events → verified match_validation_evidence.
 *
 * For each wire/blog funding event on a matched startup (announce > match):
 *   fetch article → strict investor hits → upsert evidence → auto-verify.
 *
 * Also:
 *   - boosts funding_evidence_search_queue priority for those startups
 *   - rejects pending low-tier Google News RSS that cannot be issuer-primary
 *
 * Usage:
 *   npm run outcomes:promote-ledger -- --limit=50
 *   npm run outcomes:promote-ledger -- --apply --limit=50
 *   npm run outcomes:promote-ledger -- --apply --reject-low-pending --limit=50
 */
import 'dotenv/config';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { extractKnownInvestorMentions } = require('../server/lib/fundingParticipationOntology.js');
const { isIssuerPrimary } = require('../server/lib/matchEvidenceSourceTier.js');
const { filterCleanHits } = require('../server/lib/matchEvidenceInvestorHit.js');

const apply = process.argv.includes('--apply');
const rejectLowPending = process.argv.includes('--reject-low-pending');
const limit = Math.max(1, Number(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] || 50));

function massageConnectionString(connectionString) {
  const s = String(connectionString || '');
  if (/sslmode=no-verify/i.test(s)) return s;
  if (/sslmode=/i.test(s)) return s.replace(/sslmode=[^&]*/i, 'sslmode=no-verify');
  return s.includes('?') ? `${s}&sslmode=no-verify` : `${s}?sslmode=no-verify`;
}

function articleText(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 20000);
}

function startupNamedInText(text, startupName) {
  const hay = String(text || '').toLowerCase();
  const name = String(startupName || '').toLowerCase().trim();
  if (name.length < 3) return false;
  if (hay.includes(name)) return true;
  const token = name.split(/\s+/)[0];
  return token.length >= 4 && new RegExp(`(^|[^a-z0-9])${token}([^a-z0-9]|$)`, 'i').test(hay);
}

async function resolveReviewerId(pool) {
  if (process.env.PYTHH_REVIEWER_USER_ID) return process.env.PYTHH_REVIEWER_USER_ID;
  const email = process.env.OWNER_EMAILS?.split(',')[0]?.trim() || 'ugobe07@gmail.com';
  const { rows } = await pool.query('SELECT id FROM auth.users WHERE email = $1 LIMIT 1', [email]);
  if (!rows[0]?.id) throw new Error(`No auth.users row for ${email}`);
  return rows[0].id;
}

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey || !process.env.DATABASE_URL) {
  throw new Error('Need DATABASE_URL + Supabase service env');
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } });
const pool = new pg.Pool({
  connectionString: massageConnectionString(process.env.DATABASE_URL),
  max: 2,
});

const summary = {
  mode: apply ? 'apply' : 'dry-run',
  events_scanned: 0,
  events_with_startup_mention: 0,
  clean_hits: 0,
  evidence_upserted: 0,
  verified: 0,
  queue_boosted: 0,
  low_pending_rejected: 0,
  errors: [],
  samples: [],
};

const { rows: events } = await pool.query(
  `
  (
    SELECT fe.id::text AS fee_id, fe.startup_id, fe.announced_at, fe.source_url, fe.source_title,
           fe.round_type, su.name AS startup_name, su.website, 'ledger'::text AS origin
    FROM funding_evidence_events fe
    JOIN startup_uploads su ON su.id = fe.startup_id
    WHERE fe.startup_id IS NOT NULL
      AND fe.announced_at IS NOT NULL
      AND fe.source_url IS NOT NULL
      AND (
        fe.source_url ILIKE '%businesswire%'
        OR fe.source_url ILIKE '%prnewswire%'
        OR fe.source_url ILIKE '%globenewswire%'
        OR fe.source_url ILIKE '%/blog/%'
        OR fe.source_url ILIKE '%/newsroom/%'
      )
      AND EXISTS (
        SELECT 1 FROM startup_investor_matches m
        WHERE m.startup_id = fe.startup_id AND m.created_at < fe.announced_at
      )
  )
  UNION ALL
  (
    SELECT e.id::text AS fee_id, e.startup_id, e.event_at AS announced_at, e.source_url,
           coalesce(e.raw_payload->>'source_title', '') AS source_title,
           NULL::text AS round_type, su.name AS startup_name, su.website, 'expand_verified'::text AS origin
    FROM match_validation_evidence e
    JOIN startup_uploads su ON su.id = e.startup_id
    WHERE e.verified
      AND (
        e.source_url ILIKE '%businesswire%'
        OR e.source_url ILIKE '%prnewswire%'
        OR e.source_url ILIKE '%globenewswire%'
        OR e.source_url ILIKE '%/blog/%'
        OR e.source_url ILIKE '%/newsroom/%'
      )
  )
  ORDER BY announced_at DESC
  LIMIT $1
`,
  [limit],
);

summary.events_scanned = events.length;
const reviewer = apply ? await resolveReviewerId(pool) : null;

for (const event of events) {
  try {
    if (!isIssuerPrimary(event.source_url)) continue;
    const announcedAt = new Date(event.announced_at).toISOString();
    if (!Number.isFinite(Date.parse(announcedAt))) continue;

    const res = await fetch(event.source_url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
      headers: { 'user-agent': 'PythhLedgerPromote/1.0 (+https://pythh.ai)' },
    });
    if (!res.ok) continue;
    const text = articleText(await res.text());
    const title = String(event.source_title || '');
    if (!startupNamedInText(`${title}\n${text}`, event.startup_name)) continue;
    if (!/\b(rais(?:e|es|ed|ing)|funding|financing|series\s+[a-z]|seed|investment|invests?)\b/i.test(`${title}\n${text}`)) {
      continue;
    }
    summary.events_with_startup_mention += 1;

    const { data: matchRows, error: matchErr } = await db
      .from('startup_investor_matches')
      .select('id, investor_id, created_at, investors(id,name,firm)')
      .eq('startup_id', event.startup_id)
      .lt('created_at', announcedAt)
      .limit(2000);
    if (matchErr) throw new Error(matchErr.message);

    const investors = (matchRows || [])
      .map((m) => ({
        match_id: m.id,
        matched_at: m.created_at,
        id: m.investors?.id || m.investor_id,
        name: m.investors?.name,
        firm: m.investors?.firm,
      }))
      .filter((i) => i.id);

    const mentions = filterCleanHits(extractKnownInvestorMentions(text, investors));
    summary.clean_hits += mentions.length;

    for (const mention of mentions) {
      const match = investors.find((i) => i.id === mention.investor.id);
      if (!match) continue;

      const sample = {
        startup: event.startup_name,
        investor: mention.investor.name || mention.investor.firm,
        url: event.source_url,
        event_at: announcedAt,
      };

      if (!apply) {
        summary.samples.push({ ...sample, mode: 'dry-run' });
        continue;
      }

      const { data: existing } = await db
        .from('match_validation_evidence')
        .select('id, verified, review_status')
        .eq('match_id', match.match_id)
        .eq('source_url', event.source_url)
        .maybeSingle();

      let evidenceId = existing?.id;
      if (!evidenceId) {
        const { data: inserted, error: upErr } = await db
          .from('match_validation_evidence')
          .upsert(
            {
              match_id: match.match_id,
              startup_id: event.startup_id,
              investor_id: mention.investor.id,
              evidence_type: 'funding',
              event_at: announcedAt,
              source_url: event.source_url,
              source_provider:
                event.origin === 'expand_verified' ? 'expand_verified_source' : 'funding_evidence_ledger',
              source_record_type: 'funding_evidence_events',
              source_record_id: event.fee_id,
              resolution_method: 'name_exact_unique',
              resolution_confidence: 0.95,
              review_status: 'pending',
              verified: false,
              raw_payload: {
                discovery_method: 'promote_ledger_funding_evidence',
                origin: event.origin || 'ledger',
                investorNameRaw: mention.investorNameRaw,
                round_type: event.round_type,
              },
            },
            { onConflict: 'match_id,evidence_type,source_url,event_at', ignoreDuplicates: false },
          )
          .select('id, verified, review_status')
          .maybeSingle();
        if (upErr) throw new Error(upErr.message);
        evidenceId = inserted?.id;
        if (evidenceId) summary.evidence_upserted += 1;
      }

      if (!evidenceId) {
        const { data: again } = await db
          .from('match_validation_evidence')
          .select('id, verified, review_status')
          .eq('match_id', match.match_id)
          .eq('source_url', event.source_url)
          .maybeSingle();
        evidenceId = again?.id;
        if (again && !existing) summary.evidence_upserted += 1;
      }

      if (evidenceId && !(existing?.verified || existing?.review_status === 'verified')) {
        const { error: revErr } = await db.rpc('review_match_validation_evidence', {
          p_evidence_id: evidenceId,
          p_decision: 'verified',
          p_reviewer: reviewer,
          p_note: 'auto-verified: issuer-primary ledger article + clean investor hit',
        });
        if (revErr) throw new Error(revErr.message);
        summary.verified += 1;
        await db.rpc('refresh_startup_match_outcome_classifications', {
          p_startup_id: event.startup_id,
        });
        summary.samples.push({ ...sample, evidenceId, verified: true });
      }
    }

    if (apply) {
      const { data: qRow } = await db
        .from('funding_evidence_search_queue')
        .select('startup_id, priority, status')
        .eq('startup_id', event.startup_id)
        .maybeSingle();
      if (qRow) {
        await db
          .from('funding_evidence_search_queue')
          .update({
            priority: Math.max(Number(qRow.priority) || 0, 50000),
            status: qRow.status === 'processing' ? 'processing' : 'pending',
            updated_at: new Date().toISOString(),
            error_message: 'priority_boost:issuer_ledger_event',
          })
          .eq('startup_id', event.startup_id);
      } else {
        await db.from('funding_evidence_search_queue').insert({
          startup_id: event.startup_id,
          status: 'pending',
          priority: 50000,
          earliest_match_at: announcedAt,
          updated_at: new Date().toISOString(),
          error_message: 'priority_boost:issuer_ledger_event',
        });
      }
      summary.queue_boosted += 1;
    }
  } catch (err) {
    summary.errors.push({ fee_id: event.fee_id, error: String(err?.message || err) });
  }
}

if (rejectLowPending) {
  const { rows: lowPending } = await pool.query(`
    SELECT e.id
    FROM match_validation_evidence e
    JOIN startup_investor_matches m ON m.id = e.match_id
    WHERE e.review_status = 'pending'
      AND e.event_at > m.created_at
      AND (
        e.source_url ILIKE '%news.google.com%'
        OR e.source_url ILIKE '%vertexaisearch.cloud.google.com%'
      )
    ORDER BY e.event_at DESC
    LIMIT 200
  `);

  for (const row of lowPending) {
    if (!apply) {
      summary.low_pending_rejected += 1;
      continue;
    }
    const { error } = await db.rpc('review_match_validation_evidence', {
      p_evidence_id: row.id,
      p_decision: 'rejected',
      p_reviewer: reviewer,
      p_note: 'auto-reject: unresolved Google News RSS is not issuer-primary',
    });
    if (!error) summary.low_pending_rejected += 1;
    else summary.errors.push({ evidenceId: row.id, error: error.message });
  }
}

await pool.end();
console.log(JSON.stringify(summary, null, 2));
