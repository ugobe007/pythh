/**
 * Startup Search Service
 * ======================
 * Queries startup_uploads with text search, sector, stage, and score filters.
 * Always scoped to status='approved' with non-null GOD scores.
 */

import { supabase } from '../lib/supabase';

export interface StartupSearchFilters {
  query?: string;
  sectors?: string[];
  stage?: string;
  sortBy?: 'total_god_score' | 'final_score' | 'created_at' | 'name';
  limit?: number;
}

export interface StartupSearchResult {
  id: string;
  name: string;
  tagline: string | null;
  description: string | null;
  sectors: string[] | null;
  stage: number | null;
  location: string | null;
  total_god_score: number | null;
  team_score: number | null;
  traction_score: number | null;
  market_score: number | null;
  product_score: number | null;
  vision_score: number | null;
  final_score: number | null;
  website: string | null;
  raise_type: string | null;
  created_at: string | null;
  enhanced_god_score?: number | null;
  psychological_multiplier?: number | null;
  is_oversubscribed?: boolean | null;
  has_followon?: boolean | null;
  is_competitive?: boolean | null;
  is_bridge_round?: boolean | null;
  has_sector_pivot?: boolean | null;
  has_social_proof_cascade?: boolean | null;
  is_repeat_founder?: boolean | null;
  has_cofounder_exit?: boolean | null;
}

// Map display stage labels to numeric values in DB
const STAGE_MAP: Record<string, number> = {
  'Pre-Seed': 0,
  'Seed': 1,
  'Series A': 2,
  'Series B': 3,
  'Series C+': 4,
};

export async function searchStartups(filters: StartupSearchFilters): Promise<{
  data: StartupSearchResult[] | null;
  count: number;
  error: any;
}> {
  const {
    query = '',
    sectors = [],
    stage = '',
    sortBy = 'total_god_score',
    limit = 50,
  } = filters;

  let qb = supabase
    .from('startup_uploads')
    .select(
      'id, name, tagline, description, sectors, stage, location, total_god_score, team_score, traction_score, market_score, product_score, vision_score, final_score, website, raise_type, created_at, enhanced_god_score, psychological_multiplier, is_oversubscribed, has_followon, is_competitive, is_bridge_round, has_sector_pivot, has_social_proof_cascade, is_repeat_founder, has_cofounder_exit',
      { count: 'exact' }
    )
    .eq('status', 'approved')
    .not('total_god_score', 'is', null);

  // Text search across name, tagline, description
  if (query.trim()) {
    const q = query.trim();
    qb = qb.or(`name.ilike.%${q}%,tagline.ilike.%${q}%,description.ilike.%${q}%`);
  }

  // Sector filter — overlaps for array column
  if (sectors.length > 0) {
    qb = qb.overlaps('sectors', sectors);
  }

  // Stage filter
  if (stage && STAGE_MAP[stage] !== undefined) {
    qb = qb.eq('stage', STAGE_MAP[stage]);
  }

  // Sort
  const ascending = sortBy === 'name';
  qb = qb.order(sortBy, { ascending });

  // Limit
  qb = qb.limit(limit);

  const { data, count, error } = await qb;

  if (error) {
    console.error('[startupSearchService] Search error:', error);
    return { data: null, count: 0, error };
  }

  return { data: data as StartupSearchResult[], count: count || 0, error: null };
}

// Reverse map: numeric stage → display label
export function stageLabel(stageNum: number | null): string {
  if (stageNum === null || stageNum === undefined) return '—';
  const entry = Object.entries(STAGE_MAP).find(([, v]) => v === stageNum);
  return entry ? entry[0] : '—';
}
