/**
 * Startup Resolver Service
 * Finds or creates a startup from a URL
 * 
 * NOW USES PYTH INFERENCE ENGINE for real GOD scoring!
 */

import { supabase } from './supabase';
import { normalizeUrl, NormalizedUrl } from '../utils/normalizeUrl';

export type ResolvedStartup = {
  id: string;
  name: string | null;
  website: string | null;
  tagline?: string | null;
  sectors?: string[] | null;
  stage?: number | null;
  total_god_score?: number | null;
  status: string;
  signals?: string[]; // Detected signals from inference engine
};

export type ResolveResult = {
  startup: ResolvedStartup;
  confidence: 'exact_domain' | 'linkedin_match' | 'crunchbase_match' | 'contains_domain' | 'created_provisional';
};

export type ResolveOptions = {
  /** If true, waits for enrichment before returning (slower but has real GOD score) */
  waitForEnrichment?: boolean;
};

/**
 * Resolve a URL to a startup record
 * If not found, creates a provisional record
 * @param input - URL to resolve
 * @param options - { waitForEnrichment: true } to get real GOD score immediately
 */
export async function resolveStartupFromUrl(input: string, options: ResolveOptions = {}): Promise<ResolveResult | null> {
  console.log('[startupResolver] START - Input:', input, 'Options:', options);
  
  const n = normalizeUrl(input);
  if (!n) {
    console.error('[startupResolver] Could not normalize URL:', input);
    return null;
  }
  console.log('[startupResolver] Normalized URL:', n);

  // 1) LinkedIn company URL match
  if (n.kind === 'linkedin' && n.linkedinSlug) {
    const { data: row } = await supabase
      .from('startup_uploads')
      .select('id, name, website, tagline, sectors, stage, total_god_score, status')
      .ilike('linkedin_url', `%${n.linkedinSlug}%`)
      .limit(1)
      .maybeSingle();
    
    if (row) {
      return { startup: row as ResolvedStartup, confidence: 'linkedin_match' };
    }
  }

  // 2) Crunchbase URL match
  if (n.kind === 'crunchbase' && n.crunchbaseSlug) {
    const { data: row } = await supabase
      .from('startup_uploads')
      .select('id, name, website, tagline, sectors, stage, total_god_score, status')
      .ilike('crunchbase_url', `%${n.crunchbaseSlug}%`)
      .limit(1)
      .maybeSingle();
    
    if (row) {
      return { startup: row as ResolvedStartup, confidence: 'crunchbase_match' };
    }
  }

  // 3) FAST: Normalized domain match (single indexed query)
  console.log('[startupResolver] Step 3: Checking normalized domain:', n.domain);
  const { data: domainMatch, error: domainError } = await supabase
    .from('startup_uploads')
    .select('id, name, website, tagline, sectors, stage, total_god_score, status')
    .eq('domain', n.domain)
    .limit(1)
    .maybeSingle();

  console.log('[startupResolver] Domain match result:', domainMatch, 'Error:', domainError);
  if (domainMatch) {
    return { startup: domainMatch as ResolvedStartup, confidence: 'exact_domain' };
  }

  // 4) FALLBACK: Legacy website URL matching (for backfill period)
  console.log('[startupResolver] Step 4: Trying legacy website matching for:', n.domain);
  const { data: legacyMatch, error: legacyError } = await supabase
    .from('startup_uploads')
    .select('id, name, website, tagline, sectors, stage, total_god_score, status')
    .or(`website.eq.https://${n.domain},website.eq.http://${n.domain},website.ilike.%${n.domain}%`)
    .limit(1)
    .maybeSingle();

  console.log('[startupResolver] Legacy match result:', legacyMatch, 'Error:', legacyError);
  if (legacyMatch) {
    return { startup: legacyMatch as ResolvedStartup, confidence: 'contains_domain' };
  }

  // 5) Prepare startup data
  const companyName = n.domain.split('.')[0];
  const formattedName = companyName.charAt(0).toUpperCase() + companyName.slice(1);
  const websiteUrl = `https://${n.domain}`;
  
  // Backend URL: 
  // - In production (Vercel): Use /api/startup/enrich-url serverless function
  // - In development: Use localhost:3002 Express server
  // In production on Fly.io, frontend and backend are served from the same origin
  const isProduction = typeof window !== 'undefined' && !window.location.hostname.includes('localhost');
  const backendUrl = import.meta.env.VITE_API_URL || (isProduction ? '' : 'http://localhost:3002');

  // 6) If waitForEnrichment: run inference FIRST, then create with real GOD score
  if (options.waitForEnrichment) {
    console.log('[startupResolver] Running inference engine FIRST for:', websiteUrl);
    console.log('[startupResolver] Backend URL:', backendUrl);
    
    let godScore = 45; // fallback
    let sectors: string[] = ['Technology'];
    let enrichData: any = null;
    let detectedSignals: string[] = [];
    
    try {
      const enrichRes = await fetch(`${backendUrl}/api/startup/enrich-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: websiteUrl }) // No startupId - just get the score
      });
      
      if (enrichRes.ok) {
        enrichData = await enrichRes.json();
        godScore = enrichData.godScore;
        if (enrichData.inference?.sectors?.length > 0) {
          sectors = enrichData.inference.sectors;
        }
        
        // Collect detected signals for display
        if (enrichData.inference?.has_revenue) detectedSignals.push('💰 Has Revenue');
        if (enrichData.inference?.has_customers) detectedSignals.push('👥 Has Customers');
        if (enrichData.inference?.is_launched) detectedSignals.push('🚀 Product Launched');
        if (enrichData.inference?.has_demo) detectedSignals.push('🎬 Live Demo');
        if (enrichData.inference?.has_technical_cofounder) detectedSignals.push('👨‍💻 Technical Cofounder');
        if (enrichData.inference?.funding_amount) detectedSignals.push(`💵 Raised $${(enrichData.inference.funding_amount / 1000000).toFixed(1)}M`);
        if (enrichData.inference?.team_signals?.length > 0) {
          enrichData.inference.team_signals.slice(0, 2).forEach((s: string) => detectedSignals.push(`⭐ ${s}`));
        }
        
        console.log('[startupResolver] ✅ Inference complete:', godScore, '(Tier', enrichData.tier, ') Signals:', detectedSignals);
      }
    } catch (enrichErr: any) {
      console.error('[startupResolver] Inference failed, using fallback:', enrichErr.message);
    }
    
    // NOW create startup with the REAL GOD score
    const { data: created, error } = await supabase
      .from('startup_uploads')
      .insert({
        name: formattedName,
        website: websiteUrl,
        tagline: `Startup at ${n.domain}`,
        sectors: sectors,
        stage: 1,
        status: 'approved',
        source_type: 'url',
        total_god_score: godScore, // REAL score from inference engine
        created_at: new Date().toISOString(),
      })
      .select('id, name, website, tagline, sectors, stage, total_god_score, status')
      .single();

    if (error) {
      console.error('Failed to create startup:', error);
      return null;
    }

    console.log('[startupResolver] Created startup with GOD score:', created.total_god_score);
    
    // IMMEDIATELY trigger match generation (don't wait for queue processor)
    console.log('[startupResolver] Triggering INSTANT match generation for:', created.id);
    fetch(`${backendUrl}/api/matches/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startupId: created.id, priority: 'immediate' })
    }).catch(err => console.error('[startupResolver] Match generation failed:', err.message));
    
    // Return with detected signals
    const startupWithSignals = {
      ...created,
      signals: detectedSignals.length > 0 ? detectedSignals : undefined
    };
    return { startup: startupWithSignals as ResolvedStartup, confidence: 'created_provisional' };
  }

  // 7) Fire-and-forget mode: create with temp score, enrich async
  const { data: created, error } = await supabase
    .from('startup_uploads')
    .insert({
      name: formattedName,
      website: websiteUrl,
      tagline: `Startup at ${n.domain}`,
      sectors: ['Technology'],
      stage: 1,
      status: 'approved',
      source_type: 'url',
      total_god_score: 45, // Temp score - async enrichment will update
      created_at: new Date().toISOString(),
    })
    .select('id, name, website, tagline, sectors, stage, total_god_score, status')
    .single();

  if (error) {
    console.error('Failed to create provisional startup:', error);
    return null;
  }

  // Trigger async enrichment (fire and forget)
  console.log('[startupResolver] Triggering async enrichment for:', created.id);
  fetch(`${backendUrl}/api/startup/enrich-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: websiteUrl, startupId: created.id })
  }).then(async (enrichRes) => {
    if (enrichRes.ok) {
      const enrichData = await enrichRes.json();
      console.log('[startupResolver] ✅ Async enrichment complete:', enrichData.godScore);
    }
  }).catch(err => console.error('[startupResolver] Async enrichment failed:', err.message));

  // IMMEDIATELY trigger match generation (don't wait for queue processor)
  console.log('[startupResolver] Triggering INSTANT match generation for:', created.id);
  fetch(`${backendUrl}/api/matches/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ startupId: created.id, priority: 'immediate' })
  }).catch(err => console.error('[startupResolver] Match generation failed:', err.message));

  return { startup: created as ResolvedStartup, confidence: 'created_provisional' };
}
