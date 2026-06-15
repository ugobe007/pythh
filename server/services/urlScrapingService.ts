/**
 * URL SCRAPING SERVICE
 * ====================
 * 
 * Scrapes a startup website and extracts structured data for GOD scoring.
 * This is the missing piece that makes the URL submission bar actually work.
 * 
 * Pipeline: URL → Scrape Website → AI Extract → Enrich → GOD Score
 */

import axios from 'axios';
import OpenAI from 'openai';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

// CJS module — keep resolution aligned with discoverySubmit / DB normalize_url()
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { normalizeUrl } = require('../lib/urlNormalize.js') as { normalizeUrl: (s: string) => string };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { reconcileSectors, resolveStartupSectors } = require('../../lib/inference-extractor.js') as {
  reconcileSectors: (sectors: string[] | undefined, url?: string, name?: string, text?: string) => string[];
  resolveStartupSectors: (opts?: {
    url?: string;
    name?: string;
    text?: string;
    inferenceSectors?: string[];
    aiSectors?: string[];
    storedSectors?: string[];
  }) => string[];
};

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
/** Server-side must use service role — anon + RLS hides rows and breaks URL dedupe (false inserts → name_unique). */
const supabaseKey =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  '';
const openaiApiKey = process.env.OPENAI_API_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);
const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

export interface ScrapedStartupData {
  // Basic info
  name: string;
  tagline?: string;
  description?: string;
  pitch?: string;
  
  // 5-point card data
  problem?: string;
  solution?: string;
  value_proposition?: string;
  market?: string;
  team?: string;
  traction?: string;
  
  // Structured data for GOD scoring
  sectors?: string[];
  stage?: number;
  
  // Traction metrics (for Tier A scoring)
  mrr?: number;
  arr?: number;
  revenue?: number;
  customer_count?: number;
  active_users?: number;
  growth_rate?: number;
  
  // Team signals
  founders_count?: number;
  has_technical_cofounder?: boolean;
  team_companies?: string[];
  
  // Product signals
  is_launched?: boolean;
  has_demo?: boolean;
  has_pricing?: boolean;
  
  // Funding
  funding_amount?: string;
  funding_stage?: string;
  investors?: string[];
}

/**
 * Fetch and extract text content from a website URL
 */
async function fetchWebsiteContent(url: string): Promise<string | null> {
  try {
    console.log(`🌐 Fetching ${url}...`);
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      timeout: 15000,
      maxRedirects: 5,
    });

    const html = response.data;
    
    // Strip scripts, styles, and HTML tags to get text
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, ' ')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, ' ')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();

    // Limit to reasonable size for AI processing
    return textContent.substring(0, 8000);
  } catch (error: any) {
    console.error(`❌ Failed to fetch ${url}:`, error.message);
    return null;
  }
}

/**
 * Use AI to extract structured startup data from website content
 */
async function extractStartupData(companyName: string, websiteContent: string, websiteUrl: string): Promise<ScrapedStartupData> {
  if (!openai) {
    console.warn('⚠️  No OpenAI API key - returning minimal data');
    return { name: companyName };
  }

  const prompt = `You are a SKEPTICAL VC analyst evaluating startup claims from their website.

COMPANY: ${companyName}
WEBSITE: ${websiteUrl}

WEBSITE CONTENT:
${websiteContent}

TASK: Extract startup data, but BE SKEPTICAL of marketing claims.

⚠️  CRITICAL RULES FOR TRACTION METRICS:
1. ONLY report metrics that have SPECIFIC, VERIFIABLE numbers
2. Marketing phrases like "1000+ users", "trusted by hundreds" = NULL (not real data)
3. Round numbers (100, 500, 1000, 5000, 10000) are likely marketing fluff = NULL
4. If no explicit "$X MRR" or "$X ARR" number, report mrr/arr as NULL
5. "Customers include [logos]" does NOT equal a customer count
6. Growth claims without numbers = NULL
7. When in doubt, report NULL - we have a separate inference engine for qualitative signals

SECTOR CLASSIFICATION (critical):
- Only assign sectors supported by explicit website evidence
- If the page is a JavaScript SPA with almost no visible text, infer from COMPANY NAME and DOMAIN only
- Names/domains containing robot, robotics, automation, or drone → Robotics (NOT HealthTech by default)
- Do NOT assign HealthTech unless the site explicitly mentions healthcare, medical, clinical, patients, hospitals, or pharma
- Never guess HealthTech from "robots" alone — surgical/medical robotics requires explicit health context on the page

Return a JSON object with these fields:

{
  "name": "Company name (string)",
  "tagline": "One-line description (max 15 words)",
  "description": "Full description (2-3 sentences)",
  "pitch": "Elevator pitch for investors (1-2 sentences)",
  
  "problem": "What problem they solve (1 sentence)",
  "solution": "How they solve it (1 sentence)",
  "value_proposition": "Unique value prop (1 sentence)",
  "market": "Target market/customers (1 sentence)",
  "team": "Founder backgrounds if mentioned (1 sentence)",
  "traction": "Growth claims verbatim from site - DO NOT interpret (1 sentence or null)",
  
  "sectors": ["Array of industry sectors"],
  "stage": "1=Pre-seed, 2=Seed, 3=Series A, 4=Series B+ (number or null)",
  
  "mrr": "ONLY if explicit '$X MRR' stated (number in USD or null)",
  "arr": "ONLY if explicit '$X ARR' stated (number in USD or null)",
  "revenue": "ONLY if specific revenue number stated (number in USD or null)",
  "customer_count": "ONLY if SPECIFIC count stated, NOT marketing claims like '1000+' (number or null)",
  "active_users": "ONLY if SPECIFIC count stated (number or null)",
  "growth_rate": "ONLY if SPECIFIC percentage stated (number or null)",
  
  "founders_count": "Number of founders if stated (number or null)",
  "has_technical_cofounder": "Has CTO/technical co-founder explicitly mentioned (boolean or null)",
  "team_companies": ["ONLY if 'ex-Google', 'former Meta' etc explicitly stated"],
  
  "is_launched": "Product appears live/available (boolean)",
  "has_demo": "Demo/trial explicitly offered (boolean)",
  "has_pricing": "Pricing page exists (boolean)",
  
  "funding_amount": "ONLY if specific amount stated like 'raised $5M' (string or null)",
  "funding_stage": "ONLY if explicitly stated like 'Seed', 'Series A' (string or null)",
  "investors": ["ONLY investor names explicitly mentioned"]
}

EXAMPLES OF WHAT TO REJECT (report as null):
- "1000+ happy customers" → customer_count: null (marketing fluff)
- "Used by top companies" → customer_count: null (no specific number)
- "Rapid growth" → growth_rate: null (no specific percentage)
- "Trusted by 500 teams" → customer_count: null (round marketing number)
- "$10M+ processed" → mrr: null (not MRR/ARR)

EXAMPLES OF WHAT TO ACCEPT:
- "We have 847 paying customers" → customer_count: 847 (specific, odd number)
- "$52K MRR as of January 2026" → mrr: 52000 (explicit MRR claim)
- "Growing 23% month-over-month" → growth_rate: 23 (specific percentage)
- "Raised $2.5M Seed from Sequoia" → funding_amount: "$2.5M", funding_stage: "Seed", investors: ["Sequoia"]

Return ONLY valid JSON, no markdown.

JSON:`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a VC analyst extracting startup data for investment scoring. Return only valid JSON.',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 2000,
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { name: companyName };
    }

    // Parse JSON response
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      // Try to extract JSON from code blocks
      const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1]);
      } else {
        const objectMatch = content.match(/\{[\s\S]*\}/);
        if (objectMatch) {
          parsed = JSON.parse(objectMatch[0]);
        } else {
          console.error('❌ Could not parse AI response');
          return { name: companyName };
        }
      }
    }

    // Clean and return
    return {
      name: parsed.name || companyName,
      tagline: parsed.tagline || undefined,
      description: parsed.description || undefined,
      pitch: parsed.pitch || undefined,
      problem: parsed.problem || undefined,
      solution: parsed.solution || undefined,
      value_proposition: parsed.value_proposition || undefined,
      market: parsed.market || undefined,
      team: parsed.team || undefined,
      traction: parsed.traction || undefined,
      sectors: Array.isArray(parsed.sectors) ? parsed.sectors : undefined,
      stage: typeof parsed.stage === 'number' ? parsed.stage : undefined,
      mrr: typeof parsed.mrr === 'number' ? parsed.mrr : undefined,
      arr: typeof parsed.arr === 'number' ? parsed.arr : undefined,
      revenue: typeof parsed.revenue === 'number' ? parsed.revenue : undefined,
      customer_count: typeof parsed.customer_count === 'number' ? parsed.customer_count : undefined,
      active_users: typeof parsed.active_users === 'number' ? parsed.active_users : undefined,
      growth_rate: typeof parsed.growth_rate === 'number' ? parsed.growth_rate : undefined,
      founders_count: typeof parsed.founders_count === 'number' ? parsed.founders_count : undefined,
      has_technical_cofounder: typeof parsed.has_technical_cofounder === 'boolean' ? parsed.has_technical_cofounder : undefined,
      team_companies: Array.isArray(parsed.team_companies) ? parsed.team_companies : undefined,
      is_launched: typeof parsed.is_launched === 'boolean' ? parsed.is_launched : undefined,
      has_demo: typeof parsed.has_demo === 'boolean' ? parsed.has_demo : undefined,
      has_pricing: typeof parsed.has_pricing === 'boolean' ? parsed.has_pricing : undefined,
      funding_amount: parsed.funding_amount || undefined,
      funding_stage: parsed.funding_stage || undefined,
      investors: Array.isArray(parsed.investors) ? parsed.investors : undefined,
    };
  } catch (error) {
    console.error('❌ AI extraction failed:', error);
    return { name: companyName };
  }
}

/**
 * ============================================================================
 * ⛔ REMOVED: FAKE GOD SCORING (Jan 31, 2026)
 * ============================================================================
 * 
 * This service previously had its own calculateGodScore() function that:
 *   - Bypassed the official GOD scoring system (startupScoringService.ts)
 *   - Gave inflated scores (98-100 just for having a nice website)
 *   - Corrupted the database with fake scores
 * 
 * FIX: This service now ONLY extracts and stores enriched data.
 * The official GOD scoring system (recalculate-scores.ts) handles all scoring.
 * 
 * To recalculate scores after enrichment:
 *   npx tsx scripts/recalculate-scores.ts
 * ============================================================================
 */

/**
 * Determine data tier based on available information
 * This is for INFORMATIONAL PURPOSES ONLY - does not affect scoring
 */
function determineDataTier(data: ScrapedStartupData): 'A' | 'B' | 'C' {
  const hasRichData = !!(data.mrr || data.arr || data.revenue || data.customer_count || data.active_users);
  const hasSomeData = !!(data.description || data.pitch || data.problem || data.solution);
  return hasRichData ? 'A' : (hasSomeData ? 'B' : 'C');
}

/**
 * MAIN FUNCTION: Scrape URL and return enriched startup data
 * NOTE: Does NOT calculate GOD scores - use recalculate-scores.ts for that
 */
export async function scrapeAndScoreStartup(url: string): Promise<{
  data: ScrapedStartupData;
  dataTier: 'A' | 'B' | 'C';
  websiteContent: string | null;
}> {
  // 1. Extract domain name for company name
  let domain: string;
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    domain = u.hostname.replace('www.', '');
  } catch {
    domain = url.split('/')[0].replace('www.', '');
  }
  const companyName = domain.split('.')[0];
  const formattedName = companyName.charAt(0).toUpperCase() + companyName.slice(1);

  // 2. Fetch website content
  const fullUrl = url.startsWith('http') ? url : `https://${url}`;
  const websiteContent = await fetchWebsiteContent(fullUrl);

  if (!websiteContent) {
    console.log(`⚠️  Could not fetch ${url} - using minimal data`);
    const minimalData: ScrapedStartupData = { name: formattedName };
    const dataTier = determineDataTier(minimalData);
    return { data: minimalData, dataTier, websiteContent: null };
  }

  // 3. Extract structured data with AI
  console.log(`🤖 Extracting data for ${formattedName}...`);
  let data = await extractStartupData(formattedName, websiteContent, fullUrl);
  data = {
    ...data,
    sectors: resolveStartupSectors({
      url: fullUrl,
      name: data.name || formattedName,
      text: websiteContent,
      aiSectors: data.sectors,
    }),
  };

  // 4. Determine data tier (informational only)
  const dataTier = determineDataTier(data);
  
  console.log(`✅ ${data.name}: Enriched (Tier ${dataTier}) - run recalculate-scores.ts to update GOD score`);
  
  return { data, dataTier, websiteContent };
}

/**
 * Update startup record with scraped data ONLY (no scores)
 * GOD scores must be calculated by the official scoring system
 */
export async function updateStartupWithScrapedData(
  startupId: string,
  data: ScrapedStartupData,
  dataTier: 'A' | 'B' | 'C',
  opts?: { omitName?: boolean }
): Promise<boolean> {
  try {
    const patch: Record<string, unknown> = {
      tagline: data.tagline || null,
      description: data.description || data.pitch || null,
      pitch: data.pitch || null,
      // Note: problem, solution, value_proposition, team_companies columns don't exist in schema
      // Store in extracted_data JSONB instead
      sectors: data.sectors?.length ? data.sectors : ['SaaS', 'Technology'],
      stage: data.stage || 1,
      is_launched: data.is_launched || false,
      has_demo: data.has_demo || false,
      has_technical_cofounder: data.has_technical_cofounder || false,
      team_size: data.founders_count || null,
      mrr: data.mrr || null,
      arr: data.arr || null,
      customer_count: data.customer_count || null,
      growth_rate_monthly: data.growth_rate || null,
      // ⛔ DO NOT SET GOD SCORES HERE - use recalculate-scores.ts
      // Store ALL extracted data in JSONB (including problem, solution, etc.)
      extracted_data: {
        ...data,
        data_tier: dataTier,
        scraped_at: new Date().toISOString(),
      },
    };
    if (!opts?.omitName) {
      patch.name = data.name;
    }

    const { error } = await supabase.from('startup_uploads').update(patch).eq('id', startupId);

    if (error) {
      console.error(`❌ Failed to update startup ${startupId}:`, error);
      return false;
    }

    console.log(`✅ Updated startup ${startupId} with enriched data (Tier ${dataTier}) - run recalculate-scores.ts to update GOD score`);
    return true;
  } catch (error) {
    console.error('❌ Update error:', error);
    return false;
  }
}

/**
 * Resolve startup row for URL / domain (aligned with discoverySubmit 2b–2d).
 * Convenience: scrape URL and create/update startup in one call.
 * NOTE: GOD scores are NOT set here - run recalculate-scores.ts after enrichment
 */
async function resolveStartupIdByWebsite(url: string, domain: string): Promise<string | undefined> {
  const websiteBare = `https://${domain}`;
  const websiteWww = `https://www.${domain}`;
  const httpBare = `http://${domain}`;
  const httpWww = `http://www.${domain}`;
  const variants = [
    websiteBare,
    websiteWww,
    `${websiteBare}/`,
    `${websiteWww}/`,
    httpBare,
    httpWww,
    `${httpBare}/`,
    `${httpWww}/`,
  ];
  for (const w of variants) {
    const { data: rows, error: wErr } = await supabase.from('startup_uploads').select('id').eq('website', w).limit(1);
    if (wErr) continue;
    if (rows?.[0]?.id) return rows[0].id;
  }

  const tryUrls = [
    url,
    url.startsWith('http') ? url : `https://${url}`,
    websiteBare,
    websiteWww,
    httpBare,
  ];
  for (const u of tryUrls) {
    const { data: rpcData, error: rpcErr } = await supabase.rpc('resolve_startup_by_url', { p_url: u });
    if (!rpcErr && rpcData) {
      const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
      if (row && typeof row === 'object' && 'startup_id' in row && (row as { startup_id?: string }).startup_id) {
        return (row as { startup_id: string }).startup_id;
      }
    }
  }

  const hostNorm = normalizeUrl(url.startsWith('http') ? url : `https://${url}`);

  for (const d of [hostNorm, `www.${hostNorm}`]) {
    const { data: cd, error: cdErr } = await supabase
      .from('startup_uploads')
      .select('id')
      .eq('company_domain', d)
      .limit(1);
    if (!cdErr && cd?.[0]?.id) return cd[0].id;
  }

  const { data: looseRows } = await supabase
    .from('startup_uploads')
    .select('id, website')
    .ilike('website', `%${domain}%`)
    .order('updated_at', { ascending: false })
    .limit(500);
  const hit = (looseRows || []).find((r) => r.website && normalizeUrl(r.website) === hostNorm);
  if (hit?.id) return hit.id;

  return undefined;
}

export async function processUrlSubmission(url: string): Promise<{
  success: boolean;
  startupId?: string;
  dataTier?: 'A' | 'B' | 'C';
  error?: string;
}> {
  try {
    // 1. Scrape and extract data (no scoring)
    const { data, dataTier } = await scrapeAndScoreStartup(url);
    
    // 2. Resolve existing row (must match discoverySubmit — avoid insert name_unique / website_unique)
    const domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace('www.', '');
    const websiteBare = `https://${domain}`;

    const existingId = await resolveStartupIdByWebsite(url, domain);

    let startupId: string;

    if (existingId) {
      startupId = existingId;
      // omitName: scraped titles often equal another startup’s canonical name (e.g. “Stripe”)
      await updateStartupWithScrapedData(startupId, data, dataTier, { omitName: true });
    } else {
      // Create new — never use scraped display name as DB `name` (global name_unique; collides e.g. "Stripe").
      const discName = `disc-${randomUUID()}`;
      const baseInsert = {
        name: discName,
        website: websiteBare,
        tagline: data.tagline || (data.name ? `${data.name} — ${domain}` : `Startup at ${domain}`),
        description: data.description || data.pitch,
        pitch: data.pitch,
        sectors: data.sectors?.length ? data.sectors : ['SaaS', 'Technology'],
        stage: data.stage || 1,
        status: 'approved',
        source_type: 'url',
        is_launched: data.is_launched || false,
        has_demo: data.has_demo || false,
        has_technical_cofounder: data.has_technical_cofounder || false,
        team_size: data.founders_count,
        mrr: data.mrr,
        arr: data.arr,
        customer_count: data.customer_count,
        growth_rate_monthly: data.growth_rate,
        // ⛔ PLACEHOLDER SCORE - must run recalculate-scores.ts
        total_god_score: 50,
        team_score: 10,
        traction_score: 10,
        market_score: 10,
        product_score: 10,
        vision_score: 10,
        extracted_data: {
          ...data,
          data_tier: dataTier,
          scraped_at: new Date().toISOString(),
        },
      };

      let created = await supabase.from('startup_uploads').insert(baseInsert).select('id').single();
      const dupInsert =
        created.error?.code === '23505' ||
        String(created.error?.message || '').toLowerCase().includes('duplicate key');
      if (created.error && dupInsert) {
        const raced = await resolveStartupIdByWebsite(url, domain);
        if (raced) {
          startupId = raced;
          await updateStartupWithScrapedData(startupId, data, dataTier, { omitName: true });
          return { success: true, startupId, dataTier };
        }
        const retry = await supabase
          .from('startup_uploads')
          .insert({
            ...baseInsert,
            name: `disc-${randomUUID()}`,
            website: websiteBare,
          })
          .select('id')
          .single();
        created = retry;
      }

      if (created.error) {
        const isDup =
          created.error?.code === '23505' ||
          String(created.error.message || '').toLowerCase().includes('duplicate key');
        if (isDup) {
          const raced = await resolveStartupIdByWebsite(url, domain);
          if (raced) {
            startupId = raced;
            await updateStartupWithScrapedData(startupId, data, dataTier, { omitName: true });
            return { success: true, startupId, dataTier };
          }
        }
        return { success: false, error: created.error.message };
      }
      startupId = created.data!.id;
    }

    return {
      success: true,
      startupId,
      dataTier,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
