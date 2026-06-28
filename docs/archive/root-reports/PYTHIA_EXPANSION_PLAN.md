# PYTHIA Collection Expansion Plan

## Current Status

### ✅ Completed Sources
- **Tier 3**: Company blogs (RSS feeds), Press quotes (RSS articles), Startup profiles

### 🚧 In Progress
- **Tier 3**: Company blogs (RSS feeds) - ✅ Script created

### 📋 To Implement (Tier 1 & 2)

## Tier 1 Sources (Highest Value - Earned/Hard-to-Fake)

### 1. Forum Posts (Hacker News, Reddit)
**Priority**: High  
**Difficulty**: Medium  
**Approach**: 
- Scrape HN/Reddit for startup names
- Extract comment threads where founders post
- Filter for substantive posts (100+ chars, first-person language)
- Match to startups using name matching

**Script**: `scripts/pythia/collect-from-forums.js`

### 2. Support Threads
**Priority**: Medium  
**Difficulty**: High  
**Approach**:
- Integrate with support platforms (Intercom, Zendesk APIs if available)
- Extract public support threads
- Filter for founder/executive responses
- Requires API keys or public forum access

**Script**: `scripts/pythia/collect-from-support.js`

### 3. Postmortems
**Priority**: High  
**Difficulty**: Medium  
**Approach**:
- Scrape known postmortem sources (failory.com, postmortem.news, HN "Show HN" with "shut down")
- Extract founder-written postmortems
- High-value Tier 1 content
- Match by startup name

**Script**: `scripts/pythia/collect-from-postmortems.js`

### 4. Investor Letters
**Priority**: Medium  
**Difficulty**: High  
**Approach**:
- Scrape public investor update letters (some VCs publish these)
- Extract founder-written sections
- Requires manual source identification

**Script**: `scripts/pythia/collect-from-investor-letters.js`

### 5. Q&A Transcripts
**Priority**: Low  
**Difficulty**: Medium  
**Approach**:
- Scrape AMA threads (Reddit, HN Ask Me Anything)
- Extract Q&A sessions from conferences
- Match by founder/startup name

**Script**: `scripts/pythia/collect-from-qa.js`

## Tier 2 Sources (Semi-Earned)

### 1. Podcast Transcripts
**Priority**: High  
**Difficulty**: High  
**Approach**:
- Integrate with podcast transcript APIs (Descript, Otter.ai, or manual transcripts)
- Match episodes to startups by guest names
- Extract founder quotes/statements
- Requires transcript source or API

**Script**: `scripts/pythia/collect-from-podcasts.js`

### 2. Conference Talks
**Priority**: Medium  
**Difficulty**: High  
**Approach**:
- Scrape conference video transcripts (YouTube, conference sites)
- Extract speaker transcripts for founders
- Requires YouTube API or transcript sources
- Match by speaker name to startup

**Script**: `scripts/pythia/collect-from-conferences.js`

### 3. Social Media Posts (Twitter/X, LinkedIn)
**Priority**: High  
**Difficulty**: High  
**Approach**:
- Twitter/X API (requires API keys, paid tier for volume)
- LinkedIn posts (requires API access or scraping)
- Filter for substantive posts (not just announcements)
- Extract founder-written content
- Match by handle to startup

**Script**: `scripts/pythia/collect-from-social.js` (placeholder exists)

## Implementation Priority

### Phase 1: Easier Wins (Start Here)
1. ✅ **Company Blogs** - Done
2. **Forum Posts (HN/Reddit)** - Medium difficulty, high value
3. **Postmortems** - Medium difficulty, very high value

### Phase 2: Moderate Complexity
4. **Social Media (Twitter/X)** - Requires API keys
5. **Podcast Transcripts** - Requires transcript sources

### Phase 3: Complex/Requires Infrastructure
6. **Support Threads** - Requires API integration
7. **Conference Talks** - Requires video/transcript sources
8. **Investor Letters** - Requires manual source curation
9. **Q&A Transcripts** - Medium complexity

## Recommended Next Steps

1. **Start with Forum Posts (HN/Reddit)**
   - Highest value Tier 1 source
   - Publicly accessible
   - No API keys required (for basic scraping)
   - Can match by startup name

2. **Add Postmortems**
   - Very high value (founder introspection)
   - Limited sources but high quality
   - Good for Tier 1 data

3. **Explore Social Media APIs**
   - Twitter/X API v2 (paid tier may be needed)
   - LinkedIn API (limited access)
   - High volume potential

## Implementation Notes

- All scripts should follow the pattern of `collect-from-rss.js`
- Use same deduplication (text_hash)
- Match to startups using name matching
- Store with appropriate `source_type` and `tier`
- Include `context_label` for filtering

## Current Collection Stats

- **Total Snippets**: ~1,000
- **Tier 1**: 0 (0%)
- **Tier 2**: 0 (0%)
- **Tier 3**: 1,000 (100%)

## Goals

- **Target**: 50%+ Tier 1/2 data within 3 months
- **Priority**: Focus on Tier 1 sources first (forum posts, postmortems)
- **Impact**: Should raise average Pythia scores from 1.5 to 20-40+
