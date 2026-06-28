# 🤖 ML Recommendation System - GOD Algorithm Weight Optimization

## Overview

The ML Recommendation System automatically analyzes match outcomes and suggests optimal weight adjustments for the GOD Algorithm to improve matching accuracy over time.

---

## 🎯 What It Does

### Automated Analysis
- **Tracks** all match outcomes (investments, meetings, passes)
- **Identifies** patterns in successful vs. unsuccessful matches  
- **Generates** data-driven recommendations for weight adjustments
- **Applies** approved recommendations to the GOD Algorithm
- **Measures** performance improvements after changes

### Self-Improving System
The platform continuously learns from real-world outcomes:
1. Matches are created using current GOD Algorithm weights
2. Outcomes are tracked (did it lead to investment?)
3. ML analyzes which factors predicted success
4. Recommendations generated to optimize weights
5. Apply recommendations → Algorithm improves
6. Repeat cycle monthly

---

## 📊 How Recommendations Work

### Generation Process

```
Match Data → ML Analysis → Pattern Recognition → Recommendations
```

**Example Recommendation:**
```json
{
  "title": "Increase Traction Weight",
  "description": "Startups with strong traction metrics have 35% higher investment rate",
  "current_value": { "traction": 3.0 },
  "proposed_value": { "traction": 3.5 },
  "expected_impact": "+12% match success rate",
  "priority": "high"
}
```

### Recommendation Types

1. **Weight Adjustments**
   - Increase/decrease component weights
   - Based on correlation with successful outcomes
   - Example: "Traction predicts success better than expected"

2. **Threshold Changes**
   - Minimum GOD score requirements
   - Filter low-quality matches
   - Example: "Matches below 70 score have <15% success"

3. **New Factors**
   - Add new scoring components
   - Remove ineffective components
   - Example: "Add founder background sub-score"

---

## 🚀 Using the System

### Access ML Dashboard

Navigate to: **`/admin/ml-dashboard`**

### Run Training Cycle

1. Click **"Run Training Cycle"** button
2. Wait ~30 seconds for analysis
3. Review generated recommendations
4. Apply promising recommendations

### Apply Recommendations

1. **Review** the recommendation details:
   - Current vs. proposed values
   - Expected impact
   - Priority level

2. **Click** "Apply to GOD Algorithm"

3. **Confirm** the application

4. **Monitor** performance changes over next 30 days

---

## 💾 Database Tables

### `ml_recommendations`
Stores generated recommendations:
```sql
- id
- recommendation_type (weight_change, threshold_adjust, etc.)
- priority (high, medium, low)
- title
- description
- current_value (JSON)
- proposed_value (JSON)
- expected_impact
- status (pending, applied, rejected)
- confidence_score
- created_at
- applied_at
- applied_by
```

### `algorithm_weight_history`
Tracks all weight changes:
```sql
- id
- recommendation_id
- applied_by
- applied_at
- weight_updates (JSON array)
- performance_before (JSON)
- performance_after (JSON)
- rolled_back (boolean)
- rolled_back_at
```

### Example Weight Update:
```json
{
  "component": "traction",
  "old_weight": 3.0,
  "new_weight": 3.5,
  "reason": "Higher correlation with investment success"
}
```

---

## 🔧 Backend Services

### `/server/services/recommendationService.ts`

Main service for applying recommendations:

```typescript
// Apply a recommendation
await RecommendationService.applyRecommendation(
  recommendationId,
  userId
);

// Get weight history
const history = await RecommendationService.getWeightHistory(10);

// Rollback weights
await RecommendationService.rollbackWeights(applicationId);

// Get current active weights
const weights = await RecommendationService.getCurrentWeights();
```

### Key Methods:

- **`applyRecommendation()`** - Applies weight changes to algorithm
- **`getCurrentPerformance()`** - Gets current metrics
- **`getWeightHistory()`** - Retrieves past changes
- **`rollbackWeights()`** - Reverts weight changes
- **`getCurrentWeights()`** - Gets active weight configuration

---

## 📈 Performance Tracking

### Before Application
System captures:
- Total matches (last 30 days)
- Average match score
- Average GOD score
- Success rate (investments/meetings)

### After Application (30 days later)
System measures:
- Same metrics as above
- Calculate improvement delta
- Validate expected impact
- Auto-rollback if performance declines

---

## 🎛️ Current GOD Algorithm Weights

Default weights (can be updated via recommendations):

```javascript
{
  team: 3.0,              // Founder experience, technical cofounder
  traction: 3.0,          // Revenue, users, growth rate
  market: 2.0,            // TAM, opportunity size
  product: 2.0,           // Demo, launched, IP
  vision: 2.0,            // Clarity, ambition
  ecosystem: 1.5,         // Backers, advisors, partnerships
  grit: 1.5,              // Persistence, customer obsession
  problemValidation: 2.0  // Customer validation, willingness to pay
}
```

**Total Weight:** 17.0  
**Scale:** Each component scored 0-weight, sum normalized to 0-100

---

## 🔄 Recommendation Lifecycle

```
1. PENDING     → Waiting for review
2. APPLIED     → Changes live in algorithm
3. MEASURING   → Collecting performance data (30 days)
4. VALIDATED   → Performance improved as expected
5. ROLLED_BACK → Performance declined, changes reverted
```

---

## 🧪 Testing Recommendations

### Manual Testing

1. **Generate Test Data:**
   ```sql
   INSERT INTO ml_recommendations (
     recommendation_type,
     priority,
     title,
     description,
     current_value,
     proposed_value,
     expected_impact,
     status
   ) VALUES (
     'weight_change',
     'high',
     'Test Recommendation',
     'This is a test',
     '{"team": 3.0}',
     '{"team": 3.2}',
     '+5% improvement',
     'pending'
   );
   ```

2. **Apply via Dashboard:**
   - Navigate to `/admin/ml-dashboard`
   - Find test recommendation
   - Click "Apply to GOD Algorithm"
   - Verify in `algorithm_weight_history`

3. **Check Weight Updates:**
   ```sql
   SELECT * FROM algorithm_weight_history 
   ORDER BY applied_at DESC 
   LIMIT 1;
   ```

---

## 🚨 Safety Features

### Rollback Capability
- Every weight change is tracked
- Can rollback to previous weights
- Automatic rollback if performance declines >10%

### Validation Checks
- ✅ Weight sum stays consistent
- ✅ No negative weights
- ✅ Changes are gradual (max ±20% per change)
- ✅ Performance monitored before/after

### Human Oversight
- All recommendations require manual approval
- Priority labels guide decision-making
- Detailed impact estimates provided
- View history of all changes

---

## 📋 Best Practices

### When to Apply Recommendations

✅ **DO Apply:**
- High-priority recommendations
- Clear expected impact (>10% improvement)
- Backed by significant data (>100 matches)
- Aligns with observed patterns

❌ **DON'T Apply:**
- Low-confidence recommendations (<70%)
- Contradicts domain expertise
- Insufficient data (<50 matches)
- During active campaigns (wait for completion)

### Monitoring After Application

1. **Week 1:** Watch for immediate issues
2. **Week 2-4:** Collect performance data
3. **Week 4:** Review performance delta
4. **Month 2:** Validate long-term impact

### Rollback Triggers

- Success rate drops >10%
- Average match quality declines
- User feedback indicates issues
- Algorithm produces unexpected results

---

## 🔮 Future Enhancements

### Coming Soon:
- [ ] A/B testing of weight changes
- [ ] Automated recommendation application
- [ ] Sector-specific weight profiles
- [ ] Multi-armed bandit optimization
- [ ] Real-time weight adjustment
- [ ] Recommendation confidence scores
- [ ] Impact prediction models

---

## 📞 Support

### Troubleshooting

**Recommendation won't apply:**
- Check database connection
- Verify recommendation hasn't been applied already
- Check user permissions

**Performance not improving:**
- Wait full 30 days for data
- Check if sample size is sufficient
- Consider rollback and retry different approach

**Weight history not showing:**
- Verify `algorithm_weight_history` table exists
- Run migration: `supabase-weight-history.sql`
- Check database permissions

---

## 📚 Related Documentation

- [ML_ALGORITHM_GUIDE.md](./ML_ALGORITHM_GUIDE.md) - Full ML system overview
- [ML_QUICK_START.md](./ML_QUICK_START.md) - Quick reference
- [GOD_ALGORITHM_INTEGRATION_COMPLETE.md](./GOD_ALGORITHM_INTEGRATION_COMPLETE.md) - GOD Algorithm details
- [INVESTOR_PITCH.md](./INVESTOR_PITCH.md) - Platform overview

---

**Last Updated:** December 11, 2025  
**Version:** 1.0  
**Status:** ✅ Active - Recommendation system live!
