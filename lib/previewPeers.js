/**
 * Similar funded startups for the match-preview wait panel.
 * Pure shaping — the route loads rows; this decides which ones are safe to show.
 */
'use strict';

const MIN_AMOUNT_USD = 250_000;
const MAX_AMOUNT_USD = 2_000_000_000;

const ROLE_RANK = {
  lead: 0,
  co_lead: 1,
  participant: 2,
  existing_investor: 3,
  unknown: 4,
};

function previewHost(raw) {
  let input = String(raw || '').trim().toLowerCase();
  input = input.replace(/^https?:\/\//, '').replace(/^www\./, '');
  input = input.split('/')[0].split('?')[0].split('#')[0].split(':')[0];
  if (!/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?)+$/.test(input)) {
    return '';
  }
  return input;
}

function hostOf(website) {
  return previewHost(website);
}

function usableFunder(raw) {
  let name = String(raw || '').replace(/\s+/g, ' ').trim();
  name = name.replace(/\s*[&+]\s*others\b.*$/i, '').replace(/\s+and\s+others\b.*$/i, '').trim();
  name = name.replace(/[.,;:]+$/, '').trim();
  if (name.length < 2 || name.length > 64) return null;
  if (/^(others|various|undisclosed|unknown|n\/a|na)$/i.test(name)) return null;
  if (/\b(proceeds|roundup|also participating|participating investors)\b/i.test(name)) return null;
  if (/https?:|@/.test(name)) return null;
  if (name.split(/\s+/).length > 6) return null;
  return name;
}

function pickFunder(parts) {
  const ranked = (parts || [])
    .map((part) => ({
      name: usableFunder(part?.investor_name_raw),
      role: String(part?.participant_role || 'unknown'),
    }))
    .filter((part) => part.name)
    .sort((a, b) => (ROLE_RANK[a.role] ?? 9) - (ROLE_RANK[b.role] ?? 9));
  return ranked[0]?.name || null;
}

function peerNameOk(name) {
  const n = String(name || '').replace(/\s+/g, ' ').trim();
  if (n.length < 2 || n.length > 42) return false;
  if (/https?:|[@|]/.test(n)) return false;
  if (/\b(raises|raised|funding|proceeds|series\s+[a-e]|ventureburn|techcrunch|according to)\b/i.test(n)) return false;
  if (n.split(/\s+/).length > 5) return false;
  return true;
}

function sharedSector(selfSectors, peerSectors) {
  const peer = new Set((peerSectors || []).map((s) => String(s || '').trim().toLowerCase()).filter(Boolean));
  for (const sector of selfSectors || []) {
    const label = String(sector || '').trim();
    if (label && peer.has(label.toLowerCase())) return label;
  }
  const first = (peerSectors || []).map((s) => String(s || '').trim()).find(Boolean);
  return first || null;
}

function eventWhen(event) {
  return event?.announced_at || event?.occurred_at || null;
}

/**
 * @param {{ self?: object, candidates?: object[], events?: object[], participants?: object[], limit?: number }} input
 */
function buildPeers(input = {}) {
  const self = input.self || {};
  const selfId = self.id || null;
  const selfName = String(self.name || '').trim().toLowerCase();
  const selfSectors = Array.isArray(self.sectors) ? self.sectors : [];
  const limit = input.limit || 4;

  const partsByEvent = new Map();
  for (const part of input.participants || []) {
    const list = partsByEvent.get(part.funding_event_id) || [];
    list.push(part);
    partsByEvent.set(part.funding_event_id, list);
  }

  const bestByStartup = new Map();
  for (const event of input.events || []) {
    if (!event?.startup_id) continue;
    if (!['verified', 'corroborated'].includes(event.verification_status)) continue;
    const amount = Number(event.amount_usd);
    if (!Number.isFinite(amount) || amount < MIN_AMOUNT_USD || amount > MAX_AMOUNT_USD) continue;
    const when = eventWhen(event);
    if (!when) continue;
    const funder = pickFunder(partsByEvent.get(event.id));
    if (!funder) continue;
    const prev = bestByStartup.get(event.startup_id);
    if (!prev || String(when) > String(prev.when)) {
      bestByStartup.set(event.startup_id, { amount, when, funder, round_type: event.round_type || null });
    }
  }

  const peers = [];
  for (const row of input.candidates || []) {
    if (!row?.id || row.id === selfId) continue;
    const name = String(row.name || '').replace(/\s+/g, ' ').trim();
    if (selfName && name.toLowerCase() === selfName) continue;
    if (String(row.status || '').toLowerCase() === 'rejected') continue;
    if (String(row.entity_gate || '').toLowerCase() === 'junk') continue;
    if (!peerNameOk(name)) continue;
    const funded = bestByStartup.get(row.id);
    if (!funded) continue;
    peers.push({
      name,
      sector: sharedSector(selfSectors, row.sectors),
      funder: funded.funder,
      amount_usd: funded.amount,
      announced_at: String(funded.when).slice(0, 10),
      round_type: funded.round_type,
    });
    if (peers.length >= limit) break;
  }
  return peers;
}

module.exports = {
  MIN_AMOUNT_USD,
  MAX_AMOUNT_USD,
  previewHost,
  hostOf,
  usableFunder,
  pickFunder,
  peerNameOk,
  buildPeers,
};
