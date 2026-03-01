/**
 * Virtual Portfolio Service
 * YC-style virtual investment tracking for Pythh-picked startups.
 *
 * - Auto-adds approved startups with GOD score ≥70 as portfolio entries
 * - Tracks funding events, acquisitions, and IPOs
 * - Computes MOIC and annualised IRR on each update
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
);

// ---------------------------------------------------------------------------
// VALUATION ESTIMATION
// ---------------------------------------------------------------------------
// Because very few startups have a real valuation in the DB we estimate
// entry valuation from the funding stage + GOD score premium.
//
//  Stage 1 (pre-seed)  → $3M base
//  Stage 2 (seed)      → $8M base
//  Stage 3 (Series A)  → $20M base
//  Stage 4+ (Series B+)→ $60M base
//  GOD premium         → base × (score / 70)  (score 70 = 1×, 100 = 1.43×)
// ---------------------------------------------------------------------------

function estimateEntryValuationUsd(stage: string | null, godScore: number): number {
  // 2025 market benchmarks (YC standard: pre-seed ~$20M post, seed ~$30-50M, etc.)
  const bases: Record<string, number> = {
    'Stage 1': 15_000_000,
    'Stage 2': 35_000_000,
    'Stage 3': 80_000_000,
    'Stage 4': 250_000_000,
    '1': 15_000_000,
    '2': 35_000_000,
    '3': 80_000_000,
    '4': 250_000_000,
    'Pre-Seed': 15_000_000,
    'Seed': 35_000_000,
    'Series A': 80_000_000,
    'Series B': 250_000_000,
    'Series B+': 250_000_000,
    'Series C': 600_000_000,
  };

  const stageKey = stage ? String(stage).trim() : 'Pre-Seed';
  const base = bases[stageKey] ?? bases['Pre-Seed']; // null stage → $15M pre-seed floor
  const premium = Math.max(0.8, (godScore || 70) / 70);
  return Math.round(base * premium);
}

// ---------------------------------------------------------------------------
// MOIC + IRR
// ---------------------------------------------------------------------------

export function calculateMoic(entryValuation: number, currentValuation: number): number | null {
  if (!entryValuation || !currentValuation) return null;
  return Math.round((currentValuation / entryValuation) * 100) / 100;
}

// Annualised IRR: (currentVal / entryVal)^(365/days) − 1
export function calculateIrr(
  entryValuation: number,
  currentValuation: number,
  holdingDays: number
): number | null {
  if (!entryValuation || !currentValuation || holdingDays < 1) return null;
  const moic = currentValuation / entryValuation;
  const years = holdingDays / 365;
  return Math.round((Math.pow(moic, 1 / years) - 1) * 10000) / 10000; // 4 dp
}

// ---------------------------------------------------------------------------
// ADD / UPSERT TO PORTFOLIO
// ---------------------------------------------------------------------------

export interface AddToPortfolioOptions {
  entryDate?: Date;
  entryRationale?: string;
  virtualCheckUsd?: number;
  addedBy?: string;
  notes?: string;
}

export async function addToPortfolio(startupId: string, options: AddToPortfolioOptions = {}) {
  // Fetch startup info
  const { data: su, error: suErr } = await supabase
    .from('startup_uploads')
    .select('id, name, stage, total_god_score, valuation_usd, created_at')
    .eq('id', startupId)
    .single();

  if (suErr || !su) throw new Error(`Startup not found: ${startupId} — ${suErr?.message}`);

  const godScore: number = su.total_god_score ?? 0;
  const entryValuation =
    (su.valuation_usd as number | null) ||
    estimateEntryValuationUsd(su.stage as string | null, godScore);

  const entryDate = options.entryDate ?? (su.created_at ? new Date(su.created_at) : new Date());

  const row = {
    startup_id: startupId,
    entry_date: entryDate.toISOString(),
    entry_stage: su.stage ?? null,
    entry_god_score: godScore,
    entry_valuation_usd: entryValuation,
    entry_rationale: options.entryRationale ?? null,
    virtual_check_usd: options.virtualCheckUsd ?? 100_000,
    current_valuation_usd: entryValuation, // starts at parity
    moic: 1.0,
    added_by: options.addedBy ?? 'auto',
    notes: options.notes ?? null,
  };

  const { data, error } = await supabase
    .from('virtual_portfolio')
    .upsert(row, { onConflict: 'startup_id', ignoreDuplicates: false })
    .select()
    .single();

  if (error) throw new Error(`Failed to add to portfolio: ${error.message}`);
  return data;
}

// ---------------------------------------------------------------------------
// LOG A PORTFOLIO EVENT
// ---------------------------------------------------------------------------

export interface PortfolioEventInput {
  eventType: string;
  eventDate?: Date;
  amountUsd?: number;
  preMoney?: number;
  postMoney?: number;
  roundType?: string;
  leadInvestor?: string;
  investorsList?: string[];
  headline?: string;
  sourceUrl?: string;
  sourceName?: string;
  verified?: boolean;
  godScoreBefore?: number;
  godScoreAfter?: number;
}

export async function logPortfolioEvent(startupId: string, event: PortfolioEventInput) {
  // Find the active portfolio entry for this startup
  const { data: vp } = await supabase
    .from('virtual_portfolio')
    .select('id')
    .eq('startup_id', startupId)
    .eq('status', 'active')
    .maybeSingle();

  const row = {
    startup_id: startupId,
    portfolio_id: vp?.id ?? null,
    event_type: event.eventType,
    event_date: (event.eventDate ?? new Date()).toISOString(),
    amount_usd: event.amountUsd ?? null,
    pre_money_usd: event.preMoney ?? null,
    post_money_usd: event.postMoney ?? null,
    round_type: event.roundType ?? null,
    lead_investor: event.leadInvestor ?? null,
    investors_list: event.investorsList ?? null,
    headline: event.headline ?? null,
    source_url: event.sourceUrl ?? null,
    source_name: event.sourceName ?? null,
    verified: event.verified ?? false,
    god_score_before: event.godScoreBefore ?? null,
    god_score_after: event.godScoreAfter ?? null,
  };

  const { data, error } = await supabase.from('portfolio_events').insert(row).select().single();
  if (error) throw new Error(`Failed to log event: ${error.message}`);

  // If it's a funding round, update current valuation on the portfolio entry
  if (event.postMoney && vp?.id) {
    await updateCurrentValuation(vp.id, event.postMoney);
  }

  return data;
}

// ---------------------------------------------------------------------------
// UPDATE CURRENT VALUATION + MOIC/IRR
// ---------------------------------------------------------------------------

export async function updateCurrentValuation(portfolioId: string, currentValuationUsd: number) {
  const { data: vp, error: vpErr } = await supabase
    .from('virtual_portfolio')
    .select('entry_valuation_usd, entry_date')
    .eq('id', portfolioId)
    .single();

  if (vpErr || !vp) return;

  const holdingDays = Math.max(
    1,
    Math.round((Date.now() - new Date(vp.entry_date).getTime()) / 86_400_000)
  );
  const moic = calculateMoic(vp.entry_valuation_usd, currentValuationUsd);
  const irr = calculateIrr(vp.entry_valuation_usd, currentValuationUsd, holdingDays);

  await supabase
    .from('virtual_portfolio')
    .update({ current_valuation_usd: currentValuationUsd, moic, irr_annualized: irr, holding_days: holdingDays })
    .eq('id', portfolioId);
}

// ---------------------------------------------------------------------------
// MARK EXIT
// ---------------------------------------------------------------------------

export interface ExitInput {
  exitType: 'acquisition' | 'ipo' | 'secondary' | 'unknown';
  exitValuationUsd?: number;
  acquirer?: string;
  exitSourceUrl?: string;
  exitDate?: Date;
}

export async function markExit(startupId: string, exit: ExitInput) {
  const { data: vp, error: vpErr } = await supabase
    .from('virtual_portfolio')
    .select('id, entry_valuation_usd, entry_date')
    .eq('startup_id', startupId)
    .eq('status', 'active')
    .single();

  if (vpErr || !vp) throw new Error(`No active portfolio entry found for startup ${startupId}`);

  const exitDate = exit.exitDate ?? new Date();
  const holdingDays = Math.max(
    1,
    Math.round((exitDate.getTime() - new Date(vp.entry_date).getTime()) / 86_400_000)
  );

  const moic = exit.exitValuationUsd
    ? calculateMoic(vp.entry_valuation_usd, exit.exitValuationUsd)
    : null;
  const irr = exit.exitValuationUsd
    ? calculateIrr(vp.entry_valuation_usd, exit.exitValuationUsd, holdingDays)
    : null;

  const statusMap: Record<string, string> = {
    acquisition: 'acquired',
    ipo: 'ipo',
    secondary: 'exited',
    unknown: 'exited',
  };

  const { data, error } = await supabase
    .from('virtual_portfolio')
    .update({
      status: statusMap[exit.exitType] ?? 'exited',
      exit_date: exitDate.toISOString(),
      exit_type: exit.exitType,
      exit_valuation_usd: exit.exitValuationUsd ?? null,
      exit_acquirer: exit.acquirer ?? null,
      exit_source_url: exit.exitSourceUrl ?? null,
      current_valuation_usd: exit.exitValuationUsd ?? null,
      moic,
      irr_annualized: irr,
      holding_days: holdingDays,
    })
    .eq('id', vp.id)
    .select()
    .single();

  if (error) throw new Error(`Failed to mark exit: ${error.message}`);
  return data;
}

// ---------------------------------------------------------------------------
// BULK SEED — add all approved startups with GOD ≥ threshold
// ---------------------------------------------------------------------------

export async function seedPortfolio(godThreshold = 70) {
  // Fetch all approved startups above the threshold
  const { data: startups, error } = await supabase
    .from('startup_uploads')
    .select('id, name, stage, total_god_score, valuation_usd, created_at')
    .eq('status', 'approved')
    .gte('total_god_score', godThreshold)
    .order('total_god_score', { ascending: false });

  if (error) throw new Error(`Failed to fetch startups for seeding: ${error.message}`);
  if (!startups?.length) return { added: 0, skipped: 0, errors: [] };

  // Get existing portfolio startup IDs to skip duplicates
  const { data: existing } = await supabase
    .from('virtual_portfolio')
    .select('startup_id')
    .eq('status', 'active');

  const existingIds = new Set((existing ?? []).map((e: any) => e.startup_id));

  let added = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const su of startups) {
    if (existingIds.has(su.id)) {
      skipped++;
      continue;
    }

    try {
      const godScore: number = (su.total_god_score as number) ?? 70;
      const entryValuation =
        (su.valuation_usd as number | null) ||
        estimateEntryValuationUsd(su.stage as string | null, godScore);

      await supabase.from('virtual_portfolio').insert({
        startup_id: su.id,
        entry_date: su.created_at ?? new Date().toISOString(),
        entry_stage: su.stage ?? null,
        entry_god_score: godScore,
        entry_valuation_usd: entryValuation,
        entry_rationale: `Auto-added: GOD score ${godScore} ≥ ${godThreshold} threshold`,
        virtual_check_usd: 100_000,
        current_valuation_usd: entryValuation,
        moic: 1.0,
        added_by: 'auto-seed',
      });
      added++;
    } catch (err: any) {
      errors.push(`${su.name}: ${err.message}`);
    }
  }

  return { added, skipped, errors };
}
