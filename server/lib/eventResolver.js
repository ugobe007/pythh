/**
 * EVENT RESOLVER  (independent second pass over startup_events)
 * ============================================================
 * Recovers startups that the scraper's frame parser missed or mis-extracted.
 *
 * Why this exists:
 *   The SSOT frame parser (src/services/rss/frameParser.ts) is regex/word-position
 *   based. On real headlines it frequently:
 *     - misses the company entirely ("Perplexity plans for 2028 IPO debut" -> entities:[])
 *     - grabs the wrong noun ("Applied Digital ... Senior Secured Notes" -> "Senior")
 *     - never associates investor names ("led by Sequoia")
 *     - never resolves a website (so rows land needs_url / holding)
 *
 * This module re-reads the news snippet, uses an LLM to correctly associate the
 * company + investors + funding, runs a heuristic URL lookup, and stages the
 * result into discovered_startups (the existing safe import path). It NEVER writes
 * to startup_events and NEVER touches the scraper — it is fully decoupled.
 *
 * Pairs with: lib/startupInsertGate.js (insertDiscovered), the auto-import
 * pipeline (discovered -> startup_uploads), and pythiaSageReview (further enrich).
 */

'use strict';

const RESOLVER_VERSION = 'event-resolver@1';

// Event types that should describe a single startup subject.
const STARTUP_EVENT_TYPES = ['FUNDING', 'LAUNCH', 'ACQUISITION', 'INVESTMENT', 'IPO_FILING'];

// Headline tokens that signal a startup story hides inside an OTHER event.
const STARTUP_KEYWORDS = [
  'raises', 'raised', 'funding', 'series', 'seed', 'round', 'venture',
  'million', 'billion', 'acquires', 'acquired', 'acquisition', 'launches',
  'launched', 'startup', 'invests', 'invested', 'backed', 'led by',
];

// Generic nouns the frame parser tends to mistake for company names.
const JUNK_SUBJECTS = new Set([
  'senior', 'ipo', 'series', 'round', 'fund', 'capital', 'notes', 'offering',
  'report', 'study', 'market', 'index', 'the', 'new', 'first', 'top',
]);

let _openaiErrCount = 0;

/* ------------------------------------------------------------------ *
 * Snippet assembly
 * ------------------------------------------------------------------ */

function snippetFromEvent(event) {
  const title = String(event.source_title || '').trim();
  let context = '';
  const sc = event.semantic_context;
  if (Array.isArray(sc)) {
    context = sc.map((c) => (c && (c.text || c.snippet)) || '').filter(Boolean).join(' ');
  } else if (typeof sc === 'string') {
    context = sc;
  }
  context = String(context || '').replace(/\s+/g, ' ').trim().slice(0, 700);
  return { title, context, combined: [title, context].filter(Boolean).join(' — ') };
}

/**
 * Decide whether an event is worth a (paid) resolution pass.
 * We target events that the scraper likely failed to convert:
 *   - startup-type events with empty / junk subject entities, OR
 *   - OTHER events whose headline carries startup keywords.
 */
function needsResolution(event) {
  const type = String(event.event_type || '').toUpperCase();
  const title = String(event.source_title || '');
  if (!title || title.length < 12) return false;

  const ents = Array.isArray(event.entities) ? event.entities : [];
  const primary = ents.find((e) => e && e.role === 'SUBJECT') || ents[0] || null;
  const primaryName = primary && primary.name ? String(primary.name).trim() : '';
  const badSubject =
    !primaryName ||
    primaryName.length < 2 ||
    JUNK_SUBJECTS.has(primaryName.toLowerCase());

  if (STARTUP_EVENT_TYPES.includes(type)) {
    // Re-resolve when the subject is missing or looks like a generic noun.
    if (ents.length === 0) return true;
    if (badSubject) return true;
    return false; // already has a plausible subject — leave the scraper's row alone
  }

  if (type === 'OTHER') {
    const lower = title.toLowerCase();
    return STARTUP_KEYWORDS.some((kw) => lower.includes(kw));
  }

  return false;
}

/* ------------------------------------------------------------------ *
 * LLM extraction
 * ------------------------------------------------------------------ */

const SYSTEM_PROMPT = `You are PYTHIA's entity resolver. You read a single startup/VC news snippet and identify the COMPANY the story is about, its investors, and the funding details. You are precise about word associations: the subject is the operating company being funded, launched, or acquired — never the investor, never the publisher, never a generic noun.`;

function buildUserPrompt(snippet) {
  return `News snippet:
"${snippet.combined}"

Identify the startup/company this story is primarily about and extract structured data. Return ONLY JSON:

{
  "is_startup": true|false,           // false if this is about a public mega-cap, a person, a government body, a fund/VC firm itself, or generic market news with no specific company
  "not_startup_reason": "short reason if is_startup=false, else null",
  "startup_name": "the operating COMPANY name (clean, no location/legal suffixes), or null",
  "aka": ["alternate spellings or short names"],
  "one_liner": "<=140 char description of what the company does, or null",
  "sectors": ["1-3 sectors e.g. AI/ML, FinTech, HealthTech, Climate"],
  "lead_investor": "lead investor name or null",
  "investors": ["ALL investor / VC firm names mentioned"],
  "funding_amount_usd": number or null,   // numeric USD, e.g. 5000000 for "$5M"
  "round": "Pre-Seed | Seed | Series A | Series B | Series C | Growth | Debt | null",
  "hq": "city/country if stated, else null",
  "confidence": 0.0-1.0,
  "evidence": "the exact phrase that names the company"
}

Hard rules:
- For "X acquires Y", the startup is Y. For "X leads $Z round in Y" or "Y raises $Z led by X", the startup is Y and X is an investor.
- NEVER return a generic noun (e.g. "Senior", "IPO", "Series", "Round", "Notes", "Offering") as startup_name. If the only candidate is generic, set startup_name=null and lower confidence.
- Capture investors even when they appear mid-sentence ("...backed by Sequoia and a16z").
- If the company is a well-known public company (e.g. Apple, Klarna at IPO scale) or the snippet is generic market/macro news, set is_startup=false.
- Be conservative: when the company is genuinely unclear, startup_name=null, confidence<=0.4.`;
}

function toUsd(v) {
  if (v == null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v);
  const s = String(v).replace(/[, $]/g, '').toLowerCase();
  const m = s.match(/^([\d.]+)\s*(k|m|b|million|billion|thousand)?$/);
  if (!m) {
    const n = Number(s);
    return Number.isFinite(n) ? Math.round(n) : null;
  }
  let n = parseFloat(m[1]);
  const unit = m[2] || '';
  if (/b|billion/.test(unit)) n *= 1e9;
  else if (/m|million/.test(unit)) n *= 1e6;
  else if (/k|thousand/.test(unit)) n *= 1e3;
  return Number.isFinite(n) ? Math.round(n) : null;
}

function cleanStr(v, max = 280) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s || s.toLowerCase() === 'null' || s.toLowerCase() === 'none') return null;
  return s.slice(0, max);
}

function cleanArr(v) {
  if (!Array.isArray(v)) return [];
  return Array.from(
    new Set(
      v
        .map((x) => cleanStr(x, 120))
        .filter(Boolean)
        .filter((x) => x.length >= 2)
    )
  );
}

function coerceExtraction(raw) {
  const j = raw || {};
  const name = cleanStr(j.startup_name, 120);
  return {
    isStartup: j.is_startup === true,
    notStartupReason: cleanStr(j.not_startup_reason, 200),
    startupName: name && !JUNK_SUBJECTS.has(name.toLowerCase()) ? name : null,
    aka: cleanArr(j.aka),
    oneLiner: cleanStr(j.one_liner, 160),
    sectors: cleanArr(j.sectors).slice(0, 4),
    leadInvestor: cleanStr(j.lead_investor, 120),
    investors: cleanArr(j.investors).slice(0, 12),
    fundingAmountUsd: toUsd(j.funding_amount_usd),
    round: cleanStr(j.round, 40),
    hq: cleanStr(j.hq, 120),
    confidence: typeof j.confidence === 'number' ? Math.max(0, Math.min(1, j.confidence)) : 0.4,
    evidence: cleanStr(j.evidence, 200),
  };
}

async function llmExtract(openai, model, snippet) {
  const resp = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(snippet) },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
    max_tokens: 700,
  });
  const content = resp.choices?.[0]?.message?.content || '{}';
  return coerceExtraction(JSON.parse(content));
}

/* ------------------------------------------------------------------ *
 * Website resolution (heuristic — domain guess + HEAD probe)
 * ------------------------------------------------------------------ */

// Generic tokens that don't make a name distinctive enough to verify against.
const GENERIC_TOKENS = new Set([
  'the', 'inc', 'llc', 'ltd', 'corp', 'co', 'group', 'company', 'labs', 'lab',
  'capital', 'ventures', 'partners', 'fund', 'holdings', 'technologies', 'tech',
  'ai', 'io', 'app', 'global', 'solutions', 'systems', 'digital', 'media',
  'health', 'bio', 'medicines', 'medical', 'financial', 'advertising', 'outdoor',
]);

function distinctiveTokens(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 4 && !GENERIC_TOKENS.has(t));
}

/**
 * Verify a guessed domain actually belongs to the company by fetching the page
 * and checking the company name (collapsed) or a distinctive token appears.
 * This guards against the HEAD-probe accepting parked/squatter/unrelated domains
 * (e.g. perplexity.com instead of perplexity.ai).
 */
async function verifyUrlMatchesCompany(url, name, timeoutMs = 4000) {
  if (typeof fetch !== 'function') return false; // can't verify -> treat as unverified
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; PythhBot/1.0)' },
    });
    if (!resp.ok) return false;
    const html = (await resp.text()).slice(0, 60000).toLowerCase();
    const collapsed = String(name).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (collapsed.length >= 4 && html.replace(/[^a-z0-9]/g, '').includes(collapsed)) return true;
    const toks = distinctiveTokens(name);
    return toks.length > 0 && toks.every((tok) => html.includes(tok));
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

async function resolveWebsite(name, deps) {
  if (!name || !deps || typeof deps.inferDomainFromName !== 'function') return null;
  try {
    const res = await deps.inferDomainFromName(name, deps.domainTimeoutMs || 2500);
    if (res && res.domain) {
      const host = String(res.domain).replace(/^https?:\/\//, '').replace(/\/+$/, '');
      if (host && host.includes('.')) {
        const url = `https://${host}`;
        // Verify the guessed domain truly belongs to the company (avoids squatters).
        if (deps.verifyUrls === false) return url;
        const ok = await verifyUrlMatchesCompany(url, name, deps.verifyTimeoutMs || 4000);
        return ok ? url : null;
      }
    }
  } catch {
    /* network/timeout — non-fatal */
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Investor resolution (name -> investors table)
 * ------------------------------------------------------------------ */

function normName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\b(capital|ventures?|partners?|management|fund|funds|llc|lp|inc|group)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

async function resolveInvestors(supabase, names) {
  const out = [];
  for (const name of names) {
    let matched = null;
    try {
      const { data } = await supabase
        .from('investors')
        .select('id, name, firm')
        .or(`name.ilike.%${name.replace(/[%,]/g, '')}%,firm.ilike.%${name.replace(/[%,]/g, '')}%`)
        .limit(5);
      if (data && data.length) {
        const target = normName(name);
        matched =
          data.find((r) => normName(r.name) === target || normName(r.firm) === target) ||
          data.find((r) => normName(r.name).includes(target) || normName(r.firm).includes(target)) ||
          null;
      }
    } catch {
      /* non-fatal */
    }
    out.push({
      name,
      investor_id: matched ? matched.id : null,
      matched_name: matched ? matched.firm || matched.name : null,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Orchestration
 * ------------------------------------------------------------------ */

/**
 * Resolve a single event into a structured discovered-startup candidate.
 * Returns { action, record?, extraction, investors?, reason }.
 *   action: 'create' | 'skip_not_startup' | 'skip_low_confidence' | 'skip_no_name' | 'error'
 *
 * deps: { openai, supabase, model, inferDomainFromName, resolveUrls, minConfidence }
 */
async function resolveEvent(event, deps) {
  const snippet = snippetFromEvent(event);
  const model = deps.model || 'gpt-4o-mini';
  const minConfidence = typeof deps.minConfidence === 'number' ? deps.minConfidence : 0.55;

  let extraction;
  try {
    extraction = await llmExtract(deps.openai, model, snippet);
  } catch (err) {
    _openaiErrCount += 1;
    return { action: 'error', reason: `llm: ${err.message}`, extraction: null };
  }

  if (!extraction.isStartup) {
    return { action: 'skip_not_startup', reason: extraction.notStartupReason || 'not_a_startup', extraction };
  }
  if (!extraction.startupName) {
    return { action: 'skip_no_name', reason: 'no_clean_company_name', extraction };
  }
  if (extraction.confidence < minConfidence) {
    return { action: 'skip_low_confidence', reason: `confidence_${extraction.confidence.toFixed(2)}`, extraction };
  }

  // URL lookup (heuristic, optional)
  let website = null;
  if (deps.resolveUrls !== false) {
    website = await resolveWebsite(extraction.startupName, deps);
  }

  // Investor word-association -> investors table
  let investors = [];
  const investorNames = Array.from(
    new Set([extraction.leadInvestor, ...extraction.investors].filter(Boolean))
  );
  if (investorNames.length && deps.supabase) {
    investors = await resolveInvestors(deps.supabase, investorNames);
  } else {
    investors = investorNames.map((n) => ({ name: n, investor_id: null, matched_name: null }));
  }

  const record = {
    name: extraction.startupName,
    website,
    description: extraction.oneLiner || snippet.title.slice(0, 300),
    funding_amount: extraction.fundingAmountUsd || null,
    funding_stage: extraction.round || null,
    investors_mentioned: investorNames.length ? investorNames : null,
    lead_investor: extraction.leadInvestor || null,
    sectors: extraction.sectors.length ? extraction.sectors : null,
    value_proposition: extraction.oneLiner || null,
    article_url: event.source_url || null,
    article_title: snippet.title || null,
    article_date: event.created_at || null,
    rss_source: event.source_publisher || event.source_name || null,
    metadata: {
      resolver: {
        version: RESOLVER_VERSION,
        model,
        event_id: event.id || event.event_id || null,
        event_type: event.event_type || null,
        confidence: extraction.confidence,
        evidence: extraction.evidence,
        aka: extraction.aka,
        hq: extraction.hq,
        website_resolved: Boolean(website),
        investors: investors,
        resolved_at: new Date().toISOString(),
      },
    },
  };

  return { action: 'create', record, extraction, investors };
}

module.exports = {
  RESOLVER_VERSION,
  STARTUP_EVENT_TYPES,
  STARTUP_KEYWORDS,
  JUNK_SUBJECTS,
  snippetFromEvent,
  needsResolution,
  llmExtract,
  coerceExtraction,
  resolveWebsite,
  resolveInvestors,
  resolveEvent,
  toUsd,
};
