// src/services/rss/ontologyValidator.ts
// Semantic Ontology System for Entity Classification (Jisst Core)

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export type EntityCategory = 
  | 'STARTUP' 
  | 'INVESTOR' 
  | 'FOUNDER' 
  | 'EXECUTIVE'
  | 'PLACE' 
  | 'GENERIC_TERM' 
  | 'AMBIGUOUS'
  | 'UNKNOWN';

export type OntologyResult = {
  category: EntityCategory;
  confidence: number;
  source: 'DATABASE' | 'INFERENCE' | 'HEURISTIC';
  reasoning?: string;
};

/**
 * Tier 1: Lookup entity in ontology database
 */
async function lookupEntityOntology(entityName: string): Promise<OntologyResult | null> {
  const { data, error } = await supabase
    .from('entity_ontologies')
    .select('entity_type, confidence, source')
    .ilike('entity_name', entityName)
    .order('confidence', { ascending: false })
    .limit(1)
    .single();
  
  if (error || !data) return null;
  
  return {
    category: data.entity_type as EntityCategory,
    confidence: data.confidence,
    source: 'DATABASE',
  };
}

/**
 * Tier 2: Linguistic pattern detection
 */
function detectLinguisticPattern(entityName: string): OntologyResult | null {
  // Possessive pronouns
  if (/^(your|my|our|their|his|her)\s+/i.test(entityName)) {
    return {
      category: 'GENERIC_TERM',
      confidence: 1.0,
      source: 'HEURISTIC',
      reasoning: 'possessive_pronoun',
    };
  }
  
  // Prepositional phrases
  if (/\bfor\s+you\b/i.test(entityName) || /\bto\s+you\b/i.test(entityName)) {
    return {
      category: 'GENERIC_TERM',
      confidence: 1.0,
      source: 'HEURISTIC',
      reasoning: 'prepositional_phrase',
    };
  }
  
  // Pronouns
  if (/^(you|we|they|us|them)$/i.test(entityName)) {
    return {
      category: 'GENERIC_TERM',
      confidence: 1.0,
      source: 'HEURISTIC',
      reasoning: 'pronoun',
    };
  }
  
  // Generic plurals
  if (/^(researchers|founders|startups|vcs|investors|executives|leaders|people|companies)$/i.test(entityName)) {
    return {
      category: 'GENERIC_TERM',
      confidence: 1.0,
      source: 'HEURISTIC',
      reasoning: 'generic_plural',
    };
  }
  
  // Generic with adjective
  if (/(big|small|top|leading|major|several)\s+(vcs|investors|startups|founders)/i.test(entityName)) {
    return {
      category: 'GENERIC_TERM',
      confidence: 1.0,
      source: 'HEURISTIC',
      reasoning: 'adjective_generic',
    };
  }
  
  // Long descriptive phrases (likely statements, not names)
  if (entityName.split(' ').length > 6) {
    return {
      category: 'GENERIC_TERM',
      confidence: 0.9,
      source: 'HEURISTIC',
      reasoning: 'long_statement',
    };
  }
  
  return null;
}

/**
 * Tier 1: Role-based inference from event context
 */
async function inferFromRole(
  entityName: string,
  role: 'SUBJECT' | 'OBJECT',
  eventType: string,
  frameType: string
): Promise<OntologyResult | null> {
  const { data, error } = await supabase
    .from('role_inference_rules')
    .select('subject_likely_type, object_likely_type, confidence')
    .eq('event_type', eventType)
    .eq('frame_type', frameType)
    .limit(1)
    .single();
  
  if (error || !data) return null;
  
  const likelyType = role === 'SUBJECT' ? data.subject_likely_type : data.object_likely_type;
  
  return {
    category: likelyType as EntityCategory,
    confidence: data.confidence * 0.8, // Reduced confidence for inference
    source: 'INFERENCE',
    reasoning: `${role}_in_${eventType}_${frameType}`,
  };
}

/**
 * Heuristic: Geographic entity detection
 */
function detectGeographicEntity(entityName: string): OntologyResult | null {
  // Common country/region names
  const geoPatterns = [
    /^(Africa|Asia|Europe|America|Australia)$/i,
    /^(USA|UK|India|China|Japan|Germany|France|Brazil)$/i,
    /^(Silicon Valley|Bay Area|New York|London|Berlin)$/i,
  ];
  
  if (geoPatterns.some(pattern => pattern.test(entityName))) {
    return {
      category: 'PLACE',
      confidence: 0.95,
      source: 'HEURISTIC',
      reasoning: 'geographic_pattern',
    };
  }
  
  return null;
}

/**
 * Heuristic: Academic/institutional entity detection
 */
function detectInstitutionalEntity(entityName: string): OntologyResult | null {
  // Academic/research institutions
  if (/^(MIT|Stanford|Harvard|Cambridge)\s+(Researchers|Team|Scientists)/i.test(entityName)) {
    return {
      category: 'GENERIC_TERM',
      confidence: 1.0,
      source: 'HEURISTIC',
      reasoning: 'academic_institution',
    };
  }
  
  // Government entities
  if (/^(Former|Ex-)?\s*(USDS|CIA|FBI|NASA|Pentagon)\s+(Leaders|Officials)/i.test(entityName)) {
    return {
      category: 'GENERIC_TERM',
      confidence: 1.0,
      source: 'HEURISTIC',
      reasoning: 'government_entity',
    };
  }
  
  return null;
}

/**
 * Main validation function: Semantic entity classification
 */
export async function validateEntitySemantics(
  entityName: string,
  role: 'SUBJECT' | 'OBJECT',
  eventType: string,
  frameType: string
): Promise<OntologyResult> {
  // Step 1: Database lookup (highest confidence)
  const dbResult = await lookupEntityOntology(entityName);
  if (dbResult && dbResult.confidence >= 0.8) {
    return dbResult;
  }
  
  // Step 2: Linguistic pattern detection (Tier 2)
  const linguisticResult = detectLinguisticPattern(entityName);
  if (linguisticResult) {
    return linguisticResult;
  }
  
  // Step 3: Geographic entity detection
  const geoResult = detectGeographicEntity(entityName);
  if (geoResult) {
    return geoResult;
  }
  
  // Step 4: Institutional entity detection
  const instResult = detectInstitutionalEntity(entityName);
  if (instResult) {
    return instResult;
  }
  
  // Step 5: Role-based inference from event context
  const roleResult = await inferFromRole(entityName, role, eventType, frameType);
  if (roleResult && roleResult.confidence >= 0.7) {
    return roleResult;
  }
  
  // Step 6: Default to UNKNOWN
  return {
    category: 'UNKNOWN',
    confidence: 0.0,
    source: 'HEURISTIC',
    reasoning: 'no_classification_match',
  };
}

/**
 * Enhanced quality check: Use ontology classification
 * Returns true if entity is likely a STARTUP (for graph join)
 */
export async function isLikelyStartup(
  entityName: string,
  role: 'SUBJECT' | 'OBJECT',
  eventType: string,
  frameType: string
): Promise<boolean> {
  const result = await validateEntitySemantics(entityName, role, eventType, frameType);
  
  // Only create graph joins for:
  // 1. Confirmed startups (DATABASE lookup)
  // 2. High-confidence inferences in startup-likely contexts
  // 3. Unknown entities in SELF_EVENT contexts (likely startups talking about themselves)
  
  if (result.category === 'STARTUP' && result.confidence >= 0.8) {
    return true;
  }
  
  if (result.category === 'UNKNOWN' && frameType === 'SELF_EVENT' && eventType === 'FUNDING') {
    // "X raises $10M" → X is likely a startup
    return true;
  }
  
  if (result.category === 'UNKNOWN' && frameType === 'DIRECTIONAL' && eventType === 'INVESTMENT' && role === 'OBJECT') {
    // "Sequoia invests in X" → X is likely a startup
    return true;
  }
  
  return false;
}

/**
 * Quick sync validation (no database calls) for parser
 */
export function validateEntityQualitySync(entityName: string): boolean {
  // Basic sanity checks
  if (entityName.length < 2) return false;
  if (!/[a-zA-Z]/.test(entityName)) return false;
  
  // Expanded stoplist (sync version)
  const stopList = [
    'It', 'How', 'Why', 'What', 'When', 'Where', 'The', 'A', 'An',
    'Your', 'My', 'Our', 'Their', 'His', 'Her',
    'You', 'We', 'They', 'Us', 'Them',
    'For', 'To', 'With', 'At', 'In', 'On',
    'Researchers', 'Founders', 'Startups', 'VCs', 'Investors', 'Executives',
    'Africa', 'Asia', 'Europe', 'India', 'China', 'UK', 'USA',
  ];
  
  if (stopList.some(stop => entityName.toLowerCase() === stop.toLowerCase())) {
    return false;
  }
  
  // Generic patterns
  if (/(big|small|top|leading|major|several)\s+(vcs|investors|startups)/i.test(entityName)) {
    return false;
  }
  
  if (/^(MIT|Stanford|Harvard)\s+Researchers/i.test(entityName)) {
    return false;
  }
  
  // Too long (likely a statement)
  if (entityName.split(' ').length > 6) {
    return false;
  }
  
  return true;
}
