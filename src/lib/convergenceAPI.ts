/**
 * CONVERGENCE API CLIENT
 * ======================
 * Fetches /api/discovery/convergence endpoint with fallbacks
 */

import { supabase } from './supabase';
import type { ConvergenceResponse, EmptyConvergenceResponse } from '../types/convergence';

export async function fetchConvergenceData(
  startupUrl: string,
  options: { demo?: boolean; debug?: boolean } = {}
): Promise<ConvergenceResponse | EmptyConvergenceResponse> {
  const startTime = Date.now();
  
  try {
    // Demo mode: return fixed payload
    if (options.demo) {
      return getDemoPayload();
    }

    // Call real backend endpoint
    const apiUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:3002'}/api/discovery/convergence?url=${encodeURIComponent(startupUrl)}`;
    
    if (options.debug) {
      console.log('[Convergence API] Calling:', apiUrl);
    }
    
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      console.error('[Convergence API] HTTP error:', response.status);
      
      // If startup not found, return empty payload
      if (response.status === 404 || response.status === 400) {
        return getEmptyPayload(startupUrl);
      }
      
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (options.debug) {
      console.log('[Convergence API] Response:', data);
      console.log('[Convergence API] Query time:', Date.now() - startTime, 'ms');
    }
    
    return data;
  } catch (error) {
    console.error('[Convergence API] Error:', error);
    
    // Return empty-but-valid payload instead of throwing
    return getEmptyPayload(startupUrl);
  }
}

async function buildConvergenceFromDB(startupUrl: string): Promise<ConvergenceResponse | EmptyConvergenceResponse> {
  // Import resolver to avoid circular dependency
  const { resolveStartupFromUrl } = await import('./startupResolver');
  
  const result = await resolveStartupFromUrl(startupUrl);
  
  if (!result || !result.startup) {
    return getEmptyPayload(startupUrl);
  }

  const startup = result.startup;
  const startupId = startup.id;

  // Fetch full startup data
  const { data: fullStartup } = await supabase
    .from('startup_uploads')
    .select('*')
    .eq('id', startupId)
    .single();

  if (!fullStartup) {
    return getEmptyPayload(startupUrl);
  }

  // Fetch all matches
  const { data: matches } = await supabase
    .from('startup_investor_matches')
    .select(`
      match_score,
      investor:investors!inner(
        id, name, firm, sectors, stage, 
        check_size_min, check_size_max, geography
      )
    `)
    .eq('startup_id', startupId)
    .gte('match_score', 50)
    .order('match_score', { ascending: false })
    .limit(100);

  // Build convergence response
  const convergence: ConvergenceResponse = {
    startup: {
      id: fullStartup.id,
      url: startupUrl,
      name: fullStartup.name,
      stage_hint: mapStage(fullStartup.stage),
      sector_hint: fullStartup.sectors || [],
      created_at: fullStartup.created_at
    },
    status: buildStatusMetrics(fullStartup),
    visible_investors: buildVisibleInvestors(matches || [], fullStartup),
    hidden_investors_preview: buildHiddenPreview(matches || []),
    hidden_investors_total: Math.max(0, (matches?.length || 0) - 5),
    comparable_startups: buildComparableStartups(fullStartup),
    alignment: buildAlignmentBreakdown(fullStartup),
    improve_actions: buildImproveActions(fullStartup),
    debug: {
      query_time_ms: 0, // Set by caller
      data_sources: ['startup_uploads', 'startup_investor_matches'],
      match_version: 'v1.3.1'
    }
  };

  return convergence;
}

function buildStatusMetrics(startup: any): any {
  const godScore = startup.total_god_score || 45;
  
  return {
    velocity_class: godScore >= 70 ? 'fast_feedback' : godScore >= 60 ? 'building' : 'early',
    signal_strength_0_10: Math.min(10, godScore / 10),
    fomo_state: godScore >= 75 ? 'surge' : godScore >= 65 ? 'warming' : 'watch',
    observers_7d: Math.floor(Math.random() * 30) + 10, // TODO: Real observer tracking
    comparable_tier: godScore >= 80 ? 'top_5' : godScore >= 70 ? 'top_12' : godScore >= 60 ? 'top_25' : 'unranked',
    phase_change_score_0_1: (godScore / 100) * 0.9, // Approximate
    confidence: godScore >= 70 ? 'high' : godScore >= 60 ? 'med' : 'low',
    updated_at: new Date().toISOString()
  };
}

function buildVisibleInvestors(matches: any[], startup: any): any[] {
  if (!matches.length) return [];
  
  // Use smart selection (will implement in separate file)
  const { selectStrategicInvestors } = require('./investorSelection');
  return selectStrategicInvestors(matches, startup);
}

function buildHiddenPreview(matches: any[]): any[] {
  // Take matches 6-15 and blur them
  return matches.slice(5, 15).map((m, i) => ({
    blurred_id: `blurred_${i}`,
    stage: mapStage(m.investor?.stage) || 'seed',
    sector: m.investor?.sectors?.[0] || 'Tech',
    signal_state: getSignalState(m.match_score)
  }));
}

function buildComparableStartups(startup: any): any[] {
  // TODO: Real similarity algorithm
  return [
    {
      startup_id: 'demo1',
      name: 'NeuronStack',
      stage: 'Seed',
      sector: 'AI Infra',
      god_score_0_10: 8.4,
      fomo_state: 'surge',
      matched_investors: 14,
      reason_tags: ['similar_team', 'comparable_velocity']
    },
    {
      startup_id: 'demo2',
      name: 'DataFlow',
      stage: 'Seed',
      sector: 'B2B SaaS',
      god_score_0_10: 7.8,
      fomo_state: 'warming',
      matched_investors: 11,
      reason_tags: ['market_velocity', 'portfolio_adjacency']
    },
    {
      startup_id: 'demo3',
      name: 'CloudSync',
      stage: 'Pre-seed',
      sector: 'Developer Tools',
      god_score_0_10: 7.1,
      fomo_state: 'watch',
      matched_investors: 8,
      reason_tags: ['adjacent_portfolio']
    }
  ];
}

function buildAlignmentBreakdown(startup: any): any {
  return {
    team_0_1: 0.82,
    market_0_1: 0.74,
    execution_0_1: 0.80,
    portfolio_0_1: 0.68,
    phase_change_0_1: 0.88,
    message: 'Investors historically engage when Phase Change Correlation exceeds 0.75'
  };
}

function buildImproveActions(startup: any): any[] {
  return [
    {
      title: 'Increase Technical Signal Density',
      impact_pct: 12,
      steps: [
        'Publish product benchmarks',
        'Ship public API / SDK',
        'Release technical blog'
      ],
      category: 'technical'
    },
    {
      title: 'Strengthen Traction Visibility',
      impact_pct: 9,
      steps: [
        'Publish customer proof',
        'Improve website change frequency',
        'Increase release cadence'
      ],
      category: 'traction'
    },
    {
      title: 'Accelerate Phase Change Probability',
      impact_pct: 15,
      steps: [
        'Announce key hire',
        'Ship v2 feature',
        'Show revenue signal'
      ],
      category: 'phase_change'
    }
  ];
}

function mapStage(stage?: string): any {
  if (!stage) return undefined;
  const lower = stage.toLowerCase();
  if (lower.includes('pre')) return 'preseed';
  if (lower.includes('seed') && !lower.includes('series')) return 'seed';
  if (lower.includes('series a') || lower.includes('a')) return 'series_a';
  return 'series_b_plus';
}

function getSignalState(score: number): any {
  if (score >= 80) return 'breakout';
  if (score >= 70) return 'surge';
  if (score >= 60) return 'warming';
  return 'watch';
}

function getEmptyPayload(startupUrl: string): EmptyConvergenceResponse {
  return {
    startup: {
      id: 'unknown',
      url: startupUrl,
      created_at: new Date().toISOString()
    },
    status: {
      velocity_class: 'early',
      signal_strength_0_10: 5.0,
      fomo_state: 'watch',
      observers_7d: 0,
      comparable_tier: 'unranked',
      phase_change_score_0_1: 0.5,
      confidence: 'low',
      updated_at: new Date().toISOString()
    },
    visible_investors: [],
    hidden_investors_preview: [],
    hidden_investors_total: 0
  };
}

function getDemoPayload(): ConvergenceResponse {
  return {
    startup: {
      id: 'demo',
      url: 'https://example.com',
      name: 'Demo Startup',
      stage_hint: 'seed',
      sector_hint: ['AI', 'Developer Tools'],
      created_at: new Date().toISOString()
    },
    status: {
      velocity_class: 'fast_feedback',
      signal_strength_0_10: 7.6,
      fomo_state: 'warming',
      observers_7d: 23,
      comparable_tier: 'top_12',
      phase_change_score_0_1: 0.76,
      confidence: 'high',
      updated_at: new Date().toISOString()
    },
    visible_investors: [],
    hidden_investors_preview: [],
    hidden_investors_total: 50,
    comparable_startups: [],
    alignment: {
      team_0_1: 0.82,
      market_0_1: 0.74,
      execution_0_1: 0.80,
      portfolio_0_1: 0.68,
      phase_change_0_1: 0.88,
      message: 'Investors historically engage when Phase Change Correlation exceeds 0.75'
    },
    improve_actions: [],
    debug: {
      query_time_ms: 42,
      data_sources: ['demo'],
      match_version: 'demo'
    }
  };
}
