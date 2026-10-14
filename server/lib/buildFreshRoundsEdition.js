'use strict';

/**
 * Build the daily Fresh Rounds edition from press-verified early-stage raises.
 * Falls back to lib/freshRoundsEdition.json when Supabase is empty/unavailable.
 */

const { FRESH_ROUNDS_EDITION: FALLBACK } = require('../../lib/freshRoundsEdition');

const EARLY_AMOUNT_CAP = 15_000_000;
const TARGET_ROWS = 10;
const CACHE_MS = 15 * 60 * 1000;

/** @type {{ at: number, day: string, edition: object } | null} */
let cache = null;

function todayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function formatDateLabel(d = new Date()) {
  const weekday = d.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }).toUpperCase();
  const mon = d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase();
  const day = d.getUTCDate();
  const year = d.getUTCFullYear();
  return `${weekday} // ${mon} ${day}, ${year}`;
}

function formatShortDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function formatAmount(usd) {
  const n = Number(usd);
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n >= 1_000_000_000) {
    const v = n / 1_000_000_000;
    return `$${Number.isInteger(v) ? v : v.toFixed(2).replace(/\.?0+$/, '')}B`;
  }
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `$${Number.isInteger(v) ? v : v.toFixed(2).replace(/\.?0+$/, '')}M`;
  }
  if (n >= 1_000) {
    const v = n / 1_000;
    const rounded = Math.round(v);
    if (rounded >= 1000) {
      return `$${(rounded / 1000).toFixed(2).replace(/\.?0+$/, '')}M`;
    }
    return `$${rounded}K`;
  }
  return `$${Math.round(n)}`;
}

function isEarlyStageRound(event) {
  const t = `${event.round_type || ''} ${event.headline || ''}`.toLowerCase();
  
  // Check for explicit early-stage markers first
  if (/pre[-\s]?seed|preseed/.test(t)) return true;
  if (/\bseed\b|\bangel\b/.test(t)) {
    const amt = Number(event.amount_usd);
    return !Number.isFinite(amt) || amt <= EARLY_AMOUNT_CAP;
  }
  
  // Now filter out late-stage / non-equity noise
  const roundType = (event.round_type || '').toLowerCase();
  if (/series\s*[b-z]\b|\bgrowth\b|\bipo\b|\bdebt\b|\bgrant\b|\bnsf\b/.test(roundType)) return false;
  
  // Explicit Series A is out of the Pre-Seed sheet
  if (/series\s*a\b/.test(t) && !/pre[-\s]?seed|preseed/.test(t)) return false;

  const amt = Number(event.amount_usd);
  // Amount-only early heuristic when round_type missing
  if (!event.round_type && Number.isFinite(amt) && amt > 0 && amt <= 8_000_000) {
    return /rais(es|ed)|funding|closes|lands|nabs/.test(t);
  }
  return false;
}

function cleanSector(sectors) {
  if (!Array.isArray(sectors) || !sectors.length) return null;
  const s = String(sectors[0] || '').trim();
  if (!s || s.length > 40) return null;
  if (/,|USA|United States|\d{5}/i.test(s)) return null;
  return s;
}

function cleanTagline(tagline, name) {
  const t = String(tagline || '').trim();
  if (!t || t.length > 48) return null;
  if (name && t.toLowerCase().startsWith(String(name).toLowerCase())) return null;
  if (/USA|United States|Spring \d{4}|,\s*[A-Z]{2},/i.test(t)) return null;
  return t;
}

/** Compress a press headline into a short topic line. */
function lineFromHeadline(headline, name) {
  let h = String(headline || '').trim();
  if (!h) return null;
  h = h.replace(/\s+[—–|-]\s+.*$/, ''); // drop publisher tail
  if (name) {
    const re = new RegExp(`^${String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[:\\s,]*`, 'i');
    h = h.replace(re, '');
  }
  h = h
    .replace(/^(exclusive:\s*)/i, '')
    .replace(/\b(raises?|raised|lands|nabs|closes|secures|announces)\b[^$]{0,40}\$?[\d.,]+\s*[mbk]?(illion)?\b/gi, '')
    .replace(/\b(pre[-\s]?seed|seed)\b/gi, '')
    .replace(/\b(round|funding)\b/gi, '')
    .replace(/\bto\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,:;-]+|[\s,:;-]+$/g, '')
    .trim();
  if (h.length < 3 || h.length > 48) return null;
  // Title-case lightly if all lowercase
  return h.charAt(0).toUpperCase() + h.slice(1);
}

function pickLine(startup, event) {
  return (
    cleanSector(startup?.sectors) ||
    cleanTagline(startup?.tagline, startup?.name) ||
    lineFromHeadline(event.headline, startup?.name) ||
    'Early-stage raise'
  );
}

function pickInvestor(event) {
  const named = String(event.lead_investor || '').trim();
  if (named && !/^undisclosed$/i.test(named)) return named;

  const h = String(event.headline || '');
  const led = h.match(/\bled by\s+([A-Z][\w&.'’ -]{1,60}?)(?:\s+and\b|\s*—|\s+-|,|\.|$)/);
  if (led?.[1]) return led[1].trim();
  const from = h.match(/\bfrom\s+([A-Z][\w&.'’ -]{1,60}?(?:Ventures|Capital|Partners|Fund|VC))\b/);
  if (from?.[1]) return from[1].trim();
  return 'Undisclosed';
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ now?: Date, limit?: number }} [opts]
 */
async function loadLiveRows(supabase, opts = {}) {
  const limit = opts.limit || TARGET_ROWS;
  const { data: events, error } = await supabase
    .from('portfolio_events')
    .select(
      'id, startup_id, event_date, amount_usd, round_type, lead_investor, headline, verified, event_type',
    )
    .eq('event_type', 'funding_round')
    .eq('verified', true)
    .order('event_date', { ascending: false })
    .limit(400);
  if (error) throw error;

  const early = (events || []).filter(isEarlyStageRound);
  const seen = new Set();
  const picked = [];
  for (const ev of early) {
    const key = ev.startup_id || ev.id;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    picked.push(ev);
  }

  const startupIds = [...new Set(picked.map((e) => e.startup_id).filter(Boolean))];
  /** @type {Map<string, any>} */
  const byId = new Map();
  if (startupIds.length) {
    const { data: startups, error: sErr } = await supabase
      .from('startup_uploads')
      .select('id, name, tagline, sectors, entity_gate')
      .in('id', startupIds);
    if (sErr) throw sErr;
    for (const s of startups || []) byId.set(s.id, s);
  }

  const rows = [];
  const dateBounds = [];
  for (const ev of picked) {
    const startup = byId.get(ev.startup_id);
    if (!startup?.name) continue;
    if (String(startup.entity_gate || '').toLowerCase() === 'junk') continue;
    const amount = formatAmount(ev.amount_usd);
    if (amount === '—') continue;
    rows.push({
      name: startup.name,
      line: pickLine(startup, ev),
      amount,
      investor: pickInvestor(ev),
      _date: ev.event_date,
    });
    if (ev.event_date) dateBounds.push(new Date(ev.event_date).getTime());
    if (rows.length >= limit) break;
  }

  return { rows: rows.map(({ _date, ...r }) => r), dateBounds };
}

function buildEditionMeta(rows, dateBounds, now = new Date()) {
  const day = todayKey(now);
  let rangeLabel = '';
  if (dateBounds.length) {
    const min = formatShortDate(new Date(Math.min(...dateBounds)).toISOString());
    const max = formatShortDate(new Date(Math.max(...dateBounds)).toISOString());
    rangeLabel = min && max ? (min === max ? min : `${min} to ${max}`) : '';
  }
  const count = rows.length;
  return {
    slug: `pre-seed-${day}`,
    masthead: 'FRESH ROUNDS',
    dateLabel: formatDateLabel(now),
    title: 'Pre-Seed',
    subtitle: count
      ? `${count} verified early-stage raise${count === 1 ? '' : 's'}${rangeLabel ? `, ${rangeLabel}` : ''}`
      : 'Verified early-stage raises from the press',
    cadence: 'Updated daily from press-verified raises.',
    footnote:
      'Amounts and leads come from verified press. Undisclosed means the round did not name a lead. A city is printed when the round names one.',
    rows,
    generated_at: now.toISOString(),
    source: 'live',
  };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient | null} supabase
 * @param {{ now?: Date, force?: boolean }} [opts]
 */
async function buildFreshRoundsEdition(supabase, opts = {}) {
  const now = opts.now || new Date();
  const day = todayKey(now);
  if (!opts.force && cache && cache.day === day && Date.now() - cache.at < CACHE_MS) {
    return cache.edition;
  }

  if (!supabase) {
    return { ...FALLBACK, source: 'fallback', generated_at: now.toISOString() };
  }

  try {
    const { rows, dateBounds } = await loadLiveRows(supabase, { limit: TARGET_ROWS });
    if (!rows.length) {
      return { ...FALLBACK, source: 'fallback_empty', generated_at: now.toISOString() };
    }
    const edition = buildEditionMeta(rows, dateBounds, now);
    cache = { at: Date.now(), day, edition };
    return edition;
  } catch (err) {
    console.warn('[fresh-rounds] live edition failed, using fallback:', err.message || err);
    return { ...FALLBACK, source: 'fallback_error', generated_at: now.toISOString() };
  }
}

function clearFreshRoundsEditionCache() {
  cache = null;
}

module.exports = {
  buildFreshRoundsEdition,
  clearFreshRoundsEditionCache,
  formatAmount,
  formatDateLabel,
  isEarlyStageRound,
  pickInvestor,
  pickLine,
  TARGET_ROWS,
  FALLBACK,
};
