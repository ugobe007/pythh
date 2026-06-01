'use strict';

/**
 * Detect VC partners, angel-sidecar investors, and micro-VC / small-firm GPs
 * suitable for early-stage founder outreach.
 */

const JUNK_NAME_RE =
  /teamview|from our team|startup lessons|specialists eirs|member resources|partnermichael|senior \(|\(bvp\)|\(nea\)|\(a16z\)|general \(|\bmanaging\b/i;

const ORG_NAME_RE =
  /\b(ventures?|capital|partners?|associates|fund|group|holdings|investments?|vc)\b/i;

const PARTNER_TITLE_RE =
  /\b(partner|general partner|managing director|principal|gp|investor)\b/i;

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function isJunkInvestorName(name) {
  const n = String(name || '').trim();
  if (!n || n.length < 3) return true;
  if (n.length > 55) return true;
  if (JUNK_NAME_RE.test(n)) return true;
  if (/^[a-z]/.test(n) && !n.includes(' ')) return true;
  if (!/\s/.test(n) && n.length > 18) return true;
  return false;
}

/**
 * Heuristic: "First Last" or "First Last (Firm)" — not a fund brand string.
 */
function looksLikePersonName(name) {
  const n = String(name || '').trim();
  if (!n || isJunkInvestorName(n)) return false;

  const withoutParen = n.replace(/\([^)]*\)/g, '').trim();
  const parts = withoutParen.split(/\s+/).filter(Boolean);
  if (parts.length < 2 || parts.length > 5) return false;

  if (ORG_NAME_RE.test(withoutParen) && !/\([^)]+\)/.test(n)) return false;

  const alphaParts = parts.filter((p) => /^[A-Za-z][A-Za-z.'-]*$/.test(p));
  return alphaParts.length >= 2;
}

/**
 * @param {object} investor
 * @returns {{ isPartnerAngel: boolean, score: number, signals: string[] }}
 */
function scorePartnerAngelInvestor(investor = {}) {
  const signals = [];
  let score = 0;

  const name = investor.name || '';
  const firm = investor.firm || '';
  if (isJunkInvestorName(name)) {
    return { isPartnerAngel: false, score: 0, signals: ['junk_name'] };
  }

  const personLike = looksLikePersonName(name);
  const nameNorm = norm(name);
  const firmNorm = norm(firm);
  const atFirm = firmNorm && nameNorm !== firmNorm;

  if (investor.is_individual === true) {
    score += 2;
    signals.push('is_individual');
  }
  if (personLike) {
    score += 2;
    signals.push('person_name');
  }
  if (atFirm && personLike) {
    score += 3;
    signals.push('person_at_firm');
  }

  const title = String(investor.title || '');
  if (PARTNER_TITLE_RE.test(title)) {
    score += 2;
    signals.push('partner_title');
  }

  const maxCheck = Number(investor.check_size_max) || 0;
  const minCheck = Number(investor.check_size_min) || 0;
  if (maxCheck > 0 && maxCheck <= 1_000_000) {
    score += 3;
    signals.push('check_under_1m');
  } else if (maxCheck > 0 && maxCheck <= 3_000_000) {
    score += 2;
    signals.push('check_under_3m');
  } else if (maxCheck > 0 && maxCheck <= 5_000_000) {
    score += 1;
    signals.push('check_under_5m');
  }

  const capitalType = norm(investor.capital_type);
  if (capitalType.includes('micro') || capitalType.includes('angel') || capitalType.includes('scout')) {
    score += 3;
    signals.push('micro_or_angel_capital');
  }

  const type = norm(investor.type);
  if (type.includes('angel')) {
    score += 2;
    signals.push('angel_type');
  }

  const stages = Array.isArray(investor.stage) ? investor.stage : investor.stage ? [investor.stage] : [];
  const earlyStage = stages.some((s) => /pre.?seed|seed|angel|early/i.test(String(s)));
  if (earlyStage) {
    score += 1;
    signals.push('early_stage_focus');
  }

  // Small solo GP shop (firm name ~= person or micro fund)
  if (atFirm && maxCheck > 0 && maxCheck <= 5_000_000 && !personLike && !ORG_NAME_RE.test(name)) {
    score += 1;
    signals.push('small_firm');
  }

  // Down-rank mega-fund partner pages mis-tagged as individuals
  if (maxCheck >= 20_000_000) {
    score -= 2;
    signals.push('large_check_cap');
  }
  if (maxCheck >= 50_000_000) {
    score -= 3;
    signals.push('mega_fund_check');
  }
  if (!personLike && nameNorm === firmNorm && maxCheck >= 10_000_000) {
    score -= 4;
    signals.push('firm_only_mega');
  }

  return {
    isPartnerAngel: score >= 5,
    score,
    signals,
  };
}

function isPartnerAngelInvestor(investor) {
  return scorePartnerAngelInvestor(investor).isPartnerAngel;
}

/** Supabase prefilter — individuals + partner titles + micro capital */
function buildPartnerAngelDbOrFilter() {
  return [
    'is_individual.eq.true',
    'title.ilike.%partner%',
    'title.ilike.%general partner%',
    'title.ilike.%managing director%',
    'capital_type.ilike.%micro%',
    'capital_type.ilike.%angel%',
    'type.ilike.%angel%',
  ].join(',');
}

module.exports = {
  isJunkInvestorName,
  looksLikePersonName,
  scorePartnerAngelInvestor,
  isPartnerAngelInvestor,
  buildPartnerAngelDbOrFilter,
};
