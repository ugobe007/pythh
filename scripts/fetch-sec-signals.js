'use strict';
/**
 * scripts/fetch-sec-signals.js
 *
 * Pulls recent SEC EDGAR filings and converts them into Pythh signals.
 *
 * Filing types and their signal meaning:
 *   8-K  → material events: M&A, executive changes, funding, distress
 *   S-1  → IPO filing confirmed → exit_signal (0.98)
 *   SC TO-T → tender offer → acquisition_signal (0.99)
 *   SC 13D/G → major stake acquired → investor_interest_signal (0.90)
 *   NT 10-K → late filing → possible distress_signal (0.70)
 *
 * Usage:
 *   node scripts/fetch-sec-signals.js             # dry-run
 *   node scripts/fetch-sec-signals.js --apply     # write to DB
 *   node scripts/fetch-sec-signals.js --days 7    # look back N days (default 2)
 */

require('dotenv').config();
const https       = require('https');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY
                  || process.env.SUPABASE_SERVICE_ROLE_KEY
                  || process.env.VITE_SUPABASE_ANON_KEY;
const supabase     = createClient(SUPABASE_URL, SUPABASE_KEY);

const args    = process.argv.slice(2);
const DRY_RUN = !args.includes('--apply');
const DAYS    = parseInt(args.find(a => a.startsWith('--days='))?.split('=')[1] || '2', 10);

// ── EDGAR full-text search API (no auth required) ─────────────────────────
const EDGAR_BASE = 'https://efts.sec.gov/LATEST/search-index?q=%22startup%22+%22funding%22&dateRange=custom&startdt=';
const EDGAR_FULL = 'https://efts.sec.gov/LATEST/search-index?q=%22series+a%22+OR+%22series+b%22+OR+%22series+c%22+OR+%22acquisition%22&forms=8-K&dateRange=custom&startdt=';

// EDGAR ATOM feeds — no auth, freely available
const EDGAR_FEEDS = [
  {
    url:  'https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=8-K&dateb=&owner=include&count=40&search_text=&output=atom',
    type: '8-K',
    description: 'Material events: M&A, exec changes, funding, distress',
  },
  {
    url:  'https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=S-1&dateb=&owner=include&count=20&search_text=&output=atom',
    type: 'S-1',
    description: 'IPO registration — exit signal confirmed',
  },
  {
    url:  'https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=SC+TO-T&dateb=&owner=include&count=20&search_text=&output=atom',
    type: 'SC TO-T',
    description: 'Tender offer — acquisition imminent',
  },
  {
    url:  'https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=SC+13D&dateb=&owner=include&count=20&search_text=&output=atom',
    type: 'SC 13D',
    description: 'Major stake acquired — activist or strategic investor',
  },
  {
    url:  'https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=NT+10-K&dateb=&owner=include&count=20&search_text=&output=atom',
    type: 'NT 10-K',
    description: 'Late annual filing — possible distress indicator',
  },
];

// ── Filing type → signal mapping ──────────────────────────────────────────
const FILING_SIGNAL_MAP = {
  '8-K':    { signal_class: 'market_signal',        strength: 0.75, confidence: 0.90, signal_type: 'event',    evidence_quality: 'confirmed' },
  'S-1':    { signal_class: 'exit_signal',           strength: 0.98, confidence: 0.98, signal_type: 'exit',     evidence_quality: 'confirmed', action_tag: 'action_exit_prep',    meaning: 'S-1 filed — IPO registration confirmed' },
  'SC TO-T':{ signal_class: 'acquisition_signal',   strength: 0.99, confidence: 0.99, signal_type: 'event',    evidence_quality: 'confirmed', action_tag: 'action_acquiring',    meaning: 'Tender offer filed — acquisition imminent' },
  'SC 13D': { signal_class: 'investor_interest_signal', strength: 0.90, confidence: 0.90, signal_type: 'investor', evidence_quality: 'confirmed', action_tag: 'action_investor_diligence', meaning: 'SC 13D filed — major stake acquired by activist or strategic investor' },
  'NT 10-K':{ signal_class: 'distress_signal',      strength: 0.70, confidence: 0.75, signal_type: 'distress', evidence_quality: 'inferred',  action_tag: 'action_survival',    meaning: 'NT 10-K filed — annual report late, possible distress indicator' },
};

// ── 8-K item classification (item numbers in filing → signal class) ────────
const EIGHTK_ITEM_MAP = {
  '1.01': { signal_class: 'partnership_signal',        strength: 0.85, meaning: '8-K 1.01: Material agreement entered' },
  '1.02': { signal_class: 'distress_signal',           strength: 0.90, meaning: '8-K 1.02: Material agreement terminated' },
  '1.03': { signal_class: 'distress_signal',           strength: 0.95, meaning: '8-K 1.03: Bankruptcy or receivership filed' },
  '2.01': { signal_class: 'acquisition_signal',        strength: 0.99, meaning: '8-K 2.01: Acquisition or disposition of assets' },
  '2.02': { signal_class: 'revenue_signal',            strength: 0.90, meaning: '8-K 2.02: Financial results released' },
  '2.03': { signal_class: 'fundraising_signal',        strength: 0.92, meaning: '8-K 2.03: Debt obligation created' },
  '2.04': { signal_class: 'distress_signal',           strength: 0.85, meaning: '8-K 2.04: Default or acceleration of obligation' },
  '3.01': { signal_class: 'exit_signal',               strength: 0.95, meaning: '8-K 3.01: Delisting or transfer of listing' },
  '3.02': { signal_class: 'distress_signal',           strength: 0.80, meaning: '8-K 3.02: Unregistered securities sold' },
  '5.01': { signal_class: 'acquisition_signal',        strength: 0.99, meaning: '8-K 5.01: Change in control' },
  '5.02': { signal_class: 'hiring_signal',             strength: 0.92, meaning: '8-K 5.02: Director or executive officer change' },
  '7.01': { signal_class: 'market_signal',             strength: 0.70, meaning: '8-K 7.01: Regulation FD disclosure (guidance)' },
  '8.01': { signal_class: 'market_signal',             strength: 0.65, meaning: '8-K 8.01: Other events' },
};

// ── HTTP helper ───────────────────────────────────────────────────────────
function fetchText(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Pythh-Signal-Bot/1.0 (signal-intelligence@pythh.com)',
        'Accept': 'application/atom+xml, application/xml, text/xml',
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// ── HTML entity decoder (EDGAR titles use &amp; etc.) ─────────────────────
function decodeHtml(str) {
  return (str || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, ' ')  // strip any remaining tags
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Parse EDGAR Atom feed ─────────────────────────────────────────────────
// EDGAR Atom title format: "CompanyName - 8-K"  or  "CompanyName - S-1/A"
function parseAtomEntries(xml, filingType) {
  const cutoff = new Date(Date.now() - DAYS * 86400000);
  const entries = [];

  const entryBlocks = xml.match(/<entry>([\s\S]*?)<\/entry>/g) || [];
  for (const block of entryBlocks) {
    const rawTitle  = (block.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1] || '';
    const title     = decodeHtml(rawTitle);
    const updated   = (block.match(/<updated>(.*?)<\/updated>/) || [])[1] || '';
    const link      = (block.match(/href="([^"]+)"/)             || [])[1] || '';
    const rawSummary = (block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/) || [])[1] || '';
    const summary   = decodeHtml(rawSummary).slice(0, 300);

    // EDGAR title format is: "FILING-TYPE - CompanyName (CIK) (Filer)"
    // e.g. "8-K - Advanced Flower Capital Inc. (0001822523) (Filer)"
    // Strip the filing-type prefix and the CIK/Filer suffix
    const companyName = title
      .replace(/^[\w\/\-]+ - /i, '')           // strip "8-K - ", "S-1 - ", "SC 13D - " prefix
      .replace(/\s*\(\d{10}\)\s*\(Filer\)\s*$/i, '') // strip "(0001234567) (Filer)" suffix
      .replace(/\s*\(\d{7,12}\)\s*$/i, '')     // strip bare CIK suffix
      .trim();

    if (!updated || new Date(updated) < cutoff) continue;

    // Detect 8-K item number from summary: "Item 5.02: Departure of Directors..."
    const itemMatch = summary.match(/\bItem\s+(\d+\.\d+)/i);
    const itemNumber = itemMatch ? itemMatch[1] : null;

    entries.push({
      title:        title.trim(),
      filing_date:  updated,
      filing_url:   link,
      company_name: companyName.trim(),
      summary:      summary.trim().slice(0, 500),
      filing_type:  filingType,
      item_number:  itemNumber, // e.g. "5.02", "2.01", "1.01"
    });
  }
  return entries;
}

// ── Try to match EDGAR entry to existing pythh_entities ───────────────────
async function resolveEntity(companyName) {
  if (!companyName || companyName.length < 3) return null;
  const clean = companyName.replace(/,?\s+(Inc|Corp|LLC|Ltd|Co|Holdings?|Group)\.?$/i, '').trim();
  const { data } = await supabase
    .from('pythh_entities')
    .select('id, name')
    .ilike('name', `%${clean}%`)
    .limit(1);
  return data?.[0] || null;
}

// ── Main ──────────────────────────────────────────────────────────────────
async function run() {
  console.log('\n📋 SEC EDGAR SIGNAL FETCHER');
  console.log('═'.repeat(60));
  console.log(`Mode:     ${DRY_RUN ? '🔍 DRY-RUN' : '✍️  APPLY'}`);
  console.log(`Lookback: ${DAYS} days`);
  console.log('═'.repeat(60) + '\n');

  const stats = {
    feeds_ok:        0,
    feeds_err:       0,
    entries_parsed:  0,
    entities_matched: 0,
    signals_written: 0,
    signals_unmatched: 0,
    by_type:         {},
  };

  const signalBuf = [];

  for (const feed of EDGAR_FEEDS) {
    process.stdout.write(`  Fetching ${feed.type}: ${feed.description.slice(0, 40)}... `);
    let xml;
    try {
      xml = await fetchText(feed.url);
      stats.feeds_ok++;
    } catch (err) {
      stats.feeds_err++;
      console.log(`❌ ${err.message}`);
      continue;
    }

    const entries = parseAtomEntries(xml, feed.type);
    stats.entries_parsed += entries.length;
    stats.by_type[feed.type] = (stats.by_type[feed.type] || 0) + entries.length;
    console.log(`✓  (${entries.length} filings)`);

    for (const entry of entries) {
      // For 8-K: try item-level signal first, fall back to generic market_signal
      const itemSig = (feed.type === '8-K' && entry.item_number)
        ? EIGHTK_ITEM_MAP[entry.item_number]
        : null;
      const filingBase = FILING_SIGNAL_MAP[feed.type] || FILING_SIGNAL_MAP['8-K'];
      const base = itemSig
        ? { ...filingBase, signal_class: itemSig.signal_class, strength: itemSig.strength, meaning: itemSig.meaning }
        : filingBase;

      // Try to match to an existing entity
      let entity = null;
      if (!DRY_RUN) {
        entity = await resolveEntity(entry.company_name);
      }

      if (entity) stats.entities_matched++;
      else stats.signals_unmatched++;

      if (DRY_RUN) {
        const itemLabel = entry.item_number ? ` [Item ${entry.item_number}]` : '';
        console.log(`  [DRY] ${entry.filing_type}${itemLabel} — ${entry.company_name} → ${base.signal_class} (${base.strength})`);
        if (entry.summary) console.log(`        "${entry.summary.slice(0, 80)}"`);
        stats.signals_written++;
        continue;
      }

      if (!entity) continue; // only write signals for known entities

      signalBuf.push({
        entity_id:        entity.id,
        source:           'sec_edgar',
        source_type:      'sec_filing',
        source_url:       entry.filing_url,
        detected_at:      entry.filing_date,
        raw_sentence:     entry.title,
        signal_object:    { filing_type: entry.filing_type, summary: entry.summary, url: entry.filing_url },
        primary_signal:   base.signal_class,
        signal_type:      base.signal_type,
        signal_strength:  base.strength,
        confidence:       base.confidence,
        evidence_quality: base.evidence_quality,
        actor_type:       'actor_startup',
        action_tag:       base.action_tag || 'action_sec_filing',
        modality:         'active',
        intensity:        [],
        posture:          null,
        is_costly_action: ['acquisition_signal','exit_signal'].includes(base.signal_class),
        is_ambiguous:     false,
        is_multi_signal:  false,
        has_negation:     false,
        sub_signals:      [],
        who_cares: {
          investors:  true,
          vendors:    ['buyer_signal','buyer_pain_signal'].includes(base.signal_class),
          acquirers:  ['exit_signal','acquisition_signal','distress_signal'].includes(base.signal_class),
          recruiters: base.signal_class === 'hiring_signal',
        },
        likely_stage:  null,
        likely_needs:  [],
        urgency:       null,
      });
    }
  }

  // Write signals
  if (!DRY_RUN && signalBuf.length) {
    for (let i = 0; i < signalBuf.length; i += 50) {
      const chunk = signalBuf.slice(i, i + 50);
      const { error } = await supabase.from('pythh_signal_events').insert(chunk);
      if (!error) stats.signals_written += chunk.length;
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log('📊 RESULTS');
  console.log('═'.repeat(60));
  console.log(`Feeds OK:            ${stats.feeds_ok} / ${EDGAR_FEEDS.length}`);
  console.log(`Feeds failed:        ${stats.feeds_err}`);
  console.log(`Entries parsed:      ${stats.entries_parsed}`);
  console.log(`Entities matched:    ${stats.entities_matched}`);
  console.log(`Signals written:     ${stats.signals_written}`);
  console.log(`Unmatched (no entity): ${stats.signals_unmatched}`);
  console.log('\nBy filing type:');
  Object.entries(stats.by_type).forEach(([t, n]) => console.log(`  ${t.padEnd(10)} ${n}`));
  console.log('═'.repeat(60) + '\n');
}

run().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
