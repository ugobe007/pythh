'use strict';

/**
 * Public facts for an investor card: firm website, partner names,
 * sectors, stage timing, and example investments already on the investor row.
 * Never invent deals, dates, or URLs. Never copy email fields.
 */

const { looksLikePersonName } = require('./partnerAngelInvestors');
const { shapeRecentDeals } = require('./recentInvestorDeals');

const PARTNER_TITLE_RE = /\b(general partner|managing partner|partner|managing director|principal|gp)\b/i;

function firmKey(row) {
  return String(row?.firm || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function publicWebsite(value) {
  const text = String(value || '').trim();
  if (!/^https?:\/\//i.test(text)) return null;
  try {
    const url = new URL(text);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    if (!host || host === 'localhost') return null;
    if (/(^|\.)linkedin\.com$/.test(host)) return null;
    if (/(^|\.)twitter\.com$/.test(host) || host === 'x.com') return null;
    if (/(^|\.)crunchbase\.com$/.test(host)) return null;
    if (url.pathname === '/feed' || url.pathname.endsWith('/feed') || url.pathname.endsWith('/feed/')) return null;
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

function asList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return asList(parsed);
    } catch {
      /* plain label */
    }
    return [value.trim()];
  }
  return [];
}

function parsedFocus(raw) {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof raw === 'object' ? raw : {};
}

function uniqueLabels(values, limit = 6) {
  const out = [];
  const seen = new Set();
  for (const value of values) {
    const text = String(value || '').trim();
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= limit) break;
  }
  return out;
}

function sectorsOf(row) {
  const direct = asList(row?.sectors);
  if (direct.length) return uniqueLabels(direct);
  const focus = parsedFocus(row?.focus_areas);
  return uniqueLabels(asList(focus.primary_sectors));
}

function stagesOf(row) {
  const direct = asList(row?.stage);
  if (direct.length) return uniqueLabels(direct, 4);
  const focus = parsedFocus(row?.focus_areas);
  return uniqueLabels(asList(focus.preferred_stages), 4);
}

function partnerTitle(value) {
  const text = String(value || '').trim();
  if (!text || text.length > 48) return null;
  return text;
}

function pushPartner(list, seen, name, title) {
  const clean = String(name || '').trim();
  if (!looksLikePersonName(clean)) return;
  const key = clean.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  list.push({ name: clean, title: partnerTitle(title) });
}

function partnersFromField(raw, list, seen, firm) {
  const items = Array.isArray(raw) ? raw : [];
  for (const item of items) {
    if (typeof item === 'string') {
      if (firm && item.trim().toLowerCase() === firm) continue;
      pushPartner(list, seen, item, null);
      continue;
    }
    if (!item || typeof item !== 'object') continue;
    const name = item.name || item.full_name;
    if (firm && String(name || '').trim().toLowerCase() === firm) continue;
    pushPartner(list, seen, name, item.title);
  }
}

function collectPartners(self, related) {
  const firm = firmKey(self);
  const list = [];
  const seen = new Set();
  partnersFromField(self?.partners, list, seen, firm);
  for (const row of related || []) {
    if (firm && firmKey(row) !== firm) continue;
    partnersFromField(row?.partners, list, seen, firm);
    const name = String(row?.name || '').trim();
    if (firm && name.toLowerCase() === firm) continue;
    pushPartner(list, seen, name, row?.title);
  }
  list.sort((a, b) => {
    const aTitle = PARTNER_TITLE_RE.test(a.title || '') ? 0 : 1;
    const bTitle = PARTNER_TITLE_RE.test(b.title || '') ? 0 : 1;
    if (aTitle !== bTitle) return aTitle - bTitle;
    return a.name.localeCompare(b.name);
  });
  return list.slice(0, 6);
}

function mergeDeals(rows) {
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    for (const deal of shapeRecentDeals(row, 5)) {
      const key = String(deal.company || '').trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(deal);
      if (out.length >= 5) return out;
    }
  }
  return out;
}

/**
 * @param {object|null|undefined} investor matched investor row
 * @param {object[]} [relatedRows] other rows at the same firm
 */
function cardFactsFromRows(investor, relatedRows = []) {
  const self = investor && typeof investor === 'object' ? investor : {};
  const key = firmKey(self);
  const related = key
    ? (relatedRows || []).filter((row) => firmKey(row) === key || row?.id === self.id)
    : [];
  const firmProfile = related.find((row) => firmKey(row) && String(row.name || '').trim().toLowerCase() === firmKey(row))
    || related.find((row) => Array.isArray(row?.partners) && row.partners.length)
    || null;

  const website = publicWebsite(self.url)
    || publicWebsite(self.website)
    || publicWebsite(self.blog_url)
    || publicWebsite(firmProfile?.url)
    || publicWebsite(firmProfile?.blog_url)
    || null;

  const sectors = sectorsOf(self).length ? sectorsOf(self) : sectorsOf(firmProfile);
  const stage = stagesOf(self).length ? stagesOf(self) : stagesOf(firmProfile);
  const last = self.last_investment_date || firmProfile?.last_investment_date || null;

  return {
    website,
    partners: collectPartners(self, related),
    sectors,
    stage,
    last_investment_date: last ? String(last) : null,
    recent_deals: mergeDeals([self, firmProfile].filter(Boolean)),
  };
}

function applyCardFacts(match, facts) {
  if (!match || !facts) return match;
  const investor = { ...(match.investor || {}) };
  if (facts.website) investor.website = facts.website;
  if (facts.partners?.length) investor.partners = facts.partners;
  if ((!asList(investor.sectors).length) && facts.sectors?.length) investor.sectors = facts.sectors;
  if ((!asList(investor.stage).length) && facts.stage?.length) investor.stage = facts.stage;
  if (!investor.last_investment_date && facts.last_investment_date) {
    investor.last_investment_date = facts.last_investment_date;
  }
  if (!Array.isArray(investor.recent_deals) || investor.recent_deals.length === 0) {
    if (facts.recent_deals?.length) investor.recent_deals = facts.recent_deals;
  }
  return { ...match, investor };
}

module.exports = {
  publicWebsite,
  cardFactsFromRows,
  applyCardFacts,
};
