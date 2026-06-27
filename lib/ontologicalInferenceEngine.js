'use strict';

/**
 * Ontological Inference Engine
 *
 * Uses inference over ontological phrases, word constructs, and word strings to identify:
 *   - objects      — startups, investors, founders (named entities + roles)
 *   - conditions   — verb + description (signal state)
 *   - variables    — time, location, association, temperature, populus, stage, sector
 *   - results      — outcomes inferred from actions and strategic meanings
 *
 * Composes signalParser (grammar) + ontologicalPhrases (constructs) + nameEntityOntology (typing).
 */

const { parseSignal, parseMultiSignal } = require('./signalParser');
const {
  PHRASE_CONSTRUCTS,
  ROLE_INFERENCE,
  ENTITY_SLOT_PATTERNS,
  cleanEntityName,
} = require('./ontologicalPhrases');
const {
  sanitizeOntologyObjects,
  extractCompanyFromHeadlineSubject,
} = require('./rssOntologyPrep');

let classifyEntityType = () => null;
try {
  classifyEntityType = require('./nameEntityOntology').classifyEntityType;
} catch {
  /* optional */
}

const ENGINE_VERSION = '1.0.0';

const LOCATION_PATTERNS = [
  { re: /\b(?:based in|headquartered in|hq in|located in)\s+([A-Z][a-zA-Z\s,.-]{2,40})/i, geo_type: 'hq' },
  { re: /\b(?:expand(?:s|ing|ed)?\s+into|enter(?:s|ing|ed)?\s+(?:the\s+)?(?:market in\s+)?)\s*([A-Z][a-zA-Z\s,.-]{2,40})/i, geo_type: 'expansion' },
  { re: /\bin\s+(San Francisco|New York|London|Berlin|Paris|Singapore|Boston|Austin|Tel Aviv|Bangalore|Mumbai|Toronto|Sydney|Seattle|Los Angeles|Chicago|Dubai|Stockholm|Amsterdam|Europe|Asia|India|Africa|LatAm)\b/i, geo_type: 'presence' },
  { re: /\b(?:from)\s+(San Francisco|New York|London|Berlin|Paris|Singapore|Boston|Austin|Tel Aviv|Bangalore|Mumbai|Toronto|Sydney|Seattle|Los Angeles|Chicago|Dubai|Stockholm|Amsterdam)\b/i, geo_type: 'origin' },
];

const ASSOCIATION_PATTERNS = [
  { type: 'syndicate', re: /\b(?:backed by|co-?led by|alongside|with participation from|syndicate including)\s+(.+?)(?:[,.]|$|\s+(?:at|in|for)\s)/i },
  { type: 'partnership', re: /\b(?:partners?\s+with|teams?\s+up\s+with|collaborat(?:es|ed|ing)\s+with)\s+(.+?)(?:[,.]|$)/i },
  { type: 'investor_interest', re: /\b(?:in talks with|speaking with|in discussions with)\s+(.+?)(?:[,.]|$)/i },
];

const POPULUS_PATTERNS = [
  { re: /(\d+(?:\.\d+)?)\s*(million|billion|thousand|k|m|b)\+?\s*(users|customers|developers|companies|startups|employees|merchants|patients|members|subscribers)/gi, scale: 'numeric' },
  { re: /\b(millions?|billions?|thousands?)\s+of\s+(users|customers|people|developers|businesses)/gi, scale: 'qualitative' },
  { re: /\b(global|worldwide|international)\s+(audience|market|customer base|user base|footprint)/gi, scale: 'global' },
  { re: /\b(enterprise customers?|fortune 500|mid-market customers?)/gi, scale: 'segment' },
];

const CAPITALIZED_NAME_RE = /\b([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9&.-]+){0,4})\b/g;

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function inferEntityType(name, roleHint) {
  if (roleHint === 'investor') return 'INVESTOR';
  if (roleHint === 'startup') return 'STARTUP';
  const ont = classifyEntityType(name);
  if (ont === 'person') return roleHint === 'investor' ? 'INVESTOR' : 'FOUNDER';
  if (ont === 'geographic') return 'PLACE';
  if (ont === 'brand' || ont === 'media' || ont === 'government') return 'GENERIC';
  if (/\b(capital|ventures|partners|vc|fund|investments?|holdings|a16z)\b/i.test(name)) return 'INVESTOR';
  if (/\b(inc|labs|ai|io|tech|systems|software|health|bio|robotics)\b/i.test(name)) return 'STARTUP';
  return 'UNKNOWN';
}

function detectPhraseConstructs(text) {
  const found = [];
  for (const p of PHRASE_CONSTRUCTS) {
    const m = text.match(p.re);
    if (m) {
      found.push({
        id: p.id,
        construct: p.construct,
        label: p.label,
        weight: p.weight,
        span: m[0],
      });
    }
  }
  return found.sort((a, b) => b.weight - a.weight);
}

function inferFrameType(signal, constructs) {
  if (constructs.some((c) => c.id === 'acquisition_directional')) return 'ACQUISITION';
  if (constructs.some((c) => c.id === 'investment_directional')) return 'INVESTMENT';
  if (constructs.some((c) => c.id === 'self_funding')) return 'FUNDING';
  if (constructs.some((c) => c.id === 'var_association_partnership')) return 'PARTNERSHIP';

  const ps = signal?.primary_signal || '';
  if (ps === 'fundraising_signal' && /\bled\b/i.test(signal?.raw_text || '')) return 'INVESTMENT';
  if (ps === 'fundraising_signal') return 'FUNDING';
  if (ps === 'investor_interest_signal' || ps === 'investor_rejection_signal') return 'INVESTMENT';
  if (ps === 'acquisition_signal') return 'ACQUISITION';
  if (ps === 'product_signal') return 'LAUNCH';
  if (ps === 'hiring_signal' || ps === 'gtm_hiring_signal' || ps === 'engineering_hiring_signal') return 'EXEC_CHANGE';
  return null;
}

function extractSlotEntities(text, frameType, options = {}) {
  const { startupName, source_type } = options;
  const objects = [];
  const seen = new Set();

  if (frameType === 'FUNDING' && startupName && startupName.length >= 2) {
    const anchorRe = new RegExp(
      `\\b(${escapeRe(startupName)})\\s+(?:raises?|raised|secured|closes?|closed)\\b`,
      'i',
    );
    const anchorMatch = text.match(anchorRe);
    if (anchorMatch) {
      const name = startupName.trim();
      seen.add(name.toLowerCase());
      objects.push({
        name,
        entity_type: 'STARTUP',
        role: 'startup',
        span: anchorMatch[1],
        confidence: 0.91,
        source: 'startup_anchor',
      });
    }
  }

  for (const slot of ENTITY_SLOT_PATTERNS) {
    if (frameType && slot.frame !== frameType) continue;
    const m = text.match(slot.re);
    if (!m) continue;

    if (m[1]) {
      const rawSubject = m[1].trim();
      const name =
        slot.subjectRole === 'startup'
          ? extractCompanyFromHeadlineSubject(rawSubject, startupName) || cleanEntityName(rawSubject)
          : cleanEntityName(rawSubject);
      if (name && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        objects.push({
          name,
          entity_type: inferEntityType(name, slot.subjectRole),
          role: slot.subjectRole,
          span: m[1].trim(),
          confidence: 0.82,
          source: 'slot_pattern',
        });
      }
    }
    if (m[2] && slot.objectRole) {
      const name = cleanEntityName(m[2]);
      if (name && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        objects.push({
          name,
          entity_type: inferEntityType(name, slot.objectRole),
          role: slot.objectRole,
          span: m[2].trim(),
          confidence: 0.80,
          source: 'slot_pattern',
        });
      }
    }
  }

  const newsAnchored = source_type === 'news_article' && startupName && startupName.length >= 2;
  let cap;
  while ((cap = CAPITALIZED_NAME_RE.exec(text)) !== null) {
    const name = cleanEntityName(cap[1]);
    if (!name || seen.has(name.toLowerCase())) continue;
    if (name.split(/\s+/).length > 5) continue;
    const entityType = inferEntityType(name);
    if (newsAnchored && entityType !== 'INVESTOR') continue;
    seen.add(name.toLowerCase());
    const role = entityType === 'INVESTOR' ? 'investor' : 'entity';
    objects.push({
      name,
      entity_type: entityType,
      role,
      span: cap[1],
      confidence: newsAnchored ? 0.72 : 0.55,
      source: 'capitalization_heuristic',
    });
  }

  return objects.slice(0, 8);
}

function enrichObjectsFromActor(objects, signal, frameType) {
  const roleMap = frameType ? ROLE_INFERENCE[frameType] : null;
  if (roleMap && objects.length === 0 && signal?.actor) {
    const actorType = signal.actor.includes('investor')
      ? 'INVESTOR'
      : signal.actor.includes('founder')
        ? 'FOUNDER'
        : signal.actor.includes('startup')
          ? 'STARTUP'
          : 'UNKNOWN';
    objects.push({
      name: null,
      entity_type: actorType,
      role: roleMap.subject?.toLowerCase() || 'actor',
      span: signal.actor,
      confidence: 0.65,
      source: 'actor_grammar',
    });
  }
  return objects;
}

function buildConditions(signal) {
  if (!signal) return [];
  const actions = signal._actions || [];
  return actions.slice(0, 4).map((a) => ({
    verb: a.action_tag || signal.action,
    verb_phrase: a.meaning || a.action_tag,
    description: a.meaning || signal.primary_signal,
    signal_class: a.signal_class,
    modality: signal.modality?.class || null,
    certainty: a.base_certainty ?? signal.confidence ?? 0.5,
    negated: signal.negation_detected || false,
  }));
}

function extractLocations(text, signal) {
  const locations = [];
  const seen = new Set();
  for (const { re, geo_type } of LOCATION_PATTERNS) {
    const m = text.match(re);
    if (!m) continue;
    const label = (m[1] || m[0]).trim().replace(/[,.]$/, '');
    if (!label || seen.has(label.toLowerCase())) continue;
    seen.add(label.toLowerCase());
    locations.push({
      label,
      geo_type,
      span: m[0],
      confidence: 0.78,
    });
  }
  // Context tags from signal ontology (geo)
  for (const tag of signal?.context || []) {
    if (tag.startsWith('context_geo_') && !seen.has(tag)) {
      seen.add(tag);
      locations.push({
        label: tag.replace('context_geo_', '').replace(/_/g, ' '),
        geo_type: 'context_tag',
        span: tag,
        confidence: 0.70,
      });
    }
  }
  return locations.slice(0, 6);
}

function extractAssociations(text) {
  const out = [];
  for (const { type, re } of ASSOCIATION_PATTERNS) {
    const m = text.match(re);
    if (!m) continue;
    const parties = (m[1] || '')
      .split(/\s*,\s*|\s+and\s+|\s+&\s+/i)
      .map(cleanEntityName)
      .filter(Boolean);
    if (parties.length) {
      out.push({
        type,
        parties,
        span: m[0],
        confidence: 0.80,
      });
    }
  }
  return out.slice(0, 4);
}

function extractPopulus(text) {
  const out = [];
  const seen = new Set();
  for (const { re, scale } of POPULUS_PATTERNS) {
    const flags = re.global ? 'g' : '';
    const regex = re.global ? re : new RegExp(re.source, re.flags + flags);
    let m;
    while ((m = regex.exec(text)) !== null) {
      const span = m[0];
      const key = span.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        scale,
        label: span.trim(),
        span,
        confidence: scale === 'numeric' ? 0.88 : 0.72,
      });
    }
  }
  return out.slice(0, 5);
}

function extractTemperature(signal, constructs) {
  const levels = [];
  const intensity = signal?.intensity || [];
  const posture = signal?.posture || [];

  if (constructs.some((c) => c.id === 'var_temperature_hot')) {
    levels.push({ level: 'hot', label: 'high market heat', drivers: ['construct'], confidence: 0.85 });
  }
  if (constructs.some((c) => c.id === 'var_temperature_cold')) {
    levels.push({ level: 'cold', label: 'cooling conditions', drivers: ['construct'], confidence: 0.82 });
  }
  for (const i of intensity) {
    if (i.weight > 0) {
      levels.push({
        level: i.weight >= 0.12 ? 'hot' : 'warm',
        label: `intensity: ${i.word}`,
        drivers: ['intensity'],
        confidence: 0.75,
      });
    } else if (i.weight < 0) {
      levels.push({
        level: 'cool',
        label: `dampener: ${i.word}`,
        drivers: ['intensity'],
        confidence: 0.70,
      });
    }
  }
  for (const p of posture) {
    if (p.posture === 'posture_confident') {
      levels.push({ level: 'warm', label: 'confident posture', drivers: ['posture'], confidence: 0.72 });
    }
    if (p.posture === 'posture_distressed') {
      levels.push({ level: 'cold', label: 'distress posture', drivers: ['posture'], confidence: 0.80 });
    }
  }
  if (signal?.primary_signal === 'fundraising_signal' && (signal._actions?.[0]?.base_certainty ?? 0) >= 0.9) {
    levels.push({ level: 'hot', label: 'strong fundraising signal', drivers: ['signal_class'], confidence: 0.82 });
  }
  return levels.slice(0, 5);
}

function buildVariables(text, signal, constructs) {
  const time = (signal?.time || []).map((t) => ({
    tag: t.tag,
    label: t.label || t.tag,
    proximity: t.proximity ?? null,
    span: t.span || null,
    confidence: 0.75,
  }));

  const verbTense = (signal?.verb_tense || []).map((v) => ({
    aspect: v.aspect,
    meaning: v.meaning,
    weight: v.weight,
    kind: 'time_grammar',
  }));

  const stageTags = (signal?.context || []).filter((c) => c.startsWith('context_stage_'));
  const sectorTags = (signal?.context || []).filter((c) => c.startsWith('context_sector_'));

  return {
    time,
    verb_tense: verbTense,
    time_bucket: signal?.time_bucket || null,
    location: extractLocations(text, signal),
    association: extractAssociations(text),
    temperature: extractTemperature(signal, constructs),
    populus: extractPopulus(text),
    stage: stageTags[0]?.replace('context_stage_', '').replace(/_/g, ' ') || null,
    sector: sectorTags.map((s) => s.replace('context_sector_', '').replace(/_/g, ' ')).slice(0, 4),
  };
}

function buildResults(signal, constructs) {
  const results = [];
  if (!signal || signal.negation_detected) return results;

  for (const c of constructs.filter((x) => x.construct === 'result_frame')) {
    results.push({
      outcome: c.label,
      signal_class: signal.primary_signal,
      inferred_meanings: signal.inferred_meanings || [],
      confidence: c.weight,
      source: 'phrase_construct',
    });
  }

  if (signal.inferred_meanings?.length) {
    results.push({
      outcome: signal.inferred_meanings[0],
      signal_class: signal.primary_signal,
      inferred_meanings: signal.inferred_meanings,
      confidence: signal.confidence ?? 0.6,
      source: 'strategic_inference',
    });
  }

  if (signal.primary_signal && signal.primary_signal !== 'unclassified_signal' && results.length === 0) {
    const inf = signal.inference;
    results.push({
      outcome: inf?.likely_need?.[0] || signal._actions?.[0]?.meaning || signal.primary_signal,
      signal_class: signal.primary_signal,
      inferred_meanings: signal.inferred_meanings || [],
      confidence: signal.signal_strength ?? signal.confidence ?? 0.5,
      source: 'signal_class',
    });
  }

  return results.slice(0, 5);
}

/**
 * Infer a full ontological frame from a sentence or short passage.
 *
 * @param {string} text
 * @param {{ source_type?: string, multi?: boolean }} [options]
 */
function inferOntologicalFrame(text, options = {}) {
  if (!text || typeof text !== 'string' || text.trim().length < 8) return null;

  const cleaned = text.replace(/\s+/g, ' ').trim();
  const parseOpts = { source_type: options.source_type || 'news_article' };

  const { full_sentence_signal, sub_signals } = parseMultiSignal(cleaned, parseOpts);
  const signal = full_sentence_signal;
  if (!signal) return null;

  const constructs = detectPhraseConstructs(cleaned);
  const frameType = inferFrameType(signal, constructs);

  let objects = extractSlotEntities(cleaned, frameType, {
    startupName: options.startupName,
    source_type: parseOpts.source_type,
  });
  objects = enrichObjectsFromActor(objects, signal, frameType);

  // Re-type objects using frame role inference when we have slots
  const roleInf = frameType ? ROLE_INFERENCE[frameType] : null;
  if (roleInf) {
    for (const obj of objects) {
      if (obj.role === 'investor' || obj.role === 'subject' && roleInf.subject === 'INVESTOR') {
        obj.entity_type = obj.entity_type === 'UNKNOWN' ? 'INVESTOR' : obj.entity_type;
      }
      if (obj.role === 'startup' || obj.role === 'object') {
        obj.entity_type = obj.entity_type === 'UNKNOWN' ? 'STARTUP' : obj.entity_type;
      }
    }
  }

  objects = sanitizeOntologyObjects(objects, {
    startupName: options.startupName,
    sourceType: parseOpts.source_type,
    text: cleaned,
  });

  return {
    engine_version: ENGINE_VERSION,
    raw_text: cleaned,
    frame_type: frameType,
    phrase_constructs: constructs,
    objects,
    conditions: buildConditions(signal),
    variables: buildVariables(cleaned, signal, constructs),
    results: buildResults(signal, constructs),
    signal: {
      primary_signal: signal.primary_signal,
      confidence: signal.confidence,
      evidence_quality: signal.evidence_quality,
      actor: signal.actor,
      object_tag: signal.object,
    },
    sub_signals: (sub_signals || []).map((s) => ({
      primary_signal: s.primary_signal,
      confidence: s.confidence,
      action: s.action,
    })),
    inferred_at: new Date().toISOString(),
  };
}

/**
 * Infer ontological frames from a longer passage (sentence-split).
 *
 * @param {string} text
 * @param {{ maxSentences?: number, source_type?: string }} [options]
 */
function inferOntologicalFrames(text, options = {}) {
  if (!text || typeof text !== 'string') return { frames: [], summary: null };

  const maxSentences = Math.min(32, Math.max(4, options.maxSentences || 16));
  const sentences = text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 12 && s.length <= 500)
    .slice(0, maxSentences);

  const frames = [];
  for (const sent of sentences) {
    const frame = inferOntologicalFrame(sent, options);
    if (frame && frame.signal.primary_signal !== 'unclassified_signal') {
      frames.push(frame);
    }
  }
  const allObjects = new Map();
  const allResults = new Map();
  for (const f of frames) {
    for (const o of f.objects) {
      if (o.name) allObjects.set(o.name.toLowerCase(), o);
    }
    for (const r of f.results) {
      allResults.set(r.outcome, r);
    }
  }

  return {
    frames,
    summary: {
      frame_count: frames.length,
      startups: [...allObjects.values()].filter((o) => o.entity_type === 'STARTUP').map((o) => o.name),
      investors: [...allObjects.values()].filter((o) => o.entity_type === 'INVESTOR').map((o) => o.name),
      primary_signals: [...new Set(frames.map((f) => f.signal.primary_signal))],
      results: [...allResults.values()].slice(0, 8),
    },
    inferred_at: new Date().toISOString(),
  };
}

module.exports = {
  ENGINE_VERSION,
  inferOntologicalFrame,
  inferOntologicalFrames,
  detectPhraseConstructs,
};
