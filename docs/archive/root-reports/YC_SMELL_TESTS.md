# YC Smell Tests Implementation

## Overview

Implemented YC's quick heuristic assessment framework - the "smell tests" that experienced investors use to rapidly evaluate startups.

## The 5 YC Smell Tests

### 1. 🏗️ **Lean Test**: Could 2 people build this in 3 months?
- VCs love capital-efficient startups
- SaaS/software/marketplace = ✅ Lean
- Hardware/biotech/healthcare = ❌ Complex
- **Scoring**: +2 points if lean, +0.5-1.5 for moderate

### 2. 💕 **User Passion Test**: Do users sound emotionally attached?
- Passionate users = viral growth potential
- Consumer/social/gaming/community = ✅ Passionate
- B2B enterprise = ❌ Usually utility
- **Scoring**: +2 points if passionate

### 3. 📢 **Learning in Public Test**: Is the founder learning in public?
- Transparency = good for community, fundraising, hiring
- Developer tools/AI/creator = ✅ Often public
- Check: Twitter active, blog active, build in public
- **Scoring**: +2 points if learning publicly

### 4. 🔮 **Inevitable Test**: Does this feel early but inevitable?
- Timing is everything - "Why now?" question
- AI/Climate/Automation/Sustainability = ✅ Inevitable
- Keywords: "future", "next-gen", "revolution"
- **Scoring**: +2 points if inevitable

### 5. 🚀 **Massive if Works Test**: Could this be massive if it works?
- VCs need venture-scale returns
- Healthcare/Fintech/Education = $100B+ TAM
- Marketplace/Platform = $10B+ TAM
- **Scoring**: +2 points if massive potential

## Composite Score

- **5/5**: Perfect startup - all tests pass ⭐⭐⭐⭐⭐
- **4/5**: Strong candidate - most tests pass ⭐⭐⭐⭐
- **3/5**: Good potential - some tests pass ⭐⭐⭐
- **2/5**: Needs work ⭐⭐
- **1/5**: Challenging fit ⭐
- **0/5**: Likely not a VC fit

## Database Schema

Added to both `startups` and `startup_uploads` tables:

```sql
-- Binary smell test results
smell_test_lean BOOLEAN
smell_test_user_passion BOOLEAN
smell_test_learning_public BOOLEAN
smell_test_inevitable BOOLEAN
smell_test_massive_if_works BOOLEAN
smell_test_score INTEGER (0-5)

-- Supporting data
team_size_estimate INTEGER
build_complexity TEXT ('simple', 'moderate', 'complex', 'enterprise')
tam_estimate TEXT ('$1B+', '$10B+', '$100B+')
market_timing_score INTEGER (1-10)
enabling_technology TEXT
user_testimonial_sentiment TEXT
organic_word_of_mouth BOOLEAN
founder_twitter_active BOOLEAN
founder_blog_active BOOLEAN
build_in_public BOOLEAN
winner_take_all_market BOOLEAN
```

## Matching Integration

### For YC-Style Investors (YC, Techstars, 500, Accelerators)
- Smell tests get **1.5x weight**
- Combined with YC-style scoring (Speed, Insight, User Love, Learning)
- Total potential: 10 base + 5 bonus (15 pts) from smell tests

### For Other Investors
- Smell tests get **0.5x weight**
- Still influential but not dominant factor

## Current Distribution (startup_uploads)

| Score | Count | Percentage |
|-------|-------|------------|
| 5/5   | 105   | 14.0%      |
| 4/5   | 71    | 9.5%       |
| 3/5   | 31    | 4.1%       |
| 2/5   | 234   | 31.2%      |
| 1/5   | 309   | 41.2%      |

## Recently Funded Startups Added

| Name | Score | Funding | Round | Key Tests |
|------|-------|---------|-------|-----------|
| Aurassure | 5/5 | - | Seed | Climate tech, all tests pass |
| Keeper | 5/5 | $4M | Seed | AI dating, all tests pass |
| IPF | 4/5 | $375K | Seed | Kids marketplace |
| NeoSapien | 4/5 | $2M | Seed | AI wearables (not lean) |
| Subsense | 4/5 | $10M | Series A | Subscription intelligence |
| EDT | 3/5 | $1.4M | Pre-seed | Consumer hardware |
| Lawyered | 3/5 | ₹8.5cr | Pre-Series A | Legal-tech |
| Valerie Health | 3/5 | $30M | Series A | Healthcare (not lean) |
| Double | 3/5 | $6.5M | Series A | Practice management |
| AIR Credit | 2/5 | $6.1M | Seed | Fintech (complex, B2B) |

## Files Modified

- `generate-matches-selective.js` - v5 with smell test scoring
- `add-funded-startups-with-smell-tests.js` - Add funded startups
- `enrich-smell-tests.js` - Enrich existing startups
- Migration: `add_yc_smell_test_columns` (startups)
- Migration: `add_smell_tests_to_startup_uploads` (startup_uploads)

## Results

After implementation:
- **High confidence matches**: 98.0% (up from 90.7%)
- **Selectivity**: 12.3% of possible matches
- **Elite investor matches**: 495 (avg score 97.9)
