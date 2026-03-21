/**
 * DECK UPLOAD — Pitch deck upload, scoring, and profile save
 * ==========================================================
 * POST /api/deck/upload
 * 
 * Body: multipart/form-data with:
 *   - deck: PDF file (max 10MB)
 *   - startup_id: UUID of the startup to attach the deck to
 * 
 * Flow: Upload PDF → Extract text → GOD score → Save to Supabase Storage → Update startup_uploads
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { extractInferenceData } = require('../../lib/inference-extractor');
const { calculateCompleteness } = require('../services/dataCompletenessService');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// GOD scoring (same as instantSubmit)
let calculateHotScore;
try {
  const scoring = require('../services/startupScoringService.ts');
  calculateHotScore = scoring.calculateHotScore;
} catch (e) {
  calculateHotScore = (profile) => ({
    total: 5.5,
    breakdown: { team_execution: 1, team_age: 1, market: 1, market_insight: 1, traction: 1, product: 1, product_vision: 1 }
  });
}

function toScoringProfile(startup) {
  const extracted = startup.extracted_data || {};
  const ts = startup.team_size ?? extracted.team_size;
  return {
    tagline: startup.tagline || extracted.tagline,
    pitch: startup.description || startup.pitch || extracted.pitch || extracted.description,
    problem: startup.problem || extracted.problem,
    solution: startup.solution || extracted.solution,
    industries: startup.industries || startup.sectors || extracted.industries || extracted.sectors || [],
    founders_count: extracted.founders_count || (ts && ts <= 10 ? ts : 1) || 1,
    team_size: ts || null,
    technical_cofounders: (extracted.has_technical_cofounder ? 1 : 0) || 0,
    mrr: startup.mrr || extracted.mrr,
    revenue: startup.arr || startup.revenue || extracted.revenue || extracted.arr,
    growth_rate_monthly: startup.growth_rate_monthly || extracted.growth_rate || null,
    customers: startup.customer_count || extracted.customers || extracted.customer_count,
    has_revenue: extracted.has_revenue,
    has_customers: extracted.has_customers,
    launched: startup.is_launched || extracted.is_launched || false,
    has_demo: startup.has_demo || extracted.has_demo || false,
    funding_amount: extracted.funding_amount,
    funding_stage: extracted.funding_stage,
    ...startup,
    ...extracted
  };
}

function calculateGODScore(startup) {
  const profile = toScoringProfile(startup);
  const result = calculateHotScore(profile);
  const total = Math.round(result.total * 10);
  const teamCombined = (result.breakdown.team_execution || 0) + (result.breakdown.team_age || 0);
  const marketCombined = (result.breakdown.market || 0) + (result.breakdown.market_insight || 0);
  return {
    team_score: Math.round((teamCombined / 3.5) * 100),
    traction_score: Math.round(((result.breakdown.traction || 0) / 3.0) * 100),
    market_score: Math.round((marketCombined / 2.0) * 100),
    product_score: Math.round(((result.breakdown.product || 0) / 1.3) * 100),
    vision_score: Math.round(((result.breakdown.product_vision || 0) / 1.3) * 100),
    total_god_score: total
  };
}

// Multer: memory storage for PDF (we'll upload to Supabase, then delete buffer)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

/**
 * POST /api/deck/upload
 */
router.post('/upload', upload.single('deck'), async (req, res) => {
  const startupId = req.body?.startup_id?.trim();
  const file = req.file;

  if (!startupId) {
    return res.status(400).json({ error: 'startup_id is required' });
  }
  if (!file) {
    return res.status(400).json({ error: 'No PDF file uploaded. Use field name "deck".' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  try {
    // 1. Verify startup exists
    const { data: startup, error: fetchErr } = await supabase
      .from('startup_uploads')
      .select('id, name, website, extracted_data, team_size')
      .eq('id', startupId)
      .single();

    if (fetchErr || !startup) {
      return res.status(404).json({ error: 'Startup not found', startup_id: startupId });
    }

    // 2. Extract text from PDF
    const pdfData = await pdfParse(file.buffer);
    const text = (pdfData.text || '').trim();
    if (text.length < 50) {
      return res.status(400).json({ error: 'PDF appears empty or could not extract enough text.' });
    }

    // 3. Run inference extractor on deck text (use startup website for name hint)
    const urlHint = startup.website || `https://${startup.name?.toLowerCase().replace(/\s+/g, '')}.com` || '';
    const inferenceData = extractInferenceData(text, urlHint) || {};
    const dataTier = inferenceData.confidence?.tier || 'C';

    // 4. Merge with existing extracted_data
    const existing = startup.extracted_data || {};
    const merged = {
      name: inferenceData.name || startup.name,
      tagline: inferenceData.tagline || existing.tagline,
      description: inferenceData.product_description || inferenceData.value_proposition || existing.description,
      pitch: inferenceData.pitch || inferenceData.value_proposition || existing.pitch,
      problem: inferenceData.problem,
      solution: inferenceData.solution,
      sectors: inferenceData.sectors?.length ? inferenceData.sectors : (existing.sectors || ['Technology']),
      stage: inferenceData.funding_stage ? (
        { 'pre-seed': 1, 'pre seed': 1, seed: 2, 'series a': 3, 'series b': 4 }[String(inferenceData.funding_stage).toLowerCase()] || 1
      ) : (existing.stage || 1),
      funding_amount: inferenceData.funding_amount,
      funding_stage: inferenceData.funding_stage,
      team_size: inferenceData.team_size || existing.team_size,
      has_technical_cofounder: inferenceData.has_technical_cofounder || existing.has_technical_cofounder,
      customer_count: inferenceData.customer_count || inferenceData.customers || existing.customer_count,
      mrr: inferenceData.mrr || existing.mrr,
      growth_rate: inferenceData.growth_rate || existing.growth_rate,
      is_launched: inferenceData.is_launched ?? existing.is_launched,
      has_demo: inferenceData.has_demo ?? existing.has_demo,
      extracted_data: {
        ...existing,
        ...inferenceData,
        data_tier: dataTier,
        deck_scored_at: new Date().toISOString(),
        source: 'deck_upload'
      }
    };

    // 5. Calculate GOD score
    const scores = calculateGODScore(merged);
    const completenessResult = calculateCompleteness(merged);

    // 6. Upload PDF to Supabase Storage
    const ext = path.extname(file.originalname) || '.pdf';
    const safeName = (file.originalname || 'deck').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 50);
    const storagePath = `decks/${startupId}/${Date.now()}-${safeName}${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from('decks')
      .upload(storagePath, file.buffer, {
        contentType: 'application/pdf',
        upsert: false
      });

    if (uploadErr) {
      console.error('[deck] Storage upload failed:', uploadErr);
      // Fallback: skip storage, still update scores (deck_url stays null)
    }

    // 7. Update startup_uploads
    const { error: updateErr } = await supabase
      .from('startup_uploads')
      .update({
        deck_filename: file.originalname || 'pitch_deck.pdf',
        deck_url: uploadErr ? null : storagePath,
        tagline: merged.tagline || null,
        description: merged.description || null,
        pitch: merged.pitch || null,
        sectors: merged.sectors,
        stage: merged.stage,
        extracted_data: merged.extracted_data,
        data_completeness: completenessResult.percentage,
        total_god_score: scores.total_god_score,
        team_score: scores.team_score,
        traction_score: scores.traction_score,
        market_score: scores.market_score,
        product_score: scores.product_score,
        vision_score: scores.vision_score,
        updated_at: new Date().toISOString()
      })
      .eq('id', startupId);

    if (updateErr) {
      console.error('[deck] DB update failed:', updateErr);
      return res.status(500).json({ error: 'Failed to save deck and scores', detail: updateErr.message });
    }

    // 8. Return signed URL for viewing (if stored)
    let deckViewUrl = null;
    if (!uploadErr) {
      const { data: signed } = await supabase.storage
        .from('decks')
        .createSignedUrl(storagePath, 60 * 60); // 1 hour
      deckViewUrl = signed?.signedUrl || null;
    }

    res.status(200).json({
      success: true,
      startup_id: startupId,
      total_god_score: scores.total_god_score,
      deck_filename: file.originalname,
      deck_url: uploadErr ? null : storagePath,
      deck_view_url: deckViewUrl,
      extracted: {
        name: merged.name,
        sectors: merged.sectors,
        stage: merged.stage,
        data_completeness: completenessResult.percentage
      }
    });
  } catch (err) {
    console.error('[deck] Error:', err);
    res.status(500).json({
      error: err.message || 'Deck processing failed',
      detail: err.stack
    });
  }
});

module.exports = router;
