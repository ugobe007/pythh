# 🧪 GOD Algorithm Testing - Quick Reference Card

## 🚀 Fastest Way to Test (30 seconds)

1. **Start dev server:**
   ```bash
   npm run dev
   ```

2. **Open browser to:**
   ```
   http://localhost:5173/matches
   ```

3. **Open console (F12)** and look for:
   ```
   🧮 GOD Algorithm Scoring: "StartupName"
   📊 Component Scores: ...
   🎯 Matching Bonuses: ...
   📈 Final Score: XX/100
   ```

4. **✅ PASS if:**
   - You see the output above
   - Scores vary when you click "Show Next Match"
   - Not all scores are 85

5. **❌ FAIL if:**
   - No console output
   - All scores exactly 85
   - Crashes or errors

---

## 🔍 One-Line Tests (Browser Console)

**Check if GOD is running:**
```javascript
console.log(document.querySelector('[class*="Match"]')?.textContent.match(/(\d+)%/)?.[1] || 'No score found');
```

**Analyze score distribution:**
```javascript
const scores = Array.from(document.querySelectorAll('*')).filter(el => el.textContent.includes('% Match')).map(el => parseInt(el.textContent.match(/(\d+)%/)[1])); console.log(`Min: ${Math.min(...scores)}, Max: ${Math.max(...scores)}, Avg: ${(scores.reduce((a,b)=>a+b)/scores.length).toFixed(1)}`);
```

**Monitor score changes:**
```javascript
let lastScore = 0; setInterval(() => { const score = parseInt(document.querySelector('[class*="Match"]')?.textContent.match(/(\d+)%/)?.[1] || 0); if (score !== lastScore) { console.log(`Score changed: ${lastScore} → ${score}`); lastScore = score; }}, 1000);
```

---

## 🎯 Expected Results Cheat Sheet

| Startup Type | Score Range | Key Indicators |
|--------------|-------------|----------------|
| 🦄 **Unicorn** | 90-98 | Serial founders, $20M+ ARR, $500B market |
| 🚀 **Strong** | 78-88 | Ex-FAANG, $2M ARR, $75B market |
| ✅ **Solid** | 65-77 | Good team, early revenue, clear market |
| 👍 **Average** | 50-64 | Decent team, some traction |
| 🤷 **Weak** | 35-49 | First-timers, no revenue |
| ❌ **Very Weak** | 20-34 | Missing most criteria |

---

## 🎮 Matching Bonus Quickref

| Bonus | Points | When It Applies |
|-------|--------|----------------|
| 🎯 Stage | +10 | Startup stage in investor's focus |
| 🏢 Sector | +5-10 | Common industries (5 per sector) |
| 💰 Check Size | +5 | Raise fits investor's check range |
| 🌍 Geography | +5 | Location matches |
| 🎉 **MAX** | **+30** | Perfect match on all criteria |

---

## 🔴 Red Flags (Algorithm NOT Working)

1. ❌ **All scores = 85** → Using default fallback
2. ❌ **No console logs** → Verbose mode disabled or import broken
3. ❌ **No variation (std < 1)** → Algorithm not differentiating
4. ❌ **Crashes** → Data handling issues
5. ❌ **Bonuses always +0** → Matching criteria broken

---

## ✅ Green Flags (Algorithm IS Working)

1. ✅ **Console shows scoring breakdown**
2. ✅ **Scores vary (30-98 range)**
3. ✅ **Std dev > 1.0**
4. ✅ **Component scores display**
5. ✅ **Bonuses calculate correctly**
6. ✅ **No crashes on edge cases**

---

## 🛠️ Quick Fixes

**No console output?**
```typescript
// Set DEBUG_GOD = true in matchingService.ts line 8
const DEBUG_GOD = true;
```

**All scores 85?**
```bash
# Rebuild and hard refresh
npm run build
# Then Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
```

**Import errors?**
```typescript
// Check this import exists in matchingService.ts
import { calculateHotScore } from '../../server/services/startupScoringService';
```

---

## 📋 5-Minute Full Test

### Step 1: Visual Check (30 seconds)
- Open `/matches` route
- Check console for GOD logs
- Verify scores display

### Step 2: Variation Check (1 minute)
- Click "Show Next Match" 5 times
- Note scores: ___, ___, ___, ___, ___
- Scores should be different

### Step 3: Range Check (1 minute)
- Note min score: ___
- Note max score: ___
- Should be 30-98 range

### Step 4: Component Check (1 minute)
- Look for "📊 Component Scores" in console
- Verify 8 components display
- Verify reasons show

### Step 5: Bonus Check (1 minute)
- Look for "🎯 Matching Bonuses" in console
- Verify stage/sector/check/geo bonuses
- Note total bonus: ___

### Step 6: Edge Case Check (30 seconds)
- Test should not crash app
- Refresh page to verify stability

**✅ PASS if all 6 steps complete without issues**

---

## 📞 Emergency Debugging

**GOD algorithm completely broken?**

1. Check file exists: `server/services/startupScoringService.ts`
2. Check import in: `src/services/matchingService.ts`
3. Check console for errors
4. Run `npm install` to ensure dependencies
5. Run `npm run build` to recompile
6. Hard refresh browser (Cmd+Shift+R)

**Still broken?**

1. Check `DEBUG_GOD = true` (line 8 of matchingService.ts)
2. Look for TypeScript errors: `npm run build`
3. Check browser console for red errors
4. Review git history for breaking changes
5. Compare with working backup if available

---

## 📊 Score Component Weights (Reference)

```
Team:       ████████████████████ 20%
Traction:   ██████████████████   18%
Market:     ███████████████      15%
Product:    ████████████         12%
Vision:     ██████████           10%
Ecosystem:  ██████████           10%
Grit:       ████████              8%
Problem:    ███████               7%
            ─────────────────────
            Total:              100%
```

---

## 🎓 Test Data Templates

**High-Quality Startup:**
```javascript
{
  name: "AI Enterprise Inc",
  stage: 2,
  team: [{ background: "Ex-Google" }],
  revenue: 2000000,
  market_size: 75,
  launched: true
}
// Expected: 78-88
```

**Low-Quality Startup:**
```javascript
{
  name: "Idea Stage App",
  stage: 0,
  team: [{ background: "First-time" }],
  revenue: 0,
  market_size: 5,
  launched: false
}
// Expected: 35-48
```

---

## 📱 Test Pages

- **Main Test Interface**: `/test-god-algorithm.html`
- **Live Matching**: `/matches`
- **Admin Debug**: `/admin-setup.html` (if needed)

---

## 🏁 Success Checklist

- [ ] `npm run dev` starts successfully
- [ ] Navigate to `/matches` works
- [ ] Console shows GOD algorithm logs
- [ ] Scores display on cards (XX% Match)
- [ ] Scores vary (not all 85)
- [ ] Component breakdown visible in console
- [ ] Matching bonuses calculate
- [ ] No errors in console
- [ ] No crashes when clicking around
- [ ] Build completes: `npm run build`

**If all checked: ✅ GOD Algorithm is working!**

---

**Print this card and keep it handy for quick testing!**

🔗 **Full Docs**: `GOD_ALGORITHM_TEST_README.md`  
🔬 **Test Suite**: `test-god-algorithm.ts`  
🌐 **Browser Tests**: `public/test-god-algorithm.html`  
📊 **Summary**: `GOD_TEST_IMPLEMENTATION_SUMMARY.md`
