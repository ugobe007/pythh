# PYTHH HOMEPAGE v1.0

**Human-Smart Surface**

This is not a marketing page.  
This is not a demo page.  
This is not an onboarding page.

**This is a decision surface.**

---

## The Job of This Page

Make a serious founder think:

> **"This might actually give me an edge. I should try this right now."**

---

## 1) HERO BLOCK (LEFT-ALIGNED, DOMINANT)

No center stack.  
No SaaS hero.  
No marketing gradients.  
No dashboard vibe.

### Headline (big, grounded, ambitious)

```
Find My Investors.
```

Nothing else competes with this.

- No slogans.
- No metaphors.
- No poetry.
- No mysticism.

**This is a power statement.**

---

### Subheadline (quiet authority)

```
Discover which investors match your company right now — and why.
```

Not:
- ❌ hype
- ❌ promises
- ❌ mysticism
- ❌ vibes

**This is grounded and real.**

---

### Input field (inside a calm panel)

**Label:**
```
Your startup website
```

**Placeholder:**
```
https://yourcompany.com
```

**Button:**
```
Find My Investors
```

**Rules:**
- No async behavior.
- No parsing on keystroke.
- No preview.
- No magic before submission.

**This is an intentional act.**

---

## 2) IMMEDIATE SOCIAL PROOF
**(quiet, non-marketing)**

Directly under the input:

```
Recently matched:

Rovi Health → Health Infra Partners
Flux Robotics → US Seed Operator Fund
Argo AI Tools → Enterprise Seed Capital
```

- No logos.
- No hype.
- No testimonials.

**Just quiet evidence that it works.**

---

## 3) INTELLIGENCE TEASER
**(this replaces "how it works")**

This is not an explainer section.  
**This is a leak.**

Short block:

```
We track how investors behave, what they fund, and how companies like yours 
are being recognized over time.

That's how we show you who's aligned with you now — and who's likely to be 
aligned next.
```

- No ML talk.
- No signals jargon.
- No "AI powered" bullshit.

**Just credibility.**

---

## 4) LIVE PREVIEW STRIP
**(this is the real hook)**

This is what you already had that worked emotionally.

Left-aligned horizontal strip:

```
US Seed Operator Fund      72%   warming
Why: Portfolio adjacency + operator bias

Health Infra Partners      69%   forming
Why: Category convergence detected

Seed Stage Capital         66%   adjacent
Why: Similar winners in portfolio
```

- No CTA.
- No gating.
- No blur yet.

**This proves the product without explaining it.**

---

## 5) WHAT YOU ACTUALLY GET
**(human-smart framing)**

Not features.  
Not dashboards.  
Not buzzwords.

**Just four bullets:**

```
What you'll see:

• The investors that match your company right now
• Why they're aligned with you
• Which investors are starting to warm up
• What you can do to increase your odds
```

- No "AI."
- No "signals."
- No "capital posture."

**This is founder language.**

---

## 6) FINAL CTA
**(no new messaging)**

Repeat the same CTA:

```
Find My Investors
```

**Not:**
- ❌ Get started
- ❌ Try free
- ❌ Learn more
- ❌ Sign up

**This is a power move, not a funnel.**

---

## WHAT IS DELIBERATELY NOT ON THIS PAGE

This is as important as what is on it.

❌ **No "How it works"**  
They don't care yet.

❌ **No explainer diagrams**  
That's insecurity marketing.

❌ **No ML / AI language**  
It weakens credibility.

❌ **No testimonials**  
Founders don't trust them.

❌ **No onboarding copy**  
They want results, not instructions.

❌ **No pitch-deck fluff**  
This is not a VC website.

---

## WHY THIS VERSION FIXES THE DIVERGENCE

This homepage:
- ✅ keeps ambition
- ✅ keeps authority
- ✅ keeps seriousness
- ✅ keeps credibility
- ✅ keeps human realism
- ✅ keeps edge
- ✅ keeps clarity

And removes:
- ❌ machine vibes
- ❌ terminal vibes
- ❌ mysticism
- ❌ hippie language
- ❌ dashboard posture
- ❌ patronizing tone
- ❌ theory first
- ❌ intelligence signaling

**It behaves like:**
> A serious product for serious founders.

**Not:**
> An intelligence system showing off.

---

## THE SINGLE TEST THIS PAGE MUST PASS

If a founder lands here and does not think:

> **"This is simple.**  
> **This is concrete.**  
> **This might actually help me.**  
> **I should try it right now."**

Then it is wrong.

**No amount of doctrine saves it.**

---

## COMPONENT STRUCTURE

### Layout (12-column grid, left-weighted)

```tsx
<div className="grid min-h-screen grid-cols-12 gap-6 px-8 py-12">
  {/* LEFT: Primary Invocation (cols 1-6) */}
  <section className="col-span-6">
    <HeroPrimary />
    <InputPanel />
    <SocialProof />
  </section>

  {/* RIGHT: Intelligence Leak (cols 7-12) */}
  <section className="col-span-6">
    <IntelligenceTeaser />
    <LivePreviewStrip />
  </section>

  {/* BOTTOM: Value Proposition (cols 1-12) */}
  <section className="col-span-12">
    <WhatYouGet />
    <FinalCTA />
  </section>
</div>
```

---

## EXACT COPY BLOCKS

### HeroPrimary
```tsx
<h1 className="text-6xl font-bold text-neutral-900 mb-4">
  Find My Investors.
</h1>
<p className="text-xl text-neutral-600">
  Discover which investors match your company right now — and why.
</p>
```

### InputPanel
```tsx
<div className="bg-neutral-50 p-8 rounded-lg border border-neutral-200">
  <label className="block text-sm font-medium text-neutral-700 mb-2">
    Your startup website
  </label>
  <input 
    type="url"
    placeholder="https://yourcompany.com"
    className="w-full px-4 py-3 border border-neutral-300 rounded"
  />
  <button className="mt-4 w-full bg-neutral-900 text-white py-3 rounded font-medium">
    Find My Investors
  </button>
</div>
```

### SocialProof
```tsx
<div className="mt-6 text-sm text-neutral-600">
  <p className="font-medium mb-2">Recently matched:</p>
  <ul className="space-y-1">
    <li>Rovi Health → Health Infra Partners</li>
    <li>Flux Robotics → US Seed Operator Fund</li>
    <li>Argo AI Tools → Enterprise Seed Capital</li>
  </ul>
</div>
```

### IntelligenceTeaser
```tsx
<div className="bg-neutral-900 text-white p-8 rounded-lg">
  <p className="text-lg leading-relaxed">
    We track how investors behave, what they fund, and how companies like 
    yours are being recognized over time.
  </p>
  <p className="text-lg leading-relaxed mt-4">
    That's how we show you who's aligned with you now — and who's likely 
    to be aligned next.
  </p>
</div>
```

### LivePreviewStrip
```tsx
<div className="mt-6 space-y-4">
  {PREVIEW_MATCHES.map(match => (
    <div className="border-l-4 border-neutral-300 pl-4">
      <div className="flex items-baseline justify-between">
        <h3 className="font-medium text-neutral-900">{match.name}</h3>
        <span className="text-sm text-neutral-500">{match.score}%</span>
        <span className="text-xs text-neutral-400">{match.state}</span>
      </div>
      <p className="text-sm text-neutral-600 mt-1">
        Why: {match.why}
      </p>
    </div>
  ))}
</div>
```

### WhatYouGet
```tsx
<div className="max-w-3xl">
  <h2 className="text-2xl font-bold text-neutral-900 mb-4">
    What you'll see:
  </h2>
  <ul className="space-y-3 text-lg text-neutral-700">
    <li>• The investors that match your company right now</li>
    <li>• Why they're aligned with you</li>
    <li>• Which investors are starting to warm up</li>
    <li>• What you can do to increase your odds</li>
  </ul>
</div>
```

### FinalCTA
```tsx
<button className="mt-8 bg-neutral-900 text-white px-8 py-4 rounded text-lg font-medium">
  Find My Investors
</button>
```

---

## VISUAL WEIGHTS

| Component | % of Visual Attention |
|-----------|---------------------|
| Headline | 30% |
| Input Panel | 25% |
| Live Preview Strip | 20% |
| Intelligence Teaser | 15% |
| What You Get | 8% |
| Social Proof | 2% |

---

## ALIGNMENT CHECK

This version:
- ✅ Keeps "Find My Investors" as the CTA
- ✅ Keeps ambition and authority
- ✅ Keeps human credibility
- ✅ Keeps emotional realism
- ✅ Keeps tension and edge
- ✅ Removes hippie vibes
- ✅ Removes machine vibes
- ✅ Removes theory
- ✅ Removes patronization
- ✅ Removes dashboard posture

**This is the human-smart surface.**

---

## FORBIDDEN ELEMENTS

❌ Center-aligned hero  
❌ "How it works" section  
❌ Feature comparison tables  
❌ Pricing tiers  
❌ Explainer videos  
❌ "Join 1000+ founders" social proof  
❌ Testimonial carousels  
❌ "AI-powered" badges  
❌ Marketing gradients  
❌ Dashboard screenshots  
❌ Founder photo heroes  
❌ "Get started free" CTAs  
❌ Newsletter signups above fold  

---

## RELATED CONTRACTS

- **PYTHH_DESIGN_LANGUAGE_CONTRACT.md** — Voice and tone (Layer 9)
- **PYTHH_HOMEPAGE_SPATIAL_CONTRACT.md** — Layout rules (Layer 4)
- **PYTHH_INPUT_BEHAVIOR_CONTRACT.md** — No async validation (Layer 8)
- **src/config/homeContent.ts** — Content constants
- **src/components/home/InvocationPanel.tsx** — Input component

---

**This spec is FROZEN. Any element that feels like marketing, mysticism, or machine-speak is a violation.**
