# Pythia Scoring Analysis Summary

**Date:** 2025-01-10  
**Analysis Run:** `npm run pythia:analyze`

---

## 📊 Key Findings

### Current State
- **723 startups** have Pythia scores (19.1% coverage of 3,779 approved startups)
- **Average Pythia score:** 1.5/100 (very low, but expected)
- **Median score:** 0
- **Score range:** 0-27
- **Confidence scores:** All at minimum (0.10) due to sparse, low-quality data
- **Source mix:** 100% Tier 3 (marketed/PR content)
  - 991 snippets from `company_blog` (99.1%)
  - 9 snippets from `press_quote` (0.9%)
- **Total snippets:** 1,000

### Impact on GOD Scores
- **Average Pythia contribution:** 0.23 points (10% weight)
- **GOD score difference:** Startups with Pythia scores average 2.30 points higher (31.23 vs 28.92)
- **Current weight:** 10% (hardcoded in `scripts/core/god-score-v5-tiered.js`)

---

## ✅ System Status: Working as Designed

The low scores are **expected and appropriate** given the current data quality:

1. **100% Tier 3 Data:** All snippets are from marketed/PR sources (company blogs, press quotes)
2. **Sparse Data:** Only 1,000 snippets for 723 startups (~1.4 snippets per startup)
3. **Restraint-First Design:** Pythia v0.2 is designed to be conservative with sparse, low-tier data
4. **Low Confidence:** System correctly assigns minimum confidence (0.10) when data is insufficient

---

## 🎯 Current Weight Configuration

### Hardcoded in `scripts/core/god-score-v5-tiered.js`:
```javascript
// Line 218-228
const founderVoiceContribution = s.founder_voice_score != null 
  ? Math.round((s.founder_voice_score / 100) * 12.5)  // 12.5% weight
  : 0;

const pythiaContribution = s.pythia_score != null 
  ? Math.round((s.pythia_score / 100) * 10)  // 10% weight
  : 0;
```

### Weight Assessment:
- **10% weight for Pythia score is appropriate** for current data quality
- With average score of 1.5/100, this yields ~0.15 points average contribution
- Actual contribution (0.23 points) aligns with this estimate
- Weight should remain at 10% until Tier 1/2 data is collected

---

## 📈 Recommendations

### 1. **Keep Current Weights (10% for Pythia)**
   - ✅ Appropriate for current data quality
   - ✅ Low scores correctly reflect Tier 3 data dominance
   - ✅ System is functioning as designed
   - **Action:** No weight changes needed at this time

### 2. **Priority: Collect Tier 1 & 2 Sources**
   To improve scores, collect higher-quality sources:

   **Tier 1 (Earned/Hard-to-fake):**
   - Forum posts (Hacker News, Reddit)
   - Support threads
   - Postmortems
   - Investor letters
   - Q&A transcripts

   **Tier 2 (Semi-earned):**
   - Podcast transcripts
   - Conference talks
   - Social media posts (Twitter/X, LinkedIn)

   **Expected Impact:**
   - Tier 1/2 data should raise average scores to 20-40/100
   - Confidence scores should increase to 0.30-0.60
   - GOD score contribution should increase to 2-4 points average

### 3. **Future: Make Weights Configurable**
   - Add Pythia weight to `GODSettingsPage.tsx` admin interface
   - Store weights in database (currently hardcoded)
   - Allow dynamic adjustment as data quality improves
   - **Note:** Not urgent - weights are appropriate for current state

---

## 🔄 Next Steps

### Immediate:
1. ✅ Analysis complete - system working correctly
2. ✅ Weights are appropriate (10% for Pythia)
3. ✅ Company blog collection script created (`npm run pythia:collect:blogs`)

### Short-term:
1. Collect Tier 1/2 sources (forum posts, podcasts, conference talks)
2. Re-run scoring after collecting higher-tier data
3. Monitor score improvements as data quality increases

### Long-term:
1. Make Pythia weights configurable in admin panel
2. Add weight adjustment UI to `GODSettingsPage.tsx`
3. Store weights in database for persistence
4. Consider increasing weight to 15-20% once Tier 1/2 data is dominant

---

## 📝 Notes

- The system's restraint-first design is working correctly
- Low scores are a feature, not a bug - they correctly reflect data quality
- Focus should be on data collection, not weight adjustment
- Current 10% weight is conservative and appropriate for sparse Tier 3 data

---

## 🎯 Success Metrics to Track

After collecting Tier 1/2 data, monitor:
- Average Pythia score (target: 20-40/100)
- Average confidence (target: 0.30-0.60)
- Tier 1/2 percentage (target: >50%)
- GOD score contribution (target: 2-4 points average)
- Score distribution (target: more startups scoring >10/100)
