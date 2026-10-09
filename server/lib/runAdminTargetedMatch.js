'use strict';

/**
 * Admin-only: run targeted investor matches for a startup URL.
 * Returns up to 25 firm-deduped matches with strategy + contact (email included).
 * Optionally enriches contacts via Hunter.io (resolveInvestorContact).
 */

const { getSupabaseClient } = require('./supabaseClient');
const { resolveInvestorEmail, investorHasContact } = require('../../lib/recentInvestorDeals');
const { normalizeWhyYouMatch } = require('../../lib/normalizeWhyYouMatch');
const { classifyContactEmail } = require('../../lib/investorEmailInfer.js');

const MAX_LIMIT = 25;
const DEFAULT_LIMIT = 25;
const HUNTER_CONCURRENCY = 3;
const HUNTER_GAP_MS = 250;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function clampLimit(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(n)));
}

function whyBullets(raw) {
  if (Array.isArray(raw)) {
    return raw.map((s) => String(s || '').trim()).filter(Boolean);
  }
  const joined = normalizeWhyYouMatch(raw);
  if (!joined) return [];
  return joined.split(/\s*·\s*/).map((s) => s.trim()).filter(Boolean);
}

function joinInvestor(row) {
  const inv = row?.investors;
  if (Array.isArray(inv)) return inv[0] || null;
  return inv && typeof inv === 'object' ? inv : null;
}

function shapeAdminMatch(row, rank, extras = {}) {
  const inv = { ...(joinInvestor(row) || {}), ...(extras.investorPatch || {}) };
  const email = resolveInvestorEmail(inv);
  const bullets = whyBullets(row.why_you_match);
  const hunter = extras.hunter || null;
  const contactEmail = hunter?.email || email?.address || null;
  const contactType = hunter?.emailType || email?.type || null;
  const contactSource = hunter?.source || (email?.address ? 'on_file' : null);
  return {
    rank,
    investor_id: row.investor_id || inv.id || null,
    match_score: Number(row.match_score) || 0,
    fit_rank: Number.isFinite(Number(row.fit_rank)) ? Number(row.fit_rank) : Number(row.match_score) || 0,
    confidence_level: row.confidence_level || null,
    strategy: {
      why_you_match: bullets,
      why_you_match_text: normalizeWhyYouMatch(row.why_you_match),
      reasoning: typeof row.reasoning === 'string' ? row.reasoning : null,
      investment_thesis:
        typeof inv.investment_thesis === 'string' ? inv.investment_thesis : null,
      fit_analysis: row.fit_analysis && typeof row.fit_analysis === 'object' ? row.fit_analysis : null,
    },
    contact: {
      email: contactEmail,
      email_type: contactType,
      email_status: hunter?.email_status || inv.email_status || null,
      email_source: contactSource,
      hunter_confidence: hunter?.hunterConfidence ?? null,
      hunter_position: hunter?.position || null,
      person_name: hunter?.personName || null,
      zero_bounce_status: hunter?.zeroBounceStatus || null,
      linkedin_url: inv.linkedin_url || null,
      twitter_url: inv.twitter_url || null,
      website: inv.url || null,
      contactable: !!(contactEmail || investorHasContact(inv)),
    },
    investor: {
      id: inv.id || null,
      name: inv.name || null,
      firm: inv.firm || null,
      type: inv.type || null,
      sectors: Array.isArray(inv.sectors) ? inv.sectors : [],
      stage: inv.stage || null,
      check_size_min: inv.check_size_min ?? null,
      check_size_max: inv.check_size_max ?? null,
      investor_tier: inv.investor_tier || null,
      total_investments: inv.total_investments ?? null,
      last_investment_date: inv.last_investment_date || null,
      photo_url: inv.photo_url || null,
      partners: Array.isArray(inv.partners) ? inv.partners : [],
    },
  };
}

async function loadInvestorContactFields(supabase, investorIds) {
  const ids = [...new Set((investorIds || []).filter(Boolean))];
  if (!ids.length) return new Map();
  const { data, error } = await supabase
    .from('investors')
    .select('id, name, firm, url, partners, email, email_best_guess, email_status, email_has_mx')
    .in('id', ids);
  if (error) {
    console.warn('[admin/targeted-match] partner load failed:', error.message);
    return new Map();
  }
  return new Map((data || []).map((row) => [String(row.id), row]));
}

async function persistHunterContact(supabase, investorId, contact) {
  if (!investorId || !contact?.email) return;
  const isVerified =
    contact.source === 'verified_on_file'
    || (contact.hunterConfidence || 0) >= 85
    || contact.zeroBounceStatus === 'valid';
  const candidates = [{
    address: contact.email,
    type: contact.emailType === 'personal' ? 'personal' : 'intake',
    confidence: Math.min((contact.hunterConfidence || 80) / 100, 0.99),
    source: contact.source,
    position: contact.position || null,
  }];
  const update = {
    email_best_guess: contact.email,
    email_candidates: candidates,
    email_status: isVerified ? 'verified' : 'inferred',
    email_enriched_at: new Date().toISOString(),
    ...(isVerified
      ? { email: contact.email, email_verified_at: new Date().toISOString() }
      : {}),
  };
  const { error } = await supabase.from('investors').update(update).eq('id', investorId);
  if (error) console.warn('[admin/targeted-match] hunter persist failed:', error.message);
}

/**
 * Run Hunter.io lookups for shaped matches (up to 25).
 * @returns {{ matches: object[], hunter: object }}
 */
async function enrichMatchesWithHunter(matches, {
  supabase,
  useHunter = true,
  validate = false,
  persist = true,
} = {}) {
  const stats = {
    enabled: false,
    available: false,
    looked_up: 0,
    found: 0,
    rejected: 0,
    skipped_on_file: 0,
    errors: 0,
    persisted: 0,
  };

  let resolveInvestorContact;
  let hasHunterIo;
  try {
    ({ resolveInvestorContact } = await import('../../lib/resolveInvestorContact.mjs'));
    ({ hasHunterIo } = await import('../../lib/hunterIo.mjs'));
  } catch (err) {
    console.warn('[admin/targeted-match] hunter modules unavailable:', err?.message || err);
    return { matches, hunter: stats };
  }

  stats.available = hasHunterIo();
  if (!useHunter || !stats.available) {
    return { matches, hunter: stats };
  }
  stats.enabled = true;

  const investorIds = matches.map((m) => m.investor_id).filter(Boolean);
  const contactRows = await loadInvestorContactFields(supabase, investorIds);

  const enriched = matches.map((m) => ({ ...m }));
  let cursor = 0;

  async function worker() {
    while (cursor < enriched.length) {
      const i = cursor;
      cursor += 1;
      const match = enriched[i];
      const base = contactRows.get(String(match.investor_id)) || {};
      const onFileEmail = match.contact?.email || base.email || null;
      const onFileType = classifyContactEmail(onFileEmail);
      const onFileIsPersonal = onFileType === 'personal';
      const partners = Array.isArray(base.partners) ? base.partners : [];

      // Skip Hunter only when we already have a personal verified partner email.
      // Intake addresses (pitch@, deals@, info@) always go through Hunter for a person.
      const hasPersonalVerified =
        !!onFileEmail
        && onFileIsPersonal
        && (base.email_status === 'verified' || match.contact?.email_type === 'verified');

      if (hasPersonalVerified) {
        stats.skipped_on_file += 1;
        enriched[i] = {
          ...match,
          contact: {
            ...match.contact,
            email_source: match.contact.email_source || 'verified_on_file',
            email_type: onFileType,
          },
          investor: {
            ...match.investor,
            partners,
          },
        };
        continue;
      }

      // Clear intake/generic email so resolveInvestorContact does not short-circuit
      // before Hunter; keep it as fallback if Hunter misses.
      const hunterPayload = {
        id: match.investor_id,
        name: match.investor?.name || base.name,
        firm: match.investor?.firm || base.firm,
        url: match.contact?.website || base.url || null,
        website: base.url || match.contact?.website || null,
        partners,
        email: hasPersonalVerified ? onFileEmail : null,
        email_best_guess: onFileIsPersonal
          ? (base.email_best_guess || null)
          : (base.email_best_guess && classifyContactEmail(base.email_best_guess) === 'personal'
            ? base.email_best_guess
            : null),
        email_status: base.email_status || match.contact?.email_status || null,
      };

      stats.looked_up += 1;
      try {
        const contact = await resolveInvestorContact(hunterPayload, {
          useHunter: true,
          validate,
          allowCatchAll: true,
        });
        if (!contact || contact.rejected) {
          stats.rejected += 1;
          enriched[i] = {
            ...match,
            contact: {
              ...match.contact,
              // Keep intake on-file email when Hunter misses
              email: match.contact.email || onFileEmail,
              email_type: onFileEmail ? onFileType : 'missing',
              email_source: contact?.reason
                ? `hunter_${contact.reason}`
                : (onFileEmail ? 'on_file_after_hunter_miss' : 'hunter_miss'),
            },
            investor: { ...match.investor, partners },
          };
        } else if (
          contact.source === 'inferred_best_guess'
          || contact.source === 'verified_on_file'
        ) {
          if (contact.source === 'verified_on_file') stats.skipped_on_file += 1;
          else stats.rejected += 1;
          enriched[i] = {
            ...match,
            contact: {
              ...match.contact,
              email: contact.email || match.contact.email || onFileEmail,
              email_type: contact.emailType || match.contact.email_type || onFileType,
              email_source: contact.source,
              person_name: contact.personName || null,
            },
            investor: { ...match.investor, partners },
          };
        } else {
          stats.found += 1;
          const hunterMeta = {
            email: contact.email,
            emailType: contact.emailType,
            source: contact.source,
            hunterConfidence: contact.hunterConfidence ?? null,
            position: contact.position || null,
            personName: contact.personName || null,
            zeroBounceStatus: contact.zeroBounceStatus || null,
            email_status:
              (contact.hunterConfidence || 0) >= 85 || contact.zeroBounceStatus === 'valid'
                ? 'verified'
                : 'inferred',
          };
          if (persist && String(contact.source || '').startsWith('hunter')) {
            await persistHunterContact(supabase, match.investor_id, contact);
            stats.persisted += 1;
          }
          enriched[i] = {
            ...match,
            contact: {
              ...match.contact,
              email: hunterMeta.email,
              email_type: hunterMeta.emailType,
              email_status: hunterMeta.email_status,
              email_source: hunterMeta.source,
              hunter_confidence: hunterMeta.hunterConfidence,
              hunter_position: hunterMeta.position,
              person_name: hunterMeta.personName,
              zero_bounce_status: hunterMeta.zeroBounceStatus,
              contactable: true,
            },
            investor: { ...match.investor, partners },
          };
        }
      } catch (err) {
        stats.errors += 1;
        console.warn(
          `[admin/targeted-match] hunter lookup failed for ${match.investor?.firm || match.investor_id}:`,
          err?.message || err,
        );
      }
      await sleep(HUNTER_GAP_MS);
    }
  }

  const workers = Array.from(
    { length: Math.min(HUNTER_CONCURRENCY, enriched.length || 1) },
    () => worker(),
  );
  await Promise.all(workers);
  return { matches: enriched, hunter: stats };
}

async function resolveStartupViaInstantSubmit(url, { force = true, timeoutMs = 20000 } = {}) {
  const PORT = process.env.PORT || (process.env.FLY_APP_NAME ? 8080 : 3002);
  const INSTANT_URL = `http://127.0.0.1:${PORT}/api/instant/submit`;
  const res = await fetch(INSTANT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, force_generate: force === true }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok && res.status !== 202) {
    const msg = body.message || body.error || `instant submit failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  const startupId = body.startup_id || null;
  if (!startupId) {
    const err = new Error(body.message || body.error || 'No startup_id from instant submit');
    err.status = 502;
    throw err;
  }
  return {
    startup_id: startupId,
    queued: body.queued === true || body.status === 'queued',
    gen_in_progress: body.gen_in_progress === true,
    total_god_score: body.total_god_score ?? null,
    name: body.name || body.startup_name || null,
    website: body.website || url,
  };
}

/**
 * @param {{
 *   url: string,
 *   limit?: number,
 *   force?: boolean,
 *   maxMs?: number,
 *   useHunter?: boolean,
 *   validateHunter?: boolean,
 *   persistContacts?: boolean,
 * }} opts
 */
async function runAdminTargetedMatch(opts = {}) {
  const url = String(opts.url || '').trim();
  if (!url) {
    const err = new Error('URL is required');
    err.status = 400;
    throw err;
  }
  const limit = clampLimit(opts.limit);
  const force = opts.force !== false;
  const maxMs = Number(opts.maxMs) > 0 ? Number(opts.maxMs) : 12000;
  const useHunter = opts.useHunter !== false;
  const validateHunter = opts.validateHunter === true;
  const persistContacts = opts.persistContacts !== false;

  const resolved = await resolveStartupViaInstantSubmit(url, { force });

  const supabase = getSupabaseClient();

  const { data: startup, error: sErr } = await supabase
    .from('startup_uploads')
    .select('*')
    .eq('id', resolved.startup_id)
    .maybeSingle();

  if (sErr || !startup) {
    const err = new Error(sErr?.message || 'Startup not found after submit');
    err.status = 404;
    throw err;
  }

  const instantSubmit = require('../routes/instantSubmit');
  const scoreStartupMatches = instantSubmit.scoreStartupMatches;
  const uploadRowToPlaceholderStartup = instantSubmit.uploadRowToPlaceholderStartup;
  if (typeof scoreStartupMatches !== 'function' || typeof uploadRowToPlaceholderStartup !== 'function') {
    const err = new Error('Matching engine unavailable');
    err.status = 503;
    throw err;
  }

  const { data: sigRow } = await supabase
    .from('startup_signal_scores')
    .select('signals_total')
    .eq('startup_id', startup.id)
    .maybeSingle();

  const signalTotal =
    sigRow?.signals_total != null && Number.isFinite(Number(sigRow.signals_total))
      ? Number(sigRow.signals_total)
      : null;

  const placeholder = uploadRowToPlaceholderStartup(startup.id, startup);
  const scored = await scoreStartupMatches(supabase, {
    startupId: startup.id,
    placeholderStartup: placeholder,
    signalTotal,
    maxMs,
    topN: limit,
  });

  if (scored?.error && !(scored.matches || []).length) {
    const err = new Error(scored.error);
    err.status = 500;
    throw err;
  }

  const baseMatches = (scored?.matches || [])
    .slice(0, limit)
    .map((row, i) => shapeAdminMatch(row, i + 1));

  const { matches, hunter } = await enrichMatchesWithHunter(baseMatches, {
    supabase,
    useHunter,
    validate: validateHunter,
    persist: persistContacts,
  });

  return {
    ok: true,
    limit,
    force,
    use_hunter: useHunter,
    startup: {
      id: startup.id,
      name: startup.name || resolved.name || null,
      website: startup.website || resolved.website || url,
      sectors: Array.isArray(startup.sectors) ? startup.sectors : [],
      stage: startup.stage || null,
      total_god_score: startup.total_god_score ?? resolved.total_god_score,
      status: startup.status || null,
    },
    match_count: matches.length,
    engine_error: scored?.error || null,
    queued_on_submit: resolved.queued === true,
    gen_in_progress: resolved.gen_in_progress === true,
    hunter,
    matches,
  };
}

module.exports = {
  runAdminTargetedMatch,
  shapeAdminMatch,
  enrichMatchesWithHunter,
  clampLimit,
  MAX_LIMIT,
  DEFAULT_LIMIT,
};
