#!/usr/bin/env node
import 'dotenv/config';
import dns from 'node:dns/promises';
import net from 'node:net';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { extractKnownInvestorMentions, extractExplicitParticipantMentions } = require('../server/lib/fundingParticipationOntology.js');
const { isPlausibleInvestorEntityName, normalizeEntityName, resolveCanonicalEntity } = require('../server/lib/fundingEvidenceLedger.js');

const apply = process.argv.includes('--apply');
const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
const limit = Math.min(Math.max(Number(limitArg?.split('=')[1] || 100), 1), 500);
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and service-role key are required');
const db = createClient(url, key, { auth: { persistSession: false } });

function isPrivateIp(address) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  return net.isIPv6(address) && (address === '::1' || address.startsWith('fc') || address.startsWith('fd') || address.startsWith('fe80:'));
}

async function safeUrl(value) {
  const parsed = new URL(value);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('unsupported protocol');
  const addresses = await dns.lookup(parsed.hostname, { all: true });
  if (!addresses.length || addresses.some(item => isPrivateIp(item.address))) throw new Error('private or unresolved source host');
  return parsed;
}

function excerptFromHtml(html) {
  const $ = cheerio.load(html);
  $('script,style,noscript,nav,footer,header,aside,form').remove();
  const root = $('article').length ? $('article') : $('main').length ? $('main') : $('body');
  return root.find('p').map((_, el) => $(el).text().replace(/\s+/g, ' ').trim()).get()
    .filter(text => text.length >= 40).join('\n').slice(0, 8000);
}

function focusedEvidenceExcerpt(excerpt) {
  // Investor evidence normally appears near the opening funding description.
  // Excluding page tails prevents related-story and newsletter deal lists from
  // being attributed to the startup in the current article.
  return String(excerpt || '').slice(0, 4500);
}

async function fetchExcerpt(sourceUrl) {
  const parsed = await safeUrl(sourceUrl);
  const response = await fetch(parsed, { redirect: 'error', signal: AbortSignal.timeout(12_000), headers: { 'user-agent': 'PythhFundingEvidence/1.0 (+https://pythh.ai)' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (!/text\/html|application\/xhtml\+xml/i.test(response.headers.get('content-type') || '')) throw new Error('source is not HTML');
  if (Number(response.headers.get('content-length') || 0) > 2_000_000) throw new Error('source exceeds size limit');
  const excerpt = excerptFromHtml((await response.text()).slice(0, 2_000_000));
  if (excerpt.length < 80) throw new Error('no usable article text');
  return excerpt;
}

async function main() {
  const [{ data: events, error: eventError }, { data: investors, error: investorError }, { data: memberships, error: membershipError }] = await Promise.all([
    db.from('funding_evidence_events').select('id,startup_name_raw,source_url,source_title,verification_status,metadata').in('verification_status', ['verified', 'corroborated']).order('announced_at', { ascending: false }).limit(limit),
    db.from('investors').select('id,name,firm').limit(10000),
    db.from('investor_organization_memberships').select('investor_id,organization_id,resolution_confidence').limit(20000),
  ]);
  if (eventError) throw eventError;
  if (investorError) throw investorError;
  if (membershipError) throw membershipError;
  const membershipByInvestor = new Map((memberships || []).map(row => [row.investor_id, row]));
  const results = [];
  let participantsWritten = 0;

  for (const event of events || []) {
    let excerpt = event.metadata?.funding_evidence_excerpt || '';
    let fetchStatus = excerpt ? 'cached' : 'headline_only';
    if (!excerpt && event.source_url) {
      try { excerpt = await fetchExcerpt(event.source_url); fetchStatus = 'fetched'; }
      catch (error) { fetchStatus = `unavailable:${error.message}`; }
    }
    const evidenceText = `${event.source_title || ''}. ${focusedEvidenceExcerpt(excerpt)}`.trim().slice(0, 5500);
    const seenParticipants = new Set();
    const knownMentions = extractKnownInvestorMentions(evidenceText, investors || [])
      .filter(mention => mention.relation && mention.role !== 'unknown' && isPlausibleInvestorEntityName(mention.investorNameRaw))
      .filter(mention => {
        const membership = membershipByInvestor.get(mention.investor.id);
        const key = membership?.organization_id || normalizeEntityName(mention.investor.firm || mention.investor.name || mention.investorNameRaw);
        if (!key || seenParticipants.has(key)) return false;
        seenParticipants.add(key);
        return true;
      });
    const mentions = [...knownMentions];
    for (const rawMention of extractExplicitParticipantMentions(evidenceText)) {
      if (!isPlausibleInvestorEntityName(rawMention.investorNameRaw)) continue;
      const resolution = resolveCanonicalEntity(investors || [], rawMention.investorNameRaw);
      const membership = resolution.row ? membershipByInvestor.get(resolution.row.id) : null;
      const participantKey = membership?.organization_id || normalizeEntityName(resolution.row?.firm || resolution.row?.name || rawMention.investorNameRaw);
      if (!participantKey || seenParticipants.has(participantKey)) continue;
      seenParticipants.add(participantKey);
      mentions.push({ ...rawMention, investor: resolution.row || null, resolution });
    }
    if (apply) {
      if (excerpt) {
        const { error } = await db.from('funding_evidence_events').update({
          metadata: {
            ...(event.metadata || {}),
            funding_evidence_excerpt: excerpt,
            funding_evidence_excerpt_source: fetchStatus,
            participant_list_complete: event.metadata?.participant_list_complete === true,
            participant_enrichment_version: 'v1',
          },
          updated_at: new Date().toISOString(),
        }).eq('id', event.id);
        if (error) throw error;
      }
      for (const mention of mentions) {
        const membership = mention.investor ? membershipByInvestor.get(mention.investor.id) : null;
        const resolution = mention.resolution || { status: 'resolved', confidence: 1 };
        const { error } = await db.from('funding_evidence_participants').upsert({
          funding_event_id: event.id,
          investor_name_raw: mention.investorNameRaw,
          investor_id: mention.investor?.id || null,
          investor_organization_id: membership?.organization_id || null,
          participant_role: mention.role,
          participation_relation: mention.relation,
          evidence_phrase: mention.evidencePhrase,
          resolution_status: resolution.status,
          resolution_confidence: resolution.confidence,
          evidence: { extraction_version: 'funding-participant-enrichment-v1', source: fetchStatus },
          updated_at: new Date().toISOString(),
        }, { onConflict: 'funding_event_id,investor_name_raw' });
        if (error) throw error;
        participantsWritten++;
      }
    }
    results.push({ event_id: event.id, startup: event.startup_name_raw, source_status: fetchStatus, mentions: mentions.map(row => ({ investor: row.investorNameRaw, role: row.role, relation: row.relation })) });
  }
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', events_scanned: events?.length || 0, sources_available: results.filter(row => !row.source_status.startsWith('unavailable:')).length, events_with_proven_participants: results.filter(row => row.mentions.length).length, proven_participants: results.reduce((sum, row) => sum + row.mentions.length, 0), participants_written: participantsWritten, results }, null, 2));
}

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
