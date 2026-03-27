import Parser from 'rss-parser';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { insertStartupUpload, setSupabase } = require('../../lib/startupInsertGate');

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);
setSupabase(supabase);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const parser = new Parser({
  customFields: {
    item: [
      ['content:encoded', 'content'],
      ['description', 'description'],
    ]
  }
});

interface RSSFeedSource {
  name: string;
  feedUrl: string;
  category: 'funding' | 'startup_news' | 'vc_news';
  enabled: boolean;
}

// RSS feeds for startup funding news
const RSS_FEEDS: RSSFeedSource[] = [
  // TechCrunch Feeds
  {
    name: 'TechCrunch Funding',
    feedUrl: 'https://techcrunch.com/tag/funding/feed/',
    category: 'funding',
    enabled: true,
  },
  {
    name: 'TechCrunch Venture Capital',
    feedUrl: 'https://techcrunch.com/tag/venture-capital/feed/',
    category: 'vc_news',
    enabled: true,
  },
  {
    name: 'TechCrunch Startups',
    feedUrl: 'https://techcrunch.com/category/startups/feed/',
    category: 'startup_news',
    enabled: true,
  },

  // Crunchbase
  {
    name: 'Crunchbase News',
    feedUrl: 'https://news.crunchbase.com/feed/',
    category: 'funding',
    enabled: true,
  },

  // Geographic Focus
  {
    name: 'TechNode (Asia)',
    feedUrl: 'https://technode.com/feed/',
    category: 'funding',
    enabled: true,
  },
  {
    name: 'Sifted (Europe)',
    feedUrl: 'https://sifted.eu/feed/',
    category: 'funding',
    enabled: true,
  },

  // Product Hunt (NEW)
  {
    name: 'Product Hunt Daily',
    feedUrl: 'https://www.producthunt.com/feed',
    category: 'startup_news',
    enabled: true,
  },

  // Hacker News (NEW) - Via RSS
  {
    name: 'Hacker News Frontpage',
    feedUrl: 'https://hnrss.org/frontpage',
    category: 'startup_news',
    enabled: true,
  },
  {
    name: 'Hacker News Best',
    feedUrl: 'https://hnrss.org/best',
    category: 'startup_news',
    enabled: true,
  },

  // AngelList/Wellfound (NEW)
  {
    name: 'AngelList Blog',
    feedUrl: 'https://blog.angel.co/feed/',
    category: 'vc_news',
    enabled: true,
  },

  // TechStars (NEW)
  {
    name: 'Techstars Blog',
    feedUrl: 'https://www.techstars.com/blog/feed',
    category: 'vc_news',
    enabled: true,
  },

  // Additional Quality Sources
  {
    name: 'VentureBeat',
    feedUrl: 'https://venturebeat.com/feed/',
    category: 'funding',
    enabled: true,
  },
  {
    name: 'TechCrunch Europe',
    feedUrl: 'https://techcrunch.com/tag/europe/feed/',
    category: 'funding',
    enabled: true,
  },

  // Disabled feeds
  {
    name: 'VentureBeat Funding',
    feedUrl: 'https://venturebeat.com/category/funding/feed/',
    category: 'funding',
    enabled: false, // 404 error - disabled
  },
  {
    name: 'The Information',
    feedUrl: 'https://www.theinformation.com/feed',
    category: 'funding',
    enabled: false, // Requires subscription
  },
];

interface ExtractedCompany {
  name: string;
  description: string;
  investor: string;
  fundingAmount?: string;
  fundingStage?: string;
  sourceUrl: string;
  articleDate?: string;
}

interface FivePoints {
  problem: string;
  solution: string;
  market: string;
  team: string;
  traction: string;
}

export class RSSScraper {
  
  /**
   * Main entry point: Scrape all RSS feeds for a specific investor
   */
  async scrapeForInvestor(investorName: string, jobId: string): Promise<ExtractedCompany[]> {
    console.log(`\n🎯 Starting RSS scrape for investor: ${investorName}`);
    await this.log(jobId, 'info', `Starting RSS scrape for ${investorName}`);

    const allCompanies: ExtractedCompany[] = [];
    let feedsProcessed = 0;
    let totalArticles = 0;

    // Process each RSS feed
    for (const feed of RSS_FEEDS.filter(f => f.enabled)) {
      try {
        console.log(`\n📡 Fetching ${feed.name}...`);
        feedsProcessed++;

        const companies = await this.processFeed(feed, investorName, jobId);
        allCompanies.push(...companies);
        totalArticles += companies.length;

        await this.updateJobProgress(jobId, {
          feeds_processed: feedsProcessed,
          articles_found: totalArticles,
          companies_found: allCompanies.length,
          current_feed: feed.name,
        });

        // Be respectful - wait between feeds
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.error(`❌ Error processing ${feed.name}:`, error);
        await this.log(jobId, 'error', `Failed to process ${feed.name}: ${error}`);
      }
    }

    // Deduplicate
    const uniqueCompanies = this.deduplicateCompanies(allCompanies);
    console.log(`\n✅ Found ${uniqueCompanies.length} unique companies for ${investorName}`);

    return uniqueCompanies;
  }

  /**
   * Process a single RSS feed
   */
  private async processFeed(
    feed: RSSFeedSource,
    investorName: string,
    jobId: string
  ): Promise<ExtractedCompany[]> {
    try {
      // Parse RSS feed
      const feedData = await parser.parseURL(feed.feedUrl);
      console.log(`📰 Found ${feedData.items.length} articles in ${feed.name}`);

      // Filter recent articles (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentArticles = feedData.items.filter((item: any) => {
        const pubDate = item.pubDate ? new Date(item.pubDate) : null;
        return !pubDate || pubDate >= thirtyDaysAgo;
      });

      console.log(`📅 ${recentArticles.length} articles from last 30 days`);

      if (recentArticles.length === 0) {
        return [];
      }

      // Extract companies using AI
      const companies = await this.extractCompaniesFromArticles(
        recentArticles,
        investorName,
        feed.name
      );

      return companies;

    } catch (error) {
      console.error(`❌ Error parsing feed ${feed.name}:`, error);
      return [];
    }
  }

  /**
   * Use OpenAI to extract companies and investors from RSS articles
   */
  private async extractCompaniesFromArticles(
    articles: any[],
    investorName: string,
    feedName: string
  ): Promise<ExtractedCompany[]> {
    // Prepare articles text for AI
    const articlesText = articles
      .slice(0, 20) // Limit to 20 most recent
      .map((item, i) => {
        const content = item.content || item.description || item.title || '';
        // Strip HTML tags
        const cleanContent = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        return `
ARTICLE ${i + 1}:
Title: ${item.title}
Date: ${item.pubDate || 'Unknown'}
URL: ${item.link}
Content: ${cleanContent.substring(0, 500)}...
`;
      })
      .join('\n---\n');

    const prompt = `You are a venture capital intelligence analyst. Extract ALL startup funding announcements from these articles, whether or not "${investorName}" is mentioned.

ARTICLES FROM ${feedName}:
${articlesText}

EXTRACTION TASK:
Extract EVERY company mentioned that:
1. Received funding (any investor)
2. Is a startup/technology company
3. Has funding details mentioned

For each company, extract:
- Company name
- Brief description (1 sentence)
- Funding amount (if mentioned)
- Funding stage (if mentioned)
- Investor names (ANY investors mentioned - don't filter by "${investorName}" yet)
- Article URL
- Article date

IMPORTANT - Be VERY INCLUSIVE:
- Extract ALL companies with funding news
- Include companies even if "${investorName}" is NOT mentioned
- We'll filter for specific investors later
- Better to extract too many than miss any

RESPONSE FORMAT (JSON object with companies array):
{
  "companies": [
    {
      "name": "Company Name",
      "description": "What the company does",
      "investor": "Any investor mentioned (can be multiple, comma-separated)",
      "fundingAmount": "$10M" or null,
      "fundingStage": "Series A" or null,
      "sourceUrl": "article URL",
      "articleDate": "2024-11-25" or null
    }
  ]
}

CRITICAL:
- Extract EVERY company with funding news
- Don't skip companies just because "${investorName}" isn't mentioned
- Include investor names as they appear in article
- Return {"companies": []} only if NO funding announcements at all

OUTPUT (JSON only):`;

    try {
      console.log(`🤖 Analyzing ${articles.length} articles for ANY funding news...`);
      console.log(`📝 Articles text length: ${articlesText.length} characters`);

      const response = await openai.chat.completions.create({
        model: 'gpt-4o', // Latest model
        messages: [
          {
            role: 'system',
            content: `You are a funding news extraction expert. Extract ALL startup funding announcements from articles. Be aggressive - extract every company mentioned with any funding news. Return valid JSON with a "companies" array. Never return empty arrays unless there are truly NO funding announcements at all.`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.1,
        max_tokens: 3000,
        response_format: { type: 'json_object' }, // Force JSON response
      });

      const content = response.choices[0].message.content || '{"companies":[]}';
      console.log('🤖 AI Response length:', content.length);
      console.log('🤖 AI Response preview:', content.substring(0, 500) + '...');

      // Parse JSON
      try {
        const data = JSON.parse(content);
        const companiesArray = data.companies || [];
        
        console.log(`✅ AI extracted ${companiesArray.length} companies`);
        
        if (companiesArray.length === 0) {
          console.log(`⚠️  No companies found matching ${investorName} in these articles`);
          return [];
        }
        
        // Map to ExtractedCompany format
        const extractedCompanies: ExtractedCompany[] = companiesArray.map((c: any) => ({
          name: c.name,
          description: c.description || '',
          investor: c.investor || investorName,
          fundingAmount: c.fundingAmount,
          fundingStage: c.fundingStage,
          sourceUrl: c.sourceUrl || '',
          articleDate: c.articleDate,
        }));

        console.log(`✅ Mapped ${extractedCompanies.length} companies from ${feedName}`);
        return extractedCompanies;
      } catch (parseError) {
        console.error('❌ Failed to parse AI response as JSON:', parseError);
        console.log('Raw response:', content);
        return [];
      }

    } catch (error) {
      console.error('❌ OpenAI API error:', error);
      return [];
    }
  }

  /**
   * Visit company website and extract 5 key points
   */
  async extractFivePoints(companyName: string, companyUrl: string): Promise<FivePoints | null> {
    try {
      console.log(`\n🔍 Extracting 5 points for ${companyName}...`);

      // Fetch website content
      const response = await axios.get(companyUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
        timeout: 10000,
      });

      const htmlContent = response.data;
      // Strip HTML tags and get text
      const textContent = htmlContent
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 4000); // Limit to avoid token limits

      // Use AI to extract 5 points
      const prompt = `You are analyzing the website of ${companyName}.

WEBSITE CONTENT:
${textContent}

TASK: Extract the 5 critical points for an investor card:

1. PROBLEM: What problem does this startup solve? (1 sentence, max 20 words)
2. SOLUTION: How do they solve it? (1 sentence, max 20 words)
3. MARKET: What market/industry are they in? Who are the customers? (1 sentence, max 20 words)
4. TEAM: Who founded it? What's their background? (1 sentence, max 20 words)
5. TRACTION: What progress have they made? (metrics, customers, revenue) (1 sentence, max 20 words)

RULES:
- Each point must be concise and investor-focused
- Focus on facts, not marketing speak
- If information is missing, make educated guess based on company description
- Be specific with numbers when available

RESPONSE FORMAT (JSON):
{
  "problem": "...",
  "solution": "...",
  "market": "...",
  "team": "...",
  "traction": "..."
}`;

      const aiResponse = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a VC analyst extracting key investment data points. Be concise, factual, and investor-focused.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      });

      const fivePoints = JSON.parse(aiResponse.choices[0].message.content || '{}');
      console.log(`✅ Extracted 5 points for ${companyName}`);

      return fivePoints as FivePoints;

    } catch (error) {
      console.error(`❌ Error extracting 5 points for ${companyName}:`, error);
      return null;
    }
  }

  /**
   * Lookup company website URL using search or external API
   */
  async lookupCompanyURL(companyName: string): Promise<string | null> {
    try {
      // Use OpenAI to help construct search query and find likely URL
      const prompt = `Given the company name "${companyName}", what is their most likely official website URL?

RULES:
- Return just the URL, nothing else
- Use https://
- Most startups use .com, .io, or .ai domains
- If unsure, return null

EXAMPLES:
"Stripe" → "https://stripe.com"
"OpenAI" → "https://openai.com"
"Vercel" → "https://vercel.com"

COMPANY: ${companyName}
URL:`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are a URL lookup assistant. Return only the URL or "null".' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 100,
      });

      const url = response.choices[0].message.content?.trim() || null;
      
      if (url && url !== 'null' && url.startsWith('http')) {
        console.log(`🔗 Found URL for ${companyName}: ${url}`);
        return url;
      }

      console.log(`⚠️ Could not find URL for ${companyName}`);
      return null;

    } catch (error) {
      console.error(`❌ Error looking up URL for ${companyName}:`, error);
      return null;
    }
  }

  /**
   * Full pipeline: Extract company → Find URL → Get 5 points
   */
  async enrichCompany(company: ExtractedCompany): Promise<any> {
    console.log(`\n🚀 Enriching ${company.name}...`);

    // Step 1: Lookup URL if not provided
    let companyUrl = company.sourceUrl;
    if (!companyUrl || !companyUrl.includes(company.name.toLowerCase())) {
      companyUrl = await this.lookupCompanyURL(company.name) || '';
    }

    // Step 2: Extract 5 points from website
    let fivePoints: FivePoints | null = null;
    if (companyUrl) {
      fivePoints = await this.extractFivePoints(company.name, companyUrl);
    }

    // Step 3: Return enriched company data
    return {
      name: company.name,
      tagline: company.description,
      website: companyUrl,
      investor: company.investor,
      funding_amount: company.fundingAmount,
      funding_stage: company.fundingStage,
      source_url: company.sourceUrl,
      article_date: company.articleDate,
      five_points: fivePoints,
      enriched_at: new Date().toISOString(),
    };
  }

  /**
   * Deduplicate companies by name
   */
  private deduplicateCompanies(companies: ExtractedCompany[]): ExtractedCompany[] {
    const seen = new Map<string, ExtractedCompany>();

    for (const company of companies) {
      const key = company.name.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.set(key, company);
      }
    }

    return Array.from(seen.values());
  }

  /**
   * Save enriched companies to database
   */
  async saveToDatabase(companies: any[], jobId: string): Promise<void> {
    console.log(`\n💾 Saving ${companies.length} enriched companies to database...`);

    // Import validators (dynamic import to avoid circular deps)
    const { shouldRejectStartupCandidate, generateCanonicalKey } = await import('../utils/startupValidator');

    let rejected = 0;
    let saved = 0;
    let skipped = 0;

    for (const company of companies) {
      try {
        // Step 1: Validate candidate (reject headlines/junk)
        const validation = shouldRejectStartupCandidate({
          name: company.name,
          website: company.website,
          sourceUrl: company.source_url
        });

        if (validation.reject) {
          console.log(`⏭️  Rejected: ${company.name} (${validation.reason})`);
          rejected++;
          continue;
        }

        // Step 2: Generate canonical key for deduplication
        const canonicalKey = generateCanonicalKey(company.name, company.website);

        // Step 3: Check if startup with this canonical_key already exists
        const { data: existing } = await supabase
          .from('startup_uploads')
          .select('id, name')
          .eq('canonical_key', canonicalKey)
          .maybeSingle();

        if (existing) {
          console.log(`⏭️  Skipped: ${company.name} (canonical_key exists: ${existing.name})`);
          skipped++;
          continue;
        }

        // Step 4: Insert via gate (validates name; rejects garbage)
        const record = {
          name: company.name,
          tagline: company.tagline,
          website: company.website,
          pitch: company.five_points ? JSON.stringify(company.five_points) : null,
          stage: this.parseStage(company.funding_stage),
          raise_amount: company.funding_amount,
          raise_type: company.funding_stage,
          status: 'approved' as const,
          source_type: 'rss_scraper',
          source_url: company.source_url,
          extracted_data: company,
          submitted_by: 'RSS Scraper',
          submitted_email: 'scraper@hotmoneyhoney.com',
          canonical_key: canonicalKey,
        };

        const result = await insertStartupUpload(record, { skipDuplicateCheck: true });
        if (!result.ok) {
          console.error(`❌ Rejected ${company.name}:`, result.error);
          rejected++;
        } else {
          console.log(`✅ Saved ${company.name} (canonical_key=${canonicalKey})`);
          saved++;
        }
      } catch (err) {
        console.error(`❌ Error saving company:`, err);
      }
    }

    console.log(`✅ Save complete: ${saved} saved, ${skipped} skipped (canonical_key exists), ${rejected} rejected (headlines/junk)`);
  }

  /**
   * Parse funding stage to numeric stage (1-10)
   */
  private parseStage(fundingStage?: string): number {
    if (!fundingStage) return 1;
    
    const stage = fundingStage.toLowerCase();
    if (stage.includes('seed')) return 1;
    if (stage.includes('series a')) return 3;
    if (stage.includes('series b')) return 5;
    if (stage.includes('series c')) return 7;
    if (stage.includes('series d')) return 9;
    if (stage.includes('ipo')) return 10;
    
    return 1; // Default to early stage
  }

  /**
   * Log to database
   */
  private async log(jobId: string, level: string, message: string): Promise<void> {
    try {
      await supabase.from('scraper_logs').insert({ job_id: jobId, level, message });
    } catch (error) {
      // Silently fail
    }
  }

  /**
   * Update job progress
   */
  private async updateJobProgress(
    jobId: string,
    stats: {
      feeds_processed?: number;
      articles_found?: number;
      companies_found?: number;
      current_feed?: string;
    }
  ): Promise<void> {
    const updates: any = {};

    if (stats.companies_found !== undefined) {
      updates.companies_found = stats.companies_found;
    }

    const metadata = {
      feeds_processed: stats.feeds_processed || 0,
      articles_found: stats.articles_found || 0,
      current_feed: stats.current_feed || null,
      last_update: new Date().toISOString(),
    };

    updates.metadata = metadata;

    await supabase.from('scraper_jobs').update(updates).eq('id', jobId);
  }
}

// Export singleton
export const rssScraper = new RSSScraper();
