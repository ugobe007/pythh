/**
 * Founder Data Enrichment API
 * 
 * Allows startup founders to claim and enrich their profiles
 * Endpoint: POST /api/enrich/:token
 */

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const { calculateCompleteness } = require('../services/dataCompletenessService');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * GET /api/enrich/:token
 * Retrieve startup data for enrichment
 */
router.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;

    // Find startup by enrichment token
    const { data: startup, error } = await supabase
      .from('startup_uploads')
      .select('*')
      .eq('enrichment_token', token)
      .single();

    if (error || !startup) {
      return res.status(404).json({ 
        error: 'Invalid or expired enrichment link',
        code: 'INVALID_TOKEN'
      });
    }

    // Calculate completeness
    const completeness = calculateCompleteness(startup);

    // Return startup data + completeness info
    res.json({
      startup: {
        id: startup.id,
        name: startup.name,
        website: startup.website,
        sectors: startup.sectors,
        stage: startup.stage,
        total_god_score: startup.total_god_score,
        
        // Existing data
        description: startup.description,
        pitch: startup.pitch,
        problem: startup.problem,
        solution: startup.solution,
        team: startup.team,
        
        customer_count: startup.customer_count,
        mrr: startup.mrr,
        arr: startup.arr,
        growth_rate_monthly: startup.growth_rate_monthly,
        team_size: startup.team_size,
        is_launched: startup.is_launched,
        has_demo: startup.has_demo,
        has_technical_cofounder: startup.has_technical_cofounder,
        
        // From extracted_data
        funding_amount: startup.extracted_data?.funding_amount,
        founders: startup.extracted_data?.founders,
        valuation: startup.extracted_data?.valuation,
      },
      completeness,
      claimed: !!startup.claimed_by,
      claimed_by: startup.claimed_by ? startup.claimed_by.replace(/(.{2}).*(@.*)/, '$1***$2') : null, // Mask email
    });

  } catch (err) {
    console.error('[enrich] GET error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/enrich/:token
 * Submit enriched data
 */
router.post('/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const {
      email,
      name,
      enrichedData
    } = req.body;

    if (!email || !enrichedData) {
      return res.status(400).json({ error: 'Email and enriched data required' });
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    // Find startup
    const { data: startup, error: fetchError } = await supabase
      .from('startup_uploads')
      .select('*')
      .eq('enrichment_token', token)
      .single();

    if (fetchError || !startup) {
      return res.status(404).json({ error: 'Invalid enrichment link' });
    }

    // Log enrichment request
    const { data: request, error: logError } = await supabase
      .from('enrichment_requests')
      .insert({
        startup_id: startup.id,
        requester_email: email,
        requester_name: name,
        fields_provided: enrichedData,
        status: 'approved', // Auto-approve for MVP
      })
      .select()
      .single();

    if (logError) {
      console.error('[enrich] Failed to log request:', logError);
    }

    // Merge enriched data into startup
    const updates = {};
    const extractedDataUpdates = {};

    // Direct fields
    if (enrichedData.description) updates.description = enrichedData.description;
    if (enrichedData.pitch) updates.pitch = enrichedData.pitch;
    if (enrichedData.problem) updates.problem = enrichedData.problem;
    if (enrichedData.solution) updates.solution = enrichedData.solution;
    if (enrichedData.team) updates.team = enrichedData.team;
    
    if (enrichedData.customer_count !== undefined) updates.customer_count = enrichedData.customer_count;
    if (enrichedData.mrr !== undefined) updates.mrr = enrichedData.mrr;
    if (enrichedData.arr !== undefined) updates.arr = enrichedData.arr;
    if (enrichedData.growth_rate_monthly !== undefined) updates.growth_rate_monthly = enrichedData.growth_rate_monthly;
    if (enrichedData.team_size !== undefined) updates.team_size = enrichedData.team_size;
    if (enrichedData.is_launched !== undefined) updates.is_launched = enrichedData.is_launched;
    if (enrichedData.has_demo !== undefined) updates.has_demo = enrichedData.has_demo;
    if (enrichedData.has_technical_cofounder !== undefined) updates.has_technical_cofounder = enrichedData.has_technical_cofounder;

    // Extracted data fields
    if (enrichedData.funding_amount !== undefined) extractedDataUpdates.funding_amount = enrichedData.funding_amount;
    if (enrichedData.founders) extractedDataUpdates.founders = enrichedData.founders;
    if (enrichedData.valuation !== undefined) extractedDataUpdates.valuation = enrichedData.valuation;

    // Merge into extracted_data
    if (Object.keys(extractedDataUpdates).length > 0) {
      updates.extracted_data = {
        ...(startup.extracted_data || {}),
        ...extractedDataUpdates,
        manual_enrichment: true,
        enriched_at: new Date().toISOString(),
        enriched_by: email,
      };
    }

    // Mark as claimed
    if (!startup.claimed_by) {
      updates.claimed_by = email;
      updates.claimed_at = new Date().toISOString();
    }

    // Calculate new completeness
    const updatedStartup = { ...startup, ...updates };
    const newCompleteness = calculateCompleteness(updatedStartup);
    updates.data_completeness = newCompleteness.percentage;

    // Update database
    const { error: updateError } = await supabase
      .from('startup_uploads')
      .update(updates)
      .eq('id', startup.id);

    if (updateError) {
      console.error('[enrich] Update error:', updateError);
      return res.status(500).json({ error: 'Failed to update profile' });
    }

    // Trigger score recalculation (async, don't wait)
    setTimeout(async () => {
      try {
        // Import scoring service
        const { calculateHotScore, toScoringProfile } = require('../god-score-v6-clean');
        const profile = toScoringProfile(updatedStartup);
        const result = calculateHotScore(profile);
        const total = Math.round(result.total * 10);

        await supabase
          .from('startup_uploads')
          .update({
            total_god_score: total,
            team_score: Math.round(((result.breakdown.team_execution || 0) + (result.breakdown.team_age || 0)) / 3.5 * 100),
            traction_score: Math.round((result.breakdown.traction || 0) / 3.0 * 100),
            market_score: Math.round(((result.breakdown.market || 0) + (result.breakdown.market_insight || 0)) / 2.0 * 100),
            product_score: Math.round((result.breakdown.product || 0) / 1.3 * 100),
            vision_score: Math.round((result.breakdown.product_vision || 0) / 1.3 * 100),
          })
          .eq('id', startup.id);

        console.log(`[enrich] Recalculated score for ${startup.name}: ${startup.total_god_score} → ${total}`);
      } catch (scoreErr) {
        console.error('[enrich] Score recalculation failed:', scoreErr);
      }
    }, 100);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      old_score: startup.total_god_score,
      old_completeness: startup.data_completeness || 0,
      new_completeness: newCompleteness.percentage,
      projected_score: startup.total_god_score + newCompleteness.projectedImprovement,
      enriched_fields: Object.keys(updates).length - 2, // Subtract claimed_by and claimed_at
    });

  } catch (err) {
    console.error('[enrich] POST error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/enrich/status/:startupId
 * Check enrichment status for a startup (by ID, not token)
 */
router.get('/status/:startupId', async (req, res) => {
  try {
    const { startupId } = req.params;

    const { data: startup, error } = await supabase
      .from('startup_uploads')
      .select('data_completeness, total_god_score, claimed_by, enrichment_token')
      .eq('id', startupId)
      .single();

    if (error || !startup) {
      return res.status(404).json({ error: 'Startup not found' });
    }

    const completeness = startup.data_completeness || 0;

    res.json({
      completeness,
      god_score: startup.total_god_score,
      claimed: !!startup.claimed_by,
      needs_enrichment: completeness < 60,
      token: startup.enrichment_token, // Allow frontend to build link
    });

  } catch (err) {
    console.error('[enrich] Status error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
