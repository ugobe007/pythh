# New Scraper Sources to Add
*Added: February 13, 2026*

## 🎯 High-Priority Portfolio Directories

### Y Combinator Companies
- **URL**: https://www.ycombinator.com/companies
- **Type**: Portfolio directory (web scraping needed)
- **Value**: Premier accelerator with 4,000+ companies
- **Data**: Company name, description, batch, industry, location, funding stage
- **Status**: ⏳ TODO - Create dedicated YC scraper
- **Note**: Existing `speedrun-yc-scraper.mjs` can be enhanced

### Citris Foundry Portfolio
- **URL**: https://citrisfoundry.org/portfolio/
- **Type**: Portfolio directory (web scraping needed)
- **Value**: Berkeley accelerator with deep-tech focus
- **Data**: Startup profiles, technology focus, team info
- **Status**: ⏳ TODO - Create Citris scraper

### SkyDeck Berkeley Portfolio  
- **URL**: https://skydeck.berkeley.edu/portfolio/
- **Type**: Portfolio directory (web scraping needed)
- **Value**: Berkeley accelerator, high-quality startups
- **Data**: Company profiles, batch info, sector
- **Status**: ⏳ TODO - Create SkyDeck scraper

---

## 💼 New Investor Portfolio Sources

### Alsop Louie Partners
- **Main**: https://www.alsop-louie.com
- **Portfolio**: https://www.alsop-louie.com/portfolio
- **Focus**: Enterprise software, cybersecurity, infrastructure
- **Type**: Web scraping needed
- **Status**: ⏳ TODO - Create scraper

### Bee Partners
- **Main**: https://beepartners.vc
- **Portfolio**: https://beepartners.vc/portfolio
- **Focus**: Enterprise SaaS, fintech, AI/ML
- **Type**: Web scraping needed
- **Status**: ⏳ TODO - Create scraper

### SkyDeck VC Fund
- **Main**: https://skydeck.vc
- **Portfolio**: https://skydeck.vc/portfolio
- **Focus**: Berkeley-affiliated fund
- **Type**: Web scraping needed
- **Status**: ⏳ TODO - Create scraper
- **Note**: Related to SkyDeck accelerator above

---

## 💡 Inspiration: Coaching Matching

### Exponent Coaching
- **URL**: https://www.tryexponent.com/coaching
- **Type**: Coaching marketplace
- **Insight**: Similar matching concept to Hot Honey
- **Possible Feature**: "pythh coaching matching service" - match founders with mentors/coaches
- **Status**: 💭 IDEA - Could inspire new product direction

---

## 🚀 Implementation Plan

### Phase 1: Quick Wins (RSS Feeds)
These sources don't have RSS - need web scraping:
```bash
# None of these have RSS feeds - all require custom scrapers
```

### Phase 2: Build Portfolio Scrapers
Priority order:
1. **Y Combinator** - Highest value (4,000+ companies)
2. **SkyDeck Berkeley** - Good quality, medium size
3. **Citris Foundry** - Deep-tech focus
4. **Alsop Louie** - VC portfolio
5. **Bee Partners** - VC portfolio  
6. **SkyDeck VC** - VC portfolio

### Phase 3: Integration
- Add to `unified-scraper-orchestrator.js`
- Schedule daily runs via PM2
- Dedupe against existing startups

---

## 🗑️ Data Quality Notes

### Junk Startups to Filter
- **"Walmart-Backed 'Super"** - Not a startup (corporate spinoff)
- **"Symphonic Capital"** - Investment firm, not a startup

### Filter Rules Needed
```javascript
// Add to scraper validation:
const BLACKLIST_PATTERNS = [
  /walmart.*backed/i,
  /symphonic capital/i,
  // Add more as discovered
];

function isJunkStartup(name, description) {
  return BLACKLIST_PATTERNS.some(pattern => 
    pattern.test(name) || pattern.test(description)
  );
}
```

---

## 📋 Next Actions

- [ ] Create YC scraper (extend `speedrun-yc-scraper.mjs`)
- [ ] Create SkyDeck scraper  
- [ ] Create Citris scraper
- [ ] Create investor portfolio scrapers (Alsop Louie, Bee Partners, SkyDeck VC)
- [ ] Add junk startup filters
- [ ] Integrate with orchestrator
- [ ] Test full pipeline
- [ ] Consider coaching matching feature

---

## 🔗 Related Files
- `/scripts/speedrun-yc-scraper.mjs` - Starting point for YC scraper
- `/server/services/rssScraper.ts` - RSS feed definitions
- `/scripts/core/simple-rss-scraper.js` - Main RSS scraper
- `/PREMIUM_SOURCES_ADDED.md` - Previously added sources
