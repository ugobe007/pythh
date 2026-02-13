// src/services/rss/frameParser.ts

// Import inference engine for fast zero-cost classification
import eventClassifier from '../../../lib/event-classifier';

export type FrameType = "BIDIRECTIONAL" | "DIRECTIONAL" | "SELF_EVENT" | "EXEC_EVENT" | "UNKNOWN";

// Semantic context captured from additive descriptors (scored evidence channel)
export type SemanticContextEvidence = {
  type: "problem_solved" | "achievement" | "milestone" | "relationship";
  text: string;                   // Raw descriptor text
  confidence: number;             // 0..1
  extracted_from: "title";        // Future: "summary", "article"
};

// Canonical Phase-Change Event Contract (SSOT)
export type CapitalEventRole = "SUBJECT" | "OBJECT" | "COUNTERPARTY" | "CHANNEL";

export type CapitalEventEntity = {
  name: string;                   // "QuantumLight"
  role: CapitalEventRole;         // SUBJECT/OBJECT/COUNTERPARTY
  confidence: number;             // 0..1
  source: "frame" | "heuristic";
};

export type CapitalEvent = {
  // Schema version (v1.0.0 locked)
  schema_version: "1.0.0";
  frame_engine_version: "jisstrecon-v2";
  
  // Identity (SSOT: publisher + url for stable dedup, NOT title)
  event_id: string;               // hash(publisher + url) - title changes, URL doesn't
  occurred_at: string;            // ISO; default to publish time if no better
  source: {
    publisher: string;            // "TechCrunch"
    url: string;                  // rss item link
    title: string;                // raw headline
    published_at?: string;        // ISO from RSS when available
  };

  // Semantics (NEVER NULL - use FILTERED or OTHER)
  event_type: EventType;          // mapped type (FUNDING, ACQUISITION, etc.)
  verb: string | null;            // e.g. "invest", "acquire"
  frame_type: FrameType;
  frame_confidence: number;       // frame meta confidence (0..1) - ALWAYS 0..1

  // Slots & entities
  subject: string | null;         // parsed slot
  object: string | null;          // parsed slot
  tertiary?: string | null;       // secondary target (multi-hop patterns)
  entities: CapitalEventEntity[]; // normalized list - MUST INCLUDE subject/object if present

  // Semantic context (scored evidence channel)
  semantic_context?: SemanticContextEvidence[];

  // Optional extracted signals (Tier 1 enhancements)
  amounts?: {
    raw: string;                  // "$55M", "HK$2.5B", "€40m"
    currency: string;             // USD, HKD, EUR, GBP, INR
    value: number;                // 55, 2.5
    magnitude: "K" | "M" | "B";   // thousand, million, billion
    usd?: number | null;          // converted to USD (optional)
  };
  round?: string | null;          // "Seed", "Series A", "Growth"
  notes?: string[];               // modifier stripping notes, patternId, etc.

  // Debug / provenance (INVARIANT: fallback_used correct)
  extraction: {
    pattern_id?: string;
    filtered_reason?: string;
    fallback_used: boolean;       // true when confidence < threshold or no frame match
    
    // PARSER IS SSOT: decision gates (no extractor judgment allowed)
    decision: "ACCEPT" | "REJECT"; // ACCEPT = store event, REJECT = truly junk
    graph_safe: boolean;           // true only when safe to create entity edges
    reject_reason?: string;        // if REJECT, why
  };
};

// Canonical EventType for Phase-Change ingestion (SSOT)
export type EventType =
  | "FUNDING"        // SELF_EVENT: raises, secures, closes_round
  | "INVESTMENT"     // DIRECTIONAL: invests_in, leads_round, takes_stake
  | "ACQUISITION"    // DIRECTIONAL: acquires, to_acquire
  | "MERGER"         // BIDIRECTIONAL: merges_with
  | "PARTNERSHIP"    // BIDIRECTIONAL: partners_with, teams_up, signs_partnership
  | "LAUNCH"         // SELF_EVENT: launches, unveils, debuts
  | "IPO_FILING"     // SELF_EVENT: files_ipo
  | "VALUATION"      // SELF_EVENT: valued_at, hits_valuation
  | "EXEC_CHANGE"    // EXEC_EVENT: appoints, hires, promotes, joins_as
  | "CONTRACT"       // DIRECTIONAL: signs_contract, wins_deal
  | "OTHER"          // Fallback when ambiguous
  | "FILTERED";      // Junk headline

/**
 * Phase-Change event weights for GOD score integration
 * Used to weight events by strategic importance
 */
export const EVENT_WEIGHTS: Record<EventType, number> = {
  FUNDING: 1.0,       // Highest capital signal
  INVESTMENT: 0.9,    // Strong capital activity
  ACQUISITION: 0.8,   // M&A momentum
  PARTNERSHIP: 0.7,   // Strategic alliance
  LAUNCH: 0.6,        // Product signal
  IPO_FILING: 0.9,    // Pre-liquidity event
  VALUATION: 0.5,     // Market validation
  EXEC_CHANGE: 0.4,   // Leadership signal
  CONTRACT: 0.6,      // Revenue signal
  MERGER: 0.8,        // M&A signal
  OTHER: 0.2,         // Low confidence
  FILTERED: 0.0,      // Exclude from scoring
};

/**
 * Validate CapitalEvent invariants (v1.0.0 contract)
 * Ensures all 5 invariants are met before emission
 */
export function validateCapitalEvent(event: CapitalEvent): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Invariant 1: event_type never null
  if (!event.event_type) {
    errors.push('event_type is null or undefined');
  }
  
  // Invariant 2: frame_confidence always 0..1
  if (event.frame_confidence < 0 || event.frame_confidence > 1) {
    errors.push(`frame_confidence out of range: ${event.frame_confidence}`);
  }
  
  // Invariant 3: entities[] must have at least one unless FILTERED
  if (event.event_type !== 'FILTERED' && (!event.entities || event.entities.length === 0)) {
    errors.push('entities array is empty for non-FILTERED event');
  }
  
  // Invariant 4: subject/object must appear in entities[] if present
  const entityNames = new Set(event.entities.map(e => e.name));
  if (event.subject && !entityNames.has(event.subject)) {
    errors.push(`subject "${event.subject}" not found in entities array`);
  }
  if (event.object && !entityNames.has(event.object)) {
    errors.push(`object "${event.object}" not found in entities array`);
  }
  
  // Invariant 5: fallback_used must be correct
  const isLowConfidence = event.frame_confidence < 0.8;
  const shouldBeFallback = isLowConfidence || event.event_type === 'OTHER' || event.event_type === 'FILTERED';
  if (shouldBeFallback && !event.extraction.fallback_used) {
    errors.push('fallback_used should be true for low confidence or OTHER/FILTERED events');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

export type ParsedFrame = {
  frameType: FrameType;
  eventType: EventType;
  verbMatched: string | null;
  // Slots are raw strings (not yet entity-normalized)
  slots: {
    subject?: string | null;    // actor (primary)
    object?: string | null;     // target (primary)
    tertiary?: string | null;   // secondary target (e.g., Wholefoods in Julie→Julie's Jelly→Wholefoods)
    other?: string | null;      // additional org
    person?: string | null;     // person name (we usually ignore for entity emission)
  };
  // Semantic context (scored evidence channel)
  semantic_context?: SemanticContextEvidence[];
  // Light metadata for debugging
  meta: {
    patternId?: string;
    confidence: number; // 0..1
    notes?: string[];
  };
};

/**
 * Parse amount from title text (Tier 1 addon)
 * Supports: "$55M", "HK$2.5B", "€40m", "£10 million"
 */
/**
 * Normalize magnitude token to canonical K|M|B
 * Handles both abbreviations and full words
 */
function normalizeMagnitude(token?: string | null): "K" | "M" | "B" | null {
  if (!token) return null;
  const t = token.toLowerCase();
  if (t === "k" || t === "thousand") return "K";
  if (t === "m" || t === "million") return "M";
  if (t === "b" || t === "billion") return "B";
  return null;
}

/**
 * Normalize currency prefix to ISO-like codes
 * Keeps HKD distinct from USD (fixes HK$ magnitude bug)
 */
function normalizeCurrency(prefix?: string | null): string {
  if (!prefix) return "USD";
  if (prefix === "HK$") return "HKD";
  if (prefix === "$") return "USD";
  if (prefix === "€") return "EUR";
  if (prefix === "£") return "GBP";
  if (prefix === "₹") return "INR";
  return "USD";
}

/**
 * Canonical amount parser (SSOT-safe)
 * Single-pass regex captures currency prefix + numeric + magnitude
 * Prevents HK$ B→M bug by never re-deriving magnitude
 */
function parseAmount(title: string): CapitalEvent['amounts'] | undefined {
  // Canonical regex: captures (HK$|$|€|£|₹)? (numeric) (K|M|B|thousand|million|billion)?
  const AMOUNT_RE = /\b(?:(HK\$|\$|€|£|₹)\s*)?(\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d+))?\s*(K|M|B|k|m|b|thousand|million|billion)?\b/g;
  
  // Must have context keywords to avoid "100M users" false positives
  const CONTEXT_RE = /\b(raise|secure|close|funding|investment|round|deal|valuation|valued|capital|series)\b/i;
  if (!CONTEXT_RE.test(title)) return undefined;
  
  let bestMatch: RegExpExecArray | null = null;
  let match: RegExpExecArray | null;
  
  // Find first match that has a magnitude token (or explicit currency symbol)
  while ((match = AMOUNT_RE.exec(title)) !== null) {
    const [, currencyPrefix, integerPart, decimalPart, magnitudeToken] = match;
    if (magnitudeToken || currencyPrefix) {
      bestMatch = match;
      break;
    }
  }
  
  if (!bestMatch) return undefined;
  
  const [fullMatch, currencyPrefix, integerPart, decimalPart, magnitudeToken] = bestMatch;
  
  // Parse numeric value
  const numericStr = integerPart.replace(/,/g, '') + (decimalPart ? `.${decimalPart}` : '');
  const value = parseFloat(numericStr);
  
  // Normalize magnitude (NEVER override after this point)
  const magnitude = normalizeMagnitude(magnitudeToken);
  
  // Normalize currency
  const currency = normalizeCurrency(currencyPrefix);
  
  return {
    raw: fullMatch.trim(),
    currency,
    value,
    magnitude: magnitude || "M", // Default to M if no magnitude token present
    usd: undefined,
  };
}

/**
 * Parse funding round from title text (Tier 1 addon)
 * Detects: Seed, Pre-Seed, Angel, Series A/B/C/D/E, Growth, Debt
 */
function parseRound(title: string): string | null {
  const roundMatch = title.match(/\b(Pre-Seed|Seed|Angel|Series\s+[A-E]|Growth|Debt|Convertible\s+note)\b/i);
  if (!roundMatch) return null;
  
  return roundMatch[1];
}

/**
 * Production guardrail: Validate entity quality (ENHANCED with Ontology System)
 * 
 * IMPORTANT: This function validates extracted ENTITY NAMES, not headline content.
 * - Semantic terms like "funding", "Series A", "raises" are KEPT in headlines for event detection
 * - They are only blocked when they appear as the extracted company NAME
 * 
 * Example:
 *   ✅ Headline: "Acme raises $25M Series A funding" 
 *      → Extract entity: "Acme" (valid)
 *      → Store context: round="Series A", amounts=[{value:25, magnitude:"M"}]
 * 
 *   ❌ Headline: "Series A Funding raises concerns"
 *      → Extract entity: "Series A Funding" (INVALID - rejected here)
 * 
 * Uses Tier 1 & Tier 2 ontologies for semantic classification
 * Rejects: financing terms as names, possessives, pronouns, generic terms, places, 
 *          long statements, headline fragments, person names (non-startup founders)
 */
function validateEntityQuality(entity: string): boolean {
  if (entity.length < 2) return false;
  if (entity.length <= 3 && !/^[A-Z][a-z]?[A-Z]?$/.test(entity)) return false; // Allow "AI" "IBM" but not "The"
  if (!/[a-zA-Z]/.test(entity)) return false;
  
  // CRITICAL: Reject lowercase-starting names (headline fragments)
  if (/^[a-z]/.test(entity)) return false;
  
  // Tier 2: Expanded stoplist (includes possessives, pronouns, prepositions)
  const stopList = [
    'It', 'How', 'Why', 'What', 'When', 'Where', 'The', 'A', 'An',
    'Your', 'My', 'Our', 'Their', 'His', 'Her',
    'You', 'We', 'They', 'Us', 'Them',
    'For', 'To', 'With', 'At', 'In', 'On',
  ];
  if (stopList.some(stop => entity.toLowerCase() === stop.toLowerCase())) {
    return false;
  }
  
  // Tier 1: Standalone financing/business terms (reject as entity NAMES only, not semantic signals)
  // These are CONTEXT terms that help identify events, but should never be the company name
  const financingTerms = ['Funding', 'Investment', 'Round', 'Capital', 'Venture'];
  if (financingTerms.some(term => entity.toLowerCase() === term.toLowerCase())) {
    return false; // Reject "Funding" as a company name
  }
  
  // Tier 1: Funding stage terms (reject as entity NAMES only)
  const fundingStages = ['Seed', 'Series A', 'Series B', 'Series C', 'Series D', 'Series E', 'IPO', 'SPAC'];
  if (fundingStages.some(term => entity.toLowerCase() === term.toLowerCase())) {
    return false; // Reject "Series A" as a company name (but keep as round metadata)
  }
  
  // Tier 1: Generic categories (NOT concrete entities)
  const genericTerms = [
    'Researchers', 'Founders', 'Startups', 'VCs', 'Investors', 'Executives',
    'Leaders', 'People', 'Companies', 'Firms', 'Teams', 'Scientists',
    'MIT Researchers', 'Stanford Researchers', 'Former USDS Leaders',
    'Indian Startups', 'Big VCs', 'SMEs',
    // Real-world patterns from RSS feeds
    'Show', 'Show HN', 'How To', 'Humans',
    // Geographic adjectives (standalone)
    'Finnish', 'Japanese', 'Chinese', 'American', 'British', 'European',
    'Korean', 'Israeli', 'Canadian', 'German', 'French',
  ];
  if (genericTerms.some(term => entity.toLowerCase() === term.toLowerCase())) {
    return false;
  }
  
  // Tier 1: Geographic entities (NOT companies)
  const places = [
    'Africa', 'Asia', 'Europe', 'America', 'Australia',
    'USA', 'UK', 'India', 'China', 'Japan', 'Germany', 'France', 'Brazil',
    'Silicon Valley', 'Bay Area', 'New York', 'London', 'Berlin', 'Washington',
  ];
  if (places.some(place => entity.toLowerCase() === place.toLowerCase())) {
    return false;
  }
  
  // Tier 2: Real-world RSS patterns
  // Block "Startup X" or "Company X" patterns
  if (/^(Startup|Company|Firm)\s+/i.test(entity)) {
    return false; // "Startup Amissa" → should extract "Amissa" only
  }
  
  // Block "X startup" or "X company" patterns (ENHANCED)
  // BUT allow actual company names like "The Funding Company" or "Acme Company"
  // Target: descriptive patterns like "AI startup", "crypto company", not proper names
  if (/\b(startup|firm|platform|service|solution|provider)s?\b$/i.test(entity) && entity.split(/\s+/).length > 1) {
    // Block patterns ending with startup/firm/platform/etc (rarely proper names)
    return false; // "Virtual psychiatry startup" → reject
  }
  
  // Special handling for "company" - only block if it's descriptive, not a proper name
  if (/\bcompany\b$/i.test(entity) && entity.split(/\s+/).length > 1) {
    // Allow if starts with "The" (proper names like "The Compression Company")
    if (/^The\s+/i.test(entity)) {
      // Allow "The X Company" patterns
    } else {
      // Block single-word + "company" like "Tech Company", "AI Company"
      if (entity.split(/\s+/).length === 2) {
        return false;
      }
    }
  }
  
  // Block "X Funding" or "X Round" patterns (compound financing terms)
  if (/\b(funding|investment|round|capital)\b$/i.test(entity) && entity.split(/\s+/).length > 1) {
    return false; // "Series A Funding" → reject, "Seed Round" → reject
  }
  
  // Block descriptive industry patterns (adjective + industry term + business term)
  if (/^(Virtual|Digital|Online|Remote|Cloud|AI|Tech|Mobile)\s+\w+\s+(startup|company|platform)$/i.test(entity)) {
    return false; // "Virtual psychiatry startup", "Digital health platform"
  }
  
  // Block "X Company" patterns (descriptive) - but allow "The X Company" (legitimate names)
  if (/^(Satellite|Tech|Software|AI|Crypto|Fintech|Health)\s+Company$/i.test(entity) && !/^The\s+/i.test(entity)) {
    return false; // "Satellite Company" → reject, but "The Compression Company" → allow
  }
  
  // Block "Finnish X" patterns (geographic adjectives as prefixes)
  if (/^(Finnish|Japanese|Chinese|Indian|Korean|Israeli|European|American|British)\s+/i.test(entity)) {
    return false; // "Finnish Agileday" → should extract "Agileday" only
  }
  
  // Tier 2: Linguistic patterns - possessive/prepositional phrases
  if (/^(your|my|our|their|his|her)\s+/i.test(entity)) {
    return false; // "your startup", "my company"
  }
  if (/\bfor\s+you\b/i.test(entity) || /\bto\s+you\b/i.test(entity)) {
    return false; // "for you", "to you"
  }
  
  // Tier 2: Generic patterns with adjectives
  if (/(big|small|top|leading|major|several)\s+(vcs|investors|startups|founders)/i.test(entity)) {
    return false; // "Big VCs", "Top Founders"
  }
  
  // Tier 2: Academic/institutional patterns
  if (/^(MIT|Stanford|Harvard|Cambridge|Oxford|Yale)\s+(Researchers|Team|Scientists|Engineers)/i.test(entity)) {
    return false; // "MIT Researchers"
  }
  
  // Tier 2: Government entities
  if (/^(Former|Ex-)?\s*(USDS|CIA|FBI|NASA|Pentagon|White House)\s+(Leaders|Officials|Staff)/i.test(entity)) {
    return false; // "Former USDS Leaders"
  }
  
  // === NEW TIER 3: Headline fragment detection ===
  
  // Block question/temporal starters (headline fragments)
  if (/^(When|How|Why|What|Where|While|If|As|Since|After|Before)\s+/i.test(entity)) {
    return false; // "When Openai", "How Google", etc.
  }
  
  // Block "Former X" patterns (people/roles, not companies)
  if (/^Former\s+/i.test(entity)) {
    return false; // "Former TikTok", "Former Googlers"
  }
  
  // Block person names (famous tech people that aren't companies)
  const famousPersons = [
    'Jim Cramer', 'Palmer Luckey', 'Tony Fadell', 'Elon Musk', 'Sam Altman',
    'Jensen Huang', 'Satya Nadella', 'Tim Cook', 'Mark Zuckerberg', 'Jeff Bezos',
    'Bill Gates', 'Steve Jobs', 'Sundar Pichai', 'Jack Dorsey', 'Brian Chesky',
    'Travis Kalanick', 'Adam Neumann', 'Elizabeth Holmes', 'Do Kwon', 'SBF',
  ];
  if (famousPersons.some(p => entity.toLowerCase() === p.toLowerCase())) {
    return false;
  }
  
  // Block nationality groups (not companies)
  const nationalityGroups = ['Koreans', 'Danes', 'Americans', 'Chinese', 'Japanese', 'Europeans', 'Asians'];
  if (nationalityGroups.some(g => entity.toLowerCase() === g.toLowerCase())) {
    return false;
  }
  
  // Block political references
  if (/\bTrump\b/i.test(entity) || /\bBiden\b/i.test(entity) || /\bObama\b/i.test(entity)) {
    return false;
  }
  
  // Block common headline verb patterns
  const verbPatterns = [
    /^.*\b(Emerges|Launches|Raises|Files|Wins|Leads|Gets|Takes|Leave|Leaves|Says|Tells|Wants|Deepens)\s*$/i,
    /^(CEOs?|CFOs?|CTOs?|Directors?)\s+/i,  // "CEO X", "Directors Leave"
    /^(Best|Top|Busy|One-time|Focus on)\s+/i,  // Listicle/adjective starts
    /^(Troubles|Agenda|Windows Mac)\b/i,  // Specific garbage
    /^(Virtual|Digital|Online|Remote|Mobile|Cloud)\s+[A-Z][a-z]+$/i, // "Virtual Psychiatry" (adj + noun fragment)
  ];
  if (verbPatterns.some(p => p.test(entity))) {
    return false;
  }
  
  // Block standalone business/industry descriptors (not company names)
  // BUT only if they're single words without articles/prefixes
  const businessDescriptors = [
    'Psychiatry', 'Healthcare', 'Technology', 'Software', 'Hardware', 'Services',
    'Solutions', 'Platform', 'Marketplace', 'Analytics', 'Intelligence', 'Systems',
    'Computing', 'Engineering', 'Development', 'Management', 'Consulting',
    'Virtual', 'Digital', 'Online', 'Remote', 'Mobile', 'Cloud', 'AI', 'Tech', // Single adjectives
  ];
  // Note: "Compression" removed - can be part of legit names like "The Compression Company"
  if (businessDescriptors.some(desc => entity.toLowerCase() === desc.toLowerCase())) {
    return false;
  }
  
  // Block "X's Y" possessive fragments that aren't companies (short fragments)
  if (/^[A-Z][a-z]+'s\s*$/i.test(entity) || /^[A-Z][a-z]+'s\s+[A-Z]/i.test(entity) && entity.length < 15) {
    // Allow "OpenAI's" but block "Nvidia's Huang", "Intel's Stock"
    if (/\b(Stock|Huang|CEO|Director|Manager|Team)\b/i.test(entity)) {
      return false;
    }
  }
  
  // Block pure acronyms that are too ambiguous
  if (/^[A-Z]{2,4}$/.test(entity) && !['AI', 'ML', 'VR', 'AR', 'EV', 'IoT'].includes(entity)) {
    // Allow common tech acronyms, block others like "BYD", "IPO", "SPAC"
    if (['IPO', 'SPAC', 'SEC', 'FTC', 'FDA', 'DOJ', 'IRS'].includes(entity)) {
      return false;
    }
  }
  
  // Tier 2: Long statements (likely descriptions, not names)
  if (entity.split(' ').length > 6) {
    return false; // "Business Means Protecting Your Data"
  }
  
  // Ontology whitelist (AFTER generic/place filtering): only accept STARTUP/INVESTOR types
  try {
    if (isOntologyKnown(entity)) return true;
  } catch {}
  
  return true;
}


/**
 * Production guardrail: Generate stable event ID
 * Uses hash(publisher + url) NOT title to avoid duplicates
 */
function generateEventId(publisher: string, url: string): string {
  const combined = `${publisher}|${url}`;
  // Simple hash for stable ID
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  const eventId = `evt_${Math.abs(hash).toString(36)}`;
  
  // DEBUG: Log what we're hashing
  if (Math.random() < 0.05) { // Log 5% of events to avoid spam
    console.log(`[DEBUG] EventID: ${eventId} from "${publisher}" + "${url.slice(0, 80)}"`);
  }
  
  return eventId;
}

// ========================================
// Ontology integration (runtime, injected)
// ========================================
let ONTOLOGY_SET: Set<string> = new Set();

function normName(name: string): string {
  return (name || '').trim().toLowerCase();
}

export function setOntologyEntities(entities: string[]) {
  try {
    ONTOLOGY_SET = new Set((entities || []).map(normName));
  } catch {
    ONTOLOGY_SET = new Set();
  }
}

function isOntologyKnown(name: string): boolean {
  const n = normName(name);
  return ONTOLOGY_SET.has(n);
}

/**
 * Production guardrail: Detect topic headlines (not company news)
 * Examples: "X's 2026 Predictions", "Dispatch from Davos"
 */
function isTopicHeadline(title: string): boolean {
  const topicPatterns = [
    /\b\d{4}\s+Predictions?\b/i,
    /\bDispatch\s+from\b/i,
    /\bRoundup:?\b/i,
    /\bWeekly\s+Digest\b/i,
    /\bTop\s+\d+\b/i,
  ];
  
  return topicPatterns.some(pattern => pattern.test(title));
}

/**
 * Production guardrail: Should skip graph join for low-quality events
 * True when confidence < 0.8 AND event has only ambiguous entities
 */
function shouldSkipGraphJoin(event: Partial<CapitalEvent>): boolean {
  if (!event.frame_confidence || event.frame_confidence >= 0.8) return false;
  
  // Check if all entities are ambiguous (generic words)
  const ambiguousPatterns = [/^[A-Z]$/, /^\w{1,2}$/, /^The\s/];
  const hasOnlyAmbiguous = event.entities?.every(e => 
    ambiguousPatterns.some(p => p.test(e.name || ''))
  ) ?? true;
  
  return hasOnlyAmbiguous;
}

/**
 * Extract semantic context from additive descriptors (scored evidence channel)
 * Captures "since they solved X", "because of Y", "after achieving Z"
 */
function extractSemanticContext(title: string, verbIdx: number): SemanticContextEvidence[] | undefined {
  const afterVerb = title.slice(verbIdx + 20); // Text after the verb phrase
  
  const evidence: SemanticContextEvidence[] = [];
  
  // Achievement patterns: "after solving X", "having achieved Y"
  const achievementMatch = afterVerb.match(/\b(?:after|having)\s+(?:solv(?:ed|ing)|achiev(?:ed|ing)|build(?:ing|t)|creat(?:ed|ing))\s+([^,.;]+)/i);
  if (achievementMatch) {
    evidence.push({
      type: 'achievement',
      text: achievementMatch[0].trim(),
      confidence: 0.85,
      extracted_from: 'title',
    });
  }
  
  // Problem-solved patterns: "since they solved X", "because they cracked Y"
  const problemMatch = afterVerb.match(/\b(?:since|because|as)\s+(?:they|it|the\s+team)\s+(?:solved|cracked|figured\s+out|overcame)\s+([^,.;]+)/i);
  if (problemMatch) {
    evidence.push({
      type: 'problem_solved',
      text: problemMatch[0].trim(),
      confidence: 0.9,
      extracted_from: 'title',
    });
  }
  
  // Milestone patterns: "following X milestone", "post-Y"
  // SSOT-safe: Exclude financing round mentions (Series A-E, seed, etc.)
  // Only emit milestone if substantive achievement tokens present
  const ROUND_MENTION_RE = /\b(pre[-\s]?seed|seed|angel|series\s+[a-e]|series\s+\d+|growth|debt|convertible)\b/i;
  const SUBSTANTIVE_MILESTONE_RE = /\b(\d+(?:\.\d+)?\s*(k|m|b)?\s*(users|customers|installs|downloads|subscribers|revenue|arr|mrr|gmv|transactions|orders))\b/i;
  
  const milestoneMatch = afterVerb.match(/\b(?:following|after|post-)\s+(?:their|its|the)?\s*([\w\s]+(?:milestone|launch|release|pivot|round))/i);
  if (milestoneMatch) {
    const milestoneText = milestoneMatch[0];
    // If the only "milestone" content is financing round wording, ignore it
    // (Still allow milestone if substantive units exist)
    if (ROUND_MENTION_RE.test(milestoneText) && !SUBSTANTIVE_MILESTONE_RE.test(milestoneText)) {
      // Skip this false positive (e.g., "following their Series C")
    } else {
      evidence.push({
        type: 'milestone',
        text: milestoneText.trim(),
        confidence: 0.8,
        extracted_from: 'title',
      });
    }
  }
  
  // Relationship patterns: "working with X", "backed by Y"
  const relationshipMatch = afterVerb.match(/\b(?:working\s+with|backed\s+by|supported\s+by|partnering\s+with)\s+([A-Z][\w\s]+)/i);
  if (relationshipMatch) {
    evidence.push({
      type: 'relationship',
      text: relationshipMatch[0].trim(),
      confidence: 0.75,
      extracted_from: 'title',
    });
  }
  
  if (evidence.length === 0) return undefined;
  
  return evidence;
}

/**
 * Canonical EventType mapper (SSOT for Phase-Change ingestion)
 * Maps frameType + pattern_id to structured business event type
 * 
 * SSOT-safe approach: Maps by pattern_id (stable) instead of verbMatched (fragile).
 * Pattern IDs are permanent; substring matching on English verbs drifts fast.
 * 
 * Doctrine:
 * - SELF_EVENT verbs map based on pattern ID semantics
 * - DIRECTIONAL: acquir→ACQUISITION, invest→INVESTMENT
 * - BIDIRECTIONAL: merge→MERGER, partner→PARTNERSHIP
 * - EXEC_EVENT always→EXEC_CHANGE
 * - FILTERED should be handled BEFORE calling mapEventType
 */
function mapEventType(frameType: FrameType, verbMatched: string | null, patternId?: string): EventType {
  // FILTERED should be handled before calling mapEventType (see toCapitalEvent)
  if (!verbMatched && !patternId) return "OTHER";

  const id = (patternId || "").toLowerCase();

  // EXEC_EVENT always maps to EXEC_CHANGE
  if (frameType === "EXEC_EVENT") return "EXEC_CHANGE";

  // ========== BIDIRECTIONAL mappings ==========
  if (frameType === "BIDIRECTIONAL") {
    if (id.includes("merge") || id.includes("joint_venture")) return "MERGER";
    if (id.includes("partnership") || id.includes("partner") || id.includes("teams_up") || id.includes("joins_forces") || id.includes("signs")) {
      return "PARTNERSHIP";
    }
    return "OTHER";
  }

  // ========== DIRECTIONAL mappings ==========
  if (frameType === "DIRECTIONAL") {
    if (id.includes("acquir") || id.includes("to_acquire")) return "ACQUISITION";
    if (id.includes("invest") || id.includes("leads_round") || id.includes("takes_stake")) return "INVESTMENT";
    // Distribution deals → CONTRACT (not PARTNERSHIP)
    if (id.includes("distribution_deal") || id.includes("signs_deal")) return "CONTRACT";
    return "OTHER";
  }

  // ========== SELF_EVENT mappings ==========
  if (frameType === "SELF_EVENT") {
    if (id.includes("raise") || id.includes("close_round") || id.includes("secure") || id.includes("receive")) return "FUNDING";
    if (id.includes("launch") || id.includes("debut") || id.includes("unveil")) return "LAUNCH";
    if (id.includes("file")) return "IPO_FILING";
    if (id.includes("valued") || id.includes("valuation")) return "VALUATION";
    if (id.includes("wins_contract") || id.includes("lands_deal")) return "CONTRACT";
    return "OTHER";
  }

  return "OTHER";
}

// More permissive regex to match TikTok, KPay, etc. (any capitalized word)
const TITLECASE_CHUNK_RE =
  /\b[A-Z][A-Za-z0-9]*(?:\s+[A-Z][A-Za-z0-9]*){0,4}\b/g;

function normalizeQuotes(s: string) {
  return s
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanCandidate(text: string): string {
  return text
    .replace(/^[\s\-\–\—:|]+/, "")
    .replace(/[\s\-\–\—:|,;.!]+$/, "")
    .replace(/['']s$/i, "")
    .trim();
}

function pickLastTitlecaseChunk(s: string): string | null {
  const matches = s.match(TITLECASE_CHUNK_RE);
  if (!matches?.length) return null;
  return cleanCandidate(matches[matches.length - 1]);
}

function pickFirstTitlecaseChunk(s: string): string | null {
  const matches = s.match(TITLECASE_CHUNK_RE);
  if (!matches?.length) return null;
  return cleanCandidate(matches[0]);
}

function titlePrefixCompany(title: string): string | null {
  // first capitalized chunk up to 5 tokens from the start (handles KPay, TikTok, etc.)
  const m = title.match(/^([A-Z][A-Za-z0-9]*(?:\s+[A-Z][A-Za-z0-9]*){0,4})\b/);
  return m?.[1] ? cleanCandidate(m[1]) : null;
}

function stripLeadingPersonPossessive(title: string): string {
  // Handles:
  // "Nik Storonsky's QuantumLight targets..."
  // "Nik Storonsky's QuantumLight targets..."
  // If title begins with "First Last's", drop it.
  return title.replace(/^[A-Z][a-z]+\s+[A-Z][a-z]+['']s\s+/, "");
}

function stripKnownLeadingModifiers(title: string): string {
  // Handles:
  // "Sam Altman-backed Coco Robotics..."
  // "YC-backed X..."
  // "Elon Musk's X..." (handled by possessive too)
  return title
    .replace(/^[A-Z][a-z]+\s+[A-Z][a-z]+-backed\s+/i, "") // "Sam Altman-backed "
    .replace(/^[A-Z]{1,4}-backed\s+/i, "")                // "YC-backed "
    .replace(/^(?:Founder|CEO|Billionaire)\s+[A-Z][a-z]+\s+[A-Z][a-z]+[:'']\s+/i, "");
}

type Pattern = {
  id: string;
  frameType: FrameType;
  re: RegExp;
  mode: "with" | "after" | "names_exec" | "self" | "from";
  verbLabel: string;
  confidence: number;
};

const PATTERNS: Pattern[] = [
  // EXEC_EVENT: company names person as exec
  {
    id: "names_as_exec",
    frameType: "EXEC_EVENT",
    re: /\bNames\b\s+([A-Z][a-z]+)\s+([A-Z][a-z]+)\s+\bAs\b\s+(CEO|CFO|CTO|COO|CMO|CIO|Chief\b)/,
    mode: "names_exec",
    verbLabel: "names",
    confidence: 0.95,
  },
  {
    id: "appoints_as_exec",
    frameType: "EXEC_EVENT",
    re: /\bAppoints\b\s+([A-Z][a-z]+)\s+([A-Z][a-z]+)\s+\bAs\b\s+(CEO|CFO|CTO|COO|CMO|CIO|Chief\b)/,
    mode: "names_exec",
    verbLabel: "appoints",
    confidence: 0.9,
  },
  {
    id: "steps_down",
    frameType: "EXEC_EVENT",
    re: /\bsteps?\s+down\b/i,
    mode: "names_exec",
    verbLabel: "steps_down",
    confidence: 0.9,
  },
  {
    id: "resigns",
    frameType: "EXEC_EVENT",
    re: /\bresigns?\b/i,
    mode: "names_exec",
    verbLabel: "resigns",
    confidence: 0.9,
  },

  // BIDIRECTIONAL: partnerships, merges, JV
  {
    id: "announces_strategic_partnership_with",
    frameType: "BIDIRECTIONAL",
    re: /\bAnnounces\s+Strategic\s+Partnership\s+With\b/i,
    mode: "with",
    verbLabel: "strategic partnership",
    confidence: 0.9,
  },
  {
    id: "strategic_partnership_with",
    frameType: "BIDIRECTIONAL",
    re: /\bStrategic\s+Partnership\s+With\b/i,
    mode: "with",
    verbLabel: "strategic partnership",
    confidence: 0.85,
  },
  {
    id: "forms_joint_venture_with",
    frameType: "BIDIRECTIONAL",
    re: /\bForms?\s+Joint\s+Venture\s+With\b/i,
    mode: "with",
    verbLabel: "joint venture",
    confidence: 0.9,
  },
  {
    id: "joint_venture_with",
    frameType: "BIDIRECTIONAL",
    re: /\bJoint\s+Venture\s+With\b/i,
    mode: "with",
    verbLabel: "joint venture",
    confidence: 0.8,
  },
  {
    id: "merges_with",
    frameType: "BIDIRECTIONAL",
    re: /\bmerg(?:e|es|ed)\b/i,
    mode: "with",
    verbLabel: "merge",
    confidence: 0.85,
  },
  {
    id: "partners_with",
    frameType: "BIDIRECTIONAL",
    re: /\bpartner(?:s|ed|ing)?\b/i,
    mode: "with",
    verbLabel: "partner",
    confidence: 0.75,
  },
  {
    id: "signs_deal_with",
    frameType: "BIDIRECTIONAL",
    re: /\bsigns?\s+(?:deal|partnership|agreement)\s+with\b/i,
    mode: "with",
    verbLabel: "sign_deal",
    confidence: 0.9,
  },
  {
    id: "teams_up_with",
    frameType: "BIDIRECTIONAL",
    re: /\bteams?\s+up\s+with\b/i,
    mode: "with",
    verbLabel: "team_up",
    confidence: 0.9,
  },
  {
    id: "joins_forces_with",
    frameType: "BIDIRECTIONAL",
    re: /\bjoins?\s+forces\s+with\b/i,
    mode: "with",
    verbLabel: "join_forces",
    confidence: 0.9,
  },
  {
    id: "signs_partnership_with",
    frameType: "BIDIRECTIONAL",
    re: /\bsigns?\s+partnership\s+with\b/i,
    mode: "with",
    verbLabel: "sign_partnership",
    confidence: 0.9,
  },

  // DIRECTIONAL: distribution deals (CONTRACT event type)
  {
    id: "signs_distribution_deal_with",
    frameType: "DIRECTIONAL",
    re: /\bsigns?\s+distribution\s+deal\s+with\b/i,
    mode: "with",
    verbLabel: "distribution_deal",
    confidence: 0.9,
  },
  {
    id: "distribution_deal_with",
    frameType: "DIRECTIONAL",
    re: /\bdistribution\s+deal\s+with\b/i,
    mode: "with",
    verbLabel: "distribution_deal",
    confidence: 0.85,
  },
  {
    id: "signs_deal_with",
    frameType: "DIRECTIONAL",
    re: /\bsigns?\s+deal\s+with\b/i,
    mode: "with",
    verbLabel: "sign_deal",
    confidence: 0.8,
  },

  // DIRECTIONAL: acquires, buys, invests in
  {
    id: "acquires",
    frameType: "DIRECTIONAL",
    re: /\bacquir(?:e|es|ed|ing)\b/i,
    mode: "after",
    verbLabel: "acquire",
    confidence: 0.85,
  },
  {
    id: "snaps_up",
    frameType: "DIRECTIONAL",
    re: /\bsnap(?:s|ped|ping)?\\s+up\b/i,
    mode: "after",
    verbLabel: "snap_up",
    confidence: 0.9,
  },
  {
    id: "buys_out",
    frameType: "DIRECTIONAL",
    re: /\bbuy(?:s|ing)?\\s+out\b/i,
    mode: "after",
    verbLabel: "buyout",
    confidence: 0.9,
  },
  {
    id: "takes_over",
    frameType: "DIRECTIONAL",
    re: /\btake(?:s|n|ing)?\\s+over\b/i,
    mode: "after",
    verbLabel: "takeover",
    confidence: 0.85,
  },
  {
    id: "purchases",
    frameType: "DIRECTIONAL",
    re: /\bpurchase(?:s|d|ing)?\b/i,
    mode: "after",
    verbLabel: "purchase",
    confidence: 0.9,
  },
  {
    id: "buys",
    frameType: "DIRECTIONAL",
    re: /\bbuy(?:s|ing|bought)\b/i,
    mode: "after",
    verbLabel: "buy",
    confidence: 0.75,
  },
  {
    id: "invests_in",
    frameType: "DIRECTIONAL",
    re: /\binvest(?:s|ed|ing)?\b/i,
    mode: "with", // we'll look for "in" on the right
    verbLabel: "invest",
    confidence: 0.85,
  },
  {
    id: "sells_to",
    frameType: "DIRECTIONAL",
    re: /\bsells?\s+to\b/i,
    mode: "after",
    verbLabel: "sell",
    confidence: 0.85,
  },
  {
    id: "spins_out",
    frameType: "DIRECTIONAL",
    re: /\bspins?\s+out\b/i,
    mode: "after",
    verbLabel: "spinout",
    confidence: 0.8,
  },
  {
    id: "buys_stake_in",
    frameType: "DIRECTIONAL",
    re: /\bbuys?\s+stake\s+in\b/i,
    mode: "after",
    verbLabel: "buy_stake",
    confidence: 0.9,
  },
  {
    id: "takes_stake_in",
    frameType: "DIRECTIONAL",
    re: /\btakes?\s+stake\s+in\b/i,
    mode: "after",
    verbLabel: "take_stake",
    confidence: 0.9,
  },
  {
    id: "leads_round_in",
    frameType: "DIRECTIONAL",
    re: /\bleads?\s+(?:round|funding)\s+(?:in|for)\b/i,
    mode: "after",
    verbLabel: "lead_round",
    confidence: 0.9,
  },

  // SELF_EVENT: raises, funding (EXPANDED SYNONYMS)
  {
    id: "raises",
    frameType: "SELF_EVENT",
    re: /\brais(?:e|es|ed|ing)\b/i,
    mode: "self",
    verbLabel: "raise",
    confidence: 0.8,
  },
  {
    id: "lands_funding",
    frameType: "SELF_EVENT",
    re: /\bland(?:s|ed|ing)?.*(?:funding|investment|capital|round|million|M|\\$)/i,
    mode: "self",
    verbLabel: "land",
    confidence: 0.85,
  },
  {
    id: "bags_funding",
    frameType: "SELF_EVENT",
    re: /\bbag(?:s|ged|ging)?.*(?:funding|investment|capital|million|M|\\$)/i,
    mode: "self",
    verbLabel: "bag",
    confidence: 0.85,
  },
  {
    id: "snags_funding",
    frameType: "SELF_EVENT",
    re: /\bsnag(?:s|ged|ging)?.*(?:funding|investment|million|M|\\$)/i,
    mode: "self",
    verbLabel: "snag",
    confidence: 0.85,
  },
  {
    id: "grabs_funding",
    frameType: "SELF_EVENT",
    re: /\bgrab(?:s|bed|bing)?.*(?:funding|investment|million|M|\\$)/i,
    mode: "self",
    verbLabel: "grab",
    confidence: 0.80,
  },
  {
    id: "scores_funding",
    frameType: "SELF_EVENT",
    re: /\bscore(?:s|d|ing)?.*(?:funding|investment|million|M|\\$)/i,
    mode: "self",
    verbLabel: "score",
    confidence: 0.80,
  },
  {
    id: "lands_funding",
    frameType: "SELF_EVENT",
    re: /\bland(?:s|ed|ing)?\b.*(?:funding|investment|capital|round)/i,
    mode: "self",
    verbLabel: "land",
    confidence: 0.85,
  },
  {
    id: "bags_funding",
    frameType: "SELF_EVENT",
    re: /\bbag(?:s|ged|ging)?\b.*(?:funding|investment|capital)/i,
    mode: "self",
    verbLabel: "bag",
    confidence: 0.85,
  },
  {
    id: "snags_funding",
    frameType: "SELF_EVENT",
    re: /\bsnag(?:s|ged|ging)?\b.*(?:funding|investment)/i,
    mode: "self",
    verbLabel: "snag",
    confidence: 0.85,
  },
  {
    id: "grabs_funding",
    frameType: "SELF_EVENT",
    re: /\bgrab(?:s|bed|bing)?\b.*(?:funding|investment)/i,
    mode: "self",
    verbLabel: "grab",
    confidence: 0.80,
  },
  {
    id: "scores_funding",
    frameType: "SELF_EVENT",
    re: /\bscore(?:s|d|ing)?\b.*(?:funding|investment)/i,
    mode: "self",
    verbLabel: "score",
    confidence: 0.80,
  },
  {
    id: "receives_from",
    frameType: "DIRECTIONAL", // Changed to DIRECTIONAL to capture "from X"
    re: /\breceiv(?:e|es|ed|ing)\b.*\bfrom\b/i,
    mode: "from",
    verbLabel: "receive",
    confidence: 0.85, // Higher confidence since "from" is explicit
  },
  {
    id: "receives",
    frameType: "SELF_EVENT",
    re: /\breceiv(?:e|es|ed|ing)\b/i,
    mode: "self",
    verbLabel: "receive",
    confidence: 0.8,
  },
  {
    id: "targets",
    frameType: "SELF_EVENT",
    re: /\btargets?\b/i,
    mode: "self",
    verbLabel: "target",
    confidence: 0.8,
  },
  {
    id: "debuts",
    frameType: "SELF_EVENT",
    re: /\bdebuts?\b/i,
    mode: "self",
    verbLabel: "debut",
    confidence: 0.85,
  },
  {
    id: "secures",
    frameType: "SELF_EVENT",
    re: /\bsecur(?:e|es|ed|ing)\b/i,
    mode: "self",
    verbLabel: "secure",
    confidence: 0.85,
  },
  {
    id: "lands",
    frameType: "SELF_EVENT",
    re: /\blands?\b/i,
    mode: "self",
    verbLabel: "land",
    confidence: 0.8,
  },
  {
    id: "launches",
    frameType: "SELF_EVENT",
    re: /\blaunch(?:es|ed|ing)?\b/i,
    mode: "self",
    verbLabel: "launch",
    confidence: 0.85,
  },
  {
    id: "unveils",
    frameType: "SELF_EVENT",
    re: /\bunveils?\b/i,
    mode: "self",
    verbLabel: "unveil",
    confidence: 0.85,
  },
  {
    id: "introduces",
    frameType: "SELF_EVENT",
    re: /\bintroduce(?:s|d|ing)?\b/i,
    mode: "self",
    verbLabel: "introduce",
    confidence: 0.80,
  },
  {
    id: "rolls_out",
    frameType: "SELF_EVENT",
    re: /\broll(?:s|ed|ing)?\\s+out\b/i,
    mode: "self",
    verbLabel: "rollout",
    confidence: 0.85,
  },
  {
    id: "reveals",
    frameType: "SELF_EVENT",
    re: /\breveal(?:s|ed|ing)?\b/i,
    mode: "self",
    verbLabel: "reveal",
    confidence: 0.75,
  },
  {
    id: "releases",
    frameType: "SELF_EVENT",
    re: /\brelease(?:s|d|ing)?\b/i,
    mode: "self",
    verbLabel: "release",
    confidence: 0.80,
  },
  {
    id: "wins_contract",
    frameType: "SELF_EVENT",
    re: /\bwins?\s+contract\b/i,
    mode: "self",
    verbLabel: "win_contract",
    confidence: 0.85,
  },
  {
    id: "files",
    frameType: "SELF_EVENT",
    re: /\bfil(?:e|es|ed|ing)\b/i,
    mode: "self",
    verbLabel: "file",
    confidence: 0.75,
  },
  {
    id: "valued_at",
    frameType: "SELF_EVENT",
    re: /\bvalued\s+at\b/i,
    mode: "self",
    verbLabel: "valued",
    confidence: 0.85,
  },
  {
    id: "closes_round",
    frameType: "SELF_EVENT",
    re: /\bclos(?:e|es|ed|ing)\s+(?:round|funding|deal)\b/i,
    mode: "self",
    verbLabel: "close",
    confidence: 0.85,
  },
];

export function parseFrameFromTitle(titleRaw: string): ParsedFrame {
  let title = normalizeQuotes(titleRaw);
  const notes: string[] = [];

  // Jisst-lite: strip person possessives and known "X-backed" modifiers early
  const before = title;
  title = stripLeadingPersonPossessive(title);
  if (title !== before) notes.push("stripped_leading_person_possessive");

  const before2 = title;
  title = stripKnownLeadingModifiers(title);
  if (title !== before2) notes.push("stripped_leading_modifier");

  const hit = PATTERNS.find((p) => p.re.test(title));
  if (!hit) {
    return {
      frameType: "UNKNOWN",
      eventType: "OTHER",
      verbMatched: null,
      slots: {},
      meta: { confidence: 0.0, notes },
    };
  }

  // SSOT: Use pattern_id for stable event type mapping
  const patternId = hit.id;

  const m = title.match(hit.re);
  const verbIdx = m?.index ?? title.toLowerCase().search(hit.re);

  // Subject is generally prefix company before the verb phrase
  const subject = titlePrefixCompany(title) ?? pickFirstTitlecaseChunk(title);

  // Exec-event: subject is prefix, person is captured
  if (hit.mode === "names_exec") {
    const idx = title.toLowerCase().indexOf(" names ");
    const subj = idx > 0 ? pickLastTitlecaseChunk(title.slice(0, idx)) : subject;
    const person = m ? `${m[1]} ${m[2]}` : null;
    const semantic_context = extractSemanticContext(title, verbIdx);
    return {
      frameType: hit.frameType,
      eventType: mapEventType(hit.frameType, hit.verbLabel, hit.id),
      verbMatched: hit.verbLabel,
      slots: { subject: subj, person },
      semantic_context,
      meta: { patternId: hit.id, confidence: hit.confidence, notes },
    };
  }

  // Self-event: subject is prefix company; no object required
  if (hit.mode === "self") {
    // subject = prefix before verb token (more reliable)
    let subj = subject;
    if (verbIdx > 0) {
      const left = title.slice(0, verbIdx).trim();
      subj = pickLastTitlecaseChunk(left) ?? subject;
    }
    const semantic_context = extractSemanticContext(title, verbIdx);
    return {
      frameType: hit.frameType,
      eventType: mapEventType(hit.frameType, hit.verbLabel, hit.id),
      verbMatched: hit.verbLabel,
      slots: { subject: subj },
      semantic_context,
      meta: { patternId: hit.id, confidence: hit.confidence, notes },
    };
  }

  // Directional/bidirectional
  const left = verbIdx > 0 ? title.slice(0, verbIdx).trim() : title;
  const right = verbIdx > 0 ? title.slice(verbIdx).trim() : "";

  let subj = pickLastTitlecaseChunk(left) ?? subject;
  let obj: string | null = null;
  let tertiary: string | null = null; // For multi-hop patterns (Julie→Julie's Jelly→Wholefoods)

  if (hit.id === "invests_in") {
    // Look for the last " in " and take first TitleCase chunk after it
    const lower = title.toLowerCase();
    const lastIn = lower.lastIndexOf(" in ");
    if (lastIn >= 0) {
      const afterIn = title.slice(lastIn + 4).trim();
      obj = pickLastTitlecaseChunk(afterIn) ?? pickFirstTitlecaseChunk(afterIn);
    }
  } else if (hit.mode === "from") {
    // Look for " from " and extract object after it
    const lower = title.toLowerCase();
    const fromIdx = lower.lastIndexOf(" from ");
    if (fromIdx >= 0) {
      const afterFrom = title.slice(fromIdx + 6).trim();
      obj = pickFirstTitlecaseChunk(afterFrom);
    }
  } else if (hit.mode === "with") {
    // Prefer parsing after "with"
    const parts = right.split(/\bwith\b/i).map((s) => s.trim()).filter(Boolean);
    const afterWith = parts.length > 1 ? parts[1] : parts[0];
    obj = pickFirstTitlecaseChunk(afterWith);
    
    // Check for tertiary target (e.g., "into X stores", "for Y distribution")
    const tertiaryMatch = afterWith.match(/\b(?:into|for|at|through)\s+([A-Z][\w\s]+?)(?:\s+stores?|\s+distribution|\s+market)?\b/i);
    if (tertiaryMatch) {
      tertiary = cleanCandidate(tertiaryMatch[1]);
    }
  } else {
    // after-mode: first TitleCase chunk immediately after verb phrase
    const tail = title.slice(verbIdx).replace(hit.re, "").trim();
    obj = pickFirstTitlecaseChunk(tail);
  }

  const semantic_context = extractSemanticContext(title, verbIdx);

  return {
    frameType: hit.frameType,
    eventType: mapEventType(hit.frameType, hit.verbLabel, hit.id),
    verbMatched: hit.verbLabel,
    slots: { subject: subj, object: obj, tertiary },
    semantic_context,
    meta: { patternId: hit.id, confidence: hit.confidence, notes },
  };
}

/**
 * Convert ParsedFrame to CapitalEvent with v1.0.0 contract compliance
 * Adds: schema versioning, amount/round extraction, entity normalization
 */
export function toCapitalEvent(
  frame: ParsedFrame,
  publisher: string,
  url: string,
  title: string,
  publishedAt?: string
): CapitalEvent {
  // PHASE 1: Try inference engine first (FAST & FREE)
  // This catches 60-70% of events without complex regex parsing
  const inference = eventClassifier.classifyEvent(title);
  
  // If inference is confident (>0.6) and we don't have a strong frame match, use it
  const useInference = inference.confidence >= 0.6 && (
    frame.frameType === "UNKNOWN" || 
    frame.meta.confidence < 0.7 ||
    frame.frameType === "SELF_EVENT" && inference.type === "FUNDING" && inference.confidence > 0.75
  );
  
  if (useInference && inference.type !== 'OTHER') {
    // Override frame type with inference result
    frame.frameType = "SELF_EVENT"; // Most inference results are self-events
    frame.verbMatched = inference.reasoning?.split(':')[1]?.trim() || frame.verbMatched;
    frame.meta.confidence = Math.max(frame.meta.confidence, inference.confidence);
    frame.meta.notes = frame.meta.notes || [];
    frame.meta.notes.push(`inference:${inference.type}:${inference.confidence.toFixed(2)}`);
    
    // Add inferred startup name if we don't have one
    if (!frame.slots.subject && inference.name) {
      frame.slots.subject = inference.name;
    }
  }
  
  // Generate stable event ID from publisher + url (article URL, not feed URL)
  const event_id = generateEventId(publisher, url);
  
  // Extract amounts and round
  const amounts = parseAmount(title);
  const round = parseRound(title);
  
  // Normalize entities from slots
  const entities: CapitalEventEntity[] = [];
  
  if (frame.slots.subject && validateEntityQuality(frame.slots.subject)) {
    entities.push({
      name: frame.slots.subject,
      role: "SUBJECT",
      confidence: frame.meta.confidence,
      source: "frame",
    });
  }
  
  if (frame.slots.object && validateEntityQuality(frame.slots.object)) {
    // Detect if object is a CHANNEL (distributor/retailer pattern)
    const isChannel = /\b(Whole\s*Foods|Amazon|Walmart|Target|Best\s*Buy|CVS|Walgreens)\b/i.test(frame.slots.object);
    
    entities.push({
      name: frame.slots.object,
      role: isChannel ? "CHANNEL" : "OBJECT",
      confidence: frame.meta.confidence,
      source: "frame",
    });
  }
  
  if (frame.slots.tertiary && validateEntityQuality(frame.slots.tertiary)) {
    entities.push({
      name: frame.slots.tertiary,
      role: "COUNTERPARTY",
      confidence: frame.meta.confidence * 0.8, // Lower confidence for tertiary
      source: "frame",
    });
  }
  
  if (frame.slots.other && validateEntityQuality(frame.slots.other)) {
    entities.push({
      name: frame.slots.other,
      role: "COUNTERPARTY",
      confidence: frame.meta.confidence * 0.8,
      source: "frame",
    });
  }
  
  // FALLBACK: If no frame match (OTHER/UNKNOWN events), extract entities from headline directly
  // This handles "The Rippling/Deel...", "Inside Apple's...", "Capital One To Buy Brex..."
  if (frame.frameType === "UNKNOWN" && entities.length === 0) {
    // Clean headline: remove prefixes like "The ", "Inside ", "How "
    let cleanedTitle = title
      .replace(/^(The|A|An)\s+/i, "")
      .replace(/^(Inside|How|What|Why|When|Where|Watch|Meet|Ask|Why)\s+/i, "");
    
    // Remove trailing verbs and prepositions: "raises $10M", "wins contract"
    cleanedTitle = cleanedTitle.replace(/\s+(raises?|wins?|leads?|secures?|announces?|acquires?|takes?|gets?|lands?)\b.*$/i, "");
    
    // Extract company names more carefully:
    // 1. Look for "X/Y" patterns (e.g., "Rippling/Deel")
    const slashPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*\/\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/;
    const slashMatch = cleanedTitle.match(slashPattern);
    if (slashMatch) {
      const name1 = slashMatch[1].trim();
      const name2 = slashMatch[2].trim();
      if (validateEntityQuality(name1)) {
        entities.push({ name: name1, role: "SUBJECT", confidence: 0.6, source: "heuristic" });
      }
      if (validateEntityQuality(name2)) {
        entities.push({ name: name2, role: "OBJECT", confidence: 0.6, source: "heuristic" });
      }
    } else {
      // 2. Look for possessive patterns: "OpenAI's new..." → extract "OpenAI"
      const possessivePattern = /\b([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)?)'s\b/g;
      const possessiveMatches = [...cleanedTitle.matchAll(possessivePattern)];
      if (possessiveMatches.length > 0) {
        possessiveMatches.slice(0, 2).forEach((m, idx) => {
          const name = m[1].trim();
          if (name.length >= 2 && !["It", "How", "What", "Why", "The", "This"].includes(name) && validateEntityQuality(name)) {
            entities.push({
              name,
              role: idx === 0 ? "SUBJECT" : "OBJECT",
              confidence: 0.65,
              source: "heuristic",
            });
          }
        });
      }
      
      // 3. Extract up to first 2 TitleCase company names (max 3 words each)
      // Stop at common verbs to avoid "Capital One To Buy Fintech Startup Brex At Less..."
      if (entities.length === 0) {
        const beforeVerb = cleanedTitle.split(/\b(To|At|In|On|For|With|From|By|Is|Are|Has|Have|Will)\b/i)[0];
        const titlecasePattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/g;
        const matches = [...beforeVerb.matchAll(titlecasePattern)];
        
        // Filter out noise words and generic terms
        const stopWords = ["This", "That", "Their", "Some", "Many", "Most", "New", "Big", "Best", "Top", 
                          "Raises", "Wins", "Leads", "Takes", "Gets", "Launches", "Announces",
                          "January", "February", "March", "April", "May", "June", "July", "August", 
                          "September", "October", "November", "December", "Monday", "Tuesday", 
                          "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
        const companyNames = matches
          .map(m => m[1])
          .filter(name => !stopWords.includes(name) && name.length > 2 && validateEntityQuality(name))
          .slice(0, 2); // Max 2 entities for OTHER events
        
        companyNames.forEach((name, idx) => {
          entities.push({
            name,
            role: idx === 0 ? "SUBJECT" : "OBJECT",
            confidence: 0.5, // Low confidence for heuristic extraction
            source: "heuristic",
          });
        });
      }
    }
  }
  
  // Apply production guardrails (SSOT: FILTERED short-circuits before mapEventType)
  const isTopicHeadlineFlagged = isTopicHeadline(title);
  
  let finalEventType = frame.eventType;
  let finalConfidence = frame.meta.confidence;
  let filteredReason: string | undefined;
  
  // FILTERED short-circuit: only for topic headlines (newsletters, predictions)
  // Quality filtering moved to graph_safe gate - we still store FILTERED events
  if (isTopicHeadlineFlagged) {
    finalEventType = "FILTERED";
    finalConfidence = 0.0;
    filteredReason = "topic_headline";
    // Keep entities even for FILTERED (for event storage), but graph_safe will be false
  }
  
  // Build final event
  const event: CapitalEvent = {
    schema_version: "1.0.0",
    frame_engine_version: "jisstrecon-v2",
    event_id,
    occurred_at: publishedAt || new Date().toISOString(),
    source: {
      publisher,
      url,
      title,
      published_at: publishedAt,
    },
    event_type: finalEventType,
    verb: frame.verbMatched,
    frame_type: frame.frameType,
    frame_confidence: finalConfidence,
    subject: frame.slots.subject || null,
    object: frame.slots.object || null,
    tertiary: frame.slots.tertiary || null,
    entities,
    semantic_context: frame.semantic_context,
    amounts,
    round,
    notes: frame.meta.notes,
    extraction: {
      pattern_id: frame.meta.patternId,
      filtered_reason: filteredReason,
      fallback_used: finalConfidence < 0.8 || finalEventType === "OTHER" || finalEventType === "FILTERED",
      
      // PARSER IS SSOT: decision gates (no extractor judgment allowed)
      // ACCEPT = store event (even FILTERED/OTHER)
      // REJECT = truly junk (newsletters, predictions with no company names)
      decision: isTopicHeadline(title) && entities.length === 0 ? "REJECT" : "ACCEPT",
      
      // graph_safe = true ONLY when safe to create entity edges
      // validateEntityQuality moved HERE (from entity extraction)
      graph_safe: (
        finalEventType !== "FILTERED" &&
        finalConfidence >= 0.7 &&
        entities.length > 0 &&
        (
          entities.some(e => isOntologyKnown(e.name)) ||
          entities.some(e => validateEntityQuality(e.name))
        )
      ),
      reject_reason: isTopicHeadline(title) && entities.length === 0 ? filteredReason || "topic_headline" : undefined,
    },
  };
  
  return event;
}
