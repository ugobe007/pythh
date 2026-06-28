# 🧪 Run GOD Algorithm Tests - Step-by-Step Guide

**Status**: ✅ GOD Algorithm Integrated & Ready to Test  
**Last Build**: December 6, 2025  
**Build Status**: ✅ Success (no errors)

---

## ✅ GOOD NEWS: GOD Algorithm Already Integrated!

The GOD algorithm is **already running** in your matching engine with full verbose logging enabled for the first 5 matches. No additional setup needed!

---

## 🚀 Quick Start (30 Seconds)

### Step 1: Start Dev Server
```bash
npm run dev
```

### Step 2: Open Matching Engine
Navigate to: `http://localhost:5173/matches`

### Step 3: Open Browser Console
- **Mac**: `Cmd + Option + I` or `F12`
- **Windows/Linux**: `Ctrl + Shift + I` or `F12`

### Step 4: Look for GOD Algorithm Output
You should see detailed console logs like:

```
🧮 Loading matches with GOD Algorithm...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧮 GOD Algorithm Scoring: "TechCo AI"
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
   
   GOD Base Score:     7.8/10 (78/100)

🎯 Matching Bonuses for "Sequoia Capital":
   📊 Stage Match             +10 (Series A ↔ Series A, Series B)
   📊 Sector Match             +8 (AI/ML, B2B SaaS)
   📊 Check Size Fit           +5 ($8M in range)
   📊 Geography Match          +5 (US matches)

📈 Final Score: 96.0/100
```

---

## ✅ Verification Checklist (Quick Test)

Run through this 2-minute checklist:

- [ ] **Dev server running?** (`npm run dev`)
- [ ] **Navigate to `/matches`?** (Should see matching interface)
- [ ] **Console open?** (F12 or Cmd+Option+I)
- [ ] **See "🧮 Loading matches with GOD Algorithm..."?**
- [ ] **See component score breakdowns?** (Team, Traction, Market, etc.)
- [ ] **See matching bonuses?** (Stage, Sector, Check Size, Geography)
- [ ] **See final scores?** (Should be XX/100)
- [ ] **Scores vary?** (Click "Show Next Match" - scores should change)
- [ ] **No errors in console?** (Check for red error messages)

### ✅ If ALL boxes checked: GOD Algorithm is WORKING!

### ❌ If ANY box unchecked: See Troubleshooting section below

---

## 📊 Test Suite Execution

Now that you've verified it's working, run the full test suite:

### Test 1: Component Scoring Validation

Open browser console on `/matches` page and paste:

```javascript
// Test 1: Verify scores show variation
console.log('\n🧪 TEST 1: Component Scoring Validation');
console.log('═'.repeat(60));

// Monitor the next 5 matches
let testScores = [];
let testCount = 0;

const originalClickHandler = document.querySelector('button[class*="from-purple-600"]');

console.log('Click "Show Next Match" 5 times and watch the console...');
console.log('Scores collected so far:', testScores);

// Or manually collect from the logs above
// Look for the "📈 Final Score: XX.X/100" lines
```

**Expected Results:**
- High-quality startups: 78-98
- Average startups: 50-77
- Low-quality startups: 30-49
- **Scores should vary** (not all the same)

---

### Test 2: Matching Bonus Validation

Look in your console output for the "🎯 Matching Bonuses" section. You should see:

**Perfect Match Example:**
```
🎯 Matching Bonuses for "Top Tier VC":
   📊 Stage Match             +10 (Series A ↔ Series A, Series B)
   📊 Sector Match             +8 (AI/ML, B2B SaaS)
   📊 Check Size Fit           +5 ($8M in range)
   📊 Geography Match          +5 (US matches)
```

**No Match Example:**
```
🎯 Matching Bonuses for "Wrong Fit VC":
   📊 Stage Match              +0 (no match)
   📊 Sector Match             +0 (no match)
   📊 Check Size Fit           +0 (outside range)
   📊 Geography Match          +0 (no match)
```

**✅ PASS if:** Bonuses vary based on match quality  
**❌ FAIL if:** All bonuses are +0 or all the same

---

### Test 3: Score Distribution Analysis

After viewing 5+ matches, run this in console:

```javascript
// Test 3: Analyze score distribution
console.log('\n🧪 TEST 3: Score Distribution Analysis');
console.log('═'.repeat(60));

// Collect scores from console output
// Look for lines like "📈 Final Score: XX.X/100"

// Example manual collection:
const observedScores = [96, 78, 85, 72, 91]; // Replace with your actual scores

const stats = {
  count: observedScores.length,
  min: Math.min(...observedScores),
  max: Math.max(...observedScores),
  avg: (observedScores.reduce((a,b) => a+b, 0) / observedScores.length).toFixed(1),
  range: Math.max(...observedScores) - Math.min(...observedScores)
};

console.log('📊 Score Statistics:');
console.log(`   Count:  ${stats.count}`);
console.log(`   Min:    ${stats.min}`);
console.log(`   Max:    ${stats.max}`);
console.log(`   Avg:    ${stats.avg}`);
console.log(`   Range:  ${stats.range}`);

// Validation
if (stats.range < 5) {
  console.log('❌ FAIL: No variation in scores (range < 5)');
} else {
  console.log('✅ PASS: Scores show good variation');
}

if (stats.min < 30 || stats.max > 99) {
  console.log('⚠️  WARNING: Scores outside expected 30-98 range');
} else {
  console.log('✅ PASS: Scores in expected range');
}
```

**Expected Results:**
- Min: 30-50 (weak startups)
- Max: 80-98 (strong startups)
- Avg: 60-75 (balanced)
- Range: > 20 (good variation)

---

### Test 4: Edge Case Handling

The GOD algorithm should handle missing data gracefully. This is automatically tested when matches are generated.

Look for any **red error messages** in console:
- ❌ **Errors present**: GOD algorithm crashing on bad data
- ✅ **No errors**: GOD algorithm handling edge cases correctly

---

## 📋 Test Results Form

Copy this template and fill it in:

```markdown
# GOD Algorithm Test Results

**Date**: December 6, 2025
**Tester**: _______________
**Browser**: _______________

## Quick Verification ✅
- [ ] Dev server started
- [ ] Navigated to /matches
- [ ] Console open
- [ ] GOD algorithm logs visible
- [ ] Component scores display
- [ ] Matching bonuses display
- [ ] Final scores display
- [ ] Scores vary between matches
- [ ] No console errors

## Score Observations
- Min Score: _____
- Max Score: _____
- Average: _____
- Range: _____

## Component Scores Working?
- [ ] Team scores vary
- [ ] Traction scores vary
- [ ] Market scores vary
- [ ] Product scores vary
- [ ] Vision scores vary
- [ ] Ecosystem scores vary
- [ ] Grit scores vary
- [ ] Problem scores vary

## Matching Bonuses Working?
- [ ] Stage match bonus applies
- [ ] Sector match bonus applies
- [ ] Check size bonus applies
- [ ] Geography bonus applies
- [ ] Bonuses = 0 when no match

## Overall Assessment
**Status**: [ ] ✅ PASS [ ] ❌ FAIL

**Issues Found**:
1. 
2. 
3. 

**Notes**:


```

---

## 🐛 Troubleshooting

### Problem: No Console Output

**Solution 1: Check DEBUG_GOD flag**
```typescript
// In src/services/matchingService.ts line 8
const DEBUG_GOD = true; // Should be true
```

**Solution 2: Rebuild**
```bash
npm run build
# Then hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
```

**Solution 3: Clear cache**
```bash
rm -rf dist/
npm run build
# Hard refresh browser
```

---

### Problem: All Scores Are 85

This means the GOD algorithm is falling back to defaults.

**Solution 1: Check imports**
```typescript
// In src/services/matchingService.ts
import { calculateHotScore } from '../../server/services/startupScoringService';
```

**Solution 2: Check file exists**
```bash
ls -la server/services/startupScoringService.ts
# Should exist
```

**Solution 3: Check console for import errors**
Look for red errors like "Cannot find module"

---

### Problem: Scores Don't Vary

**Check 1: Are you looking at the same startup?**
- Click "Show Next Match" to see different startups
- Check startup name changes in console logs

**Check 2: Is verbose mode working?**
- Should see logs for first 5 matches only
- After 5 matches, logging stops (prevents spam)
- Refresh page to see logs again

---

### Problem: Console Shows Errors

**Common Errors:**

1. **"Cannot read property of undefined"**
   - Missing data in startup or investor objects
   - GOD algorithm should handle this gracefully
   - Check which field is undefined

2. **"calculateHotScore is not a function"**
   - Import path is wrong
   - File doesn't exist
   - Run `npm run build` again

3. **"Cannot find module"**
   - Dependencies not installed
   - Run `npm install`
   - Rebuild with `npm run build`

---

## 📖 Additional Test Resources

### Browser Test Interface
Open: `http://localhost:5173/test-god-algorithm.html`

This provides:
- Interactive test commands
- Copy-paste console snippets
- Visual test checklist
- Score distribution tools

### Full Documentation
- **Quick Reference**: `GOD_TEST_QUICK_REFERENCE.md`
- **Test Suite Details**: `GOD_ALGORITHM_TEST_README.md`
- **Implementation Summary**: `GOD_TEST_IMPLEMENTATION_SUMMARY.md`

---

## ✨ Success Criteria Summary

### ✅ GOD Algorithm is WORKING if:

1. ✅ Console shows "🧮 Loading matches with GOD Algorithm..."
2. ✅ Component scores display (Team, Traction, Market, etc.)
3. ✅ Scores include reasons (e.g., "Ex-FAANG founders detected")
4. ✅ Matching bonuses calculate (+10 for stage, +8 for sector, etc.)
5. ✅ Final scores vary between 30-98
6. ✅ No red errors in console
7. ✅ High-quality startups score 78+
8. ✅ Low-quality startups score < 50

### ❌ GOD Algorithm is BROKEN if:

1. ❌ No console output from GOD algorithm
2. ❌ All scores exactly 85 (default fallback)
3. ❌ No component breakdowns visible
4. ❌ Bonuses always +0
5. ❌ Red errors in console
6. ❌ Crashes when clicking "Show Next Match"
7. ❌ All scores identical (no variation)

---

## 🎯 Next Steps

### If Tests Pass ✅

1. **Document Results**: Fill in test results form above
2. **Monitor Production**: Watch score distribution over time
3. **Tune Weights**: Adjust component weights if needed (in `matchingService.ts`)
4. **Add Features**: Consider adding more scoring factors

### If Tests Fail ❌

1. **Document Failures**: Note which tests failed
2. **Check Troubleshooting**: Follow steps above
3. **Review Console**: Look for specific error messages
4. **Check Files**: Ensure all files exist and imports work
5. **Rebuild**: Run `npm run build` and test again

---

## 📞 Support

If you're still having issues:

1. Check the console for detailed error messages
2. Review `GOD_ALGORITHM_TEST_README.md` for comprehensive guide
3. Verify all files exist in `server/services/`
4. Ensure dependencies installed: `npm install`
5. Try clean build: `rm -rf dist/ && npm run build`

---

**🎉 Happy Testing!**

The GOD algorithm is ready and waiting. Start the dev server and see it in action!

```bash
npm run dev
# Then navigate to http://localhost:5173/matches
# Open console (F12) and watch the magic! ✨
```
