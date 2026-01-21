/**
 * SCRAPER INTEGRATION EXAMPLES
 * =============================
 * How to wire existing scrapers to observer event tracking
 */

const { emitObserverEvent, emitStartupSignal } = require('./observerEventEmitter');

// =====================================================
// Example 1: Portfolio Page Scraper
// =====================================================

async function scrapeInvestorPortfolio(investorId, portfolioUrl) {
  // ... existing scraping logic ...
  
  const portfolioCompanies = await fetchPortfolioPage(portfolioUrl);
  
  for (const company of portfolioCompanies) {
    // Match to our startup database
    const startup = await matchStartupByName(company.name);
    
    if (startup) {
      // EMIT: portfolio_overlap event
      await emitObserverEvent({
        investor_id: investorId,
        startup_id: startup.id,
        source: 'portfolio_overlap',
        meta: {
          portfolio_url: portfolioUrl,
          company_name: company.name,
          discovered_at: new Date().toISOString()
        }
      });
      
      console.log(`✅ Portfolio overlap: ${investor.name} → ${startup.name}`);
    }
  }
}

// =====================================================
// Example 2: News/Blog Scraper
// =====================================================

async function scrapeInvestorNews(investorId, feedUrl) {
  const articles = await fetchRssFeed(feedUrl);
  
  for (const article of articles) {
    // Extract mentioned startups
    const mentionedStartups = await extractStartupMentions(article.content);
    
    for (const startup of mentionedStartups) {
      // EMIT: news event
      await emitObserverEvent({
        investor_id: investorId,
        startup_id: startup.id,
        source: 'news',
        meta: {
          article_url: article.url,
          article_title: article.title,
          published_at: article.published
        }
      });
      
      // Also emit startup signal (for phase-change)
      await emitStartupSignal({
        startup_id: startup.id,
        signal_type: 'press',
        weight: 1.2,
        meta: {
          source: 'investor_blog',
          article_url: article.url
        }
      });
    }
  }
}

// =====================================================
// Example 3: Search Result Tracker
// =====================================================

async function trackSearchResults(query, results) {
  // When investors search for startups (or we simulate search ranking)
  
  for (const result of results) {
    const startup = await resolveStartup(result.url);
    
    if (startup && result.viewedByInvestors) {
      for (const investorId of result.viewedByInvestors) {
        // EMIT: search event
        await emitObserverEvent({
          investor_id: investorId,
          startup_id: startup.id,
          source: 'search',
          meta: {
            query,
            rank: result.rank,
            clicked: result.clicked
          }
        });
      }
    }
  }
}

// =====================================================
// Example 4: Forum/HN Mention Scraper
// =====================================================

async function scrapeForumMentions(forumUrl) {
  const posts = await fetchForumPosts(forumUrl);
  
  for (const post of posts) {
    // Extract startup mentions
    const startups = await extractStartupMentions(post.content);
    
    // Extract investor firm mentions
    const investors = await extractInvestorMentions(post.content);
    
    // Create cross-product (investor saw startup mentioned)
    for (const investor of investors) {
      for (const startup of startups) {
        // EMIT: forum event
        await emitObserverEvent({
          investor_id: investor.id,
          startup_id: startup.id,
          source: 'forum',
          meta: {
            forum: 'hackernews',
            post_url: post.url,
            post_title: post.title,
            post_date: post.created
          }
        });
      }
    }
    
    // Also emit startup signal
    for (const startup of startups) {
      await emitStartupSignal({
        startup_id: startup.id,
        signal_type: 'forum_post',
        weight: 0.8,
        meta: {
          forum: 'hackernews',
          post_url: post.url
        }
      });
    }
  }
}

// =====================================================
// Example 5: Website Diff Detector (Phase-Change)
// =====================================================

async function detectWebsiteChanges(startupId, oldHtml, newHtml) {
  const changes = compareHtml(oldHtml, newHtml);
  
  if (changes.significantChange) {
    // EMIT: website_diff signal
    await emitStartupSignal({
      startup_id: startupId,
      signal_type: 'website_diff',
      weight: 1.5,
      meta: {
        change_type: changes.type,
        sections_changed: changes.sections,
        detected_at: new Date().toISOString()
      }
    });
    
    console.log(`✅ Website change detected: ${startupId}`);
  }
}

// =====================================================
// Example 6: Investor Site "Similar Startups" Section
// =====================================================

async function scrapeInvestorSimilarStartups(investorId, categoryUrl) {
  // When investor site has "Companies we're watching" or similar
  
  const startups = await fetchCategoryPage(categoryUrl);
  
  for (const startup of startups) {
    // EMIT: browse_similar event
    await emitObserverEvent({
      investor_id: investorId,
      startup_id: startup.id,
      source: 'browse_similar',
      meta: {
        category_url: categoryUrl,
        category: startup.category,
        discovered_at: new Date().toISOString()
      }
    });
  }
}

// =====================================================
// Integration Points for Existing Scrapers
// =====================================================

/**
 * ADD TO: server/scrapers/investor-enrichment.js
 * - When scraping portfolio → emit portfolio_overlap
 * - When scraping news → emit news
 */

/**
 * ADD TO: server/scrapers/rss-scraper.js (continuous-scraper.js)
 * - When article mentions startup → emit startup_signal('press')
 * - When article links investors → emit observer events
 */

/**
 * ADD TO: server/scrapers/discovered-startup-processor.js
 * - When processing new startup → emit startup_signal('website_diff')
 * - When enriching data → emit startup_signal('api_launch', 'hiring', etc.)
 */

/**
 * ADD TO: server/services/matchingService.ts
 * - When building matches → emit browse_similar for high-scoring pairs
 * - When investor queries sector → emit search events
 */

module.exports = {
  scrapeInvestorPortfolio,
  scrapeInvestorNews,
  trackSearchResults,
  scrapeForumMentions,
  detectWebsiteChanges,
  scrapeInvestorSimilarStartups
};
