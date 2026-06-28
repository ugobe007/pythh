# Industry GOD Scoring - Complete Configuration 🎯

## Overview

The Industry GOD Scoring system now supports **ALL tracked sectors** with industry-specific benchmarks and expectations. Each industry has unique characteristics that affect how startups are evaluated.

## How Industry Scoring Works

### For Each Industry, We Define:

1. **Traction Expectations**
   - `no_revenue_penalty`: How harshly to penalize early-stage startups with no revenue
   - `early_revenue_bonus`: Bonus if they DO have revenue early (unexpected)
   - `customer_count_multiplier`: Adjust customer count expectations (0.4 = very few normal, 1.4 = many expected)
   - `growth_rate_multiplier`: Adjust growth rate expectations (0.6 = slow normal, 1.4 = fast expected)

2. **Team Expectations**
   - `technical_bonus`: Extra points for technical cofounder (varies by industry)
   - `education_multiplier`: How much education credentials matter (1.0 = normal, 1.4 = critical)
   - `industry_experience_bonus`: Bonus for industry-specific experience

3. **Product Expectations**
   - `ip_bonus`: Bonus for patents/IP (higher for hardware/biotech)
   - `regulatory_bonus`: Bonus for regulatory approvals/certifications
   - `launched_bonus`: Bonus for launched product
   - `demo_bonus`: Bonus for demos
   - `launched_penalty`: Penalty if NOT launched (negative = less penalty)

4. **Market Expectations**
   - `tam_bonus_multiplier`: Multiplier for TAM bonuses
   - `competition_penalty`: Penalty for high competition (less negative = less penalty)

5. **Adjustment Factor**
   - Final multiplier applied to industry score (0.95 = high bar, 1.20 = lenient)

---

## Complete Industry Benchmarks

### 1. **Biotech** 🔬
**Characteristics:** Long R&D cycles (5-10 years), high IP value, regulatory hurdles

**GOD Scoring Adjustments:**
- **Traction:** Lenient on revenue (-10 penalty vs -15 default), huge bonus if they DO have revenue (+15)
- **Team:** PhDs/scientific backgrounds matter more (education x1.3), biotech experience +15
- **Product:** IP is HUGE (+20), regulatory approvals matter (+15), not launched is OK
- **Market:** Massive TAM (x1.2), less competition penalty
- **Adjustment:** +15% boost (biotech scoring 40 overall = 46 industry score)

**Why:** Biotech takes forever to show revenue. A startup with revenue is exceptional.

---

### 2. **AI/ML** 🤖
**Characteristics:** Fast-moving, need to show traction quickly, high competition

**GOD Scoring Adjustments:**
- **Traction:** Standard penalty (-15), fast growth expected (x1.3 multiplier)
- **Team:** Technical cofounder CRITICAL (+15), AI industry experience +10
- **Product:** Launch velocity matters (+10), demos crucial (+8), IP less important
- **Market:** High competition penalty (-10)
- **Adjustment:** -5% reduction (AI scoring 40 overall = 38 industry score - high bar)

**Why:** AI moves fast. High competition means you need to stand out.

---

### 3. **FinTech** 💳
**Characteristics:** Regulatory hurdles, need compliance, revenue can come faster than biotech

**GOD Scoring Adjustments:**
- **Traction:** Moderate penalty (-12), standard growth expectations
- **Team:** Compliance experience +12, banking/payments experience +10
- **Product:** Regulatory approvals +12, security certifications +10
- **Market:** Large TAM (x1.15), moderate competition
- **Adjustment:** +5% boost

**Why:** Regulatory compliance is critical. Experience matters.

---

### 4. **Robotics** 🦾
**Characteristics:** Long R&D, capital intensive, IP matters most

**GOD Scoring Adjustments:**
- **Traction:** Very lenient (-8 penalty), huge bonus if they have revenue (+18)
- **Team:** Technical team CRITICAL (+18), hardware experience +15
- **Product:** Patents HUGE (+25), prototypes matter more than launch
- **Market:** Massive TAM (x1.3), less competition
- **Adjustment:** +20% boost (robotics scoring 40 overall = 48 industry score)

**Why:** Hardware is hard. If they have revenue, they're doing something exceptional.

---

### 5. **HealthTech** 🏥
**Characteristics:** Digital health, telemedicine, faster than biotech but still regulated

**GOD Scoring Adjustments:**
- **Traction:** Moderate leniency (-12), can show revenue faster than biotech
- **Team:** Clinical experience +10, education matters (x1.1)
- **Product:** HIPAA compliance +12, IP less critical than biotech (+8)
- **Market:** Large TAM (x1.15)
- **Adjustment:** +8% boost

**Why:** Faster path to revenue than biotech, but still needs compliance.

---

### 6. **SaaS** 💻
**Characteristics:** Standard B2B software, fast iteration, predictable revenue

**GOD Scoring Adjustments:**
- **Traction:** Standard expectations (-15 penalty), slight growth premium (x1.1)
- **Team:** Standard technical bonus (+10), B2B experience +5
- **Product:** Launch matters (+10), demos key (+8), IP less important
- **Market:** Baseline expectations
- **Adjustment:** 1.0 (baseline - no adjustment)

**Why:** This is the standard. All other industries are compared to this.

---

### 7. **EdTech** 📚
**Characteristics:** Education technology, longer sales cycles, B2B/B2C mix

**GOD Scoring Adjustments:**
- **Traction:** Slightly lenient (-13), slower growth expected (x0.9 - seasonal)
- **Team:** Education credentials matter (x1.1), education industry experience +8
- **Product:** Standard expectations
- **Market:** Moderate TAM (x1.1), moderate competition
- **Adjustment:** +3% boost

**Why:** Schools have long sales cycles and seasonal patterns.

---

### 8. **Sustainability / Climate Tech** 🌱
**Characteristics:** Long sales cycles, B2B enterprise, impact focus

**GOD Scoring Adjustments:**
- **Traction:** Lenient (-11), enterprise = fewer customers (x0.7), slower growth
- **Team:** Climate/energy experience +10, education matters (x1.1)
- **Product:** Clean tech patents matter (+10), certifications +8
- **Market:** Massive TAM (x1.2), less competition
- **Adjustment:** +10% boost

**Why:** Enterprise sales take time, but TAM is huge.

---

### 9. **E-commerce** 🛒
**Characteristics:** Consumer-focused, fast growth possible, high competition

**GOD Scoring Adjustments:**
- **Traction:** Should show revenue quickly (-14), customer count critical (x1.2), fast growth (x1.2)
- **Team:** E-commerce/retail experience +8
- **Product:** Launch critical (+10)
- **Market:** Baseline TAM, very competitive (-10 penalty)
- **Adjustment:** -2% reduction

**Why:** Consumer market moves fast, but highly competitive.

---

### 10. **Cybersecurity** 🔒
**Characteristics:** High value, security-focused, enterprise sales

**GOD Scoring Adjustments:**
- **Traction:** Enterprise sales cycles (-13), fewer customers (x0.8)
- **Team:** Security expertise critical (+12), security industry experience +12
- **Product:** Security certifications critical (+12), patents matter (+8)
- **Market:** Large TAM (x1.15)
- **Adjustment:** +5% boost

**Why:** Security expertise is non-negotiable. Certifications prove credibility.

---

### 11. **PropTech** 🏠
**Characteristics:** Real estate technology, slow-moving industry, enterprise

**GOD Scoring Adjustments:**
- **Traction:** Real estate is slow (-12), fewer customers (x0.8), slower growth (x0.9)
- **Team:** Real estate experience +10
- **Product:** Some compliance matters (+6)
- **Market:** Moderate TAM (x1.1)
- **Adjustment:** +4% boost

**Why:** Real estate industry is notoriously slow-moving.

---

### 12. **FoodTech** 🍔
**Characteristics:** Food technology, B2B/B2C mix, logistics complexity

**GOD Scoring Adjustments:**
- **Traction:** Moderate leniency (-12)
- **Team:** Food/restaurant experience +9
- **Product:** Food tech patents matter (+6), FDA for food products (+8)
- **Market:** Moderate TAM (x1.1)
- **Adjustment:** +3% boost

**Why:** Food industry has its own complexities and regulations.

---

### 13. **Developer Tools** 🛠️
**Characteristics:** Technical audience, fast adoption possible, open source factor

**GOD Scoring Adjustments:**
- **Traction:** Should show adoption quickly (-14), fast growth (x1.2)
- **Team:** Technical cofounder CRITICAL (+15), tech company experience +8
- **Product:** Demos crucial (+10), launch matters (+10)
- **Market:** Competitive (-9 penalty)
- **Adjustment:** -3% reduction

**Why:** Developers adopt fast, but competition is high. Technical chops are non-negotiable.

---

### 14. **Marketing** 📢
**Characteristics:** Marketing tech, fast-moving, competitive

**GOD Scoring Adjustments:**
- **Traction:** Should show revenue quickly (-14), fast growth (x1.1)
- **Team:** Marketing experience +7
- **Product:** Launch matters (+9), demos helpful (+7)
- **Market:** Very competitive (-10 penalty)
- **Adjustment:** -2% reduction

**Why:** Marketing tools are everywhere. Need to stand out.

---

### 15. **HR/Talent** 👥
**Characteristics:** HR tech, enterprise sales, slower adoption

**GOD Scoring Adjustments:**
- **Traction:** Enterprise sales cycles (-13), fewer customers (x0.9), slower growth (x0.95)
- **Team:** HR/talent experience +9
- **Product:** Compliance matters (+7 for EEOC, etc.)
- **Market:** Moderate TAM (x1.1)
- **Adjustment:** +2% boost

**Why:** Enterprise HR tools have long sales cycles but stick around.

---

### 16. **Logistics** 🚚
**Characteristics:** Supply chain, B2B enterprise, complex sales

**GOD Scoring Adjustments:**
- **Traction:** Enterprise sales cycles (-12), fewer customers (x0.8), slower growth (x0.95)
- **Team:** Logistics/supply chain experience +10
- **Product:** Standard expectations
- **Market:** Huge TAM (x1.15)
- **Adjustment:** +6% boost

**Why:** Enterprise supply chain tools have massive TAM but complex sales.

---

### 17. **Consumer** 📱
**Characteristics:** Consumer apps, viral growth possible, high competition

**GOD Scoring Adjustments:**
- **Traction:** Should show traction (-14), user count CRITICAL (x1.3), viral growth (x1.3)
- **Team:** Consumer app experience +6
- **Product:** Launch critical (+10)
- **Market:** Very competitive (-11 penalty)
- **Adjustment:** -4% reduction

**Why:** Consumer market is brutal. Need viral growth or die.

---

### 18. **Gaming** 🎮
**Characteristics:** Consumer gaming, viral growth, high competition

**GOD Scoring Adjustments:**
- **Traction:** Can monetize through ads/freemium (-13), user count CRITICAL (x1.4), viral growth (x1.4)
- **Team:** Gaming industry experience +8
- **Product:** Game demos matter (+8), launch critical (+10)
- **Market:** Very competitive (-10 penalty)
- **Adjustment:** -3% reduction

**Why:** Gaming is all about DAU/MAU. Growth is everything.

---

## Summary Table

| Industry | No Revenue Penalty | Tech Bonus | IP Bonus | Adjustment Factor | Score Meaning |
|----------|-------------------|------------|----------|-------------------|---------------|
| **Biotech** | -10 (lenient) | +10 | +20 | 1.15x | Long R&D, IP critical |
| **Robotics** | -8 (very lenient) | +18 | +25 | 1.20x | Long R&D, hardware hard |
| **Sustainability** | -11 (lenient) | +10 | +10 | 1.10x | Enterprise sales, huge TAM |
| **HealthTech** | -12 (moderate) | +10 | +8 | 1.08x | Faster than biotech, still regulated |
| **Logistics** | -12 | +9 | +6 | 1.06x | Enterprise, huge TAM |
| **FinTech** | -12 | +8 | +5 | 1.05x | Regulatory, compliance critical |
| **Cybersecurity** | -13 | +12 | +8 | 1.05x | Security expertise critical |
| **PropTech** | -12 | +8 | +5 | 1.04x | Slow-moving industry |
| **FoodTech** | -12 | +9 | +6 | 1.03x | Food industry complexity |
| **EdTech** | -13 | +8 | +5 | 1.03x | Long sales cycles, seasonal |
| **HR/Talent** | -13 | +8 | +5 | 1.02x | Enterprise HR, slow adoption |
| **SaaS** | -15 (standard) | +10 | +3 | 1.00x | Baseline |
| **Developer Tools** | -14 | +15 | +5 | 0.97x | High bar, technical critical |
| **Gaming** | -13 | +10 | +5 | 0.97x | Viral growth required |
| **E-commerce** | -14 | +8 | +3 | 0.98x | Competitive, fast-moving |
| **Marketing** | -14 | +8 | +3 | 0.98x | Very competitive |
| **Consumer** | -14 | +9 | +3 | 0.96x | Brutal competition |
| **AI/ML** | -15 (strict) | +15 | +5 | 0.95x | High bar, fast-moving |

---

## Usage

The scoring script automatically:
1. Identifies the primary industry from startup's sectors
2. Applies industry-specific adjustments to component scores
3. Calculates both overall and industry-adjusted GOD scores
4. Stores both in the database

**Output Example:**
```
✅ [Seed] NovaAnalytics: 64 [AI/ML:61] (T:68 Te:50 M:50 P:100 S:0 V:87)
✅ [Pre-Seed] BioGen: 35 [Biotech:40] (T:20 Te:50 M:45 P:30 S:0 V:40)
```

- First number = Overall GOD score
- `[Industry:Score]` = Industry-adjusted GOD score

