// src/services/adminRpc.ts
import { supabase } from '../lib/supabase';

export type ImportDiscoveredResult = {
  ok: boolean;
  discovered_id: string;
  startup_id?: string;
  error?: string;
};

export const adminRpc = {
  async getDashboardKpis() {
    const { data, error } = await supabase.rpc('admin_get_dashboard_kpis');
    if (error) throw error;
    // RPC returns array, extract first element
    const kpis = Array.isArray(data) ? data[0] : data;
    return kpis as {
      startups_approved: number;
      startups_pending: number;
      investors_total: number;
      matches_total: number;
      avg_god_score: number;
    };
  },

  async listDiscoveredStartups(opts: {
    filter: 'all' | 'imported' | 'unimported';
    page: number;
    pageSize: number;
  }) {
    const from = opts.page * opts.pageSize;
    const to = from + opts.pageSize - 1;

    let q = supabase
      .from('discovered_startups')
      .select(
        'id,name,website,description,funding_amount,funding_stage,article_url,rss_source,imported_to_startups,discovered_at',
        { count: 'exact' }
      )
      .order('discovered_at', { ascending: false })
      .range(from, to);

    if (opts.filter === 'unimported') q = q.eq('imported_to_startups', false);
    if (opts.filter === 'imported') q = q.eq('imported_to_startups', true);

    const { data, error, count } = await q;
    if (error) throw error;

    return { rows: (data ?? []) as any[], count: count ?? 0 };
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
    const from = opts.page * opts.pageSize;
    const to = from + opts.pageSize - 1;

    let query = supabase
      .from('startup_uploads')
      .select('id,name,tagline,description,status,total_god_score,team_score,traction_score,market_score,product_score,vision_score,source_type,website,sectors,created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (opts.status && opts.status !== 'all') query = query.eq('status', opts.status);
    if (opts.q.trim()) query = query.ilike('name', `%${opts.q.trim()}%`);

    const { data, error, count } = await query;
    if (error) throw error;
    return { rows: (data ?? []) as any[], count: count ?? 0 };
  },

  async setStartupStatus(startupIds: string[], status: 'approved' | 'rejected' | 'pending') {
    const { data, error } = await supabase.rpc('admin_set_startup_status', {
      p_startup_ids: startupIds,
      p_status: status,
    });
    if (error) throw error;
    return data as { updated: number };
  },

  /** Fetch full startup details for review */
  async getStartupDetail(startupId: string) {
    const { data, error } = await supabase
      .from('startup_uploads')
      .select('*')
      .eq('id', startupId)
      .single();
    if (error) throw error;
    return data;
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
    const { data, error } = await supabase
      .from('startup_uploads')
      .update(scores)
      .eq('id', startupId)
      .select('id, name, total_god_score')
      .single();
    if (error) throw error;
    return data;
  },

  /** Update startup fields (name, tagline, sectors, etc.) */
  async updateStartup(startupId: string, fields: Record<string, any>) {
    const { data, error } = await supabase
      .from('startup_uploads')
      .update(fields)
      .eq('id', startupId)
      .select('id, name')
      .single();
    if (error) throw error;
    return data;
  },

  /** Delete a startup */
  async deleteStartup(startupId: string) {
    const { error } = await supabase
      .from('startup_uploads')
      .delete()
      .eq('id', startupId);
    if (error) throw error;
  },
};
