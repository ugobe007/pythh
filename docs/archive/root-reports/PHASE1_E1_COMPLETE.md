# Phase 1 E1 Enhancements - Complete ✅

## What Was Implemented

### E1.1: RSS/Blog Feeds from Company Domains ✅
**File**: `scripts/pythia/collect-from-company-domains.js`

**Features:**
- ✅ Discovers RSS feeds via: /feed, /rss.xml, /blog/rss, sitemap.xml
- ✅ Stores posts as Tier 2 (semi-earned) by default
- ✅ Founder-authored posts detected (can be marked Tier 1.5 or high confidence Tier 2)
- ✅ Saves to `pythia_speech_snippets` table

**Usage:**
```bash
npm run pythia:collect:domains
# or
node scripts/pythia/collect-from-company-domains.js [limit]
```

### E1.2: HN Algolia Domain-First Search ✅
**File**: `scripts/pythia/collect-from-forums.js` (enhanced)

**Changes:**
- ✅ Domain search prioritized over name search
- ✅ Source ladder implemented: Tier 1 (founder voice) OR Tier 2 (relevant discussion)
- ✅ No longer throws away relevant technical/market discussion
- ✅ Dynamic tier assignment (1 or 2) based on signals

**Key Improvement:**
- Before: Only saved Tier 1 founder-like comments
- After: Saves Tier 1 founder voice AND Tier 2 relevant discussion
- Result: More coverage, better confidence scoring

### E2: Feature Health Check + Observability ✅
**File**: `scripts/pythia/pythia-health-check.js`

**Metrics Reported:**
- ✅ Snippets collected per day
- ✅ Tier distribution (1/2/3 percentages)
- ✅ % snippets with constraint markers
- ✅ % with mechanism markers
- ✅ % with reality contact markers
- ✅ Top sources by yield
- ✅ Context distribution
- ✅ Unique entities with snippets
- ✅ Average snippets per entity

**Usage:**
```bash
npm run pythia:health
# or
node scripts/pythia/pythia-health-check.js [days]
```

## Source Ladder Implementation

The system now implements a proper source ladder:

1. **Tier 1**: Founder voice (founder-like comments, founder-authored blog posts)
2. **Tier 2**: Market/technical discussion (relevant HN discussions, company blog posts)
3. **Tier 3**: PR/press quotes (already implemented via RSS articles)

This gives PYTHIA:
- More evidence per entity
- Better confidence scoring
- Higher coverage without sacrificing quality

## Next Steps (Phase 2)

1. **C1**: GitHub org/repo enrichment
2. **C2**: Careers/jobs page signals
3. **C3**: Docs/changelog signals

Then Phase 3: Module D (Deal graph expansion)

---

*Phase 1 E1 enhancements complete. Ready for Phase 2 (Module C).*
