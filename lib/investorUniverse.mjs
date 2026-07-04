/**
 * Investor universe — venture firms + angels eligible for signal enrichment.
 * Shared by pipeline-investor-intelligence, oracle backfill, and enrichment scripts.
 */

import { isGarbageInvestorName } from './investorNameHeuristics.js';

const VC_SUFFIX =
  /\b(Capital|Ventures?|Partners?|Group|Fund|Investments?|Advisors?|Holdings?|Management|Accelerator|Studio|Combinator)\b/i;

const ANGEL_HINT = /\b(angel|syndicate|scout|micro[-\s]?vc|solo[-\s]?gp)\b/i;

/**
 * @param {string} [cohort] comma-separated: venture, angel, all
 */
export function isVentureOrAngel(investor, cohort = 'venture,angel') {
  const parts = cohort.split(',').map((s) => s.trim().toLowerCase());
  const all = parts.includes('all');
  const wantVc = all || parts.includes('venture') || parts.includes('vc');
  const wantAngel = all || parts.includes('angel');

  const name = (investor.name || '').trim();
  const firm = (investor.firm || '').trim();
  const bio = (investor.bio || '').toLowerCase();
  const type = `${investor.investor_type || ''} ${investor.type || ''}`.toLowerCase();

  const isVc =
    VC_SUFFIX.test(name) ||
    VC_SUFFIX.test(firm) ||
    /\bvc firm\b/i.test(bio) ||
    /\bventure capital\b/i.test(bio);

  const isAngel =
    ANGEL_HINT.test(type) ||
    ANGEL_HINT.test(bio) ||
    /\bangel investor\b/i.test(bio);

  const isPersonAtVc =
    /^[A-Z][a-z]+(?:\s+[A-Z][a-z'.-]+){1,3}$/.test(name) &&
    firm &&
    firm.toLowerCase() !== name.toLowerCase() &&
    VC_SUFFIX.test(firm);

  const isPersonAngel =
    (investor.is_individual === true || /^[A-Z][a-z]+(?:\s+[A-Z][a-z'.-]+){1,3}$/.test(name)) &&
    (ANGEL_HINT.test(bio) || /partner|gp|general partner|investor at/i.test(bio));

  if (wantVc && (isVc || isPersonAtVc)) return true;
  if (wantAngel && (isAngel || isPersonAngel)) return true;
  return false;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 * @param {{
 *   limit?: number,
 *   offset?: number,
 *   cohort?: string,
 *   needsSignals?: boolean,
 *   needsEnrichment?: boolean,
 *   staleFirst?: boolean,
 *   requireUrl?: boolean,
 * }} [options]
 */
export async function fetchInvestorUniverse(sb, options = {}) {
  const {
    limit = 0,
    offset = 0,
    cohort = 'venture,angel',
    needsSignals = false,
    needsEnrichment = false,
    staleFirst = false,
    requireUrl = false,
  } = options;

  const pageSize = 1000;
  let page = 0;
  const raw = [];

  while (true) {
    let q = sb
      .from('investors')
      .select(
        'id, name, firm, bio, url, blog_url, investor_type, type, is_individual, investor_score, ' +
          'entity_gate, status, last_enrichment_date, signals, sectors, stage, ' +
          'check_size_min, check_size_max, portfolio_companies, investment_thesis, geography_focus, ' +
          'deployment_velocity_index, capital_power_score, focus_areas, fund_size_estimate_usd, ' +
          'last_investment_date, dry_powder_estimate'
      )
      .neq('status', 'inactive')
      .neq('entity_gate', 'junk');

    if (needsSignals) q = q.eq('signals', '[]');
    if (requireUrl) q = q.not('url', 'is', null).neq('url', '');

    if (needsEnrichment || staleFirst) {
      q = q.order('last_enrichment_date', { ascending: true, nullsFirst: true });
    } else {
      q = q.order('investor_score', { ascending: false, nullsFirst: false });
    }

    const { data, error } = await q.range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) throw new Error(`investor universe fetch: ${error.message}`);
    if (!data?.length) break;
    raw.push(...data);
    if (data.length < pageSize) break;
    page++;
  }

  let pool = raw.filter((inv) => !isGarbageInvestorName(inv.name) && isVentureOrAngel(inv, cohort));

  if (offset > 0) pool = pool.slice(offset);
  if (limit > 0) pool = pool.slice(0, limit);

  return pool;
}

/** @param {import('@supabase/supabase-js').SupabaseClient} sb */
export async function countInvestorUniverse(sb, cohort = 'venture,angel') {
  const all = await fetchInvestorUniverse(sb, { cohort, limit: 0 });
  const angels = all.filter((i) => isVentureOrAngel(i, 'angel') && !isVentureOrAngel(i, 'venture'));
  const vcs = all.filter((i) => isVentureOrAngel(i, 'venture'));
  return { total: all.length, venture: vcs.length, angel: angels.length };
}

/**
 * Parse --limit=N from argv. 0 or omitted with defaultZero=true → unlimited.
 * @param {string[]} argv
 * @param {{ defaultZero?: boolean, fallback?: number }} [opts]
 */
export function parseLimitArg(argv, opts = {}) {
  const { defaultZero = false, fallback = 0 } = opts;
  const a = argv.find((x) => x.startsWith('--limit='));
  if (!a) return defaultZero ? 0 : fallback;
  const n = parseInt(a.split('=')[1], 10);
  return Number.isFinite(n) ? n : fallback;
}

export function parseOffsetArg(argv) {
  const a = argv.find((x) => x.startsWith('--offset='));
  return a ? parseInt(a.split('=')[1], 10) || 0 : 0;
}

export function parseCohortArg(argv) {
  const a = argv.find((x) => x.startsWith('--cohort='));
  return a ? a.split('=').slice(1).join('=') : 'venture,angel';
}
