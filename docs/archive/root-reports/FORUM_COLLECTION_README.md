# Forum Post Collection for PYTHIA

## Overview

The forum collection script (`scripts/pythia/collect-from-forums.js`) collects Tier 1 snippets from Hacker News (and Reddit, coming soon). This is one of the highest-value sources for Pythia scoring because forum posts are **earned/hard-to-fake** content where founders genuinely discuss their startups.

## Why Forum Posts Matter

**Tier 1 Sources** (like forum posts) have the highest signal quality because:
- Founders write them directly (no PR filter)
- Unscripted, authentic language
- Technical discussions reveal real insights
- Hard to fake or game
- Often contain constraint language and mechanism details

**Impact on Pythia Scores:**
- Current average: ~1.5/100 (mostly Tier 3 data)
- Expected with Tier 1 data: 20-40+/100
- More Tier 1 data = higher confidence scores

## How It Works

### Hacker News Collection

1. **Search**: Uses Algolia HN Search API (free, public) to search for startup names
2. **Filter**: Extracts substantive comments (100+ chars, first-person language, startup references)
3. **Match**: Matches comments to startups by name
4. **Save**: Stores as Tier 1 snippets in `pythia_speech_snippets`

### Filters Applied

- **Length**: 100-2000 characters (substantive content)
- **Language**: Must contain first-person ("we", "I", "our") or company references
- **Startup Name**: Must mention the startup name or key words
- **Quality**: Skips spam, code-only posts, URL-heavy posts
- **Deduplication**: Uses text hash to prevent duplicates

## Usage

### Basic Usage
```bash
# Collect from Hacker News (default, 50 startups)
npm run pythia:collect:forums

# Or run directly
node scripts/pythia/collect-from-forums.js
```

### With Options
```bash
# Collect from 100 startups
node scripts/pythia/collect-from-forums.js 100

# Specify source (hn is default)
node scripts/pythia/collect-from-forums.js 50 hn
```

### After Collection
```bash
# Score the entities with new snippets
npm run pythia:score

# Sync scores to startup_uploads
npm run pythia:sync

# Re-run GOD scoring to include Pythia scores
npm run score
```

## API Used

### Hacker News (Algolia Search)
- **API**: `https://hn.algolia.com/api/v1/search`
- **Cost**: Free (public API)
- **Rate Limits**: None (but be respectful - 1 second delay between startups)
- **No API Key Required**: ✅

### Reddit (Planned)
- **API**: Reddit JSON API
- **Cost**: Free (public API)
- **Rate Limits**: 60 requests/minute (with user agent)
- **No API Key Required**: ✅ (for read-only access)

## Data Structure

Snippets are saved with:
- **source_type**: `forum_post`
- **tier**: `1` (earned/hard-to-fake)
- **context_label**: `technical` (forum posts are usually technical)
- **source_url**: Link to the HN comment/post
- **date_published**: When the comment was posted

## Expected Results

### Typical Collection Stats
- **Startups with results**: 10-30% (depends on startup visibility)
- **Snippets per startup**: 1-5 (filtered for quality)
- **Total snippets**: 50-150 per 50 startups
- **Time**: ~1-2 minutes per 50 startups (rate limiting)

### Quality Indicators
- ✅ First-person language ("we built", "I founded")
- ✅ Technical details and constraints
- ✅ Real problem-solving discussions
- ✅ Mechanism descriptions
- ✅ Reality contact markers

## Tips for Better Collection

1. **Run regularly**: New comments appear daily
2. **Focus on active startups**: More likely to have HN discussions
3. **Combine sources**: Use forum posts + RSS + blogs for best results
4. **Check manually**: Review a few snippets to verify quality

## Troubleshooting

### No Results Found
- **Reason**: Startup name not mentioned on HN
- **Solution**: This is normal - not all startups have HN presence
- **Alternative**: Try RSS articles or company blogs

### Low Snippet Count
- **Reason**: Filters are strict (quality over quantity)
- **Solution**: This is intentional - better to have fewer high-quality snippets

### API Errors
- **Reason**: Network issues or rate limiting
- **Solution**: Script has built-in error handling and retries
- **Wait**: HN API is generally very reliable

## Future Enhancements

- [ ] Reddit collection (r/startups, r/entrepreneur, etc.)
- [ ] Stack Overflow collection (founder answers)
- [ ] GitHub Discussions collection
- [ ] Better name matching (handles aliases, old names)
- [ ] Thread context (captures full discussion threads)
- [ ] Founder identification (match by username)

## Integration with Scoring

Forum posts significantly improve Pythia scores because they:
1. Provide Tier 1 data (highest trust)
2. Contain constraint language (technical limitations)
3. Reveal mechanisms (how things work)
4. Show reality contact (real problems, not marketing)

**Workflow:**
```bash
# 1. Collect forum posts
npm run pythia:collect:forums

# 2. Score entities
npm run pythia:score

# 3. Check improvements
npm run pythia:analyze

# 4. Sync to startups
npm run pythia:sync

# 5. Re-run GOD scoring
npm run score
```

---

*Last Updated: January 2026*
