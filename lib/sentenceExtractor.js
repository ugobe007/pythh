'use strict';

/**
 * SENTENCE-MODE MULTI-NAME EXTRACTOR
 * ====================================
 * Thin wrapper around lib/sentenceParser.js — the full ontological structural
 * parser (10 patterns, P1-P10). Kept as a separate module so existing consumers
 * that import from `sentenceExtractor` don't need to change their require() path.
 *
 * Handles patterns like:
 *   A) "another drop from NAME, ..."          — preposition reveal       (P3)
 *   B) "when NAME improves their UI, ..."     — subject before action    (P9/P10)
 *   C) "Dubai's NAME is launched, ..."        — possessive geo prefix    (P5)
 *   D) "limits that NAME helps developers..." — relative clause          (P6)
 *   E) "noisy data like NAME..."              — enumeration/comparison   (P4)
 *   F) "like NAME1 that does... and NAME2..." — multi-name enumeration   (P7)
 *   G) "we believe NAME is the best..."       — cognitive verb + copula  (P8)
 *
 * Returns: string[] — all valid startup names found (may be empty, 1, or many)
 */

const { extractNames, extractName } = require('./sentenceParser');

module.exports = { extractNames, extractName };
