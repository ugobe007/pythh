# 🔥 GOD SCORE V2 ARCHITECTURE

## Philosophy: GOD = GRIT + Opportunity + Determination

> "The distance between GREAT and okay is very small and it's the subtle details of founders that make up 70% of the success... they need to NAIL product/market fit in a way no one else expected" - Domain Expert

### Core Insight: Credentials vs. GRIT

| Type | Weight | Example | Opens | Predicts |
|------|--------|---------|-------|----------|
| **Door Opener** | 3 | PhD, Ex-Medtronic, Published | VC meetings, Grants, Talent | ❌ Success |
| **Success Predictor** | 5 | Serial Founder, PLG Builder, Customer Obsessed | - | ✅ Success |

**Key Examples:**
- **Jibo** (MIT founder, PhD team, prestigious VCs) → Failed despite perfect credentials
- **SpaceX** (Elon learned from PayPal failure) → Success through GRIT, not pedigree
- **Airbnb** (Brian Chesky's customer obsession) → Knew every host by name

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    GOD SCORE V2 ENGINE                          │
│                    (god-score-v2-engine.js)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ VALUE PROP (20) │  │   PROBLEM (20)   │  │  SOLUTION (20)  │ │
│  │   What? Clear   │  │   Why care?      │  │  Show us stuff! │ │
│  │   tagline/deck  │  │   Severity match │  │  Demo, launched │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                 │
│  ┌─────────────────────────────┐  ┌───────────────────────────┐ │
│  │         TEAM (20)           │  │     INVESTMENT (20)       │ │
│  │  ┌───────────────────────┐  │  │   Stage/sector fit        │ │
│  │  │ GRIT Signals (+6)     │  │  │   AI multiplier           │ │
│  │  │ • Customer obsession  │  │  │   Revenue traction        │ │
│  │  │ • Shipping velocity   │  │  └───────────────────────────┘ │
│  │  │ • Learned from fail   │  │                                │
│  │  └───────────────────────┘  │                                │
│  │  ┌───────────────────────┐  │                                │
│  │  │ Ecosystem (+4)        │  │                                │
│  │  │ • YC, Sequoia, a16z   │  │                                │
│  │  │ • WSGR, Fenwick       │  │                                │
│  │  └───────────────────────┘  │                                │
│  │  ┌───────────────────────┐  │                                │
│  │  │ Team Patterns         │  │                                │
│  │  │ • Door opener (3)     │  │                                │
│  │  │ • Success pred (5)    │  │                                │
│  │  └───────────────────────┘  │                                │
│  └─────────────────────────────┘                                │
│                                                                 │
│                    TOTAL: 0-100                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Market Intelligence Tables

### 1. `market_problems` (45 records)
Industries × Problems with severity scores:
- AI/ML, BioTech, FinTech, HealthTech, CleanTech, Robotics, SpaceTech, DeepTech, SaaS

### 2. `team_success_patterns` (20 records)
Nuanced patterns with door opener vs success predictor weights:

| Pattern | Weight | Type |
|---------|--------|------|
| PhD + Academic Pedigree | 3 | Door Opener |
| Ex-Top Bank/Fund | 3 | Door Opener |
| Technical + Business Hybrid | 5 | Success Predictor |
| Serial Technical Founder | 5 | Success Predictor |
| PLG Product Builder | 5 | Success Predictor |
| Second Time Founder | 5 | Success Predictor |

### 3. `grit_signals` (18 records)
The intangibles that predict success - now including **Founder Edge** (creativity, cleverness, cunning):

| Signal | Category | Weight | Icon | Keywords |
|--------|----------|--------|------|----------|
| **GRIT** | | | 💪 | |
| Customer Obsession | grit | 10 | 💪 | customer feedback, user interviews, obsessed |
| Learned from Failure | grit | 9 | 💪 | failed, pivoted, second time, bounced back |
| Shipping Velocity | grit | 8 | 💪 | shipped, launched, fast iteration, agile |
| Contrarian Conviction | grit | 8 | 💪 | contrarian, unpopular, against the grain |
| **OPPORTUNITY** | | | ⏰ | |
| Right Problem Right Time | opportunity | 10 | ⏰ | perfect timing, market inflection, tailwind |
| Market Timing Insight | opportunity | 8 | ⏰ | window, first mover, ahead of curve |
| Enabling Tech Awareness | opportunity | 7 | ⏰ | ai breakthrough, cloud native, api economy |
| **DETERMINATION** | | | 🎯 | |
| Resourcefulness | determination | 9 | 🎯 | bootstrapped, lean, scrappy, capital efficient |
| Relentless Execution | determination | 9 | 🎯 | relentless, never give up, persistent, grit |
| Talent Magnetism | determination | 8 | 🎯 | top talent, ex-google, a-players |
| **CREATIVITY** | | | 💡 | |
| First Principles Thinking | creativity | 9 | 💡 | first principles, from scratch, rethink |
| Creative Problem Solving | creativity | 8 | 💡 | novel approach, innovative, breakthrough |
| **CLEVERNESS** | | | 🧠 | |
| Asymmetric Advantage | cleverness | 9 | 🧠 | unfair advantage, unique insight, secret |
| Elegant Solution Design | cleverness | 8 | 🧠 | elegant, 10x, cracked, patent, proprietary |
| **CUNNING** | | | 🦊 | |
| Competitive Moat Building | cunning | 9 | 🦊 | moat, defensible, network effects, flywheel |
| Strategic Positioning | cunning | 8 | 🦊 | wedge, land and expand, beachhead, outmaneuver |
| Timing Manipulation | cunning | 7 | 🦊 | timing, window, now or never, before others |

### 4. `ecosystem_signals` (40 records)
Network effects from top-tier connections:

| Type | Tier 1 (2 pts) | Tier 2 (1 pt) |
|------|---------------|---------------|
| Law Firms | WSGR, Fenwick, Cooley, Gunderson | Goodwin, Orrick |
| Accelerators | YC, IndieBio, Rock Health | Techstars, HAX, 500 |
| Investors | Sequoia, a16z, Founders Fund | Craft, Lux Capital |

### 5. `investment_benchmarks` (36 records)
Stage-appropriate raises by industry with AI multipliers:
- Pre-Seed: $500K-$2M (AI: 5x premium)
- Seed: $2M-$5M (AI: 7x premium)
- Series A: $10M-$25M (AI: 10x premium)

---

## Scoring Functions

### `scoreTeam(startup, industry)` - Max 20 pts
1. **Base**: 5 pts
2. **Team Size** (2+ people): +2 pts
3. **Technical Cofounder**: +4 pts (can ship!)
4. **Success Predictor Match**: +5 pts (GRIT indicator)
5. **Door Opener Match**: +3 pts (credibility, not deterministic)
6. **GRIT Signals**: +0-6 pts (customer obsession, shipping velocity, etc.)
7. **Ecosystem Signals**: +0-4 pts (YC, Sequoia, WSGR, etc.)

### `scoreGritSignals(startup)` - Max 6 bonus pts
Looks for keyword matches in startup text:
- Need 2+ keyword matches to trigger
- Max 2 pts per signal, 3 signals max
- Categories: 💪 grit, ⏰ opportunity, 🎯 determination

### `scoreEcosystemSignals(startup)` - Max 4 bonus pts
- Law Firm: +1 pt (Tier 1) or +0.5 pt (Tier 2)
- Accelerator: +2 pts (Tier 1) or +1 pt (Tier 2)
- Investor: +1 pt (Tier 1) or +0.5 pt (Tier 2)

---

## Expected Score Distribution

| Tier | Range | % of Startups | Meaning |
|------|-------|---------------|---------|
| 🔥 Elite | 70+ | ~10% | Top-tier, GRIT visible |
| ✅ Good | 50-69 | ~28% | Solid, well-positioned |
| 📊 Average | 35-49 | ~60% | Most startups (power law) |
| ⚠️ Below | 20-34 | ~2% | Missing key elements |

**Philosophy**: Elite is rare (power law distribution). Most startups are average. That's expected and healthy.

---

## Running the Engine

```bash
# Score all startups needing updates
node god-score-v2-engine.js

# Score single startup
node god-score-v2-engine.js --startup-id=<uuid>

# Check health after scoring
node system-guardian.js
```

---

## Paul Graham / YC Philosophy Encoded

From direct experience: "Steve Jobs... in all of these experiences, what struck me was his love for people who inspire and intrigue him, people who are constantly learning and challenging the status quo, people who want to do great things that improve the world. And most importantly he would go to great lengths to hire people who he saw could be great, but who haven't had the opportunity yet."

**This is encoded as:**
- Success predictors > Door openers (weight 5 vs 3)
- GRIT signals detect "intangibles" (customer obsession, shipping velocity)
- Ecosystem signals identify who's shaping/grooming the startup
- Problem/timing detection finds "right problem, right time"

---

## Future Enhancements

1. **Founder Lineage Tracking**: Map founder journeys (PayPal → SpaceX, etc.)
2. **Failure → Success Patterns**: Detect "learned from failure" signals
3. **Market Timing Score**: Add external signals for market inflection points
4. **Network Graph**: Map advisor/investor relationships
5. **Sentiment Analysis**: NLP on pitch decks for conviction/passion signals

---

*Last updated: December 19, 2025*
*Philosophy: GOD = GRIT + Opportunity + Determination*
