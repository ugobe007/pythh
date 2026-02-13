#!/usr/bin/env node
/**
 * BACKFILL PSYCHOLOGICAL SIGNALS
 * ===============================
 * Extract psychological signals from existing startup_  uploads data
 * using inference-extractor.js
 * 
 * Run: node scripts/backfill-psychological-signals.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { extractInferenceData } = require('../lib/inference-extractor');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

console.log('🧠 BACKFILLING PSYCHOLOGICAL SIGNALS');
console.log('═══════════════════════════════════════════════════════════════\n');

(async () => {
  // Get all approved startups with text content
  console.log('📊 Fetching startups from startup_uploads...');
  
  const { data: startups, error: fetchError } = await supabase
    .from('startup_uploads')
    .select('id, name, description, pitch, tagline, extracted_data, latest_funding_amount, latest_funding_round, lead_investor')
    .eq('status', 'approved')
    .order('created_at', { ascending: false });
  
  if (fetchError) {
    console.error('❌ Error fetching startups:', fetchError);
    process.exit(1);
  }
  
  console.log(`✅ Found ${startups.length} approved startups\n`);
  console.log('─'.repeat(80));
  
  let processedCount = 0;
  let signalsFoundCount = 0;
  const signalBreakdown = {
    oversubscribed: 0,
    followon: 0,
    competitive: 0,
    bridge: 0
  };
  
  for (const startup of startups) {
    // Build text content for extraction
    const extractedData = startup.extracted_data || {};
    const textContent = [
      startup.description || '',
      startup.pitch || '',
      startup.tagline || '',
      extractedData.problem || '',
      extractedData.solution || '',
      extractedData.value_proposition || '',
      startup.lead_investor || '',
      JSON.stringify(extractedData)
    ].join(' ');
    
    if (textContent.length < 50) {
      continue; // Skip startups with minimal content
    }
    
    // Extract psychological signals
    const extracted = extractInferenceData(textContent, startup.name || '');
    
    const hasSignals = 
      extracted?.is_oversubscribed ||
      extracted?.has_followon ||
      extracted?.is_competitive ||
      extracted?.is_bridge_round;
    
    if (!hasSignals) {
      processedCount++;
      continue; // Skip if no signals
    }
    
    // Update startup_uploads with psychological signals (Phase 1 + Phase 2)
    const updateData = {
      // PHASE 1 SIGNALS (FOMO, Conviction, Urgency, Risk)
      is_oversubscribed: extracted.is_oversubscribed || false,
      oversubscription_multiple: extracted.oversubscription_multiple || null,
      fomo_signal_strength: extracted.fomo_signal_strength || null,
      
      has_followon: extracted.has_followon || false,
      followon_investors: extracted.followon_investors || [],
      conviction_signal_strength: extracted.conviction_signal_strength || null,
      
      is_competitive: extracted.is_competitive || false,
      term_sheet_count: extracted.term_sheet_count || null,
      urgency_signal_strength: extracted.urgency_signal_strength || null,
      
      is_bridge_round: extracted.is_bridge_round || false,
      risk_signal_strength: extracted.risk_signal_strength || null,
      
      // PHASE 2 SIGNALS (Social proof, Founder context, Sector momentum)
      has_sector_pivot: extracted.has_sector_pivot || false,
      pivot_investor: extracted.pivot_investor || null,
      pivot_from_sector: extracted.pivot_from_sector || null,
      pivot_to_sector: extracted.pivot_to_sector || null,
      
      has_social_proof_cascade: extracted.has_social_proof_cascade || false,
      tier1_leader: extracted.tier1_leader || null,
      follower_count: extracted.follower_count || null,
      
      is_repeat_founder: extracted.is_repeat_founder || false,
      previous_companies: extracted.previous_companies || [],
      previous_exits: extracted.previous_exits || [],
      
      has_cofounder_exit: extracted.has_cofounder_exit || false,
      departed_role: extracted.departed_role || null,
      departed_name: extracted.departed_name || null,
    };
    
    const { error: updateError } = await supabase
      .from('startup_uploads')
      .update(updateData)
      .eq('id', startup.id);
    
    if (updateError) {
      console.log(`   ⚠️  Error updating ${startup.name}: ${updateError.message}`);
    } else {
      signalsFoundCount++;
      console.log(`✅ ${startup.name || startup.id}`);
      
      // PHASE 1 SIGNALS
      if (extracted.is_oversubscribed) {
        console.log(`   🚀 OVERSUBSCRIBED: ${extracted.oversubscription_multiple}x (FOMO: ${extracted.fomo_signal_strength.toFixed(2)})`);
        signalBreakdown.oversubscribed++;
      }
      
      if (extracted.has_followon) {
        console.log(`   💎 FOLLOW-ON: ${extracted.followon_investors.join(', ')} (Conviction: ${extracted.conviction_signal_strength.toFixed(2)})`);
        signalBreakdown.followon++;
      }
      
      if (extracted.is_competitive) {
        console.log(`   ⚔️  COMPETITIVE: ${extracted.term_sheet_count || 'multiple'} term sheets (Urgency: ${extracted.urgency_signal_strength.toFixed(2)})`);
        signalBreakdown.competitive++;
      }
      
      if (extracted.is_bridge_round) {
        console.log(`   ⚠️  BRIDGE ROUND (Risk: ${extracted.risk_signal_strength.toFixed(2)})`);
        signalBreakdown.bridge++;
      }
      
      // PHASE 2 SIGNALS
      if (extracted.has_social_proof_cascade) {
        console.log(`   🌊 SOCIAL PROOF: ${extracted.tier1_leader} led, ${extracted.follower_count} followed (Cascade: ${extracted.cascade_strength.toFixed(2)})`);
        signalBreakdown.socialProof = (signalBreakdown.socialProof || 0) + 1;
      }
      
      if (extracted.is_repeat_founder) {
        const exitInfo = extracted.previous_exits.length > 0 
          ? ` (${extracted.previous_exits.map(e => `${e.company}→${e.acquirer}`).join(', ')})`
          : '';
        console.log(`   🔁 REPEAT FOUNDER: ${extracted.previous_companies.join(', ')}${exitInfo} (Strength: ${extracted.founder_strength.toFixed(2)})`);
        signalBreakdown.repeatFounder = (signalBreakdown.repeatFounder || 0) + 1;
      }
      
      if (extracted.has_sector_pivot) {
        const pivotInfo = extracted.pivot_from_sector 
          ? `${extracted.pivot_from_sector} → ${extracted.pivot_to_sector}`
          : extracted.pivot_to_sector;
        console.log(`   📊 SECTOR PIVOT: ${extracted.pivot_investor} to ${pivotInfo} (Strength: ${extracted.pivot_strength.toFixed(2)})`);
        signalBreakdown.sectorPivot = (signalBreakdown.sectorPivot || 0) + 1;
      }
      
      if (extracted.has_cofounder_exit) {
        console.log(`   🚪 COFOUNDER EXIT: ${extracted.departed_role} ${extracted.departed_name || 'departed'} (Risk: ${extracted.exit_risk_strength.toFixed(2)})`);
        signalBreakdown.cofounderExit = (signalBreakdown.cofounderExit || 0) + 1;
      }
      
      console.log('─'.repeat(80));
      
      // Insert into psychological_signals table for historical tracking
      const signals = [];
      
      if (extracted.is_oversubscribed) {
        signals.push({
          startup_id: startup.id,
          signal_type: 'oversubscription',
          signal_strength: extracted.fomo_signal_strength,
          metadata: {
            multiplier: extracted.oversubscription_multiple,
            amount_raised: startup.latest_funding_amount,
            funding_stage: startup.latest_funding_round
          },
          source: 'backfill_script',
          detected_at: new Date().toISOString()
        });
      }
      
      if (extracted.has_followon) {
        signals.push({
          startup_id: startup.id,
          signal_type: 'followon',
          signal_strength: extracted.conviction_signal_strength,
          metadata: {
            investors: extracted.followon_investors,
            count: extracted.followon_investors.length
          },
          source: 'backfill_script',
          detected_at: new Date().toISOString()
        });
      }
      
      if (extracted.is_competitive) {
        signals.push({
          startup_id: startup.id,
          signal_type: 'competitive',
          signal_strength: extracted.urgency_signal_strength,
          metadata: {
            term_sheets: extracted.term_sheet_count
          },
          source: 'backfill_script',
          detected_at: new Date().toISOString()
        });
      }
      
      if (extracted.is_bridge_round) {
        signals.push({
          startup_id: startup.id,
          signal_type: 'bridge',
          signal_strength: extracted.risk_signal_strength,
          metadata: {},
          source: 'backfill_script',
          detected_at: new Date().toISOString()
        });
      }
      
      // PHASE 2 SIGNALS
      if (extracted.has_social_proof_cascade) {
        signals.push({
          startup_id: startup.id,
          signal_type: 'social_proof',
          signal_strength: extracted.cascade_strength,
          metadata: {
            tier1_leader: extracted.tier1_leader,
            follower_count: extracted.follower_count
          },
          source: 'backfill_script',
          detected_at: new Date().toISOString()
        });
      }
      
      if (extracted.is_repeat_founder) {
        signals.push({
          startup_id: startup.id,
          signal_type: 'founder_repeat',
          signal_strength: extracted.founder_strength,
          metadata: {
            previous_companies: extracted.previous_companies,
            previous_exits: extracted.previous_exits
          },
          source: 'backfill_script',
          detected_at: new Date().toISOString()
        });
      }
      
      if (extracted.has_sector_pivot) {
        signals.push({
          startup_id: startup.id,
          signal_type: 'sector_pivot',
          signal_strength: extracted.pivot_strength,
          metadata: {
            investor: extracted.pivot_investor,
            from_sector: extracted.pivot_from_sector,
            to_sector: extracted.pivot_to_sector
          },
          source: 'backfill_script',
          detected_at: new Date().toISOString()
        });
      }
      
      if (extracted.has_cofounder_exit) {
        signals.push({
          startup_id: startup.id,
          signal_type: 'cofounder_exit',
          signal_strength: extracted.exit_risk_strength,
          metadata: {
            departed_role: extracted.departed_role,
            departed_name: extracted.departed_name
          },
          source: 'backfill_script',
          detected_at: new Date().toISOString()
        });
      }
      
      // Insert all signals (if table exists)
      if (signals.length > 0) {
        const { error: insertError } = await supabase
          .from('psychological_signals')
          .insert(signals);
        
        if (insertError && !insertError.message.includes('does not exist')) {
          console.log(`   ⚠️  Could not insert to psychological_signals: ${insertError.message}`);
        }
      }
    }
    
    processedCount++;
    
    // Rate limiting
    if (processedCount % 10 === 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  console.log('\n' + '═'.repeat(80));
  console.log('📈 BACKFILL SUMMARY');
  console.log('═'.repeat(80));
  console.log(`Total startups processed: ${processedCount}`);
  console.log(`Startups with psychological signals: ${signalsFoundCount} (${(signalsFoundCount/processedCount*100).toFixed(1)}%)`);
  console.log();
  console.log('PHASE 1 Signals (FOMO, Conviction, Urgency, Risk):');
  console.log(`  🚀 Oversubscribed rounds: ${signalBreakdown.oversubscribed}`);
  console.log(`  💎 Follow-on investments: ${signalBreakdown.followon}`);
  console.log(`  ⚔️  Competitive rounds: ${signalBreakdown.competitive}`);
  console.log(`  ⚠️  Bridge rounds: ${signalBreakdown.bridge}`);
  console.log();
  console.log('PHASE 2 Signals (Social proof, Founder context, Sector):');
  console.log(`  🌊 Social proof cascades: ${signalBreakdown.socialProof || 0}`);
  console.log(`  🔁 Repeat founders: ${signalBreakdown.repeatFounder || 0}`);
  console.log(`  📊 Sector pivots: ${signalBreakdown.sectorPivot || 0}`);
  console.log(`  🚪 Cofounder exits: ${signalBreakdown.cofounderExit || 0}`);
  console.log();
  console.log('✅ Backfill complete!');
  console.log();
  console.log('💡 NEXT STEPS:');
  console.log('─'.repeat(80));
  console.log('1. Run: npx tsx scripts/recalculate-scores.ts');
  console.log('   (This will apply psychological multipliers to GOD scores)');
  console.log('2. Verify enhanced scores:');
  console.log('   SELECT name, total_god_score, enhanced_god_score, psychological_multiplier');
  console.log('   FROM startup_uploads');
  console.log('   WHERE enhanced_god_score > total_god_score');
  console.log('   ORDER BY enhanced_god_score DESC LIMIT 10;');
  console.log();
  
})();
