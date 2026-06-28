# 📊 Pythia Snippet Collection Guide

## Overview

To get high-quality Pythia scores, you need diverse speech snippets from multiple sources and tiers. This guide explains how to collect snippets from various sources.

---

## Source Tiers

### Tier 1 (Earned / Hard to Fake) - **Highest Value**
- **Live Q&A transcripts** - Unscripted answers
- **Forum posts** (Hacker News, Reddit, Stack Overflow)
- **Support threads** - Founder responding to customer issues
- **Postmortems** - "We were wrong" articles
- **Investor letters** (if authentic/verified)
- **Hostile interviews** - Hard questioning, no PR filter

### Tier 2 (Semi-Earned) - **Good Value**
- **Podcast transcripts** - Usually lightly edited
- **Conference talks** - Recorded presentations
- **Long-form founder essays** - Blog posts with depth
- **Social media threads** - Twitter/X threads, LinkedIn posts
- **Authentic internal memos** (if verified)

### Tier 3 (PR/Marketed) - **Lower Value (but still useful)**
- **Press quotes in articles** - Company statements
- **Company blog announcements** - Marketing content
- **Marketing pages** - Website copy
- **PR wire releases** - Press releases
- **Launch posts** - Polished announcements

---

## Collection Scripts

### 1. Startup Profiles (Tier 3)
```bash
npm run pythia:collect
```
- Collects from `startup_uploads` table
- Uses: description, pitch, tagline
- Tier: 3 (PR/marketing)
- Quick to run, but lower signal quality

### 2. RSS Articles (Tier 3)
```bash
npm run pythia:collect:rss
```
- Extracts quotes from RSS articles
- Matches articles to startups by name
- Tier: 3 (press quotes)
- Good for volume, moderate signal

### 3. Company Blogs (Tier 3)
```bash
npm run pythia:collect:blogs
```
- Collects from company blog RSS feeds
- Uses: description, blog post content
- Tier: 3 (PR/marketing)
- Moderate signal quality

### 4. Forum Posts (Tier 1) ✅ NEW
```bash
npm run pythia:collect:forums
```
- Collects from Hacker News (Reddit coming soon)
- Uses: Algolia HN Search API (free)
- Tier: 1 (earned/hard-to-fake) ⭐
- High signal quality - founder discussions
- **Best for improving Pythia scores!**

### 5. Collect All (Combined)
```bash
npm run pythia:collect:all
```
- Runs startup profiles + RSS articles + blogs
- Best for initial data collection

---

## Future Collection Sources (Not Yet Implemented)

### Social Media (Tier 2)
- Twitter/X threads
- LinkedIn posts
- Reddit AMAs
- **Script**: `scripts/pythia/collect-from-social.js` (placeholder)

### Podcast Transcripts (Tier 2)
- YouTube transcripts
- Podcast hosting platforms
- **Requires**: Transcript API or scraping

### Forum Posts (Tier 1) ✅
- Hacker News comments ✅
- Reddit posts/comments (planned)
- Stack Overflow answers (planned)
- **Script**: `scripts/pythia/collect-from-forums.js`
- **Usage**: `npm run pythia:collect:forums` or `node scripts/pythia/collect-from-forums.js [limit] [source]`

### Support Threads (Tier 1)
- GitHub issues (founder responses)
- Discord/Slack public channels
- Customer support forums
- **Requires**: API access

---

## Collection Workflow

### Step 1: Initial Collection
```bash
# Collect from startup profiles (quick, Tier 3)
npm run pythia:collect

# Collect from RSS articles (moderate, Tier 3)
npm run pythia:collect:rss

# Or both at once
npm run pythia:collect:all
```

### Step 2: Score Entities
```bash
npm run pythia:score
```

### Step 3: Sync to Startups
```bash
npm run pythia:sync
```

### Step 4: Re-run GOD Scoring
```bash
npm run score
```

---

## Tips for Better Scores

1. **Prioritize Tier 1/2 Sources**: Focus on collecting from podcasts, forums, and support threads for higher signal quality.

2. **Volume Matters**: More snippets = higher confidence scores (up to a point).

3. **Diversity Matters**: Multiple contexts (press, product, technical) = higher confidence.

4. **Time Span Matters**: Snippets spanning weeks/months = higher confidence than all from one day.

5. **Tier Mix Matters**: Having Tier 1/2 snippets validates Tier 3 claims.

---

## Current Status

✅ **Implemented:**
- Startup profiles collection (Tier 3)
- RSS articles collection (Tier 3)
- Scoring engine
- Sync to startup_uploads
- Integration with GOD scoring

✅ **Recently Implemented:**
- Forum post collection (Hacker News) - Tier 1 source
- Company blog collection (RSS feeds) - Tier 3 source

⏳ **To Implement:**
- Social media scraping (Twitter, LinkedIn) - Tier 2
- Podcast transcript extraction - Tier 2
- Reddit collection - Tier 1
- Support thread collection - Tier 1

---

*Last Updated: January 2026*
