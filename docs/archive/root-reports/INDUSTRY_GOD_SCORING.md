# Industry GOD Scoring System 🎯

## Overview

The Industry GOD Scoring system provides **industry-specific evaluations** alongside the overall GOD score, recognizing that different industries have vastly different benchmarks and expectations.

## The Problem It Solves

**Example:**
- **Biotech Startup**: Overall GOD 40, but for biotech that might actually be **excellent** (Industry GOD: 75)
- **Fintech Startup**: Overall GOD 40, but for fintech that might be **average** (Industry GOD: 42)
- **AI/ML Startup**: Overall GOD 40, but for AI that might be **below average** (Industry GOD: 38 - high bar)

**Why?**
- Biotech takes 5-10 years to show revenue/traction (normal!)
- Fintech has regulatory hurdles but can scale faster
- AI/ML moves fast - need to show traction quickly

## How It Works

### Two Scores for Each Startup:

1. **Overall GOD Score** (`total_god_score`)
   - General evaluation across all industries
   - Standard benchmarks for all startups
   - 0-100 scale

2. **Industry GOD Score** (`industry_god_score`)
   - Same algorithm, but adjusted for industry benchmarks
   - Industry-specific expectations for revenue, team, product, market
   - 0-100 scale (but calibrated to industry norms)

### Industry Identification

The system identifies the **primary industry** from the startup's `sectors` array:
- Checks for specific industries first (Biotech, Robotics, Healthcare, AI/ML, Fintech, etc.)
- Falls back to 'default' if no specific industry matches

### Industry-Specific Adjustments

#### 1. **Traction Expectations**

**Biotech:**
- `no_revenue_penalty: -10` (vs -15 default) - Less penalty for no revenue
- `early_revenue_bonus: +15` (vs +8 default) - Bigger bonus if they DO have revenue
- `customer_count_multiplier: 0.5` - Fewer customers is normal
- `growth_rate_multiplier: 0.7` - Slower growth expected

**AI/ML:**
- `no_revenue_penalty: -15` (standard) - Should show some traction
- `growth_rate_multiplier: 1.3` - Fast growth expected
- `customer_count_multiplier: 1.2` - User growth matters more

**Robotics:**
- `no_revenue_penalty: -8` - Very normal to have no revenue early
- `early_revenue_bonus: +18` - Huge bonus if they have revenue
- `customer_count_multiplier: 0.4` - Very few customers is normal

#### 2. **Team Expectations**

**Biotech:**
- `technical_bonus: +10` - Scientific/technical team matters more
- `education_multiplier: 1.3` - Education credentials matter more
- `industry_experience_bonus: +15` - Biotech/pharma experience valuable

**AI/ML:**
- `technical_bonus: +15` - Technical cofounder is CRITICAL
- `industry_experience_bonus: +10` - OpenAI, Google AI experience

**Fintech:**
- `compliance_experience_bonus: +12` - Regulatory/compliance experience
- `security_bonus: +10` - Security certifications matter

#### 3. **Product Expectations**

**Biotech:**
- `ip_bonus: +20` - Patents/licenses are HUGE
- `regulatory_bonus: +15` - FDA approval, etc.
- `launched_penalty: 0` - Not having a "launched" product is OK

**Robotics:**
- `ip_bonus: +25` - Patents are HUGE
- `prototype_bonus: +15` - Working prototype matters more than "launch"

**Fintech:**
- `regulatory_bonus: +12` - Licenses, compliance certifications
- `security_bonus: +10` - Security certifications matter

#### 4. **Final Adjustment Factor**

Each industry has a final multiplier applied:
- **Biotech**: 1.15x (biotech scoring 40 overall = 46 industry score)
- **Robotics**: 1.20x (robotics scoring 40 overall = 48 industry score)
- **AI/ML**: 0.95x (AI scoring 40 overall = 38 industry score - higher bar)
- **Fintech**: 1.05x (fintech scoring 40 overall = 42 industry score)

## Database Schema

### New Columns:

```sql
ALTER TABLE startup_uploads
ADD COLUMN industry_god_score INTEGER DEFAULT NULL,
ADD COLUMN primary_industry TEXT DEFAULT NULL;
```

### Indexes:

- `idx_startup_industry_god_score` - Fast sorting by industry score
- `idx_startup_primary_industry` - Fast filtering by industry
- `idx_startup_industry_scored_approved` - Composite index for common queries

## Usage

### Scoring Script

The scoring script now calculates both scores:

```bash
node scripts/core/god-score-formula.js
```

**Output Example:**
```
✅ [Seed] NovaAnalytics: 64 [AI/ML:61] (T:68 Te:50 M:50 P:100 S:0 V:87)
```

- `64` = Overall GOD score
- `[AI/ML:61]` = Industry GOD score for AI/ML industry

### Viewing Scores

Check industry scores:
```bash
node scripts/check-god-scores.js
```

This will show both overall and industry distributions.

## Industry Benchmarks Summary

| Industry | No Revenue Penalty | Tech Bonus | IP Bonus | Adjustment Factor | Score Meaning |
|----------|-------------------|------------|----------|-------------------|---------------|
| **Biotech** | -10 (lenient) | +10 | +20 | 1.15x | Long R&D, IP matters |
| **Robotics** | -8 (very lenient) | +18 | +25 | 1.20x | Long R&D, capital intensive |
| **Healthcare** | -10 (lenient) | +10 | +15 | 1.12x | Regulatory, IP important |
| **AI/ML** | -15 (standard) | +15 | +5 | 0.95x | Fast-moving, high bar |
| **Fintech** | -12 (moderate) | +8 | +5 | 1.05x | Regulatory, compliance |
| **Default** | -15 (standard) | +10 | +5 | 1.0x | Standard SaaS expectations |

## Benefits

1. **Fair Comparison**: Compare biotech startups to other biotechs, not to SaaS
2. **Better Matching**: Match startups to investors who understand their industry
3. **Accurate Evaluation**: A 40 overall score biotech might be a top performer
4. **Industry Insights**: See which industries are performing well/poorly

## Future Enhancements

1. **Industry-Specific Benchmarks Page**: Show industry averages and distributions
2. **Industry Matching**: Match investors who specialize in specific industries
3. **Industry Trends**: Track how industries are performing over time
4. **Multi-Industry Scoring**: Startups in multiple industries (e.g., "AI + Healthcare")

