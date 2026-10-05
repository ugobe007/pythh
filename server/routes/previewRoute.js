/**
 * /api/preview/:startupId
 * ═══════════════════════════════════════════════════════════════
 * Public, no-auth endpoint for the shareable match preview page.
 * Returns startup info + top investor matches (unique firm; up to 10 for preview UI).
 * Match rows are shaped via lib/canonicalMatchApi.js (string why_you_match, stable investor fields).
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

const {
  shapeMatchForApi,
  buildPreviewMatchList,
  resolvePreviewMixOptions,
  summarizeShortlistMix,
} = require('../../lib/canonicalMatchApi');
const { logPreviewLoaded, recordFunnelEvent } = require('../lib/funnelTelemetry');
const { getPreviewMatchDelta } = require('../lib/previewMatchDelta');
const { buildPreviewOracleGap } = require('../lib/previewOracleGap');
const { buildFreeDeckFocus } = require('../../lib/deckOutline');
const {
  applyCampaignRank,
  campaignBriefFromStartup,
  campaignIsActionable,
  overlayCampaignQuery,
  prioritySearchTerms,
} = require('../../lib/campaignBrief');
const { getPreviewOracleProof } = require('../lib/previewOracleProof');
const { sendFounderActivationNudge, sendFounderSignupInvite } = require('../lib/founderActivationEmail');
const {
  resolveTransactionalFrom,
  resolveTransactionalReplyTo,
} = require('../lib/transactionalEmailFrom');
const { distinctiveFitScore, sectorsForMatching, hasSpecificSector, blendStoredWithSectorSuggestions } = require('../../lib/distinctiveInvestorFit');
const { signalTotalFromGod } = require('../../lib/signalScoreGodBlend');
const {
  scoreStartupMatches,
  uploadRowToPlaceholderStartup,
} = require('./instantSubmit');
const { applyResearchRank } = require('../../lib/matchModelFromResearch');
const { expandRelatedSectors, normalizeSectors } = require('../lib/sectorTaxonomy');
const { buildFounderShortlistBrief } = require('../../lib/founderShortlistBrief');
const { previewHost, hostOf, buildPeers, MIN_AMOUNT_USD, MAX_AMOUNT_USD } = require('../../lib/previewPeers');
const { cardFactsFromRows, applyCardFacts } = require('../../lib/investorCardFacts');

/** Deliverable From — pythh.ai SPF/send records currently fail Gmail. */
const MATCHES_EMAIL_FROM = resolveTransactionalFrom(process.env.MATCHES_EMAIL_FROM);
const MATCHES_EMAIL_REPLY_TO = resolveTransactionalReplyTo('brief@pythh.ai');

/** Fly/env typos sometimes prefix APP_BASE_URL with '=' — strip and fall back safely. */
function normalizeAppBase(raw) {
  const cleaned = String(raw || process.env.SITE_URL || 'https://pythh.ai')
    .trim()
    .replace(/^=+/, '');
  if (!/^https?:\/\//i.test(cleaned)) return 'https://pythh.ai';
  return cleaned.replace(/\/$/, '');
}

const APP_BASE = normalizeAppBase(process.env.APP_BASE_URL);

function inspectMatchesUrl(startupUrl, fallbackUrl) {
  const raw = String(startupUrl || '').trim();
  if (!raw) return fallbackUrl;
  const normalized = raw.startsWith('http') ? raw : `https://${raw}`;
  return `${APP_BASE}/matches?url=${encodeURIComponent(normalized)}`;
}

const CARD_FACT_COLUMNS = 'id, name, firm, title, url, blog_url, partners, notable_investments, portfolio_companies, sectors, stage, focus_areas, last_investment_date, is_individual, entity_gate, status';

/** Firm website, partners, sectors, and example deals for the cards on this shortlist. */
async function attachInvestorCardFacts(matches) {
  const list = Array.isArray(matches) ? matches : [];
  const ids = [...new Set(list.map((match) => match.investor_id || match.investor?.id).filter(Boolean))];
  if (!ids.length) return list;
  try {
    const { data: selves, error } = await supabase
      .from('investors')
      .select(CARD_FACT_COLUMNS)
      .in('id', ids);
    if (error) {
      console.warn('[preview] card facts:', error.message || error);
      return list;
    }
    const firms = [...new Set(list.map((match) => String(match.investor?.firm || '').trim()).filter(Boolean))];
    let mates = [];
    if (firms.length) {
      const [{ data: people, error: mateError }, { data: firmsRows, error: firmError }] = await Promise.all([
        supabase.from('investors').select(CARD_FACT_COLUMNS).in('firm', firms).eq('entity_gate', 'qualified').limit(120),
        supabase.from('investors').select(CARD_FACT_COLUMNS).in('name', firms).eq('entity_gate', 'qualified').limit(40),
      ]);
      if (mateError) console.warn('[preview] card partners:', mateError.message || mateError);
      if (firmError) console.warn('[preview] card firms:', firmError.message || firmError);
      const seen = new Set();
      mates = [...(firmsRows || []), ...(people || [])].filter((row) => {
        const id = String(row?.id || '');
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      });
    }
    const byId = new Map((selves || []).map((row) => [String(row.id), row]));
    return list.map((match) => {
      const id = String(match.investor_id || match.investor?.id || '');
      const self = byId.get(id) || match.investor || {};
      return applyCardFacts(match, cardFactsFromRows(self, mates));
    });
  } catch (err) {
    console.warn('[preview] card facts failed:', err?.message || err);
    return list;
  }
}

/** Same mix as the preview page, so the email names the shortlist the founder sees. */
async function loadEmailShortlist(startup) {
  const { data: matchRows, error } = await supabase
    .from('startup_investor_matches')
    .select(`
      investor_id,
      match_score,
      why_you_match,
      created_at,
      investors (
        id, name, firm, title, type, is_individual, capital_type, sectors, stage
      )
    `)
    .eq('startup_id', startup.id)
    .order('match_score', { ascending: false })
    .limit(80);
  if (error || !matchRows?.length) return [];
  return buildPreviewMatchList(matchRows, resolvePreviewMixOptions(startup, null, 8)).slice(0, 8);
}

async function sendPreviewShortlistEmail({
  to,
  startupName,
  previewUrl,
  inspectUrl,
  topInvestors,
  matchCount,
  oracleGap,
  startupId,
  brief,
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { success: false, error: 'RESEND_API_KEY not configured' };

  const listed = (topInvestors || [])
    .map((inv) => ({
      name: String(inv?.name || '').trim(),
      firm: inv?.firm ? String(inv.firm).trim() : '',
    }))
    .filter((inv) => inv.name)
    .slice(0, 5);
  const lines = listed
    .map((inv, i) => {
      const label = inv.firm && inv.firm !== inv.name ? `${inv.name} · ${inv.firm}` : inv.name;
      return `${i + 1}. ${label}`;
    })
    .join('\n');
  const listUrl = inspectUrl || previewUrl;
  const profileUrl = `${APP_BASE}/account`;

  const gap = oracleGap || null;
  const godLine =
    gap?.current_god_score != null
      ? `Oracle read: GOD ${gap.current_god_score}${
          gap.top_gap
            ? ` — fixing your top ${gap.weakest_component_label || 'signal'} gap (+${gap.god_points_if_top_fix} pts) could unlock ~${gap.investors_unlocked_if_top_fix} more thesis-fit investors.`
            : ' — strong profile. Next step: personalized outreach for your top matches.'
        }`
      : '';

  const subject = brief?.subject
    || (listed.length
      ? `${startupName} — ${listed.length} investor matches from Pythh`
      : `${startupName} — investor matches from Pythh`);
  const text = brief?.text || [
    `Hi —`,
    ``,
    `Here are your top ${listed.length} Pythh investor matches for ${startupName}.`,
    lines ? `\n${lines}\n` : '',
    `Open your profile: ${profileUrl}`,
    `Open these matches: ${listUrl}`,
    matchCount && matchCount > listed.length
      ? `${matchCount.toLocaleString()} ranked matches are on your account.`
      : '',
    godLine,
    ``,
    `Sent from hello@orbital-ai.io so Gmail will keep it.`,
    `— Pythh`,
  ]
    .filter(Boolean)
    .join('\n');

  const gapHtml =
    gap?.top_gap
      ? `<div style="margin:16px 0;padding:14px;border-radius:8px;background:#f4f4f5;border:1px solid #ddd;">
      <p style="margin:0 0 8px;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#6b21a8;">Oracle read</p>
      <p style="margin:0 0 6px;font-size:15px;color:#111;"><strong>GOD ${gap.current_god_score}</strong> → <strong>${gap.projected_god_if_top_fix ?? gap.projected_god_score}</strong> if you close the top gap</p>
      <p style="margin:0 0 8px;font-size:13px;color:#444;">${String(gap.top_gap.title || '').replace(/</g, '&lt;')} · ~${gap.investors_unlocked_if_top_fix} investors unlocked</p>
    </div>`
      : gap?.current_god_score != null
        ? `<p style="color:#666;">Oracle GOD score: <strong>${gap.current_god_score}</strong></p>`
        : '';

  const rows = listed
    .map((inv, i) => {
      const label = inv.firm && inv.firm !== inv.name ? `${inv.name} · ${inv.firm}` : inv.name;
      return `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-size:15px;color:#111;">${i + 1}. ${label.replace(/</g, '&lt;')}</td></tr>`;
    })
    .join('');

  const html = brief?.html || `
    <div style="font-family: Helvetica Neue, Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #111; max-width: 560px;">
      <p>Your top ${listed.length} investor matches for <strong>${String(startupName).replace(/</g, '&lt;')}</strong>:</p>
      ${rows ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>` : ''}
      <p style="margin-top:20px;"><a href="${profileUrl}" style="display:inline-block;background:#16a34a;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;">Open my profile</a></p>
      ${matchCount && matchCount > listed.length ? `<p style="color:#666;font-size:13px;">${matchCount.toLocaleString()} ranked matches are on your account.</p>` : ''}
      ${gapHtml}
      <p style="color:#888;font-size:12px;margin-top:24px;">Sent from hello@orbital-ai.io until pythh.ai mail authentication is fixed.</p>
    </div>`;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: MATCHES_EMAIL_FROM,
        to: [to],
        reply_to: [MATCHES_EMAIL_REPLY_TO],
        subject,
        html,
        text,
        headers: {
          'X-Entity-Ref-ID': `${startupId || 'matches'}-${Date.now()}`,
          'List-Unsubscribe': `<${APP_BASE}/account?saved=1>`,
        },
        tags: [
          { name: 'type', value: 'five_matches' },
          { name: 'startup', value: String(startupId || startupName || 'unknown').slice(0, 64) },
        ],
      }),
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

// GET /api/preview/oracle-proof — public Oracle fund proof snippet for preview UI
router.get('/oracle-proof', async (_req, res) => {
  try {
    const proof = await getPreviewOracleProof(supabase);
    res.set('Cache-Control', 'public, max-age=120, stale-while-revalidate=300');
    return res.json({ proof });
  } catch (err) {
    console.error('[preview/oracle-proof]', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

// POST /api/preview/activation-nudge — day-0 founder activation email after /activate
router.post('/activation-nudge', async (req, res) => {
  try {
    const { email, startup_id: startupId, startup_name: startupName, source } = req.body || {};
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'invalid_email' });
    }
    if (!startupId) {
      return res.status(400).json({ error: 'startup_id_required' });
    }

    const result = await sendFounderActivationNudge(supabase, {
      email,
      startupId,
      startupName,
      source: source || 'activate_scan_complete',
    });

    if (!result.success && !result.deduped) {
      return res.status(result.error === 'startup_not_found' ? 404 : 502).json(result);
    }

    return res.json(result);
  } catch (err) {
    console.error('[preview/activation-nudge]', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

// POST /api/preview/signup-invite — welcome email when account created without startup scan
router.post('/signup-invite', async (req, res) => {
  try {
    const { email, source } = req.body || {};
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'invalid_email' });
    }

    const result = await sendFounderSignupInvite(supabase, {
      email,
      source: source || 'founder_signup_page',
    });

    if (!result.success && !result.deduped) {
      return res.status(502).json(result);
    }

    return res.json(result);
  } catch (err) {
    console.error('[preview/signup-invite]', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

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
      force,
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

    if (!force && recent?.[0]?.resend_message_id) {
      return res.json({ success: true, deduped: true, message_id: recent[0].resend_message_id });
    }

    const previewPath = `/matches/preview/${startupId}`;
    const previewUrl = `${APP_BASE}${previewPath}`;
    const inspectUrl = inspectMatchesUrl(startupUrl, `${APP_BASE}/account?saved=1`);

    let oracleGap = null;
    let resolvedStartupName = startupName;
    let resolvedTopInvestors = Array.isArray(topInvestors) ? topInvestors : [];
    let resolvedMatchCount = Number(matchCount) || 0;
    let emailMatches = [];
    let emailStartup = null;

    try {
      const { data: startupRow } = await supabase
        .from('startup_uploads')
        .select(
          'id, name, tagline, description, pitch, extracted_data, total_god_score, team_score, traction_score, market_score, product_score, vision_score, sectors, stage',
        )
        .eq('id', startupId)
        .maybeSingle();
      if (startupRow) {
        if (!resolvedStartupName) resolvedStartupName = startupRow.name;

        const shaped = await loadEmailShortlist(startupRow);
        emailStartup = startupRow;
        emailMatches = shaped;
        if (shaped.length) {
          resolvedTopInvestors = shaped.slice(0, 5).map((match) => ({
            name: match.investor?.name || match.investor?.firm || '',
            firm: match.investor?.firm || null,
          }));
        } else if (resolvedTopInvestors.length === 0) {
          const { data: matches } = await supabase
            .from('startup_investor_matches')
            .select('match_score, investors!inner(id, name, firm)')
            .eq('startup_id', startupId)
            .order('match_score', { ascending: false })
            .limit(5);

          if (matches?.length) {
            resolvedTopInvestors = matches.map((m) => ({
              name: m.investors?.name || '',
              firm: m.investors?.firm || null,
            }));
          }
        }
        
        // Get full match count (not just the slice length)
        if (resolvedMatchCount === 0) {
          const { count: totalMatches } = await supabase
            .from('startup_investor_matches')
            .select('*', { count: 'exact', head: true })
            .eq('startup_id', startupId);
          resolvedMatchCount = totalMatches || 0;
        }
        
        oracleGap = buildPreviewOracleGap(startupRow, resolvedMatchCount);
      }
    } catch (gapErr) {
      console.warn('[preview/email-shortlist] oracle gap:', gapErr.message);
    }

    let brief = null;
    if (emailStartup) {
      try {
        brief = buildFounderShortlistBrief({
          startupName: resolvedStartupName || emailStartup.name || 'your startup',
          tagline: emailStartup.tagline,
          description: effectiveStartupDescription(emailStartup),
          sectors: emailStartup.sectors,
          stage: emailStartup.stage,
          scoreComponents: {
            team: emailStartup.team_score,
            traction: emailStartup.traction_score,
            market: emailStartup.market_score,
            product: emailStartup.product_score,
            vision: emailStartup.vision_score,
          },
          matches: emailMatches,
          profileUrl: `${APP_BASE}/account`,
          matchesUrl: inspectUrl,
        });
      } catch (briefErr) {
        console.warn('[preview/email-shortlist] brief:', briefErr.message);
      }
    }

    const sendResult = await sendPreviewShortlistEmail({
      to: normalizedEmail,
      startupName: resolvedStartupName || 'your startup',
      previewUrl,
      inspectUrl,
      topInvestors: resolvedTopInvestors,
      matchCount: resolvedMatchCount,
      oracleGap,
      startupId,
      brief,
    });

    const row = {
      email: normalizedEmail,
      startup_id: startupId,
      startup_url: startupUrl || null,
      startup_name: resolvedStartupName || null,
      top_investors: resolvedTopInvestors.slice(0, 5),
      match_count: resolvedMatchCount || null,
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
      has_oracle_gap: Boolean(oracleGap?.top_gap),
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
 * Save sector specialists the stored shortlist was missing.
 * ignoreDuplicates keeps existing prediction clocks (created_at) untouched.
 */
async function persistSectorSuggestions(startupId, rows) {
  const inserts = (Array.isArray(rows) ? rows : [])
    .filter((row) => row?.investor_id)
    .slice(0, 15)
    .map((row) => ({
      startup_id: startupId,
      investor_id: row.investor_id,
      match_score: row.match_score,
      why_you_match: Array.isArray(row.why_you_match)
        ? row.why_you_match
        : [String(row.why_you_match || 'This investor focuses on the same sector as the startup.')],
      status: 'suggested',
      algorithm_version: 'v3.5-sector-blend',
      updated_at: new Date().toISOString(),
    }));
  if (!inserts.length) return;
  const { error } = await supabase
    .from('startup_investor_matches')
    .upsert(inserts, { onConflict: 'startup_id,investor_id', ignoreDuplicates: true });
  if (error) console.warn('[preview] sector blend persist:', error.message || error);
}

/**
 * When startup_investor_matches has no rows yet (pipeline still running, or failed),
 * return top sector investors via get_lookup_top_investors so /submit and share links are not empty.
 */
async function buildSuggestedInvestorMatches(startup, { maxSectors = 6 } = {}) {
  const sectors = sectorsForMatching(startup);
  if (!sectors.length) return [];
  const expanded = expandRelatedSectors(normalizeSectors(sectors));
  const sectorQueue = [...new Set([...sectors, ...expanded])].slice(0, maxSectors);
  const byId = new Map();
  for (const sec of sectorQueue) {
    const { data, error } = await supabase.rpc('get_lookup_top_investors', {
      p_sector: sec,
      p_limit: 40,
    });
    if (error) {
      console.warn('[preview] suggested-investor RPC:', error.message || error);
      continue;
    }
    for (const inv of data || []) {
      if (inv?.id && !byId.has(inv.id)) byId.set(inv.id, inv);
    }
  }
  const startupForFit = { ...startup, sectors };
  return [...byId.values()]
    .map((inv) => {
      const base = Number(inv.investor_score);
      const match_score = Math.min(100, Math.max(20, (Number.isFinite(base) ? base : 50) + 5));
      return {
        investor_id: inv.id,
        match_score,
        fit_rank: distinctiveFitScore(startupForFit, inv),
        why_you_match:
          'This investor focuses on the same sector as the startup.',
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
          investor_score: inv.investor_score,
          investment_thesis: inv.investment_thesis || null,
        },
      };
    })
    .sort((a, b) => b.fit_rank - a.fit_rank);
}

/**
 * Pull investors whose thesis names the raise priority into the pool.
 * Sector lookup alone kept the previous five on top.
 */
async function buildPriorityInvestorMatches(startup, priorities) {
  const terms = prioritySearchTerms(priorities).slice(0, 8);
  if (!terms.length) return [];
  const { data, error } = await supabase
    .from('investors')
    .select('id, name, firm, sectors, stage, investment_thesis, signals, linkedin_url, type, capital_type, is_individual, check_size_min, check_size_max')
    .or(terms.map((term) => `investment_thesis.ilike.%${term}%`).join(','))
    .limit(80);
  if (error) {
    console.warn('[preview] priority investors:', error.message || error);
    return [];
  }
  const startupForFit = { ...startup, sectors: sectorsForMatching(startup) };
  return (data || [])
    .filter((inv) => inv?.id)
    .map((inv) => ({
      investor_id: inv.id,
      match_score: 55,
      fit_rank: distinctiveFitScore(startupForFit, inv),
      why_you_match: 'This investor’s thesis matches what this round needs to do.',
      investor: inv,
    }));
}

/**
 * Load current investors and score them with calculateMatchScore.
 * Stored startup_investor_matches rows are only a fallback if the engine returns nothing.
 */
async function scorePreviewWithEngine(startup) {
  if (typeof scoreStartupMatches !== 'function' || typeof uploadRowToPlaceholderStartup !== 'function') {
    return [];
  }
  const placeholder = uploadRowToPlaceholderStartup(startup.id, startup);
  const scored = await scoreStartupMatches(supabase, {
    startupId: startup.id,
    placeholderStartup: placeholder,
    signalTotal: signalTotalFromGod(placeholder.total_god_score),
    maxMs: 8000,
    topN: 80,
  });
  return (scored?.matches || []).map((row) => {
    const joined = Array.isArray(row.investors) ? row.investors[0] : row.investors;
    return {
      ...row,
      investor_id: row.investor_id || joined?.id || null,
      fit_rank: Number.isFinite(Number(row.fit_rank)) ? Number(row.fit_rank) : Number(row.match_score) || 0,
      scored_by: 'matching_engine',
    };
  }).filter((row) => row.investor_id);
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

    const shaped = shapeMatchForApi({ ...row, investor_id: investorId });
    if (!shaped) {
      return res.status(404).json({ error: 'Match not found' });
    }

    return res.json({
      match_score: shaped.match_score,
      why_you_match: shaped.why_you_match,
      reasoning: shaped.reasoning,
      fit_analysis: shaped.fit_analysis ?? null,
      investor_class: shaped.investor_class,
    });
  } catch (err) {
    console.error('[preview] investor match error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/preview/peers?url= — similar funded startups while the shortlist scores.
// Registered before /:startupId so "peers" is not parsed as an id.
router.get('/peers', async (req, res) => {
  try {
    const host = previewHost(req.query.url);
    if (!host) return res.json({ peers: [], pending: false });

    const likeHost = host.replace(/[%_]/g, '');
    const { data: rows, error: lookupError } = await supabase
      .from('startup_uploads')
      .select('id, name, website, sectors, total_god_score, status, entity_gate')
      .ilike('website', `%${likeHost}%`)
      .limit(12);
    if (lookupError) throw lookupError;

    const matches = (rows || [])
      .filter((row) => hostOf(row.website) === host && String(row.status || '').toLowerCase() !== 'rejected')
      .sort((a, b) => (Number(b.total_god_score) || 0) - (Number(a.total_god_score) || 0));
    const startup = matches[0];
    const sectors = (Array.isArray(startup?.sectors) ? startup.sectors : [])
      .map((sector) => String(sector || '').trim())
      .filter(Boolean)
      .slice(0, 8);
    if (!startup || !sectors.length) {
      return res.json({ peers: [], pending: true });
    }

    const { data: candidates, error: peerError } = await supabase
      .from('startup_uploads')
      .select('id, name, website, sectors, total_god_score, status, entity_gate')
      .overlaps('sectors', sectors)
      .neq('id', startup.id)
      .gt('total_god_score', 0)
      .order('total_god_score', { ascending: false })
      .limit(40);
    if (peerError) throw peerError;

    const ids = (candidates || []).map((row) => row.id).filter(Boolean);
    if (!ids.length) return res.json({ peers: [], pending: false });

    const { data: events, error: eventError } = await supabase
      .from('funding_evidence_events')
      .select('id, startup_id, amount_usd, announced_at, occurred_at, round_type, verification_status')
      .in('startup_id', ids)
      .in('verification_status', ['verified', 'corroborated'])
      .gte('amount_usd', MIN_AMOUNT_USD)
      .lte('amount_usd', MAX_AMOUNT_USD)
      .order('announced_at', { ascending: false })
      .limit(80);
    if (eventError) throw eventError;

    const eventIds = (events || []).map((event) => event.id).filter(Boolean);
    let participants = [];
    if (eventIds.length) {
      const { data: parts, error: partError } = await supabase
        .from('funding_evidence_participants')
        .select('funding_event_id, investor_name_raw, participant_role')
        .in('funding_event_id', eventIds);
      if (partError) throw partError;
      participants = parts || [];
    }

    return res.json({
      peers: buildPeers({ self: startup, candidates, events, participants, limit: 4 }),
      pending: false,
    });
  } catch (err) {
    console.error('[preview/peers]', err?.message || err);
    return res.json({ peers: [], pending: true });
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
    const rankedStartup = overlayCampaignQuery(startup, req.query);

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

    const mixOptions = resolvePreviewMixOptions(
      rankedStartup,
      req.query.investor_class || req.query.investor_mix,
      10
    );

    // 3. Fetch a wide slice, then mix angels + VCs (one partner per firm), keep top 10 for preview UI
    const { data: matchRows, error: mErr } = await supabase
      .from('startup_investor_matches')
      .select(`
        investor_id,
        match_score,
        why_you_match,
        created_at,
        investors (
          id,
          name,
          firm,
          title,
          type,
          is_individual,
          capital_type,
          sectors,
          stage,
          check_size_min,
          check_size_max,
          investor_tier,
          twitter_url,
          linkedin_url,
          photo_url,
          email,
          email_best_guess,
          email_candidates,
          email_status,
          email_has_mx,
          investment_thesis,
          signals,
          notable_investments,
          portfolio_companies,
          total_investments,
          last_investment_date
        )
      `)
      .eq('startup_id', startupId)
      .order('updated_at', { ascending: false, nullsFirst: false })
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

    const engineRows = await scorePreviewWithEngine(rankedStartup);
    const eligibleRows = (matchRows || []).filter((row) => {
      const inv = Array.isArray(row.investors) ? row.investors[0] : row.investors;
      return inv && (inv.id || row.investor_id);
    });
    const fitSectors = sectorsForMatching(rankedStartup);
    const startupForFit = { ...rankedStartup, sectors: fitSectors.length ? fitSectors : rankedStartup.sectors };
    if (!engineRows.length) {
      for (const row of eligibleRows) {
        const inv = Array.isArray(row.investors) ? row.investors[0] : row.investors;
        row.fit_rank = distinctiveFitScore(startupForFit, inv);
      }
    }

    let pool = engineRows.length ? engineRows : eligibleRows;
    let shortlistBlended = false;
    const strongStored = eligibleRows.filter((row) => (Number(row.fit_rank) || 0) >= 48).length;
    const campaignBrief = campaignBriefFromStartup(rankedStartup);
    const hasCampaign = campaignIsActionable(campaignBrief);
    // Stored rows are the fallback. A saved campaign still needs sector investors
    // only when the matching engine did not score this request.
    if (!engineRows.length && eligibleRows.length > 0 && (hasCampaign || (hasSpecificSector(fitSectors) && strongStored < 3))) {
      const suggested = await buildSuggestedInvestorMatches(rankedStartup, { maxSectors: 3 });
      const blended = blendStoredWithSectorSuggestions(eligibleRows, suggested);
      pool = blended.rows;
      shortlistBlended = blended.added > 0;
      if (shortlistBlended) {
        const storedIds = new Set(eligibleRows.map((row) => String(row.investor_id)));
        const fresh = pool.filter((row) => row.investor_id && !storedIds.has(String(row.investor_id)));
        void persistSectorSuggestions(rankedStartup.id, fresh);
      }
    }
    if (campaignBrief.priorities.length) {
      const priorityRows = await buildPriorityInvestorMatches(rankedStartup, campaignBrief.priorities);
      const seen = new Set(pool.map((row) => String(row.investor_id)));
      for (const row of priorityRows) {
        const id = String(row.investor_id || '');
        if (!id || seen.has(id)) continue;
        seen.add(id);
        pool.push(row);
      }
    }
    applyCampaignRank(rankedStartup, pool);
    applyResearchRank(rankedStartup, pool);

    let matches = buildPreviewMatchList(pool, mixOptions);
    let suggestedInvestorFallback = false;
    if (matches.length === 0) {
      const suggested = await buildSuggestedInvestorMatches(rankedStartup);
      matches = buildPreviewMatchList(suggested, { ...mixOptions, total: 5 });
      if (matches.length > 0) suggestedInvestorFallback = true;
    }
    matches = await attachInvestorCardFacts(matches);

    const descriptionForUi = effectiveStartupDescription(startup);

    void logPreviewLoaded(supabase, {
      startupId,
      source: req.query.source || 'preview_api',
      probeRunId: req.query.probe_run_id || req.headers['x-probe-run-id'] || null,
      matchCount: matches.length,
      url: startup.website || req.query.url || null,
      startupName: startup.name,
      sectors: startup.sectors,
      stage: startup.stage,
      godScore: startup.total_god_score,
    });

    const topInvestorIds = matches
      .map((m) => m.investor_id || m.investor?.id)
      .filter(Boolean);
    const matchMovement = await getPreviewMatchDelta(supabase, startupId, {
      totalMatches: totalMatches || 0,
      topInvestorIds,
    });

    const oracleGap = buildPreviewOracleGap(startup, totalMatches || 0);

    res.json({
      startup: {
        id: startup.id,
        name: startup.name,
        tagline: startup.tagline,
        description: descriptionForUi,
        extracted_data: rankedStartup.extracted_data || null,
        website: startup.website,
        sectors: startup.sectors,
        stage: rankedStartup.stage ?? startup.stage,
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
      shortlist_mix: summarizeShortlistMix(matches, mixOptions),
      match_movement: matchMovement,
      oracle_gap: oracleGap,
      suggested_investor_fallback: suggestedInvestorFallback,
      shortlist_blended: shortlistBlended,
      match_source: engineRows.length ? 'matching_engine' : 'stored',
      deck_focus: buildFreeDeckFocus({
        ...rankedStartup,
        score_components: {
          team: startup.team_score,
          traction: startup.traction_score,
          market: startup.market_score,
          product: startup.product_score,
          vision: startup.vision_score,
        },
      }),
    });

  } catch (err) {
    console.error('[preview] unexpected error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
