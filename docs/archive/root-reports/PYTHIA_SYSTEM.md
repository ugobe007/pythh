# 🔮 Pythia Speech Ontology System v0.2

## Overview

Pythia is a sophisticated speech analysis system that scores founders/companies based on public "thin slices" of language (news quotes, blogs, websites, PR) to estimate outcome potential **WITHOUT** relying on long interviews, charisma, or fundraising persuasion.

**Key Principle**: When data is sparse/marketing-heavy, infer LESS and quantify uncertainty MORE.

---

## System Architecture

### 1. Database Schema

**Tables:**
- `pythia_speech_snippets` - Stores individual speech snippets with source tiers
- `pythia_scores` - Stores computed Pythia scores with breakdown

**Source Tiers:**
- **Tier 1 (Earned)**: Live Q&A, forum posts, support threads, postmortems, investor letters
- **Tier 2 (Semi-earned)**: Podcasts, conference talks, long-form essays
- **Tier 3 (PR/Marketed)**: Press quotes, company blogs, marketing pages

**Migration:** Run `migrations/add_pythia_speech_schema.sql` in Supabase SQL Editor

---

### 2. Feature Extraction

**Core Invariants (Sparse-Robust):**
1. **Constraint Language (0-10)**: Commitments, tradeoffs, exclusions
   - "We will not...", "The only thing that matters is...", "We killed feature Z because..."
2. **Mechanism Density (0-10)**: Causal structure and explanations
   - "Because incentives...", "Switching costs...", "Users churn when... so we changed..."
3. **Reality Contact (0-10)**: Ground truth indicators
   - "Retention moved from 22% to 31%", "We ran 12 experiments", "We shipped X, it broke Y"

**Anti-Hype Penalties:**
- Adjective-to-Verb Ratio Penalty (0-10)
- Narrative without Constraint Penalty (0-10)
- Unfalsifiable Claims Penalty (0-5)

**Location:** `scripts/pythia/feature-extractor.js`

---

### 3. Scoring Engine

**Pythia Score (0-100):**
```
Core Score (0-60):
  - Constraint Language (0-10) × 2
  - Mechanism Density (0-10) × 2
  - Reality Contact (0-10) × 2

Optional Ontology Add-on (0-15):
  - Sum of 5 ontologies (0-3 each)

Penalties (0-25):
  - Subtract adjective/verb penalty
  - Subtract narrative/no-constraint penalty
  - Subtract unfalsifiable penalty

Final = clamp(core + ontology - penalties, 0, 100)
```

**Confidence Score (0.10-0.95):**
- Starts at 0.20
- +0.10 per additional source (cap +0.40)
- +0.20 if Tier 1 exists
- +0.10 if Tier 2 exists
- +0.10 if ≥2 contexts
- -0.20 if ≥70% Tier 3
- -0.10 if low temporal diversity
- Clamped between 0.10 and 0.95

**Location:** `scripts/pythia/scoring-engine.js`

---

## Usage

### Step 1: Run Migration

```sql
-- In Supabase SQL Editor
-- Copy and paste contents of: migrations/add_pythia_speech_schema.sql
-- Click Run
```

### Step 2: Collect Speech Snippets

You need to collect speech snippets from various sources. Each snippet should have:
- `entity_id` (startup ID)
- `text` (the speech content)
- `source_url`
- `date_published`
- `source_type` (press_quote, podcast_transcript, etc.)
- `tier` (1, 2, or 3)
- `context_label` (press, product, technical, etc.)

### Step 3: Score Entities

```javascript
const { computePythiaScore } = require('./scripts/pythia/scoring-engine');

const snippets = [
  {
    text: "...",
    tier: 1,
    source_type: "forum_post",
    context_label: "technical",
    date_published: "2025-01-01"
  },
  // ... more snippets
];

const result = computePythiaScore(snippets);
console.log(result.pythia_score); // 0-100
console.log(result.confidence); // 0.10-0.95
console.log(result.breakdown); // Detailed scores
```

---

## Key Features

### "Think Around Corners" Logic

1. **Stability as Signal**: Compare language across contexts/audiences; inconsistency = masking/PR
2. **Contradictions are Powerful**: "We were wrong", "Killed feature", "Postmortem" → boosts sovereignty + reality contact
3. **Require Corroboration**: Tier 3 claims must be supported by Tier 1/2 before scoring high
4. **Avoid Charisma Bias**: Don't use sentiment/positivity as predictor; focus on constraints/mechanisms/reality

### Guardrails

- If `confidence < 0.35`, do NOT interpret high `pythia_score` as "likely success"
- Label as "high-variance / needs more earned speech"
- Tier 3 signals are discounted by 30% unless corroborated

---

## Integration with GOD Scoring

The Pythia score can be integrated into the GOD scoring system as an additional component, similar to how `founder_voice_score` is currently integrated.

**Future Integration:**
- Add `pythia_score` column to `startup_uploads`
- Incorporate as weighted component (e.g., 10-15% weight)
- Use confidence score to adjust weight (higher confidence = higher weight)

---

## Files

- `migrations/add_pythia_speech_schema.sql` - Database schema
- `scripts/pythia/feature-extractor.js` - Feature extraction logic
- `scripts/pythia/scoring-engine.js` - Scoring engine
- `PYTHIA_SYSTEM.md` - This documentation

---

## Next Steps

1. ✅ Database schema created
2. ✅ Feature extractor implemented
3. ✅ Scoring engine implemented
4. ⏳ Create snippet collection script
5. ⏳ Create main scoring script
6. ⏳ Integrate with GOD scoring system
7. ⏳ Build scraper integration

---

*Version: 0.2 (Sparse-Data Focus)*
*Last Updated: January 2026*
