# PYTHH TRENDS — INVARIANTS (LOCKED)

**Status:** LOCKED — DO NOT MODIFY WITHOUT EXPLICIT APPROVAL  
**Last reviewed:** January 31, 2026  
**Owner:** Product

---

## Purpose

The Trends page is a **capital simulation surface**.  
It must never drift into "content", "marketing", or "analytics".  
These rules are non-negotiable.

---

## 1. Canonical Truths

- Trends is **market-wide**, not personalized
- Trends is **relative**, not absolute
- Trends shows **preference**, not outcomes
- Trends teaches by **interaction**, not explanation

**If a change violates one of these, it is rejected.**

---

## 2. Ranking Logic Invariants

- GOD Score is the **default ordering**
- GOD Score = composite, cross-model baseline
- All VC lenses are **deterministic re-weightings**, not heuristics
- **No randomness**
- **No editorial overrides**
- **No smoothing** that hides movement

---

## 3. VC Lens Invariants

VC lenses = stored models (criteria + psychology)

Clicking a lens:
- Re-orders the **entire table**
- Animates rank changes
- Subtly changes UI accent

**No explanations inline.**  
Score logic is visible only on **intentional drill-down**.

> **This is critical:**  
> The shock of re-ordering is the feature.

---

## 4. Score + Movement Invariants

- **Score** = lens-specific evaluation output
- **Δ** = rank delta, not score delta
- **Velocity** = acceleration, not popularity
- Rank movement must be **visually noticeable but restrained**

**If founders cannot feel movement, the page fails.**

---

## 5. Scale Invariants

- **Hundreds** of startups visible
- **Infinite scroll**
- No pagination
- No "Top 10"
- No empty states
- No highlighting "winners"

**The page must feel bigger than the user.**

---

## 6. Interaction Invariants

Clickable:
- ✓ Startup name
- ✓ Score
- ✓ Lens

Not clickable:
- ✗ Everything else

**No buttons. No CTAs. No "Get started".**

Curiosity is the engine.

---

## 7. Copy Invariants

- One-line description only
- No adjectives
- No promises
- No hype
- One disclaimer at the bottom, max one line

**If copy explains too much, it is wrong.**

---

## 8. Failure Modes (EXPLICITLY FORBIDDEN)

- ❌ Explaining VC psychology on the page
- ❌ Collapsing rows into cards
- ❌ Adding charts "for clarity"
- ❌ Ranking by funding amount
- ❌ Sorting by vanity metrics
- ❌ Adding badges, emojis, or gamification

**This page dies instantly if any of the above ship.**

---

## The Contract

Print it. Pin it. Defend it.

```
// CODE COMMENT — PASTE IN PythhTrendsPage.tsx
// ═══════════════════════════════════════════════════════════════
// TRENDS INVARIANTS — DO NOT MODIFY WITHOUT READING:
// /PYTHH_TRENDS_INVARIANTS.md
// 
// 1. GOD Score = default, deterministic baseline
// 2. VC lenses = re-weighted models, no randomness
// 3. Δ = rank delta (not score delta)
// 4. Velocity = acceleration (not popularity)
// 5. Infinite scroll, hundreds visible
// 6. Click score = drill into VC logic (future)
// 7. No CTAs, no buttons, no explanations inline
// 
// If these drift, the page dies.
// ═══════════════════════════════════════════════════════════════
```
