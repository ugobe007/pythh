'use strict';

/**
 * Proprietary technology + patent assessment for startup profiles.
 * Used to filter tech-VC mismatches (e.g. services firms matched to Khosla Ventures).
 */

const POSITIVE_PATTERNS = [
  { re: /\b(?:our\s+)?proprietary\s+(?:technology|tech|platform|algorithm|software|process|method|formula|system)\b/i, weight: 4, label: 'proprietary_claim' },
  { re: /\bpatent(?:ed|s)?\s+(?:pending|portfolio|protected|technology|application)\b/i, weight: 5, label: 'patent_claim' },
  { re: /\b(?:u\.?s\.?\s*)?patent\s*(?:no\.?|#|number)?\s*[\d,]+/i, weight: 5, label: 'patent_number' },
  { re: /\b(?:trade\s+secret|intellectual\s+property|ip\s+portfolio|defensible\s+moat|technical\s+moat)\b/i, weight: 4, label: 'ip_language' },
  { re: /\b(?:novel|patented|invented|breakthrough|first[-\s]of[-\s]its[-\s]kind)\s+(?:technology|approach|method|process|device|material|algorithm)\b/i, weight: 4, label: 'novel_technology' },
  { re: /\b(?:r\s*&\s*d|research\s+(?:lab|laboratory)|in[-\s]house\s+(?:engineering|research|science))\b/i, weight: 3, label: 'rd_investment' },
  { re: /\b(?:semiconductor|photonics|genomic|crispr|quantum|lidar|robotics|battery\s+chemistry|materials?\s+science)\b/i, weight: 2, label: 'hard_tech_domain' },
  { re: /\b(?:machine\s+learning\s+model|neural\s+network|foundation\s+model|custom\s+chip|asic|fpga)\b/i, weight: 3, label: 'technical_stack' },
];

const NEGATIVE_PATTERNS = [
  { re: /\b(?:provid(?:e|es|ing)|deliver(?:s|ing)?)\s+(?:consulting|engineering|design[-\s]build)\s+services\b/i, weight: 5, label: 'services_delivery' },
  { re: /\b(?:engineering\s+services|consulting\s+firm|professional\s+services|staffing\s+agency|systems?\s+integrator|reseller|value[-\s]added\s+reseller)\b/i, weight: 5, label: 'services_business' },
  { re: /\b(?:general\s+contractor|construction\s+services|civil\s+engineering\s+firm|mep\s+engineering|architectural\s+services|design[-\s]build\s+contractor)\b/i, weight: 5, label: 'engineering_services' },
  { re: /\b(?:implementation\s+partner|managed\s+services|outsourced|offshore\s+development\s+shop|body\s+shop)\b/i, weight: 4, label: 'implementation_shop' },
  { re: /\b(?:authorized\s+dealer|distributor|marketplace\s+only|white[-\s]label|resell(?:s|ing)?\s+(?:software|products))\b/i, weight: 4, label: 'reseller_model' },
  { re: /\b(?:open\s+source\s+only|no\s+proprietary|off[-\s]the[-\s]shelf|commodity\s+software)\b/i, weight: 4, label: 'no_proprietary_claim' },
];

const DEEP_TECH_VC_FIRM_HINTS = [
  'khosla',
  'lux capital',
  'dcvc',
  'data collective',
  'breakthrough energy',
  'playground global',
  'eclipse ventures',
  'the engine',
  'engine ventures',
  'material impact',
  'prime movers lab',
];

const DEEP_TECH_THESIS_RE = /\b(deep\s*tech|hard\s*tech|proprietary|patent|defensible\s+(?:ip|moat)|technical\s+differentiation|breakthrough\s+science|novel\s+technology|platform\s+science)\b/i;

/**
 * @param {string} text
 * @returns {{ positive: string[], negative: string[], score: number }}
 */
function extractProprietaryTechFromText(text) {
  if (!text || typeof text !== 'string') {
    return { positive: [], negative: [], score: 0 };
  }

  const sample = text.slice(0, 50000);
  const positive = [];
  const negative = [];
  let score = 0;

  for (const p of POSITIVE_PATTERNS) {
    if (p.re.test(sample)) {
      positive.push(p.label);
      score += p.weight;
    }
  }
  for (const p of NEGATIVE_PATTERNS) {
    if (p.re.test(sample)) {
      negative.push(p.label);
      score -= p.weight;
    }
  }

  return { positive: [...new Set(positive)], negative: [...new Set(negative)], score };
}

/**
 * @param {Array<{ signal?: string, evidence?: string, strength?: number }>} patentSignals
 * @returns {{ count: number, sources: string, domains: string[], evidence: string[] }}
 */
function summarizePatentSignals(patentSignals) {
  const signals = Array.isArray(patentSignals) ? patentSignals : [];
  const filed = signals.find((s) => s.signal === 'PATENT_FILED');
  const deep = signals.find((s) => s.signal === 'PATENT_DEEP_TECH');
  const momentum = signals.find((s) => s.signal === 'PATENT_MOMENTUM');

  let count = 0;
  if (filed?.evidence) {
    const m = filed.evidence.match(/(\d+)\s+patents?\s+found/i);
    if (m) count = parseInt(m[1], 10);
    else if (filed) count = 1;
  }

  const evidence = signals.map((s) => s.evidence).filter(Boolean);
  const domains = deep?.evidence
    ? deep.evidence.replace(/^Deep tech domains:\s*/i, '').split(',').map((d) => d.trim()).filter(Boolean)
    : [];

  return {
    count,
    sources: filed?.source || signals.map((s) => s.source).filter(Boolean).join(' ') || null,
    domains,
    momentum: Boolean(momentum),
    evidence,
    verified: count > 0,
  };
}

/**
 * @param {object} opts
 * @param {string} [opts.text]
 * @param {string} [opts.companyName]
 * @param {Array} [opts.patentSignals]
 * @param {object} [opts.existingProfile]
 * @returns {object} proprietary_tech_profile
 */
function assessProprietaryTech({ text = '', companyName = '', patentSignals = null, existingProfile = null } = {}) {
  const textScan = extractProprietaryTechFromText(text);
  const patent = patentSignals ? summarizePatentSignals(patentSignals) : summarizePatentSignals(existingProfile?.patent_signals || []);

  let score = textScan.score;
  if (patent.count >= 1) score += 6;
  if (patent.count >= 3) score += 4;
  if (patent.momentum) score += 2;
  if (patent.domains.length > 0) score += 3;

  const evidence = [
    ...textScan.positive.map((p) => `text:${p}`),
    ...patent.evidence.slice(0, 3),
  ];
  const negativeEvidence = textScan.negative.map((n) => `text:${n}`);

  let hasProprietaryTech = false;
  let confidence = 'none';

  if (patent.count >= 1) {
    hasProprietaryTech = true;
    confidence = patent.count >= 3 ? 'high' : 'medium';
  } else if (score >= 6 && textScan.negative.length === 0) {
    hasProprietaryTech = true;
    confidence = score >= 10 ? 'high' : 'medium';
  } else if (score >= 4 && textScan.negative.length <= 1) {
    hasProprietaryTech = true;
    confidence = 'low';
  } else if (textScan.negative.length >= 2 || score <= -4) {
    hasProprietaryTech = false;
    confidence = textScan.negative.length >= 2 ? 'high' : 'medium';
  } else if (score <= 0 && textScan.positive.length === 0) {
    hasProprietaryTech = false;
    confidence = patent.verified ? 'high' : 'low';
  }

  return {
    has_proprietary_tech: hasProprietaryTech,
    confidence,
    patent_count: patent.count,
    patent_verified: patent.verified,
    patent_sources: patent.sources,
    patent_domains: patent.domains,
    text_score: textScan.score,
    evidence: evidence.slice(0, 8),
    negative_evidence: negativeEvidence.slice(0, 6),
    tech_vc_fit_score: hasProprietaryTech
      ? Math.min(100, 55 + score * 3 + patent.count * 2)
      : Math.max(0, 35 + score * 4),
    assessed_at: new Date().toISOString(),
    company_name: companyName || null,
  };
}

function getStartupTechProfile(startup) {
  if (!startup) return assessProprietaryTech({});
  if (startup.proprietary_tech_profile) return startup.proprietary_tech_profile;
  const ed = startup.extracted_data || {};
  if (ed.proprietary_tech_profile) return ed.proprietary_tech_profile;

  const text = [
    startup.pitch,
    startup.description,
    startup.tagline,
    ed.value_proposition,
    ed.product_description,
    ed.solution,
  ].filter(Boolean).join('\n');

  return assessProprietaryTech({ text, companyName: startup.name });
}

/**
 * @param {object} investor
 * @param {object|null} investorSignals
 */
function investorRequiresProprietaryTech(investor, investorSignals) {
  const firm = String(investor?.firm || investor?.name || '').toLowerCase();
  const thesis = String(investor?.investment_thesis || '').toLowerCase();

  if (DEEP_TECH_VC_FIRM_HINTS.some((hint) => firm.includes(hint))) {
    return { required: true, reason: 'deep_tech_firm' };
  }

  const themes = (investorSignals?.top_themes || []).map((t) => String(t).toLowerCase());
  if (themes.some((t) => DEEP_TECH_THESIS_RE.test(t) || t.includes('deep tech') || t.includes('hard tech'))) {
    return { required: true, reason: 'deep_tech_theme' };
  }

  if (DEEP_TECH_THESIS_RE.test(thesis)) {
    return { required: true, reason: 'deep_tech_thesis' };
  }

  const rawSignals = investorSignals?.signals || investorSignals?.extracted_signals || [];
  if (Array.isArray(rawSignals) && rawSignals.some((s) => String(s).toLowerCase().includes('deep_tech'))) {
    return { required: true, reason: 'deep_tech_signal' };
  }

  return { required: false, reason: null };
}

/**
 * Apply tech-VC fit penalty to a match result object { score, fitAnalysis, confidence }.
 */
function applyTechVcMatchAdjustment(result, startup, investor, investorSignals) {
  const requirement = investorRequiresProprietaryTech(investor, investorSignals);
  if (!requirement.required) return result;

  const profile = getStartupTechProfile(startup);
  const fitAnalysis = { ...(result.fitAnalysis || {}), proprietary_tech: profile };

  if (profile.has_proprietary_tech) {
    fitAnalysis.tech_vc_fit = 'strong';
    return { ...result, fitAnalysis };
  }

  let penalty = 0;
  if (profile.confidence === 'high') penalty = 24;
  else if (profile.confidence === 'medium') penalty = 20;
  else penalty = 12;

  fitAnalysis.tech_vc_fit = 'weak';
  fitAnalysis.tech_vc_penalty = penalty;
  fitAnalysis.tech_vc_mismatch_reason = requirement.reason;
  fitAnalysis.is_super_match = false;

  let score = Math.max(0, result.score - penalty);
  if (profile.confidence === 'high' || profile.confidence === 'medium') {
    score = Math.min(score, 50);
  }

  const confidence = score >= 75 ? 'high' : score >= 55 ? 'medium' : 'low';
  return { score, fitAnalysis, confidence };
}

/**
 * @param {string} companyName
 * @param {number} [timeoutMs]
 */
async function fetchPatentEvidence(companyName, timeoutMs = 4000) {
  if (!companyName || String(companyName).trim().length < 2) return [];
  const { fetchPatentSignals } = require('../server/services/dataSources/patentSource');

  return Promise.race([
    fetchPatentSignals(String(companyName).trim()),
    new Promise((resolve) => setTimeout(() => resolve([]), timeoutMs)),
  ]).catch(() => []);
}

module.exports = {
  extractProprietaryTechFromText,
  summarizePatentSignals,
  assessProprietaryTech,
  getStartupTechProfile,
  investorRequiresProprietaryTech,
  applyTechVcMatchAdjustment,
  fetchPatentEvidence,
  DEEP_TECH_VC_FIRM_HINTS,
};
