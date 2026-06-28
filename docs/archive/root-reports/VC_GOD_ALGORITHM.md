# 🎯 VC GOD ALGORITHM & STARTUP SOURCES

## Overview

This update adds two major capabilities:

1. **VC GOD Algorithm** - Scores and ranks investors just like we score startups
2. **Expanded Startup Sources** - 57+ sources for discovering new startups

---

## 🏆 VC GOD Algorithm

### What It Does

Evaluates VCs/investors on a 0-10 scale based on:

| Component | Weight | Criteria |
|-----------|--------|----------|
| **Track Record** | 0-3 | Total investments, exits, exit rate |
| **Activity Level** | 0-2 | Investment pace, recent activity |
| **Fund Health** | 0-2 | Fund size, dry powder (capital available) |
| **Sector Expertise** | 0-1.5 | Focus depth, investment thesis clarity |
| **Responsiveness** | 0-1.5 | Response time, decision maker status |

### Investor Tiers

- **Elite** (8-10): Top-tier VCs with exceptional track records
- **Strong** (6-8): Established VCs with solid performance
- **Solid** (4-6): Active investors with proven exits
- **Emerging** (0-4): Newer or less-active investors

### Files

| File | Purpose |
|------|---------|
| `server/services/investorScoringService.ts` | VC GOD algorithm (TypeScript) |
| `calculate-investor-scores.js` | Batch score all investors |

### Commands

```bash
# Calculate/update all investor scores
node calculate-investor-scores.js

# Check top investors
node exec-sql.js "SELECT name, firm, investor_score, investor_tier FROM investors ORDER BY investor_score DESC LIMIT 20"
```

---

## 🔄 Bidirectional Matching

The matching engine now uses **bidirectional quality scoring**:

```
Total Score = 40% × Startup GOD + 20% × Investor GOD + 40% × Fit Score
```

### Match Tiers

| Tier | Criteria | Meaning |
|------|----------|---------|
| **Platinum** | Top startup + Elite VC + Great fit | Best possible match |
| **Gold** | Quality startup + Solid VC + Good fit | Strong match |
| **Silver** | Good fit despite lower quality | Worth pursuing |
| **Bronze** | Potential but needs validation | Review carefully |

### New Functions

```typescript
// Calculate bidirectional match score
calculateBidirectionalMatchScore(startup, investor, verbose)

// Generate matches sorted by quality
generateBidirectionalMatches(startups, investors, limit)
```

---

## 📡 Startup Sources

### Source Categories

| Category | Count | Examples |
|----------|-------|----------|
| **Accelerators** | 22 | YC, Techstars, 500 Global |
| **Product Platforms** | 10 | Product Hunt, BetaList |
| **Funding Sources** | 4 | TechCrunch, Crunchbase |
| **Directories** | 4 | Wellfound, Angel.co |
| **VC Portfolios** | 13 | Sequoia, a16z, Greylock |
| **Universities** | 5 | Stanford, Berkeley, MIT |

### Priority Levels

- **Priority 1** (15 sources): Top accelerators, major platforms
- **Priority 2** (35 sources): Regional accelerators, niche platforms
- **Priority 3** (7 sources): Smaller directories, less active sources

### Files

| File | Purpose |
|------|---------|
| `startup-sources.js` | Source definitions & categories |
| `scrape-startup-sources.js` | Batch scraper |

### Commands

```bash
# Show all sources
node startup-sources.js

# Scrape priority 1 only (fastest)
node scrape-startup-sources.js 1

# Scrape priority 1+2 (default)
node scrape-startup-sources.js

# Scrape all sources
node scrape-startup-sources.js all
```

---

## 📊 Current Stats

```sql
-- Investors scored
SELECT investor_tier, COUNT(*) 
FROM investors 
GROUP BY investor_tier 
ORDER BY investor_tier;

-- Top VCs by score
SELECT name, firm, investor_score, successful_exits
FROM investors 
ORDER BY investor_score DESC 
LIMIT 10;
```

---

## 🚀 Next Steps

1. **Enrich investor data** - Add fund size, dry powder, activity dates
2. **Run startup scraper** - `node scrape-startup-sources.js`
3. **Test bidirectional matching** - Verify platinum matches
4. **Monitor scraper health** - Check for blocked sources

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    MATCHING ENGINE                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  Startup     │    │   FIT        │    │  Investor    │  │
│  │  GOD Score   │ +  │   Score      │ +  │  GOD Score   │  │
│  │  (0-100)     │    │  (0-100)     │    │  (0-100)     │  │
│  │              │    │              │    │              │  │
│  │  40% weight  │    │  40% weight  │    │  20% weight  │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│           │                  │                  │           │
│           └──────────────────┼──────────────────┘           │
│                              ▼                              │
│                    ┌──────────────┐                         │
│                    │ TOTAL SCORE  │                         │
│                    │   (0-99)     │                         │
│                    │              │                         │
│                    │ PLATINUM     │                         │
│                    │ GOLD         │                         │
│                    │ SILVER       │                         │
│                    │ BRONZE       │                         │
│                    └──────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```
