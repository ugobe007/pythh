/* Integration Guide: Using entityExtractor in RSS Pipeline */

/**
 * INTEGRATION PATTERN
 * ===================
 * 
 * Replace your current extractName(title) or NER calls with this canonical extractor.
 * This gives you:
 * - Deterministic extraction (no ML black box)
 * - Full debug evidence (reasons, candidates, rejected)
 * - Confidence scores for Phase-Change integrity
 * - Proof substrate for Pythia signal validation
 */

// Example integration in scripts/core/simple-rss-scraper.js

import { extractEntityFromTitle } from '../../src/services/rss/entityExtractor';

// Replace old extractCompanyName(title) with:
async function processRSSItem(item, sourceName) {
  const { entity, confidence, reasons, candidates, rejected } = extractEntityFromTitle(item.title);

  // Gate on confidence threshold
  if (!entity) {
    logger.info({
      title: item.title,
      confidence,
      reasons,
      topCandidates: candidates.slice(0, 5),
      rejected: rejected.slice(0, 5),
      source: sourceName
    }, 'entity_extract_failed');
    return null; // Skip this item
  }

  // Entity extracted successfully
  logger.info({
    title: item.title,
    entity,
    confidence,
    reasons,
    source: sourceName
  }, 'entity_extracted');

  return {
    name: entity,
    title: item.title,
    link: item.link,
    source_url: sourceName,
    
    // CRITICAL: Store extraction metadata for proof layer
    extraction_confidence: confidence,
    extraction_reasons: reasons,
    extraction_candidates: candidates, // optional: full debug trail
    
    // ... rest of your fields (sectors, description, etc.)
  };
}

/**
 * DATABASE SCHEMA ADDITIONS (Recommended)
 * ========================================
 * 
 * Add these columns to discovered_startups table:
 */

/*
ALTER TABLE discovered_startups 
ADD COLUMN IF NOT EXISTS extraction_confidence DECIMAL(3,2),
ADD COLUMN IF NOT EXISTS extraction_reasons TEXT[],
ADD COLUMN IF NOT EXISTS extraction_metadata JSONB;

-- Index for querying low-confidence extractions
CREATE INDEX IF NOT EXISTS idx_discovered_startups_confidence 
ON discovered_startups(extraction_confidence);

-- Query to audit extraction quality:
SELECT name, title, extraction_confidence, extraction_reasons
FROM discovered_startups
WHERE extraction_confidence < 0.70
ORDER BY created_at DESC
LIMIT 50;
*/

/**
 * TUNING THE EXTRACTOR
 * =====================
 * 
 * 1. Adjust confidence threshold:
 *    extractEntityFromTitle(title, 0.65) // Lower threshold for more recall
 *    extractEntityFromTitle(title, 0.75) // Higher threshold for more precision
 * 
 * 2. Add brands to BRAND_DICTIONARY in entityExtractor.ts:
 *    - Query your top 500 startups from startup_uploads
 *    - Add YC companies, unicorns, recent funding announcements
 * 
 * 3. Monitor rejection reasons:
 *    SELECT extraction_reasons, COUNT(*) 
 *    FROM discovered_startups 
 *    WHERE extraction_confidence < 0.60
 *    GROUP BY extraction_reasons
 *    ORDER BY COUNT(*) DESC;
 * 
 * 4. Handle edge cases:
 *    - "Google invests in Flipkart" → Now extracts Flipkart (target preference)
 *    - "Ola Electric" → Add to BRAND_DICTIONARY if false reject
 *    - Geographic terms (India, Europe) → Add to STOP_FRAGMENTS if needed
 */

/**
 * MONITORING EXTRACTION QUALITY
 * ==============================
 * 
 * Key metrics to track:
 */

// Query: Extraction success rate by source
/*
SELECT 
  source_url,
  COUNT(*) as total_items,
  COUNT(CASE WHEN extraction_confidence >= 0.62 THEN 1 END) as successful,
  AVG(extraction_confidence) as avg_confidence
FROM discovered_startups
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY source_url
ORDER BY avg_confidence DESC;
*/

// Query: Most common rejection reasons
/*
SELECT 
  jsonb_array_elements_text(extraction_reasons::jsonb) as reason,
  COUNT(*) as count
FROM discovered_startups
WHERE extraction_confidence < 0.62
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY reason
ORDER BY count DESC;
*/

// Query: Low-confidence entities that got approved (false positives)
/*
SELECT name, title, extraction_confidence, extraction_reasons, status
FROM discovered_startups
WHERE extraction_confidence < 0.70
  AND status = 'approved'
ORDER BY extraction_confidence ASC
LIMIT 50;
*/

/**
 * SYSTEM GUARDIAN INTEGRATION
 * ============================
 * 
 * Add extraction quality check to system-guardian.js:
 */

/*
async function checkExtractionQuality() {
  const issues = [];
  let status = 'OK';
  
  // Check: Are we extracting too many low-confidence entities?
  const { data: lowConfidence } = await supabase
    .from('discovered_startups')
    .select('id', { count: 'exact', head: true })
    .lt('extraction_confidence', 0.60)
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
  
  const { data: total } = await supabase
    .from('discovered_startups')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
  
  const lowConfidencePct = (lowConfidence?.length || 0) / (total?.length || 1);
  
  if (lowConfidencePct > 0.30) {
    status = 'WARN';
    issues.push(`High low-confidence rate: ${(lowConfidencePct * 100).toFixed(1)}%`);
  }
  
  // Check: Are we rejecting everything? (extractor too strict)
  const { data: recentItems } = await supabase.rpc('count_recent_rss_items');
  const extractionRate = (total?.length || 0) / (recentItems || 1);
  
  if (extractionRate < 0.20) {
    status = 'WARN';
    issues.push(`Low extraction rate: ${(extractionRate * 100).toFixed(1)}%`);
  }
  
  return { name: 'Extraction Quality', status, issues };
}
*/

export {};
