import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import Parser from 'rss-parser';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { insertDiscovered, setSupabase } = require('../../lib/startupInsertGate');

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);
setSupabase(supabase);

// Using Anthropic Claude instead of OpenAI for market intelligence extraction
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const parser = new Parser({
  customFields: {
    item: [
      ['content:encoded', 'content'],
      ['description', 'description'],
    ]
  }
});

interface DiscoveredStartup {
  name: string;
  website?: string;
  description: string;
  // 🔥 VIBE SCORE (Qualitative story - minimized weight in GOD)
  value_proposition?: string;
  problem?: string;
  solution?: string;
  market_size?: string;
  team_companies?: string[];
  funding_amount?: string;
  funding_stage?: string;
  investors_mentioned?: string[];
  sectors?: string[];
  article_url: string;
  article_title: string;
  article_date?: string;
  rss_source: string;
}

export class StartupDiscoveryService {
  
  /**
   * Scrape all RSS sources and extract startups
   */
  async discoverStartupsFromRSS(): Promise<DiscoveredStartup[]> {
    console.log('\n🚀 Starting startup discovery from RSS feeds...');
    
    // Get all active RSS sources
    const { data: sources, error: sourcesError } = await supabase
      .from('rss_sources')
      .select('*')
      .eq('active', true);

    if (sourcesError || !sources || sources.length === 0) {
      console.error('❌ Error fetching RSS sources:', sourcesError);
      return [];
    }

    console.log(`📡 Found ${sources.length} active RSS sources`);

    const allStartups: DiscoveredStartup[] = [];

    // Process each RSS source
    for (const source of sources) {
      try {
        console.log(`\n📰 Processing: ${source.name}`);
        const startups = await this.processRSSSource(source);
        allStartups.push(...startups);
        console.log(`   ✅ Found ${startups.length} startups`);

        // Be respectful - wait between feeds
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`   ❌ Error processing ${source.name}:`, error);
      }
    }

    console.log(`\n✨ Total startups discovered: ${allStartups.length}`);

    // Save to database
    if (allStartups.length > 0) {
      await this.saveDiscoveredStartups(allStartups);
    }

    return allStartups;
  }

  /**
   * Process a single RSS source
   */
  private async processRSSSource(source: any): Promise<DiscoveredStartup[]> {
    try {
      // Parse RSS feed
      const feedData = await parser.parseURL(source.url);
      
      // Filter recent articles (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentArticles = feedData.items.filter((item: any) => {
        const pubDate = item.pubDate ? new Date(item.pubDate) : null;
        return !pubDate || pubDate >= thirtyDaysAgo;
      });

      if (recentArticles.length === 0) {
        return [];
      }

      console.log(`   📅 ${recentArticles.length} recent articles`);

      // Extract startups using AI
      const startups = await this.extractStartupsFromArticles(
        recentArticles,
        source.name
      );

      return startups;

    } catch (error) {
      console.error(`Error parsing feed ${source.name}:`, error);
      return [];
    }
  }

  /**
   * Use OpenAI to extract startups from articles
   */
  private async extractStartupsFromArticles(
    articles: any[],
    sourceName: string
  ): Promise<DiscoveredStartup[]> {
    // Prepare articles text for AI
    const articlesText = articles
      .slice(0, 15) // Limit to 15 most recent
      .map((item, i) => {
        const content = item.content || item.description || item.title || '';
        const cleanContent = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        return `
ARTICLE ${i + 1}:
Title: ${item.title}
Date: ${item.pubDate || 'Unknown'}
URL: ${item.link}
Content: ${cleanContent.substring(0, 600)}...
`;
      })
      .join('\n---\n');

    const prompt = `You are a startup discovery analyst. Extract ALL startup companies mentioned in these articles with PYTH AI 5-POINT FORMAT.

ARTICLES:
${articlesText}

EXTRACTION TASK:
Extract EVERY startup/company mentioned that:
1. Is a technology startup or innovative company
2. Has any funding/product/launch news
3. Is mentioned with enough detail to be relevant

For each startup, extract:
- Company name (exact name as mentioned)
- Company website (if mentioned or can be inferred from domain/URL in article)
- Brief description (1-2 sentences about what they do)

🔥 VIBE SCORE (Qualitative Story - 5 Points):
Extract these 5 qualitative points for narrative assessment:

1. VALUE_PROPOSITION: One-line tagline describing what they do (e.g., "Tesla for home solar", "AI copilot for lawyers")
2. PROBLEM: What specific customer pain/problem are they solving? Be specific about the problem, not the solution.
3. SOLUTION: How do they solve it? What's their unique approach or technology?
4. MARKET_SIZE: TAM/market opportunity (e.g., "$280B mental health market", "$15B EV charging market")
5. TEAM_COMPANIES: Notable previous companies where founders/team worked (e.g., ["Tesla", "Google", "Y Combinator"])

Additionally extract:
- Funding amount (if mentioned, e.g., "$10M", "Series A $25M")
- Funding stage (if mentioned, e.g., "Seed", "Series A", "Series B")
- Investor names (if mentioned, extract all investors)
- Sectors/industries (array of relevant categories like "HealthTech", "FinTech", "AI/ML")

IMPORTANT:
- Extract ALL startups mentioned, not just those with funding news
- For VIBE: Infer intelligently from article text even if not explicitly stated
- If a field is truly unknown, use null (not empty string)
- Extract clean company names without extra text

RESPONSE FORMAT (JSON only, no markdown):
{
  "startups": [
    {
      "name": "Company Name",
      "website": "https://example.com or null",
      "description": "Brief description",
      "vibe_score": {
        "value_proposition": "One-line tagline",
        "problem": "Specific problem being solved",
        "solution": "How they solve it",
        "market_size": "Market opportunity description",
        "team_companies": ["Company1", "Company2"] or []
      },
      "funding_amount": "$10M or null",
      "funding_stage": "Series A or null",
      "investors": ["Investor 1", "Investor 2"] or [],
      "sectors": ["HealthTech", "AI/ML"] or [],
      "article_url": "article url",
      "article_title": "article title"
    }
  ]
}`;

    try {
      // Using Anthropic Claude for market intelligence extraction
      const message = await anthropic.messages.create({
        model: 'claude-3-5-haiku-latest',
        max_tokens: 4000,
        system: 'You are a startup discovery expert. Extract startup information from articles and return ONLY valid JSON. Be aggressive in extraction - capture every startup mentioned.',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const result = message.content[0]?.type === 'text' ? message.content[0].text.trim() : '';
      
      if (!result) {
        return [];
      }

      // Clean markdown code blocks if present
      let jsonStr = result;
      if (jsonStr.includes('```')) {
        jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      }

      const parsed = JSON.parse(jsonStr);
      const startupsArray = parsed.startups || [];

      // Map to DiscoveredStartup format with VIBE data
      const discoveredStartups: DiscoveredStartup[] = startupsArray.map((s: any) => {
        // Find the original article that matches this startup
        const matchingArticle = articles.find(a => a.link === s.article_url) || articles[0];
        
        const vibeScore = s.vibe_score || s.five_point_format || {};
        
        return {
          name: s.name,
          website: s.website && s.website !== 'null' ? s.website : null,
          description: s.description || '',
          // 🔥 VIBE SCORE (Qualitative - minimized weight)
          value_proposition: vibeScore.value_proposition || null,
          problem: vibeScore.problem || null,
          solution: vibeScore.solution || null,
          market_size: vibeScore.market_size || null,
          team_companies: Array.isArray(vibeScore.team_companies) && vibeScore.team_companies.length > 0 
            ? vibeScore.team_companies 
            : null,
          funding_amount: s.funding_amount && s.funding_amount !== 'null' ? s.funding_amount : null,
          funding_stage: s.funding_stage && s.funding_stage !== 'null' ? s.funding_stage : null,
          investors_mentioned: Array.isArray(s.investors) && s.investors.length > 0 ? s.investors : null,
          sectors: Array.isArray(s.sectors) && s.sectors.length > 0 ? s.sectors : null,
          article_url: s.article_url || matchingArticle.link,
          article_title: s.article_title || matchingArticle.title,
          article_date: matchingArticle.pubDate || null,
          rss_source: sourceName,
        };
      });

      return discoveredStartups;

    } catch (error) {
      console.error('Error extracting startups with AI:', error);
      return [];
    }
  }

  /**
   * Save discovered startups to database
   */
  private async saveDiscoveredStartups(startups: DiscoveredStartup[]): Promise<void> {
    console.log(`\n💾 Saving ${startups.length} discovered startups to database...`);

    let saved = 0;
    let skipped = 0;

    for (const startup of startups) {
      try {
        const r = await insertDiscovered({
          name: startup.name,
          website: startup.website,
          description: startup.description,
          value_proposition: startup.value_proposition,
          problem: startup.problem,
          solution: startup.solution,
          market_size: startup.market_size,
          team_companies: startup.team_companies,
          sectors: startup.sectors,
          funding_amount: startup.funding_amount,
          funding_stage: startup.funding_stage,
          investors_mentioned: startup.investors_mentioned,
          article_url: startup.article_url,
          article_title: startup.article_title,
          article_date: startup.article_date,
          rss_source: startup.rss_source,
        }, { checkDuplicates: true });

        if (r.ok) {
          if (r.skipped) skipped++;
          else saved++;
        } else {
          console.warn(`   ⚠️  Skipped "${startup.name}": ${r.error}`);
          skipped++;
        }
      } catch (error: any) {
        console.error(`   ❌ Error processing ${startup.name}:`, error.message);
      }
    }

    console.log(`\n✅ Saved: ${saved} | Skipped (duplicates/invalid): ${skipped}`);
  }

  /**
   * Get all discovered startups that haven't been imported yet
   */
  async getUnimportedStartups(): Promise<any[]> {
    const { data, error } = await supabase
      .from('discovered_startups')
      .select('*')
      .eq('imported_to_startups', false)
      .order('discovered_at', { ascending: false });

    if (error) {
      console.error('Error fetching unimported startups:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Mark a startup as imported
   */
  async markAsImported(discoveredStartupId: string, startupId: string): Promise<void> {
    await supabase
      .from('discovered_startups')
      .update({
        imported_to_startups: true,
        imported_at: new Date().toISOString(),
        startup_id: startupId,
      })
      .eq('id', discoveredStartupId);
  }

  /**
   * Bulk import discovered startups into main startups table
   */
  async bulkImportToStartups(discoveredStartupIds: string[]): Promise<number> {
    console.log(`\n📥 Bulk importing ${discoveredStartupIds.length} startups...`);

    let imported = 0;

    for (const id of discoveredStartupIds) {
      try {
        // Get discovered startup
        const { data: discovered, error: fetchError } = await supabase
          .from('discovered_startups')
          .select('*')
          .eq('id', id)
          .single();

        if (fetchError || !discovered) {
          console.error(`❌ Error fetching discovered startup ${id}`);
          continue;
        }

        // Check if already imported
        if (discovered.imported_to_startups) {
          console.log(`⏭️  Skipping ${discovered.name} - already imported`);
          continue;
        }

        // Create startup record
        const { data: newStartup, error: insertError } = await supabase
          .from('startup_uploads')
          .insert({
            name: discovered.name,
            website: discovered.website,
            description: discovered.description,
            stage: discovered.funding_stage,
            // Add other fields as needed based on your startups table schema
          })
          .select()
          .single();

        if (insertError) {
          console.error(`❌ Error inserting ${discovered.name}:`, insertError.message);
          continue;
        }

        // Mark as imported
        await this.markAsImported(discovered.id, newStartup.id);
        imported++;
        console.log(`✅ Imported: ${discovered.name}`);

      } catch (error: any) {
        console.error(`❌ Error importing startup:`, error.message);
      }
    }

    console.log(`\n✨ Successfully imported ${imported} startups`);
    return imported;
  }
}

// Export singleton
export const startupDiscoveryService = new StartupDiscoveryService();
