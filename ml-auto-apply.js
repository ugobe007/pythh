#!/usr/bin/env node
/**
 * ML AGENT AUTO-APPLY SERVICE v2
 * ===============================
 * 1. ML training (run-ml-training.js) generates recommendations every 2 hours
 *    → recommendation_type = 'component_weight_adjustment'
 *    → recommended_weights = { componentWeights, signalMaxPoints, ... }
 *    → sample_success_count / sample_fail_count (not sample_size)
 * 2. Waits ADMIN_REVIEW_WINDOW for admin review
 * 3. After window expires, auto-processes:
 *    - Informational recs (weights unchanged) → mark approved
 *    - Weight change recs → apply to scoring service file
 * 
 * DB status constraint: 'pending' | 'approved' | 'rejected' | 'expired'
 * DB update columns: reviewed_at, reviewed_by, rejection_reason
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const CONFIG = {
  MIN_CONFIDENCE: 0.75,          // Only auto-apply high-confidence recommendations
  ADMIN_REVIEW_WINDOW: 2 * 60 * 60 * 1000,  // 2 hours in ms
  MAX_WEIGHT_CHANGE: 0.10,       // Max 10% weight change per adjustment
};

async function checkAndApplyRecommendations() {
  console.log('\n🤖 ML AGENT AUTO-APPLY CHECK v2');
  console.log('═'.repeat(60));
  console.log(`⏰ ${new Date().toISOString()}\n`);
  
  try {
    // 1. Check for pending ML recommendations
    const { data: recommendations, error: recError } = await supabase
      .from('ml_recommendations')
      .select('*')
      .eq('status', 'pending')
      .gte('confidence', CONFIG.MIN_CONFIDENCE)
      .order('created_at', { ascending: true });
    
    if (recError) throw recError;
    
    if (!recommendations || recommendations.length === 0) {
      console.log('✅ No pending high-confidence recommendations\n');
      return;
    }
    
    console.log(`📊 Found ${recommendations.length} pending recommendations\n`);
    
    // 2. Check each recommendation for auto-apply eligibility
    for (const rec of recommendations) {
      const age = Date.now() - new Date(rec.created_at).getTime();
      const hoursOld = age / (60 * 60 * 1000);
      
      // Extract category from reasoning array: reasoning[0] = '[category]'
      const category = (rec.reasoning?.[0] || '').replace(/^\[|\]$/g, '') || 'unknown';
      
      console.log(`\n🔍 Recommendation #${rec.id.substring(0, 8)}...`);
      console.log(`   Type: ${rec.recommendation_type} [${category}]`);
      console.log(`   Confidence: ${(rec.confidence * 100).toFixed(1)}%`);
      console.log(`   Age: ${hoursOld.toFixed(1)} hours`);
      console.log(`   Manual approval: ${rec.requires_manual_approval}`);
      
      // Skip review window for non-manual-approval recs (e.g. training_summary)
      if (rec.requires_manual_approval !== false && age < CONFIG.ADMIN_REVIEW_WINDOW) {
        const remaining = Math.ceil((CONFIG.ADMIN_REVIEW_WINDOW - age) / (60 * 1000));
        console.log(`   ⏳ Waiting for admin review (${remaining} min remaining)`);
        continue;
      }
      
      // 3. Process recommendation
      console.log(`   🚀 PROCESSING (${rec.requires_manual_approval === false ? 'auto-approve eligible' : 'admin review window expired'})`);
      
      const result = await applyRecommendation(rec);
      
      if (result.success) {
        if (result.informational) {
          console.log(`   ✅ Acknowledged (informational — no weight changes)`);
        } else {
          console.log(`   ✅ Applied weight changes: ${result.changes.length} component(s)`);
        }
        await updateRecommendationStatus(rec.id, 'approved', 
          result.informational ? 'Auto-acknowledged (informational)' : 'Auto-applied weight changes');
        
        // Log to ai_logs
        await supabase.from('ai_logs').insert({
          operation: 'ml_auto_apply',
          model: 'auto-apply-v2',
          status: 'success',
          input_tokens: 0,
          output_tokens: 0,
          error_message: JSON.stringify({
            recommendation_id: rec.id,
            category,
            changes: result.changes || [],
            informational: result.informational || false,
            confidence: rec.confidence,
            auto_applied: true
          })
        });
      } else {
        console.log(`   ❌ Failed: ${result.error}`);
        await updateRecommendationStatus(rec.id, 'rejected', result.error);
      }
    }
    
    console.log('\n✅ Auto-apply check complete\n');
    
  } catch (err) {
    console.error('❌ Auto-apply failed:', err.message);
    
    // Log error
    await supabase.from('ai_logs').insert({
      operation: 'ml_auto_apply',
      model: 'auto-apply-v2',
      status: 'error',
      input_tokens: 0,
      output_tokens: 0,
      error_message: err.message
    }).catch(() => {});
  }
}

async function applyRecommendation(rec) {
  try {
    // Training script writes all recs as 'component_weight_adjustment'
    if (rec.recommendation_type !== 'component_weight_adjustment') {
      return { success: false, error: `Unknown recommendation type: ${rec.recommendation_type}` };
    }
    
    const currentWeights = rec.current_weights;
    const recommendedWeights = rec.recommended_weights;
    
    // Check if weights actually differ (informational vs actionable)
    const hasChanges = JSON.stringify(currentWeights) !== JSON.stringify(recommendedWeights);
    
    if (!hasChanges) {
      // Informational/health-check recommendation — just acknowledge
      return { success: true, changes: [], informational: true };
    }
    
    // Weights differ — apply component weight changes to scoring service
    const componentWeights = recommendedWeights?.componentWeights;
    if (!componentWeights) {
      return { success: false, error: 'No componentWeights in recommended_weights' };
    }
    
    return await applyWeightAdjustment(componentWeights);
    
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function applyWeightAdjustment(componentWeights) {
  const serviceFile = path.join(__dirname, 'server/services/startupScoringService.ts');
  
  if (!fs.existsSync(serviceFile)) {
    return { success: false, error: 'Scoring service file not found' };
  }
  
  let content = fs.readFileSync(serviceFile, 'utf8');
  
  // Extract current config (handles both `};` and `} as const;`)
  const configMatch = content.match(/const GOD_SCORE_CONFIG = \{[\s\S]*?\n\}(?:\s*as\s*const)?;/);
  if (!configMatch) {
    return { success: false, error: 'Could not find GOD_SCORE_CONFIG' };
  }
  
  // Parse proposed changes
  const changes = [];
  for (const [component, newWeight] of Object.entries(componentWeights)) {
    const currentMatch = content.match(new RegExp(`${component}:\\s*([\\d.]+)`));
    if (!currentMatch) continue;
    
    const currentWeight = parseFloat(currentMatch[1]);
    const weightChange = Math.abs(newWeight - currentWeight);
    
    if (weightChange < 0.001) continue; // Skip negligible changes
    
    // Safety: Don't change weights too much
    if (weightChange > CONFIG.MAX_WEIGHT_CHANGE) {
      console.log(`     ⚠️  Weight change too large for ${component}: ${weightChange.toFixed(3)} > ${CONFIG.MAX_WEIGHT_CHANGE}`);
      continue;
    }
    
    // Apply change
    content = content.replace(
      new RegExp(`(${component}:\\s*)[\\d.]+`),
      `$1${newWeight.toFixed(3)}`
    );
    
    changes.push({
      component,
      old: currentWeight,
      new: newWeight,
      change: newWeight - currentWeight
    });
  }
  
  if (changes.length === 0) {
    return { success: false, error: 'No valid weight changes to apply' };
  }
  
  // Write changes with backup
  const backupFile = `${serviceFile}.backup.${Date.now()}`;
  fs.copyFileSync(serviceFile, backupFile);
  fs.writeFileSync(serviceFile, content, 'utf8');
  
  console.log(`     💾 Backup saved: ${path.basename(backupFile)}`);
  
  return {
    success: true,
    changes,
    backup: backupFile
  };
}

async function updateRecommendationStatus(id, status, reason) {
  // DB CHECK constraint: status must be 'pending', 'approved', 'rejected', or 'expired'
  const validStatuses = ['pending', 'approved', 'rejected', 'expired'];
  if (!validStatuses.includes(status)) {
    console.warn(`     ⚠️  Invalid status '${status}', defaulting to 'rejected'`);
    status = 'rejected';
  }
  
  const { error } = await supabase
    .from('ml_recommendations')
    .update({
      status,
      reviewed_at: new Date().toISOString(),
      reviewed_by: 'ml-auto-apply-v2',
      rejection_reason: status === 'rejected' ? reason : null
    })
    .eq('id', id);
  
  if (error) {
    console.error(`     ⚠️  Failed to update status: ${error.message}`);
  }
}

// Run check
checkAndApplyRecommendations().catch(console.error);
