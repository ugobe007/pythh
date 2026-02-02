#!/usr/bin/env tsx
/**
 * SEC Form D Fetcher (Phase 3 - VC Faith Signals)
 *
 * - Pulls recent Form D filings from EDGAR for a list of VC CIKs
 * - Normalizes into vc_portfolio_exhaust table as "exhaust" evidence
 * - Skips duplicates using composite unique index
 *
 * Usage:
 *   ENV_FILE=.env.bak npx tsx scripts/edgar/sec-formd-fetcher.ts --ciks "0001061768,0001462045" --limit 25
 *   ENV_FILE=.env.bak npx tsx scripts/edgar/sec-formd-fetcher.ts --top50
 */

import { config } from 'dotenv';
config({ path: '.env.bak' });
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_KEY as string
);

const USER_AGENT = process.env.SEC_USER_AGENT || 'HotHoney/1.0 (hot-honey-sec-fetcher) contact: founders@hothoney.com';
const SEC_HOST = 'https://data.sec.gov';
const DEFAULT_LIMIT = Number(process.env.SEC_FORMD_LIMIT || 50);

interface FormDFiling {
  accessionNumber: string;
  filingDate: string;
  primaryDocDescription?: string;
  primaryDocument?: string;
  issuerName?: string;
}

function normalizeCik(raw: string) {
  return raw.replace(/\D/g, '').padStart(10, '0');
}

function buildPrimaryDocUrl(cik: string, accession: string, primaryDocument?: string) {
  const cleanAccession = accession.replace(/-/g, '');
  const doc = primaryDocument || 'primary_doc.xml';
  return `${SEC_HOST}/Archives/edgar/data/${Number(cik)}/${cleanAccession}/${doc}`;
}

function hashPortfolioKey(investorId: string | null, startupName: string | undefined, sourceUrl: string | undefined, filingDate?: string) {
  const base = `${investorId || ''}|${startupName || ''}|${sourceUrl || ''}|${filingDate || ''}`;
  return createHash('sha256').update(base).digest('hex');
}

async function fetchRecentFormD(cik: string, limit: number): Promise<FormDFiling[]> {
  const cikNorm = normalizeCik(cik);
  const url = `${SEC_HOST}/submissions/CIK${cikNorm}.json`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/json'
    }
  });

  if (!res.ok) {
    throw new Error(`SEC fetch failed for CIK ${cikNorm}: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const filings = data?.filings?.recent;
  if (!filings || !filings.form) return [];

  const rows: FormDFiling[] = [];
  for (let i = 0; i < filings.form.length && rows.length < limit; i++) {
    if (filings.form[i] !== 'D') continue;
    rows.push({
      accessionNumber: filings.accessionNumber[i],
      filingDate: filings.filingDate[i],
      primaryDocDescription: filings.primaryDocDescription?.[i],
      primaryDocument: filings.primaryDocument?.[i],
      issuerName: filings.issuerName?.[i]
    });
  }

  return rows;
}

async function upsertPortfolioExhaust(
  cik: string,
  investorId: string | null,
  filings: FormDFiling[]
) {
  if (!filings.length) return { added: 0, skipped: 0 };

  let added = 0;
  let skipped = 0;

  for (const filing of filings) {
    const sourceUrl = buildPrimaryDocUrl(cik, filing.accessionNumber, filing.primaryDocument);
    const hash = hashPortfolioKey(investorId, filing.issuerName, sourceUrl, filing.filingDate);

    const { error } = await supabase
      .from('vc_portfolio_exhaust')
      .upsert({
        investor_id: investorId,
        cik,
        startup_name: filing.issuerName,
        source_type: 'sec_form_d',
        source_url: sourceUrl,
        filing_date: filing.filingDate,
        round: filing.primaryDocDescription,
        raw: filing,
        validation_status: 'unvalidated',
        startup_website: null,
        amount: null,
        currency: 'USD'
      }, { onConflict: 'investor_id,startup_id,startup_name,source_url,filing_date' });

    if (error) {
      // Unique violation -> treat as skip
      if (error.code === '23505') {
        skipped++;
        continue;
      }
      console.error(`❌ Upsert failed for ${filing.accessionNumber}: ${error.message}`);
      skipped++;
      continue;
    }

    added++;
    // Small sleep to respect SEC rate limits
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return { added, skipped };
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts: { ciks?: string[]; top50?: boolean; limit?: number } = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--ciks' && args[i + 1]) {
      opts.ciks = args[i + 1].split(',').map(s => s.trim()).filter(Boolean);
      i++;
    }
    if (args[i] === '--top50') opts.top50 = true;
    if (args[i] === '--limit' && args[i + 1]) {
      opts.limit = Number(args[i + 1]);
      i++;
    }
  }

  return opts;
}

function getTop50Ciks() {
  // Real VC CIKs (verified from SEC EDGAR)
  // To find more: https://www.sec.gov/cgi-bin/browse-edgar?company=&CIK=&type=D&dateb=&owner=include&count=100&search_text=
  return [
    '0001504886', // First Round Capital
    '0001731126', // Lightspeed Venture Partners
    '0001363310', // Kleiner Perkins
    '0001576942', // Founders Fund
    '0001447669', // General Catalyst
    '0001623690', // Greylock Partners
    '0001485682', // New Enterprise Associates
    '0001558067', // Spark Capital
    '0001652044'  // Benchmark Capital
  ];
}

async function main() {
  const { ciks, top50, limit } = parseArgs();
  const cikList = ciks && ciks.length ? ciks : (top50 ? getTop50Ciks() : []);
  const maxRows = limit || DEFAULT_LIMIT;

  if (!cikList.length) {
    console.log('Provide --ciks "cik1,cik2" or --top50');
    process.exit(1);
  }

  console.log(`🔎 Fetching Form D for ${cikList.length} CIK(s), limit ${maxRows} per CIK`);

  let totalAdded = 0;
  let totalSkipped = 0;

  for (const cik of cikList) {
    try {
      const filings = await fetchRecentFormD(cik, maxRows);
      console.log(`CIK ${cik}: found ${filings.length} Form D filings`);

      // TODO: map CIK to investor_id once mapping table is available
      const investorId = null;
      const { added, skipped } = await upsertPortfolioExhaust(cik, investorId, filings);
      totalAdded += added;
      totalSkipped += skipped;
    } catch (err: any) {
      console.error(`❌ Failed for CIK ${cik}: ${err.message}`);
    }

    // Rate limit: 10 requests/sec max per SEC guidance
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('========================================');
  console.log(`✅ Added:   ${totalAdded}`);
  console.log(`⏭️  Skipped: ${totalSkipped}`);
  console.log('Done.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
