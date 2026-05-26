#!/usr/bin/env node
/**
 * Re-assess portfolio funding events for press verification (Google News + amount + source URL).
 *
 * Usage:
 *   node scripts/verify-portfolio-funding.mjs
 *   node scripts/verify-portfolio-funding.mjs --dry-run
 */

import https from 'https';
import http from 'http';
import { URL } from 'url';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import {
  parseGoogleNewsRss,
  assessVerifiedNewsHit,
} from '../server/lib/portfolioFundingVerify.js';

dotenv.config();

const DRY_RUN = process.argv.includes('--dry-run');
const FETCH_TIMEOUT_MS = 10_000;

function sb() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function fetchText(url, timeoutMs = FETCH_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    let settled = false;
    const finish = (err, body = '') => {
      if (settled) return;
      settled = true;
      if (err) reject(err);
      else resolve(body);
    };
    const req = lib.get(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        headers: { 'User-Agent': 'Pythh-PortfolioBot/1.0' },
        timeout: timeoutMs,
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (d) => {
          body += d;
          if (body.length > 200_000) {
            req.destroy();
            finish(null, body);
          }
        });
        res.on('end', () => finish(null, body));
      }
    );
    req.on('error', (err) => finish(err));
    req.on('timeout', () => {
      req.destroy();
      finish(new Error('timeout'));
    });
  });
}

async function scrapeGoogleNews(companyName) {
  const q = encodeURIComponent(`"${companyName}" funding OR raises OR round OR investment`);
  const url = `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;
  try {
    const xml = await fetchText(url);
    return parseGoogleNewsRss(xml);
  } catch {
    return [];
  }
}

async function main() {
  console.log('🔍 Portfolio funding verification pass');
  if (DRY_RUN) console.log('   (dry-run — no DB writes)\n');

  const client = sb();
  const { data: events, error } = await client
    .from('portfolio_events')
    .select('id, startup_id, portfolio_id, verified, headline, amount_usd, source_url')
    .eq('event_type', 'funding_round')
    .order('event_date', { ascending: false });

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  const startupIds = [...new Set((events || []).map((e) => e.startup_id).filter(Boolean))];
  const { data: startups } = await client
    .from('startup_uploads')
    .select('id, name')
    .in('id', startupIds);

  const nameById = new Map((startups || []).map((s) => [s.id, s.name]));
  let verified = 0;
  let checked = 0;

  for (const ev of events || []) {
    const name = nameById.get(ev.startup_id);
    if (!name) continue;
    checked += 1;

    if (ev.verified && ev.source_url) {
      verified += 1;
      continue;
    }

    const newsItems = await scrapeGoogleNews(name);
    const hit = assessVerifiedNewsHit(name, newsItems);
    if (!hit) continue;

    console.log(`  ✓ ${name}: ${hit.headline.slice(0, 72)}…`);
    verified += 1;

    if (!DRY_RUN) {
      await client
        .from('portfolio_events')
        .update({
          verified: true,
          source_url: hit.source_url,
          source_name: hit.source_name,
          headline: hit.headline,
          amount_usd: hit.amount_usd || ev.amount_usd,
          round_type: hit.round_type,
          lead_investor: hit.lead_investor,
        })
        .eq('id', ev.id);
    }

    await new Promise((r) => setTimeout(r, 350));
  }

  console.log(`\nDone — ${verified} verified of ${checked} funding events checked.`);
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
