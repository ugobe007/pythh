'use strict';

/**
 * Public-safe recent deals from investor.notable_investments / portfolio_companies.
 * Never invent amounts. Never include emails or contact fields.
 */

function yearFrom(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const year = Math.round(value);
    return year >= 1990 && year <= 2100 ? year : null;
  }
  const text = String(value);
  const match = text.match(/\b(19|20)\d{2}\b/);
  if (!match) return null;
  return Number(match[0]);
}

function parseAmount(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  const text = String(value).trim();
  const match = text.match(/\$?\s*([\d,.]+)\s*(billion|bn|b|million|mm|m|thousand|k)?/i);
  if (!match) return null;
  const raw = Number(String(match[1]).replace(/,/g, ''));
  if (!Number.isFinite(raw) || raw <= 0) return null;
  const unit = String(match[2] || '').toLowerCase();
  if (unit === 'billion' || unit === 'bn' || unit === 'b') return raw * 1_000_000_000;
  if (unit === 'million' || unit === 'mm' || unit === 'm') return raw * 1_000_000;
  if (unit === 'thousand' || unit === 'k') return raw * 1_000;
  return raw;
}

function companyFromItem(item) {
  if (item == null) return null;
  if (typeof item === 'string') return item.trim() || null;
  if (typeof item !== 'object') return null;
  const name = item.company || item.name || item.startup || item.portfolio_company || item.firm;
  return name != null && String(name).trim() ? String(name).trim() : null;
}

function normalizeList(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') {
    if (Array.isArray(raw.deals)) return raw.deals;
    if (Array.isArray(raw.investments)) return raw.investments;
    if (Array.isArray(raw.companies)) return raw.companies;
    return [];
  }
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return normalizeList(parsed);
  } catch {
    return raw.split(/[,;|]\s*/).map((part) => part.trim()).filter(Boolean);
  }
}

function shapeRecentDeals(investor, limit = 5) {
  const cap = Math.min(Math.max(Number(limit) || 5, 1), 8);
  const deals = [];
  const seen = new Set();

  const push = (deal) => {
    const company = String(deal.company || '').trim();
    if (!company) return;
    const key = company.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    deals.push({
      company,
      year: deal.year ?? null,
      round: deal.round ?? null,
      amount: deal.amount ?? null,
    });
  };

  for (const item of normalizeList(investor?.notable_investments)) {
    if (deals.length >= cap) break;
    const company = companyFromItem(item);
    if (!company) continue;
    if (typeof item === 'string') {
      push({ company, year: yearFrom(item), round: null, amount: null });
      continue;
    }
    push({
      company,
      year: yearFrom(item.year || item.date || item.announced_at || item.invested_at),
      round: item.round || item.stage || item.funding_round || item.series || null,
      amount: parseAmount(item.amount || item.amount_usd || item.raise || item.check_size),
    });
  }

  for (const name of Array.isArray(investor?.portfolio_companies) ? investor.portfolio_companies : []) {
    if (deals.length >= cap) break;
    push({ company: name, year: null, round: null, amount: null });
  }

  return deals;
}

function investorHasContact(investor) {
  if (!investor || typeof investor !== 'object') return false;
  const { isBlockedOutreachEmail } = require('./investorEmailInfer');
  
  const isDeliverable = (value) => {
    if (typeof value !== 'string' || !value.includes('@') || value.length <= 5) return false;
    return !isBlockedOutreachEmail(value);
  };
  
  const status = investor.email_status;
  if (status === 'bounced' || status === 'unreachable') return false;
  
  if (investor.email_has_mx === false) return false;
  
  if (isDeliverable(investor.email)) return true;
  if (isDeliverable(investor.email_best_guess)) return true;
  
  const candidates = Array.isArray(investor.email_candidates) ? investor.email_candidates : [];
  return candidates.some((entry) => {
    const address = typeof entry === 'string' ? entry : (entry?.address || entry?.email);
    return isDeliverable(address);
  });
}

function resolveInvestorEmail(investor) {
  if (!investor || typeof investor !== 'object') return null;
  const { isBlockedOutreachEmail } = require('./investorEmailInfer');
  
  const isDeliverable = (value) => {
    if (typeof value !== 'string' || !value.includes('@') || value.length <= 5) return false;
    return !isBlockedOutreachEmail(value);
  };
  
  const status = investor.email_status;
  if (status === 'bounced' || status === 'unreachable') return null;
  
  if (investor.email_has_mx === false) return null;
  
  if (isDeliverable(investor.email)) return { address: investor.email.trim(), type: 'verified' };
  if (isDeliverable(investor.email_best_guess)) {
    return { address: investor.email_best_guess.trim(), type: investor.email_status || 'inferred' };
  }
  const candidates = Array.isArray(investor.email_candidates) ? investor.email_candidates : [];
  for (const entry of candidates) {
    const address = typeof entry === 'string' ? entry : entry?.address || entry?.email;
    if (isDeliverable(address)) {
      return { address: String(address).trim(), type: entry?.type || 'inferred' };
    }
  }
  return null;
}

module.exports = {
  yearFrom,
  parseAmount,
  shapeRecentDeals,
  investorHasContact,
  resolveInvestorEmail,
};
