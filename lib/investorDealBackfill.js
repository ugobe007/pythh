'use strict';

/**
 * Turn funding-ledger rows and reviewed news into investor-profile deals.
 * Cards read notable_investments. Nothing here invents a company, round, or amount.
 */

const { shapeRecentDeals, yearFrom, parseAmount } = require('./recentInvestorDeals');
const {
  eligibleInvestorEvidenceArticles,
  extractPortfolioCompanies,
} = require('../server/services/investorInferenceService');

const TRUSTED_VERIFICATION = new Set(['verified', 'corroborated']);
const ACCEPTED_ROLES = new Set(['lead', 'co_lead', 'participant']);
const MIN_AMOUNT_USD = 250_000;
const MAX_AMOUNT_USD = 2_000_000_000;

function dealKey(company) {
  return String(company || '').trim().toLowerCase();
}

function boundedAmount(value) {
  const amount = parseAmount(value);
  if (amount == null || amount < MIN_AMOUNT_USD || amount > MAX_AMOUNT_USD) return null;
  return amount;
}

function dealsFromProfile(investor) {
  return shapeRecentDeals(investor, 8).map((deal) => ({
    company: deal.company,
    year: deal.year ?? null,
    round: deal.round ?? null,
    amount: deal.amount ?? null,
    invested_at: null,
    source: 'profile',
  }));
}

function richness(deal) {
  return (deal?.year ? 1 : 0) + (deal?.round ? 1 : 0) + (deal?.amount ? 1 : 0) + (deal?.invested_at ? 1 : 0);
}

function startupOk(startup) {
  if (!startup) return false;
  const name = String(startup.name || '').trim();
  if (name.length < 2 || name.length > 80) return false;
  if (String(startup.entity_gate || '').toLowerCase() === 'junk') return false;
  if (String(startup.status || '').toLowerCase() === 'rejected') return false;
  if (/\b(ventures?|capital|partners|fund)\b/i.test(name) && name.split(/\s+/).length <= 4) return false;
  return /[a-z]/i.test(name);
}

function dealsFromLedger({ investorId, participants, eventsById, startupsById }) {
  const id = String(investorId || '');
  const deals = [];
  const byCompany = new Map();
  for (const row of participants || []) {
    if (String(row.investor_id || '') !== id) continue;
    const role = String(row.participant_role || '').toLowerCase();
    if (role && !ACCEPTED_ROLES.has(role)) continue;
    const event = eventsById.get(String(row.funding_event_id || ''));
    if (!event || !TRUSTED_VERIFICATION.has(String(event.verification_status || '').toLowerCase())) continue;
    const startup = startupsById.get(String(event.startup_id || ''));
    if (!startupOk(startup)) continue;
    const company = String(startup.name).trim();
    const key = dealKey(company);
    if (!key) continue;
    const investedAt = event.announced_at || event.occurred_at || null;
    const deal = {
      company,
      year: yearFrom(investedAt),
      round: event.round_type ? String(event.round_type).trim() : null,
      amount: boundedAmount(event.amount_usd),
      invested_at: investedAt ? String(investedAt) : null,
      role: role || null,
      source: 'funding_ledger',
      event_id: event.id,
    };
    const existing = byCompany.get(key);
    if (!existing || richness(deal) > richness(existing) || (richness(deal) === richness(existing) && (deal.year || 0) > (existing.year || 0))) {
      byCompany.set(key, deal);
    }
  }
  return [...byCompany.values()];
}

function roundFromTitle(title) {
  const text = String(title || '');
  const series = text.match(/\bseries\s*([a-h])\b/i);
  if (series) return `Series ${series[1].toUpperCase()}`;
  if (/\bpre[- ]seed\b/i.test(text)) return 'Pre-Seed';
  if (/\bseed\b/i.test(text)) return 'Seed';
  return null;
}

function amountFromTitle(title, company) {
  const text = String(title || '');
  if (!company || !text.toLowerCase().includes(String(company).toLowerCase())) return null;
  const match = text.match(/\$\s*([\d,.]+)\s*(billion|bn|b|million|mm|m|thousand|k)\b/i);
  if (!match) return null;
  return boundedAmount(`${match[1]} ${match[2]}`);
}

const SKIP_SITE_HOST = /(?:^|\.)(?:squarespace|sqspcdn|typekit|googleapis|gstatic|google|twitter|x|linkedin|instagram|facebook|youtube|tiktok|mailto)\./i;
const PORTFOLIO_LABEL_NOISE = /untitled|logo|presentation|minimalist|screenshot|banner|favicon|website|picture|photo|image|icon|cover|slide|asset|\b(?:black|white|pic|img|default)\b/i;

function plausiblePortfolioLabel(raw) {
  const name = cleanCompany(raw);
  if (name.length < 2 || name.length > 40) return false;
  if (!/^[A-Z]/.test(name) || !/[a-z]/.test(name)) return false;
  if (/\b(?:linkedin|posts|mothership)\b/i.test(name)) return false;
  if (/[.]/.test(name)) return false;
  if (/^(?:kick|paid|owner|writer|village|group|team|home|about|news|blog|fund|portfolio)$/i.test(name)) return false;
  if (/\b(?:solution|solutions|driven|platform|fund|capital|ventures|partners|header|newest|home)\b/i.test(name)) return false;
  if (/^[A-Z]{2,3}\s/.test(name)) return false;
  if (PORTFOLIO_LABEL_NOISE.test(name)) return false;
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length > 3 || words.some((word) => word.length > 24)) return false;
  if (/\d/.test(name)) return false;
  if (/^[a-z]+(?:-[a-z]+){1,2}$/i.test(name)) return false;
  return true;
}

function dealsFromFirmSite(html, pageUrl, investor) {
  const deals = [];
  const seen = new Set();
  const firm = dealKey(investor?.firm || investor?.name);
  let pageHost = '';
  try { pageHost = new URL(pageUrl).hostname.toLowerCase().replace(/^www\./, ''); } catch { return []; }
  const re = /href="(https?:\/\/[^"]+)"[\s\S]{0,800}?\/([^\/"?#]+)\.(?:png|jpe?g|webp|gif)/gi;
  let match;
  while ((match = re.exec(String(html || '')))) {
    let host = '';
    try { host = new URL(match[1]).hostname.toLowerCase().replace(/^www\./, ''); } catch { continue; }
    if (!host || host === pageHost || host.endsWith(`.${pageHost}`) || SKIP_SITE_HOST.test(`.${host}`)) continue;
    const company = cleanCompany(decodeURIComponent(match[2]).replace(/\+/g, ' ').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim());
    const key = dealKey(company);
    if (!key || seen.has(key) || !plausiblePortfolioLabel(company)) continue;
    if (firm && firm.length >= 4 && (key.includes(firm) || firm.includes(key))) continue;
    seen.add(key);
    deals.push({
      company,
      year: null,
      round: null,
      amount: null,
      invested_at: null,
      role: null,
      source: 'firm_site',
      source_url: pageUrl,
    });
    if (deals.length >= 8) break;
  }
  return deals;
}

function cleanCompany(company) {
  return String(company || '').replace(/\s+[-–—]\s+[^–—-]{2,40}$/, '').trim();
}

function dealsFromEvidenceArticles(articles, investor) {
  const eligible = eligibleInvestorEvidenceArticles(articles, investor);
  const deals = [];
  const seen = new Set();
  const firm = dealKey(investor?.firm || investor?.name);
  for (const article of eligible) {
    const companies = extractPortfolioCompanies([article], investor);
    for (const rawCompany of companies) {
      const company = cleanCompany(rawCompany);
      const key = dealKey(company);
      if (!key || key === firm || seen.has(key) || !plausiblePortfolioLabel(company)) continue;
      seen.add(key);
      const investedAt = article.pubDate || article.published_at || null;
      deals.push({
        company,
        year: yearFrom(investedAt) || yearFrom(article.title),
        round: roundFromTitle(article.title),
        amount: amountFromTitle(article.title, company),
        invested_at: investedAt ? String(investedAt) : null,
        role: null,
        source: 'news',
        source_url: article.link || null,
      });
    }
  }
  return deals;
}

function mergeDeals(existing, incoming, limit = 8) {
  const cap = Math.min(Math.max(Number(limit) || 8, 1), 8);
  const map = new Map();
  for (const deal of [...(existing || []), ...(incoming || [])]) {
    const company = String(deal?.company || '').trim();
    const key = dealKey(company);
    if (!key) continue;
    const next = { ...deal, company };
    const prev = map.get(key);
    if (!prev || richness(next) > richness(prev) || (richness(next) === richness(prev) && (next.year || 0) > (prev.year || 0))) {
      map.set(key, next);
    }
  }
  return [...map.values()]
    .sort((a, b) => (b.year || 0) - (a.year || 0) || a.company.localeCompare(b.company))
    .slice(0, cap);
}

function latestInvestedAt(deals) {
  const stamps = (deals || [])
    .map((deal) => deal.invested_at)
    .filter(Boolean)
    .map((value) => ({ value, time: Date.parse(value) }))
    .filter((row) => Number.isFinite(row.time));
  stamps.sort((a, b) => b.time - a.time);
  return stamps[0]?.value || null;
}

function profilePatch(investor, incoming) {
  const existing = dealsFromProfile(investor);
  const merged = mergeDeals(existing, incoming);
  const before = existing.map((deal) => `${dealKey(deal.company)}|${deal.year || ''}|${deal.round || ''}|${deal.amount || ''}`).join('\n');
  const after = merged.map((deal) => `${dealKey(deal.company)}|${deal.year || ''}|${deal.round || ''}|${deal.amount || ''}`).join('\n');
  if (before === after) return null;
  const patch = {
    notable_investments: merged.map((deal) => ({
      company: deal.company,
      year: deal.year ?? null,
      round: deal.round ?? null,
      amount: deal.amount ?? null,
      source: deal.source || 'profile',
      ...(deal.event_id ? { event_id: deal.event_id } : {}),
      ...(deal.source_url ? { source_url: deal.source_url } : {}),
      ...(deal.role ? { role: deal.role } : {}),
    })),
  };
  if (!investor?.last_investment_date) {
    const latest = latestInvestedAt(merged);
    if (latest) {
      const parsed = Date.parse(latest);
      if (Number.isFinite(parsed)) {
        const dateObj = new Date(parsed);
        patch.last_investment_date = dateObj.toISOString().split('T')[0];
      }
    }
  }
  return patch;
}

function hasStoredDeals(investor) {
  return dealsFromProfile(investor).length > 0;
}

module.exports = {
  TRUSTED_VERIFICATION,
  dealsFromLedger,
  dealsFromEvidenceArticles,
  dealsFromFirmSite,
  dealsFromProfile,
  mergeDeals,
  profilePatch,
  hasStoredDeals,
};
