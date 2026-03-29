'use strict';

/**
 * SENTENCE-MODE MULTI-NAME EXTRACTOR
 * Delegates to lib/sentenceParser.js — the full ontological structural parser.
 * This file is kept for backward compatibility with existing consumers.
 * ====================================
 * Extracts one or more startup names from natural language sentences.
 * Used as a fallback when the headline-mode parser finds no match.
 *
 * Handles patterns like:
 *   A) "another drop from NAME, ..."          — preposition reveal
 *   B) "when NAME improves their UI, ..."     — subject before action
 *   C) "Dubai's NAME is launched, ..."        — possessive geo prefix
 *   D) "limits that NAME helps developers..." — relative clause
 *   E) "noisy data like NAME..."              — enumeration/comparison
 *   F) "like NAME1 that does... and NAME2..." — multi-name enumeration
 *   G) "we believe NAME is the best..."       — cognitive verb + complement
 *
 * Returns: string[] — all valid startup names found (may be empty, 1, or many)
 */

// Route all extraction through the structural parser
const { extractNames: _extractNames, extractName: _extractName } = require('./sentenceParser');
const { isValidStartupName } = require('./startupNameValidator');

// ─── Signal word sets ─────────────────────────────────────────────────────────

// Prepositions that immediately precede a name
const PREP_TRIGGERS = new Set([
  'from', 'by', 'via', 'at', 'with', 'behind', 'within', 'through',
]);

// Words that introduce a name as an example or member of a group
const ENUM_TRIGGERS = new Set([
  'like', 'including', 'notably', 'especially', 'particularly', 'namely',
]);

// Pronouns that appear right after a subject name (confirm it's an entity)
const ENTITY_PRONOUNS = new Set([
  'their', 'its', "it's", 'our', 'your', 'his', 'her',
]);

// Relative/subordinate connectives that can introduce a clause about a name
const RELATIVE_WORDS = new Set(['that', 'which', 'who', 'where', 'whose']);

// Verbs after "believe X is..." patterns
const COGNITIVE_VERBS = new Set([
  'believe', 'think', 'know', 'expect', 'hope', 'say', 'said',
  'claim', 'claimed', 'argue', 'argued', 'note', 'noted', 'see',
  'find', 'found', 'report', 'reported', 'show', 'showed',
]);

// Copular/auxiliary verbs that confirm a preceding name is a subject
const COPULA = /^(is|are|was|were|has|have|had|does|do|did|will|can|may|might|should|would|could)$/i;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Strip leading/trailing punctuation from a word */
function clean(w) {
  return w.replace(/^['"([\-–]+|['")\],;:.!?–\-]+$/g, '').trim();
}

/**
 * From position `startIdx` in a word array, collect a contiguous run of
 * Title-Case words (up to `maxWords`). Returns the joined string or null.
 *
 * "Stripe Atlas drives" → startIdx=0, maxWords=3 → "Stripe Atlas"
 * (stops when it hits "drives" which starts lowercase)
 */
function getTitleCaseChunk(words, startIdx, maxWords = 4) {
  const result = [];
  for (let i = startIdx; i < Math.min(startIdx + maxWords, words.length); i++) {
    const w = clean(words[i]);
    if (!w) break;
    // Stop if the word starts lowercase (not a proper noun / brand)
    if (!/^[A-Z]/.test(w)) break;
    // Stop if it looks like a sentence-start common word (capitalized because
    // it starts a clause, not because it's a brand name)
    result.push(w);
  }
  return result.length > 0 ? result.join(' ') : null;
}

/**
 * Validate a candidate name and add it to the result set.
 * Strips trailing generic suffixes before validating.
 */
function addCandidate(candidate, found) {
  if (!candidate || candidate.length < 2) return;
  const trimmed = candidate
    .replace(/[,;:.!?'"]+$/, '')
    .replace(/\s+(startup|company|platform|app|tool|inc|llc|ltd)$/i, '')
    .trim();
  if (trimmed.length < 2) return;
  const check = isValidStartupName(trimmed);
  if (check.isValid) found.add(trimmed);
}

// ─── Core extractor ──────────────────────────────────────────────────────────

/**
 * Extract all startup names from a natural language sentence.
 *
 * @param {string} text
 * @returns {string[]} — deduplicated list of valid startup names
 */
function extractNames(text) {
  if (!text || typeof text !== 'string' || text.trim().length < 5) return [];

  const found = new Set();
  const words = text.split(/\s+/);
  const lc = (w) => clean(w).toLowerCase();

  for (let i = 0; i < words.length; i++) {
    const w = lc(words[i]);
    const wRaw = words[i];

    // ── Pattern A: preposition + Title-Case ──────────────────────────────────
    // "another drop from Stripe, ..."
    if (PREP_TRIGGERS.has(w) && i + 1 < words.length) {
      addCandidate(getTitleCaseChunk(words, i + 1), found);
    }

    // ── Pattern C: [GEO/WORD]'s [Name] ──────────────────────────────────────
    // "Dubai's Tabby is launched" — possessive prefix
    if (/^[A-Z][a-zA-Z]+'s$/.test(wRaw) && i + 1 < words.length) {
      addCandidate(getTitleCaseChunk(words, i + 1), found);
    }

    // ── Pattern E: enumeration / comparison trigger ───────────────────────────
    // "startups like Stripe and Plaid..."
    if (ENUM_TRIGGERS.has(w) && i + 1 < words.length) {
      addCandidate(getTitleCaseChunk(words, i + 1), found);
    }
    // "such as Stripe" — two-word trigger
    if (w === 'such' && lc(words[i + 1]) === 'as' && i + 2 < words.length) {
      addCandidate(getTitleCaseChunk(words, i + 2), found);
    }
    // "as well as Stripe" — three-word trigger
    if (w === 'as' && lc(words[i + 1]) === 'well' && lc(words[i + 2]) === 'as' && i + 3 < words.length) {
      addCandidate(getTitleCaseChunk(words, i + 3), found);
    }

    // ── Pattern D: relative clause "that/which [Name] [verb]" ────────────────
    // "policy limits that Cased helps AI developers set"
    if (RELATIVE_WORDS.has(w) && i + 1 < words.length) {
      const chunk = getTitleCaseChunk(words, i + 1);
      if (chunk) {
        const chunkLen = chunk.split(' ').length;
        const afterWord = lc(words[i + 1 + chunkLen] || '');
        // After the chunk must be a lowercase word (a verb or article)
        if (afterWord && !/^[A-Z]/.test(words[i + 1 + chunkLen] || '')) {
          addCandidate(chunk, found);
        }
      }
    }

    // ── Pattern B: [Name] [verb?] their/its ──────────────────────────────────
    // "when Notion improves their UI" — entity pronoun within 3 words of name
    if (/^[A-Z]/.test(wRaw)) {
      const chunk = getTitleCaseChunk(words, i);
      if (chunk) {
        const chunkLen = chunk.split(' ').length;
        // Look up to 3 words ahead of the chunk for an entity pronoun
        for (let j = 1; j <= 3 && i + chunkLen - 1 + j < words.length; j++) {
          const ahead = lc(words[i + chunkLen - 1 + j]);
          if (ENTITY_PRONOUNS.has(ahead)) {
            addCandidate(chunk, found);
            break;
          }
          // Stop scanning if we hit another capitalized word
          if (/^[A-Z]/.test(words[i + chunkLen - 1 + j])) break;
        }
      }
    }

    // ── Pattern F: conjunction + [Name] + relative/entity-pronoun ────────────
    // "like NAME1 that does... and NAME2 that offers..."
    if ((w === 'and' || w === 'but' || w === 'or') && i + 1 < words.length) {
      const chunk = getTitleCaseChunk(words, i + 1);
      if (chunk) {
        const chunkLen = chunk.split(' ').length;
        const afterLow = lc(words[i + 1 + chunkLen] || '');
        if (RELATIVE_WORDS.has(afterLow) || ENTITY_PRONOUNS.has(afterLow)) {
          addCandidate(chunk, found);
        }
      }
    }

    // ── Pattern G: cognitive verb + [Name] + copula ───────────────────────────
    // "we believe Stripe is the best choice"
    if (COGNITIVE_VERBS.has(w) && i + 1 < words.length) {
      const chunk = getTitleCaseChunk(words, i + 1);
      if (chunk) {
        const chunkLen = chunk.split(' ').length;
        const afterWord = words[i + 1 + chunkLen] || '';
        if (COPULA.test(afterWord)) {
          addCandidate(chunk, found);
        }
      }
    }
  }

  return [...found];
}

/**
 * Convenience: extract a single best name from a sentence.
 * Returns the first valid name found, or null.
 *
 * @param {string} text
 * @returns {string|null}
 */
function extractName(text) {
  const names = extractNames(text);
  return names.length > 0 ? names[0] : null;
}

// Override the trigger-matching implementations with structural parser output
function extractNames(text) { return _extractNames(text); }
function extractName(text)  { return _extractName(text); }

module.exports = { extractNames, extractName };
