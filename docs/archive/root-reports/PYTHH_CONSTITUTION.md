# THE PYTHH PRODUCT CONSTITUTION
## Immutable Doctrine v1.0
### Frozen: January 20, 2026

---

## Article I — What Pythh Is

**Pythh is NOT:**
- a fundraising tool
- an investor directory
- a matching engine
- a scoring system
- a coaching product
- a SaaS dashboard
- a demo UI
- an analytics platform

**Pythh IS:**

> A capital navigation system that orients founders in capital-space and shows them how to move.

It translates: `founder-space → capital-space`

It reveals:
- who recognizes you
- who does not
- why
- how close you are
- how to change your odds

---

## Article II — The Prime Directive

Pythh exists to solve **founder problems first**.

Everything else (investors, ecosystem, data, monetization) is downstream.

The product must always answer:

| Question | Surface |
|----------|---------|
| Who recognizes me right now? | Top 5 Revelation |
| Who doesn't — and why? | Misalignment |
| How is capital currently reading me? | Trust Mirror |
| How close am I to flipping recognition? | Conviction |
| What signal change would move my odds? | Conviction + Action |

**If any surface does not serve one of these questions, it does not ship.**

---

## Article III — The Psychological Contract

Pythh must move founders through:

```
Trust → Belief → Conviction → Desire
```

In that order.

- Not conversion.
- Not engagement.
- Not retention.

**Psychological state comes first. Behavior follows.**

---

## Article IV — The Canonical Page Order

The main product page (`/results`) must always be structured as:

### 1. TOP 5 REVELATION SURFACE — *Outcome*

> "Here are the five investors who recognize you right now."

| Invariant | Requirement |
|-----------|-------------|
| Position | Always first, always above fold |
| #1 Dominance | Visually larger than #2-5 |
| Why Lines | Human + causal (never AI/algorithm) |
| Distance Labels | "Warm path likely" / "Portfolio adjacent" / "Cold" |
| Alignment Steps | Micro-actions per investor |
| Signal Scores | Non-judgmental numbers |

### 2. MISALIGNMENT SURFACE — *Reality*

> "You do NOT align with these investors right now."

| Invariant | Requirement |
|-----------|-------------|
| Existence | Must exist, must not be hidden |
| Real Funds | Show actual investor names |
| Causal Whys | Explain the mismatch |
| Missing Signals | What they don't see |
| Near-Misses | Highlight closest flips |
| Shame Removal | Frame as orientation, not failure |

### 3. TRUST MIRROR — *Orientation*

> "Here's how capital currently reads your startup."

| Invariant | Requirement |
|-----------|-------------|
| Format | "You are being read as..." statements |
| No Numbers | No scores, grades, percentages |
| No Judgment | No good/bad framing |
| No Advice | No "you should" |
| Synthesis | One "This is why..." sentence |
| Evolution | Must change as signals change |

### 4. CONVICTION SURFACE — *Agency*

> "Here's how to flip recognition."

| Invariant | Requirement |
|-----------|-------------|
| Specificity | Investor-specific, not generic |
| Near-Miss | Show blocking signals |
| Small Changes | Smallest viable signal flip |
| Leverage | Show what it would unlock |
| Collateral | Show other investors it would flip |
| No Coaching | No moral language |

### 5. DESIRE SURFACE — *Scale + Inevitability*

> "Here's how much more capital visibility exists."

| Invariant | Requirement |
|-----------|-------------|
| Blur Target | Blur investors (name/score), never insight |
| Both Scales | Show aligned AND misaligned counts |
| Temporal | "3 new this week", "2 warming up" |
| Partial Legibility | Tags, stage, distance visible |
| CTA | "Unlock your full investor map" |
| Aliveness | "Matches update as signals change" |
| Never Demo | No "preview", "trial", "upgrade" |

### 6. DIAGNOSTICS — *Hidden*

| Invariant | Requirement |
|-----------|-------------|
| Position | Never primary, never early |
| Access | Hidden by default |
| Purpose | Internal metrics, debug, engine room |

---

## Article V — Emotional Contract

### Pythh must NEVER:
- ❌ shame founders
- ❌ praise founders
- ❌ judge founders
- ❌ lecture founders
- ❌ motivate founders
- ❌ coach founders
- ❌ scold founders
- ❌ sermonize
- ❌ moralize

### Pythh must ALWAYS:
- ✅ orient
- ✅ explain
- ✅ reveal
- ✅ translate
- ✅ show causality
- ✅ show leverage
- ✅ remove shame
- ✅ show evolution

---

## Article VI — Language Doctrine

### BANNED PHRASES (never use):

```
"Too early"
"Not ready"
"Weak signals"
"Low quality"
"Bad fit"
"Improve your startup"
"You should"
"You must"
"You need to"
"AI-powered"
"Our model thinks"
"GOD score"
"Algorithm says"
```

### REQUIRED PHRASES (use these):

```
"You align with…"
"You do not align with… right now"
"How capital currently reads you"
"Recognition window forming"
"Signals missing"
"How to move closer"
"This change would flip…"
"This is why…"
"Portfolio adjacent"
"Warm path likely"
```

---

## Article VII — The Trust Rule

**Pythh must NEVER:**
- hide logic
- blur insight
- gate understanding
- obscure causality
- fake scarcity
- exaggerate scale

> Trust always comes before desire.

---

## Article VIII — The Anti-List Rule

**Pythh must NEVER collapse into:**
- a flat list
- a ranking table
- a CRM UI
- a SaaS card grid
- a dashboard
- an admin screen

> Hierarchy, causality, and orientation must always be encoded in the layout itself.

---

## Article IX — The Evolution Rule

**The product must always feel alive.**

| Element | Must Evolve |
|---------|-------------|
| Rankings | Must shift |
| Alignments | Must evolve |
| Near-misses | Must change |
| Trust Mirror | Must update |
| Conviction leverage | Must reorder |
| Desire scale | Must move |

> A static oracle is a dead oracle.

---

## Article X — The Category Lock

**Pythh is NOT in the category of:**
- fundraising tools
- investor discovery
- startup analytics
- AI SaaS
- venture CRM

**Pythh IS in the category of:**

> **Capital Navigation Systems**

Everything must reinforce that.

---

## Article XI — The Founder-First Rule

**If any change:**
- delays Top 5
- obscures investor matches
- weakens causality
- introduces judgment
- replaces orientation with advice
- replaces leverage with coaching
- replaces reality with promotion

**It does not ship. No exceptions.**

---

## Article XII — The Drift Prevention Test

Every future feature must pass this test:

> **Does this make the founder more oriented in capital-space and more able to change their odds?**

If not, it does not ship.

---

## The One Sentence That Freezes Everything

> **Pythh does not evaluate founders. It orients them in capital-space and shows them how to move.**

---

# ENGINEERING CONTRACT

## Pre-Commit Checklist

Before any PR touching `/results`, `/match`, or core surfaces:

- [ ] Top 5 is first and above fold
- [ ] #1 is visually dominant (larger than #2-5)
- [ ] No banned phrases in UI copy
- [ ] No numbers in Trust Mirror
- [ ] No advice/coaching language
- [ ] Conviction is investor-specific
- [ ] Desire blurs investors, not insight
- [ ] Temporal movement signals present
- [ ] CTA says "investor map" not "sign up"
- [ ] Misalignment surface exists and is visible

## File Ownership

| File | Doctrine Owner | Changes Require |
|------|----------------|-----------------|
| `ResultsPageDoctrine.tsx` | Constitution | Full audit |
| `generateWhyLine()` | Language Doctrine | Phrase check |
| `generateMisalignmentWhy()` | Language Doctrine | Phrase check |
| `capitalReading` | Trust Mirror | No numbers audit |
| `closestFlip` | Conviction | Specificity audit |
| `BlurredMatchCard` | Desire | Partial legibility audit |

## Automated Checks (Recommended)

```typescript
// Add to CI/CD
const BANNED_PHRASES = [
  'too early', 'not ready', 'weak signals', 'low quality',
  'bad fit', 'improve your', 'you should', 'you must',
  'you need to', 'ai-powered', 'our model', 'god score',
  'algorithm'
];

function auditCopy(text: string): boolean {
  const lower = text.toLowerCase();
  return !BANNED_PHRASES.some(phrase => lower.includes(phrase));
}
```

## Breaking Change Definition

A **breaking change** to Pythh doctrine is any change that:

1. Moves Top 5 below the fold
2. Makes #1 equal size to #2-5
3. Removes Misalignment surface
4. Adds numbers to Trust Mirror
5. Makes Conviction generic (not investor-specific)
6. Blurs insight instead of investors in Desire
7. Uses banned phrases
8. Adds coaching/advice language
9. Removes temporal movement signals
10. Makes any surface feel like a demo/trial

**Breaking changes require explicit doctrine review.**

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Jan 20, 2026 | Initial frozen doctrine |

---

## Final Grounding

You are not building software.

You are building: **A new mental model of fundraising.**

The UI is not a feature layer. It is the representation of an oracle.

The engine is already extraordinary. This constitution is what protects it from being rendered as something forgettable.

---

**This is now frozen doctrine.**

No one — including the original author — gets to violate this again.
