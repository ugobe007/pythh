/**
 * Build a StartupContext-shaped object from /api/preview JSON so the UI can render
 * GOD, Signal, description, and sectors when get_startup_context RPC fails or is slow.
 */

import type { StartupContext } from '@/lib/pythh-types';
import type { ReportData } from '@/components/pythh/InvestorReadinessReport';

/** Sentinels for unknown industry stats (preview does not compute them). */
const UNKNOWN_INDUSTRY = -1;

function normalizeStage(raw: unknown): number | null {
  if (typeof raw === 'number' && !Number.isNaN(raw)) return raw;
  if (typeof raw === 'string') {
    const n = parseInt(raw, 10);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

export function buildStartupContextFromPreview(report: ReportData): StartupContext {
  const s = report.startup;
  const sc = s.score_components;
  const sig = s.signal_components;

  const sectors = s.sectors ?? [];
  const stage = normalizeStage(s.stage);

  const signalTotal = s.signal_score ?? 0;
  const signals = {
    total: signalTotal,
    founder_language_shift: sig?.founder_language_shift ?? 0,
    investor_receptivity: sig?.investor_receptivity ?? 0,
    news_momentum: sig?.news_momentum ?? 0,
    capital_convergence: sig?.capital_convergence ?? 0,
    execution_velocity: sig?.execution_velocity ?? 0,
  };

  return {
    startup: {
      id: s.id,
      name: s.name,
      website: s.website ?? '',
      tagline: s.tagline ?? null,
      description: s.description ?? null,
      stage,
      sectors,
      extracted_data: (s.extracted_data as StartupContext['startup']['extracted_data']) ?? null,
    },
    god: {
      total: s.god_score ?? 50,
      team: sc?.team ?? 0,
      traction: sc?.traction ?? 0,
      market: sc?.market ?? 0,
      product: sc?.product ?? 0,
      vision: sc?.vision ?? 0,
    },
    signals,
    comparison: {
      industry_avg: UNKNOWN_INDUSTRY,
      top_quartile: UNKNOWN_INDUSTRY,
      percentile: s.percentile ?? 50,
      sectors,
    },
    entitlements: null,
  };
}
