'use strict';

/**
 * Ontological phrase registry — maps surface strings to semantic constructs.
 * Used by ontologicalInferenceEngine.js to tag word constructs before inference.
 */

/** @typedef {'object_frame'|'condition_frame'|'variable_frame'|'result_frame'|'association_frame'|'negation_frame'} ConstructType */

/** @type {Array<{ id: string, construct: ConstructType, re: RegExp, label: string, weight: number }>} */
const PHRASE_CONSTRUCTS = [
  // ── Object frames (who) ───────────────────────────────────────────────────
  { id: 'investment_directional', construct: 'object_frame', re: /\b(invests?\s+in|\bled\b|\bleads?\s+(?:a\s+)?(?:\$[\d.]+\s*[kmb]?\s+)?(?:seed|series|round|investment)\s+(?:in|for|into)\s+|backs?\s+(?:startup\s+)?)\b/i, label: 'investor→startup directional frame', weight: 0.92 },
  { id: 'self_funding', construct: 'object_frame', re: /\b(raises?|raised|secured|closes?|closed|announces?\s+(?:a\s+)?(?:\$[\d.]+\s*[kmb]?\s+)?(?:seed|series|round|financing))\b/i, label: 'startup self-funding frame', weight: 0.90 },
  { id: 'acquisition_directional', construct: 'object_frame', re: /\b(acquires?|acquired|buys?|bought|merges?\s+with)\b/i, label: 'M&A directional frame', weight: 0.88 },
  { id: 'actor_founder', construct: 'object_frame', re: /\b(we|our team|the founders?|i am|i'm)\b/i, label: 'founder actor frame', weight: 0.75 },
  { id: 'actor_investor', construct: 'object_frame', re: /\b(the fund|the vc|the investor|general partner|managing partner)\b/i, label: 'investor actor frame', weight: 0.80 },

  // ── Condition frames (verb + state) ───────────────────────────────────────
  { id: 'condition_hiring', construct: 'condition_frame', re: /\b(hir(es|ing|ed)|recruit(s|ing|ed)|appoint(ed|ing)|bring(ing)?\s+on)\b/i, label: 'hiring condition', weight: 0.85 },
  { id: 'condition_launch', construct: 'condition_frame', re: /\b(launch(es|ed|ing)|ship(s|ped|ping)|releas(es|ed|ing)|debut(ed|ing))\b/i, label: 'product launch condition', weight: 0.85 },
  { id: 'condition_distress', construct: 'condition_frame', re: /\b(lay(off|ing|offs)|restructur(ing|ed)|reduc(ing|ed)\s+(burn|spend)|rightsiz(ing|ed))\b/i, label: 'distress condition', weight: 0.90 },
  { id: 'condition_diligence', construct: 'condition_frame', re: /\b(data.?room|due diligence|vdr|advanc(ing|ed)\s+internally)\b/i, label: 'diligence condition', weight: 0.88 },
  { id: 'condition_exploratory', construct: 'condition_frame', re: /\b(explor(ing|ed)|consider(ing|ed)|evaluat(ing|ed)|might|could|may)\b/i, label: 'exploratory / hedged condition', weight: 0.55 },

  // ── Variable frames ───────────────────────────────────────────────────────
  { id: 'var_time_immediate', construct: 'variable_frame', re: /\b(today|now|this week|immediately|just (?:raised|closed|launched|announced))\b/i, label: 'immediate time variable', weight: 0.90 },
  { id: 'var_time_horizon', construct: 'variable_frame', re: /\b(next (?:quarter|year|month)|in \d{4}|by (?:q[1-4]|end of)|within \d+ (?:months?|years?))\b/i, label: 'horizon time variable', weight: 0.85 },
  { id: 'var_location_hq', construct: 'variable_frame', re: /\b(based in|headquartered in|hq in|from (?:san francisco|new york|london|berlin|singapore|boston|austin|tel aviv))\b/i, label: 'location variable', weight: 0.82 },
  { id: 'var_location_expansion', construct: 'variable_frame', re: /\b(expand(s|ing|ed)?\s+into|enter(s|ing|ed)?\s+(?:the\s+)?(?:market|region)|launch(es|ed|ing)?\s+in)\b/i, label: 'expansion location variable', weight: 0.80 },
  { id: 'var_association_syndicate', construct: 'association_frame', re: /\b(backed by|co-?led by|alongside|participat(ion|ing|ed) from|syndicate|with participation from)\b/i, label: 'investor association variable', weight: 0.88 },
  { id: 'var_association_partnership', construct: 'association_frame', re: /\b(partners?\s+with|teams?\s+up\s+with|collaborat(es|ed|ing)\s+with|integrat(es|ed|ing)\s+with)\b/i, label: 'partnership association variable', weight: 0.85 },
  { id: 'var_temperature_hot', construct: 'variable_frame', re: /\b(oversubscribed|competitive round|strong demand|surging|soaring|white hot|on fire|breakout)\b/i, label: 'high temperature (market heat)', weight: 0.88 },
  { id: 'var_temperature_cold', construct: 'variable_frame', re: /\b(slow(?:ing)? market|pullback|tighten(ing|ed)\s+(?:conditions|spending)|cautious|softening demand)\b/i, label: 'low temperature (market cool)', weight: 0.82 },
  { id: 'var_populus_scale', construct: 'variable_frame', re: /\b(\d+(?:\.\d+)?\s*(?:million|billion|thousand|k|m|b)\+?\s*(?:users|customers|developers|companies|startups|employees|merchants|patients|members))\b/i, label: 'populus scale variable', weight: 0.86 },
  { id: 'var_populus_market', construct: 'variable_frame', re: /\b(millions?\s+of|billions?\s+of|global (?:audience|market|customer base|user base)|enterprise customers?)\b/i, label: 'populus market variable', weight: 0.80 },

  // ── Result frames ─────────────────────────────────────────────────────────
  { id: 'result_funding_closed', construct: 'result_frame', re: /\b(closed (?:the |a |our )?(?:round|financing|seed|series)|oversubscribed|term sheet signed)\b/i, label: 'funding closed result', weight: 0.95 },
  { id: 'result_exit', construct: 'result_frame', re: /\b(acquired by|ipo|go(?:ing)? public|strategic exit|sold to)\b/i, label: 'exit result', weight: 0.92 },
  { id: 'result_rejection', construct: 'result_frame', re: /\b(passed on|declined|turned down|not moving forward)\b/i, label: 'investor rejection result', weight: 0.90 },

  // ── Negation ──────────────────────────────────────────────────────────────
  { id: 'negation', construct: 'negation_frame', re: /\b(not|no longer|never|without|didn't|won't|isn't|aren't|hasn't|haven't)\b/i, label: 'negation modifier', weight: 0.70 },
];

/** Role inference when frame type is known (mirrors DB role_inference_rules). */
const ROLE_INFERENCE = {
  INVESTMENT: { subject: 'INVESTOR', object: 'STARTUP', confidence: 0.92 },
  FUNDING: { subject: 'STARTUP', object: null, confidence: 0.90 },
  ACQUISITION: { subject: 'STARTUP', object: 'STARTUP', confidence: 0.85 },
  PARTNERSHIP: { subject: 'STARTUP', object: 'STARTUP', confidence: 0.80 },
  LAUNCH: { subject: 'STARTUP', object: null, confidence: 0.88 },
  EXEC_CHANGE: { subject: 'STARTUP', object: 'EXECUTIVE', confidence: 0.85 },
};

/** Slot-filling patterns for named entity extraction (most specific first). */
const ENTITY_SLOT_PATTERNS = [
  {
    frame: 'INVESTMENT',
    re: /^(.+?)\s+led\s+(?:a\s+)?(?:\$[\d.]+\s*[kmb]?\s+)?(?:seed|pre-seed|series\s+[a-e]|round|investment|financing)\s+(?:in|for|into)\s+(.+?)(?:\s+(?:alongside|with|at|to)\b|[,.]|$)/i,
    subjectRole: 'investor',
    objectRole: 'startup',
  },
  {
    frame: 'INVESTMENT',
    re: /^(.+?)\s+(?:invests?\s+in|backs?)\s+(.+?)(?:[,.]|$|\s+(?:with|at|for|to)\s)/i,
    subjectRole: 'investor',
    objectRole: 'startup',
  },
  {
    frame: 'ACQUISITION',
    re: /^(.+?)\s+(?:acquires?|acquired|buys?|bought)\s+(.+?)(?:[,.]|$|\s+for\s+\$)/i,
    subjectRole: 'startup',
    objectRole: 'startup',
  },
  {
    frame: 'FUNDING',
    re: /^(.+?)\s+(?:raises?|raised|secured|closes?|closed)\s+/i,
    subjectRole: 'startup',
    objectRole: null,
  },
  {
    frame: 'PARTNERSHIP',
    re: /^(.+?)\s+(?:partners?\s+with|teams?\s+up\s+with|collaborat(?:es|ed|ing)\s+with)\s+(.+?)(?:[,.]|$)/i,
    subjectRole: 'startup',
    objectRole: 'startup',
  },
];

const GENERIC_ENTITY_BLOCKLIST = new Set([
  'the company', 'the startup', 'the firm', 'the fund', 'the investor', 'the market',
  'startups', 'investors', 'founders', 'researchers', 'big vcs', 'series a', 'series b', 'series',
  'funding round', 'seed round', 'venture capital', 'private equity',
]);

function cleanEntityName(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let name = raw
    .replace(/\s+(raises?|raised|secured|closes?|closed|announces?|launches?|invests?|led|leads?|backs?|gets?|got|receives?|secures?)\b.*$/i, '')
    .replace(/\$\d[\d.,]*\s*[kmb]?/gi, '')
    .replace(/\b(seed|pre-seed|series\s+[a-e]|round|financing|funding)\b/gi, '')
    .replace(/\s+[-–|]\s+.*$/, '') // publisher suffix
    .replace(/[,.:;!?]+$/g, '')
    .trim();
  if (!name || name.length < 2 || name.length > 80) return null;
  if (GENERIC_ENTITY_BLOCKLIST.has(name.toLowerCase())) return null;
  if (/^(a|an|the)\s+/i.test(name)) name = name.replace(/^(a|an|the)\s+/i, '').trim();
  // Reject headline fragments with verbs still embedded
  if (/\b(gets?|got|receives?|secures?|announces?|launches?|raises?|raised)\b/i.test(name)) return null;
  if (name.split(/\s+/).length > 5) return null;
  return name || null;
}

module.exports = {
  PHRASE_CONSTRUCTS,
  ROLE_INFERENCE,
  ENTITY_SLOT_PATTERNS,
  GENERIC_ENTITY_BLOCKLIST,
  cleanEntityName,
};
