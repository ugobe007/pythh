/**
 * Admin API: match outcome proof loop
 * GET  /match-outcomes/proof
 * GET  /match-outcomes/pending
 * POST /match-outcomes/review
 * GET  /match-outcomes/queue
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

function getPool() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL required');
  return new pg.Pool({
    connectionString: massageConnectionString(process.env.DATABASE_URL),
    max: 1,
  });
}

async function resolveReviewerId(req) {
  if (process.env.PYTHH_REVIEWER_USER_ID) return process.env.PYTHH_REVIEWER_USER_ID;
  const email =
    req.headers['x-user-email'] ||
    process.env.OWNER_EMAILS?.split(',')[0]?.trim() ||
    'ugobe07@gmail.com';
  const pool = getPool();
  try {
    const { rows } = await pool.query('SELECT id FROM auth.users WHERE email = $1 LIMIT 1', [
      String(email).toLowerCase(),
    ]);
    if (!rows[0]?.id) throw new Error(`No auth.users row for ${email}`);
    return rows[0].id;
  } finally {
    await pool.end();
  }
}

router.get('/match-outcomes/proof', async (req, res) => {
  const pool = getPool();
  try {
    const { rows: pairs } = await pool.query(`
      SELECT e.id, su.name AS startup, COALESCE(i.name, i.firm) AS investor,
             e.evidence_type, e.event_at, m.created_at AS match_at,
             round(extract(epoch FROM (e.event_at - m.created_at)) / 86400.0, 1) AS days_after_match,
             m.match_score, e.source_provider, e.source_url, e.verified_at
      FROM match_validation_evidence e
      JOIN startup_investor_matches m ON m.id = e.match_id
      JOIN startup_uploads su ON su.id = e.startup_id
      JOIN investors i ON i.id = e.investor_id
      WHERE e.verified
        AND e.startup_id = m.startup_id
        AND e.investor_id = m.investor_id
        AND e.event_at > m.created_at
      ORDER BY e.event_at DESC
      LIMIT 200
    `);

    const mapped = pairs.map((row) => ({
      ...row,
      source_tier: sourceTier(row.source_url),
    }));

    const byMonth = {};
    for (const p of mapped) {
      const key = new Date(p.event_at).toISOString().slice(0, 7);
      byMonth[key] = (byMonth[key] || 0) + 1;
    }
    const timeline = Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month, count }));

    const { rows: counts } = await pool.query(`
      SELECT
        (SELECT count(*)::int FROM match_validation_evidence WHERE review_status = 'pending') AS pending_review,
        (SELECT count(*)::int FROM funding_evidence_search_queue WHERE status = 'pending') AS search_queue_pending,
        (SELECT count(*)::int FROM funding_evidence_search_queue WHERE status = 'complete') AS search_queue_complete
    `);

    res.json({
      summary: {
        verified_pairs: mapped.length,
        pending_review: counts[0]?.pending_review || 0,
        search_queue_pending: counts[0]?.search_queue_pending || 0,
        search_queue_complete: counts[0]?.search_queue_complete || 0,
      },
      timeline,
      verified_pairs: mapped,
    });
  } catch (e) {
    console.error('[match-outcomes/proof]', e);
    res.status(500).json({ error: e.message });
  } finally {
    await pool.end();
  }
});

router.get('/match-outcomes/pending', async (req, res) => {
  const pool = getPool();
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const tierFilter = String(req.query.tier || 'all');
    const { rows } = await pool.query(
      `
      SELECT e.id, su.name AS startup, COALESCE(i.name, i.firm) AS investor,
             e.evidence_type, e.event_at, m.created_at AS match_at,
             round(extract(epoch FROM (e.event_at - m.created_at)) / 86400.0, 1) AS days_after_match,
             m.match_score, e.source_provider, e.source_url, e.review_status
      FROM match_validation_evidence e
      JOIN startup_investor_matches m ON m.id = e.match_id
      JOIN startup_uploads su ON su.id = e.startup_id
      JOIN investors i ON i.id = e.investor_id
      WHERE e.review_status = 'pending'
        AND e.event_at > m.created_at
      ORDER BY e.event_at DESC
      LIMIT $1
    `,
      [limit],
    );

    const mapped = rows
      .map((row) => ({
        ...row,
        source_tier: sourceTier(row.source_url),
        issuer_primary: isIssuerPrimary(row.source_url),
      }))
      .filter((row) => (tierFilter === 'all' ? true : row.source_tier === tierFilter));

    res.json({
      pending: mapped.length,
      high_tier: mapped.filter((r) => r.source_tier === 'high').length,
      rows: mapped,
    });
  } catch (e) {
    console.error('[match-outcomes/pending]', e);
    res.status(500).json({ error: e.message });
  } finally {
    await pool.end();
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
  const pool = getPool();
  try {
    const { rows } = await pool.query(`
      SELECT status, count(*)::int AS n,
             count(*) FILTER (WHERE result_count > 0)::int AS with_hits
      FROM funding_evidence_search_queue
      GROUP BY status
      ORDER BY status
    `);
    res.json({ by_status: rows });
  } catch (e) {
    console.error('[match-outcomes/queue]', e);
    res.status(500).json({ error: e.message });
  } finally {
    await pool.end();
  }
});

module.exports = router;
