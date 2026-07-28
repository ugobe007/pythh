#!/usr/bin/env node
/**
 * Bounded Angel Intelligence Monitor
 *
 * Watches only source-backed organizations in server/data/angel-organizations.json.
 * It does not discover or publish new investors. New facts enter a review queue.
 * Raw HTML is never persisted; each source keeps one current hash and short excerpt.
 *
 * Usage:
 *   node scripts/intelligence/angel-intelligence-monitor.mjs
 *   node scripts/intelligence/angel-intelligence-monitor.mjs --apply
 *   node scripts/intelligence/angel-intelligence-monitor.mjs --apply --limit=5
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: path.join(root, '.env') });
dotenv.config({ path: path.join(root, '.env.local'), override: false });
dotenv.config({ path: path.join(root, '.env.save'), override: false, quiet: true });

const APPLY = process.argv.includes('--apply');
const limitArg = process.argv.find((value) => value.startsWith('--limit='));
const LIMIT = Math.max(1, Math.min(100, Number(limitArg?.split('=')[1]) || 30));
const TIMEOUT_MS = 20_000;
const MAX_HTML_BYTES = 2_000_000;
const NEXT_CHECK_DAYS = 7;

const organizations = JSON.parse(
  fs.readFileSync(path.join(root, 'server/data/angel-organizations.json'), 'utf8'),
);
const approved = organizations.filter(
  (group) => group.verification_status === 'source_backed' && group.source_url,
);

const flyConfigPath = path.join(root, 'fly.toml');
const flyConfig = fs.existsSync(flyConfigPath) ? fs.readFileSync(flyConfigPath, 'utf8') : '';
const flySupabaseUrl = flyConfig.match(/^\s*SUPABASE_URL\s*=\s*["']([^"']+)/m)?.[1] || '';
const url = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || flySupabaseUrl).trim();
const key = String(
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
  '',
).trim();
const db = APPLY && url && key
  ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

if (APPLY && !db) throw new Error('Supabase service credentials are required with --apply.');

const sha = (value) => crypto.createHash('sha256').update(value).digest('hex');
const compact = (value, length = 2000) =>
  String(value || '').replace(/\s+/g, ' ').trim().slice(0, length);

function sourceUrls(group) {
  return [...new Set([group.source_url, group.application_url, group.website].filter(Boolean))]
    .filter((candidate) => {
      try {
        return new URL(candidate).protocol === 'https:';
      } catch {
        return false;
      }
    });
}

async function robotsAllows(target) {
  const parsed = new URL(target);
  const robotsUrl = `${parsed.origin}/robots.txt`;
  try {
    const response = await fetch(robotsUrl, {
      signal: AbortSignal.timeout(8_000),
      headers: { 'User-Agent': 'PythhAngelMonitor/1.0 (+https://pythh.ai)' },
    });
    if (!response.ok) return true;
    const body = await response.text();
    let applies = false;
    for (const rawLine of body.split(/\r?\n/)) {
      const line = rawLine.replace(/#.*/, '').trim();
      if (/^user-agent:/i.test(line)) {
        applies = line.split(':').slice(1).join(':').trim() === '*';
        continue;
      }
      if (!applies || !/^disallow:/i.test(line)) continue;
      const rule = line.split(':').slice(1).join(':').trim();
      if (rule && parsed.pathname.startsWith(rule)) return false;
    }
    return true;
  } catch {
    return true;
  }
}

async function fetchPage(target) {
  if (!(await robotsAllows(target))) return { skipped: 'robots_disallow' };
  const response = await fetch(target, {
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      'User-Agent': 'PythhAngelMonitor/1.0 (+https://pythh.ai)',
      Accept: 'text/html,application/xhtml+xml',
    },
  });
  const type = response.headers.get('content-type') || '';
  const length = Number(response.headers.get('content-length') || 0);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (!type.includes('text/html')) throw new Error(`Unsupported content type: ${type}`);
  if (length > MAX_HTML_BYTES) throw new Error(`Page exceeds ${MAX_HTML_BYTES} bytes`);
  const html = (await response.text()).slice(0, MAX_HTML_BYTES);
  return {
    html,
    status: response.status,
    etag: response.headers.get('etag'),
    lastModified: response.headers.get('last-modified'),
    finalUrl: response.url,
  };
}

function extractCandidates(html, sourceUrl) {
  const $ = cheerio.load(html);
  $('script,style,noscript,svg').remove();
  const title = compact($('title').first().text(), 240);
  const text = compact($('body').text(), 50_000);
  const links = $('a[href]').map((_, element) => {
    try {
      return new URL($(element).attr('href'), sourceUrl).href;
    } catch {
      return null;
    }
  }).get().filter(Boolean);
  const emails = [...new Set(
    [...text.matchAll(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi)].map((match) => match[0].toLowerCase()),
  )].slice(0, 10);
  const linkedIn = [...new Set(links.filter((link) => /linkedin\.com\/in\//i.test(link)))].slice(0, 20);
  const datePhrases = [...new Set(
    [...text.matchAll(/\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:,\s+\d{4})?\b/gi)]
      .map((match) => match[0]),
  )].slice(0, 20);

  const sentences = text.split(/(?<=[.!?])\s+/).filter((sentence) => sentence.length >= 35);
  const roleEvidence = sentences
    .filter((sentence) => /\b(executive director|managing director|president|screening chair|deal flow|investment committee|sector lead)\b/i.test(sentence))
    .slice(0, 15);
  const activityEvidence = sentences
    .filter((sentence) => /\b(invested|investment|portfolio|pitch|application|deadline|demo day|speaker|panel|podcast|sponsor)\b/i.test(sentence))
    .slice(0, 15);

  return { title, text, emails, linkedIn, datePhrases, roleEvidence, activityEvidence };
}

async function currentSource(url) {
  if (!db) return null;
  const result = await db
    .from('angel_source_state')
    .select('content_hash')
    .eq('source_url', url)
    .maybeSingle();
  if (result.error && !/does not exist|schema cache/i.test(result.error.message)) throw result.error;
  if (result.error) {
    throw new Error('Angel monitor tables are missing. Apply migration 20260728110000 first.');
  }
  return result.data;
}

async function queueCandidate(group, type, key, payload, excerpt, sourceUrl, confidence = 0.65) {
  if (!db) return;
  const result = await db.from('angel_intelligence_review_queue').upsert({
    organization_slug: group.slug,
    candidate_type: type,
    candidate_key: key,
    candidate_payload: payload,
    source_url: sourceUrl,
    evidence_excerpt: compact(excerpt, 600),
    confidence,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'organization_slug,candidate_type,candidate_key' });
  if (result.error) throw result.error;
}

async function saveSignal(group, sentence, sourceUrl) {
  if (!db) return;
  const type = /\b(application|deadline|pitch)\b/i.test(sentence)
    ? 'pitch_process'
    : /\b(invested|investment|portfolio)\b/i.test(sentence)
      ? 'investment_activity'
      : 'public_activity';
  const evidenceHash = sha(`${group.slug}|${type}|${compact(sentence, 800)}`);
  const result = await db.from('angel_intelligence_signals').upsert({
    organization_slug: group.slug,
    signal_type: type,
    headline: compact(sentence, 240),
    evidence_excerpt: compact(sentence, 800),
    source_url: sourceUrl,
    evidence_hash: evidenceHash,
    confidence: 0.65,
    verification_status: 'candidate',
  }, { onConflict: 'evidence_hash', ignoreDuplicates: true });
  if (result.error) throw result.error;
}

async function monitor(group, sourceUrl) {
  const result = await fetchPage(sourceUrl);
  if (result.skipped) return { sourceUrl, status: result.skipped };
  const extracted = extractCandidates(result.html, result.finalUrl || sourceUrl);
  const contentHash = sha(extracted.text);
  const previous = await currentSource(sourceUrl);
  const changed = previous?.content_hash !== contentHash;

  if (db) {
    const now = new Date();
    const nextCheck = new Date(now.getTime() + NEXT_CHECK_DAYS * 86_400_000);
    const saved = await db.from('angel_source_state').upsert({
      organization_slug: group.slug,
      source_url: sourceUrl,
      source_kind: sourceUrl === group.application_url ? 'application' : 'official_website',
      content_hash: contentHash,
      page_title: extracted.title,
      text_excerpt: compact(extracted.text, 2000),
      etag: result.etag,
      last_modified: result.lastModified,
      http_status: result.status,
      checked_at: now.toISOString(),
      changed_at: changed ? now.toISOString() : undefined,
      next_check_at: nextCheck.toISOString(),
      failure_count: 0,
      last_error: null,
      updated_at: now.toISOString(),
    }, { onConflict: 'source_url' });
    if (saved.error) throw saved.error;

    if (changed) {
      for (const email of extracted.emails) {
        await queueCandidate(group, 'public_email', email, { email }, email, sourceUrl, 0.9);
      }
      for (const profileUrl of extracted.linkedIn) {
        await queueCandidate(group, 'linkedin_profile', profileUrl, { linkedin_url: profileUrl }, profileUrl, sourceUrl, 0.8);
      }
      for (const phrase of extracted.datePhrases) {
        await queueCandidate(group, 'date_phrase', sha(phrase), { date_phrase: phrase }, phrase, sourceUrl, 0.55);
      }
      for (const evidence of extracted.roleEvidence) {
        await queueCandidate(group, 'role_evidence', sha(evidence), {}, evidence, sourceUrl, 0.6);
      }
      for (const evidence of extracted.activityEvidence.slice(0, 8)) {
        await saveSignal(group, evidence, sourceUrl);
      }
    }
  }

  return {
    sourceUrl,
    status: changed ? 'changed' : 'unchanged',
    candidates: {
      emails: extracted.emails.length,
      linkedin: extracted.linkedIn.length,
      dates: extracted.datePhrases.length,
      roles: extracted.roleEvidence.length,
      signals: extracted.activityEvidence.slice(0, 8).length,
    },
  };
}

const targets = approved.flatMap((group) =>
  sourceUrls(group).map((sourceUrl) => ({ group, sourceUrl })),
).slice(0, LIMIT);

const report = [];
for (const target of targets) {
  try {
    const result = await monitor(target.group, target.sourceUrl);
    report.push({ organization: target.group.name, ...result });
  } catch (error) {
    report.push({
      organization: target.group.name,
      sourceUrl: target.sourceUrl,
      status: 'error',
      error: compact(error.message, 300),
    });
  }
}

console.log(JSON.stringify({
  mode: APPLY ? 'apply' : 'dry_run',
  bounded_organizations: approved.length,
  targets_checked: report.length,
  report,
}, null, 2));

if (report.some((item) => /tables are missing/i.test(item.error || ''))) process.exitCode = 2;
