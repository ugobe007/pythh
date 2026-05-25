'use strict';
/**
 * Shared match scoring for outreach-agent — same 6-component model as instantSubmit.
 */

const { calculateSectorMatchScore, SECTOR_SYNONYMS } = require('../server/lib/sectorTaxonomy');

const MATCH_CONFIG = {
  SECTOR_MATCH: 40,
  STAGE_MATCH: 20,
  INVESTOR_QUALITY: 20,
  STARTUP_QUALITY: 25,
  SIGNAL_BONUS: 10,
  FAITH_ALIGNMENT: 15,
  SUPER_MATCH_THRESHOLD: 12,
  PERSISTENCE_FLOOR: 30,
};

const STAGE_MAP = {
  0: 'Pre-Seed', 1: 'Seed', 2: 'Series A', 3: 'Series B', 4: 'Series C', 5: 'Growth',
};

function normToken(s) {
  if (s == null) return null;
  return String(s).toLowerCase().trim().replace(/\s+/g, ' ');
}

function normTokenList(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(normToken).filter(Boolean);
}

function normalizeStartupForScoring(s) {
  const sectors = normTokenList(s.sectors);
  const stage = typeof s.stage === 'number' ? STAGE_MAP[s.stage] : s.stage;
  return {
    id: s.id,
    name: s.name,
    sectors,
    stage: normToken(stage),
    godScore: Number.isFinite(Number(s.total_god_score)) ? Number(s.total_god_score) : null,
  };
}

function normalizeInvestorForScoring(i) {
  const sectors = normTokenList(i.sectors);
  const stagesRaw = Array.isArray(i.stage) ? i.stage : i.stage ? [i.stage] : [];
  const stages = stagesRaw
    .map((x) => (typeof x === 'number' ? STAGE_MAP[x] : x))
    .map(normToken)
    .filter(Boolean);
  return {
    id: i.id,
    name: i.name,
    sectors,
    stages,
    score: Number.isFinite(Number(i.investor_score)) ? Number(i.investor_score) : null,
    tier: normToken(i.investor_tier),
  };
}

function scoreSectorMatch(startupSectors, investorSectors) {
  if (!startupSectors?.length || !investorSectors?.length) return 5;
  const result = calculateSectorMatchScore(startupSectors, investorSectors, true);
  return result.score > 0 ? result.score : 0;
}

function scoreStageMatch(startupStage, investorStages) {
  const s = normToken(startupStage);
  const iStages = Array.isArray(investorStages) ? investorStages.map(normToken).filter(Boolean) : [];
  if (!s || !iStages.length) return 5;
  const sNorm = s.replace(/[-_\s]/g, '');
  const iNorms = iStages.map((x) => x.replace(/[-_\s]/g, ''));
  if (iNorms.some((is) => is === sNorm || is.includes(sNorm) || sNorm.includes(is))) {
    return MATCH_CONFIG.STAGE_MATCH;
  }
  return 5;
}

function scoreInvestorQuality(score, tier) {
  const baseScore = (score || 50) / 5;
  const tierBonus = { elite: 5, strong: 3, solid: 1, emerging: 0 }[tier] || 0;
  return Math.min(baseScore + tierBonus, MATCH_CONFIG.INVESTOR_QUALITY);
}

function scoreStartupQuality(godScore) {
  if (!godScore || godScore < 40) return 8;
  const normalized = Math.max(0, (godScore - 40) / 60);
  return Math.round(10 + normalized * 15);
}

const THEME_TO_SECTOR = {};
for (const [canonical, synonyms] of Object.entries(SECTOR_SYNONYMS)) {
  for (const syn of synonyms) THEME_TO_SECTOR[syn] = canonical;
  THEME_TO_SECTOR[canonical.toLowerCase()] = canonical;
}
Object.assign(THEME_TO_SECTOR, {
  'climate tech': 'CleanTech',
  'climate adaptation': 'CleanTech',
  'clean energy': 'CleanTech',
  'rare diseases': 'Biotech',
  'life sciences': 'Biotech',
  'biotechnology': 'Biotech',
  'developer tools': 'Developer Tools',
  defense: 'Defense',
  security: 'Cybersecurity',
  blockchain: 'Crypto/Web3',
  consumer: 'Consumer',
  education: 'EdTech',
  automation: 'Robotics',
  platforms: 'Infrastructure',
  technology: 'Technology',
  digital: 'Technology',
  'information technology': 'Technology',
  mobility: 'Mobility',
  logistics: 'Mobility',
  transportation: 'Mobility',
  food: 'FoodTech',
  'food and agriculture': 'AgTech',
  'food & agriculture': 'AgTech',
  'enterprise it': 'Enterprise',
  'enterprise saas': 'Enterprise',
  'health it': 'HealthTech',
  'health information technology': 'HealthTech',
  'cloud computing': 'Infrastructure',
  telecom: 'Infrastructure',
});

function resolveThemeToSector(theme) {
  if (!theme) return null;
  const lower = theme.toLowerCase().trim();
  if (THEME_TO_SECTOR[lower]) return THEME_TO_SECTOR[lower];
  for (const [syn, canonical] of Object.entries(THEME_TO_SECTOR)) {
    if (lower.includes(syn) || syn.includes(lower)) return canonical;
  }
  return null;
}

function scoreFaithAlignment(startupSectors, investorSignals) {
  if (!investorSignals?.top_themes?.length || !startupSectors?.length) {
    return { score: 0, matchingThemes: [], isSuperMatch: false };
  }
  const resolvedSectors = new Set();
  for (const t of investorSignals.top_themes) {
    const sector = resolveThemeToSector(t);
    if (sector) resolvedSectors.add(sector.toLowerCase());
  }
  if (resolvedSectors.size === 0) return { score: 0, matchingThemes: [], isSuperMatch: false };

  const startupNorm = startupSectors.map((s) => s.toLowerCase().trim());
  const matchingThemes = [];
  for (const faithSector of resolvedSectors) {
    for (const startupSec of startupNorm) {
      const result = calculateSectorMatchScore([startupSec], [faithSector], false);
      if (result.score > 0 || faithSector.includes(startupSec) || startupSec.includes(faithSector)) {
        matchingThemes.push(faithSector);
        break;
      }
    }
  }
  if (matchingThemes.length === 0) return { score: 0, matchingThemes: [], isSuperMatch: false };

  const conviction = parseFloat(investorSignals.avg_conviction) || 0.7;
  let score = 0;
  if (matchingThemes.length >= 3) score = conviction >= 0.85 ? 15 : conviction >= 0.7 ? 12 : 10;
  else if (matchingThemes.length === 2) score = conviction >= 0.85 ? 10 : conviction >= 0.7 ? 8 : 7;
  else score = conviction >= 0.85 ? 7 : conviction >= 0.7 ? 5 : 3;
  score = Math.min(score, MATCH_CONFIG.FAITH_ALIGNMENT);
  return { score, matchingThemes, isSuperMatch: score >= MATCH_CONFIG.SUPER_MATCH_THRESHOLD };
}

function calculateMatchScore(startup, investor, signalScore, investorSignals) {
  const sNorm = normalizeStartupForScoring(startup);
  const iNorm = normalizeInvestorForScoring(investor);

  const sector = scoreSectorMatch(sNorm.sectors, iNorm.sectors);
  const stage = scoreStageMatch(sNorm.stage, iNorm.stages);
  const invQ = scoreInvestorQuality(iNorm.score, iNorm.tier);
  const startQ = scoreStartupQuality(sNorm.godScore);
  const signal = Math.round(signalScore || 0);
  const faith = scoreFaithAlignment(sNorm.sectors, investorSignals);

  const total = sector + stage + invQ + startQ + signal + faith.score;
  return {
    score: Math.min(total, 100),
    fitAnalysis: {
      sector,
      stage,
      investor_quality: invQ,
      startup_quality: startQ,
      signal,
      faith: faith.score,
      is_super_match: faith.isSuperMatch,
      faith_themes: faith.matchingThemes,
    },
    confidence: total >= 75 ? 'high' : total >= 55 ? 'medium' : 'low',
  };
}

function formatSectors(sectors) {
  if (!sectors) return 'their target sectors';
  if (Array.isArray(sectors)) return sectors.slice(0, 3).join(', ');
  return sectors;
}

function generateReasoning(startup, investor, fitAnalysis) {
  const reasons = [];
  if (fitAnalysis.sector >= 30) {
    reasons.push(`Sector alignment: ${investor.name || investor.firm} invests in ${formatSectors(startup.sectors)}`);
  } else if (fitAnalysis.sector >= 20) {
    reasons.push(`Sector overlap with ${startup.name || 'this startup'}'s market`);
  } else if (fitAnalysis.sector >= 10) {
    reasons.push('Adjacent sector signal detected');
  }
  if (fitAnalysis.stage >= 15) {
    reasons.push(`Stage fit: targets ${startup.stage || 'early'}-stage companies`);
  }
  if (fitAnalysis.investor_quality >= 18) reasons.push('Top-tier investor profile');
  else if (fitAnalysis.investor_quality >= 13) reasons.push('Established investor with relevant portfolio');
  if (fitAnalysis.startup_quality >= 22) {
    reasons.push(`Strong fundamentals (GOD ${startup.total_god_score || 'N/A'})`);
  } else if (fitAnalysis.startup_quality >= 18) {
    reasons.push('Solid startup metrics and team signals');
  }
  if (fitAnalysis.signal >= 8) reasons.push('High market momentum detected');
  else if (fitAnalysis.signal >= 5) reasons.push('Emerging momentum building');
  if (fitAnalysis.is_super_match) {
    const themes = fitAnalysis.faith_themes?.join(', ') || 'multiple areas';
    reasons.push(`Deep conviction in ${themes}`);
  } else if (fitAnalysis.faith >= 7) {
    reasons.push('Thesis conviction aligns');
  } else if (fitAnalysis.faith >= 3) {
    reasons.push('Early conviction signal');
  }
  return reasons.length > 0
    ? reasons.slice(0, 3).join('. ') + '.'
    : 'Algorithmic fit based on sector, stage, and quality signals.';
}

const { signalTotalFromGod } = require('./signalScoreGodBlend');

function rankStartupsForInvestor(investor, startups, { limit = 10, minScore = 30 } = {}) {
  const signal = signalTotalFromGod(null);
  const scored = [];

  for (const startup of startups) {
    try {
      const result = calculateMatchScore(startup, investor, signal, investor.signals || null);
      if (result.score >= minScore) {
        scored.push({
          startup,
          match_score: result.score,
          match_reason: generateReasoning(startup, investor, result.fitAnalysis),
          is_super_match: result.fitAnalysis.is_super_match,
          confidence: result.confidence,
          fitAnalysis: result.fitAnalysis,
        });
      }
    } catch {
      /* skip one startup */
    }
  }

  scored.sort((a, b) => b.match_score - a.match_score);
  return scored.slice(0, limit);
}

function rankInvestorsForStartup(startup, investors, { limit = 5, minScore = 30 } = {}) {
  const signal = signalTotalFromGod(startup.total_god_score);
  const scored = [];

  for (const investor of investors) {
    try {
      const result = calculateMatchScore(startup, investor, signal, investor.signals || null);
      if (result.score >= minScore) {
        scored.push({
          ...investor,
          match_score: result.score,
          match_reason: generateReasoning(startup, investor, result.fitAnalysis),
          is_super_match: result.fitAnalysis.is_super_match,
          confidence: result.confidence,
          fitAnalysis: result.fitAnalysis,
        });
      }
    } catch {
      /* skip one investor */
    }
  }

  scored.sort((a, b) => b.match_score - a.match_score);
  return scored.slice(0, limit);
}

module.exports = {
  calculateMatchScore,
  generateReasoning,
  rankStartupsForInvestor,
  rankInvestorsForStartup,
  signalTotalFromGod,
  MATCH_CONFIG,
};
