/**
 * EMERGENCY KILL SWITCH
 * Provides instant control over GOD scoring system in production
 * 
 * Environment Variables:
 *   GOD_SCORING_VERSION_OVERRIDE=1.0.0  - Force a specific weights version
 *   GOD_SCORING_FREEZE=true             - Stop all score recalculation jobs
 *   GOD_SCORING_DRY_RUN=true            - Score but don't persist to database
 * 
 * Usage:
 *   // In server/.env
 *   GOD_SCORING_FREEZE=true
 *   
 *   // Restart services
 *   pm2 restart all
 */

interface KillSwitchConfig {
  frozen: boolean;
  versionOverride: string | null;
  dryRun: boolean;
}

/**
 * Read kill switch configuration from environment
 */
export function getKillSwitchConfig(): KillSwitchConfig {
  return {
    frozen: process.env.GOD_SCORING_FREEZE === 'true',
    versionOverride: process.env.GOD_SCORING_VERSION_OVERRIDE || null,
    dryRun: process.env.GOD_SCORING_DRY_RUN === 'true'
  };
}

/**
 * Check if scoring operations are frozen
 * Throws error if frozen
 */
export function checkFrozen(): void {
  const config = getKillSwitchConfig();
  
  if (config.frozen) {
    throw new Error(
      'GOD scoring system is FROZEN. Set GOD_SCORING_FREEZE=false to re-enable. ' +
      'This is an emergency kill switch to prevent damage.'
    );
  }
}

/**
 * Get active weights version (with override support)
 */
export async function getActiveWeightsVersion(supabase: any): Promise<string> {
  const config = getKillSwitchConfig();
  
  // Check for version override
  if (config.versionOverride) {
    console.log(`⚠️  GOD_SCORING_VERSION_OVERRIDE active: forcing version ${config.versionOverride}`);
    
    // Validate override version exists
    const { data, error } = await supabase
      .from('god_score_weights_versions')
      .select('version')
      .eq('version', config.versionOverride)
      .single();
    
    if (error || !data) {
      throw new Error(
        `Version override ${config.versionOverride} does not exist in database`
      );
    }
    
    return config.versionOverride;
  }
  
  // Get active version from database
  const { data, error } = await supabase
    .from('god_score_weights_versions')
    .select('version')
    .eq('active', true)
    .single();
  
  if (error || !data) {
    throw new Error('No active GOD score weights version found in database');
  }
  
  return data.version;
}

/**
 * Persist score (respects dry-run mode)
 */
export async function persistScore(
  supabase: any,
  startupId: string,
  score: number,
  weightsVersion: string,
  explanation: any
): Promise<void> {
  const config = getKillSwitchConfig();
  
  if (config.dryRun) {
    console.log(`🔍 DRY RUN: Would update startup ${startupId} with score ${score} (version ${weightsVersion})`);
    console.log('   Explanation:', JSON.stringify(explanation, null, 2));
    return;
  }
  
  // Normal persist
  const { error } = await supabase
    .from('startup_uploads')
    .update({
      total_god_score: score,
      weights_version: weightsVersion,
      score_explanation: explanation
    })
    .eq('id', startupId);
  
  if (error) {
    throw new Error(`Failed to persist score for startup ${startupId}: ${error.message}`);
  }
}

/**
 * Log kill switch status on startup
 */
export function logKillSwitchStatus(): void {
  const config = getKillSwitchConfig();
  
  console.log('\n=== GOD SCORING KILL SWITCH STATUS ===');
  
  if (config.frozen) {
    console.log('🚨 FROZEN: Score recalculation is DISABLED');
  } else {
    console.log('✅ Active: Score recalculation is enabled');
  }
  
  if (config.versionOverride) {
    console.log(`⚠️  VERSION OVERRIDE: Forcing version ${config.versionOverride}`);
  } else {
    console.log('   Version: Using active version from database');
  }
  
  if (config.dryRun) {
    console.log('🔍 DRY RUN: Scores will be calculated but not persisted');
  } else {
    console.log('   Persistence: Enabled');
  }
  
  console.log('=====================================\n');
}

/**
 * Emergency rollback helper
 * Sets version override and freezes scoring
 */
export function emergencyRollback(version: string): void {
  console.log(`\n🚨 EMERGENCY ROLLBACK to version ${version}`);
  console.log('Setting environment variables...');
  console.log('  GOD_SCORING_VERSION_OVERRIDE=' + version);
  console.log('  GOD_SCORING_FREEZE=true');
  console.log('\nNext steps:');
  console.log('  1. Update server/.env with these values');
  console.log('  2. Run: pm2 restart all');
  console.log('  3. Verify system health');
  console.log('  4. When ready, unfreeze by setting GOD_SCORING_FREEZE=false\n');
}
