import { supabase } from './supabase';
import axios from 'axios';
import * as cheerio from 'cheerio';

interface Partner {
  name: string;
  title: string;
  bio?: string;
  linkedin_url?: string;
  twitter_handle?: string;
  email?: string;
  focus_areas?: string[];
  stage_preference?: string[];
  geography_focus?: string[];
  image_url?: string;
}

interface Investment {
  company_name: string;
  company_description?: string;
  company_url?: string;
  investment_date?: string;
  round_type?: string;
  amount?: string;
  is_lead?: boolean;
  co_investors?: string[];
  industries?: string[];
  status?: string;
  exit_date?: string;
  exit_details?: string;
}

interface Advice {
  title: string;
  content: string;
  category: string;
  tags?: string[];
  source_type: string;
  source_url?: string;
  published_date?: string;
}

interface NewsArticle {
  title: string;
  summary: string;
  url: string;
  published_date: string;
  source: string;
  sentiment?: string;
  tags?: string[];
}

// VC Website URLs for scraping
const VC_WEBSITES: Record<string, { 
  website: string;
  teamPage?: string;
  portfolioPage?: string;
  blogUrl?: string;
  rssUrl?: string;
}> = {
  'Y Combinator': {
    website: 'https://www.ycombinator.com',
    teamPage: 'https://www.ycombinator.com/people',
    portfolioPage: 'https://www.ycombinator.com/companies',
    blogUrl: 'https://blog.ycombinator.com',
    rssUrl: 'https://blog.ycombinator.com/feed/'
  },
  'Sequoia Capital': {
    website: 'https://www.sequoiacap.com',
    teamPage: 'https://www.sequoiacap.com/people/',
    portfolioPage: 'https://www.sequoiacap.com/companies/',
    blogUrl: 'https://www.sequoiacap.com/article/',
    rssUrl: 'https://www.sequoiacap.com/feed/'
  },
  'Andreessen Horowitz': {
    website: 'https://a16z.com',
    teamPage: 'https://a16z.com/team/',
    portfolioPage: 'https://a16z.com/portfolio/',
    blogUrl: 'https://a16z.com/posts/',
    rssUrl: 'https://a16z.com/feed/'
  },
  'Accel': {
    website: 'https://www.accel.com',
    teamPage: 'https://www.accel.com/people',
    portfolioPage: 'https://www.accel.com/companies',
    blogUrl: 'https://www.accel.com/noteworthy'
  },
  'Benchmark': {
    website: 'https://www.benchmark.com',
    teamPage: 'https://www.benchmark.com/team/',
    portfolioPage: 'https://www.benchmark.com/portfolio/'
  },
  'Founders Fund': {
    website: 'https://foundersfund.com',
    teamPage: 'https://foundersfund.com/team/',
    portfolioPage: 'https://foundersfund.com/companies/'
  },
  'Greylock Partners': {
    website: 'https://greylock.com',
    teamPage: 'https://greylock.com/team/',
    portfolioPage: 'https://greylock.com/portfolio/',
    blogUrl: 'https://greylock.com/greymatter/'
  },
  'Lightspeed Venture Partners': {
    website: 'https://lsvp.com',
    teamPage: 'https://lsvp.com/team/',
    portfolioPage: 'https://lsvp.com/portfolio/'
  },
  'NEA': {
    website: 'https://www.nea.com',
    teamPage: 'https://www.nea.com/team',
    portfolioPage: 'https://www.nea.com/portfolio'
  },
  'Kleiner Perkins': {
    website: 'https://www.kleinerperkins.com',
    teamPage: 'https://www.kleinerperkins.com/team/',
    portfolioPage: 'https://www.kleinerperkins.com/portfolio/'
  }
}

/** DB names / aliases → key in VC_WEBSITES (scrapers use exact config keys). */
const VC_NAME_ALIASES: Record<string, string> = {
  a16z: 'Andreessen Horowitz',
  'andreessen horowitz (a16z)': 'Andreessen Horowitz',
  greylock: 'Greylock Partners',
  nea: 'NEA',
  'new enterprise associates': 'NEA',
  kp: 'Kleiner Perkins',
  'kleiner perkins caufield & byers': 'Kleiner Perkins',
  lsvp: 'Lightspeed Venture Partners',
  lightspeed: 'Lightspeed Venture Partners',
  yc: 'Y Combinator',
  sequoia: 'Sequoia Capital',
  benchmark: 'Benchmark',
  'founders fund': 'Founders Fund',
  accel: 'Accel',
};

/**
 * Scrape and enrich investor data from multiple sources
 */
export class InvestorEnrichmentService {
  /** Resolve `investors.name` from DB to a VC_WEBSITES key (fuzzy / aliases). */
  private static resolveVcWebsiteKey(investorName: string): string | null {
    const raw = investorName.trim();
    if (VC_WEBSITES[raw]) return raw;
    const lower = raw.toLowerCase();
    if (VC_NAME_ALIASES[lower]) return VC_NAME_ALIASES[lower];
    for (const key of Object.keys(VC_WEBSITES)) {
      if (key.toLowerCase() === lower) return key;
    }
    for (const key of Object.keys(VC_WEBSITES)) {
      const kl = key.toLowerCase();
      if (lower.includes(kl) || kl.includes(lower)) return key;
    }
    return null;
  }

  private static getVcConfig(investorName: string) {
    const key = this.resolveVcWebsiteKey(investorName);
    const config = key ? VC_WEBSITES[key] : undefined;
    return { key, config };
  }

  /**
   * Enrich an investor with partners, investments, and advice
   */
  static async enrichInvestor(investorId: string, investorName: string) {
    const { key: vcKey, config: vcResolved } = this.getVcConfig(investorName);
    if (!vcResolved) {
      console.warn(
        `⚠️ No VC_WEBSITES entry for "${investorName}" (resolved key=${vcKey ?? 'null'}) — scraping will be limited to news search / RSS if any.`
      );
    }

    console.log(`🔍 Starting enrichment for ${investorName}...`);
    
    try {
      // 1. Scrape news articles first (highest value)
      const news = await this.scrapeNews(investorId, investorName);
      console.log(`✅ Found ${news.length} news articles`);
      
      // 2. Scrape partner data from VC website
      const partners = await this.scrapePartners(investorName);
      if (partners.length > 0) {
        await this.savePartners(investorId, partners);
        console.log(`✅ Saved ${partners.length} partners`);
      }
      
      // 3. Scrape investment portfolio
      const investments = await this.scrapeInvestments(investorName);
      if (investments.length > 0) {
        await this.saveInvestments(investorId, investments);
        console.log(`✅ Saved ${investments.length} investments`);
      }
      
      // 4. Scrape startup advice from blogs
      const advice = await this.scrapeAdvice(investorName);
      if (advice.length > 0) {
        await this.saveAdvice(investorId, advice);
        console.log(`✅ Saved ${advice.length} advice items`);
      }
      
      // 5. Update last enrichment date
      const { error: invUpdErr } = await supabase
        .from('investors')
        .update({ 
          last_enrichment_date: new Date().toISOString(),
          news_feed_url: vcResolved?.rssUrl ?? null,
          linkedin_url: `https://www.linkedin.com/company/${investorName.toLowerCase().replace(/\s+/g, '-')}`
        })
        .eq('id', investorId);
      if (invUpdErr) {
        console.warn(`⚠️ investors row update failed (RLS or schema?): ${invUpdErr.message}`);
      }
      
      console.log(`✨ Enrichment complete for ${investorName}`);
      
      return {
        success: true,
        news: news.length,
        partners: partners.length,
        investments: investments.length,
        advice: advice.length
      };
      
    } catch (error) {
      console.error(`❌ Error enriching ${investorName}:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Scrape partner information from VC website team pages
   */
  private static async scrapePartners(investorName: string): Promise<Partner[]> {
    const partners: Partner[] = [];
    
    try {
      const { config: vcInfo } = this.getVcConfig(investorName);
      if (!vcInfo?.teamPage) {
        console.log(`⚠️ No team page URL for ${investorName}`);
        return partners;
      }

      console.log(`🔍 Scraping partners from ${vcInfo.teamPage}...`);
      
      const { data: html } = await axios.get(vcInfo.teamPage, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        },
        timeout: 10000
      });
      
      const $ = cheerio.load(html);
      
      // Generic selectors that work across most VC sites
      const selectors = [
        '.team-member', '.person', '.partner-card', '.team-card',
        '[class*="team"]', '[class*="partner"]', '[class*="person"]'
      ];
      
      for (const selector of selectors) {
        $(selector).each((i, el) => {
          const name = $(el).find('.name, .person-name, h2, h3, [class*="name"]').first().text().trim();
          const title = $(el).find('.title, .role, .position, [class*="title"]').first().text().trim();
          const bio = $(el).find('.bio, .description, p').first().text().trim();
          const linkedinUrl = $(el).find('a[href*="linkedin"]').attr('href');
          const twitterHandle = $(el).find('a[href*="twitter"]').attr('href')?.split('/').pop();
          const imageUrl = $(el).find('img').first().attr('src');
          
          if (name && name.length > 2) {
            partners.push({
              name,
              title: title || 'Partner',
              bio: bio?.substring(0, 500),
              linkedin_url: linkedinUrl,
              twitter_handle: twitterHandle,
              image_url: imageUrl,
              focus_areas: this.extractFocusAreas(bio || title),
              stage_preference: this.extractStagePreference(bio || title)
            });
          }
        });
        
        if (partners.length > 0) break; // Found partners, stop trying selectors
      }
      
      console.log(`✅ Found ${partners.length} partners for ${investorName}`);
      
    } catch (error) {
      console.error(`❌ Error scraping partners for ${investorName}:`, error instanceof Error ? error.message : error);
    }
    
    return partners;
  }
  
  /**
   * Scrape investment portfolio from VC website portfolio pages
   */
  private static async scrapeInvestments(investorName: string): Promise<Investment[]> {
    const investments: Investment[] = [];
    
    try {
      const { config: vcInfo } = this.getVcConfig(investorName);
      if (!vcInfo?.portfolioPage) {
        console.log(`⚠️ No portfolio page URL for ${investorName}`);
        return investments;
      }

      console.log(`🔍 Scraping portfolio from ${vcInfo.portfolioPage}...`);
      
      const { data: html } = await axios.get(vcInfo.portfolioPage, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        },
        timeout: 10000
      });
      
      const $ = cheerio.load(html);
      
      // Generic selectors for portfolio companies
      const selectors = [
        '.portfolio-company', '.company', '.company-card', '.investment',
        '[class*="portfolio"]', '[class*="company"]'
      ];
      
      for (const selector of selectors) {
        $(selector).each((i, el) => {
          const companyName = $(el).find('.company-name, .name, h2, h3, [class*="name"]').first().text().trim();
          const description = $(el).find('.description, .tagline, p').first().text().trim();
          const companyUrl = $(el).find('a').first().attr('href');
          const tags = $(el).find('.tag, .category, [class*="tag"]').map((i, tag) => $(tag).text().trim()).get();
          
          if (companyName && companyName.length > 2) {
            investments.push({
              company_name: companyName,
              company_description: description?.substring(0, 500),
              company_url: companyUrl?.startsWith('http') ? companyUrl : `${vcInfo.website}${companyUrl}`,
              industries: tags.length > 0 ? tags : undefined,
              status: 'active'
            });
          }
        });
        
        if (investments.length > 0) break;
      }
      
      console.log(`✅ Found ${investments.length} investments for ${investorName}`);
      
    } catch (error) {
      console.error(`❌ Error scraping investments for ${investorName}:`, error instanceof Error ? error.message : error);
    }
    
    return investments;
  }
  
  /**
   * Scrape startup advice from VC blog RSS feeds
   */
  private static async scrapeAdvice(investorName: string): Promise<Advice[]> {
    const advice: Advice[] = [];
    
    try {
      const { config: vcInfo } = this.getVcConfig(investorName);
      if (!vcInfo?.rssUrl && !vcInfo?.blogUrl) {
        console.log(`⚠️ No blog/RSS URL for ${investorName}`);
        return advice;
      }

      console.log(`🔍 Scraping advice from ${vcInfo.rssUrl || vcInfo.blogUrl}...`);
      
      // Try RSS feed first
      if (vcInfo.rssUrl) {
        try {
          const { data: rssXml } = await axios.get(vcInfo.rssUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 10000
          });
          
          const $ = cheerio.load(rssXml, { xmlMode: true });
          
          $('item').each((i, el) => {
            if (i >= 10) return; // Limit to 10 articles
            
            const title = $(el).find('title').text().trim();
            const content = $(el).find('description, content\\:encoded').first().text().trim();
            const url = $(el).find('link').text().trim();
            const pubDate = $(el).find('pubDate').text().trim();
            
            if (title) {
              advice.push({
                title,
                content: this.stripHtml(content).substring(0, 1000),
                category: this.categorizeAdvice(title + ' ' + content),
                tags: this.extractTags(title + ' ' + content),
                source_type: 'blog',
                source_url: url,
                published_date: pubDate ? new Date(pubDate).toISOString() : undefined
              });
            }
          });
        } catch (rssError) {
          console.log(`⚠️ RSS feed failed, trying blog page...`);
        }
      }
      
      // Fallback to scraping blog page
      if (advice.length === 0 && vcInfo.blogUrl) {
        const { data: html } = await axios.get(vcInfo.blogUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          timeout: 10000
        });
        
        const $ = cheerio.load(html);
        
        $('article, .post, .blog-post, [class*="article"]').each((i, el) => {
          if (i >= 10) return;
          
          const title = $(el).find('h1, h2, h3, .title').first().text().trim();
          const content = $(el).find('p, .content, .excerpt').first().text().trim();
          const url = $(el).find('a').first().attr('href');
          
          if (title) {
            advice.push({
              title,
              content: content.substring(0, 1000),
              category: this.categorizeAdvice(title + ' ' + content),
              tags: this.extractTags(title + ' ' + content),
              source_type: 'blog',
              source_url: url?.startsWith('http') ? url : `${vcInfo.website}${url}`,
              published_date: new Date().toISOString()
            });
          }
        });
      }
      
      console.log(`✅ Found ${advice.length} advice articles for ${investorName}`);
      
    } catch (error) {
      console.error(`❌ Error scraping advice for ${investorName}:`, error instanceof Error ? error.message : error);
    }
    
    return advice;
  }
  
  /**
   * Scrape news articles about the VC firm from multiple sources
   */
  private static async scrapeNews(investorId: string, investorName: string): Promise<NewsArticle[]> {
    const news: NewsArticle[] = [];
    
    try {
      // 1. Check VC's own RSS feed
      const { config: vcInfo } = this.getVcConfig(investorName);
      if (vcInfo?.rssUrl) {
        const rssNews = await this.scrapeRSSFeed(vcInfo.rssUrl, investorName);
        news.push(...rssNews);
      }
      
      // 2. Search TechCrunch (via their site search or RSS)
      const techCrunchNews = await this.scrapeTechCrunchSearch(investorName);
      news.push(...techCrunchNews);
      
      // 3. Search VentureBeat
      const ventureBeatNews = await this.scrapeVentureBeatSearch(investorName);
      news.push(...ventureBeatNews);
      
      // Save news to database
      if (news.length > 0) {
        await this.saveNews(investorId, news);
      }
      
      console.log(`✅ Found ${news.length} news articles for ${investorName}`);
      
    } catch (error) {
      console.error(`❌ Error scraping news for ${investorName}:`, error instanceof Error ? error.message : error);
    }
    
    return news;
  }
  
  // Helper methods
  
  private static extractFocusAreas(text: string): string[] {
    const areas = ['AI', 'ML', 'SaaS', 'Fintech', 'Healthcare', 'Enterprise', 'Consumer', 'Crypto', 'Web3', 'Climate'];
    return areas.filter(area => text.toLowerCase().includes(area.toLowerCase()));
  }
  
  private static extractStagePreference(text: string): string[] {
    const stages = [];
    if (/seed/i.test(text)) stages.push('Seed');
    if (/series\s*a/i.test(text)) stages.push('Series A');
    if (/series\s*b/i.test(text)) stages.push('Series B');
    if (/growth/i.test(text)) stages.push('Growth');
    return stages;
  }
  
  private static categorizeAdvice(text: string): string {
    const lower = text.toLowerCase();
    if (lower.includes('fundrais') || lower.includes('pitch') || lower.includes('investor')) return 'fundraising';
    if (lower.includes('product') || lower.includes('pmf') || lower.includes('market fit')) return 'product';
    if (lower.includes('hire') || lower.includes('team') || lower.includes('recruit')) return 'hiring';
    if (lower.includes('growth') || lower.includes('scale') || lower.includes('market')) return 'growth';
    return 'general';
  }
  
  private static extractTags(text: string): string[] {
    const keywords = ['pitch-deck', 'metrics', 'term-sheet', 'valuation', 'cap-table', 'fundraising', 
                     'product-market-fit', 'go-to-market', 'hiring', 'scaling'];
    return keywords.filter(k => text.toLowerCase().includes(k.replace('-', ' ')));
  }
  
  private static stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  
  private static async scrapeRSSFeed(rssUrl: string, investorName: string): Promise<NewsArticle[]> {
    const articles: NewsArticle[] = [];
    try {
      const { data: rssXml } = await axios.get(rssUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 10000
      });
      
      const $ = cheerio.load(rssXml, { xmlMode: true });
      
      $('item').slice(0, 5).each((i, el) => {
        const title = $(el).find('title').text().trim();
        const description = $(el).find('description').text().trim();
        const url = $(el).find('link').text().trim();
        const pubDate = $(el).find('pubDate').text().trim();
        
        if (title) {
          articles.push({
            title,
            summary: this.stripHtml(description).substring(0, 300),
            url,
            published_date: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
            source: investorName,
            tags: this.extractTags(title + ' ' + description)
          });
        }
      });
    } catch (error) {
      console.error(`Error scraping RSS feed:`, error instanceof Error ? error.message : error);
    }
    return articles;
  }
  
  private static async scrapeTechCrunchSearch(investorName: string): Promise<NewsArticle[]> {
    const articles: NewsArticle[] = [];
    try {
      // TechCrunch search URL
      const searchUrl = `https://techcrunch.com/?s=${encodeURIComponent(investorName)}`;
      
      const { data: html } = await axios.get(searchUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 10000
      });
      
      const $ = cheerio.load(html);
      
      $('article, .post').slice(0, 3).each((i, el) => {
        const title = $(el).find('h2, h3, .post-title').first().text().trim();
        const summary = $(el).find('.excerpt, p').first().text().trim();
        const url = $(el).find('a').first().attr('href');
        
        if (title && url) {
          articles.push({
            title,
            summary: summary.substring(0, 300),
            url,
            published_date: new Date().toISOString(),
            source: 'TechCrunch',
            sentiment: 'neutral'
          });
        }
      });
    } catch (error) {
      console.error(`Error scraping TechCrunch:`, error instanceof Error ? error.message : error);
    }
    return articles;
  }
  
  private static async scrapeVentureBeatSearch(investorName: string): Promise<NewsArticle[]> {
    const articles: NewsArticle[] = [];
    try {
      const searchUrl = `https://venturebeat.com/?s=${encodeURIComponent(investorName)}`;
      
      const { data: html } = await axios.get(searchUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 10000
      });
      
      const $ = cheerio.load(html);
      
      $('article').slice(0, 3).each((i, el) => {
        const title = $(el).find('h2, h3').first().text().trim();
        const summary = $(el).find('p, .excerpt').first().text().trim();
        const url = $(el).find('a').first().attr('href');
        
        if (title && url) {
          articles.push({
            title,
            summary: summary.substring(0, 300),
            url,
            published_date: new Date().toISOString(),
            source: 'VentureBeat'
          });
        }
      });
    } catch (error) {
      console.error(`Error scraping VentureBeat:`, error instanceof Error ? error.message : error);
    }
    return articles;
  }
  
  private static async saveNews(investorId: string, news: NewsArticle[]) {
    const { error } = await supabase
      .from('investor_news')
      .upsert(
        news.map(article => ({
          investor_id: investorId,
          title: article.title,
          summary: article.summary,
          url: article.url,
          published_date: article.published_date,
          source: article.source,
          sentiment: article.sentiment || 'neutral',
          tags: article.tags,
          is_published: true
        })),
        { onConflict: 'investor_id,url' }
      );
    
    if (error) {
      console.error('Error saving news:', error);
    }
  }
  
  /**
   * Save partners to database
   */
  private static async savePartners(investorId: string, partners: Partner[]) {
    const { error } = await supabase
      .from('investor_partners')
      .upsert(
        partners.map(p => ({
          investor_id: investorId,
          name: p.name,
          title: p.title,
          bio: p.bio,
          linkedin_url: p.linkedin_url,
          twitter_handle: p.twitter_handle,
          focus_areas: p.focus_areas,
          stage_preference: p.stage_preference,
          geography_focus: p.geography_focus,
          is_active: true
        })),
        { onConflict: 'investor_id,name' }
      );
    
    if (error) throw error;
  }
  
  /**
   * Save investments to database
   */
  private static async saveInvestments(investorId: string, investments: Investment[]) {
    const { error } = await supabase
      .from('investor_investments')
      .upsert(
        investments.map(inv => ({
          investor_id: investorId,
          company_name: inv.company_name,
          company_description: inv.company_description,
          company_url: inv.company_url,
          investment_date: inv.investment_date,
          round_type: inv.round_type,
          amount: inv.amount,
          is_lead: inv.is_lead,
          industries: inv.industries,
          status: inv.status || 'active',
          scraped_date: new Date().toISOString()
        })),
        { onConflict: 'investor_id,company_name,investment_date' }
      );
    
    if (error) throw error;
  }
  
  /**
   * Save advice to database
   */
  private static async saveAdvice(investorId: string, advice: Advice[]) {
    const { error } = await supabase
      .from('investor_advice')
      .insert(
        advice.map(adv => ({
          investor_id: investorId,
          title: adv.title,
          content: adv.content,
          category: adv.category,
          tags: adv.tags,
          source_type: adv.source_type,
          source_url: adv.source_url,
          published_date: adv.published_date
        }))
      );
    
    if (error) throw error;
  }
  
  /**
   * Get enriched investor profile
   */
  static async getEnrichedProfile(investorId: string) {
    // Get investor
    const { data: investor, error: investorError } = await supabase
      .from('investors')
      .select('*')
      .eq('id', investorId)
      .single();
    
    if (investorError) throw investorError;
    
    // Get partners
    const { data: partners } = await supabase
      .from('investor_partners')
      .select('*')
      .eq('investor_id', investorId)
      .eq('is_active', true)
      .order('name');
    
    // Get recent investments
    const { data: investments } = await supabase
      .from('investor_investments')
      .select('*')
      .eq('investor_id', investorId)
      .order('investment_date', { ascending: false })
      .limit(20);
    
    // Get advice
    const { data: advice } = await supabase
      .from('investor_advice')
      .select('*')
      .eq('investor_id', investorId)
      .order('published_date', { ascending: false })
      .limit(10);
    
    // Get news
    const { data: news } = await supabase
      .from('investor_news')
      .select('*')
      .eq('investor_id', investorId)
      .eq('is_published', true)
      .order('published_date', { ascending: false })
      .limit(10);
    
    return {
      ...investor,
      partners: partners || [],
      investments: investments || [],
      advice: advice || [],
      news: news || []
    };
  }
  
  /**
   * Bulk enrich all investors (run periodically)
   */
  static async enrichAllInvestors() {
    const { data: investors, error } = await supabase
      .from('investors')
      .select('id, name, last_enrichment_date')
      .order('last_enrichment_date', { ascending: true, nullsFirst: true })
      .limit(10); // Process 10 at a time
    
    if (error) throw error;
    
    const results = [];
    for (const investor of investors) {
      const result = await this.enrichInvestor(investor.id, investor.name);
      results.push({ investor: investor.name, ...result });
      
      // Rate limit: wait 2 seconds between requests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    return results;
  }
}

// Export helper functions
export const enrichInvestor = InvestorEnrichmentService.enrichInvestor.bind(InvestorEnrichmentService);
export const getEnrichedProfile = InvestorEnrichmentService.getEnrichedProfile.bind(InvestorEnrichmentService);
export const enrichAllInvestors = InvestorEnrichmentService.enrichAllInvestors.bind(InvestorEnrichmentService);
