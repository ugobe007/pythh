// POST /api/scan - Resolve/create startup and trigger matching
// This bridges the gap between URL submission and match generation

const express = require('express');
const router = express.Router();
const { getSupabaseClient } = require('../lib/supabaseClient');
function normalizeUrl(url) {
  let normalized = url.trim().toLowerCase();
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = 'https://' + normalized;
  }
  try {
    const urlObj = new URL(normalized);
    return urlObj.protocol + '//' + urlObj.hostname + urlObj.pathname.replace(/\/$/, '');
  } catch {
    return normalized;
  }
}

function extractDomain(url) {
  try {
    const normalized = normalizeUrl(url);
    const urlObj = new URL(normalized);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return url.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
  }
}

router.post('/scan', async (req, res) => {
  const { url } = req.body;
  
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const supabase = getSupabaseClient();
    const normalizedUrl = normalizeUrl(url);
    const domain = extractDomain(url);

    console.log('[API /scan] Processing URL:', url, '→', domain);

    // 1) Try to find existing startup
    const { data: candidates } = await supabase
      .from('startup_uploads')
      .select('id, website')
      .ilike('website', `%${domain}%`)
      .limit(10);

    const existing = (candidates || []).find(s => {
      try {
        const h = new URL(normalizeUrl(s.website || '')).hostname.replace(/^www\./, '');
        return h === domain;
      } catch {
        return false;
      }
    });

    if (existing) {
      console.log('[API /scan] Found existing startup:', existing.id);
      
      // Check if matches already exist
      const { count } = await supabase
        .from('startup_investor_matches')
        .select('*', { count: 'exact', head: true })
        .eq('startup_id', existing.id)
        .eq('status', 'suggested');
        
      console.log('[API /scan] Existing matches:', count);
      
      if (count && count > 0) {
        return res.json({ 
          startup_id: existing.id, 
          existed: true,
          match_count: count
        });
      }
      
      // Has startup but no matches - trigger generation
      console.log('[API /scan] Triggering match generation for existing startup...');
      
      // Call instant match API
      const matchRes = await fetch('http://localhost:3002/api/matches/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startupId: existing.id })
      });
      
      const matchResult = matchRes.ok ? await matchRes.json() : null;
      
      return res.json({ 
        startup_id: existing.id, 
        existed: true,
        match_count: matchResult?.matchCount || 0,
        matches_generated: true
      });
    }

    // 2) Create new startup
    const baseName = domain.split('.')[0];
    const pretty = baseName ? baseName.charAt(0).toUpperCase() + baseName.slice(1) : 'Startup';
    const uniqueName = `${pretty} (${domain})`;

    console.log('[API /scan] Creating new startup:', uniqueName);

    const { data: newStartup, error: insertError } = await supabase
      .from('startup_uploads')
      .insert({
        name: uniqueName,
        website: normalizedUrl,
        tagline: `Startup at ${domain}`,
        sectors: ['Technology'],
        stage: 1,
        status: 'approved',
        source_type: 'url',
        total_god_score: 65,
        created_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (insertError) {
      // Handle duplicate race condition
      if (insertError.code === '23505') {
        console.log('[API /scan] Race condition detected, re-fetching...');
        const { data: retry } = await supabase
          .from('startup_uploads')
          .select('id')
          .ilike('website', `%${domain}%`)
          .limit(1)
          .single();
          
        if (retry) {
          return res.json({ startup_id: retry.id, existed: false, race_resolved: true });
        }
      }
      
      console.error('[API /scan] Insert error:', insertError);
      return res.status(500).json({ error: insertError.message });
    }

    console.log('[API /scan] Created startup:', newStartup.id);

    // 3) Trigger instant match generation
    console.log('[API /scan] Triggering instant match generation...');
    
    try {
      const matchRes = await fetch('http://localhost:3002/api/matches/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startupId: newStartup.id })
      });
      
      if (matchRes.ok) {
        const matchResult = await matchRes.json();
        console.log('[API /scan] Matches generated:', matchResult.matchCount);
        
        return res.json({ 
          startup_id: newStartup.id, 
          existed: false,
          match_count: matchResult.matchCount,
          matches_generated: true
        });
      } else {
        console.warn('[API /scan] Match generation failed:', await matchRes.text());
        // Non-fatal - queue processor will handle it
        return res.json({ 
          startup_id: newStartup.id, 
          existed: false,
          match_count: 0,
          matches_queued: true
        });
      }
    } catch (matchError) {
      console.warn('[API /scan] Match generation error:', matchError);
      // Non-fatal - queue processor will handle it
      return res.json({ 
        startup_id: newStartup.id, 
        existed: false,
        match_count: 0,
        matches_queued: true
      });
    }

  } catch (error) {
    console.error('[API /scan] Error:', error);
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
