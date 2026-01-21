# THE PYTHH ENGINEERING PAGE CONTRACT
## Immutable Interface v1.0
### Frozen: January 20, 2026

**This is the only allowed shape of the core product page.**
**If a change violates this, it does not ship.**

---

## SECTION 0 — Invocation State
*(Before results render)*

### Purpose
Confirm causality: "I pasted my URL → the system is working."

### Required Elements
- Startup name (as detected)
- Domain
- Category guess
- Status line: `"Analyzing capital alignment…"`

### Forbidden
- ❌ Spinners without content
- ❌ Demo data
- ❌ Example investors
- ❌ Trust mirror
- ❌ Diagnostics
- ❌ Preloaded lists

---

## SECTION 1 — TOP 5 REVELATION SURFACE
*(Always above the fold)*

### Purpose
Deliver outcome immediately.

### Data Requirements (Backend → Frontend)

```typescript
top5: Array<{
  investor_id: string
  name: string
  signal_score: number
  distance: "warm" | "portfolio-adjacent" | "cold"
  tags: string[]
  why_line: string
  rising?: boolean
  new_match?: boolean
  overlapping_signals: string[]
  leverage_signals: string[]
}>
```

### UI Invariants
| Rule | Requirement |
|------|-------------|
| Render Order | Must render first |
| Position | Must render above the fold |
| Resilience | Must render even if everything else fails |
| #1 | Visually dominant |
| #2–#5 | Subordinate |
| Layout | No tables, no flat grids, no uniform card sizing |

### Each Top 5 Card Must Show
- Investor name
- Signal Score (label: `"Signal Score"`)
- Distance label
- Tags
- One-line why
- Two micro-actions: `"Why this match"` / `"How to align"`

### Expand: "Why this match"
```typescript
{
  causal_reasons: string[]      // max 3
  overlapping_signals: string[]
  timing_context: string        // one sentence
}
```

### Expand: "How to align"
```typescript
{
  leverage_actions: string[]    // max 3
  why_this_works: string        // one sentence
  collateral_effects: string[]  // investor names
}
```

### Forbidden in Top 5
- ❌ Internal metrics
- ❌ Diagnostics
- ❌ System state
- ❌ Readiness labels
- ❌ Coaching language
- ❌ "AI-powered"
- ❌ Product narration

---

## SECTION 2 — MISALIGNMENT SURFACE
*(Immediately after Top 5)*

### Purpose
Build belief by symmetry.

### Data Requirements
```typescript
misaligned: Array<{
  investor_id: string
  name: string
  stage: string
  thesis: string
  fit_score: number
  why_not_line: string
  missing_signals: string[]
  distance: "cold" | "orthogonal" | "narrative-repelled"
  near_miss?: boolean
}>
```

### UI Invariants
| Rule | Requirement |
|------|-------------|
| Existence | Must exist |
| Visibility | Must not be hidden |
| Gating | Must not be gated |
| Blur | Must not be blurred |
| Names | Must show real investor names |
| Contrast | Must visually contrast Top 5 |
| Tone | Must feel cooler and quieter |

### Each Misaligned Card Must Show
- Investor name
- Stage
- Thesis
- Fit %
- One-line why not
- Missing signals
- Distance label

### Forbidden
- ❌ Shame language
- ❌ Rejection framing
- ❌ "Too early"
- ❌ "Not ready"
- ❌ Coaching advice
- ❌ Product narration

---

## SECTION 3 — TRUST MIRROR
*(After Misalignment)*

### Purpose
Orientation without judgment.

### Data Requirements
```typescript
trust_mirror: {
  orientation_statements: string[] // exactly 4–6
  synthesis_sentence: string
}
```

### UI Invariants
| Rule | Requirement |
|------|-------------|
| Numbers | Must contain no numbers |
| Scores | Must contain no scores |
| Advice | Must contain no advice |
| Diagnostics | Must contain no diagnostics |
| Jargon | Must contain no jargon |
| Narration | Must contain no product narration |

### Forbidden
- ❌ Readiness framing
- ❌ Coaching tone
- ❌ Evaluation tone
- ❌ Praise
- ❌ Judgment
- ❌ Motivation

---

## SECTION 4 — CONVICTION SURFACE
*(After Trust Mirror)*

### Purpose
Agency via leverage.

### Data Requirements
```typescript
conviction: {
  investor_name: string
  distance_to_flip: number
  blocking_signals: string[]
  leverage_actions: string[]
  collateral_investors: string[]
}
```

### UI Invariants
| Rule | Requirement |
|------|-------------|
| Specificity | Must be investor-specific |
| Framing | Must show near-miss framing |
| Changes | Must show smallest viable signal changes |
| Collateral | Must show collateral effects |
| Generic | Must never be generic |
| Moral | Must never moralize |

### Forbidden
- ❌ Generic advice
- ❌ Coaching language
- ❌ Motivation
- ❌ Product narration

---

## SECTION 5 — DESIRE SURFACE
*(After Conviction)*

### Purpose
Reveal scale + inevitability.

### Data Requirements
```typescript
desire: {
  more_aligned_count: number
  more_misaligned_count: number
  new_matches_this_week: number
  warming_up_count: number
  cooling_off_count: number
  blurred_aligned: Array<{
    rank: number
    category: string
    stage: string
    thesis: string
    distance: string
    why_partial: string
  }>
}
```

### UI Invariants
| Rule | Requirement |
|------|-------------|
| Insight | Must not blur insight |
| Names | Must blur investor names only |
| Scale | Must show scale |
| Movement | Must show movement |
| Demo | Must not feel like a demo |
| Gate | Must gate access as inevitability |

### CTA Contract
**Button label:** `Unlock your full investor map`

### Forbidden
- ❌ Feature lists
- ❌ Pricing
- ❌ SaaS upsell language
- ❌ "Upgrade"
- ❌ "Subscribe"
- ❌ Demo framing

---

## SECTION 6 — DIAGNOSTICS
*(Hidden, optional)*

### Purpose
Engine room for power users.

### Data Requirements
Unbounded.

### UI Invariants
| Rule | Requirement |
|------|-------------|
| Access | Must be behind a toggle |
| Visual | Must be visually subordinate |
| Default | Must never be default open |
| Blocking | Must never block rendering of other sections |

---

## SECTION 7 — FAILURE MODES
*(Non-negotiable)*

### If scan fails:
- ✅ Still render Trust Mirror
- ✅ Still render Misalignment
- ✅ Still render Desire Surface
- ✅ Show partial Top 5 if available
- ❌ Never show demo data

### If investors missing:
- ✅ Render empty Top 5 cards
- ✅ Show: `"No investors currently recognize your narrative."`
- ✅ Still render Misalignment
- ✅ Still render Trust Mirror
- ✅ Still render Conviction

### Forbidden
- ❌ Redirect to home
- ❌ Show blank page
- ❌ Show demo data
- ❌ Show product narration

---

## THE ONE RULE THAT OVERRIDES ALL OTHERS

**If a change:**
- Delays Top 5
- Obscures investor matches
- Weakens causality
- Introduces judgment
- Replaces orientation with advice
- Replaces leverage with coaching
- Replaces reality with promotion

**It does not ship. No exceptions.**

---

## THE FINAL LOCK

The Pythh page is not a UI.
It is a **capital navigation instrument**.

Everything must serve:
- **Orientation**
- **Causality**
- **Agency**
- **Evolution**

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Jan 20, 2026 | Initial frozen contract |

---

**This is now the single truth source.**

No Copilot change. No refactor. No UX experiment. No smart idea. No design pass.

Gets to violate this again.
