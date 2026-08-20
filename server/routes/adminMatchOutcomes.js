/**
 * Admin API: match outcome proof loop
 * GET  /match-outcomes/proof
 * GET  /match-outcomes/pending
 * POST /match-outcomes/review
 * GET  /match-outcomes/queue
 *
 * Uses Supabase service client (works on Fly without a working DATABASE_URL).
 * Optional Postgres pool only when DATABASE_URL has a real hostname (not placeholders like "base").
 */
const express = require('express');
const pg = require('pg');
const router = express.Router();
const { getSupabaseClient } = require('../lib/supabaseClient');
const { sourceTier, isIssuerPrimary } = require('../lib/matchEvidenceSourceTier');

function massageConnectionString(connectionString) {
  const s = String(connectionString || '');
  if (/sslmode=no-verify/i.test(s)) return s;
  if (/sslmode=/i.test(s)) return s.replace(/sslmode=[^&]*/i, 'sslmode=no-verify');
  return s.includes('?') ? `${s}&sslmode=no-verify` : `${s}?sslmode=no-verify`;
}

/** Reject placeholder / broken DATABASE_URL hosts (Fly had hostname "base" → ENOTFOUND). */
function databaseUrlHost(connectionString) {
  try {
    const normalized = String(connectionString || '')
      .replace(/^postgresql:/i, 'http:')
      .replace(/^postgres:/i, 'http:');
    const host = new URL(normalized).hostname.toLowerCase();
    return host || null;
  } catch {
    return null;
  }
}

function isUsableDatabaseUrl(connectionString) {
  const host = databaseUrlHost(connectionString);
  if (!host) return false;
  // Fly previously had DATABASE_URL with hostname literally "base" → getaddrinfo ENOTFOUND base
  if (host === 'base' || host === 'hostname' || host === 'your-db-host') return false;
  if (
    (process.env.FLY_APP_NAME || process.env.NODE_ENV === 'production') &&
    (host === 'localhost' || host === '127.0.0.1')
  ) {
    return false;
  }
  return true;
}

function getPoolOrNull() {
  const raw = process.env.DATABASE_URL;
  if (!raw || !isUsableDatabaseUrl(raw)) return null;
  return new pg.Pool({
    connectionString: massageConnectionString(raw),
    max: 1,
  });
}

async function resolveReviewerId(req) {
  if (process.env.PYTHH_REVIEWER_USER_ID) return process.env.PYTHH_REVIEWER_USER_ID;
  const email =
    req.headers['x-user-email'] ||
    process.env.OWNER_EMAILS?.split(',')[0]?.trim() ||
    'ugobe07@gmail.com';

  const pool = getPoolOrNull();
  if (pool) {
    try {
      const { rows } = await pool.query('SELECT id FROM auth.users WHERE email = $1 LIMIT 1', [
        String(email).toLowerCase(),
      ]);
      if (rows[0]?.id) return rows[0].id;
    } finally {
      await pool.end();
    }
  }

  // Supabase Auth admin API (service role) — no Postgres required
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw new Error(`resolve reviewer: ${error.message}`);
  const hit = (data?.users || []).find((u) => String(u.email || '').toLowerCase() === String(email).toLowerCase());
  if (!hit?.id) {
    throw new Error(
      `No auth user for ${email}. Set PYTHH_REVIEWER_USER_ID or fix DATABASE_URL (current host is unusable).`,
    );
  }
  return hit.id;
}

function daysAfter(eventAt, matchAt) {
  const a = new Date(eventAt).getTime();
  const b = new Date(matchAt).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= b) return null;
  return Math.round(((a - b) / 86400000) * 10) / 10;
}

router.get('/match-outcomes/proof', async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('match_validation_evidence')
      .select(
        `
        id, evidence_type, event_at, source_provider, source_url, verified_at, verified,
        startup_id, investor_id, match_id,
        startup_uploads!inner(name),
        investors!inner(name, firm),
        startup_investor_matches!inner(created_at, match_score, startup_id, investor_id)
      `,
      )
      .eq('verified', true)
      .order('event_at', { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const mapped = (data || [])
      .map((row) => {
        const match = row.startup_investor_matches;
        const matchAt = match?.created_at;
        const days = daysAfter(row.event_at, matchAt);
        if (days == null) return null;
        if (match?.startup_id && row.startup_id && match.startup_id !== row.startup_id) return null;
        if (match?.investor_id && row.investor_id && match.investor_id !== row.investor_id) return null;
        return {
          id: row.id,
          startup: row.startup_uploads?.name,
          investor: row.investors?.name || row.investors?.firm,
          evidence_type: row.evidence_type,
          event_at: row.event_at,
          match_at: matchAt,
          days_after_match: days,
          match_score: match?.match_score ?? null,
          source_provider: row.source_provider,
          source_url: row.source_url,
          verified_at: row.verified_at,
          source_tier: sourceTier(row.source_url),
        };
      })
      .filter(Boolean);

    const byMonth = {};
    for (const p of mapped) {
      const key = new Date(p.event_at).toISOString().slice(0, 7);
      byMonth[key] = (byMonth[key] || 0) + 1;
    }
    const timeline = Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month, count }));

    const [pendingQ, queuePendingQ, queueCompleteQ] = await Promise.all([
      supabase
        .from('match_validation_evidence')
        .select('id', { count: 'exact', head: true })
        .eq('review_status', 'pending'),
      supabase
        .from('funding_evidence_search_queue')
        .select('startup_id', { count: 'exact', head: true })
        .eq('status', 'pending'),
      supabase
        .from('funding_evidence_search_queue')
        .select('startup_id', { count: 'exact', head: true })
        .eq('status', 'complete'),
    ]);

    res.json({
      summary: {
        verified_pairs: mapped.length,
        pending_review: pendingQ.count || 0,
        search_queue_pending: queuePendingQ.count || 0,
        search_queue_complete: queueCompleteQ.count || 0,
      },
      timeline,
      verified_pairs: mapped,
    });
  } catch (e) {
    console.error('[match-outcomes/proof]', e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/match-outcomes/pending', async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const tierFilter = String(req.query.tier || 'all');

    const { data, error } = await supabase
      .from('match_validation_evidence')
      .select(
        `
        id, evidence_type, event_at, source_provider, source_url, review_status,
        startup_id, investor_id, match_id,
        startup_uploads!inner(name),
        investors!inner(name, firm),
        startup_investor_matches!inner(created_at, match_score)
      `,
      )
      .eq('review_status', 'pending')
      .order('event_at', { ascending: false })
      .limit(Math.min(limit * 3, 200));
    if (error) throw new Error(error.message);

    const mapped = (data || [])
      .map((row) => {
        const matchAt = row.startup_investor_matches?.created_at;
        const days = daysAfter(row.event_at, matchAt);
        if (days == null) return null;
        return {
          id: row.id,
          startup: row.startup_uploads?.name,
          investor: row.investors?.name || row.investors?.firm,
          evidence_type: row.evidence_type,
          event_at: row.event_at,
          match_at: matchAt,
          days_after_match: days,
          match_score: row.startup_investor_matches?.match_score ?? null,
          source_provider: row.source_provider,
          source_url: row.source_url,
          review_status: row.review_status,
          source_tier: sourceTier(row.source_url),
          issuer_primary: isIssuerPrimary(row.source_url),
        };
      })
      .filter(Boolean)
      .filter((row) => (tierFilter === 'all' ? true : row.source_tier === tierFilter))
      .slice(0, limit);

    res.json({
      pending: mapped.length,
      high_tier: mapped.filter((r) => r.source_tier === 'high').length,
      rows: mapped,
    });
  } catch (e) {
    console.error('[match-outcomes/pending]', e);
    res.status(500).json({ error: e.message });
  }
});

router.post('/match-outcomes/review', async (req, res) => {
  try {
    const { evidenceId, decision, note, force } = req.body || {};
    if (!evidenceId || !['verified', 'rejected'].includes(decision)) {
      return res.status(400).json({ error: 'evidenceId and decision (verified|rejected) required' });
    }
    const supabase = getSupabaseClient();
    const reviewer = await resolveReviewerId(req);

    if (decision === 'verified' && force !== true) {
      const { data: row } = await supabase
        .from('match_validation_evidence')
        .select('source_url')
        .eq('id', evidenceId)
        .maybeSingle();
      if (row && !isIssuerPrimary(row.source_url)) {
        return res.status(400).json({
          error:
            'Source is not issuer-primary (Business Wire / PR Newswire / GlobeNewswire / company blog). Pass force:true to override.',
          source_tier: sourceTier(row.source_url),
        });
      }
    }

    const { data, error } = await supabase.rpc('review_match_validation_evidence', {
      p_evidence_id: evidenceId,
      p_decision: decision,
      p_reviewer: reviewer,
      p_note: note || null,
    });
    if (error) throw error;

    if (data?.startup_id) {
      await supabase.rpc('refresh_startup_match_outcome_classifications', {
        p_startup_id: data.startup_id,
      });
    }

    res.json({
      ok: true,
      decision,
      evidenceId,
      verified: data?.verified === true,
      startup_id: data?.startup_id,
      investor_id: data?.investor_id,
    });
  } catch (e) {
    console.error('[match-outcomes/review]', e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/match-outcomes/queue', async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    const statuses = ['pending', 'processing', 'complete', 'error'];
    const by_status = [];
    for (const status of statuses) {
      const [{ count: n }, { count: withHits }] = await Promise.all([
        supabase
          .from('funding_evidence_search_queue')
          .select('startup_id', { count: 'exact', head: true })
          .eq('status', status),
        supabase
          .from('funding_evidence_search_queue')
          .select('startup_id', { count: 'exact', head: true })
          .eq('status', status)
          .gt('result_count', 0),
      ]);
      if ((n || 0) > 0) {
        by_status.push({ status, n: n || 0, with_hits: withHits || 0 });
      }
    }
    res.json({ by_status });
  } catch (e) {
    console.error('[match-outcomes/queue]', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
