# Phase-Change v1.0.0 Patches - Quick Reference

**Date:** January 25, 2026  
**Status:** ✅ ALL APPLIED  
**Test Coverage:** 12/12 (100%)  

---

## 🔧 Patch 1: Canonical Amount Regex

**Problem:** HK$2.5B detected as magnitude "M" instead of "B"  
**Fix:** Single-pass regex capturing currency + numeric + magnitude  
**File:** `src/services/rss/frameParser.ts` (lines 176-260)  

**Key Functions:**
- `normalizeMagnitude(token)` → "K" | "M" | "B"
- `normalizeCurrency(prefix)` → "USD" | "HKD" | "EUR" | "GBP" | "INR"

**Invariant:** Magnitude NEVER re-derived after initial capture

**Test:**
```bash
"HK$2.5B" → currency: HKD, magnitude: "B" ✅
```

---

## 🚫 Patch 2: Milestone False Positive Filter

**Problem:** "following their Series C" treated as milestone  
**Fix:** Exclude financing rounds unless substantive tokens present  
**File:** `src/services/rss/frameParser.ts` (lines 293-367)  

**Exclusion Regex:**
```typescript
const ROUND_MENTION_RE = /\b(pre[-\s]?seed|seed|angel|series\s+[a-e]|...)\b/i;
```

**Substantive Tokens:** users, customers, revenue, ARR, MRR, GMV, installs, etc.

**Test:**
```bash
"following their Series C" → NO semantic context ✅
"after achieving 100M users" → milestone emitted ✅
```

---

## 📦 Patch 3: Distribution Deal Patterns

**Problem:** "signs distribution deal with" not recognized (FILTERED)  
**Fix:** Added DIRECTIONAL patterns mapping to CONTRACT  
**File:** `src/services/rss/frameParser.ts` (lines 558-590, 376-390)  

**New Patterns:**
- `signs_distribution_deal_with` (90% confidence)
- `distribution_deal_with` (85% confidence)
- `signs_deal_with` (80% confidence)

**Event Type Mapping:**
```typescript
if (id.includes("distribution_deal") || id.includes("signs_deal")) 
  return "CONTRACT";
```

**CHANNEL Role:** Whole Foods, Amazon, Walmart, Target, etc.

**Test:**
```bash
"signs distribution deal with Whole Foods" → CONTRACT + CHANNEL ✅
```

---

## 🧪 Regression Tests

**File:** `scripts/demo-v1.0.0.ts` (4 new tests)

1. ✅ HK$ magnitude validation
2. ✅ Series round exclusion
3. ✅ Substantive milestone requirement
4. ✅ Distribution deal pattern matching

---

## 🚀 Quick Commands

**Build:**
```bash
npm run build
```

**Run Demo:**
```bash
npx tsx scripts/demo-v1.0.0.ts
```

**Expected Output:**
```
📊 Results: 12/12 passed
```

---

## 📋 Checklist

- [x] Patch 1: HK$ magnitude fix
- [x] Patch 2: Milestone exclusion
- [x] Patch 3: Distribution deal patterns
- [x] Build passes
- [x] Tests pass (12/12)
- [x] Documentation updated
- [x] SSOT compliance maintained
- [ ] Deploy to staging
- [ ] Phase-Change integration test
- [ ] Deploy to production

---

*Quick Reference - January 25, 2026*
