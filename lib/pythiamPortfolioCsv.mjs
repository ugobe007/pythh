/**
 * Investor-review CSV for the public Oracle book at pythh.ai/portfolio.
 * Columns match the scoreboard cards (name, GOD, health, MOIC, latest round).
 */

export const PORTFOLIO_PAGE_URL = 'https://pythh.ai/portfolio';
export const PORTFOLIO_API_URL = 'https://pythh.ai/api/portfolio';

export const PYTHIAM_PORTFOLIO_CSV_COLUMNS = [
  'name',
  'website',
  'pythh_url',
  'description',
  'primary_sector',
  'current_stage',
  'status',
  'health_tier',
  'entry_date',
  'entry_god_score',
  'current_god_score',
  'god_delta',
  'moic',
  'irr_pct',
  'entry_valuation_usd',
  'current_valuation_usd',
  'latest_round_type',
  'latest_round_post_money_usd',
  'latest_lead_investor',
  'total_rounds_tracked',
  'signal_score',
  'sector_god_percentile',
  'days_since_last_event',
  'verified_funding_last_90d',
  'exit_acquirer',
  'exit_type',
  'exit_date',
  'holding_days',
  'entered_late',
  'virtual_check_usd',
];

export function escapeCsvValue(value) {
  if (value == null || value === '') return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function isoDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function num(value) {
  if (value == null || value === '') return '';
  const n = Number(value);
  return Number.isFinite(n) ? n : '';
}

export function rowFromPortfolioEntry(entry, { pageBase = PORTFOLIO_PAGE_URL } = {}) {
  const startupId = entry.startup_id || '';
  const irr = entry.irr_annualized == null ? '' : Math.round(Number(entry.irr_annualized) * 1000) / 10;
  return {
    name: entry.startup_name || '',
    website: entry.website || '',
    pythh_url: startupId ? `${pageBase}/${startupId}` : pageBase,
    description: (entry.brief_description || entry.tagline || '').replace(/\s+/g, ' ').trim(),
    primary_sector: entry.primary_sector || '',
    current_stage: entry.current_stage || entry.entry_stage || '',
    status: entry.status || '',
    health_tier: entry.health_tier || '',
    entry_date: isoDate(entry.entry_date),
    entry_god_score: num(entry.entry_god_score),
    current_god_score: num(entry.current_god_score),
    god_delta: num(entry.god_delta),
    moic: num(entry.moic),
    irr_pct: irr,
    entry_valuation_usd: num(entry.entry_valuation_usd),
    current_valuation_usd: num(entry.current_valuation_usd),
    latest_round_type: entry.latest_round_type || '',
    latest_round_post_money_usd: num(entry.latest_round_post_money),
    latest_lead_investor: entry.latest_lead_investor || '',
    total_rounds_tracked: num(entry.total_rounds_tracked),
    signal_score: num(entry.signal_score),
    sector_god_percentile: num(entry.sector_god_percentile),
    days_since_last_event: num(entry.days_since_last_event),
    verified_funding_last_90d: num(entry.verified_funding_last_90d),
    exit_acquirer: entry.exit_acquirer || '',
    exit_type: entry.exit_type || '',
    exit_date: isoDate(entry.exit_date),
    holding_days: num(entry.holding_days),
    entered_late: entry.entered_late === true ? 'yes' : entry.entered_late === false ? 'no' : '',
    virtual_check_usd: num(entry.virtual_check_usd),
  };
}

export function portfolioEntriesToCsv(entries) {
  const lines = [PYTHIAM_PORTFOLIO_CSV_COLUMNS.join(',')];
  for (const entry of entries) {
    const row = rowFromPortfolioEntry(entry);
    lines.push(PYTHIAM_PORTFOLIO_CSV_COLUMNS.map((col) => escapeCsvValue(row[col])).join(','));
  }
  return `${lines.join('\n')}\n`;
}
