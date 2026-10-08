'use strict';

/**
 * Data brain — read the corpus we already store and say what it is doing.
 *
 * It does not invent companies, rounds, or quotes, and it does not change
 * GOD component weights. Two consumers:
 *   1. Scoring withholds headline and boilerplate sentences from the text
 *      patterns that were standing in for traction.
 *   2. Matching, when a startup has no specific sector, may treat a learned
 *      term as that sector so the candidate pool and the sector score agree.
 */

const PACK_VERSION = 'data-brain-v1';
const HIGH_SIGNAL = 6.5;
const MIN_TERM_DOCS = 5;
const MIN_HIGH_DOCS = 3;
const MIN_HINT_SUPPORT = 5;
const MIN_LIFT = 1.8;
const MIN_SECTOR_SHARE = 0.55;

const GENERIC_SECTORS = new Set([
  'technology', 'tech', 'software', 'internet', 'saas', 'b2b', 'enterprise',
  'ai', 'ai/ml', 'artificial intelligence', 'machine learning',
]);

const STOP = new Set(`
  about after also their them they this that with from into over under
  than then them your you are was were been being have has had will
  would could should just more most some such only other into onto
  company companies startup startups platform platforms solution solutions
  focused focus helping customers customer achieve better outcomes through
  technology technology-driven innovative innovation software based using
  world first every across early stage fund funds founder founders build
  building product products market markets business businesses global
  provides provide offering offers designed design aims aim help helps
  making make made which while where when what their these those
`.split(/\s+/).filter(Boolean));

const SHORT_OK = new Set(['ai', 'ml', 'gpu', 'api', 'llm', 'b2b']);

const VAGUE = new Set(`
  ability areas brands check public entrepreneur spend innovators must
  magnitude strength greatest matter time just only when winner create
  want live people things thing really very much many make made
  cutting edge management independent leading powered based next class
  innovating transforming empowering performance disrupting revolutionizing
  revolutionizing leveraging enabling unlocking seamless intelligent smarter
`.split(/\s+/).filter(Boolean));

let activePack = null;

function setActiveBrainPack(pack) {
  activePack = pack && typeof pack === 'object' ? pack : null;
  return activePack;
}

function getActiveBrainPack() {
  return activePack;
}

function splitSentences(text) {
  const raw = String(text || '').replace(/\s+/g, ' ').trim();
  if (!raw) return [];
  const parts = raw.split(/(?<=[.!?])\s+/).map((part) => part.trim()).filter(Boolean);
  return parts.length ? parts : [raw];
}

function isHeadlineSentence(sentence) {
  const text = String(sentence || '').trim();
  if (!text) return false;
  if (/appeared first on|pulse 2\.0|\bthe post\b/i.test(text)) return true;
  if (/\b(raised|raises|raising|secures|secured|bags|nabs|closes|closed)\b/i.test(text)
    && /(\$|series\s+[a-e]|funding|valuation)/i.test(text)) return true;
  if (/\bseries\s+[a-e]\b/i.test(text) && /\b(led by|valuation|funding|round)\b/i.test(text)) return true;
  if (/\bvaluation (above|of|at)\b/i.test(text)) return true;
  if (/\bclosed\b/i.test(text) && /\bfund\b/i.test(text)) return true;
  return false;
}

function isBoilerplateSentence(sentence) {
  const text = String(sentence || '').trim();
  if (!text) return false;
  if (/\ba company focused on\b/i.test(text)) return true;
  if (/\binnovative solutions\b/i.test(text)) return true;
  if (/\btechnology-driven approaches\b/i.test(text)) return true;
  if (/\bhelping customers achieve better outcomes\b/i.test(text)) return true;
  if (/\bsecurity solutions provider\b/i.test(text) && text.length < 90) return true;
  if (/,\s+[A-Z][\p{L}'-]+(?:\s+[A-Z][\p{L}'-]+){1,2}\s+(?:CPO|CEO|CTO|CFO)\b/u.test(text)) return true;
  if (text.length < 90
    && /\b(is|are)\s+an?\b/i.test(text)
    && /\b(platform|provider|company|solutions)\b/i.test(text)
    && !/\b(for|that|which|with|by)\b/i.test(text)) return true;
  return false;
}

function keepProductSentences(text) {
  const sentences = splitSentences(text);
  const kept = [];
  let droppedHeadline = 0;
  let droppedBoiler = 0;
  if (/appeared first on/i.test(String(text || ''))) {
    return {
      text: '',
      droppedHeadline: Math.max(sentences.length, 1),
      droppedBoiler: 0,
      hadText: sentences.length > 0,
    };
  }
  for (const sentence of sentences) {
    if (isHeadlineSentence(sentence)) {
      droppedHeadline += 1;
      continue;
    }
    if (isBoilerplateSentence(sentence)) {
      droppedBoiler += 1;
      continue;
    }
    kept.push(sentence);
  }
  return {
    text: kept.join(' ').trim(),
    droppedHeadline,
    droppedBoiler,
    hadText: sentences.length > 0,
  };
}

/**
 * Text fields calculateHotScore pattern-matches. Structured revenue, customers,
 * and round amounts on the row are left alone.
 */
function scoringTextFromCopy(row = {}) {
  const keys = ['tagline', 'pitch', 'description', 'value_proposition'];
  const next = {};
  let droppedHeadline = 0;
  let droppedBoiler = 0;
  let hadText = false;
  let keptAny = false;
  for (const key of keys) {
    const result = keepProductSentences(row[key]);
    next[key] = result.text;
    droppedHeadline += result.droppedHeadline;
    droppedBoiler += result.droppedBoiler;
    hadText = hadText || result.hadText;
    keptAny = keptAny || Boolean(result.text);
  }
  let quality = 'product';
  if (!hadText) quality = 'empty';
  else if (!keptAny && droppedHeadline) quality = 'headline';
  else if (!keptAny && droppedBoiler) quality = 'boilerplate';
  else if (droppedHeadline || droppedBoiler) quality = 'mixed';
  return { ...next, quality };
}

function productText(row = {}) {
  const cleaned = scoringTextFromCopy(row);
  return [cleaned.tagline, cleaned.pitch, cleaned.description, cleaned.value_proposition]
    .filter(Boolean)
    .join(' ');
}

function tokens(text) {
  return String(text || '')
    .toLowerCase()
    .split(/[^a-z0-9+]+/)
    .filter((word) => (word.length >= 4 || SHORT_OK.has(word)) && !STOP.has(word) && !/^\d+$/.test(word));
}

function usableTerm(term) {
  const parts = String(term || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!parts.length) return false;
  return parts.every((part) => !VAGUE.has(part) && !STOP.has(part));
}

function termInText(term, text) {
  const escaped = String(term || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!escaped) return false;
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, 'i').test(String(text || ''));
}

function sectorKey(sector) {
  return String(sector || '').trim();
}

function isSpecificSector(sector) {
  const key = sectorKey(sector).toLowerCase();
  return Boolean(key) && !GENERIC_SECTORS.has(key);
}

function keywordLift(docs) {
  const rows = Array.isArray(docs) ? docs : [];
  const allN = rows.length;
  const high = rows.filter((doc) => doc.high);
  const highN = high.length;
  if (allN < MIN_TERM_DOCS || highN < MIN_HIGH_DOCS) return [];

  const allDf = new Map();
  const highDf = new Map();
  const sectorCounts = new Map();

  const add = (map, term) => map.set(term, (map.get(term) || 0) + 1);

  for (const doc of rows) {
    const seen = new Set(doc.terms || []);
    for (const term of seen) add(allDf, term);
    if (!doc.high) continue;
    for (const term of seen) {
      add(highDf, term);
      if (!sectorCounts.has(term)) sectorCounts.set(term, new Map());
      const counts = sectorCounts.get(term);
      for (const sector of doc.sectors || []) {
        if (!isSpecificSector(sector)) continue;
        const label = sectorKey(sector);
        counts.set(label, (counts.get(label) || 0) + 1);
      }
    }
  }

  const out = [];
  for (const [term, highCount] of highDf) {
    const allCount = allDf.get(term) || 0;
    if (highCount < MIN_HIGH_DOCS || allCount < MIN_TERM_DOCS) continue;
    if (allCount / allN > 0.4) continue;
    const lift = (highCount / highN) / (allCount / allN);
    if (lift < MIN_LIFT) continue;
    let sector = null;
    let support = 0;
    const counts = sectorCounts.get(term) || new Map();
    for (const [label, count] of counts) {
      if (count > support) {
        support = count;
        sector = label;
      }
    }
    const share = highCount ? support / highCount : 0;
    out.push({
      term,
      docs: allCount,
      high_signal_docs: highCount,
      lift: Math.round(lift * 100) / 100,
      sector: share >= MIN_SECTOR_SHARE && support >= MIN_HIGH_DOCS ? sector : null,
      support,
    });
  }
  out.sort((a, b) => b.lift - a.lift || b.high_signal_docs - a.high_signal_docs || a.term.localeCompare(b.term));
  return out.slice(0, 30);
}

function sectorMomentum(startups, asOf, windowDays = 30) {
  const end = new Date(asOf).getTime();
  if (!Number.isFinite(end)) return [];
  const mid = end - windowDays * 86400000;
  const start = mid - windowDays * 86400000;
  const recent = new Map();
  const prior = new Map();
  for (const row of startups || []) {
    const at = new Date(row.created_at).getTime();
    if (!Number.isFinite(at)) continue;
    const bucket = at >= mid && at < end ? recent : at >= start && at < mid ? prior : null;
    if (!bucket) continue;
    for (const sector of row.sectors || []) {
      const label = sectorKey(sector);
      if (!isSpecificSector(label)) continue;
      bucket.set(label, (bucket.get(label) || 0) + 1);
    }
  }
  const labels = new Set([...recent.keys(), ...prior.keys()]);
  const trends = [];
  for (const sector of labels) {
    const recentCount = recent.get(sector) || 0;
    const priorCount = prior.get(sector) || 0;
    if (recentCount < 8 || priorCount < 3) continue;
    const ratio = recentCount / priorCount;
    let direction = 'flat';
    if (recentCount >= 8 && ratio >= 1.4) direction = 'rising';
    else if (priorCount >= 8 && ratio <= 0.6) direction = 'cooling';
    else continue;
    trends.push({
      sector,
      recent_count: recentCount,
      prior_count: priorCount,
      ratio: Math.round(ratio * 100) / 100,
      direction,
      window_days: windowDays,
    });
  }
  trends.sort((a, b) => b.recent_count - a.recent_count || a.sector.localeCompare(b.sector));
  return trends.slice(0, 12);
}

function thesisPhrases(quote) {
  const match = String(quote || '').match(/\b(?:invest(?:ing)? in|we back|looking for|focused on)\s+([^.]{6,90})/i);
  if (!match) return [];
  const words = tokens(match[1]).slice(0, 2);
  if (words.length < 2) return [];
  if (words.some((word) => VAGUE.has(word))) return [];
  return [words.join(' ')];
}

function thesisTerms(quotes) {
  const counts = new Map();
  const firms = new Map();
  for (const row of quotes || []) {
    const kind = String(row.kind || '');
    if (kind && kind !== 'investing_in' && kind !== 'looking_for') continue;
    for (const phrase of thesisPhrases(row.quote)) {
      counts.set(phrase, (counts.get(phrase) || 0) + 1);
      if (!firms.has(phrase)) firms.set(phrase, new Set());
      if (row.firm) firms.get(phrase).add(String(row.firm));
    }
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([term, count]) => ({
      term,
      count,
      firms: [...(firms.get(term) || [])].slice(0, 4),
    }))
    .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term))
    .slice(0, 12);
}

function scoreShape(startups) {
  const rows = Array.isArray(startups) ? startups : [];
  const n = rows.length;
  if (!n) {
    return { n: 0, traction_saturated_share: 0, market_cluster_share: 0, headline: 0, boilerplate: 0, review_gate: 0 };
  }
  let traction = 0;
  let scored = 0;
  let market = 0;
  let headline = 0;
  let boilerplate = 0;
  let review = 0;
  const headlineNames = [];
  const boilerplateNames = [];
  for (const row of rows) {
    if (row.traction_score == null || row.traction_score === '') {
      /* not scored yet */
    } else {
      scored += 1;
      if (Number(row.traction_score) >= 99) traction += 1;
    }
    const m = Number(row.market_score);
    if (Number.isFinite(m) && m >= 49 && m <= 56) market += 1;
    const quality = scoringTextFromCopy(row).quality;
    if (quality === 'headline') {
      headline += 1;
      if (headlineNames.length < 8 && row.name) headlineNames.push(row.name);
    } else if (quality === 'boilerplate') {
      boilerplate += 1;
      if (boilerplateNames.length < 8 && row.name) boilerplateNames.push(row.name);
    }
    if (String(row.entity_gate || '').toLowerCase() === 'review') review += 1;
  }
  const share = (count, denom) => Math.round((count / Math.max(denom, 1)) * 1000) / 1000;
  return {
    n,
    scored,
    traction_saturated_share: share(traction, scored),
    market_cluster_share: share(market, scored),
    headline,
    boilerplate,
    review_gate: review,
    headline_names: headlineNames,
    boilerplate_names: boilerplateNames,
  };
}

function sectorMix(startups) {
  const rows = Array.isArray(startups) ? startups : [];
  const counts = new Map();
  for (const row of rows) {
    for (const sector of row.sectors || []) {
      const label = sectorKey(sector);
      if (!isSpecificSector(label)) continue;
      counts.set(label, (counts.get(label) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([sector, count]) => ({
      sector,
      count,
      share: Math.round((count / Math.max(rows.length, 1)) * 1000) / 1000,
    }))
    .sort((a, b) => b.count - a.count || a.sector.localeCompare(b.sector))
    .slice(0, 8);
}

function docsFromStartups(startups, signalsById) {
  const signals = signalsById || new Map();
  return (startups || []).map((row) => {
    const signal = signals.get(row.id) || row;
    const text = productText(row);
    const words = tokens(text);
    const terms = new Set(words);
    for (let i = 0; i < words.length - 1; i += 1) {
      terms.add(`${words[i]} ${words[i + 1]}`);
    }
    return {
      high: (Number(signal.signals_total) || 0) >= HIGH_SIGNAL,
      sectors: Array.isArray(row.sectors) ? row.sectors : [],
      terms,
    };
  }).filter((doc) => doc.terms.size);
}

function buildInsightPack({ startups, signalsById, quotes, asOf } = {}) {
  const generatedAt = new Date(asOf || Date.now()).toISOString();
  const rows = Array.isArray(startups) ? startups : [];
  const keywords = keywordLift(docsFromStartups(rows, signalsById)).filter((row) => usableTerm(row.term));
  const sectorTerms = keywords
    .filter((row) => row.sector
      && row.support >= MIN_HINT_SUPPORT
      && row.lift >= MIN_LIFT
      && usableTerm(row.term))
    .map((row) => ({
      term: row.term,
      sector: row.sector,
      support: row.support,
      lift: row.lift,
    }));
  const shape = scoreShape(rows);
  const times = rows
    .map((row) => new Date(row.created_at).getTime())
    .filter((at) => Number.isFinite(at));
  const oldest = times.length ? new Date(Math.min(...times)).toISOString() : null;
  const priorStart = new Date(generatedAt).getTime() - 60 * 86400000;
  const priorCovered = Boolean(oldest) && new Date(oldest).getTime() <= priorStart + 86400000;
  return {
    version: PACK_VERSION,
    generated_at: generatedAt,
    weight_change: false,
    corpus_n: rows.length,
    oldest,
    prior_window_covered: priorCovered,
    trends: priorCovered ? sectorMomentum(rows, generatedAt) : [],
    sector_mix: sectorMix(rows),
    tag_alerts: sectorMix(rows).filter((row) => row.share >= 0.35).map((row) => ({
      ...row,
      note: 'tag is on too many rows to treat as a trend',
    })),
    keywords,
    thesis_terms: thesisTerms(quotes),
    score_shape: shape,
    match_context: { sector_terms: sectorTerms },
    score_context: {
      weight_change: false,
      action: 'withhold_headline_and_boilerplate_from_pattern_text',
      headline: shape.headline,
      boilerplate: shape.boilerplate,
      traction_saturated_share: shape.traction_saturated_share,
    },
  };
}

function sectorHintsFromPack(text, pack = getActiveBrainPack()) {
  const terms = pack?.match_context?.sector_terms;
  if (!Array.isArray(terms) || !text) return [];
  const hits = [];
  for (const row of terms) {
    const support = Number(row?.support) || 0;
    const lift = Number(row?.lift) || 0;
    if (support < MIN_HINT_SUPPORT || lift < MIN_LIFT) continue;
    if (!usableTerm(row.term)) continue;
    if (!isSpecificSector(row.sector)) continue;
    if (!termInText(row.term, text)) continue;
    hits.push(row);
  }
  hits.sort((a, b) => (b.support - a.support) || (b.lift - a.lift) || String(a.term).localeCompare(String(b.term)));
  const sectors = [];
  for (const hit of hits) {
    if (!sectors.includes(hit.sector)) sectors.push(hit.sector);
    if (sectors.length >= 2) break;
  }
  return sectors;
}

/**
 * Load the newest pack and keep it for this process. Missing table or a
 * failed read leaves matching on its previous behavior.
 */
async function refreshBrainPack(supabase, { maxAgeMs = 10 * 60 * 1000 } = {}) {
  if (!supabase) return getActiveBrainPack();
  if (activePack && refreshBrainPack.loadedAt && Date.now() - refreshBrainPack.loadedAt < maxAgeMs) {
    return activePack;
  }
  if (refreshBrainPack.pending) return refreshBrainPack.pending;
  refreshBrainPack.pending = (async () => {
    try {
      const { data, error } = await supabase
        .from('data_brain_insights')
        .select('pack, insight_date')
        .order('insight_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!error && data?.pack) {
        setActiveBrainPack(data.pack);
        refreshBrainPack.loadedAt = Date.now();
      }
    } catch {
      /* matching still runs without a pack */
    } finally {
      refreshBrainPack.pending = null;
    }
    return getActiveBrainPack();
  })();
  return refreshBrainPack.pending;
}

module.exports = {
  PACK_VERSION,
  HIGH_SIGNAL,
  GENERIC_SECTORS,
  setActiveBrainPack,
  getActiveBrainPack,
  isHeadlineSentence,
  isBoilerplateSentence,
  scoringTextFromCopy,
  productText,
  tokens,
  keywordLift,
  sectorMomentum,
  thesisTerms,
  scoreShape,
  buildInsightPack,
  sectorHintsFromPack,
  refreshBrainPack,
};
