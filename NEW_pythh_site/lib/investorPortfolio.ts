/**
 * Investor virtual portfolio API (max 10 picks — agents/INVESTOR_CANON.md).
 */

import { apiUrl } from '@/lib/apiConfig';
import { investorSessionHeaders } from '@/lib/investorSession';
import { trackFunnelEvent } from '@/lib/matchEngagement';

export const INVESTOR_PORTFOLIO_MAX_PICKS = 10;

export type PortfolioActivity = { type: string; date: string; description: string };

export type PortfolioItem = {
  startup_id: string;
  added_at: string;
  notes: string | null;
  name: string;
  tagline: string | null;
  website: string | null;
  sectors: string[];
  stage_estimate: string | null;
  total_god_score: number | null;
  entry_god_score?: number | null;
  updated_at: string | null;
  recent_activity: PortfolioActivity[];
};

export type PortfolioPayload = {
  list: { id: string; name: string; created_at?: string; updated_at?: string };
  items: PortfolioItem[];
  count: number;
  picks_used: number;
  picks_max: number;
  picks_remaining: number;
};

export async function fetchInvestorPortfolio(): Promise<PortfolioPayload | null> {
  try {
    const res = await fetch(apiUrl('/api/investor-lookup/portfolio'), {
      headers: investorSessionHeaders(),
      credentials: 'same-origin',
    });
    const json = await res.json();
    if (!res.ok || !json.ok) return null;
    return json.data as PortfolioPayload;
  } catch {
    return null;
  }
}

export async function addPortfolioPick(startupId: string): Promise<{
  ok: boolean;
  error?: string;
  picks_used?: number;
  picks_max?: number;
  picks_remaining?: number;
}> {
  try {
    const res = await fetch(apiUrl('/api/investor-lookup/portfolio/items'), {
      method: 'POST',
      headers: investorSessionHeaders(),
      credentials: 'same-origin',
      body: JSON.stringify({ startup_id: startupId }),
    });
    const json = await res.json();
    if (res.ok && json.ok) {
      void trackFunnelEvent('investor_portfolio_pick_added', {
        startup_id: startupId,
        picks_used: json.picks_used,
        picks_max: json.picks_max,
        source: 'production_ui',
      });
      return {
        ok: true,
        picks_used: json.picks_used,
        picks_max: json.picks_max,
        picks_remaining: json.picks_remaining,
      };
    }
    if (res.status === 403) {
      void trackFunnelEvent('investor_portfolio_cap_reached', {
        startup_id: startupId,
        picks_used: json.picks_used,
        source: 'production_ui',
      });
    }
    return { ok: false, error: json.error || 'Could not add pick' };
  } catch {
    return { ok: false, error: 'Network error' };
  }
}

export async function removePortfolioPick(startupId: string): Promise<boolean> {
  try {
    const res = await fetch(apiUrl(`/api/investor-lookup/portfolio/items/${startupId}`), {
      method: 'DELETE',
      headers: investorSessionHeaders(),
      credentials: 'same-origin',
    });
    const json = await res.json();
    return res.ok && json.ok;
  } catch {
    return false;
  }
}

/** Trigger CSV download of the current virtual portfolio. */
export async function exportPortfolioCsv(): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(apiUrl('/api/investor-lookup/portfolio/export.csv'), {
      headers: investorSessionHeaders(),
      credentials: 'same-origin',
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      return { ok: false, error: json.error || 'Export failed' };
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'pythh-portfolio.csv';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    void trackFunnelEvent('investor_portfolio_exported', { source: 'production_ui' });
    return { ok: true };
  } catch {
    return { ok: false, error: 'Network error' };
  }
}
