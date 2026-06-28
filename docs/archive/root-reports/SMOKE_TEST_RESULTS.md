# ⚡ Hot Money Honey - 15 Minute Smoke Test Results
**Date:** December 6, 2025  
**Tester:** _____________  
**Browser:** Chrome / Firefox / Safari (circle one)

---

## ⏱️ SMOKE TEST CHECKLIST

### 1. Basic Load Test (2 min)
**URL:** http://localhost:5175/

- [ ] Homepage loads without white screen
- [ ] No red errors in browser console (F12)
- [ ] Navigation menu visible
- [ ] Styling looks correct (not broken CSS)

**Status:** ⬜ PASS / ⬜ FAIL  
**Notes:**

---

### 2. Matching Engine Test (3 min)
**Location:** Navigate to homepage (matching engine)

- [ ] Startup cards display
- [ ] Investor cards display
- [ ] Match scores visible on cards
- [ ] Scores are DIFFERENT (not all the same number)
- [ ] Scores are NOT all 85 (default fallback)

**Quick Console Check:**
```javascript
// Paste this in browser console (F12)
console.log('🔍 Checking scores on page...');
const bodyText = document.body.innerText;
const scores = bodyText.match(/(\d+)%\s*Match/g);
console.log('📊 Scores found:', scores);
const uniqueScores = [...new Set(scores)];
console.log('🎯 Unique scores:', uniqueScores);
if (uniqueScores.length === 1 && uniqueScores[0].includes('85')) {
  console.error('❌ FAIL: All scores are 85 (GOD not working)');
} else if (uniqueScores.length === 1) {
  console.error('❌ FAIL: All scores are the same');
} else {
  console.log('✅ PASS: Scores vary correctly');
}
```

**Scores Found:**
- Score 1: ______
- Score 2: ______
- Score 3: ______

**Status:** ⬜ PASS / ⬜ FAIL  
**Notes:**

---

### 3. Voting Test (3 min)
**Location:** Navigate to /vote or /vote-cards

- [ ] Startup cards visible
- [ ] YES button visible and clickable
- [ ] NO button visible and clickable
- [ ] Click YES → visual feedback (animation, color change)
- [ ] Click NO → visual feedback
- [ ] No errors in console after voting

**Status:** ⬜ PASS / ⬜ FAIL  
**Notes:**

---

### 4. Score Logic Quick Test (3 min)
**Look at 3 different startups and their scores:**

| Startup Name | Score | Looks Reasonable? |
|--------------|-------|-------------------|
| 1. _________ | _____ | ⬜ Yes / ⬜ No   |
| 2. _________ | _____ | ⬜ Yes / ⬜ No   |
| 3. _________ | _____ | ⬜ Yes / ⬜ No   |

**Intuition Check:**
- [ ] Highest scored startup appears to be stronger than lowest
- [ ] Scores make intuitive sense based on visible information
- [ ] Range of scores is reasonable (not all clustered)

**Status:** ⬜ PASS / ⬜ FAIL  
**Notes:**

---

### 5. Console Output Test (2 min)
**Open Console (F12) → Look for GOD algorithm output**

- [ ] See "GOD Algorithm" messages (🧮 emoji)
- [ ] See "STARTING GOD ALGORITHM MATCH GENERATION"
- [ ] See component breakdowns (Team, Traction, Market, Product, etc.)
- [ ] See matching bonuses (+Stage, +Sector, etc.)
- [ ] See final scores calculated

**Expected Output Example:**
```
═══════════════════════════════════════════════════════
🧮 STARTING GOD ALGORITHM MATCH GENERATION
═══════════════════════════════════════════════════════

🧮 GOD Algorithm - Match #1 of 5 (verbose mode)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Component Scores:
   🏆 Team: 82
   📈 Traction: 75
   🎯 Market: 88
   💡 Product: 78
   ...
🎯 Matching Bonuses: +15
📈 FINAL SCORE: 84.2 / 100
```

**Console Output Found:**
- [ ] None ❌
- [ ] Some GOD messages ⚠️
- [ ] Full detailed output ✅

**Status:** ⬜ PASS / ⬜ FAIL  
**Notes:**

---

### 6. Navigation Test (2 min)
**Test these routes:**

- [ ] Homepage (/)
- [ ] Matching Engine (/ or /matching-engine)
- [ ] Vote page (/vote)
- [ ] Investors page (/investors)
- [ ] Submit page (/submit)

**Status:** ⬜ PASS / ⬜ FAIL  
**Notes:**

---

## 🚦 SMOKE TEST RESULTS

### Quick Verdict
**Total Checkboxes Checked:** _____ / 27

- **18-27 checked:** ✅ PASS - Ready for deep testing
- **14-17 checked:** ⚠️ ISSUES - Fix critical items first
- **Below 14:** ❌ FAIL - Major problems, don't proceed

### Overall Status
⬜ ✅ PASS - Ready for full testing  
⬜ ⚠️ PARTIAL - Some issues need fixing  
⬜ ❌ FAIL - Critical failures present

---

## 🔴 CRITICAL FAILURES (Stop immediately if any)

- [ ] ❌ Page doesn't load at all
- [ ] ❌ All scores are exactly the same
- [ ] ❌ All scores are 85 (default)
- [ ] ❌ Voting buttons don't work
- [ ] ❌ Console full of red errors
- [ ] ❌ No GOD algorithm output in console

**Critical Failures Found:** _____ (If > 0, STOP testing)

---

## 📝 Issues Found

| Test | Issue Description | Severity | Action Needed |
|------|-------------------|----------|---------------|
| 1.   |                   | 🔴/🟡/🟢 |               |
| 2.   |                   | 🔴/🟡/🟢 |               |
| 3.   |                   | 🔴/🟡/🟢 |               |

**Legend:** 🔴 Critical / 🟡 Medium / 🟢 Low

---

## 📋 NEXT STEPS

### If Smoke Test PASSED (✅):
- [ ] Proceed to full Logic Validation Test Plan
- [ ] Run detailed component testing
- [ ] Test edge cases and error handling
- [ ] Validate scoring algorithm accuracy

### If Smoke Test FAILED (❌):
- [ ] Document all failures above
- [ ] Fix critical issues first
- [ ] Re-run smoke test
- [ ] Only proceed to full testing after smoke test passes

---

## ⚡ QUICK DIAGNOSTICS

### Issue: "All scores are 85"
**Check:**
```bash
# Check if GOD algorithm is imported
grep -n "generateAdvancedMatches" src/components/MatchingEngine.tsx
```

**Expected:** Should see import and function call

### Issue: "Scores not varying"
**Check in Console:**
```javascript
// Check if startups have different data
console.log('First 3 startups:', matches.slice(0, 3));
```

### Issue: "No console output"
**Check:**
```bash
# Verify DEBUG_GOD is true
grep "DEBUG_GOD" src/services/matchingService.ts
```

**Expected:** `const DEBUG_GOD = true;`

### Issue: "Page won't load"
**Check Terminal:**
```bash
npm run dev
```

**Look for:** Build errors or missing dependencies

---

## ✅ VERIFICATION COMMANDS

Run these in browser console to verify GOD algorithm:

```javascript
// 1. Check if scores vary
const scores = [...document.querySelectorAll('*')]
  .map(el => el.textContent.match(/(\d+)%\s*Match/))
  .filter(Boolean)
  .map(m => m[0]);
console.log('Scores:', scores);

// 2. Check localStorage for voting data
console.log('Votes stored:', localStorage.getItem('votes'));

// 3. Force reload matches
window.location.reload();
```

---

**Smoke Test Completed:** ⬜ Yes / ⬜ No  
**Time Taken:** _____ minutes  
**Ready for Full Testing:** ⬜ Yes / ⬜ No
