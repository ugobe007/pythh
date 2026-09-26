'use strict';

/**
 * Rank investors by how specific they are to this startup.
 * Prestige and "busiest fund" pace must not make every company share a top five.
 */

const GENERIC_SECTORS = new Set([
  'technology',
  'tech',
  'software',
  'internet',
  'saas',
  'b2b',
  'enterprise',
  'ai',
  'ai/ml',
  'artificial intelligence',
  'machine learning',
]);

function sectorList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').toLowerCase().trim()).filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    return value.split(/[,|/]/).map((item) => item.trim().toLowerCase()).filter(Boolean);
  }
  return [];
}

function startupText(startup) {
  const extracted = startup?.extracted_data && typeof startup.extracted_data === 'object'
    ? startup.extracted_data
    : {};
  return [
    startup?.name,
    startup?.tagline,
    startup?.description,
    startup?.pitch,
    extracted.description,
    extracted.product_description,
    extracted.value_proposition,
  ].filter(Boolean).join(' ').toLowerCase();
}

function thesisOverlap(startup, investor) {
  const thesis = String(investor?.investment_thesis || '').toLowerCase();
  if (thesis.length < 12) return 0;
  const words = startupText(startup).split(/[^a-z0-9]+/).filter((word) => word.length > 4);
  let hits = 0;
  const seen = new Set();
  for (const word of words) {
    if (seen.has(word)) continue;
    seen.add(word);
    if (thesis.includes(word)) hits += 1;
    if (hits >= 5) break;
  }
  return hits * 4;
}

/**
 * Higher means this investor is a closer fit for this startup than a generalist leaderboard name.
 * @param {object} startup
 * @param {object} investor
 */
function distinctiveFitScore(startup, investor) {
  if (!investor) return 0;
  const startupSecs = sectorList(startup?.sectors);
  const invSecs = sectorList(investor?.sectors);
  const direct = startupSecs.filter((sector) => invSecs.includes(sector));
  const specific = direct.filter((sector) => !GENERIC_SECTORS.has(sector));
  const breadth = Math.max(invSecs.length, 1);
  let score = 0;

  if (specific.length) {
    score += specific.length * 32 + (specific.length / breadth) * 40;
  } else if (direct.length) {
    score += 6 + (direct.length / breadth) * 8;
  } else if (startupSecs.length && invSecs.length) {
    try {
      const { calculateSectorMatchScore } = require('../server/lib/sectorTaxonomy');
      const related = calculateSectorMatchScore(startupSecs, invSecs, true);
      if (related && related.score > 0) score += Math.min(10, (related.score || 0) / 4);
    } catch {
      /* taxonomy optional */
    }
  }

  try {
    const { calculateStageInvestorFitAdjustment } = require('./stageInvestorFit');
    score += calculateStageInvestorFitAdjustment(startup, investor).delta || 0;
  } catch {
    /* stage optional */
  }

  score += thesisOverlap(startup, investor);
  score += Math.min(2, (Number(investor.investor_score) || 0) / 50);
  return Math.round(score * 10) / 10;
}

const TEXT_SECTOR_HINTS = [
  [/\brobot(s|ics)?\b|\bautonomous\b|\bdrones?\b/, 'Robotics'],
  [/\bpayments?\b|\bfintech\b|\bneobank\b|\bbanking\b|\binsurtech\b/, 'FinTech'],
  [/\bhealthcare\b|\bhealthtech\b|\bmedtech\b|\bmedical\b|\bbiotech\b/, 'HealthTech'],
  [/\bcybersecurity\b|\binfosec\b/, 'Cybersecurity'],
  [/\bcleantech\b|\bclimate tech\b/, 'CleanTech'],
  [/\bdevtools\b|\bdeveloper tools\b/, 'DevTools'],
];

function sectorsFromText(startup) {
  const text = startupText(startup);
  const found = [];
  for (const [pattern, label] of TEXT_SECTOR_HINTS) {
    if (pattern.test(text)) found.push(label);
  }
  return found;
}

/** Prefer a specific stored sector. Generic-only tags fall back to the company name, site, and description. */
function sectorsForMatching(startup) {
  const raw = Array.isArray(startup?.sectors)
    ? startup.sectors.map((item) => String(item || '').trim()).filter(Boolean)
    : sectorList(startup?.sectors);
  const specific = raw.filter((sector) => !GENERIC_SECTORS.has(String(sector).toLowerCase()));
  if (specific.length) return raw;
  let inferred = [];
  try {
    const { inferSectorsFromIdentity } = require('./inference-extractor');
    inferred = inferSectorsFromIdentity(
      startup?.website || startup?.url || '',
      startup?.name || '',
      startupText(startup),
    );
  } catch {
    inferred = [];
  }
  const merged = [...new Set([...inferred, ...sectorsFromText(startup)])]
    .filter((sector) => !GENERIC_SECTORS.has(String(sector).toLowerCase()));
  if (merged.length) return merged.slice(0, 3);
  return raw;
}

function rankValue(row) {
  const fit = Number(row?.fit_rank);
  if (Number.isFinite(fit)) return fit;
  return Number(row?.match_score ?? row?.result?.score) || 0;
}

module.exports = {
  GENERIC_SECTORS,
  distinctiveFitScore,
  rankValue,
  sectorList,
  sectorsForMatching,
};
