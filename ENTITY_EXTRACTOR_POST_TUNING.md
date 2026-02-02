# Entity Extractor - Post-Tuning Results

## Test Run: January 25, 2026 (After High-Priority Fixes)

### ✅ IMPROVEMENTS (3 fixed)
```
1. "VC investment in emerging..." → ❌ NONE (was: VC) ✅ FIXED
2. "India scraps 'angel tax'..." → ❌ NONE (was: India) ✅ FIXED  
3. "Ola Electric" → Still rejected but "Ola Electric" already in BRAND_DICTIONARY
```

### ✅ PERFECT EXTRACTIONS (8/15)
```
1. KPay                    | 1.00 | brand_dictionary_hit ✅
2. Antler                  | 1.00 | brand_dictionary_hit ✅
3. Waymo                   | 1.00 | brand_dictionary_hit ✅
4. Zipline                 | 1.00 | brand_dictionary_hit ✅
5. Databricks              | 1.00 | brand_dictionary_hit ✅
6. Charles Merrimon As CEO | NONE | job_title_contamination ✅ CORRECT REJECTION
7. Helen Cai As CFO        | NONE | job_title_contamination ✅ CORRECT REJECTION
8. Adam Presser CEO        | NONE | job_title_contamination ✅ CORRECT REJECTION
```

### ⚠️ STILL NEEDS TUNING (4 cases)

#### 1. "Ola Electric stock tumbles..." → ❌ NONE
**Issue**: Still rejected as "person_name_pattern" even though "Ola Electric" is in BRAND_DICTIONARY
**Root cause**: Person name rejection happens in `hardReject()` BEFORE scoring reaches brand dictionary
**Fix**: Brand dictionary check should happen BEFORE person name heuristic
```typescript
// In hardReject(), add early exit:
function hardReject(candidate: string): string | null {
  const c = candidate.trim();
  if (!c) return "empty";
  
  // ⭐ NEW: Brand dictionary overrides all hard rejects
  if (BRAND_DICTIONARY.has(c)) return null;
  
  if (isQuoteFragment(c)) return "quote_fragment";
  if (isStopFragment(c)) return "stop_fragment";
  if (containsJobTitleTokens(c)) return "job_title_contamination";
  if (looksLikePersonName(c)) return "person_name_pattern";
  // ...
}
```

#### 2. "General Catalyst merges with Venture Highway..." → ❌ NONE
**Issue**: Both companies rejected as "person_name_pattern"
**Root cause**: Same as #1 - "General Catalyst" and "Venture Highway" are in BRAND_DICTIONARY but rejected before scoring
**Fix**: Same as #1 - brand dictionary check in hardReject()

#### 3. "Google invests $350M in... Flipkart" → Google
**Issue**: Still extracting Google (investor) instead of Flipkart (target)
**Expected**: Flipkart
**Root cause**: 
- Both have 1.00 confidence (brand dictionary)
- Google at title prefix gets +0.30 boost
- "Invests in X" target preference not strong enough
**Fix**: Add explicit boost for "invests in X" pattern
```typescript
// In scoreCandidate(), add:
const investsInPattern = /invests?\s+.*?\s+in\s+/i;
if (investsInPattern.test(title)) {
  const match = investsInPattern.exec(title);
  if (match) {
    const afterIn = title.slice(match.index + match[0].length);
    if (afterIn.toLowerCase().includes(candidate.toLowerCase())) {
      score += 0.40; // ⭐ STRONG boost for "invests in X" target
      reasons.push("invests_in_target");
    }
  }
}
```

#### 4. "Workday CEO calls narrative..." → AI
**Issue**: Extracting "AI" (from quote) instead of "Workday"
**Expected**: "Workday"
**Root cause**: "Workday CEO" → "CEO" triggers job_title_contamination
**Analysis**: This is tricky - we DO want to reject "names Adam Presser CEO" but NOT "Workday CEO says..."
**Heuristic**: If job title is the LAST token and there's context after, it's descriptive, not contamination
```typescript
function containsJobTitleTokens(text: string): boolean {
  const tokens = text.trim().split(/\s+/);
  const t = text.toLowerCase();
  
  // If job title is LAST token and text is only 2 tokens, it's contamination
  // "Adam Presser CEO" → reject
  // "Workday CEO" (in larger context) → allow
  if (tokens.length === 2) {
    const lastToken = tokens[1].toLowerCase();
    if (JOB_TITLE_TOKENS.includes(lastToken)) return true;
  }
  
  // If "Names X As Y" pattern, always reject
  if (/\bnames?\b/i.test(t) && /\bas\b/i.test(t)) return true;
  
  return false;
}
```

## Critical Fix: Brand Dictionary Priority

The most important fix is making brand dictionary checks happen BEFORE hard rejects:

```typescript
/** Hard reject gate: if true, the candidate is thrown out immediately */
function hardReject(candidate: string): string | null {
  const c = candidate.trim();
  if (!c) return "empty";

  // ⭐ CRITICAL: Brand dictionary overrides all other hard rejects
  // This fixes: "Ola Electric", "General Catalyst", "Venture Highway"
  if (BRAND_DICTIONARY.has(c)) return null;

  if (isQuoteFragment(c)) return "quote_fragment";
  if (isStopFragment(c)) return "stop_fragment";
  if (containsJobTitleTokens(c)) return "job_title_contamination";
  if (looksLikePersonName(c)) return "person_name_pattern";
  // ... rest of checks
}
```

## Apply Critical Fix

Let me apply this fix now and re-test:
