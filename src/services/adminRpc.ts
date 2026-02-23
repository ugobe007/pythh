// src/services/adminRpc.ts
import { API_BASE } from '../lib/apiConfig';

export type ImportDiscoveredResult = {
  ok: boolean;
  discovered_id: string;
  startup_id?: string;
  error?: string;
};

export const adminRpc = {
  async getDashboardKpis() {
    const res = await fetch(`${API_BASE}/api/admin/kpis`);
    if (!res.ok) throw new Error(`admin/kpis failed: ${res.status}`);
    return res.json() as Promise<{
      startups_approved: number;
      startups_pending: number;
      investors_total: number;
      matches_total: number;
      avg_god_score: number;
    }>;
  },

  async listDiscoveredStartups(opts: {
    filter: 'all' | 'imported' | 'unimported';
    page: number;
    pageSize: number;
  }) {
    const params = new URLSearchParams({
      filter: opts.filter,
      page: String(opts.page),
      pageSize: String(opts.pageSize),
    });
    const res = await fetch(`${API_BASE}/api/admin/discovered?${params}`);
    if (!res.ok) throw new Error(`admin/discovered failed: ${res.status}`);
    return res.json() as Promise<{ rows: any[]; count: number }>;
  },

  async importDiscoveredStartups(discoveredIds: string[]) {
    // Server-side enrichment + insert
    const res = await fetch('/api/admin/import-discovered', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ discovered_ids: discoveredIds }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`import-discovered failed: ${res.status} ${text}`);
    }
    const json = await res.json();
    return json.results as ImportDiscoveredResult[];
  },

  async listStartups(opts: {
    status?: 'all' | 'pending' | 'approved' | 'rejected';
    q: string;
    page: number;
    pageSize: number;
  }) {
    const params = new URLSearchParams({
      page: String(opts.page),
      pageSize: String(opts.pageSize),
      q: opts.q || '',
    });
    if (opts.status && opts.status !== 'all') params.set('status', opts.status);
    const res = await fetch(`${API_BASE}/api/admin/startups?${params}`);
    if (!res.ok) throw new Error(`admin/startups failed: ${res.status}`);
    return res.json() as Promise<{ rows: any[]; count: number }>;
  },

  async setStartupStatus(startupIds: string[], status: 'approved' | 'rejected' | 'pending') {
    const res = await fetch(`${API_BASE}/api/admin/startups/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startup_ids: startupIds, status }),
    });
    if (!res.ok) throw new Error(`admin/startups/status failed: ${res.status}`);
    return res.json() as Promise<{ updated: number }>;
  },

  /** Fetch full startup details for review */
  async getStartupDetail(startupId: string) {
    const res = await fetch(`${API_BASE}/api/admin/startups/${startupId}`);
    if (!res.ok) throw new Error(`admin/startups/${startupId} failed: ${res.status}`);
    return res.json();
  },

  /** Update individual GOD score override */
  async updateGodScore(startupId: string, scores: {
    total_god_score?: number;
    team_score?: number;
    traction_score?: number;
    market_score?: number;
    product_score?: number;
    vision_score?: number;
    ecosystem_score?: number;
    grit_score?: number;
    problem_validation_score?: number;
  }) {
    const res = await fetch(`${API_BASE}/api/admin/startups/${startupId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scores),
    });
    if (!res.ok) throw new Error(`admin/startups PATCH failed: ${res.status}`);
    return res.json();
  },

  /** Update startup fields (name, tagline, sectors, etc.) */
  async updateStartup(startupId: string, fields: Record<string, any>) {
    const res = await fetch(`${API_BASE}/api/admin/startups/${startupId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
    if (!res.ok) throw new Error(`admin/startups PATCH failed: ${res.status}`);
    return res.json();
  },

  /** Delete a startup */
  async deleteStartup(startupId: string) {
    const res = await fetch(`${API_BASE}/api/admin/startups/${startupId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`admin/startups DELETE failed: ${res.status}`);
  },
};
