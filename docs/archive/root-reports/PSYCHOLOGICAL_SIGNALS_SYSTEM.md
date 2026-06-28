# Psychological Signals System - Architecture & Product Strategy

## Overview
The Psychological Signals System captures real-time investor sentiment and market momentum to enhance GOD scores. Unlike the base ontological signals (team, traction, market, product, vision), psychological signals reflect **behavioral patterns** and **social proof** in the startup funding ecosystem.

## 🧠 Signal Types

### 1. FOMO (Oversubscription)
- **Trigger**: "oversubscribed", "round closed early", "turned down capital"
- **Psychology**: Scarcity creates urgency - if others want in, I want in
- **Impact**: Validates traction and market demand
- **Half-life**: 30 days (news cycles move fast)

### 2. Conviction (Follow-on Funding)
- **Trigger**: "follow-on", "doubled down", "insider led", "existing investors"
- **Psychology**: Insiders with full information choose to invest more
- **Impact**: Validates team quality and vision
- **Half-life**: 90 days (insider knowledge stays relevant longer)

### 3. Urgency (Competitive Dynamics)
- **Trigger**: "competitive round", "multiple term sheets", "bidding war"
- **Psychology**: Competition signals value - must act fast
- **Impact**: Validates market position
- **Half-life**: 14 days (competitive windows close quickly)

### 4. Risk (Bridge Rounds)
- **Trigger**: "bridge round", "extension", "down round"
- **Psychology**: Desperation signal - trouble raising primary round
- **Impact**: Dampens product/traction scores
- **Half-life**: 45 days (concerns fade if startup recovers)

## 🔄 Architecture

### Data Flow
```
RSS Feeds → AI Extraction → psychological_signals table
                ↓
        Time Decay Applied (exponential)
                ↓
        calculate_psychological_multiplier() function
                ↓
        Database Trigger on startup_uploads
                ↓
        enhanced_god_score = base + (psych_bonus × 10)
```

### Database Schema

**psychological_signals table:**
```sql
- id (UUID)
- startup_id (UUID FK)
- signal_type (ENUM: oversubscription, followon, competitive, bridge)
- signal_strength (DECIMAL 0-1.0)
- detected_at (TIMESTAMP)
- source (TEXT)
```

**startup_uploads additions:**
```sql
- psychological_multiplier (DECIMAL 0-10 scale, default 0)
- enhanced_god_score (INTEGER, capped at 85)
```

### Calculation Formula

**Step 1: Time Decay**
```
decayed_strength = raw_strength × 0.5^(age_days / half_life)
```

**Step 2: Component Contributions (Current V1.0 Calibration)**
```
FOMO:       decayed × 0.5 (max 0.5 pts on 0-10 scale)
Conviction: decayed × 0.5 (max 0.5 pts)
Urgency:    decayed × 0.3 (max 0.3 pts)
Risk:       decayed × -0.3 (max -0.3 pts penalty)
```

**Step 3: Additive Enhancement**
```
psychological_bonus = sum(all_signal_contributions)
                    = capped between -0.3 and +1.0

enhanced_god_score = base_god_score + (psychological_bonus × 10)
                   = capped at 85 max
```

**Example:**
```
Startup: Base GOD = 58
Signals:
  - FOMO (0.50 strength, 5 days old): +0.44 pts
  - Conviction (0.33, 10 days old): +0.15 pts
Total bonus: 0.59 × 10 = +5.9 pts
Enhanced score: 58 + 6 = 64
```

## 📊 Current Calibration (V1.0 - Conservative)

### Score Impact Ranges
| Scenario | Signal Count | Base → Enhanced | Boost | % Gain |
|----------|-------------|-----------------|-------|--------|
| **No signals** | 0 | 58 → 58 | +0 | 0% |
| **Hot startup** | 1 fresh | 58 → 59 | +1-2 | 2-4% |
| **Sustained momentum** | 2-3 within 14d | 58 → 60-62 | +2-4 | 4-7% |
| **Top performer** | 3+ strong signals | 58 → 62-65 | +4-7 | 7-12% |
| **Exceptional outlier** | Max signals (rare) | 58 → 65 | +7 | 12% |

### Why Conservative?
- **Prevents score inflation**: +7 max ensures fairness
- **Validates system works**: Monitor distribution before scaling
- **Data inequality acknowledged**: Sparse data = fewer signals (intentional)

### Future Calibration (V2.0 - Production Ready)
Target ranges after 30-day monitoring period:
- Hot startup: +2-3 pts (5% boost)
- Sustained: +5-9 pts (58→67 scenario)
- Exceptional: +15-27 pts (58→85 scenario, outliers only)

## 🎯 Product Strategy: Data-to-Visibility Exchange

### The Problem
```
Well-Documented Startup:
  Rich RSS coverage → Multiple signals
  Complete profile → Higher GOD score
  Result: 68 → 75 (+7 pts)

Stealth/Early Startup:
  Sparse coverage → No signals
  Minimal data → Lower GOD score  
  Result: 52 → 52 (+0 pts)
```

### The Solution: Value Exchange
Transform data scarcity from bug to feature by offering **Score Unlock** system:

#### Tier 1: Public Data Score (Current)
- Calculated from RSS feeds, news, Crunchbase
- Range: 40-65 typical
- No startup action required

#### Tier 2: Verified Data Boost (+5-10 pts)
*"Complete your profile to unlock potential points"*
- Add traction metrics (MRR, users, growth rate)
- Upload team bios with LinkedIn verification
- Connect bank account for verified revenue
- Impact: +5-10 pts unlocked

#### Tier 3: Active Signal Generation (+5-15 pts)
*"Share updates to maintain momentum score"*
- Post funding announcements
- Share partnership wins
- Update traction monthly
- Impact: Fresh signals = sustained momentum bonus

### Score Potential Calculator (Next Feature)
Show startups exactly what data gaps cost them:

```
Your Current Score: 52 (60th percentile)

Missing Data Reducing Your Score:
  ❌ No traction metrics: -8 pts potential
  ❌ Incomplete team profiles: -5 pts potential  
  ❌ No recent funding news: -3 pts potential
  
Unlock Your Potential Score: 68 (+16 pts)
  → Matches 85th percentile
  → +40 additional investor matches
  → Estimated $2M capital access increase

[Complete Profile] [Add Traction Data] [Share Updates]
```

## 🔧 Implementation Status

### ✅ Completed (V1.0)
- [x] Database schema (29 columns for psychological signals)
- [x] Signal extraction scripts (Phase 1 + Phase 2 extractors)
- [x] Time decay migration with exponential curves
- [x] Database trigger for real-time score updates
- [x] 38 signals detected in production data
- [x] Conservative calibration deployed
- [x] Additive architecture (not multiplicative)

### ⏳ Monitoring Phase (30 days)
- [ ] Collect signal distribution data
- [ ] Measure score variance across cohorts
- [ ] Identify data gaps vs. genuine low performers
- [ ] A/B test messaging for data contribution

### 🚀 V2.0 Roadmap (Post-Monitoring)
- [ ] Component-level semantic mapping (FOMO→Traction, etc.)
- [ ] Sustained momentum detection (2+ signals in 14 days)
- [ ] Score Potential Calculator UI
- [ ] Data contribution incentive system
- [ ] Scale up weights to production targets (58→67, 58→85)
- [ ] Add more signal types (partnership, acquisition interest, viral growth)

## 🎓 Key Learnings

### 1. **Additive vs. Multiplicative Architecture**
**Wrong**: `enhanced = base × (1 + multiplier)` → Geometric compounding favors high scorers  
**Right**: `enhanced = base + bonus` → Fair, equal point value per signal

### 2. **Scale Granularity Matters**
GOD components are ~0-20 pts each (scaled from 1-5 ratings). Fractional changes (0.5-2.5 pts) are meaningful in this scale, not noise.

### 3. **Data Inequality as Feature**
Don't hide that startups with more data get better scores - make it explicit and offer a path to improve. Creates user acquisition flywheel.

### 4. **Conservative Launch → Aggressive Scale**
Better to start with +2 pts and scale to +27 than start high and deflate scores later. Maintains trust.

## 📈 Success Metrics

### System Health
- Signal detection rate: Target 15-25% of startups
- Avg bonus per startup with signals: Target 3-8 pts
- Score distribution: Should remain 45-75 avg (not inflated)
- Decay effectiveness: Signals >60 days old should drop to <20% strength

### Product Metrics
- Data contribution rate: % of startups adding verified data
- Score unlock conversion: % viewing potential who complete profile
- Match rate improvement: Enhanced scores → more investor matches
- Revenue: Premium data verification tier adoption

### User Sentiment
- Startup satisfaction: "Score feels fair and actionable"
- Investor trust: "Enhanced scores reflect real momentum"
- Transparency: Users understand what drives their score

## 🔐 Governance

### Preventing Gaming
1. **Source verification**: Signals must trace to credible news/RSS feeds
2. **Duplicate detection**: Multiple articles about same event = 1 signal
3. **Decay enforcement**: Old signals automatically lose strength
4. **Manual review**: Suspiciously high signal volume flagged for audit

### Ethical Considerations
1. **Transparency**: Startups can see which signals affect their score
2. **Appeal process**: Contest incorrectly detected signals
3. **Privacy**: Bridge/risk signals not publicly displayed (internal only)
4. **Fairness**: Early-stage startups not penalized for lack of data (just offered path to improve)

## 📚 Technical References

### Key Files
- **Migration**: `supabase/migrations/20260212_psychological_signals.sql`
- **Decay**: `supabase/migrations/20260212_add_signal_decay.sql`
- **Extractors**: `scripts/backfill-psychological-signals.js`
- **Recalculation**: `scripts/recalculate-scores.ts`

### Database Functions
- `calculate_psychological_multiplier(startup_uuid)`: Returns 0-10 scale bonus
- `update_enhanced_god_score()`: Trigger function on startup_uploads

### Monitoring Scripts
- `scripts/analyze-psych-signal-stats.js`: Distribution analysis
- `scripts/test-psych-function.js`: Function validation
- `scripts/simulate-psych-enhancement.js`: Scenario testing

---

**Last Updated**: February 12, 2026  
**Version**: 1.0 (Conservative Launch)  
**Status**: Production - Monitoring Phase  
**Next Review**: March 15, 2026 (30-day data collection)
