import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client for server-side use
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

interface WeightUpdate {
  component: string;
  old_weight: number;
  new_weight: number;
  reason: string;
}

interface RecommendationApplication {
  recommendation_id: string;
  applied_at: string;
  applied_by: string;
  weight_updates: WeightUpdate[];
  performance_before: any;
  performance_after?: any;
}

/**
 * Service to apply ML recommendations to the GOD Algorithm
 */
export class RecommendationService {
  // Current GOD Algorithm weights (from startupScoringService.ts)
  private static DEFAULT_WEIGHTS = {
    team: 3.0,
    traction: 3.0,
    market: 2.0,
    product: 2.0,
    vision: 2.0,
    ecosystem: 1.5,
    grit: 1.5,
    problemValidation: 2.0
  };

  /**
   * Apply a recommendation to update GOD algorithm weights
   */
  static async applyRecommendation(recommendationId: string, userId: string = 'system') {
    try {
      // 1. Fetch the recommendation
      const { data: recommendation, error: fetchError } = await supabase
        .from('ml_recommendations')
        .select('*')
        .eq('id', recommendationId)
        .single();

      if (fetchError || !recommendation) {
        throw new Error('Recommendation not found');
      }

      if (recommendation.status === 'applied') {
        throw new Error('Recommendation already applied');
      }

      // 2. Parse the weight changes (column is recommended_weights, not proposed_value)
      const proposedWeights = recommendation.recommended_weights || recommendation.proposed_value;
      if (!proposedWeights) {
        throw new Error('Recommendation has no weights to apply (recommended_weights is empty)');
      }
      const weightUpdates: WeightUpdate[] = [];

      // 3. Get current performance metrics
      const performanceBefore = await this.getCurrentPerformance();

      // 4. Build weight update diff for history
      const currentWeights = recommendation.current_weights || this.DEFAULT_WEIGHTS;
      for (const [component, newWeight] of Object.entries(proposedWeights)) {
        const oldWeight = (currentWeights as any)[component] ??
          this.DEFAULT_WEIGHTS[component as keyof typeof this.DEFAULT_WEIGHTS];
        if (oldWeight !== undefined) {
          weightUpdates.push({
            component,
            old_weight: oldWeight as number,
            new_weight: newWeight as number,
            reason: recommendation.reasoning?.[0] || recommendation.description || 'ML recommendation'
          });
        }
      }

      // 5. Store the application record
      const application: RecommendationApplication = {
        recommendation_id: recommendationId,
        applied_at: new Date().toISOString(),
        applied_by: userId,
        weight_updates: weightUpdates,
        performance_before: performanceBefore
      };

      // 6. Update recommendation status
      const { error: updateError } = await supabase
        .from('ml_recommendations')
        .update({
          status: 'applied',
          applied_at: new Date().toISOString(),
          applied_by: userId
        })
        .eq('id', recommendationId);

      if (updateError) {
        throw new Error('Failed to update recommendation status');
      }

      // 7. Store weight history
      const { error: historyError } = await supabase
        .from('algorithm_weight_history')
        .insert({
          recommendation_id: recommendationId,
          weight_updates: weightUpdates,
          applied_by: userId,
          performance_before: performanceBefore
        });

      if (historyError) {
        console.warn('Failed to store weight history:', historyError);
      }

      // 8. Persist new weights to god_algorithm_config (if table exists)
      // Falls back to ml_recommendations status=applied as source of truth
      const { error: configTableCheck } = await supabase
        .from('god_algorithm_config')
        .select('id')
        .limit(1);

      if (!configTableCheck) {
        await supabase.from('god_algorithm_config').update({ is_active: false }).eq('is_active', true);
        const { error: configError } = await supabase
          .from('god_algorithm_config')
          .insert({
            component_weights: proposedWeights,
            is_active: true,
            applied_from_rec_id: recommendationId,
            applied_by: userId,
            description: `ML rec applied — ${(recommendation.confidence * 100).toFixed(0)}% confidence`
          });
        if (configError) {
          console.warn('[RecommendationService] god_algorithm_config write failed:', configError.message);
        }
      }

      console.log('[RecommendationService] ✅ Applied weights:', weightUpdates);

      return {
        success: true,
        application,
        new_weights: proposedWeights,
        weight_updates: weightUpdates,
        message: 'Recommendation applied — GOD algorithm weights updated in god_algorithm_config.'
      };

    } catch (error: any) {
      console.error('Error applying recommendation:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to apply recommendation'
      };
    }
  }

  /**
   * Get current algorithm performance metrics
   */
  private static async getCurrentPerformance() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Use correct table name: startup_investor_matches, not matches
    // Use status column for success tracking (funded/meeting_scheduled)
    const { data: matches, error } = await supabase
      .from('startup_investor_matches')
      .select('match_score, success_score, status')
      .gte('created_at', thirtyDaysAgo);

    if (error || !matches) {
      return {
        total_matches: 0,
        avg_match_score: 0,
        avg_god_score: 0,
        success_rate: 0
      };
    }

    const totalMatches = matches.length;
    // Use status column - 'funded' or 'meeting_scheduled' are successful
    const successfulMatches = matches.filter((m: any) => 
      m.status === 'funded' || m.status === 'meeting_scheduled'
    ).length;

    const avgMatchScore = matches.reduce((sum: number, m: any) => sum + (m.match_score || 0), 0) / totalMatches;
    const avgSuccessScore = matches.reduce((sum: number, m: any) => sum + (m.success_score || 0), 0) / totalMatches;

    return {
      total_matches: totalMatches,
      avg_match_score: avgMatchScore,
      avg_god_score: avgSuccessScore,
      success_rate: successfulMatches / totalMatches,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get weight history
   */
  static async getWeightHistory(limit: number = 10) {
    const { data, error } = await supabase
      .from('algorithm_weight_history')
      .select(`
        *,
        ml_recommendations (
          title,
          description,
          expected_impact
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching weight history:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Rollback a weight change
   */
  static async rollbackWeights(applicationId: string) {
    try {
      // 1. Get the application record
      const { data: history, error: fetchError } = await supabase
        .from('algorithm_weight_history')
        .select('*')
        .eq('id', applicationId)
        .single();

      if (fetchError || !history) {
        throw new Error('Application record not found');
      }

      // 2. Reverse the weight updates
      const rollbackUpdates = history.weight_updates.map((update: WeightUpdate) => ({
        component: update.component,
        old_weight: update.new_weight,
        new_weight: update.old_weight,
        reason: `Rollback of: ${update.reason}`
      }));

      // 3. Apply the rollback
      console.log('Rolling back weights:', rollbackUpdates);

      // 4. Mark as rolled back
      const { error: updateError } = await supabase
        .from('algorithm_weight_history')
        .update({ rolled_back: true, rolled_back_at: new Date().toISOString() })
        .eq('id', applicationId);

      if (updateError) {
        console.warn('Failed to mark as rolled back:', updateError);
      }

      return {
        success: true,
        rollback_updates: rollbackUpdates,
        message: 'Weights rolled back successfully'
      };

    } catch (error: any) {
      console.error('Error rolling back weights:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to rollback weights'
      };
    }
  }

  /**
   * Get current active weights — reads from god_algorithm_config (source of truth)
   * Falls back to most recently applied ml_recommendation, then hardcoded defaults.
   */
  static async getCurrentWeights() {
    // Primary: god_algorithm_config active row (if table exists)
    try {
      const { data: configs, error: tableErr } = await supabase
        .from('god_algorithm_config')
        .select('component_weights, normalization_divisor, base_boost_minimum, vibe_bonus_cap, created_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!tableErr && configs && configs.length > 0 && configs[0].component_weights) {
        return {
          ...this.DEFAULT_WEIGHTS,
          ...(configs[0].component_weights as object),
          normalization_divisor: configs[0].normalization_divisor,
          base_boost_minimum: configs[0].base_boost_minimum,
          vibe_bonus_cap: configs[0].vibe_bonus_cap,
        };
      }
    } catch (_) { /* table doesn't exist yet */ }

    // Fallback: most recent applied recommendation's recommended_weights
    const { data: recentRec } = await supabase
      .from('ml_recommendations')
      .select('recommended_weights')
      .eq('status', 'applied')
      .order('applied_at', { ascending: false })
      .limit(1);

    if (recentRec && recentRec.length > 0 && recentRec[0].recommended_weights) {
      return { ...this.DEFAULT_WEIGHTS, ...(recentRec[0].recommended_weights as object) };
    }

    return this.DEFAULT_WEIGHTS;
  }
}

export default RecommendationService;
