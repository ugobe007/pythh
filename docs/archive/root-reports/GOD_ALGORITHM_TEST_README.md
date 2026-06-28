# 🧪 GOD Algorithm Test Suite - Quick Start

## 📁 Files Created

1. **`test-god-algorithm.ts`** - Node.js test suite (comprehensive)
2. **`public/test-god-algorithm.html`** - Browser-based test interface
3. **`src/services/matchingHelpers.ts`** - Test utilities and validation functions
4. **Enhanced logging in `src/services/matchingService.ts`** - Detailed console output

## 🚀 How to Run Tests

### Option 1: Browser Console Tests (Recommended ✅)

1. **Start the dev server:**
   ```bash
   npm run dev
   ```

2. **Navigate to the test page:**
   ```
   http://localhost:5173/test-god-algorithm.html
   ```

3. **Open browser console** (F12 or Cmd+Option+I)

4. **Copy and paste test commands** from the page into console

5. **Navigate to Matching Engine** to see live scoring:
   ```
   http://localhost:5173/matches
   ```

### Option 2: Watch Console During Matching

1. **Navigate to Matching Engine:**
   ```
   http://localhost:5173/matches
   ```

2. **Open browser console** (F12)

3. **You should see detailed output like:**
   ```
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   🧮 GOD Algorithm Scoring: "AI Startup Inc"
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   
   📊 Component Scores:
      📊 Team                   85 (Ex-FAANG founders detected)
      📊 Traction               72 ($2M ARR, 50 customers)
      📊 Market                 80 ($75B TAM)
      📊 Product                90 (Launched with demo)
      📊 Vision                 75 (1.5/2)
      📊 Ecosystem              67 (1.0/1.5)
      📊 Grit                   80 (1.2/1.5)
      📊 Problem Validation     85 (1.7/2)
      
      GOD Base Score:           7.8/10 (78/100)
   
   🎯 Matching Bonuses for "Sequoia Capital":
      📊 Stage Match             +10 (Series A ↔ Series A, Series B)
      📊 Sector Match             +8 (AI/ML, B2B SaaS)
      📊 Check Size Fit           +5 ($5M in range)
      📊 Geography Match          +5 (US matches)
   
   📈 Final Score: 96.0/100
   ```

4. **Click "Show Next Match"** to see scoring for different startups

5. **First 5 matches will show verbose logging** (prevents console spam)

## 🔍 What to Look For

### ✅ GOD Algorithm is WORKING if you see:

- ✅ **Component scores displayed** (Team, Traction, Market, etc.)
- ✅ **Scores vary** between startups (not all 85)
- ✅ **Matching bonuses apply** (Stage, Sector, Check Size, Geography)
- ✅ **Reasoning displayed** (why each score was given)
- ✅ **No crashes** on missing data
- ✅ **Score range**: 30-98 (realistic distribution)
- ✅ **Standard deviation**: > 1.0 (scores are different)

### ❌ GOD Algorithm is BROKEN if you see:

- ❌ **All scores exactly 85** (default fallback being used)
- ❌ **No console output** from GOD algorithm
- ❌ **All scores identical** (no differentiation)
- ❌ **No component breakdown** visible
- ❌ **Crashes or errors** in console
- ❌ **Bonuses never apply** (always +0)

## 📊 Test Cases Included

### 1. Component Scoring Tests
- **High-Quality Startup** (Expected: 78-88)
  - Ex-FAANG team, $2M ARR, $75B market
- **Early-Stage Startup** (Expected: 35-48)
  - First-time founders, no revenue, small market
- **Unicorn Candidate** (Expected: 90-98)
  - Serial founders, $20M ARR, huge market

### 2. Matching Bonus Tests
- **Perfect Match** (+20 points)
  - Stage matches, sector matches, check size fits, geography matches
- **No Match** (+0 points)
  - No criteria match between startup and investor
- **Partial Match** (+8 points)
  - Only sector matches

### 3. Edge Case Tests
- **Missing data** - Should not crash
- **Null/undefined values** - Should handle gracefully
- **Invalid types** - Should coerce or use defaults

### 4. Score Distribution Analysis
- Checks if scores follow expected distribution
- Validates standard deviation
- Identifies if default fallback is being used
- Compares to expected ranges

## 🔧 Troubleshooting

### No console output?
1. Check that `DEBUG_GOD = true` in `src/services/matchingService.ts`
2. Rebuild: `npm run build`
3. Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)

### All scores are 85?
1. GOD algorithm may not be imported correctly
2. Check `src/services/matchingService.ts` imports
3. Verify `server/services/startupScoringService.ts` exists
4. Check browser console for import errors

### Crashes on missing data?
1. This is a bug - GOD should handle missing data gracefully
2. Check the error in console
3. Review the `calculateAdvancedMatchScore()` function
4. Add null checks as needed

### Bonuses not applying?
1. Check investor data has correct fields (stage, sectors, check_size, geography)
2. Verify startup data has matching fields
3. Look for type mismatches (array vs string)
4. Check console for matching bonus calculations

## 📈 Expected Score Ranges

| Startup Quality | Expected Score Range | Reasoning |
|----------------|---------------------|-----------|
| **Unicorn Potential** | 90-98 | Serial founders, $20M+ ARR, huge market, all criteria strong |
| **Strong** | 78-88 | Ex-FAANG team, $2M+ ARR, large market, good product |
| **Solid** | 65-77 | Good team, early revenue, clear market |
| **Average** | 50-64 | Decent team, some traction, defined market |
| **Weak** | 35-49 | First-time founders, no revenue, unclear market |
| **Very Weak** | 20-34 | Missing most criteria, concept stage |

## 🎯 Matching Bonus Breakdown

| Bonus Type | Points | Criteria |
|-----------|--------|----------|
| **Stage Match** | +10 | Startup stage in investor's stage focus |
| **Sector Match** | +5 to +10 | Common sectors (5 per sector, max 10) |
| **Check Size Fit** | +5 | Raise amount in investor's check size range |
| **Geography Match** | +5 | Startup location matches investor geography |
| **Max Total Bonuses** | +30 | All criteria match perfectly |

## 📝 Test Checklist

Use this to track your testing:

- [ ] Browser console shows GOD algorithm output
- [ ] Component scores display for each startup
- [ ] Scores vary between startups (not all 85)
- [ ] Matching bonuses calculate correctly
- [ ] Stage match bonus applies when appropriate
- [ ] Sector match bonus applies for common sectors
- [ ] Check size fit bonus applies correctly
- [ ] Geography match bonus works
- [ ] No crashes on missing data
- [ ] No crashes on null/undefined values
- [ ] Score distribution looks reasonable (30-98 range)
- [ ] Standard deviation > 1.0 (proves variation)
- [ ] High-quality startups score 78+
- [ ] Low-quality startups score < 50
- [ ] Reasoning array displays insights

## 🔬 Advanced Testing

### Analyze Score Distribution
```javascript
// Run in browser console on matching page
const scores = []; // Collect scores from multiple matches
const avg = scores.reduce((a,b) => a+b) / scores.length;
const min = Math.min(...scores);
const max = Math.max(...scores);
console.log(`Min: ${min}, Max: ${max}, Avg: ${avg.toFixed(1)}`);
```

### Monitor Real-Time Scoring
```javascript
// Watch scores update in real-time
setInterval(() => {
  const scoreEl = document.querySelector('[class*="Match"]');
  if (scoreEl) {
    const match = scoreEl.textContent.match(/(\d+)%/);
    if (match) console.log(`Current score: ${match[1]}`);
  }
}, 2000);
```

### Validate Against Test Cases
See `test-god-algorithm.ts` for comprehensive test cases you can run in Node.js (after adding proper module resolution).

## 🆘 Getting Help

If tests fail:

1. **Check the console** for detailed error messages
2. **Review the test output** for specific failures
3. **Verify imports** in matchingService.ts
4. **Ensure GOD algorithm files** exist in server/services/
5. **Check data types** match expected formats
6. **Review component score calculations** in startupScoringService.ts

## 📖 Related Documentation

- **GOD Algorithm Core**: `server/services/startupScoringService.ts`
- **Matching Service**: `src/services/matchingService.ts`
- **Test Utilities**: `src/services/matchingHelpers.ts`
- **Main Test Suite Document**: See the full test suite document for comprehensive testing guide

---

**Created:** December 6, 2025  
**Version:** 1.0  
**Project:** Hot Money Honey  
**Component:** GOD Algorithm Testing
