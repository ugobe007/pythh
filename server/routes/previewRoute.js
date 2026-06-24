/**
 * /api/preview/:startupId
 * ═══════════════════════════════════════════════════════════════
 * Public, no-auth endpoint for the shareable match preview page.
 * Returns startup info + top investor matches (unique firm; up to 10 for preview UI).
 * Serves startups that are visible to the product (approved, pending, etc.).
 * Rejected rows are excluded so share links cannot revive spam.
 * ═══════════════════════════════════════════════════════════════
 */

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);

const { dedupeInvestorMatchesByFirm } = require('../../lib/dedupeInvestorMatchesByFirm');
const { logPreviewLoaded, recordFunnelEvent } = require('../lib/funnelTelemetry');
const { getPreviewMatchDelta } = require('../lib/previewMatchDelta');

const EMAIL_FROM = process.env.EMAIL_FROM || 'Pythh <notifications@pythh.ai>';

/** Fly/env typos sometimes prefix APP_BASE_URL with '=' — strip and fall back safely. */
function normalizeAppBase(raw) {
  const cleaned = String(raw || process.env.SITE_URL || 'https://pythh.ai')
    .trim()
    .replace(/^=+/, '');
  if (!/^https?:\/\//i.test(cleaned)) return 'https://pythh.ai';
  return cleaned.replace(/\/$/, '');
}

const APP_BASE = normalizeAppBase(process.env.APP_BASE_URL);

async function sendPreviewShortlistEmail({ to, startupName, previewUrl, topInvestors, matchCount }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { success: false, error: 'RESEND_API_KEY not configured' };

  const lines = (topInvestors || [])
    .slice(0, 3)
    .map((inv, i) => {
      const label = inv.firm ? `${inv.name} · ${inv.firm}` : inv.name;
      return `${i + 1}. ${label}`;
    })
    .join('\n');

  const subject = `Your investor shortlist for ${startupName}`;
  const text = [
    `Hi —`,
    ``,
    `You asked for your Pythh investor shortlist for ${startupName}.`,
    matchCount ? `${matchCount.toLocaleString()} ranked matches are ready in your network.` : '',
    ``,
    lines ? `Top matches:\n${lines}` : '',
    ``,
    `View your full preview: ${previewUrl}`,
    ``,
    `Request intros or save your list with a free account when you're ready.`,
    ``,
    `— Pythh`,
  ]
    .filter(Boolean)
    .join('\n');

  const html = `
    <div style="font-family: Inter, Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #111; max-width: 560px;">
      <p>You asked for your investor shortlist for <strong>${startupName}</strong>.</p>
      ${matchCount ? `<p>${matchCount.toLocaleString()} ranked matches are ready in the Pythh network.</p>` : ''}
      ${lines ? `<pre style="background:#f4f4f5;padding:12px;border-radius:8px;font-size:13px;white-space:pre-wrap;">${lines.replace(/</g, '&lt;')}</pre>` : ''}
      <p><a href="${previewUrl}" style="display:inline-block;background:#16a34a;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;">View my shortlist</a></p>
      <p style="color:#666;font-size:13px;">Request intros or save your list with a free account when you're ready.</p>
    </div>`;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, html, text }),
    });
    const data = await response.json();
    if (!response.ok) return { success: false, error: data.message || 'Resend error' };
    return { success: true, id: data.id };
  } catch (err) {
    return { success: false, error: err.message || 'send failed' };
  }
}

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// POST /api/preview/email-shortlist — capture email + send shortlist link (no account required)
router.post('/email-shortlist', async (req, res) => {
  try {
    const {
      email,
      startup_id: startupId,
      startup_url: startupUrl,
      startup_name: startupName,
      match_count: matchCount,
      top_investors: topInvestors,
      source,
    } = req.body || {};

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'invalid_email', message: 'Valid email required' });
    }
    if (!startupId) {
      return res.status(400).json({ error: 'startup_id_required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recent } = await supabase
      .from('preview_lead_captures')
      .select('id, resend_message_id')
      .eq('email', normalizedEmail)
      .eq('startup_id', startupId)
      .gte('created_at', since)
      .limit(1);

    if (recent?.[0]?.resend_message_id) {
      return res.json({ success: true, deduped: true, message_id: recent[0].resend_message_id });
    }

    const previewPath = `/matches/preview/${startupId}`;
    const previewUrl = `${APP_BASE}${previewPath}`;
    const sendResult = await sendPreviewShortlistEmail({
      to: normalizedEmail,
      startupName: startupName || 'your startup',
      previewUrl,
      topInvestors: Array.isArray(topInvestors) ? topInvestors : [],
      matchCount: Number(matchCount) || 0,
    });

    const row = {
      email: normalizedEmail,
      startup_id: startupId,
      startup_url: startupUrl || null,
      startup_name: startupName || null,
      top_investors: Array.isArray(topInvestors) ? topInvestors.slice(0, 5) : [],
      match_count: Number(matchCount) || null,
      source: source || 'instant_preview',
      resend_message_id: sendResult.id || null,
      email_sent_at: sendResult.success ? new Date().toISOString() : null,
    };

    const { error: insertErr } = await supabase.from('preview_lead_captures').insert(row);
    if (insertErr) {
      console.warn('[preview/email-shortlist] insert failed:', insertErr.message);
    }

    await recordFunnelEvent(supabase, 'preview_email_captured', {
      startup_id: startupId,
      startup_url: startupUrl,
      source: source || 'instant_preview',
      email_sent: sendResult.success,
    });

    if (!sendResult.success) {
      return res.status(502).json({
        error: 'email_send_failed',
        message: sendResult.error || 'Could not send email — try again shortly',
        captured: !insertErr,
      });
    }

    return res.json({ success: true, message_id: sendResult.id, preview_url: previewUrl });
  } catch (err) {
    console.error('[preview/email-shortlist]', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

/**
 * When startup_investor_matches has no rows yet (pipeline still running, or failed),
 * return top sector investors via get_lookup_top_investors so /submit and share links are not empty.
 */
async function buildSuggestedInvestorMatches(startup) {
  const fromList = (arr) =>
    (Array.isArray(arr) ? arr : [])
      .map((s) => String(s).trim())
      .filter((s) => s.length > 0);
  const sectorQueue = fromList(startup.sectors);
  for (const extra of ['Technology', 'SaaS', 'FinTech', 'AI', 'Healthcare', 'B2B']) {
    if (!sectorQueue.includes(extra)) sectorQueue.push(extra);
  }
  const tried = new Set();
  for (const sec of sectorQueue) {
    const k = sec.toLowerCase();
    if (tried.has(k)) continue;
    tried.add(k);
    const { data, error } = await supabase.rpc('get_lookup_top_investors', {
      p_sector: sec,
      p_limit: 10,
    });
    if (error) {
      console.warn('[preview] suggested-investor RPC:', error.message || error);
      continue;
    }
    if (data && data.length > 0) {
      return data.map((inv) => {
        const base = Number(inv.investor_score);
        const match_score = Math.min(100, Math.max(20, (Number.isFinite(base) ? base : 50) + 5));
        return {
          investor_id: inv.id,
          match_score,
          why_you_match:
            'Top investors in this sector (suggested for preview). Your personalized matches appear once scoring finishes.',
          investor: {
            id: inv.id,
            name: inv.name,
            firm: inv.firm,
            title: null,
            sectors: inv.sectors,
            stage: inv.stage,
            check_size_min: null,
            check_size_max: null,
            investor_tier: null,
            twitter_url: null,
            linkedin_url: inv.linkedin_url || null,
            photo_url: null,
          },
        };
      });
    }
  }
  const { data: topPace, error: paceErr } = await supabase
    .from('investors')
    .select(
      'id, name, firm, title, sectors, stage, check_size_min, check_size_max, investor_tier, investor_score, twitter_url, linkedin_url, photo_url'
    )
    .order('investment_pace_per_year', { ascending: false, nullsFirst: false })
    .limit(8);
  if (paceErr) {
    console.warn('[preview] suggested-investor pace fallback:', paceErr.message);
    return [];
  }
  return (topPace || []).map((inv) => ({
    investor_id: inv.id,
    match_score: Math.min(100, Math.max(25, Math.round(Number(inv.investor_score) || 40))),
    why_you_match:
      'Actively deploying investors (suggested for preview) while we compute your custom fit scores.',
    investor: {
      id: inv.id,
      name: inv.name,
      firm: inv.firm,
      title: inv.title,
      sectors: inv.sectors,
      stage: inv.stage,
      check_size_min: inv.check_size_min,
      check_size_max: inv.check_size_max,
      investor_tier: inv.investor_tier,
      twitter_url: inv.twitter_url,
      linkedin_url: inv.linkedin_url,
      photo_url: inv.photo_url,
    },
  }));
}

/** Narrative for UI when top-level columns are empty but inference JSON has text */
function effectiveStartupDescription(row) {
  const ex = row.extracted_data && typeof row.extracted_data === 'object' ? row.extracted_data : {};
  return (
    row.description ||
    row.pitch ||
    ex.description ||
    ex.product_description ||
    ex.value_proposition ||
    (typeof ex.pitch === 'string' ? ex.pitch : null) ||
    null
  );
}

// GET /api/preview/:startupId/investor/:investorId — oracle match copy for deep links (must be before /:startupId)
router.get('/:startupId/investor/:investorId', async (req, res) => {
  const { startupId, investorId } = req.params;
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(startupId) || !uuidRe.test(investorId)) {
    return res.status(400).json({ error: 'Invalid id' });
  }

  try {
    const { data: startup, error: sErr } = await supabase
      .from('startup_uploads')
      .select('id, status')
      .eq('id', startupId)
      .maybeSingle();

    if (sErr || !startup) {
      return res.status(404).json({ error: 'Startup not found' });
    }
    if (String(startup.status || '').toLowerCase() === 'rejected') {
      return res.status(404).json({ error: 'Startup not found' });
    }

    const { data: row, error: mErr } = await supabase
      .from('startup_investor_matches')
      .select('match_score, why_you_match, reasoning, fit_analysis')
      .eq('startup_id', startupId)
      .eq('investor_id', investorId)
      .maybeSingle();

    if (mErr || !row) {
      return res.status(404).json({ error: 'Match not found' });
    }

    return res.json({
      match_score: row.match_score,
      why_you_match: row.why_you_match,
      reasoning: row.reasoning,
      fit_analysis: row.fit_analysis ?? null,
    });
  } catch (err) {
    console.error('[preview] investor match error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/preview/:startupId
router.get('/:startupId', async (req, res) => {
  const { startupId } = req.params;

  // Validate UUID format
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(startupId)) {
    return res.status(400).json({ error: 'Invalid startup ID' });
  }

  try {
    // 1. Fetch startup by id — filter rejected in JS so NULL / pending / approved all work
    //    (PostgREST .neq() excludes NULL rows, which made /api/preview 404 for many inserts.)
    const { data: startup, error: sErr } = await supabase
      .from('startup_uploads')
      .select('id, name, tagline, description, pitch, website, sectors, stage, status, extracted_data, total_god_score, team_score, traction_score, market_score, product_score, vision_score')
      .eq('id', startupId)
      .maybeSingle();

    if (sErr || !startup) {
      return res.status(404).json({ error: 'Startup not found' });
    }
    if (String(startup.status || '').toLowerCase() === 'rejected') {
      return res.status(404).json({ error: 'Startup not found' });
    }

    // 1b. Fetch signal scores
    const { data: signalData } = await supabase
      .from('startup_signal_scores')
      .select('signals_total, founder_language_shift, investor_receptivity, news_momentum, capital_convergence, execution_velocity')
      .eq('startup_id', startupId)
      .maybeSingle();

    // 2. Fetch total match count
    const { count: totalMatches } = await supabase
      .from('startup_investor_matches')
      .select('*', { count: 'exact', head: true })
      .eq('startup_id', startupId);

    // 3. Fetch a wide slice, then dedupe by VC firm (one partner per firm), keep top 10 for preview UI
    const { data: matchRows, error: mErr } = await supabase
      .from('startup_investor_matches')
      .select(`
        investor_id,
        match_score,
        why_you_match,
        investors (
          id,
          name,
          firm,
          title,
          sectors,
          stage,
          check_size_min,
          check_size_max,
          investor_tier,
          twitter_url,
          linkedin_url,
          photo_url
        )
      `)
      .eq('startup_id', startupId)
      .order('match_score', { ascending: false })
      .limit(120);

    if (mErr) {
      console.error('[preview] match fetch error:', mErr);
      return res.status(500).json({ error: 'Failed to load matches' });
    }

    // 4. Compute percentile rank among all approved startups
    const { count: higherCount } = await supabase
      .from('startup_uploads')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved')
      .gt('total_god_score', startup.total_god_score || 0);

    const { count: approvedTotal } = await supabase
      .from('startup_uploads')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved');

    const percentile = approvedTotal
      ? Math.round(100 - ((higherCount / approvedTotal) * 100))
      : 50;

    const mapped = (matchRows || [])
      .map((row) => {
        const raw = row.investors;
        const investor = Array.isArray(raw) ? raw[0] : raw;
        return {
          investor_id: row.investor_id,
          match_score: row.match_score,
          why_you_match: row.why_you_match,
          investor,
        };
      })
      .filter((m) => m.investor && (m.investor.id || m.investor_id));

    let matches = dedupeInvestorMatchesByFirm(mapped, 10);
    let suggestedInvestorFallback = false;
    if (matches.length === 0) {
      const suggested = await buildSuggestedInvestorMatches(startup);
      matches = dedupeInvestorMatchesByFirm(suggested, 5);
      if (matches.length > 0) suggestedInvestorFallback = true;
    }

    const descriptionForUi = effectiveStartupDescription(startup);

    void logPreviewLoaded(supabase, {
      startupId,
      source: req.query.source || 'preview_api',
      probeRunId: req.query.probe_run_id || req.headers['x-probe-run-id'] || null,
      matchCount: matches.length,
    });

    const topInvestorIds = matches
      .map((m) => m.investor_id || m.investor?.id)
      .filter(Boolean);
    const matchMovement = await getPreviewMatchDelta(supabase, startupId, {
      totalMatches: totalMatches || 0,
      topInvestorIds,
    });

    res.json({
      startup: {
        id: startup.id,
        name: startup.name,
        tagline: startup.tagline,
        description: descriptionForUi,
        extracted_data: startup.extracted_data || null,
        website: startup.website,
        sectors: startup.sectors,
        stage: startup.stage,
        god_score: startup.total_god_score,
        score_components: {
          team: startup.team_score,
          traction: startup.traction_score,
          market: startup.market_score,
          product: startup.product_score,
          vision: startup.vision_score,
        },
        signal_score: signalData?.signals_total || 0,
        signal_components: signalData ? {
          founder_language_shift: signalData.founder_language_shift || 0,
          investor_receptivity: signalData.investor_receptivity || 0,
          news_momentum: signalData.news_momentum || 0,
          capital_convergence: signalData.capital_convergence || 0,
          execution_velocity: signalData.execution_velocity || 0,
        } : null,
        percentile,
      },
      total_matches: totalMatches || 0,
      matches,
      match_movement: matchMovement,
      suggested_investor_fallback: suggestedInvestorFallback,
    });

  } catch (err) {
    console.error('[preview] unexpected error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
