#!/usr/bin/env node
/**
 * Batch search: matched startups → post-prediction funding evidence.
 *
 * Default provider: inference engine (Google News RSS + extractors — no Gemini credits).
 * Optional: --provider=gemini when GEMINI_API_KEY is available.
 */
import 'dotenv/config';
import dns from 'node:dns/promises';
import net from 'node:net';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { searchStartupNews } = require('../server/services/inferenceService.js');
const { extractFunding } = require('../lib/inference-extractor.js');
const { extractKnownInvestorMentions } = require('../server/lib/fundingParticipationOntology.js');
const { filterCleanHits } = require('../server/lib/matchEvidenceInvestorHit.js');
const ledger = require('../server/lib/fundingEvidenceLedger.js');

const apply = process.argv.includes('--apply');
const seed = process.argv.includes('--seed');
const requeueEmpty = process.argv.includes('--requeue-empty');
const limit = Math.max(1, Number(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] || 10));
const delay = Math.max(0, Number(process.argv.find((a) => a.startsWith('--delay='))?.split('=')[1] || 500));
const providerArg = process.argv.find((a) => a.startsWith('--provider='))?.split('=')[1];
const provider = providerArg === 'gemini' ? 'gemini' : 'inference';

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const geminiKey = process.env.GEMINI_API_KEY || process.env.AISTUDIO_API_KEY;
if (!url || !serviceKey) throw new Error('Missing Supabase service environment');
if (provider === 'gemini' && !geminiKey) throw new Error('Missing GEMINI_API_KEY for --provider=gemini');

const db = createClient(url, serviceKey, { auth: { persistSession: false } });
const model = process.env.GEMINI_SEARCH_MODEL || 'gemini-2.5-flash';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

const FUNDING_WORDS = /\b(rais(?:e|es|ed|ing)|funding|financing|series\s+[a-z]|pre[- ]seed|seed round|investment|invests?\s+in|led\s+by|participation\s+from)\b/i;
const RUMOR_WORDS = /\b(in talks|plans? to|may invest|considering|could invest|reportedly|rumou?r|seeks? to raise|targets? a raise)\b/i;

function parseSearchJson(value) {
  const text = String(value || '').trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = (fenced || text).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    /* fall through */
  }
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start >= 0 && end > start) return JSON.parse(candidate.slice(start, end + 1));
  throw new Error(`Search response contained no parseable JSON: ${candidate.slice(0, 160)}`);
}

async function directSourceUrl(value) {
  try {
    const parsed = new URL(value);
    if (!/vertexaisearch\.cloud\.google\.com$/i.test(parsed.hostname)) return value;
    const response = await fetch(value, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
      headers: { 'user-agent': 'PythhEvidenceBot/1.0' },
    });
    return response.url && !/vertexaisearch\.cloud\.google\.com/i.test(response.url) ? response.url : value;
  } catch {
    return value;
  }
}

function cleanHeadline(title) {
  return String(title || '').replace(/\s+-\s+[^-]{2,80}$/, '').trim();
}

function startupMentionedInText(text, startupName, website) {
  const haystack = ledger.normalizeStartupName(text.replace(/['']s\b/g, ''));
  const normalizedName = ledger.normalizeStartupName(startupName);
  if (normalizedName.length >= 3) {
    const pattern = new RegExp(`(^|\\s)${escapeRegExp(normalizedName)}(\\s|$)`, 'i');
    if (pattern.test(haystack)) return true;
  }
  const firstToken = normalizedName.split(' ').filter(Boolean)[0];
  if (firstToken && firstToken.length >= 4) {
    const pattern = new RegExp(`(^|\\s)${escapeRegExp(firstToken)}(\\s|$)`, 'i');
    if (pattern.test(haystack)) return true;
  }
  if (website) {
    try {
      const host = new URL(website).hostname.replace(/^www\./, '');
      const brand = host.split('.')[0].replace(/[^a-z0-9]/g, '');
      if (brand.length >= 4) {
        const pattern = new RegExp(`(^|\\s)${escapeRegExp(brand)}(\\s|$)`, 'i');
        if (pattern.test(haystack)) return true;
      }
    } catch {
      /* ignore */
    }
  }
  return false;
}

function eligibleArticle(article, startupName, earliestMatchAt, website) {
  const title = cleanHeadline(article.title);
  const snippet = String(article.content || '');
  const combined = `${title}\n${snippet}`;
  const publishedAt = new Date(article.pubDate || 0);
  const cutoff = new Date(earliestMatchAt);
  return (
    title
    && FUNDING_WORDS.test(combined)
    && !RUMOR_WORDS.test(combined)
    && Number.isFinite(publishedAt.getTime())
    && publishedAt > cutoff
    && startupMentionedInText(combined, startupName, website)
  );
}

function uniqueInvestors(rows) {
  const byId = new Map();
  for (const row of rows || []) {
    const inv = row.investors || row;
    if (inv?.id && !byId.has(inv.id)) byId.set(inv.id, inv);
  }
  return [...byId.values()];
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function investorLabels(investor) {
  const labels = new Set();
  for (const raw of [investor.name, investor.firm].filter(Boolean)) {
    const label = String(raw).trim();
    if (label.length >= 4) labels.add(label);
    const paren = label.match(/\(([^)]+)\)/);
    if (paren?.[1] && paren[1].trim().length >= 4) labels.add(paren[1].trim());
  }
  return [...labels].sort((a, b) => b.length - a.length);
}

/** Fallback when headline parsers miss: any matched investor name/firm appears in text. */
function findMatchedInvestorsInText(text, matchedInvestors) {
  const haystack = String(text || '');
  if (!haystack.trim()) return [];
  const found = [];
  const seen = new Set();
  for (const investor of matchedInvestors) {
    for (const label of investorLabels(investor)) {
      const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(label)}(?=$|[^a-z0-9])`, 'i');
      if (!pattern.test(haystack)) continue;
      const key = investor.id;
      if (seen.has(key)) break;
      seen.add(key);
      found.push({
        investor,
        investorNameRaw: label,
        role: 'participant',
        relation: 'INVESTED_IN',
        evidencePhrase: haystack.slice(0, 1000),
      });
      break;
    }
  }
  return found;
}

function mergeMentions(structured, fallback) {
  const byId = new Map();
  for (const row of [...structured, ...fallback]) {
    if (!row?.investor?.id) continue;
    if (!byId.has(row.investor.id)) byId.set(row.investor.id, row);
  }
  return [...byId.values()];
}

function isPrivateIp(address) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number);
    return (
      a === 10
      || a === 127
      || a === 0
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
    );
  }
  if (net.isIPv6(address)) {
    if (address === '::1' || address.startsWith('fc') || address.startsWith('fd') || address.startsWith('fe80:')) return true;
    if (address.startsWith('::ffff:')) {
      const ipv4 = address.slice(7);
      return net.isIPv4(ipv4) && isPrivateIp(ipv4);
    }
  }
  return false;
}

async function safeSourceUrl(value) {
  const parsed = new URL(value);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('unsupported protocol');
  const addresses = await dns.lookup(parsed.hostname, { all: true });
  if (!addresses.length || addresses.some((item) => isPrivateIp(item.address))) {
    throw new Error('private or unresolved source host');
  }
  return parsed;
}

function articleExcerpt(html) {
  const $ = cheerio.load(html);
  $('script,style,noscript,nav,footer,header,aside,form').remove();
  const roots = $('article').length ? $('article') : $('main').length ? $('main') : $('body');
  return roots
    .find('p')
    .map((_, element) => $(element).text().replace(/\s+/g, ' ').trim())
    .get()
    .filter((text) => text.length >= 40)
    .join(' ')
    .slice(0, 8000);
}

async function fetchArticleText(sourceUrl) {
  const parsed = await safeSourceUrl(sourceUrl);
  const response = await fetch(parsed, {
    redirect: 'follow',
    signal: AbortSignal.timeout(12_000),
    headers: { 'user-agent': 'PythhFundingEvidence/1.0 (+https://pythh.ai)' },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const contentType = response.headers.get('content-type') || '';
  if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) throw new Error('source is not HTML');
  const html = (await response.text()).slice(0, 2_000_000);
  const excerpt = articleExcerpt(html);
  if (excerpt.length < 80) throw new Error('no usable article text');
  return excerpt;
}

async function resolveMentions(bodyText, matchedInvestors, sourceUrl) {
  let text = bodyText;
  let mentions = mergeMentions(
    extractKnownInvestorMentions(text, matchedInvestors),
    findMatchedInvestorsInText(text, matchedInvestors),
  );
  if (mentions.length || !sourceUrl) return mentions;
  try {
    const pageText = await fetchArticleText(sourceUrl);
    text = `${text}\n${pageText}`;
    mentions = mergeMentions(
      extractKnownInvestorMentions(text, matchedInvestors),
      findMatchedInvestorsInText(text, matchedInvestors),
    );
  } catch {
    /* RSS-only fallback */
  }
  return mentions;
}

async function loadMatchedInvestors(startupId) {
  const investors = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from('startup_investor_matches')
      .select('investor_id, investors(id,name,firm)')
      .eq('startup_id', startupId)
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    investors.push(...uniqueInvestors(data));
    if (!data || data.length < 1000) break;
  }
  return investors;
}

async function upsertPairEvidence({ startup, investor, eventAt, sourceUrl, sourceTitle, sourceProvider, rawPayload }) {
  const { data: match } = await db
    .from('startup_investor_matches')
    .select('id')
    .eq('startup_id', startup.id)
    .eq('investor_id', investor.id)
    .lt('created_at', eventAt)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!match) return false;
  if (!apply) return true;
  const { error } = await db.from('match_validation_evidence').upsert(
    {
      match_id: match.id,
      startup_id: startup.id,
      investor_id: investor.id,
      evidence_type: 'funding',
      event_at: eventAt,
      source_url: sourceUrl,
      source_provider: sourceProvider,
      source_record_type: 'web_search',
      source_record_id: `${startup.id}:${sourceUrl}:${investor.id}`,
      resolution_method: 'name_exact_unique',
      resolution_confidence: 0.9,
      raw_payload: rawPayload,
    },
    { onConflict: 'match_id,evidence_type,source_url,event_at', ignoreDuplicates: true },
  );
  if (error) throw new Error(error.message);
  return true;
}

async function processInferenceJob(startup, job) {
  const matchedInvestors = await loadMatchedInvestors(startup.id);
  if (!matchedInvestors.length) return { events: 0, pairs: 0 };

  const articleSets = [
    await searchStartupNews(startup.name, startup.website, 8, 'funding OR raises OR investment', { lite: true }),
    await searchStartupNews(
      startup.name,
      startup.website,
      6,
      '(site:businesswire.com OR site:prnewswire.com OR site:globenewswire.com) (raises OR funding OR series)',
      { lite: true },
    ),
  ];
  if (startup.website) {
    try {
      const domain = new URL(startup.website).hostname.replace(/^www\./, '');
      articleSets.push(
        await searchStartupNews(startup.name, startup.website, 6, `"${domain}" funding OR series`, { lite: true }),
      );
    } catch {
      /* ignore bad website */
    }
  }
  for (const investor of matchedInvestors.slice(0, 3)) {
    const label = String(investor.firm || investor.name || '').trim();
    if (label.length < 4) continue;
    articleSets.push(
      await searchStartupNews(startup.name, startup.website, 4, `"${label}"`, { lite: true }),
    );
  }
  const articles = [...new Map(articleSets.flat().map((a) => [a.link || a.title, a])).values()];

  const seen = new Set();
  let events = 0;
  let pairs = 0;

  for (const article of articles) {
    if (!eligibleArticle(article, startup.name, job.earliest_match_at, startup.website)) continue;
    const headline = cleanHeadline(article.title);
    const sourceUrl = article.link;
    if (!sourceUrl) continue;

    const publishedAt = new Date(article.pubDate);
    const eventAt = publishedAt.toISOString();
    const bodyText = [headline, article.content].filter(Boolean).join('\n');
    const inferred = extractFunding(bodyText) || {};
    let mentions = await resolveMentions(bodyText, matchedInvestors, sourceUrl);
    const leadName = inferred.lead_investor;
    if (leadName) {
      const leadInvestor = matchedInvestors.find(
        (inv) => norm(inv.name) === norm(leadName) || norm(inv.firm) === norm(leadName),
      );
      if (leadInvestor && !mentions.some((m) => m.investor.id === leadInvestor.id)) {
        mentions.push({
          investor: leadInvestor,
          investorNameRaw: leadName,
          role: 'lead',
          relation: 'LED_ROUND',
          evidencePhrase: headline,
        });
      }
    }
    mentions = filterCleanHits(mentions);

    for (const mention of mentions) {
      if (!mention.investor?.id) continue;
      const key = `${eventAt}|${mention.investor.id}|${sourceUrl}`;
      if (seen.has(key)) continue;
      seen.add(key);
      events++;

      const payload = {
        startup_id: startup.id,
        investor_id: mention.investor.id,
        investor_name_raw: mention.investorNameRaw,
        event_date: eventAt.slice(0, 10),
        round_type: inferred.funding_round || inferred.funding_stage || null,
        amount_raw: inferred.funding_amount ? String(inferred.funding_amount) : null,
        source_url: sourceUrl,
        source_title: headline,
        source_provider: 'inference_engine',
        resolution_status: 'resolved',
        resolution_method: 'name_exact_unique',
        raw_payload: {
          discovery_method: 'inference_engine_free_news_search',
          publisher: article.source,
          mention,
        },
      };

      if (apply) {
        const { error } = await db.from('funding_evidence_search_results').upsert(payload, {
          onConflict: 'startup_id,source_url,investor_name_raw,event_date',
          ignoreDuplicates: true,
        });
        if (error) throw new Error(error.message);
      }

      const paired = await upsertPairEvidence({
        startup,
        investor: mention.investor,
        eventAt,
        sourceUrl,
        sourceTitle: headline,
        sourceProvider: 'inference_engine',
        rawPayload: payload,
      });
      if (paired) pairs++;
    }
  }

  return { events, pairs };
}

async function processGeminiJob(startup, job) {
  const investorRows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('investors').select('id,name').range(from, from + 999);
    if (error) throw new Error(error.message);
    investorRows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  const grouped = new Map();
  for (const i of investorRows) {
    const k = norm(i.name);
    if (!k) continue;
    grouped.set(k, [...(grouped.get(k) || []), i]);
  }
  const investors = new Map([...grouped].filter(([, v]) => v.length === 1).map(([k, v]) => [k, v[0]]));

  const prompt = `Search the public web for completed funding rounds for startup "${startup.name}" (${startup.website || 'website unknown'}) announced after ${job.earliest_match_at}. Return JSON only: {"events":[{"event_date":"YYYY-MM-DD","investor_name":"exact investor name","round_type":"","amount":"","source_url":"direct article or announcement URL","source_title":""}]}. Exclude rumors, talks, planned investments, grants, and funding that predates the cutoff. One row per named investor per completed round.`;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
      }),
      signal: AbortSignal.timeout(45000),
    },
  );
  const json = await res.json();
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${JSON.stringify(json.error || json).slice(0, 240)}`);
  const text = (json.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
  const parsed = parseSearchJson(text);
  const geminiEvents = Array.isArray(parsed.events) ? parsed.events : [];

  const seenSources = new Set();
  let events = 0;
  let pairs = 0;

  for (const event of geminiEvents) {
    if (!event.source_url || !event.event_date || !event.investor_name) continue;
    event.source_url = await directSourceUrl(event.source_url);
    const sourceKey = `${event.event_date}|${norm(event.investor_name)}|${event.source_url}`;
    if (seenSources.has(sourceKey)) continue;
    seenSources.add(sourceKey);
    const investor = investors.get(norm(event.investor_name));
    const payload = {
      startup_id: startup.id,
      investor_id: investor?.id || null,
      investor_name_raw: event.investor_name,
      event_date: event.event_date,
      round_type: event.round_type || null,
      amount_raw: event.amount || null,
      source_url: event.source_url,
      source_title: event.source_title || null,
      source_provider: 'gemini_google_search',
      resolution_status: investor ? 'resolved' : 'pending',
      resolution_method: investor ? 'name_exact_unique' : null,
      raw_payload: { grounding: json.candidates?.[0]?.groundingMetadata || {} },
    };
    if (apply) {
      const { error } = await db.from('funding_evidence_search_results').upsert(payload, {
        onConflict: 'startup_id,source_url,investor_name_raw,event_date',
        ignoreDuplicates: true,
      });
      if (error) throw new Error(error.message);
    }
    events++;
    if (investor) {
      const eventAt = `${event.event_date}T12:00:00Z`;
      const paired = await upsertPairEvidence({
        startup,
        investor,
        eventAt,
        sourceUrl: event.source_url,
        sourceTitle: event.source_title || null,
        sourceProvider: 'gemini_google_search',
        rawPayload: payload,
      });
      if (paired) pairs++;
    }
  }

  return { events, pairs };
}

if (seed) {
  const { data, error } = await db.rpc('seed_funding_evidence_search_queue');
  if (error) throw new Error(error.message);
  console.log(`queue seeded: ${data}`);
}

if (requeueEmpty && apply) {
  const { data, error } = await db
    .from('funding_evidence_search_queue')
    .update({ status: 'pending', error_message: 'requeued_after_zero_inference_hits', updated_at: new Date().toISOString() })
    .eq('status', 'complete')
    .eq('result_count', 0)
    .select('startup_id');
  if (error) throw new Error(error.message);
  console.log(`requeued ${(data || []).length} zero-result startups`);
}

const { data: jobs, error: jobError } = await db
  .from('funding_evidence_search_queue')
  .select('startup_id,earliest_match_at,attempts')
  .in('status', ['pending', 'error'])
  .order('priority', { ascending: false })
  .order('updated_at')
  .limit(limit);
if (jobError) throw new Error(jobError.message);

const searchProvider = provider === 'gemini' ? 'gemini_google_search' : 'inference_engine';
let completed = 0;
let results = 0;
let pairs = 0;

for (const job of jobs || []) {
  const { data: startup, error: suError } = await db
    .from('startup_uploads')
    .select('id,name,website')
    .eq('id', job.startup_id)
    .single();
  if (suError) continue;

  if (apply) {
    await db
      .from('funding_evidence_search_queue')
      .update({
        status: 'processing',
        attempts: (job.attempts || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('startup_id', job.startup_id);
  }

  try {
    const outcome =
      provider === 'gemini'
        ? await processGeminiJob(startup, job)
        : await processInferenceJob(startup, job);
    results += outcome.events;
    pairs += outcome.pairs;

    if (apply) {
      await db
        .from('funding_evidence_search_queue')
        .update({
          status: 'complete',
          last_searched_at: new Date().toISOString(),
          search_provider: searchProvider,
          result_count: outcome.events,
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq('startup_id', job.startup_id);
      const { error: classifyError } = await db.rpc('refresh_startup_match_outcome_classifications', {
        p_startup_id: job.startup_id,
      });
      if (classifyError) throw new Error(`classification: ${classifyError.message}`);
    }
    completed++;
  } catch (error) {
    if (apply) {
      await db
        .from('funding_evidence_search_queue')
        .update({
          status: 'error',
          error_message: String(error.message).slice(0, 500),
          updated_at: new Date().toISOString(),
        })
        .eq('startup_id', job.startup_id);
    }
    console.error(`${startup.name}: ${error.message}`);
  }
  if (delay) await sleep(delay);
}

console.log(
  JSON.stringify(
    {
      mode: apply ? 'apply' : 'dry-run',
      provider,
      search_provider: searchProvider,
      jobs: (jobs || []).length,
      completed,
      results,
      post_prediction_pairs: pairs,
    },
    null,
    2,
  ),
);
