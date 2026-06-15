/**
 * PYTH AI SCORE RECALCULATOR
 * ============================
 * Recalculates GOD scores for startups using:
 * - ../server/scoring/hotGodFromStartupRow.js (row → profile → component columns + psych)
 * - ../server/services/startupScoringService.ts (calculateHotScore implementation)
 * 
 * ALSO includes Bootstrap Scoring for sparse-data startups:
 * ../server/services/bootstrapScoringService.ts
 * 
 * ⚠️  DO NOT ADD SCORING LOGIC HERE - use the scoring services instead!
 * 
 * Runs hourly via PM2 cron.
 */

import * as path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { calculateBootstrapScore } from '../server/services/bootstrapScoringService';

// T2: Momentum scoring layer (CommonJS)
const { calculateMomentumScore, loadScoreHistoryBatch } = require('../server/services/momentumScoringService');

// T4: AP + Promising scoring layer (Feb 14, 2026) - ADMIN APPROVED
import { calculateAPOrPromisingBonus } from '../server/services/apScoringService';

// T5: Elite tiered scoring boost — rewards excellence across multiple dimensions
import { calculateEliteBoost } from '../server/services/eliteScoringService';

// T6: Spiky Bachelor + Hot Startup recognition
import { calculateSpikyAndHotBonus } from '../server/services/spikyBachelorService';

// T7: Investor Pedigree bonus — rewards real backer/advisor confidence signals (Feb 28, 2026)
import { calculateInvestorPedigreeBonus } from '../server/services/investorPedigreeScoringService';
import { isValidStartupName } from '../server/utils/startupNameValidator';

import { formatScoreRecalcSummaryLegend } from '../src/lib/scoreRecalcSummaryLabels';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

/**
 * Verbose 💰 pedigree lines — suppress for entries that look like RSS headline junk.
 * Note: entity_gate='junk' rows are already excluded at the query level (ontology gate pre-filter).
 * This guard is a secondary check for unclassified entries with invalid names.
 */
function shouldLogPedigreeLine(startup: any): boolean {
  const gate = String(startup?.entity_gate ?? '').toLowerCase();
  if (gate === 'junk') return false;
  return isValidStartupName(startup?.name).isValid;
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const requireHotGod = createRequire(import.meta.url);
const __recalcDir = path.dirname(fileURLToPath(import.meta.url));
const hotGod = requireHotGod(path.join(__recalcDir, '../server/scoring/hotGodFromStartupRow.js'));

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

/** Paginated fetch with retries — full-row select('*') is heavy; small pages avoid ETIMEDOUT. */
async function fetchAllStartupsForRecalc(): Promise<any[]> {
  const pageSize = Math.max(50, Math.min(500, Number(process.env.SCORE_RECALC_PAGE_SIZE || 280)));
  const maxAttempts = Math.max(1, Math.min(12, Number(process.env.SCORE_RECALC_FETCH_RETRIES || 6)));
  const startups: any[] = [];
  let page = 0;
  while (true) {
    let batch: any[] | null = null;
    let lastErr: { message?: string } | null = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const { data, error: fetchError } = await supabase
        .from('startup_uploads')
        .select('*')
        .in('status', ['pending', 'approved'])
        .neq('entity_gate', 'junk')
        .order('updated_at', { ascending: true })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (!fetchError && data) {
        batch = data;
        lastErr = null;
        break;
      }
      lastErr = fetchError;
      const msg = `${fetchError?.message || ''} ${(fetchError as any)?.details || ''}`;
      const retryable =
        /ETIMEDOUT|timeout|terminated|ECONNRESET|EPIPE|502|503|504/i.test(msg) ||
        (fetchError as any)?.code === '57014';
      if (!retryable || attempt === maxAttempts) break;
      const backoff = Math.min(30_000, 1500 * 2 ** (attempt - 1));
      console.warn(
        `  ⚠️  Fetch page ${page} attempt ${attempt}/${maxAttempts} failed (${fetchError?.message || 'error'}) — retry in ${backoff}ms`
      );
      await sleep(backoff);
    }
    if (lastErr) {
      console.error('Error fetching startups:', lastErr);
      process.exit(1);
    }
    if (!batch || batch.length === 0) break;
    startups.push(...batch);
    if (page === 0 || page % 5 === 0) {
      console.log(`  … loaded ${startups.length} rows (page ${page}, size ${pageSize})`);
    }
    if (batch.length < pageSize) break;
    page++;
  }
  return startups;
}

interface ScoreBreakdown {
  market_score: number;
  team_score: number;
  traction_score: number;
  product_score: number;
  vision_score: number;
  total_god_score: number;
  // Phase 1 Psychological Signals (Feb 12, 2026)
  // Note: Column named psychological_multiplier but stores additive bonus
  psychological_multiplier?: number; // -0.3 to +1.0 (on 0-10 scale)
  enhanced_god_score?: number;
  psychological_signals?: {
    fomo: number;
    conviction: number;
    urgency: number;
    risk: number;
  };
}

type FaithAgg = {
  topScore: number;       // 0-100
  avgScore: number;       // 0-100
  count: number;
  confidenceAvg: number;  // 0-1
};

async function loadFaithAggregates(): Promise<Map<string, FaithAgg>> {
  const map = new Map<string, FaithAgg>();
  try {
    const { data, error } = await supabase
      .from('faith_alignment_matches')
      .select('startup_id, faith_alignment_score, confidence');
    if (error) {
      console.warn('Faith aggregates query failed:', error.message);
      return map;
    }
    if (!data || data.length === 0) return map;

    // Aggregate per startup
    for (const row of data) {
      const sid = row.startup_id as string;
      const score = Number(row.faith_alignment_score) || 0;
      const conf = typeof row.confidence === 'number' ? row.confidence : (Number(row.confidence) || 0);
      const prev = map.get(sid);
      if (!prev) {
        map.set(sid, { topScore: score, avgScore: score, count: 1, confidenceAvg: conf || 0 });
      } else {
        const count = prev.count + 1;
        const avg = (prev.avgScore * prev.count + score) / count;
        const confAvg = (prev.confidenceAvg * prev.count + (conf || 0)) / count;
        map.set(sid, { topScore: Math.max(prev.topScore, score), avgScore: avg, count, confidenceAvg: confAvg });
      }
    }
  } catch (e) {
    console.warn('Failed to build faith aggregates:', e);
  }
  return map;
}

/** Pure GOD component breakdown — SSOT: server/scoring/hotGodFromStartupRow.js */
function calculateGODScore(startup: any): ScoreBreakdown {
  return hotGod.calculateGodScoreBreakdownFromStartup(startup) as ScoreBreakdown;
}

/**
 * Classify startups by data richness for phased processing
 * Phase 1 (Data Rich): Has multiple numeric metrics (revenue, customers, funding)
 * Phase 2 (Good Data): Has some numeric metrics or strong signals
 * Phase 3 (Medium Data): Has basic data but mostly inference
 * Phase 4 (Sparse Data): Limited data, relies on bootstrap
 */
function classifyDataRichness(startup: any): number {
  let dataScore = 0;
  
  // Numeric traction metrics (+2 each)
  if (startup.arr || startup.revenue || startup.arr_usd || startup.revenue_usd) dataScore += 2;
  if (startup.mrr) dataScore += 2;
  if (startup.customer_count || startup.parsed_customers) dataScore += 2;
  if (startup.parsed_users) dataScore += 1;
  
  // Funding metrics (+1 each)
  if (startup.last_round_amount_usd || startup.total_funding_usd) dataScore += 1;
  if (startup.backed_by) dataScore += 1;
  
  // Team data (+1 each)
  if (startup.team_companies?.length > 0) dataScore += 1;
  if (startup.team_size) dataScore += 1;
  
  // Product launch (+1)
  if (startup.is_launched) dataScore += 1;
  
  // Classify into phases
  if (dataScore >= 8) return 1;  // Data Rich: 8+ signals
  if (dataScore >= 5) return 2;  // Good Data: 5-7 signals
  if (dataScore >= 2) return 3;  // Medium Data: 2-4 signals
  return 4;                       // Sparse Data: 0-1 signals
}

async function recalculateScores(): Promise<void> {
  console.log('🔢 Starting GOD Score recalculation (PHASED BY DATA RICHNESS)...');
  console.log('🚀 Including Bootstrap Scoring for sparse-data startups...\n');
  
  // Load faith-alignment aggregates once (optional; safe if table empty)
  const faithAgg = await loadFaithAggregates();

  // Get startups (paginated + retries — large select('*') pages time out over REST)
  console.log(
    `  (page size ${Number(process.env.SCORE_RECALC_PAGE_SIZE || 280)}, retries ${Number(process.env.SCORE_RECALC_FETCH_RETRIES || 6)} — tune via env)\n`
  );
  const startups = await fetchAllStartupsForRecalc();

  if (!startups || startups.length === 0) {
    console.log('No startups to process');
    return;
  }
  console.log(
    `  (scope: status pending|approved, entity_gate ≠ junk — ${startups.length} rows; approved-only health checks use ~15k)\n`
  );

  // Classify startups into phases
  const phases = {
    1: startups.filter(s => classifyDataRichness(s) === 1),
    2: startups.filter(s => classifyDataRichness(s) === 2),
    3: startups.filter(s => classifyDataRichness(s) === 3),
    4: startups.filter(s => classifyDataRichness(s) === 4)
  };

  console.log(`📊 Processing ${startups.length} startups in 4 phases:`);
  console.log(`   Phase 1 (Data Rich):  ${phases[1].length} startups`);
  console.log(`   Phase 2 (Good Data):  ${phases[2].length} startups`);
  console.log(`   Phase 3 (Medium):     ${phases[3].length} startups`);
  console.log(`   Phase 4 (Sparse):     ${phases[4].length} startups`);
  if (phases[4].length > 2000) {
    console.log(`   (Phase 4 is slow: ~${Math.ceil(phases[4].length / 250)} min typical — one DB update + history insert per changed row; progress logs every 400 rows.)\n`);
  } else {
    console.log('');
  }

  // T2: Pre-load score history for momentum trajectory dimension
  const startupIds = startups.map((s: any) => s.id);
  let scoreHistoryMap: Map<string, any[]> = new Map();
  try {
    scoreHistoryMap = await loadScoreHistoryBatch(supabase, startupIds);
    console.log(`📈 Loaded score history for ${scoreHistoryMap.size} startups`);
  } catch (e) {
    console.warn('⚠️  Score history load failed — momentum trajectory disabled');
  }

  // T2: Check if momentum_score column exists (added lazily)
  let momentumColumnExists = false;
  try {
    const { error: colTest } = await supabase
      .from('startup_uploads')
      .select('momentum_score')
      .limit(1);
    momentumColumnExists = !colTest || !colTest.message?.includes('momentum_score');
  } catch {
    momentumColumnExists = false;
  }
  if (!momentumColumnExists) {
    console.warn('⚠️  momentum_score column not found — momentum stored in total_god_score only');
  }

  let updated = 0;
  let unchanged = 0;
  let bootstrapApplied = 0;
  let momentumApplied = 0;
  let apApplied = 0;
  let promisingApplied = 0;
  let eliteApplied = 0;
  let spikyApplied = 0;
  let hotApplied = 0;
  let pedigreeApplied = 0;
  let accomplishmentApplied = 0;

  // Process each phase sequentially
  for (const phaseNum of [1, 2, 3, 4]) {
    const phaseStartups = phases[phaseNum as keyof typeof phases];
    if (phaseStartups.length === 0) continue;
    
    const phaseLabel = phaseNum === 1 ? 'Data Rich' : phaseNum === 2 ? 'Good Data' : phaseNum === 3 ? 'Medium' : 'Sparse';
    console.log(`\n🔄 Phase ${phaseNum} (${phaseLabel}): Processing ${phaseStartups.length} startups...`);
    
    let phaseUpdated = 0;
    let phaseUnchanged = 0;
    const startTime = Date.now();
    let processedInPhase = 0;

  for (const startup of phaseStartups) {
    processedInPhase++;
    // Heartbeat: Phase 4 can take 20–40m (thousands of sequential DB round-trips) with no other logs
    if (processedInPhase === 1 || processedInPhase % 400 === 0 || processedInPhase === phaseStartups.length) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      console.log(`  ⏳ Phase ${phaseNum} progress: ${processedInPhase}/${phaseStartups.length} (${elapsed}s elapsed)`);
    }

    const oldScore = startup.total_god_score || 0;
    
    // ============================================================================
    // PRIORITY 1: PURE GOD SCORE (23 algorithms, NO bootstrap contamination)
    // ============================================================================
    const faith = faithAgg.get(startup.id) || undefined;
    const scores = calculateGODScore({ ...startup, faithSignals: faith });
    
    // ============================================================================
    // PRIORITY 2: SIGNALS BONUS (Market intelligence layer)
    // ============================================================================
    // Get signals_bonus from startup (already populated from startup_signal_scores table)
    const signalsBonus = Math.min(startup.signals_bonus || 0, 9); // Capped at 9 — balanced Feb 28 2026 to allow meaningful signal impact while preventing excessive inflation
    
    // ============================================================================
    // CONDITIONAL BONUSES: Only apply if data-rich (Phase 1-2)
    // ============================================================================
    let momentumBonus = 0;
    let apPromisingBonus = 0;
    let eliteSpikyBonus = 0; // Combined Elite + Spiky
    let pedigreeBonus = 0;  // T7: Investor / Advisor pedigree
    let apType: 'ap' | 'promising' | 'none' = 'none';
    let eliteTier = 'none';
    
    const isDataRich = phaseNum <= 2; // Only Phase 1 (Data Rich) and Phase 2 (Good Data)
    
    if (isDataRich) {
      // Momentum scoring — forward movement recognition (+0 to +8 pts)
      try {
        const momentumResult = calculateMomentumScore(startup, {
          scoreHistory: scoreHistoryMap.get(startup.id) || [],
        });
        if (momentumResult.applied && momentumResult.total > 0) {
          momentumBonus = momentumResult.total;
          momentumApplied++;
        }
      } catch (e) {
        // Momentum scoring is optional, continue if it fails
      }
      
      // AP + Promising bonus — detects premium startups stuck below their tier
      try {
        const apPromResult = calculateAPOrPromisingBonus({
          ...startup,
          team_score: scores.team_score,
          traction_score: scores.traction_score,
          market_score: scores.market_score,
          product_score: scores.product_score,
          vision_score: scores.vision_score,
          total_god_score: scores.total_god_score + signalsBonus + momentumBonus,
        });
        if (apPromResult.bonus > 0 && apPromResult.type !== 'none') {
          apPromisingBonus = apPromResult.bonus;
          apType = apPromResult.type;
          if (apPromResult.type === 'ap') apApplied++;
          if (apPromResult.type === 'promising') promisingApplied++;
        }
      } catch (e) {
        // AP/Promising scoring is optional, continue if it fails
      }
      
      // Elite + Spiky COMBINED — Rewards excellence and organic quality spikes
      try {
        const preEliteScore = Math.round(scores.total_god_score + signalsBonus + momentumBonus + apPromisingBonus);
        
        // Elite boost (multiplicative quality reward for 60+ startups)
        let eliteBoost = 0;
        const eliteResult = calculateEliteBoost(startup, preEliteScore);
        if (eliteResult.applied && eliteResult.boost > 0) {
          eliteBoost = eliteResult.boost;
          eliteTier = eliteResult.tier;
          eliteApplied++;
        }
        
        // Spiky/Hot bonus (organic quality spikes and momentum)
        let spikyHotBonus = 0;
        const spikyResult = calculateSpikyAndHotBonus(
          { ...startup, team_score: scores.team_score, traction_score: scores.traction_score, market_score: scores.market_score, product_score: scores.product_score, vision_score: scores.vision_score },
          preEliteScore + eliteBoost
        );
        if (spikyResult.applied && spikyResult.totalBonus > 0) {
          spikyHotBonus = spikyResult.totalBonus;
          if (spikyResult.spikyBonus > 0) spikyApplied++;
          if (spikyResult.hotBonus > 0) hotApplied++;
        }
        
        // Combine Elite + Spiky into single bonus weight
        eliteSpikyBonus = eliteBoost + spikyHotBonus;
        
        if (phaseNum === 1 && eliteSpikyBonus >= 5) {
          console.log(`  🏆 ${startup.name}: +${eliteSpikyBonus} elite/spiky (${eliteTier})`);
        }
      } catch (e) {
        // Elite/Spiky scoring is optional, continue if it fails
      }
    }
    
    // ============================================================================
    // BASE SCORE = GOD + Signals + Conditional bonuses
    // ============================================================================
    // IMPORTANT: GOD score is the source of truth. Bonuses are supplementary signal
    // layers. We cap the TOTAL of all bonuses at +10 so they can never dominate or
    // corrupt the GOD base score. (Feb 25, 2026 — avg uncapped bonus was 13.4 pts,
    // max 25.2 pts, which was inflating 60–70 range artificially.)
    const psychBonus = scores.psychological_multiplier || 0;
    const psychBonusGOD = Math.min(Math.max(psychBonus * 10, -5), 7); // Psych: -5 to +7 GOD pts

    // T7: Investor Pedigree — applied to ALL startups (not gated on isDataRich)
    // Rationale: even sparse-data startups have investor info; pedigree is a standalone signal
    try {
      const pedigreeResult = calculateInvestorPedigreeBonus(startup);
      if (pedigreeResult.applied && pedigreeResult.bonus > 0) {
        pedigreeBonus = pedigreeResult.bonus;
        pedigreeApplied++;
        if (
          shouldLogPedigreeLine(startup) &&
          (pedigreeResult.tier === 'elite' || pedigreeResult.bonus >= 5)
        ) {
          console.log(`  💰 ${startup.name}: +${pedigreeBonus} pedigree (${pedigreeResult.tier}) — ${pedigreeResult.matchedInvestors.slice(0,3).join(', ')}`);
        }
      }
    } catch (e) {
      // Pedigree scoring is optional, continue if it fails
    }

    // T8: Accomplishment Evidence — rewards startups that submit proof (deck, press)
    // Rationale: founders who add evidence demonstrate transparency and seriousness
    let accomplishmentBonus = 0;
    const hasDeck = !!(startup.deck_url || startup.deck_filename);
    if (hasDeck) accomplishmentBonus += 2;
    const evidenceArr = Array.isArray(startup.evidence) ? startup.evidence : [];
    const founderEvidenceCount = evidenceArr.filter((e: any) => e?.source === 'founder').length;
    if (founderEvidenceCount > 0) {
      accomplishmentBonus += Math.min(founderEvidenceCount, 2); // +1 per press URL, max +2
    }
    if (accomplishmentBonus > 0) {
      accomplishmentApplied++;
      // Logging every row with a deck in Phase 3–4 floods the terminal (thousands of lines) and slows I/O
      if (phaseNum <= 2) {
        console.log(`  📄 ${startup.name}: +${accomplishmentBonus} accomplishment evidence (deck: ${hasDeck}, press: ${founderEvidenceCount})`);
      }
    }

    const rawBonuses = signalsBonus + momentumBonus + apPromisingBonus + eliteSpikyBonus + psychBonusGOD + pedigreeBonus + accomplishmentBonus;
    const cappedBonuses = Math.min(rawBonuses, 10); // Cap: bonuses ≤ +10 total — reduced Feb 28 2026 from +15 to prevent scores from being pushed out of 50-59 range into 60+
    const GOD_SCORE_FLOOR = 40; // Approved startups never below 40 — enforced for consistency with monitor/tiers
    const raw = Math.round(Number(scores.total_god_score) + cappedBonuses);
    const finalScore = Math.max(GOD_SCORE_FLOOR, Math.min(Number.isFinite(raw) ? raw : GOD_SCORE_FLOOR, 100));
    const enhancedScore = finalScore; // Enhanced score is same as final after psychological application

    // ============================================================================
    // UPDATE DATABASE
    // ============================================================================
    const oldMomentum = startup.momentum_score || 0;
    const momentumChanged = momentumColumnExists && Math.abs(momentumBonus - oldMomentum) > 0.01;
    
    if (finalScore !== oldScore || momentumChanged) {
      const updatePayload: any = {
          total_god_score: finalScore,
          market_score: scores.market_score,
          team_score: scores.team_score,
          traction_score: scores.traction_score,
          product_score: scores.product_score,
          vision_score: scores.vision_score,
          psychological_multiplier: psychBonus,
          enhanced_god_score: enhancedScore,
          updated_at: new Date().toISOString()
      };
      
      if (momentumColumnExists) {
        updatePayload.momentum_score = momentumBonus;
      }

      const { error: updateError } = await supabase
        .from('startup_uploads')
        .update(updatePayload)
        .eq('id', startup.id);

      if (updateError) {
        console.error(`Error updating ${startup.name}:`, updateError);
      } else {
        // Log score change to history
        try {
          // Determine reason based on what bonuses were applied
          let reason = 'recalc_clean_architecture';
          if (isDataRich) {
            if (apPromisingBonus > 0) reason = `recalc_with_${apType}`;
            else if (momentumBonus > 0) reason = 'recalc_with_momentum';
            else if (eliteSpikyBonus > 0) reason = 'recalc_with_elite_spiky';
          }
          
          await supabase.from('score_history').insert({
            startup_id: startup.id,
            old_score: oldScore,
            new_score: finalScore,
            reason
          });
        } catch {} // Ignore if table doesn't exist

        // Verbose logging only for Phase 1-2 (Data Rich) significant changes
        if (phaseNum <= 2 && Math.abs(finalScore - oldScore) >= 5) {
          const boostParts: string[] = [];
          if (signalsBonus > 0) boostParts.push(`${signalsBonus.toFixed(1)} signals`);
          if (isDataRich) {
            if (momentumBonus > 0) boostParts.push(`${momentumBonus.toFixed(1)} momentum`);
            if (apPromisingBonus > 0) boostParts.push(`${apPromisingBonus.toFixed(1)} ${apType}`);
            if (eliteSpikyBonus > 0) boostParts.push(`${eliteSpikyBonus.toFixed(1)} elite+spiky`);
          }
          if (psychBonusGOD !== 0) boostParts.push(`${psychBonusGOD > 0 ? '+' : ''}${psychBonusGOD.toFixed(1)} psych`);
          if (accomplishmentBonus > 0) boostParts.push(`${accomplishmentBonus.toFixed(1)} evidence`);
          const boostNote = boostParts.length > 0 ? ` (+${boostParts.join(', ')})` : '';
          console.log(`  ✅ ${startup.name}: ${oldScore} → ${finalScore}${boostNote}`);
        }
        updated++;
        phaseUpdated++;
        
        // Track for gap refresh
        updatedStartupIds.push(startup.id);
      }
    } else {
      unchanged++;
      phaseUnchanged++;
    }
  }
  
  // Phase completion summary
  const phaseTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`✅ Phase ${phaseNum} complete: ${phaseUpdated} updated, ${phaseUnchanged} unchanged (${phaseTime}s)`);
  }  // End phase loop

  // ═══════════════════════════════════════════════════════════════════════════
  // SIGNAL GAP AUTO-RESOLUTION
  // After score changes, refresh gaps to auto-resolve improvements
  // ═══════════════════════════════════════════════════════════════════════════
  if (updatedStartupIds.length > 0) {
    console.log(`\n🔄 Refreshing signal gaps for ${updatedStartupIds.length} updated startups...`);
    try {
      // Dynamically import the gap service (CommonJS)
      const signalGapService = require('../server/lib/signalGapService');
      let gapsRefreshed = 0;
      let gapsResolved = 0;
      
      for (const startupId of updatedStartupIds.slice(0, 50)) { // Limit to 50 per run
        try {
          const result = await signalGapService.refreshGaps(startupId);
          gapsRefreshed += result.upserted;
          gapsResolved += result.resolved;
        } catch (e) {
          // Ignore individual failures
        }
      }
      
      if (gapsResolved > 0) {
        console.log(`  ✨ Auto-resolved ${gapsResolved} signal gaps (score improvements)`);
      }
      console.log(`  📊 Refreshed ${gapsRefreshed} gaps total`);
    } catch (e) {
      console.warn('  ⚠️ Signal gap refresh skipped (service not available)');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CANONICAL DELTA SYSTEM - Compute feature snapshots from GOD score changes
  // GOD absorbs verified deltas, not unverified claims
  // ═══════════════════════════════════════════════════════════════════════════
  if (updatedStartupIds.length > 0) {
    console.log(`\n📈 Computing canonical delta snapshots...`);
    try {
      const canonicalDelta = require('../server/lib/canonicalDeltaService');
      const config = await canonicalDelta.getDeltaConfig();
      let snapshotsCreated = 0;
      let godAdjustmentsApplied = 0;
      
      for (const startupId of updatedStartupIds.slice(0, 25)) { // Limit to 25 per run
        try {
          // Create feature snapshots from GOD component scores
          const startup = startups.find(s => s.id === startupId);
          if (!startup) continue;
          
          const scores = calculateGODScore(startup);
          
          // Map GOD components to canonical features with verification from data quality
          const featureWeights = config.feature_weights || {};
          const features = [
            { 
              id: 'traction', 
              norm: scores.traction_score / 100,
              weight: featureWeights.traction || 2.5,
              // Verification based on whether we have numeric data or just inference
              verification: (startup.mrr || startup.customer_count || startup.arr) ? 0.65 : 0.25,
              verificationTier: (startup.mrr || startup.customer_count) ? 'soft_verified' : 'unverified'
            },
            {
              id: 'team_strength',
              norm: scores.team_score / 100,
              weight: featureWeights.team_strength || 1.2,
              verification: startup.team_companies?.length > 0 ? 0.55 : 0.25,
              verificationTier: 'soft_verified'
            },
            {
              id: 'product_quality',
              norm: scores.product_score / 100,
              weight: featureWeights.product_quality || 1.2,
              verification: startup.is_launched ? 0.45 : 0.2,
              verificationTier: startup.is_launched ? 'soft_verified' : 'unverified'
            },
            {
              id: 'market_size',
              norm: scores.market_score / 100,
              weight: featureWeights.market_size || 1.0,
              verification: 0.35, // Market signals are typically inferred
              verificationTier: 'soft_verified'
            },
            {
              id: 'founder_velocity',
              norm: scores.vision_score / 100,
              weight: featureWeights.founder_velocity || 2.0,
              verification: startup.founder_voice_score ? 0.5 : 0.3,
              verificationTier: 'soft_verified'
            }
          ];
          
          // Insert feature snapshots
          const now = new Date().toISOString();
          for (const feature of features) {
            await supabase
              .from('feature_snapshots')
              .upsert({
                startup_id: startupId,
                feature_id: feature.id,
                raw: { source: 'god_recalc', god_component: feature.id },
                norm: feature.norm,
                weight: feature.weight,
                confidence: 0.7, // GOD scores have moderate confidence
                verification: feature.verification,
                freshness: 1.0, // Just calculated
                verification_tier: feature.verificationTier,
                measured_at: now
              }, {
                onConflict: 'startup_id,feature_id,measured_at'
              });
          }
          
          // Compute and store score snapshot
          const result = await canonicalDelta.computeAndStoreSnapshot(startupId, 'god_recalc');
          snapshotsCreated++;
          
          // Apply GOD adjustment if there are verified deltas
          const adjustment = await canonicalDelta.computeGodAdjustment(startupId);
          if (Math.abs(adjustment.adjustment) > 0.5) {
            godAdjustmentsApplied++;
            console.log(`    🎯 ${startup.name}: GOD adjustment ${adjustment.adjustment > 0 ? '+' : ''}${adjustment.adjustment.toFixed(1)}`);
          }
          
        } catch (e) {
          // Ignore individual failures, continue processing
        }
      }
      
      console.log(`  📊 Created ${snapshotsCreated} score snapshots`);
      if (godAdjustmentsApplied > 0) {
        console.log(`  🎯 Applied ${godAdjustmentsApplied} GOD adjustments from verified deltas`);
      }
    } catch (e) {
      console.warn('  ⚠️ Canonical delta computation skipped:', (e as Error).message);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VERIFICATION PIPELINE REFRESH
  // Process actions + evidence artifacts → update verification states → emit deltas
  // ═══════════════════════════════════════════════════════════════════════════
  console.log(`\n🔐 Refreshing verification pipeline...`);
  try {
    let actionsProcessed = 0;
    let verificationsUpdated = 0;
    let deltasEmitted = 0;
    
    // Get all unverified actions with evidence
    const { data: pendingActions, error: actionsError } = await supabase
      .from('action_events_v2')
      .select(`
        id,
        startup_id,
        type,
        title,
        status,
        fields
      `)
      .in('status', ['pending', 'provisional_applied'])
      .order('created_at', { ascending: true })
      .limit(100);
    
    if (actionsError) {
      console.warn('  ⚠️ Failed to fetch actions:', actionsError.message);
    } else if (pendingActions?.length) {
      console.log(`  📋 Processing ${pendingActions.length} pending actions...`);
      
      for (const action of pendingActions) {
        actionsProcessed++;
        
        // Get evidence for this action
        const { data: evidence } = await supabase
          .from('evidence_artifacts_v2')
          .select('id, type, tier, confidence')
          .eq('action_id', action.id);
        
        // Get connected sources for this startup
        const { data: sources } = await supabase
          .from('connected_sources_v2')
          .select('provider, status')
          .eq('startup_id', action.startup_id)
          .eq('status', 'connected');
        
        // Calculate verification score
        const VERIFICATION_SCORES = {
          OAUTH_CONNECTOR: 0.35,
          WEBHOOK_EVENT: 0.35,
          DOC_PROOF: 0.20,
          PUBLIC_LINK: 0.10
        };
        
        let verificationScore = 0;
        
        // Add score from evidence
        for (const ev of evidence || []) {
          switch (ev.type) {
            case 'oauth_connector':
              verificationScore += VERIFICATION_SCORES.OAUTH_CONNECTOR;
              break;
            case 'webhook_event':
              verificationScore += VERIFICATION_SCORES.WEBHOOK_EVENT;
              break;
            case 'document_upload':
              verificationScore += VERIFICATION_SCORES.DOC_PROOF;
              break;
            case 'public_link':
              verificationScore += VERIFICATION_SCORES.PUBLIC_LINK;
              break;
          }
        }
        
        // Add score from connected sources relevant to action type
        const revenueTypes = ['revenue_change', 'contract_signed', 'new_customer', 'mrr_increase'];
        if (revenueTypes.includes(action.type)) {
          const hasStripe = sources?.some(s => s.provider === 'stripe');
          if (hasStripe) {
            verificationScore += VERIFICATION_SCORES.OAUTH_CONNECTOR;
          }
        }
        
        verificationScore = Math.min(1.0, verificationScore);
        
        // Determine tier
        const getTier = (score: number) => {
          if (score >= 0.85) return 'trusted';
          if (score >= 0.65) return 'verified';
          if (score >= 0.35) return 'soft_verified';
          return 'unverified';
        };
        
        const newTier = getTier(verificationScore);
        
        // Get or create verification state
        const { data: existingVs } = await supabase
          .from('verification_states_v2')
          .select('*')
          .eq('action_id', action.id)
          .single();
        
        const oldTier = existingVs?.tier || 'unverified';
        const oldScore = existingVs?.verification_score || 0;
        
        // Update if changed
        if (verificationScore !== oldScore || newTier !== oldTier) {
          const { error: vsError } = await supabase
            .from('verification_states_v2')
            .upsert({
              action_id: action.id,
              startup_id: action.startup_id,
              verification_score: verificationScore,
              tier: newTier,
              satisfied: verificationScore >= 0.65,
              matched_evidence_ids: (evidence || []).map(e => e.id),
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'action_id'
            });
          
          if (!vsError) {
            verificationsUpdated++;
            
            // Emit delta if crossed verified threshold
            if ((newTier === 'verified' || newTier === 'trusted') && oldTier !== 'verified' && oldTier !== 'trusted') {
              const deltaSignal = verificationScore;
              const deltaGod = verificationScore * 0.25;
              
              const { error: deltaError } = await supabase
                .from('score_deltas_v2')
                .insert({
                  startup_id: action.startup_id,
                  action_id: action.id,
                  delta_signal: deltaSignal,
                  delta_god: deltaGod,
                  reason: 'verification_upgraded',
                  meta: {
                    previousTier: oldTier,
                    newTier,
                    source: 'recalculate_script'
                  }
                });
              
              if (!deltaError) {
                deltasEmitted++;
                console.log(`    ✅ ${action.title}: ${oldTier} → ${newTier} (delta emitted)`);
              }
              
              // Update action status
              await supabase
                .from('action_events_v2')
                .update({ status: 'verified' })
                .eq('id', action.id);
            }
          }
        }
      }
      
      console.log(`  📊 Processed ${actionsProcessed} actions`);
      console.log(`  🔄 Updated ${verificationsUpdated} verification states`);
      if (deltasEmitted > 0) {
        console.log(`  🎯 Emitted ${deltasEmitted} verified deltas`);
      }
    }
  } catch (e) {
    console.warn('  ⚠️ Verification pipeline refresh skipped:', (e as Error).message);
  }

  console.log(`\n📊 SUMMARY`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Unchanged: ${unchanged}`);
  console.log(`  Bootstrap applied: ${bootstrapApplied}`);
  console.log(`  Momentum applied: ${momentumApplied}`);
  console.log(`  AP applied: ${apApplied}`);
  console.log(`  Promising applied: ${promisingApplied}`);
  console.log(`  Elite boost applied: ${eliteApplied}`);
  console.log(`  Spiky Bachelor recognized: ${spikyApplied}`);
  console.log(`  Hot startup bonus: ${hotApplied}`);
  console.log(`  Investor pedigree bonus: ${pedigreeApplied}`);
  console.log(`  Accomplishment evidence bonus: ${accomplishmentApplied}`);
  console.log(`  Total: ${startups.length}`);
  console.log('');
  console.log(formatScoreRecalcSummaryLegend());
  console.log('');
  console.log('✅ Score recalculation complete');
}

// Track updated startups for gap refresh
const updatedStartupIds: string[] = [];

// Run
recalculateScores().catch(console.error);
