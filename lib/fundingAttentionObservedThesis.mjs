/**
 * Additive merge of observed funding-attention into investors.signals.
 *
 * Never writes investment_thesis, bio, sectors, or check size.
 * Re-runs replace the contribution of a given event id (no double-count).
 * Co-investors are accepted only from verified same-event participants.
 */

import { FUNDING_ATTENTION_VERSION, aspectThemes } from './fundingAttentionAspects.mjs';

const MAX_EVENT_EVIDENCE = 12;
const MAX_CO_INVESTORS = 24;
const MAX_THEMES = 16;

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {};
}

function uniqueStrings(values, limit = MAX_THEMES) {
  const out = [];
  const seen = new Set();
  for (const value of values || []) {
    const next = String(value || '').trim();
    if (!next) continue;
    const key = next.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(next);
    if (out.length >= limit) break;
  }
  return out;
}

function observationKey(observation = {}) {
  return String(observation.eventId || observation.event_id || '').trim();
}

function aspectRollup(byEvent) {
  const counts = {};
  for (const entry of Object.values(byEvent || {})) {
    for (const aspect of entry.aspects || []) {
      const id = aspect.id;
      if (!id) continue;
      if (!counts[id]) counts[id] = { id, theme: aspect.theme, count: 0, last_seen: null };
      counts[id].count += 1;
      const seen = entry.announced_at || entry.as_of;
      if (seen && (!counts[id].last_seen || seen > counts[id].last_seen)) {
        counts[id].last_seen = seen;
        counts[id].theme = aspect.theme || counts[id].theme;
      }
    }
  }
  return counts;
}

function rollupCoInvestors(byEvent) {
  const byId = new Map();
  for (const entry of Object.values(byEvent || {})) {
    for (const peer of entry.co_investors || []) {
      const key = peer.investor_id || String(peer.name || '').toLowerCase();
      if (!key) continue;
      const existing = byId.get(key) || {
        investor_id: peer.investor_id || null,
        name: peer.name || null,
        count: 0,
        last_seen: null,
      };
      existing.count += 1;
      existing.name = peer.name || existing.name;
      existing.investor_id = peer.investor_id || existing.investor_id;
      const seen = entry.announced_at || entry.as_of;
      if (seen && (!existing.last_seen || seen > existing.last_seen)) existing.last_seen = seen;
      byId.set(key, existing);
    }
  }
  return [...byId.values()]
    .sort((a, b) => (b.count - a.count) || String(a.name || '').localeCompare(String(b.name || '')))
    .slice(0, MAX_CO_INVESTORS);
}

/**
 * Merge one verified-event observation into existing investors.signals JSON.
 *
 * @param {object|null} existingSignals
 * @param {{
 *   eventId: string,
 *   aspects?: object[],
 *   coInvestors?: Array<{ investor_id?: string|null, name?: string|null }>,
 *   sourceUrl?: string|null,
 *   announcedAt?: string|null,
 *   startupName?: string|null,
 *   cited?: boolean,
 * }} observation
 * @returns {object} next signals JSON (never includes investment_thesis)
 */
export function mergeObservedThesis(existingSignals, observation) {
  const signals = asObject(existingSignals);
  const eventId = observationKey(observation);
  if (!eventId) return signals;

  const observed = asObject(signals.observed_thesis);
  const byEvent = asObject(observed.by_event);
  const asOf = new Date().toISOString();
  const aspects = Array.isArray(observation.aspects) ? observation.aspects.map((row) => ({
    id: row.id,
    theme: row.theme,
    primary_signal: row.primary_signal || null,
    confidence: row.confidence ?? null,
  })) : [];
  const coInvestors = Array.isArray(observation.coInvestors)
    ? observation.coInvestors
      .filter((row) => row && (row.investor_id || row.name))
      .map((row) => ({
        investor_id: row.investor_id || null,
        name: row.name || null,
      }))
    : [];

  byEvent[eventId] = {
    event_id: eventId,
    aspects,
    co_investors: coInvestors,
    source_url: observation.sourceUrl || observation.source_url || null,
    announced_at: observation.announcedAt || observation.announced_at || null,
    startup_name: observation.startupName || observation.startup_name || null,
    cited: Boolean(observation.cited),
    as_of: asOf,
    version: FUNDING_ATTENTION_VERSION,
  };

  const eventIds = Object.keys(byEvent);
  if (eventIds.length > MAX_EVENT_EVIDENCE) {
    const ranked = eventIds
      .map((id) => ({ id, at: byEvent[id].announced_at || byEvent[id].as_of || '' }))
      .sort((a, b) => String(b.at).localeCompare(String(a.at)));
    for (const extra of ranked.slice(MAX_EVENT_EVIDENCE)) delete byEvent[extra.id];
  }

  const aspectCounts = aspectRollup(byEvent);
  const themes = uniqueStrings([
    ...(Array.isArray(signals.top_themes) ? signals.top_themes : []),
    ...aspectThemes(aspects),
    ...Object.values(aspectCounts).map((row) => row.theme),
  ]);

  signals.top_themes = themes;
  signals.observed_thesis = {
    version: FUNDING_ATTENTION_VERSION,
    as_of: asOf,
    by_event: byEvent,
    aspects: aspectCounts,
    co_investors: rollupCoInvestors(byEvent),
    event_count: Object.keys(byEvent).length,
  };
  return signals;
}

/**
 * Patch object for investors.update — signals only.
 * Callers must not spread this onto investment_thesis.
 */
export function investorSignalsPatch(existingSignals, observation) {
  return { signals: mergeObservedThesis(existingSignals, observation) };
}

export function hasObservationForEvent(existingSignals, eventId) {
  const observed = asObject(asObject(existingSignals).observed_thesis);
  return Boolean(asObject(observed.by_event)[String(eventId || '')]);
}
