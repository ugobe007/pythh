// @ts-nocheck
/**
 * QUALITY DRIFT TRACKER
 * ============================================================================
 * Background job to track quality drift over time
 * Runs weekly to capture inbound quality trends
 * ============================================================================
 */

import { supabase } from '../lib/supabase';

// =============================================================================
// UPDATE QUALITY DRIFT FOR AN INVESTOR
// =============================================================================

export async function updateQualityDrift(investorId: string): Promise<void> {
  // Get current discovery flow state counts
  const { data: flowData } = await supabase
    .from('investor_discovery_flow')
    .select('alignment_state')
    .eq('investor_id', investorId);

  if (!flowData || flowData.length === 0) return;

  const total = flowData.length;
  const strongCount = flowData.filter(f => f.alignment_state === 'strong').length;
  const activeCount = flowData.filter(f => f.alignment_state === 'active').length;
  const formingCount = flowData.filter(f => f.alignment_state === 'forming').length;

  // Calculate quality score (weighted: strong=1.0, active=0.6, forming=0.3)
  const qualityScore = (
    (strongCount * 1.0) + (activeCount * 0.6) + (formingCount * 0.3)
  ) / total;

  // Calculate percentages
  const strongPct = (strongCount / total) * 100;
  const activePct = (activeCount / total) * 100;
  const formingPct = (formingCount / total) * 100;

  // Get previous week's quality score for comparison
  const lastWeek = new Date();
  lastWeek.setDate(lastWeek.getDate() - 7);
  
  const { data: prevWeek } = await supabase
    .from('investor_quality_drift')
    .select('quality_score')
    .eq('investor_id', investorId)
    .lt('week_bucket', lastWeek.toISOString().split('T')[0])
    .order('week_bucket', { ascending: false })
    .limit(1)
    .single();

  // Calculate week-over-week change
  const prevScore = prevWeek?.quality_score || qualityScore;
  const wowChange = ((qualityScore - prevScore) / prevScore) * 100;

  // Determine trend direction
  let trendDirection: 'improving' | 'stable' | 'declining' = 'stable';
  if (wowChange > 5) trendDirection = 'improving';
  else if (wowChange < -5) trendDirection = 'declining';

  // Get week bucket (Monday of current week)
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const weekStart = new Date(now.setDate(diff));
  const weekBucket = weekStart.toISOString().split('T')[0];

  // Upsert quality drift record
  await supabase
    .from('investor_quality_drift')
    .upsert({
      investor_id: investorId,
      week_bucket: weekBucket,
      total_inbound: total,
      strong_count: strongCount,
      active_count: activeCount,
      forming_count: formingCount,
      strong_percentage: parseFloat(strongPct.toFixed(2)),
      active_percentage: parseFloat(activePct.toFixed(2)),
      forming_percentage: parseFloat(formingPct.toFixed(2)),
      quality_score: parseFloat(qualityScore.toFixed(3)),
      week_over_week_change: parseFloat(wowChange.toFixed(2)),
      trend_direction: trendDirection
    }, {
      onConflict: 'investor_id,week_bucket'
    });
}

// =============================================================================
// UPDATE ALL INVESTORS
// =============================================================================

export async function updateAllInvestorsQualityDrift(): Promise<number> {
  // Get all investors with discovery flow data
  const { data: investors } = await supabase
    .from('investor_discovery_flow')
    .select('investor_id')
    .limit(1000);

  if (!investors) return 0;

  // Get unique investor IDs
  const uniqueInvestorIds = [...new Set(investors.map(i => i.investor_id))];
  
  let updated = 0;
  for (const investorId of uniqueInvestorIds) {
    try {
      await updateQualityDrift(investorId);
      updated++;
    } catch (error) {
      console.error(`Error updating quality drift for ${investorId}:`, error);
    }
  }

  console.log(`Updated quality drift for ${updated} investors`);
  return updated;
}

// =============================================================================
// SYNC DISCOVERY FLOW FROM MATCHES
// =============================================================================

export async function syncDiscoveryFlowFromMatches(): Promise<number> {
  // Get all investors
  const { data: investors } = await supabase
    .from('investors')
    .select('id')
    .limit(500);

  if (!investors) return 0;

  let totalAdded = 0;

  for (const investor of investors) {
    try {
      // Import the function dynamically to avoid circular deps
      const { populateDiscoveryFlowFromMatches } = await import('./investorObservatoryService');
      const added = await populateDiscoveryFlowFromMatches(investor.id);
      totalAdded += added;
    } catch (error) {
      console.error(`Error syncing flow for ${investor.id}:`, error);
    }
  }

  console.log(`Total discovery flow items added: ${totalAdded}`);
  return totalAdded;
}

// =============================================================================
// UPDATE ENTRY PATH DISTRIBUTION
// =============================================================================

// Entry path labels
const ENTRY_PATH_LABELS: Record<string, string> = {
  'direct': 'Direct Application',
  'referral': 'Referral',
  'operator_referral': 'Operator Referral',
  'advisor_intro': 'Advisor Introduction',
  'portfolio_co_intro': 'Portfolio Co. Introduction',
  'event': 'Event/Conference',
  'cold_outreach': 'Cold Outreach',
  'accelerator': 'Accelerator Program',
  'demo_day': 'Demo Day',
  'content_inbound': 'Content/Blog Inbound',
  'twitter': 'Twitter/X',
  'linkedin': 'LinkedIn',
  'marketplace': 'Marketplace/Platform'
};

export async function updateEntryPathDistribution(investorId: string): Promise<void> {
  // For now, generate sample distribution based on investor profile
  // In production, this would track actual entry paths
  
  const { data: investor } = await supabase
    .from('investors')
    .select('stage, sectors')
    .eq('id', investorId)
    .single();

  if (!investor) return;

  // Sample entry path distribution (would be real data in production)
  const paths = [
    { path: 'referral', weight: 35 },
    { path: 'direct', weight: 25 },
    { path: 'operator_referral', weight: 15 },
    { path: 'accelerator', weight: 10 },
    { path: 'content_inbound', weight: 8 },
    { path: 'twitter', weight: 7 }
  ];

  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - 30);

  for (const { path, weight } of paths) {
    await supabase
      .from('investor_entry_path_distribution')
      .upsert({
        investor_id: investorId,
        entry_path: path,
        path_label: ENTRY_PATH_LABELS[path] || path,
        occurrence_count: Math.floor(weight * 2),
        percentage: weight,
        avg_alignment_quality: 0.5 + Math.random() * 0.3,
        conversion_rate: 10 + Math.random() * 30,
        window_start: windowStart.toISOString(),
        window_end: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'investor_id,entry_path,window_start'
      });
  }
}

// =============================================================================
// FULL OBSERVATORY SYNC
// =============================================================================

export async function fullObservatorySync(): Promise<{
  flowItems: number;
  qualityUpdates: number;
}> {
  console.log('Starting full observatory sync...');
  
  // 1. Sync discovery flow from matches
  const flowItems = await syncDiscoveryFlowFromMatches();
  
  // 2. Update quality drift for all investors
  const qualityUpdates = await updateAllInvestorsQualityDrift();
  
  console.log(`Observatory sync complete: ${flowItems} flow items, ${qualityUpdates} quality updates`);
  
  return { flowItems, qualityUpdates };
}
