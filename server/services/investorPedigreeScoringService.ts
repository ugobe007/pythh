/**
 * INVESTOR PEDIGREE SCORING SERVICE
 * =====================================
 * Admin Approved: Feb 28, 2026
 *
 * Why this signal matters:
 *   When a known-quality investor or advisor joins a startup they are betting their
 *   own reputation and capital on the founders. That judgment is a REAL signal —
 *   not derived from ARR or headcount, but from humans who do pattern-matching for
 *   a living. We reward that conviction rather than ignoring it.
 *
 * Scoring approach:
 *   Tier 1 — Elite VCs (YC, Sequoia, a16z, Founders Fund, Benchmark, Tiger, Coatue …)
 *   Tier 2 — Top-20 VCs (Accel, General Catalyst, GV, First Round, Index, Bessemer …)
 *   Tier 3 — Any recognised VC / notable angel (Lightspeed, Khosla, Naval, Sam Altman …)
 *   Advisor tier — FAANG execs, unicorn founders, domain authorities
 *
 * Max bonus: +8 pts (avoids dominating the +10 total cap but still meaningfully lifts)
 * Stacking: tiers stack additively up to the cap, so T1 + notable angels > T1 alone
 */

export interface PedigreeResult {
  applied: boolean;
  bonus: number;                     // 0 – 8, integer
  tier: 'elite' | 'top' | 'notable' | 'advisor_only' | 'none';
  matchedInvestors: string[];        // which names triggered the score
  matchedAdvisors: string[];
  explanation: string;
}

// ============================================================================
// PEDIGREE LISTS
// ============================================================================

const TIER_1_INVESTORS: string[] = [
  // Top-Tier VC Funds
  'y combinator', 'yc',
  'sequoia', 'sequoia capital',
  'andreessen horowitz', 'a16z',
  'founders fund',
  'benchmark capital', 'benchmark',
  'tiger global', 'tiger',
  'coatue', 'coatue management',
  'softbank', 'softbank vision fund',
  'khosla ventures', 'khosla',
  'greylock', 'greylock partners',
  'index ventures',
  'general atlantic',
  'lightspeed venture partners', 'lightspeed',
  'insight partners', 'insight venture',
  'dragoneer',
  'greenoaks',
  // Notable accelerators / pre-seed super-funds
  'pioneer', // Pioneer.app
  'neo',     // Neo accelerator
  'soma capital',
];

const TIER_2_INVESTORS: string[] = [
  'accel', 'accel partners',
  'general catalyst',
  'gv', 'google ventures',
  'first round', 'first round capital',
  'bessemer', 'bessemer venture',
  'spark capital',
  'union square ventures', 'usv',
  'felicis', 'felicis ventures',
  'battery ventures', 'battery',
  'bain capital ventures',
  'itp', 'itp capital',
  'balderton', 'balderton capital',
  'atomico',
  'true ventures',
  'founders circle',
  'initialized capital', 'initialized',
  'pear vc', 'pear',
  'floodgate',
  'amplify partners', 'amplify',
  'village global',
  'hustle fund',
  'mv1', // mv1 capital
  'a capital',
  'defy',
  'nextview',
  'preface ventures',
  'gradient ventures',
  'salesforce ventures',
  'microsoft ventures', 'm12',
  'intel capital',
  'qualcomm ventures',
  'comcast ventures',
  'corporate vc',
];

const TIER_3_NOTABLE_ANGELS: string[] = [
  // Super-angels & notable individual investors
  'naval ravikant', 'naval',
  'sam altman',
  'paul graham',
  'ron conway', 'sv angel',
  'jason calacanis',
  'chamath palihapitiya', 'chamath',
  'elad gil',
  'sahil lavingia',
  'balaji srinivasan', 'balaji',
  'alexis ohanian',
  'chris sacca',
  'kevin systrom',
  'stewart butterfield',
  'jack dorsey',
  'elon musk',
  'marc benioff',
  // Bootstrapped-to-billions / unicorn alumni angels
  'stripe', 'patrick collison', 'john collison',
  'coinbase', 'brian armstrong',
  'shopify', 'tobi lütke',
  'airbnb', 'brian chesky',
  'notion',
  'figma', 'dylan field',
  'vercel',
  'rippling', 'parker conrad',
  // Syndicate / AngelList legends
  'angellist',
  'republic',
  'product hunt',
];

const NOTABLE_ADVISOR_SIGNALS: string[] = [
  // Titles that indicate advisory pedigree (matched against advisor bios)
  'ex-google', 'ex-facebook', 'ex-amazon', 'ex-apple', 'ex-microsoft',
  'former google', 'former facebook', 'former apple', 'former amazon',
  'former cto', 'former ceo', 'former vp',
  'ex-cto', 'ex-ceo', 'ex-vp',
  'y combinator alumni', 'yc alumni',
  'unicorn', 'founded', // "founded X" implies serial founder
  'co-founder',
  'mit', 'stanford', 'harvard', // elite academic pedigree for technical advisors
  'phd',
  'techcrunch', 'forbes 30 under 30',
];

// ============================================================================
// HELPERS
// ============================================================================

function toLower(v: unknown): string {
  if (!v) return '';
  return String(v).toLowerCase();
}

function matchesAny(text: string, patterns: string[]): string[] {
  return patterns.filter(p => text.includes(p));
}

function extractInvestorStrings(startup: any): string[] {
  const raw: unknown[] = [];

  // Direct columns (actual DB column names)
  if (typeof startup.lead_investor === 'string') raw.push(startup.lead_investor);
  if (Array.isArray(startup.lead_investor)) raw.push(...startup.lead_investor);
  if (typeof startup.followon_investors === 'string') raw.push(startup.followon_investors);
  if (Array.isArray(startup.followon_investors)) raw.push(...startup.followon_investors);

  // Legacy / alternate column names
  if (Array.isArray(startup.backed_by)) raw.push(...startup.backed_by);
  if (typeof startup.backed_by === 'string') raw.push(startup.backed_by);

  if (Array.isArray(startup.investors_mentioned)) raw.push(...startup.investors_mentioned);

  // extracted_data / JSONB blob
  const ex = startup.extracted_data || {};
  if (Array.isArray(ex.investors)) raw.push(...ex.investors);
  if (Array.isArray(ex.key_investors)) raw.push(...ex.key_investors);
  if (typeof ex.investors === 'string') raw.push(ex.investors);
  if (typeof ex.backers === 'string') raw.push(ex.backers);
  if (Array.isArray(ex.backers)) raw.push(...ex.backers);
  if (typeof ex.funded_by === 'string') raw.push(ex.funded_by);
  if (Array.isArray(ex.funded_by)) raw.push(...ex.funded_by);

  // Fallback: look in pitch / description text for common phrasing
  const pitch = toLower(startup.pitch || startup.description || ex.pitch || ex.description || '');
  if (pitch.includes('backed by') || pitch.includes('funded by') || pitch.includes('investor')) {
    raw.push(pitch); // Use full text — matchesAny will pick out specific names
  }

  return raw.map(toLower).filter(Boolean);
}

function extractAdvisorStrings(startup: any): string[] {
  const raw: unknown[] = [];

  const ex = startup.extracted_data || {};
  if (Array.isArray(startup.advisors)) {
    startup.advisors.forEach((a: any) => {
      if (typeof a === 'string') raw.push(a);
      else if (a && typeof a === 'object') {
        raw.push(a.name || '', a.role || '', a.bio || '', a.company || '');
      }
    });
  }
  if (Array.isArray(ex.advisors)) {
    ex.advisors.forEach((a: any) => {
      if (typeof a === 'string') raw.push(a);
      else if (a && typeof a === 'object') {
        raw.push(a.name || '', a.role || '', a.bio || '', a.company || '');
      }
    });
  }

  return raw.map(toLower).filter(Boolean);
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

export function calculateInvestorPedigreeBonus(startup: any): PedigreeResult {
  const investorTexts = extractInvestorStrings(startup);
  const advisorTexts = extractAdvisorStrings(startup);

  const combinedInvestorText = investorTexts.join(' ');
  const combinedAdvisorText = advisorTexts.join(' ');

  // Match per tier
  const t1Hits = matchesAny(combinedInvestorText, TIER_1_INVESTORS);
  const t2Hits = matchesAny(combinedInvestorText, TIER_2_INVESTORS);
  const t3Hits = matchesAny(combinedInvestorText, TIER_3_NOTABLE_ANGELS);
  const advisorHits = matchesAny(combinedAdvisorText, NOTABLE_ADVISOR_SIGNALS);

  // Dedup display names (keep longest matching string when a prefix matches)
  const matchedInvestors = Array.from(new Set([...t1Hits, ...t2Hits, ...t3Hits]));
  const matchedAdvisors = Array.from(new Set(advisorHits));

  // Assign raw bonus points
  let rawBonus = 0;

  // Tier 1 VC — single T1 is a huge validation signal
  if (t1Hits.length >= 2) rawBonus += 8;       // e.g. YC + Sequoia
  else if (t1Hits.length === 1) rawBonus += 6;  // e.g. YC alone

  // Tier 2 VC — supplements or stands alone
  if (t2Hits.length >= 2) rawBonus += Math.min(rawBonus > 0 ? 2 : 5, 5);
  else if (t2Hits.length === 1) rawBonus += Math.min(rawBonus > 0 ? 1 : 4, 4);

  // Notable angels — vote-of-confidence from individuals
  if (t3Hits.length >= 2) rawBonus += Math.min(rawBonus > 0 ? 2 : 3, 3);
  else if (t3Hits.length === 1) rawBonus += Math.min(rawBonus > 0 ? 1 : 2, 2);

  // Advisor pedigree — softer signal but still meaningful
  if (advisorHits.length >= 3) rawBonus += Math.min(rawBonus > 0 ? 1 : 2, 2);
  else if (advisorHits.length >= 1) rawBonus += Math.min(rawBonus > 0 ? 0.5 : 1, 1);

  // Hard cap at 8 (leaves headroom for other bonuses up to the +10 total cap)
  const bonus = Math.min(Math.round(rawBonus), 8);

  if (bonus === 0 && matchedInvestors.length === 0 && matchedAdvisors.length === 0) {
    return {
      applied: false,
      bonus: 0,
      tier: 'none',
      matchedInvestors: [],
      matchedAdvisors: [],
      explanation: 'No identifiable investor or advisor pedigree found',
    };
  }

  // Determine tier label
  let tier: PedigreeResult['tier'] = 'none';
  if (t1Hits.length > 0) tier = 'elite';
  else if (t2Hits.length > 0) tier = 'top';
  else if (t3Hits.length > 0) tier = 'notable';
  else if (advisorHits.length > 0) tier = 'advisor_only';

  const explanation = [
    tier === 'elite' ? `Elite VC backing (${t1Hits.slice(0, 3).join(', ')})` : '',
    tier === 'top' ? `Top-tier VC backing (${t2Hits.slice(0, 3).join(', ')})` : '',
    t3Hits.length > 0 ? `Notable angel(s): ${t3Hits.slice(0, 2).join(', ')}` : '',
    advisorHits.length > 0 ? `High-pedigree advisors (${advisorHits.slice(0, 2).join(', ')})` : '',
  ].filter(Boolean).join(' · ');

  return {
    applied: bonus > 0,
    bonus,
    tier,
    matchedInvestors,
    matchedAdvisors,
    explanation: explanation || 'Investor/advisor confidence signal detected',
  };
}
