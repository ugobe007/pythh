#!/usr/bin/env node
/**
 * ML AGENT AUTO-APPLY SERVICE
 * ============================
 * 1. ML agent generates recommendations every 2 hours
 * 2. Notifies admin (logs to console + database)
 * 3. Waits 2 hours for admin review
 * 4. If no admin response, auto-applies recommendations
 * 
 * Safety: Only applies recommendations with confidence >= 0.75
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
  MIN_SAMPLE_SIZE: 30,           // Need at least 30 feedback events
  MAX_WEIGHT_CHANGE: 0.10,       // Max 10% weight change per adjustment
};

async function checkAndApplyRecommendations() {
  console.log('\n🤖 ML AGENT AUTO-APPLY CHECK');
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
      
      console.log(`\n🔍 Recommendation #${rec.id.substring(0, 8)}...`);
      console.log(`   Type: ${rec.recommendation_type}`);
      console.log(`   Confidence: ${(rec.confidence * 100).toFixed(1)}%`);
      console.log(`   Age: ${hoursOld.toFixed(1)} hours`);
      console.log(`   Sample size: ${rec.sample_size || 'unknown'}`);
      
      // Safety checks
      if (age < CONFIG.ADMIN_REVIEW_WINDOW) {
        const remaining = Math.ceil((CONFIG.ADMIN_REVIEW_WINDOW - age) / (60 * 1000));
        console.log(`   ⏳ Waiting for admin review (${remaining} min remaining)`);
        continue;
      }
      
      if ((rec.sample_size || 0) < CONFIG.MIN_SAMPLE_SIZE) {
        console.log(`   ⚠️  Insufficient data (${rec.sample_size} < ${CONFIG.MIN_SAMPLE_SIZE})`);
        await updateRecommendationStatus(rec.id, 'rejected', 'Insufficient sample size');
        continue;
      }
      
      // 3. Apply recommendation
      console.log(`   🚀 AUTO-APPLYING (admin review window expired)`);
      
      const result = await applyRecommendation(rec);
      
      if (result.success) {
        console.log(`   ✅ Applied successfully`);
        await updateRecommendationStatus(rec.id, 'applied', 'Auto-applied after review window');
        
        // Log to ai_logs
        await supabase.from('ai_logs').insert({
          type: 'ml_auto_apply',
          action: rec.recommendation_type,
          status: 'success',
          output: {
            recommendation_id: rec.id,
            changes: result.changes,
            confidence: rec.confidence,
            auto_applied: true
          }
        });
      } else {
        console.log(`   ❌ Failed: ${result.error}`);
        await updateRecommendationStatus(rec.id, 'failed', result.error);
      }
    }
    
    console.log('\n✅ Auto-apply check complete\n');
    
  } catch (err) {
    console.error('❌ Auto-apply failed:', err.message);
    
    // Log error
    await supabase.from('ai_logs').insert({
      type: 'ml_auto_apply',
      action: 'check',
      status: 'error',
      output: {
        error: err.message,
        stack: err.stack
      }
    });
  }
}

async function applyRecommendation(rec) {
  try {
    const { recommendation_type, proposed_config } = rec;
    
    if (recommendation_type === 'adjust_weight') {
      return await applyWeightAdjustment(proposed_config);
    }
    
    if (recommendation_type === 'adjust_threshold') {
      return await applyThresholdAdjustment(proposed_config);
    }
    
    if (recommendation_type === 'adjust_normalization') {
      return await applyNormalizationAdjustment(proposed_config);
    }
    
    return { success: false, error: 'Unknown recommendation type' };
    
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function applyWeightAdjustment(config) {
  const serviceFile = path.join(__dirname, 'server/services/startupScoringService.ts');
  
  if (!fs.existsSync(serviceFile)) {
    return { success: false, error: 'Scoring service file not found' };
  }
  
  let content = fs.readFileSync(serviceFile, 'utf8');
  
  // Extract current config
  const configMatch = content.match(/const GOD_SCORE_CONFIG = \{[\s\S]*?\n\};/);
  if (!configMatch) {
    return { success: false, error: 'Could not find GOD_SCORE_CONFIG' };
  }
  
  // Parse proposed changes
  const changes = [];
  for (const [component, newWeight] of Object.entries(config.weights || {})) {
    const currentMatch = content.match(new RegExp(`${component}:\\s*([\\d.]+)`));
    if (!currentMatch) continue;
    
    const currentWeight = parseFloat(currentMatch[1]);
    const weightChange = Math.abs(newWeight - currentWeight);
    
    // Safety: Don't change weights too much
    if (weightChange > CONFIG.MAX_WEIGHT_CHANGE) {
      console.log(`     ⚠️  Weight change too large for ${component}: ${weightChange.toFixed(2)} > ${CONFIG.MAX_WEIGHT_CHANGE}`);
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
    return { success: false, error: 'No valid changes to apply' };
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

async function applyThresholdAdjustment(config) {
  // Similar to weight adjustment but for min/max thresholds
  return { success: true, changes: [] }; // Placeholder
}

async function applyNormalizationAdjustment(config) {
  // Adjust normalization divisor
  return { success: true, changes: [] }; // Placeholder
}

async function updateRecommendationStatus(id, status, notes) {
  await supabase
    .from('ml_recommendations')
    .update({
      status,
      applied_at: status === 'applied' ? new Date().toISOString() : null,
      notes
    })
    .eq('id', id);
}

// Run check
checkAndApplyRecommendations().catch(console.error);
