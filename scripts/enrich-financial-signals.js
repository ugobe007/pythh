/**
 * Financial Signals Enrichment — Text Mining Only
 *
 * Mines EXISTING text already in the database.
 * No website scraping (startups don't publish financials publicly).
 *
 * Extracts from pitch / description / extracted_data text:
 *   - Funding round amount + stage (most common signal in RSS-scraped data)
 *   - ARR / MRR (when mentioned in press articles)
 *   - Valuation
 *   - Revenue figures
 *   - Customer count
 *
 * Writes to extracted_data.financial_signals (JSONB) and sets has_revenue flag.
 *
 * Usage:
 *   node scripts/enrich-financial-signals.js              # dry run
 *   node scripts/enrich-financial-signals.js --execute
 *   node scripts/enrich-financial-signals.js --execute --limit=2000
 *   node scripts/enrich-financial-signals.js --execute --force  # re-process all
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const args = process.argv.slice(2);
const DRY_RUN = !args.includes('--execute');
const FORCE = args.includes('--force');
const LIMIT = (() => { const l = args.find(a => a.startsWith('--limit=')); return l ? parseInt(l.split('=')[1]) : 2000; })();
const BATCH_DB = 200; // rows to fetch per Supabase page
const BATCH_UPDATE = 100; // rows per update call

// ─────────────────────────────────────────────────────────────────────────────
// PATTERNS — all target text that ACTUALLY APPEARS in RSS funding headlines
// ─────────────────────────────────────────────────────────────────────────────

// Funding round amounts: "raises $15M", "secures $8 million", "$25M Series B"
const FUNDING_PATTERNS = [
  /(?:raises?|raised|secures?|secured|closes?|closed|receives?|received|lands?|landed|gets?|got|bags?|bags|wins?|won)\s+(?:a\s+)?(?:total\s+of\s+)?\$?([\d,.]+\s*[KkMmBb])\b/i,
  /\$?([\d,.]+\s*[KkMmBb])\s+(?:seed|series\s*[a-f]|pre[\s-]?seed|round|funding|investment|financing)\b/i,
  /(?:seed|series\s*[a-f]|pre[\s-]?seed)\s+(?:round\s+)?(?:of\s+)?\$?([\d,.]+\s*[KkMmBb])\b/i,
  /\$?([\d,.]+\s*[KkMmBb])\s+in\s+(?:seed|series|funding|venture|investment)/i,
  /funding\s+(?:round\s+)?(?:of\s+)?\$?([\d,.]+\s*[KkMmBb])\b/i,
  /investment\s+of\s+\$?([\d,.]+\s*[KkMmBb])\b/i,
  /valuation\s+of\s+\$?([\d,.]+\s*[KkMmBb])\b/i,
  /valued\s+at\s+\$?([\d,.]+\s*[KkMmBb])\b/i,
];

// Funding stage detection
const STAGE_PATTERNS = [
  [/pre[\s-]?seed/i, 'pre-seed'],
  [/\bseed\b/i, 'seed'],
  [/series\s*a\b/i, 'series-a'],
  [/series\s*b\b/i, 'series-b'],
  [/series\s*c\b/i, 'series-c'],
  [/series\s*d\b/i, 'series-d'],
  [/series\s*e\b/i, 'series-e'],
  [/series\s*[f-z]\b/i, 'late-stage'],
  [/growth\s+(equity|round|funding)/i, 'growth'],
  [/ipo|initial\s+public\s+offering|nasdaq|nyse/i, 'ipo'],
  [/spac\b/i, 'spac'],
  [/\bm&a\b|acqui[rs]/i, 'acquisition'],
];

// ARR / MRR — rare but present in some press articles
const ARR_PATTERNS = [
  /\$?([\d,.]+\s*[KkMmBb])\s+(?:in\s+)?(?:ARR|annual recurring revenue)/i,
  /(?:ARR|annual recurring revenue)[:\s]+\$?([\d,.]+\s*[KkMmBb])/i,
];
const MRR_PATTERNS = [
  /\$?([\d,.]+\s*[KkMmBb])\s+(?:MRR|monthly recurring revenue)/i,
  /(?:MRR|monthly recurring revenue)[:\s]+\$?([\d,.]+\s*[KkMmBb])/i,
];
const REVENUE_PATTERNS = [
  /\$?([\d,.]+\s*[KkMmBb])\s+in\s+(?:annual\s+)?revenue/i,
  /revenue\s+of\s+\$?([\d,.]+\s*[KkMmBb])/i,
  /generating\s+\$?([\d,.]+\s*[KkMmBb])\s+(?:in\s+)?revenue/i,
];
const CUSTOMER_PATTERNS = [
  /([\d,]+\s*[KkMmBb]?)\s*\+?\s*(?:paying\s+)?(?:customers|clients|users|subscribers)/i,
  /(?:serving|reached|acquired|over)\s+([\d,]+\s*[KkMmBb]?)\s*(?:customers|clients|users)/i,
];

// ─────────────────────────────────────────────────────────────────────────────
// PARSER
// ─────────────────────────────────────────────────────────────────────────────
function parseNumber(raw) {
  if (!raw) return null;
  let s = String(raw).replace(/,/g, '').replace(/\s+/g, '').trim();
  const mul = s.match(/([KkMmBb])$/i);
  s = s.replace(/[KkMmBb]$/i, '');
  const n = parseFloat(s);
  if (isNaN(n) || n <= 0) return null;
  if (mul) {
    const m = mul[1].toLowerCase();
    if (m === 'k') return Math.round(n * 1_000);
    if (m === 'm') return Math.round(n * 1_000_000);
    if (m === 'b') return Math.round(n * 1_000_000_000);
  }
  return Math.round(n);
}

function isYearNoise(n) { return Number.isInteger(n) && n >= 1900 && n <= 2030; }

function extractFirst(text, patterns, minVal = 0) {
  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) {
      const v = parseNumber(m[1]);
      if (v && v > minVal && !isYearNoise(v)) return v;
    }
  }
  return null;
}

function detectStage(text) {
  for (const [pat, label] of STAGE_PATTERNS) {
    if (pat.test(text)) return label;
  }
  return null;
}

function combineText(row) {
  const ext = row.extracted_data || {};
  return [
    row.name,
    row.pitch,
    row.description,
    ext.description,
    ext.pitch,
    ext.company_description,
    ext.summary,
    typeof ext.web_signals === 'object' ? JSON.stringify(ext.web_signals) : ext.web_signals,
  ].filter(Boolean).join(' ');
}

const PG_INT_MAX = 2_147_483_647;

function extractSignals(text) {
  const signals = {};

  const funding = extractFirst(text, FUNDING_PATTERNS, 10_000);
  if (funding) signals.latest_funding_amount = funding;

  const stage = detectStage(text);
  if (stage) signals.funding_stage = stage;

  const arr = extractFirst(text, ARR_PATTERNS, 5_000);
  if (arr) signals.arr = arr;

  const mrr = extractFirst(text, MRR_PATTERNS, 1_000);
  if (mrr) signals.mrr = mrr;

  const rev = extractFirst(text, REVENUE_PATTERNS, 5_000);
  if (rev && !signals.arr) signals.revenue_annual = rev;

  const customers = extractFirst(text, CUSTOMER_PATTERNS, 10);
  if (customers) signals.customer_count = customers;

  return signals;
}

function hasSignals(s) { return s && Object.keys(s).length > 0; }

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
async function enrich() {
  console.log(`\n=== FINANCIAL SIGNALS ENRICHMENT (text-only) ${DRY_RUN ? '[DRY RUN]' : '[EXECUTE]'} ===`);
  console.log(`Mode: ${FORCE ? 'force' : 'incremental'} | Limit: ${LIMIT}\n`);

  let from = 0;
  let enriched = 0, skipped = 0, total = 0;

  while (total < LIMIT) {
    const fetchSize = Math.min(BATCH_DB, LIMIT - total);

    let query = sb
      .from('startup_uploads')
      .select('id, name, pitch, description, extracted_data, has_revenue')
      .eq('status', 'approved')
      .range(from, from + fetchSize - 1);

    if (!FORCE) query = query.eq('has_revenue', false);

    const { data, error } = await query;
    if (error) { console.error('Fetch error:', error.message); break; }
    if (!data || data.length === 0) break;

    const toUpdate = [];

    for (const row of data) {
      const text = combineText(row);
      if (text.length < 20) { skipped++; continue; }

      // Skip if already has financial_signals and not forcing
      if (!FORCE) {
        const existing = (row.extracted_data || {}).financial_signals;
        if (existing && Object.keys(existing).length > 0) { skipped++; continue; }
      }

      const signals = extractSignals(text);
      if (!hasSignals(signals)) { skipped++; continue; }

      signals.enriched_at = new Date().toISOString();

      const ext = row.extracted_data || {};
      const updatedExtracted = { ...ext, financial_signals: signals };

      const update = { extracted_data: updatedExtracted };

      const hasRevenueSignal = !!(signals.arr || signals.mrr || signals.revenue_annual);
      const hasFundingSignal = !!(signals.latest_funding_amount || signals.funding_stage);

      if (hasRevenueSignal) update.has_revenue = true;

      // Only write direct numeric columns if within PG int range
      if (signals.arr && signals.arr <= PG_INT_MAX) update.arr_usd = signals.arr;
      if (signals.mrr && signals.mrr <= PG_INT_MAX) update.mrr = signals.mrr;

      toUpdate.push({ id: row.id, name: row.name, update, signals });
    }

    if (!DRY_RUN && toUpdate.length > 0) {
      for (let i = 0; i < toUpdate.length; i += BATCH_UPDATE) {
        const chunk = toUpdate.slice(i, i + BATCH_UPDATE);
        await Promise.all(chunk.map(async ({ id, name, update }) => {
          const { error: e } = await sb.from('startup_uploads').update(update).eq('id', id);
          if (e) {
            // Retry: JSONB only (handles column-not-exist and int overflow)
            const safe = { extracted_data: update.extracted_data };
            if (update.has_revenue) safe.has_revenue = true;
            const { error: e2 } = await sb.from('startup_uploads').update(safe).eq('id', id);
            if (e2) console.error(`  ⚠️ Failed ${name}:`, e2.message);
          }
        }));
      }
    }

    // Log results
    for (const { name, signals } of toUpdate) {
      const preview = Object.entries(signals)
        .filter(([k]) => k !== 'enriched_at')
        .map(([k, v]) => `${k}:${typeof v === 'number' ? v.toLocaleString() : v}`)
        .join(', ');
      console.log(`  ${DRY_RUN ? '[DRY RUN]' : '✅'} ${name?.substring(0, 36).padEnd(36)} → ${preview}`);
    }

    enriched += toUpdate.length;
    skipped += data.length - toUpdate.length;
    total += data.length;
    from += fetchSize;

    if (data.length < fetchSize) break;
  }

  console.log('\n========== RESULTS ==========');
  console.log(`Scanned:   ${total}`);
  console.log(`Enriched:  ${enriched} (${Math.round(enriched / (total || 1) * 100)}%)`);
  console.log(`Skipped:   ${skipped} (no signals in existing text)`);
  if (DRY_RUN) console.log('\nDRY RUN — re-run with --execute to save.');
}

enrich().catch(err => { console.error('Fatal:', err); process.exit(1); });

