/**
 * Startup Scrape & Enrich API Routes
 * 
 * Endpoints for scraping startup websites and enriching data:
 * - POST /api/startup/scrape - Scrape and enrich a startup URL
 * - POST /api/startup/fix - Fix extraction issues for existing startups
 * - GET /api/startup/issues - Get list of startups with data issues
 */

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const https = require('https');
const http = require('http');

const router = express.Router();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ====================================================================
// CONFIGURATION
// ====================================================================

const CONFIG = {
  USER_AGENT: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  REQUEST_TIMEOUT: 15000,
};

// ====================================================================
// HELPERS
// ====================================================================

async function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const req = protocol.get(url, {
      timeout: CONFIG.REQUEST_TIMEOUT,
      headers: {
        'User-Agent': CONFIG.USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchHtml(res.headers.location).then(resolve).catch(reject);
        return;
      }
      
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      
      let data = '';
      res.on('data', chunk => {
        data += chunk;
        if (data.length > 200000) { // Limit to 200KB
          res.destroy();
          resolve(data);
        }
      });
      res.on('end', () => resolve(data));
      res.on('error', reject);
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

function extractMetadata(html) {
  const metadata = {
    title: null,
    description: null,
    ogTitle: null,
    ogDescription: null,
    twitterDescription: null,
    keywords: [],
    canonical: null,
  };
  
  // Title
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) metadata.title = titleMatch[1].trim();
  
  // Meta description
  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
                    html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
  if (descMatch) metadata.description = descMatch[1].trim();
  
  // OG tags
  const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
  if (ogTitleMatch) metadata.ogTitle = ogTitleMatch[1].trim();
  
  const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
  if (ogDescMatch) metadata.ogDescription = ogDescMatch[1].trim();
  
  // Twitter
  const twitterDescMatch = html.match(/<meta[^>]*name=["']twitter:description["'][^>]*content=["']([^"']+)["']/i);
  if (twitterDescMatch) metadata.twitterDescription = twitterDescMatch[1].trim();
  
  // Keywords
  const keywordsMatch = html.match(/<meta[^>]*name=["']keywords["'][^>]*content=["']([^"']+)["']/i);
  if (keywordsMatch) {
    metadata.keywords = keywordsMatch[1].split(',').map(k => k.trim()).filter(k => k.length > 0);
  }
  
  // Canonical
  const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
  if (canonicalMatch) metadata.canonical = canonicalMatch[1].trim();
  
  return metadata;
}

function detectSectors(text) {
  if (!text) return ['Technology'];
  
  const sectors = [];
  const lowerText = text.toLowerCase();
  
  const sectorKeywords = {
    'AI/ML': ['artificial intelligence', ' ai ', 'machine learning', 'llm', 'deep learning', 'neural', 'nlp', 'computer vision', 'gpt', 'generative'],
    'FinTech': ['fintech', 'financial', 'banking', 'payments', 'lending', 'insurance', 'insurtech', 'crypto', 'blockchain', 'defi'],
    'HealthTech': ['healthtech', 'healthcare', 'medical', 'clinical', 'patient', 'diagnosis', 'therapeutic', 'telemedicine', 'telehealth'],
    'Biotech': ['biotech', 'biotechnology', 'pharmaceutical', 'drug', 'genomics', 'protein', 'gene', 'cell therapy'],
    'SaaS': ['saas', 'software as a service', 'b2b software', 'enterprise software', 'platform', 'api'],
    'Climate': ['climate', 'cleantech', 'sustainability', 'carbon', 'renewable', 'energy', 'solar', 'battery', 'ev ', 'electric vehicle'],
    'E-commerce': ['ecommerce', 'e-commerce', 'marketplace', 'retail', 'shopping', 'consumer'],
    'EdTech': ['edtech', 'education', 'learning', 'school', 'student', 'teaching', 'training'],
    'Cybersecurity': ['security', 'cybersecurity', 'encryption', 'privacy', 'authentication', 'identity'],
    'Hardware': ['hardware', 'device', 'sensor', 'robotics', 'iot', 'manufacturing', 'semiconductor'],
    'Developer Tools': ['developer', 'devops', 'infrastructure', 'cloud', 'ci/cd', 'testing', 'monitoring'],
    'Real Estate': ['real estate', 'proptech', 'property', 'housing', 'mortgage'],
    'HR Tech': ['hr ', 'human resources', 'recruiting', 'hiring', 'talent', 'workforce'],
    'Legal Tech': ['legal', 'law ', 'compliance', 'contract', 'regulatory'],
    'Food Tech': ['food', 'restaurant', 'delivery', 'agriculture', 'agtech'],
  };
  
  for (const [sector, keywords] of Object.entries(sectorKeywords)) {
    if (keywords.some(kw => lowerText.includes(kw))) {
      sectors.push(sector);
    }
  }
  
  return sectors.length > 0 ? sectors.slice(0, 4) : ['Technology'];
}

function extractCompanyName(metadata, domain) {
  // Try from OG title first (often most accurate)
  if (metadata.ogTitle) {
    // Remove common suffixes
    const cleaned = metadata.ogTitle
      .split('|')[0]
      .split('-')[0]
      .split('–')[0]
      .split(':')[0]
      .replace(/\s*(Inc|LLC|Ltd|Corp|Co)\.?\s*$/i, '')
      .trim();
    if (cleaned.length > 1 && cleaned.length < 50) return cleaned;
  }
  
  // Try from title
  if (metadata.title) {
    const cleaned = metadata.title
      .split('|')[0]
      .split('-')[0]
      .split('–')[0]
      .replace(/\s*(Inc|LLC|Ltd|Corp|Co)\.?\s*$/i, '')
      .trim();
    if (cleaned.length > 1 && cleaned.length < 50) return cleaned;
  }
  
  // Fallback to domain
  const domainName = domain.replace(/^www\./, '').split('.')[0];
  return domainName.charAt(0).toUpperCase() + domainName.slice(1);
}

// ====================================================================
// ROUTES
// ====================================================================

/**
 * POST /api/startup/scrape
 * Scrape a URL and create/update startup record
 * 
 * Body: { url: string }
 * Returns: { startup, scraped: { title, description, sectors } }
 */
router.post('/scrape', async (req, res) => {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }
  
  try {
    // Normalize URL
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http')) {
      normalizedUrl = `https://${normalizedUrl}`;
    }
    
    const urlObj = new URL(normalizedUrl);
    const domain = urlObj.hostname.replace(/^www\./, '');
    const websiteUrl = `https://${domain}`;
    
    console.log(`[scrape] Fetching: ${websiteUrl}`);
    
    // Fetch HTML
    const html = await fetchHtml(websiteUrl);
    
    // Extract metadata
    const metadata = extractMetadata(html);
    
    // Derive data
    const name = extractCompanyName(metadata, domain);
    const description = metadata.ogDescription || metadata.description || metadata.twitterDescription || `${name} - ${domain}`;
    const tagline = metadata.title ? metadata.title.split('|')[0].split('-')[0].trim() : null;
    const allText = `${name} ${description} ${tagline || ''} ${(metadata.keywords || []).join(' ')}`;
    const sectors = detectSectors(allText);
    
    console.log(`[scrape] Extracted: ${name}, sectors: ${sectors.join(', ')}`);
    
    // Check if startup exists
    const { data: existing } = await supabase
      .from('startup_uploads')
      .select('id, name, website')
      .or(`website.eq.${websiteUrl},website.ilike.%${domain}%`)
      .limit(1)
      .maybeSingle();
    
    if (existing) {
      // Update existing
      const { data: updated, error } = await supabase
        .from('startup_uploads')
        .update({
          description: description.slice(0, 1000),
          pitch: description.slice(0, 500),
          tagline: tagline?.slice(0, 200),
          sectors: sectors,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();
      
      if (error) {
        console.error('[scrape] Update error:', error);
        return res.status(500).json({ error: 'Failed to update startup', details: error.message });
      }
      
      return res.json({
        startup: updated,
        action: 'updated',
        scraped: { name, description, tagline, sectors, metadata }
      });
    }
    
    // Create new startup
    const { data: created, error } = await supabase
      .from('startup_uploads')
      .insert({
        name,
        website: websiteUrl,
        description: description.slice(0, 1000),
        pitch: description.slice(0, 500),
        tagline: tagline?.slice(0, 200),
        sectors,
        status: 'pending',
        source_type: 'url',
        total_god_score: 50, // Default, will be recalculated
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Startup already exists', details: error.message });
      }
      console.error('[scrape] Insert error:', error);
      return res.status(500).json({ error: 'Failed to create startup', details: error.message });
    }
    
    return res.json({
      startup: created,
      action: 'created',
      scraped: { name, description, tagline, sectors, metadata }
    });
    
  } catch (err) {
    console.error('[scrape] Error:', err);
    return res.status(500).json({ error: 'Failed to scrape URL', details: err.message });
  }
});

/**
 * POST /api/startup/fix
 * Fix extraction issues for an existing startup
 * 
 * Body: { startupId: string }
 * Returns: { startup, fixes: [...] }
 */
router.post('/fix', async (req, res) => {
  const { startupId } = req.body;
  
  if (!startupId) {
    return res.status(400).json({ error: 'startupId is required' });
  }
  
  try {
    // Get existing startup
    const { data: startup, error: fetchError } = await supabase
      .from('startup_uploads')
      .select('*')
      .eq('id', startupId)
      .single();
    
    if (fetchError || !startup) {
      return res.status(404).json({ error: 'Startup not found' });
    }
    
    const fixes = [];
    const updates = {};
    
    // Fix 1: Missing/malformed website
    if (startup.website) {
      let fixedUrl = startup.website;
      if (!fixedUrl.startsWith('http')) {
        fixedUrl = `https://${fixedUrl}`;
        updates.website = fixedUrl;
        fixes.push({ field: 'website', action: 'added_protocol', before: startup.website, after: fixedUrl });
      }
      
      // Try to scrape if missing description
      if (!startup.description || !startup.tagline) {
        try {
          const html = await fetchHtml(fixedUrl);
          const metadata = extractMetadata(html);
          
          if (!startup.description && (metadata.description || metadata.ogDescription)) {
            updates.description = (metadata.ogDescription || metadata.description).slice(0, 1000);
            fixes.push({ field: 'description', action: 'scraped', after: updates.description.slice(0, 100) + '...' });
          }
          
          if (!startup.tagline && metadata.title) {
            const tagline = metadata.title.split('|')[0].split('-')[0].trim();
            updates.tagline = tagline.slice(0, 200);
            fixes.push({ field: 'tagline', action: 'scraped', after: updates.tagline });
          }
          
          if (!startup.pitch && (metadata.description || metadata.ogDescription)) {
            updates.pitch = (metadata.ogDescription || metadata.description).slice(0, 500);
          }
        } catch (scrapeErr) {
          fixes.push({ field: 'scrape', action: 'failed', error: scrapeErr.message });
        }
      }
    }
    
    // Fix 2: Missing/generic sectors
    if (!startup.sectors || startup.sectors.length === 0 || 
        (startup.sectors.length === 1 && startup.sectors[0] === 'Technology')) {
      const text = `${startup.name} ${startup.description || ''} ${startup.pitch || ''} ${startup.tagline || ''}`;
      const sectors = detectSectors(text);
      
      if (sectors.length > 0 && (sectors.length > 1 || sectors[0] !== 'Technology')) {
        updates.sectors = sectors;
        fixes.push({ field: 'sectors', action: 'detected', before: startup.sectors, after: sectors });
      }
    }
    
    // Fix 3: Low/missing GOD score
    if (!startup.total_god_score || startup.total_god_score < 40) {
      updates.total_god_score = 50; // Default to 50, will be recalculated by scorer
      fixes.push({ field: 'total_god_score', action: 'reset', before: startup.total_god_score, after: 50 });
    }
    
    // Apply updates if any
    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString();
      
      const { data: updated, error: updateError } = await supabase
        .from('startup_uploads')
        .update(updates)
        .eq('id', startupId)
        .select()
        .single();
      
      if (updateError) {
        return res.status(500).json({ error: 'Failed to apply fixes', details: updateError.message });
      }
      
      return res.json({ startup: updated, fixes, applied: true });
    }
    
    return res.json({ startup, fixes, applied: false, message: 'No fixes needed' });
    
  } catch (err) {
    console.error('[fix] Error:', err);
    return res.status(500).json({ error: 'Failed to fix startup', details: err.message });
  }
});

/**
 * GET /api/startup/issues
 * Get list of startups with data issues
 * 
 * Query: ?limit=100&issue=missing_website|missing_description|missing_sectors|low_score
 * Returns: { issues: [...], counts: {...} }
 */
router.get('/issues', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '100', 10), 500);
  const issueType = req.query.issue || 'all';
  
  try {
    // Get counts first
    const { count: total } = await supabase.from('startup_uploads').select('*', { count: 'exact', head: true });
    
    const { count: missingWebsite } = await supabase
      .from('startup_uploads')
      .select('*', { count: 'exact', head: true })
      .or('website.is.null,website.eq.');
    
    const { count: missingDescription } = await supabase
      .from('startup_uploads')
      .select('*', { count: 'exact', head: true })
      .is('description', null);
    
    const { count: lowScore } = await supabase
      .from('startup_uploads')
      .select('*', { count: 'exact', head: true })
      .lt('total_god_score', 40);
    
    const counts = {
      total,
      missing_website: missingWebsite,
      missing_description: missingDescription,
      low_score: lowScore,
    };
    
    // Get specific issues
    let query = supabase
      .from('startup_uploads')
      .select('id, name, website, description, sectors, total_god_score, status, created_at')
      .limit(limit);
    
    switch (issueType) {
      case 'missing_website':
        query = query.or('website.is.null,website.eq.');
        break;
      case 'missing_description':
        query = query.is('description', null);
        break;
      case 'low_score':
        query = query.lt('total_god_score', 40);
        break;
      default:
        // Get all types
        query = query.or('website.is.null,description.is.null,total_god_score.lt.40');
    }
    
    const { data: issues, error } = await query.order('created_at', { ascending: false });
    
    if (error) {
      return res.status(500).json({ error: 'Failed to fetch issues', details: error.message });
    }
    
    return res.json({ issues, counts });
    
  } catch (err) {
    console.error('[issues] Error:', err);
    return res.status(500).json({ error: 'Failed to fetch issues', details: err.message });
  }
});

module.exports = router;
