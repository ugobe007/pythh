# Critical Fixes Applied ✅

**All fixes from user's detailed bug list have been applied.**

## Step 1: Fixed Health Check Reality Bug (CRITICAL)
**File**: `scripts/pythia/pythia-health-check.js`

**Issue**: `hasRealityContactMarkers()` was checking for `hasNumbers` and `hasShippingVerbs` which don't exist in the feature extractor output.

**Fix**: Changed to check actual fields from `extractRealityContact()`:
```javascript
function hasRealityContactMarkers(text) {
  const features = extractAllFeatures(text);
  const r = features.reality;
  return !!(r.hasMetrics || r.hasExperiments || r.hasShipping || r.hasPostmortem || r.count > 0);
}
```

**Impact**: Reality contact markers will now show correctly in health reports (was 0%, now will be accurate).

## Step 2: Fixed E1.1 Domain Hygiene + Context Label Bug
**File**: `scripts/pythia/collect-from-company-domains.js`

### A. Domain Hygiene
- Added `NEWS_HOSTS` blacklist (pulse2.com, tech.eu, techcrunch.com, etc.)
- Added `normalizeCompanyDomain()` function to reject news hosts
- Updated `collectFromCompanyDomain()` to use normalized domain
- **Impact**: Stops trying to discover RSS feeds on publisher/article URLs

### B. Context Label Bug
- Fixed: `context_label: snippet.context` → `context_label: snippet.context_label`
- **Impact**: Context distribution in health check will now be accurate (was showing "undefined")

## Step 3: Improved RSS Discovery
**File**: `scripts/pythia/collect-from-company-domains.js`

**Change**: Replaced `axios.head()` with `axios.get()` using byte range (0-4096) to sniff for `<rss`, `<feed`, or `<?xml`.

**Impact**: Will detect feeds that:
- Don't respond to HEAD (405)
- Return text/html content-type (but are valid XML)
- Redirect (301/302) to feeds

**Expected**: Increased feed discovery rate.

## Step 4: Added News Host Validation to HN Search
**File**: `scripts/pythia/collect-from-forums.js`

- Added same `NEWS_HOSTS` blacklist
- Added `normalizeCompanyDomain()` function
- Updated `collectFromHN()` to use normalized domain
- **Impact**: Prevents domain-first search from querying publisher domains (e.g., pulse2.com)

## Additional Fixes

### Apostrophe Normalization
**Files**: `scripts/pythia/utils/tier-classifier.js`, `scripts/pythia/feature-extractor.js`

**Fix**: Changed from `/['']/g` to `/[''`´]/g` to catch curly quotes and backticks.

### Tier Classifier Cleanup
**File**: `scripts/pythia/utils/tier-classifier.js`

- Removed dead `forum_post` Tier 1 logic (HN collector assigns tier directly)
- Kept Tier 1 for postmortems/support threads only

### Reality Contact Pattern Expansion
**File**: `scripts/pythia/feature-extractor.js`

- Improved money regex: `/\$\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*[kKmMbB]?\b/g` (catches $1.2M, $10,000)
- Added time units: `/\b\d+(?:\.\d+)?\s*(ms|s|secs?|minutes?|hours?|days?)\b/gi`

## Next Steps

Run the command sequence:
```bash
npm run pythia:health
npm run pythia:collect:domains 50
npm run pythia:health
npm run pythia:collect:forums 50
npm run pythia:health
```

**Expected Results**:
- ✅ Reality contact > 0% (immediately after health fix)
- ✅ Tier 2 > 0% (after domains collector tiering runs)
- ✅ Tier 1 begins appearing (after HN saves start)
- ✅ Context distribution shows real values (not "undefined")
- ✅ Increased RSS feed discovery rate
