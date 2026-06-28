# PYTHIA Forum Collection Implementation ✅

## What Was Built

### 1. Hacker News Collection Script
- **File**: `scripts/pythia/collect-from-forums.js`
- **Status**: ✅ Complete and ready to use
- **Source**: Tier 1 (earned/hard-to-fake)
- **API**: Algolia HN Search API (free, no API key required)

### 2. Features Implemented

#### Search & Filtering
- ✅ Searches Hacker News for startup name mentions
- ✅ Uses Algolia HN Search API (free, public)
- ✅ Filters for substantive comments (100-2000 chars)
- ✅ Requires first-person language or company references
- ✅ Must mention startup name or key words
- ✅ Skips spam, code-only, URL-heavy posts

#### Data Quality
- ✅ Deduplication via text hash
- ✅ Limits to 10 snippets per startup (quality over quantity)
- ✅ Stores as Tier 1 snippets (highest trust)
- ✅ Includes source URL and date
- ✅ Context label: "technical"

#### Rate Limiting
- ✅ 1 second delay between startups (respectful API usage)
- ✅ Error handling and retries
- ✅ Progress reporting every 10 startups

### 3. NPM Script Added
- **Command**: `npm run pythia:collect:forums`
- **Usage**: Collects from Hacker News (Reddit planned for future)

### 4. Documentation Updated
- ✅ `PYTHIA_COLLECTION_GUIDE.md` - Added forum collection section
- ✅ `FORUM_COLLECTION_README.md` - Complete guide for forum collection
- ✅ `PYTHIA_EXPANSION_PLAN.md` - Implementation plan

## How to Use

### Basic Usage
```bash
# Collect from 50 startups (default)
npm run pythia:collect:forums

# Or with custom limit
node scripts/pythia/collect-from-forums.js 100
```

### Complete Workflow
```bash
# 1. Collect forum posts (Tier 1)
npm run pythia:collect:forums

# 2. Score entities with new snippets
npm run pythia:score

# 3. Sync scores to startup_uploads
npm run pythia:sync

# 4. Re-run GOD scoring to include Pythia scores
npm run score
```

## Expected Impact

### Current State
- **Average Pythia Score**: ~1.5/100
- **Tier Distribution**: 100% Tier 3 (marketing/PR)
- **Confidence**: Low (sparse data, all Tier 3)

### After Forum Collection
- **Expected Average**: 20-40+/100
- **Tier Distribution**: ~30-50% Tier 1 (forum posts)
- **Confidence**: Higher (more diverse, higher-tier data)
- **Impact on GOD Scores**: +1-5 points (from Pythia contribution)

## Technical Details

### API Used
- **Hacker News Search**: Algolia HN Search API
- **URL**: `https://hn.algolia.com/api/v1/search`
- **Cost**: Free (public API)
- **Rate Limits**: None (but script uses 1s delay)
- **No Authentication Required**: ✅

### Data Stored
- **Table**: `pythia_speech_snippets`
- **source_type**: `forum_post`
- **tier**: `1` (earned/hard-to-fake)
- **context_label**: `technical`
- **text_hash**: MD5 hash for deduplication

### Filters Applied
1. **Length**: 100-2000 characters
2. **Language**: First-person ("we", "I", "our") or company references
3. **Startup Name**: Must mention startup name or key words
4. **Quality**: Skips spam, code-only, URL-heavy posts
5. **Deduplication**: Text hash prevents duplicates

## Next Steps

### Reddit Collection (Future)
- Similar structure to HN collection
- Use Reddit JSON API (free, public)
- Focus on r/startups, r/entrepreneur, r/startup, etc.
- Same filtering and quality standards

### Other Tier 1 Sources (Future)
- Postmortems (failory.com, postmortem.news)
- Support threads (if API access available)
- Investor letters (if sources identified)
- Q&A transcripts (AMA threads)

## Testing

To test the script:
```bash
# Test with 5 startups (quick test)
node scripts/pythia/collect-from-forums.js 5

# Check results in database
# Query: SELECT * FROM pythia_speech_snippets WHERE source_type = 'forum_post' ORDER BY created_at DESC LIMIT 10;
```

## Notes

- Script is ready to use - no API keys required
- Rate limiting is built in (1s delay between startups)
- Error handling prevents crashes
- Progress reporting shows status
- Quality filters ensure high-signal snippets

---

*Implementation Date: January 2026*
*Status: ✅ Complete and Ready*
