#!/usr/bin/env node
/**
 * INTELLIGENT SCRAPER
 * Automatically scrapes and categorizes VCs, Angel Groups, Startups, and News
 * Uses Anthropic Claude to intelligently extract structured data from any webpage
 * Falls back to pattern-based extraction if AI fails
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const cheerio = require('cheerio');

// Fallback credentials if .env fails to load
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://unkpogyhhjbvxxjvmxlt.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVua3BvZ3loaGpidnh4anZteGx0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTE1OTAzNSwiZXhwIjoyMDc2NzM1MDM1fQ.MYfYe8wDL1MYac1NHq2WkjFH27-eFUDi3Xn1hD5rLFA';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

// Initialize Anthropic client if API key is available
let anthropic = null;
if (ANTHROPIC_API_KEY) {
  try {
    const { Anthropic } = require('@anthropic-ai/sdk');
    anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    console.log('✅ Anthropic Claude API initialized');
  } catch (error) {
    console.warn('⚠️  Failed to initialize Anthropic SDK:', error.message);
    console.warn('   Install with: npm install @anthropic-ai/sdk');
  }
} else {
  console.warn('⚠️  Missing ANTHROPIC_API_KEY - AI extraction will fail, but pattern-based extraction may still work');
}

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  db: { schema: 'public' },
  auth: { persistSession: false }
});

/**
 * Fetch with proper headers
 */
async function fetchPage(url) {
  const fetch = (await import('node-fetch')).default;
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    }
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  return response.text();
}

/**
 * Extract clean text from HTML
 */
function extractText(html) {
  const $ = cheerio.load(html);
  
  // Remove scripts, styles, and other noise
  $('script, style, nav, footer, header, aside, iframe, noscript').remove();
  
  // For team pages, try to preserve structure better
  const isTeamPage = /\/team|\/people|\/partners/i.test($('body').html() || '') || 
                     $('body').text().toLowerCase().includes('team') ||
                     $('body').text().toLowerCase().includes('partner');
  
  if (isTeamPage) {
    // Extract structured data from team pages
    const teamMembers = [];
    
    // Look for common team page structures
    $('.team-member, .person, .partner, [class*="team"], [class*="people"], [class*="partner"]').each((i, el) => {
      const $el = $(el);
      const name = $el.find('h1, h2, h3, h4, .name, [class*="name"]').first().text().trim();
      const title = $el.find('.title, .role, [class*="title"], [class*="role"]').first().text().trim();
      const bio = $el.text().trim();
      
      if (name && name.length > 2) {
        teamMembers.push(`${name}${title ? `, ${title}` : ''}${bio ? ` - ${bio.substring(0, 100)}` : ''}`);
      }
    });
    
    // Also extract from list items
    $('li, .person-card, .team-card').each((i, el) => {
      const $el = $(el);
      const text = $el.text().trim();
      // Look for name patterns
      const nameMatch = text.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/);
      if (nameMatch && text.length < 300) {
        teamMembers.push(text);
      }
    });
    
    if (teamMembers.length > 0) {
      return teamMembers.join('\n') + '\n\n' + $('body').text().substring(0, 10000);
    }
  }
  
  // Get main content
  const mainContent = $('main, article, .content, #content, .main, #main').text() || $('body').text();
  
  // Clean up whitespace
  return mainContent
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, '\n')
    .trim()
    .substring(0, 15000); // Limit to 15k chars for OpenAI
}

/**
 * Use Anthropic Claude to intelligently extract structured data
 */
async function extractDataWithAI(text, url, targetType = 'auto') {
  if (!anthropic) {
    throw new Error('Anthropic API not initialized - missing ANTHROPIC_API_KEY');
  }
  
  console.log('🧠 Analyzing content with Anthropic Claude...\n');
  
  const systemPrompt = `You are a data extraction expert specializing in venture capital, startups, and technology news.
Extract structured information from web content and return it in JSON format.

IMPORTANT: Return ONLY valid JSON, no markdown code blocks or explanations.`;

  // Detect if this is a team page
  const isTeamPage = /\/team|\/people|\/partners|\/about/i.test(url) || /team|people|partners/i.test(text.substring(0, 500));
  const firmNameFromUrl = url.match(/(?:www\.)?([a-z0-9-]+)\.(?:com|org|vc|capital|ventures|partners)/i)?.[1]?.replace(/-/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  const userPrompt = `Analyze this webpage and extract relevant entities.

URL: ${url}
Target Type: ${targetType === 'auto' ? 'Detect automatically' : targetType}
${isTeamPage ? '⚠️ THIS IS A TEAM PAGE - Extract ALL individual team members!' : ''}
${firmNameFromUrl ? `Firm name from URL: ${firmNameFromUrl}` : ''}

Extract:
1. INVESTORS (VCs, Angel Groups, Accelerators, Individual Partners)
   ${isTeamPage ? '   - For team pages: Extract EVERY individual name mentioned' : ''}
   ${isTeamPage ? '   - Format as: "Full Name (Firm Name)" or include firm in description' : ''}
   ${isTeamPage ? '   - Extract their titles/roles (Partner, Managing Partner, Principal, etc.)' : ''}
   - Name (official firm name OR individual name with firm context)
   - Type (VC Firm, Angel Network, Accelerator, Corporate VC, VC Partner)
   - Description (brief, under 200 chars - include role/title for team members)
   - Focus (sectors/stages if mentioned)
   - Twitter handle or twitter.com/x.com URL if visible on the page
   - LinkedIn URL if visible (linkedin.com/company/... or linkedin.com/in/...)
   - Crunchbase URL if visible (crunchbase.com/organization/...)

2. STARTUPS (Companies, Products)
   - Name
   - Description (brief, under 200 chars)
   - Industry/Category
   - URL if available

3. NEWS/INSIGHTS
   - Key themes or topics
   - Notable mentions
   - Investment news

Return JSON in this exact format:
{
  "investors": [
    {"name": "string", "type": "string", "description": "string", "focus": "string", "twitter": "string or null", "linkedin_url": "string or null", "crunchbase_url": "string or null"}
  ],
  "startups": [
    {"name": "string", "description": "string", "category": "string", "url": "string"}
  ],
  "news": {
    "themes": ["string"],
    "notable_mentions": ["string"]
  }
}

Rules:
${isTeamPage ? '- CRITICAL: Extract EVERY person name on team pages - don\'t skip anyone!' : ''}
${isTeamPage ? '- Associate each person with the firm name (from URL or page context)' : ''}
- Include ONLY entities clearly identified in the content
- Skip generic text, navigation, or advertisements
- Use official names (e.g., "Andreessen Horowitz" not "a16z")
- Return empty arrays if nothing found
- NO markdown formatting, NO code blocks, ONLY JSON
- Be aggressive in extraction - capture every investor/startup mentioned
${isTeamPage ? '- If firm name not in text, use: ' + (firmNameFromUrl || 'extract from URL or page context') : ''}

Content:
${text}`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-5-haiku-latest',
      max_tokens: 4000,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt
        }
      ]
    });
    
    const content = message.content[0]?.type === 'text' ? message.content[0].text.trim() : '';
    
    if (!content) {
      throw new Error('Empty response from Anthropic API');
    }
    
    // Parse JSON response
    let parsed;
    try {
      // Try direct parse first
      parsed = JSON.parse(content);
    } catch {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1]);
      } else {
        // Try to find JSON object
        const objectMatch = content.match(/\{[\s\S]*\}/);
        if (objectMatch) {
          parsed = JSON.parse(objectMatch[0]);
        } else {
          throw new Error('Could not parse Anthropic response as JSON');
        }
      }
    }
    
    return {
      investors: parsed.investors || [],
      startups: parsed.startups || [],
      news: parsed.news || { themes: [], notable_mentions: [] }
    };
    
  } catch (error) {
    console.error('❌ Anthropic extraction failed:', error.message);
    console.log('🔄 Falling back to pattern-based extraction...');
    
    // Fallback: Pattern-based extraction
    return extractDataWithPatterns(text, url, targetType);
  }
}

/**
 * Extract firm name from URL or page context
 */
function extractFirmNameFromContext(url, text) {
  // Try to extract from URL first
  const urlMatch = url.match(/(?:www\.)?([a-z0-9-]+)\.(?:com|org|vc|capital|ventures|partners)/i);
  if (urlMatch && urlMatch[1]) {
    const domain = urlMatch[1].replace(/-/g, ' ');
    // Capitalize first letter of each word
    return domain.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
  
  // Try to find firm name in page title or headings
  const titleMatch = text.match(/(?:team|about|people|partners?)\s+at\s+([A-Z][A-Za-z\s&\.]+(?:Capital|Ventures|Partners|Fund|Equity|Group|Holdings|Management)?)/i);
  if (titleMatch && titleMatch[1]) {
    return titleMatch[1].trim();
  }
  
  // Look for common VC firm patterns in text
  const firmPattern = /\b([A-Z][A-Za-z\s&\.]+(?:Capital|Ventures|Partners|Fund|Equity|Group|Holdings|Management))\b/;
  const firmMatch = text.match(firmPattern);
  if (firmMatch && firmMatch[1]) {
    return firmMatch[1].trim();
  }
  
  return null;
}

/**
 * Pattern-based extraction fallback (when OpenAI fails)
 */
function extractDataWithPatterns(text, url, targetType) {
  const investors = [];
  const startups = [];
  const seenInvestors = new Set();
  const seenStartups = new Set();
  
  // Extract firm name from context (for team pages)
  const firmName = extractFirmNameFromContext(url, text);
  
  // INVESTOR PATTERNS
  if (targetType === 'investors' || targetType === 'auto') {
    // Pattern 1: "led by X Capital/Ventures/Partners"
    const pattern1 = /(?:led by|from|backed by|with participation from|investors? include|investors? are|invested by)\s+([A-Z][A-Za-z\s&\.]+(?:Capital|Ventures|Partners|Fund|Equity|Group|Holdings|Management))/gi;
    
    // Pattern 2: "X Capital/Ventures/Partners led the round"
    const pattern2 = /([A-Z][A-Za-z\s&\.]+(?:Capital|Ventures|Partners|Fund|Equity|Group|Holdings|Management))\s+(?:led|co-led|participated in|invested in|backed)/gi;
    
    // Pattern 3: "X Capital" or "X Ventures" standalone (common on VC websites)
    const pattern3 = /\b([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)?\s+(?:Capital|Ventures|Partners|Fund|Equity|Group|Holdings|Management))\b/gi;
    
    // Pattern 4: Angel investors - "X, an angel investor" or "angel investor X"
    const pattern4 = /(?:angel\s+investor|angel)\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)?)|([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)?),?\s+(?:an\s+)?angel\s+investor/gi;
    
    // Pattern 5: Individual names on team pages - "John Smith" or "Jane Doe, Partner"
    // Look for name patterns followed by titles like Partner, Managing Partner, Principal, etc.
    const pattern5 = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\s*[,\.]?\s*(?:Partner|Managing Partner|General Partner|Principal|Associate|Venture Partner|Advisor|Founder|Co-founder|CEO|President)/gi;
    
    // Pattern 6: Names in structured formats (e.g., "Name: John Smith" or "John Smith - Partner")
    const pattern6 = /(?:name|partner|principal|associate)[:–-]\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/gi;
    
    const patterns = [pattern1, pattern2, pattern3, pattern4, pattern5, pattern6];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        let name = (match[1] || match[2] || match[0]).trim().replace(/\s+/g, ' ');
        
        // For individual names (pattern 5 & 6), combine with firm name if available
        if ((pattern === pattern5 || pattern === pattern6) && firmName) {
          // Add as individual investor with firm context
          const fullName = `${name} (${firmName})`;
          const lowerName = fullName.toLowerCase();
          if (seenInvestors.has(lowerName)) continue;
          seenInvestors.add(lowerName);
          
          investors.push({
            name: fullName,
            type: 'VC Partner',
            description: `Team member at ${firmName}. Discovered from: ${url}`.substring(0, 200),
            focus: ''
          });
          continue;
        }
        
        // Filter out common false positives
        if (name.length < 5 || name.length > 60) continue;
        if (/^(The|A|An|This|That|These|Those)\s/i.test(name)) continue;
        if (/^(Capital|Ventures|Partners|Fund)$/i.test(name)) continue;
        // Skip if it's just a first name
        if (!/\s/.test(name) && name.length < 10) continue;
        
        const lowerName = name.toLowerCase();
        if (seenInvestors.has(lowerName)) continue;
        seenInvestors.add(lowerName);
        
        // Determine type
        let type = 'VC Firm';
        if (/angel/i.test(text.substring(Math.max(0, match.index - 50), match.index + 50))) {
          type = 'Angel';
        } else if (/accelerator|incubator/i.test(text.substring(Math.max(0, match.index - 50), match.index + 50))) {
          type = 'Accelerator';
        } else if (/partner|principal|associate/i.test(text.substring(Math.max(0, match.index - 50), match.index + 50))) {
          type = 'VC Partner';
        }
        
        investors.push({
          name: name,
          type: type,
          description: `Discovered from: ${url}`.substring(0, 200),
          focus: ''
        });
      }
    }
    
    // If we found a firm name but no investors yet, add the firm itself
    if (firmName && investors.length === 0 && !seenInvestors.has(firmName.toLowerCase())) {
      investors.push({
        name: firmName,
        type: 'VC Firm',
        description: `Discovered from: ${url}`.substring(0, 200),
        focus: ''
      });
    }
  }
  
  // STARTUP PATTERNS (if needed)
  if (targetType === 'startups' || targetType === 'auto') {
    // Basic startup patterns
    const startupPattern = /\b([A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+){0,2})\s+(?:raises?|raised|secures?|secured|closes?|closed)\s+\$?([\d\.]+)\s*(million|M|billion|B)/gi;
    
    let match;
    while ((match = startupPattern.exec(text)) !== null) {
      const name = match[1].trim();
      if (name.length < 3 || name.length > 50) continue;
      
      const lowerName = name.toLowerCase();
      if (seenStartups.has(lowerName)) continue;
      seenStartups.add(lowerName);
      
      startups.push({
        name: name,
        description: `Raised ${match[2]} ${match[3]}`,
        category: '',
        url: ''
      });
    }
  }
  
  console.log(`📊 Pattern extraction: ${investors.length} investors, ${startups.length} startups found`);
  
  return {
    investors: investors,
    startups: startups,
    news: { themes: [], notable_mentions: [] }
  };
}

/**
 * Save investors to database
 */
async function saveInvestors(investors, sourceUrl) {
  if (!investors || investors.length === 0) return { added: 0, skipped: 0 };
  
  console.log(`\n💼 Saving ${investors.length} investors...\n`);
  
  let added = 0;
  let skipped = 0;
  
  for (const inv of investors) {
    if (!inv.name || inv.name.trim().length === 0) {
      console.log(`  ⏭️  Skipping empty name`);
      skipped++;
      continue;
    }

    // Check if exists (case-insensitive)
    const { data: existing } = await supabase
      .from('investors')
      .select('id')
      .ilike('name', inv.name.trim())
      .limit(1);
    
    if (existing && existing.length > 0) {
      // Backfill social handles if we scraped them and they're missing
      const newTwitter = inv.twitter || inv.twitter_handle || null;
      const newLinkedin = inv.linkedin_url || null;
      const newCrunchbase = inv.crunchbase_url || null;
      if (newTwitter || newLinkedin || newCrunchbase) {
        const { data: cur } = await supabase
          .from('investors')
          .select('twitter_handle, twitter_url, linkedin_url, crunchbase_url')
          .eq('id', existing[0].id)
          .single();
        const patch = {};
        if (newTwitter && !cur?.twitter_handle) patch.twitter_handle = newTwitter;
        if (newTwitter && newTwitter.includes('twitter.com') && !cur?.twitter_url) patch.twitter_url = newTwitter;
        if (newLinkedin && !cur?.linkedin_url) patch.linkedin_url = newLinkedin;
        if (newCrunchbase && !cur?.crunchbase_url) patch.crunchbase_url = newCrunchbase;
        if (Object.keys(patch).length > 0) {
          patch.socials_updated_at = new Date().toISOString();
          await supabase.from('investors').update(patch).eq('id', existing[0].id);
          console.log(`  🔗 ${inv.name} - Backfilled socials: ${Object.keys(patch).filter(k => k !== 'socials_updated_at').join(', ')}`);
        }
      }
      console.log(`  ⏭️  ${inv.name} - Already exists`);
      skipped++;
      continue;
    }
    
    // Direct insert to database
    const { error } = await supabase
      .from('investors')
      .insert({
        name: inv.name.trim(),
        firm: inv.firm || inv.name.trim(),
        bio: inv.description || inv.bio || '',
        investment_thesis: inv.focus || '',
        status: 'active',
        sectors: inv.sectors || [],
        stage: inv.stage || [],
        twitter_handle: inv.twitter || inv.twitter_handle || null,
        twitter_url: inv.twitter_url || (inv.twitter && inv.twitter.includes('twitter.com') ? inv.twitter : null) || null,
        linkedin_url: inv.linkedin_url || null,
        crunchbase_url: inv.crunchbase_url || null,
        socials_updated_at: (inv.twitter || inv.twitter_handle || inv.linkedin_url) ? new Date().toISOString() : null,
      });
    
    if (error) {
      console.log(`  ❌ ${inv.name} - ${error.message}`);
    } else {
      console.log(`  ✅ ${inv.name}`);
      added++;
    }
  }
  
  return { added, skipped };
}

/**
 * Save startups to discovered_startups
 * Uses unified save function for schema consistency
 * NOW WITH INFERENCE EXTRACTION - captures fields for GOD Score!
 */
const { saveDiscoveredStartup } = require('./utils/saveDiscoveredStartup');
const { extractInferenceData } = require('./lib/inference-extractor');

async function saveStartups(startups, sourceUrl, fullText = '') {
  if (!startups || startups.length === 0) return { added: 0, skipped: 0 };
  
  console.log(`\n🚀 Saving ${startups.length} startups with inference extraction...\n`);
  
  // Run inference extraction ONCE on the full text
  const inferenceData = extractInferenceData(fullText, sourceUrl) || {};
  
  // Log what inference found
  if (inferenceData.funding_amount || inferenceData.sectors?.length || inferenceData.team_signals?.length) {
    console.log('   🧠 Inference extracted:');
    if (inferenceData.funding_amount) console.log('      💰 Funding:', inferenceData.funding_amount);
    if (inferenceData.funding_stage) console.log('      📊 Stage:', inferenceData.funding_stage);
    if (inferenceData.sectors?.length) console.log('      🏢 Sectors:', inferenceData.sectors.join(', '));
    if (inferenceData.team_signals?.length) console.log('      👥 Team:', inferenceData.team_signals.join(', '));
    if (inferenceData.execution_signals?.length) console.log('      🚀 Execution:', inferenceData.execution_signals.join(', '));
    console.log('');
  }
  
  let added = 0;
  let skipped = 0;
  
  for (const startup of startups) {
    // Merge AI-extracted data with inference-extracted data
    const enrichedStartup = {
      name: startup.name,
      website: startup.url,
      description: startup.description,
      article_url: sourceUrl,
      rss_source: 'Intelligent Scraper',
      
      // Inference-extracted fields for GOD Score
      funding_amount: inferenceData.funding_amount || startup.funding_amount,
      funding_stage: inferenceData.funding_stage || startup.stage,
      investors_mentioned: inferenceData.investors_mentioned || [],
      sectors: inferenceData.sectors?.length > 0 ? inferenceData.sectors : (startup.category ? [startup.category] : []),
      lead_investor: inferenceData.lead_investor,
      
      // Team signals (for GRIT score)
      team_companies: inferenceData.credential_signals || [],
      has_technical_cofounder: inferenceData.has_technical_cofounder || false,
      team_signals: inferenceData.team_signals || [],
      grit_signals: inferenceData.grit_signals?.map(g => g.signal || g) || [],
      credential_signals: inferenceData.credential_signals || [],
      founders: inferenceData.founders || [],
      
      // Execution signals
      is_launched: inferenceData.is_launched || false,
      has_demo: inferenceData.has_demo || false,
      has_customers: inferenceData.has_customers || false,
      has_revenue: inferenceData.has_revenue || false,
      customer_count: inferenceData.customer_count,
      execution_signals: inferenceData.execution_signals || [],
      
      // Problem signals
      problem_severity: inferenceData.problem_severity_estimate,
      problem_keywords: inferenceData.problem_keywords || [],
    };
    
    const result = await saveDiscoveredStartup(enrichedStartup, { checkDuplicates: true, skipIfExists: true });
    
    if (result.success) {
      if (result.skipped) {
        console.log(`  ⏭️  ${startup.name} - Already exists`);
        skipped++;
      } else {
        console.log(`  ✅ ${startup.name}`);
        added++;
      }
    } else {
      console.log(`  ❌ ${startup.name} - ${result.error}`);
    }
  }
  
  return { added, skipped };
}

/**
 * Main scraping function
 */
async function scrape(url, targetType = 'auto') {
  console.log('═'.repeat(70));
  console.log('🔥 INTELLIGENT SCRAPER - pyth ai');
  console.log('═'.repeat(70));
  console.log(`\n🌐 Scraping: ${url}`);
  console.log(`🎯 Target: ${targetType}\n`);
  
  try {
    // Fetch page
    console.log('📄 Fetching page...');
    const html = await fetchPage(url);
    console.log('✅ Page loaded\n');
    
    // Extract text
    console.log('📝 Extracting content...');
    const text = extractText(html);
    console.log(`✅ Extracted ${text.length} characters\n`);
    
    // Extract data with AI (with fallback to patterns)
    let data;
    try {
      data = await extractDataWithAI(text, url, targetType);
    } catch (aiError) {
      console.error('❌ AI extraction error:', aiError.message);
      console.log('🔄 Using pattern-based extraction...');
      data = extractDataWithPatterns(text, url, targetType);
    }
    
    // Display results
    console.log('═'.repeat(70));
    console.log('📊 EXTRACTION RESULTS');
    console.log('═'.repeat(70));
    console.log(`\n💼 Investors found: ${data.investors.length}`);
    if (data.investors.length > 0) {
      console.log(`   Examples: ${data.investors.slice(0, 3).map(i => i.name).join(', ')}`);
    }
    console.log(`🚀 Startups found: ${data.startups.length}`);
    console.log(`📰 News themes: ${data.news.themes.length}`);
    
    if (data.news.themes.length > 0) {
      console.log(`\n📌 Key Themes:`);
      data.news.themes.forEach(theme => console.log(`   • ${theme}`));
    }
    
    // Save to database - pass full text for inference extraction
    const investorResults = await saveInvestors(data.investors, url);
    const startupResults = await saveStartups(data.startups, url, text);
    
    // Summary
    console.log('\n' + '═'.repeat(70));
    console.log('✨ SCRAPING COMPLETE');
    console.log('═'.repeat(70));
    console.log(`\n💼 Investors: ${investorResults.added} added, ${investorResults.skipped} skipped`);
    console.log(`🚀 Startups: ${startupResults.added} added, ${startupResults.skipped} skipped\n`);
    
    return {
      success: true,
      investors: investorResults,
      startups: startupResults,
      news: data.news
    };
    
  } catch (error) {
    console.error('\n❌ Scraping failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Batch scrape multiple URLs
 */
async function batchScrape(urls) {
  console.log(`\n🎯 Batch scraping ${urls.length} URLs...\n`);
  
  const results = [];
  
  for (let i = 0; i < urls.length; i++) {
    console.log(`\n[${ i + 1}/${urls.length}] Processing: ${urls[i]}`);
    const result = await scrape(urls[i]);
    results.push(result);
    
    // Wait between requests to avoid rate limiting
    if (i < urls.length - 1) {
      console.log('\n⏳ Waiting 3 seconds before next request...\n');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  // Overall summary
  const totalInvestorsAdded = results.reduce((sum, r) => sum + (r.investors?.added || 0), 0);
  const totalStartupsAdded = results.reduce((sum, r) => sum + (r.startups?.added || 0), 0);
  
  console.log('\n' + '═'.repeat(70));
  console.log('🎉 BATCH SCRAPING COMPLETE');
  console.log('═'.repeat(70));
  console.log(`\n✅ Processed: ${urls.length} URLs`);
  console.log(`💼 Total investors added: ${totalInvestorsAdded}`);
  console.log(`🚀 Total startups added: ${totalStartupsAdded}\n`);
}

/**
 * CLI
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
🔥 INTELLIGENT SCRAPER - pyth ai

Usage:
  node intelligent-scraper.js <url> [type]
  node intelligent-scraper.js --batch <url1> <url2> <url3>...

Arguments:
  url    - URL to scrape
  type   - Target type: auto|investors|startups|news (default: auto)
  --batch - Scrape multiple URLs

Examples:

  # Auto-detect content type
  node intelligent-scraper.js https://dealroom.net/blog/top-venture-capital-firms

  # Target specific content
  node intelligent-scraper.js https://techcrunch.com/startups startups

  # Batch scrape multiple sources
  node intelligent-scraper.js --batch \\
    https://www.cbinsights.com/research/best-venture-capital-firms/ \\
    https://www.forbes.com/midas-list/ \\
    https://techcrunch.com/lists/top-vcs-2024/

Great Sources:

  VCs & Angel Groups:
  • https://dealroom.net/blog/top-venture-capital-firms
  • https://www.cbinsights.com/research/best-venture-capital-firms/
  • https://www.forbes.com/midas-list/
  • https://techcrunch.com/lists/top-vcs-2024/
  • https://www.bandofangels.com/members

  Startups:
  • https://techcrunch.com/startups/
  • https://www.producthunt.com/
  • https://www.ycombinator.com/companies
  • https://www.crunchbase.com/

  News:
  • https://techcrunch.com/
  • https://venturebeat.com/
  • https://news.crunchbase.com/
`);
    process.exit(0);
  }
  
  if (args[0] === '--batch') {
    await batchScrape(args.slice(1));
  } else {
    const url = args[0];
    const type = args[1] || 'auto';
    await scrape(url, type);
  }
}

main().catch(console.error);
