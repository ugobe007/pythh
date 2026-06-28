# 🧠 GOD Algorithm - How We Measure Everything

## Overview

The GOD (GRIT + Opportunity + Determination) algorithm evaluates startups across **8 core dimensions** plus **4 YC-style dimensions**, totaling **12 scoring components**.

---

## 📊 The 8 Core Dimensions

### 1. **TEAM** (0-3 points)
**What we measure:**
- Technical co-founder presence (critical for tech startups)
- Founder experience & track record
- Previous exits/successes
- Domain expertise (years in industry)
- Team size & composition (2-4 co-founders optimal)
- Education background (pedigree)
- Advisory board quality

**How it's calculated:**
```typescript
Team Score = Average of:
- Founder experience (exits, years) = 0-1.0 points
- Team balance (tech/business mix) = 0-0.5 points
- Domain expertise = 0-0.5 points
- Advisory quality = 0-0.5 points
- Technical co-founder = 0-0.5 points (bonus)
```

**Data sources:**
- LinkedIn profiles
- Crunchbase company pages
- AngelList profiles
- Direct founder interviews

---

### 2. **TRACTION** (0-3 points)
**What we measure:**
- Revenue (MRR/ARR)
- Active users
- Growth rate (month-over-month %)
- Customer count
- Retention metrics (churn rate)
- Unit economics (LTV/CAC ratio)
- Sales velocity

**How it's calculated:**
```typescript
Traction Score = Weighted average:
- 30% Revenue growth
- 25% Customer count
- 20% Unit economics (LTV/CAC >3 is healthy)
- 15% Churn rate (lower = better)
- 10% Pilot programs
```

**Data sources:**
- Company dashboard exports
- Stripe/payment processor data
- Google Analytics
- Sales CRM (HubSpot, Salesforce)
- Customer testimonials/reviews

---

### 3. **MARKET** (0-2 points)
**What we measure:**
- Total Addressable Market (TAM)
- Market growth rate
- Industry trends
- Competitive landscape
- Problem importance/severity

**How it's calculated:**
```typescript
Market Score = 
- TAM size ($10B+ = 1.0, $1B+ = 0.5) = 0-1.0 points
- Market growth rate = 0-0.5 points
- Problem severity = 0-0.5 points
```

---

### 4. **PRODUCT** (0-2 points)
**What we measure:**
- Demo availability (showing, not telling)
- Launch status (shipped!)
- Unique IP or technology
- Defensibility (moats)
- Product-market fit signals

**How it's calculated:**
```typescript
Product Score =
- Has demo = +0.5 points
- Is launched = +0.5 points
- Unique IP/tech = +0.5 points
- Defensibility = +0.5 points
```

---

### 5. **VISION** (0-2 points)
**What we measure:**
- Clarity of vision
- Contrarian insights (non-obvious thesis)
- Creative strategy
- Long-term potential
- Market disruption capability

**How it's calculated:**
```typescript
Vision Score =
- Contrarian insight (>100 chars) = +0.5 points
- Creative strategy (>100 chars) = +0.5 points
- Passionate early customers (3+) = +0.25 points
- Financial planning = +0.5 points
- Vision statement (>50 chars) = +0.25 points
```

---

### 6. **ECOSYSTEM** (0-1.5 points)
**What we measure:**
- Existing investors/backers
- Advisor quality
- Strategic partnerships
- Network effects
- Press/recognition

**How it's calculated:**
```typescript
Ecosystem Score =
- Strategic partners (active) = 0-0.75 points
- Quality advisors = 0-0.5 points
- Platform dependencies = 0-0.25 points
```

---

### 7. **GRIT** (0-1.5 points) ⭐ **KEY DIMENSION**
**What we measure:**
- Persistence indicators
- Pivot history (smart pivots, not failures)
- Customer obsession
- Overcoming obstacles
- Execution speed
- Shipping velocity

**How it's calculated:**
```typescript
Grit Score = scoreGritSignals(startup)

GRIT SIGNALS (0-6 bonus pts):
- Customer obsession keywords = +1-2 points
- Learned from failure = +1 point
- Shipping velocity = +1-2 points
- Contrarian conviction = +1 point
- Creative problem solving = +1 point
- Competitive moat building = +1 point

Specific measurements:
- Pivots made (smart pivots = good) = 0-0.5 points
- Customer feedback frequency (daily/weekly = high) = 0-0.3 points
- Time to iterate (days) = 0-0.4 points
- Deployment frequency (daily = best) = 0-0.3 points
```

**GRIT Keywords we look for:**
- "customer obsessed", "user-first", "customer feedback"
- "pivoted", "iterated", "learned from"
- "shipped", "deployed", "launched"
- "persisted", "overcame", "resilient"
- "creative solution", "novel approach"
- "competitive advantage", "moat", "defensibility"

**Why GRIT matters:**
- Credentials open doors (weight 3)
- **GRIT predicts success (weight 5)**
- PhD/Ex-FAANG = credibility for grants/VCs
- Serial entrepreneur, PLG builder = knows how to execute

---

### 8. **PROBLEM VALIDATION** (0-2 points)
**What we measure:**
- Customer validation
- Willingness to pay
- Pain point severity
- Market demand signals
- Early adopter engagement
- ICP clarity

**How it's calculated:**
```typescript
Problem Validation Score =
- Customer interviews conducted = 0-0.5 points
- Pain data (cost/time impact) = 0-0.5 points
- Willingness to pay validated = 0-0.5 points
- ICP clarity (crystal clear = best) = 0-0.5 points
```

---

## 🚀 The 4 YC-Style Dimensions (Fund Founders, Not Ideas)

### 9. **FOUNDER SPEED** (0-3 points) ⭐⭐⭐⭐⭐ **MOST IMPORTANT**
**What we measure:**
- Weeks since idea
- Features shipped last month
- Days from idea to MVP
- Deployment frequency

**How it's calculated:**
```typescript
Founder Speed Score =
- Weeks since idea (<12 weeks = fast) = 0-1.0 points
- Features shipped last month (10+ = high velocity) = 0-1.0 points
- Days from idea to MVP (<90 days = excellent) = 0-1.0 points
```

**Why it matters:**
- YC: "Fund founders who ship"
- Execution velocity > credentials
- Speed = learning = success

---

### 10. **UNIQUE INSIGHT** (0-2.5 points) ⭐⭐⭐⭐
**What we measure:**
- Contrarian belief (what do they believe others don't?)
- Why now? (timing)
- Unfair advantage (what makes them uniquely suited?)

**How it's calculated:**
```typescript
Unique Insight Score =
- Contrarian belief (>50 chars) = 0-1.0 points
- Why now? (>50 chars) = 0-0.75 points
- Unfair advantage (>50 chars) = 0-0.75 points
```

---

### 11. **USER LOVE** (0-2 points) ⭐⭐⭐
**What we measure:**
- NPS score (Net Promoter Score 0-100)
- Users who would be very disappointed (Sean Ellis test)
- Organic referral rate
- DAU/WAU ratio (engagement)

**How it's calculated:**
```typescript
User Love Score =
- NPS score (>50 = good, >70 = excellent) = 0-0.8 points
- Very disappointed users (>40% = strong) = 0-0.6 points
- Organic referral rate (>30% = word of mouth) = 0-0.4 points
- DAU/WAU ratio (>0.5 = high engagement) = 0-0.2 points
```

---

### 12. **LEARNING VELOCITY** (0-1.5 points)
**What we measure:**
- Experiments run last month
- Hypotheses validated
- Pivot speed (days to adapt)

**How it's calculated:**
```typescript
Learning Velocity Score =
- Experiments run (10+ = high) = 0-0.5 points
- Hypotheses validated (5+ = learning) = 0-0.5 points
- Pivot speed (<30 days = fast adapt) = 0-0.5 points
```

---

## 🎯 The "5 Points" System

The **5-point system** refers to the **VIBE SCORE** (Value proposition + Insight + Business model + Execution + market):

### VIBE Score Components (0-3.5 points total):

1. **Problem/Value Proposition** (0-0.6 points)
   - Clear problem statement
   - Compelling value prop
   - Length & clarity

2. **Business Model** (0-0.5 points)
   - Revenue model clarity
   - Pricing strategy
   - Unit economics understanding

3. **Market Understanding** (0-0.5 points)
   - TAM/SAM/SOM knowledge
   - Market dynamics understanding

4. **Team Pedigree** (0-0.8 points)
   - Founder backgrounds
   - Previous companies/exits
   - Domain expertise

5. **Pitch Quality** (0-0.5 points)
   - Storytelling ability
   - Vision communication
   - Compelling narrative

6. **Investment Clarity** (0-0.3 points)
   - Clear funding needs
   - Use of funds
   - Runway planning

7. **Execution Signals** (0-0.3 points)
   - Traction indicators
   - Progress metrics
   - Momentum signals

---

## 🧠 Intelligence Measurement

**Intelligence** is measured through:

1. **Market Intelligence** (from marketIntelligence data):
   - Problem patterns (known effective problems)
   - Solution patterns (proven solutions)
   - Team patterns (success predictors vs door openers)
   - GRIT signals (keywords & patterns)

2. **Pattern Matching**:
   - Matches startup against known successful patterns
   - Industry-specific patterns (AI, SaaS, FinTech, etc.)
   - Success predictors (weight 5) vs door openers (weight 3)

3. **AI Analysis** (when available):
   - GPT-4 analysis of startup descriptions
   - Sentiment analysis
   - Pattern recognition in text

---

## 📈 Final Score Calculation

```typescript
Raw Total = 
  baseBoost (0-1.0) +
  teamScore (0-3) +
  tractionScore (0-3) +
  marketScore (0-2) +
  productScore (0-2) +
  visionScore (0-2) +
  ecosystemScore (0-1.5) +
  gritScore (0-1.5) +
  problemValidationScore (0-2) +
  founderAgeScore (0-1.5) +
  salesVelocityScore (0-2) +
  founderSpeedScore (0-3) +      // YC-style
  uniqueInsightScore (0-2.5) +   // YC-style
  userLoveScore (0-2) +          // YC-style
  learningVelocityScore (0-1.5)  // YC-style

Total = (Raw Total / 34.5) × 10  // Normalize to 0-10 scale
Final Score = Total × 10         // Convert to 0-100 scale
```

---

## 🔍 Key Insights

1. **GRIT > Credentials**: GRIT signals (weight 5) predict success better than credentials (weight 3)
2. **Speed Matters**: Founder speed is the most important YC-style dimension (0-3 points)
3. **Customer Obsession**: Daily/weekly customer feedback = high GRIT score
4. **Shipping Velocity**: Features shipped, deployment frequency = execution signals
5. **Pattern Matching**: System matches against known successful patterns from market intelligence

---

## 📁 Key Files

- `/server/services/startupScoringService.ts` - Core GOD algorithm (24.6KB)
- `/god-score-v2-engine.js` - V2 engine with 5-point system
- `/server/services/investorScoringService.ts` - Investor scoring
- `/src/services/matchingService.ts` - Integration layer

---

**The GOD algorithm is designed to identify founders who inspire, who are always learning, and who nail product-market fit unexpectedly - not just those with impressive credentials.**

