'use strict';

/**
 * Grammar-based signal extraction from news article text using the same ontology
 * as parseSignal / signalEventBuilder. Complements colloquial phrase detection in
 * signalDetector.js with structured ACTION_MAP / INFERENCE_MAP outputs.
 *
 * Used by inferenceService.extractDataFromArticles — no network I/O.
 */

const { parseMultiSignal } = require('./signalParser');
const { INFERENCE_MAP } = require('./signalOntology');

const DEFAULT_NEWS_OPTS = { source_type: 'news_article' };

/**
 * Split article prose into sentence-like chunks for per-sentence parsing.
 * @param {string} text
 * @returns {string[]}
 */
function sentenceSplit(text) {
  if (!text || typeof text !== 'string') return [];
  const raw = text.replace(/\s+/g, ' ').trim();
  if (raw.length < 12) return [];
  return raw
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 12 && s.length <= 420);
}

function collectCandidates(full_sentence_signal, sub_signals) {
  const out = [];
  if (full_sentence_signal && full_sentence_signal.primary_signal !== 'unclassified_signal') {
    out.push(full_sentence_signal);
  }
  for (const s of sub_signals || []) {
    if (s && s.primary_signal && s.primary_signal !== 'unclassified_signal') out.push(s);
  }
  return out;
}

function topCertainty(sig) {
  const actions = sig._actions || [];
  const top = actions[0];
  return top && typeof top.base_certainty === 'number' ? top.base_certainty : 0;
}

function meaningOf(sig) {
  const actions = sig._actions || [];
  const top = actions[0];
  return top && top.meaning ? String(top.meaning) : null;
}

/**
 * Run parseMultiSignal over sentence chunks; merge INFERENCE_MAP strategic hints.
 *
 * @param {string} text - Combined article title + body (caller may truncate)
 * @param {{ maxSentences?: number, parseOptions?: object }} [opts]
 * @returns {{
 *   signal_classes: Array<{ signal_class: string, best_certainty: number, snippet: string, meaning: string|null }>,
 *   inferred_strategic_needs: string[],
 *   evidence_snippets: Array<{ signal_class: string, text: string, certainty: number }>,
 *   detectedAt: string
 * }|null}
 */
function extractOntologyFromNewsText(text, opts = {}) {
  if (!text || typeof text !== 'string' || text.trim().length < 24) return null;

  const maxSentences = Math.min(48, Math.max(10, opts.maxSentences || 26));
  const parseOptions = { ...DEFAULT_NEWS_OPTS, ...(opts.parseOptions || {}) };

  const sentences = sentenceSplit(text).slice(0, maxSentences);
  if (sentences.length === 0) return null;

  const byPrimary = new Map();
  const inferredNeeds = new Set();
  const evidenceSnippets = [];
  const seenEvidence = new Set();

  for (const sent of sentences) {
    let full_sentence_signal;
    let sub_signals = [];
    try {
      ({ full_sentence_signal, sub_signals } = parseMultiSignal(sent, parseOptions));
    } catch {
      continue;
    }

    const candidates = collectCandidates(full_sentence_signal, sub_signals);
    for (const sig of candidates) {
      const ps = sig.primary_signal;
      if (!ps || ps === 'unclassified_signal') continue;

      const inf = INFERENCE_MAP[ps];
      if (inf && Array.isArray(inf.likely_need)) {
        for (const n of inf.likely_need) inferredNeeds.add(n);
      }

      const certainty = topCertainty(sig);
      const prev = byPrimary.get(ps);
      if (!prev || certainty > prev.best_certainty) {
        byPrimary.set(ps, {
          signal_class: ps,
          best_certainty: certainty,
          snippet: sent.slice(0, 220),
          meaning: meaningOf(sig),
        });
      }

      const key = `${ps}:${sent.slice(0, 80)}`;
      if (!seenEvidence.has(key) && evidenceSnippets.length < 14) {
        seenEvidence.add(key);
        evidenceSnippets.push({
          signal_class: ps,
          text: sent.slice(0, 200),
          certainty,
        });
      }
    }
  }

  if (byPrimary.size === 0 && inferredNeeds.size === 0) return null;

  const signal_classes = Array.from(byPrimary.values()).sort((a, b) => b.best_certainty - a.best_certainty);

  return {
    signal_classes,
    inferred_strategic_needs: Array.from(inferredNeeds).slice(0, 28),
    evidence_snippets: evidenceSnippets.sort((a, b) => b.certainty - a.certainty).slice(0, 12),
    detectedAt: new Date().toISOString(),
  };
}

module.exports = {
  extractOntologyFromNewsText,
  sentenceSplit,
};
