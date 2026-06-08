// --- FILE: server/lib/pythiaSageReview.js ---
// PYTHIA Sage Review — an INDEPENDENT second-pass QA/enrichment layer that runs
// AFTER the scraper has extracted/parsed/stored a startup. It never imports or
// mutates scraper code; it only reads a startup_uploads row and returns guarded
// patches (extracted_data + a few safe root columns) for the caller to apply.
//
// Pipeline per startup:
//   1. detectGaps()      — deterministic scan of the high-impact fields scoring needs
//   2. callSage()        — LLM ("savvy venture sage") reconstructs missing fields with
//                          per-field confidence + evidence, and flags missing logic
//   3. mergeGuarded()    — allowlist + confidence gate + fill/low-conf rules; never
//                          clobbers existing strong data
//
// The caller writes the patch and lets the existing recalc apply the new score.

'use strict';

// Bump when the review logic/prompt materially changes so rows get re-reviewed.
const SAGE_VERSION = 1;

// Minimum confidence (0–1) before a sage-inferred value is accepted.
const CONF_MIN = 0.5;
// Higher bar for risky external facts (a URL we can't verify here).
const CONF_MIN_WEBSITE = 0.75;

// Fields scoring (toScoringProfileFromStartupUpload) actually reads, grouped by
// how we apply them. `target` says where the value lands.
//   extracted  → written into extracted_data (safe fallback, never clobbers root)
//   root       → written to a top-level column ONLY when empty / low-confidence
const SAGE_FIELDS = {
  // Narrative (drive the "vibe"/market/product pillars).
  // NOTE: only `tagline` and `sectors` are real root columns; the rest live in
  // extracted_data exclusively, so they must NOT set alsoRoot.
  value_proposition: { type: 'string', target: 'extracted' },
  problem:           { type: 'string', target: 'extracted' },
  solution:          { type: 'string', target: 'extracted' },
  tagline:           { type: 'string', target: 'extracted', alsoRoot: true },
  market_size:       { type: 'string', target: 'extracted' },
  one_liner:         { type: 'string', target: 'extracted' },
  product_description:{ type: 'string', target: 'extracted' },
  // Classification
  sectors:           { type: 'string[]', target: 'extracted', alsoRoot: true },
  stage:             { type: 'stage',   target: 'root' },
  // Team
  has_technical_cofounder: { type: 'bool', target: 'extracted' },
  team_size:         { type: 'int', target: 'extracted', min: 1, max: 5000 },
  founders_count:    { type: 'int', target: 'extracted', min: 1, max: 10 },
  // Product / traction booleans (read directly by the scoring profile)
  is_launched:       { type: 'bool', target: 'extracted' },
  has_demo:          { type: 'bool', target: 'extracted' },
  has_revenue:       { type: 'bool', target: 'extracted' },
  has_customers:     { type: 'bool', target: 'extracted' },
  self_use:          { type: 'bool', target: 'extracted' },
  // External (conservative)
  website:           { type: 'url', target: 'root' },
};

const STAGE_LABELS = {
  'pre-seed': 1, 'preseed': 1, 'pre seed': 1,
  seed: 2,
  'series a': 3, 'series-a': 3, a: 3,
  'series b': 4, b: 4,
  'series c': 5, c: 5,
  growth: 6, 'late stage': 6, 'series d': 6,
};

function isEmpty(v) {
  if (v == null) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

// ── 1. Gap detection ────────────────────────────────────────────────────────
function detectGaps(startup) {
  const ex = startup.extracted_data || {};
  const has = (k) => !isEmpty(startup[k]) || !isEmpty(ex[k]);
  const gaps = [];

  if (isEmpty(startup.value_proposition) && isEmpty(ex.value_proposition) && isEmpty(startup.tagline)) gaps.push('value_proposition');
  if (isEmpty(startup.tagline) && isEmpty(ex.tagline)) gaps.push('tagline');
  if (isEmpty(ex.problem) && isEmpty(startup.problem)) gaps.push('problem');
  if (isEmpty(ex.solution) && isEmpty(startup.solution)) gaps.push('solution');
  if (isEmpty(startup.market_size) && isEmpty(ex.market_size)) gaps.push('market_size');
  if (isEmpty(startup.sectors) && isEmpty(ex.sectors) && isEmpty(ex.industries)) gaps.push('sectors');
  if (startup.stage == null) gaps.push('stage');
  if (isEmpty(startup.website) && isEmpty(startup.company_website)) gaps.push('website');
  if (!has('has_technical_cofounder')) gaps.push('has_technical_cofounder');
  if (!has('team_size')) gaps.push('team_size');
  if (!has('is_launched') && !ex.launched) gaps.push('is_launched');
  if (!has('has_demo') && !ex.demo_available) gaps.push('has_demo');
  if (!has('has_revenue')) gaps.push('has_revenue');
  if (!has('has_customers')) gaps.push('has_customers');

  return gaps;
}

// A row is "low confidence" (scraper itself was unsure) when its inference tier
// is C or it explicitly listed missing fields. Used by the fill+low-conf merge.
function lowConfTier(startup) {
  const c = startup.extracted_data?.confidence;
  if (!c) return false;
  return c.tier === 'C' || (Array.isArray(c.missing) && c.missing.length > 0);
}

// Tiered model: deeper model for the rows that matter most or have the least data.
function pickModel(startup) {
  const god = Number(startup.total_god_score) || 0;
  if (god >= 80 || startup.status === 'holding') return 'gpt-4o';
  return 'gpt-4o-mini';
}

// ── 2. Sage LLM call ────────────────────────────────────────────────────────
const SAGE_SYSTEM = [
  'You are PYTHIA, a savvy venture analyst doing a second-pass review of a startup',
  'profile that an automated scraper produced. Your job is to (a) decide whether this',
  'entity is actually a fundable startup/company, (b) reconstruct ONLY the missing or',
  'weak fields, strictly from the evidence provided, and (c) flag missing logic or value.',
  'Set is_startup=false when the entity is clearly NOT a fundable startup — e.g. a person,',
  'a government agency, a university, a media/news outlet, an event, a generic topic, or a',
  'large established public company. When is_startup is false, do NOT fill any fields.',
  'Never invent funding numbers, revenue, customers, or a website you cannot infer from',
  'the given text. If you are not reasonably sure about a field, return null for it. For',
  'every field you DO fill, give a 0–1 confidence and a one-line evidence note',
  'quoting/paraphrasing what in the input supports it.',
].join(' ');

function buildSagePayload(startup) {
  const ex = startup.extracted_data || {};
  return {
    name: startup.name,
    website: startup.website || startup.company_website || null,
    tagline: startup.tagline || ex.tagline || null,
    description: startup.description || startup.pitch || ex.description || ex.pitch || null,
    existing_value_proposition: startup.value_proposition || ex.value_proposition || null,
    existing_problem: ex.problem || startup.problem || null,
    existing_solution: ex.solution || startup.solution || null,
    sectors: startup.sectors || ex.sectors || ex.industries || [],
    stage: startup.stage ?? null,
    funding_amount: ex.funding_amount || null,
    funding_stage: ex.funding_stage || null,
    investors_mentioned: ex.investors_mentioned || ex.investors || [],
    signal_evidence: ex.signal_evidence || ex.signal_inference || null,
    press: ex.web_signals?.press_tier || null,
    scraper_confidence: ex.confidence || null,
  };
}

function buildUserPrompt(startup, gaps) {
  const payload = JSON.stringify(buildSagePayload(startup), null, 2).slice(0, 4000);
  const fieldList = Object.keys(SAGE_FIELDS).join(', ');
  return [
    `Startup data from the scraper:\n${payload}`,
    `\nGaps the scraper left (focus here): ${gaps.length ? gaps.join(', ') : '(none flagged — verify the weak ones)'}`,
    `\nReturn STRICT JSON with this shape:`,
    `{`,
    `  "is_startup": true | false,  /* false = person, agency, university, media outlet, event, topic, or large public company */`,
    `  "not_startup_reason": "short reason (only when is_startup is false)",`,
    `  "fields": { /* only keys you can support; each: {"value": <typed>, "confidence": 0-1, "evidence": "short note"} */ },`,
    `  "review_notes": "1-2 sentences: what is missing, weak, or illogical about this profile",`,
    `  "missing_logic": ["short bullet", ...],`,
    `  "overall_quality": "rich" | "thin" | "incoherent"`,
    `}`,
    `\nAllowed field keys: ${fieldList}.`,
    `For "sectors" return an array of 1-3 strings. For "stage" return an integer 1-6`,
    `(1 pre-seed, 2 seed, 3 series A, 4 B, 5 C, 6 growth) or a stage label.`,
    `Booleans must be true/false. Omit any field you cannot support with evidence.`,
  ].join('\n');
}

async function callSage(openai, model, startup, gaps) {
  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.2,
    max_tokens: 900,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SAGE_SYSTEM },
      { role: 'user', content: buildUserPrompt(startup, gaps) },
    ],
  });
  const raw = completion.choices?.[0]?.message?.content || '{}';
  return JSON.parse(raw);
}

// ── 3. Guarded merge ────────────────────────────────────────────────────────
function coerce(type, value, spec) {
  switch (type) {
    case 'string': {
      if (typeof value !== 'string') return undefined;
      const v = value.trim();
      return v.length >= 3 && v.length <= 600 ? v : undefined;
    }
    case 'string[]': {
      const arr = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
      const out = arr.map((s) => String(s).trim()).filter((s) => s && s.length <= 60).slice(0, 3);
      return out.length ? out : undefined;
    }
    case 'bool':
      return typeof value === 'boolean' ? value : undefined;
    case 'int': {
      const n = Math.round(Number(value));
      if (!Number.isFinite(n)) return undefined;
      if (spec.min != null && n < spec.min) return undefined;
      if (spec.max != null && n > spec.max) return undefined;
      return n;
    }
    case 'stage': {
      if (typeof value === 'number' && value >= 1 && value <= 6) return Math.round(value);
      const key = String(value).toLowerCase().trim();
      return STAGE_LABELS[key];
    }
    case 'url': {
      const v = String(value).trim().toLowerCase();
      // Plausible bare/full domain; reject obvious junk.
      if (!/^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/.*)?$/.test(v)) return undefined;
      return v.startsWith('http') ? v : `https://${v}`;
    }
    default:
      return undefined;
  }
}

function mergeGuarded(startup, sageJson, opts = {}) {
  const { fillPlusLowConf = true } = opts;
  const ex = startup.extracted_data || {};
  const low = fillPlusLowConf && lowConfTier(startup);

  const extractedPatch = {};
  const rootPatch = {};
  const filled = [];
  const skipped = [];

  // PYTHIA's junk verdict: when the entity is clearly not a fundable startup,
  // we do NOT enrich it — the caller flags it instead.
  const notStartup = sageJson && sageJson.is_startup === false;
  const fields = !notStartup && sageJson && typeof sageJson.fields === 'object' ? sageJson.fields : {};

  for (const [key, entry] of Object.entries(fields)) {
    const spec = SAGE_FIELDS[key];
    if (!spec || !entry || typeof entry !== 'object') { skipped.push(`${key}:unknown`); continue; }

    const conf = Number(entry.confidence);
    const evidence = typeof entry.evidence === 'string' ? entry.evidence.trim() : '';
    const minConf = spec.type === 'url' ? CONF_MIN_WEBSITE : CONF_MIN;
    if (!(conf >= minConf) || evidence.length < 4) { skipped.push(`${key}:lowconf`); continue; }

    const value = coerce(spec.type, entry.value, spec);
    if (value === undefined) { skipped.push(`${key}:badvalue`); continue; }

    // Decide whether we're allowed to set this field.
    const rootEmpty = isEmpty(startup[key]) && isEmpty(startup[key === 'website' ? 'company_website' : key]);
    const exEmpty = isEmpty(ex[key]);
    const currentlyEmpty = rootEmpty && exEmpty;
    const canOverwrite = currentlyEmpty || low; // fill gaps, plus low-confidence rows

    if (!canOverwrite) { skipped.push(`${key}:hasvalue`); continue; }

    // Apply.
    if (spec.target === 'root') {
      // Root writes are conservative: only when the root column is empty (never
      // clobber a real value), even on low-conf rows.
      if (key === 'website') {
        if (isEmpty(startup.website) && isEmpty(startup.company_website)) {
          rootPatch.website = value;
          rootPatch.company_website = value;
        } else { skipped.push('website:hasvalue'); continue; }
      } else if (key === 'stage') {
        if (startup.stage == null) rootPatch.stage = value;
        else { skipped.push('stage:hasvalue'); continue; }
      }
    } else {
      extractedPatch[key] = value;
      // Mirror a couple of high-value narrative/classification fields to root
      // columns when those are empty (UI + scoring read root first).
      if (spec.alsoRoot && isEmpty(startup[key])) rootPatch[key] = value;
    }
    filled.push(key);
  }

  const notStartupReason = notStartup
    ? (typeof sageJson.not_startup_reason === 'string' && sageJson.not_startup_reason.trim()
        ? sageJson.not_startup_reason.trim().slice(0, 240)
        : 'not a fundable startup')
    : null;

  const sageMeta = {
    version: SAGE_VERSION,
    reviewed_at: new Date().toISOString(),
    model: opts.model || null,
    gaps: opts.gaps || [],
    filled,
    skipped,
    not_startup: notStartup || false,
    not_startup_reason: notStartupReason,
    notes: typeof sageJson.review_notes === 'string' ? sageJson.review_notes.slice(0, 500) : null,
    missing_logic: Array.isArray(sageJson.missing_logic) ? sageJson.missing_logic.slice(0, 6) : [],
    quality: sageJson.overall_quality || null,
  };

  return { extractedPatch, rootPatch, sageMeta, filled, skipped, notStartup, notStartupReason };
}

// ── Orchestrator for one row ──────────────────────────────────────────────────
async function reviewStartup(startup, { openai, fillPlusLowConf = true } = {}) {
  const gaps = detectGaps(startup);
  const model = pickModel(startup);
  let sageJson;
  try {
    sageJson = await callSage(openai, model, startup, gaps);
  } catch (e) {
    return { ok: false, error: e.message, model, gaps };
  }
  const merged = mergeGuarded(startup, sageJson, { fillPlusLowConf, model, gaps });
  return { ok: true, model, gaps, quality: merged.sageMeta.quality, ...merged };
}

function alreadyReviewed(startup) {
  const v = startup.extracted_data?.sage_review?.version;
  return typeof v === 'number' && v >= SAGE_VERSION;
}

module.exports = {
  SAGE_VERSION,
  SAGE_FIELDS,
  detectGaps,
  pickModel,
  mergeGuarded,
  reviewStartup,
  alreadyReviewed,
  lowConfTier,
};
