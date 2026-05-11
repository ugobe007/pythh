---
name: ai-saas-redesign
description: "End-to-end workflow for redesigning a SaaS or AI product landing page and building an interactive AI agent UX flow. Use when: evaluating and rebuilding an existing SaaS website, creating a named AI agent with an automated pipeline story, designing a multi-step user activation flow (URL submission to scan to match results to live pipeline feed), or integrating domain-specific inference logic (e.g., email address generation from name + firm). Covers design philosophy selection, copy strategy, component architecture, and reusable utility patterns."
---

# AI SaaS Redesign Skill

End-to-end process for redesigning a SaaS landing page and building an interactive AI agent pipeline UX. Follow phases in order.

## Phase 1 — Evaluate the Existing Site

Visit the live site and record:

- **Headline clarity**: Does it state the product value in one sentence?
- **Hero CTA**: Specific (URL input, email) or vague ("Get Started")?
- **Best existing copy**: Find the one line that works — elevate it to the hero.
- **Typography**: Distinctive pairing or generic single-weight Inter?
- **Color dominance**: Any single overused color (e.g., cyan) to reduce?
- **Redundant sections**: Anything duplicated by a better visual element?

Save findings before proceeding.

## Phase 2 — Design Philosophy

Write three distinct approaches in `ideas.md`, each defining: Design Movement, Color Philosophy, Typography System, Layout Paradigm, Signature Elements, Animation Philosophy. Select one and commit fully — document the chosen style at the top of every CSS/component file.

**Anti-patterns:** Purple gradients, excessive rounded corners, full-page centered hero, cyan as dominant fintech accent.

**Proven dark AI/fintech palette:**
- Background: `oklch(0.13 0.01 264)` (deep obsidian)
- Primary accent: `oklch(0.696 0.17 162.48)` (emerald green)
- Secondary accent: `oklch(0.769 0.188 70.08)` (amber orange)
- Fonts: Space Grotesk Bold (display) + JetBrains Mono (data values)

Full token set: `references/design-tokens.md`

## Phase 3 — Copy Strategy

| Element | Rule |
|---|---|
| Hero headline | Action verb + outcome, ≤6 words. e.g., *"Automate your investment pipeline."* |
| Hero subheadline | Name the agent, state what it does, end with the founder's only job |
| CTA label | Verb + agent name. e.g., *"Activate PYTHIA"* not *"Get Started"* |
| Pipeline copy | Each step = what the agent does, not what the user does |
| Closing line | Always end the agent intro with the user's minimal obligation |

**Highest-converting closing pattern:** *"You approve. You show up. That's it."*

## Phase 4 — Name the AI Agent

1. Derive from the product name (pythh.ai → PYTHIA, the Oracle of Delphi)
2. Give it a mythological or archetypal anchor for memorability
3. Write a one-sentence origin: *"Named for the high priestess of Delphi who saw the future before anyone else."*
4. Define the acronym if useful (PYTHIA = Predictive Yield & Thesis Heuristic Intelligence Agent)
5. Use the name as the primary CTA verb: *"Activate PYTHIA"*

Agent appears in: hero activity card, "Meet Your [Agent]" section with avatar + origin story, all pipeline milestone copy, footer tagline.

## Phase 5 — Activation Flow Architecture

Single `/activate` route, `Step` state: `entry → scanning → results → pipeline`

Wire hero CTA:
```tsx
sessionStorage.setItem("pythia_url", url);
navigate("/activate");
```

**Step 1 — Entry:** Full-screen URL input, pre-populate from `sessionStorage`, validate before advancing.

**Step 2 — Scanning:** 6-step progress tracker, staggered timers (1000–2000ms/step), pulsing agent avatar, auto-advance on completion.

**Step 3 — Match Results:** Ranked cards (name, firm, role, match score, signal score, sector tags). Expandable detail: WHY MATCHED + RECENT SIGNAL + EMAIL TARGETS panel. PYTHIA insight summary above list. Bottom CTA: full-width amber "Run Pipeline with [Agent] →".

**Step 4 — Pipeline Feed:** Left: milestone stream (auto-advancing, 3–8s stagger). Right: sidebar with stage tracker + confirmed meetings. Meeting milestones show amber Approve / Reschedule / Decline buttons. On approve: milestone confirms, meeting added to sidebar.

Milestone types: `match | pitch | outreach | response | meeting | brief`

Full component patterns: `references/pipeline-component-patterns.md`

## Phase 6 — Email Inference Engine

Build `src/lib/emailInference.ts` for outreach-automation products:

| Priority | Pattern | Confidence |
|---|---|---|
| 1 | `firstname@domain` | High |
| 2 | `firstname.lastname@domain` | High |
| 3 | `firstinitial.lastname@domain` | Medium |
| 4 | `lastname@domain` | Medium |
| 5 | `firstinitiallastname@domain` | Low |
| 6 | `pitches@`, `deals@`, `dealflow@` | Fallback (pitch) |
| 7 | `info@`, `contact@`, `hello@` | Fallback (generic) |

Domain inference: maintain `FIRM_DOMAIN_MAP` for known firms. For unknowns, slugify (lowercase, strip "Capital/Ventures/Partners/Fund/Group", remove spaces, append `.com`).

Surface in two places:
- Match results expanded card → "PYTHIA EMAIL TARGETS" panel with confidence badges
- Pipeline outreach milestones → chip row of tried addresses, checkmark on primary

Full implementation: `references/email-inference-template.ts`

## Phase 7 — Image Generation

Generate images **before** building components. Use `generate_image` for:
- Hero background (abstract dark texture matching design philosophy)
- Agent avatar (sleek AI icon — not a face, not abstract art)
- Dashboard/pipeline UI mockup (dark-mode product screenshot style)

**Reject any result** that looks like abstract art, a disco ball, or a stock illustration. Regenerate with more specific UI/dashboard language.

Upload with `manus-upload-file --webdev` and use the returned CDN URL directly in code.

## Sections: Remove vs. Keep

| Section | Decision | Reason |
|---|---|---|
| "How [Agent] Works" step list | Remove if activation flow exists | The interactive flow IS the explainer |
| "Powered by / Backed by" logo bar | Remove on dark backgrounds | Dark logos on dark bg are invisible |
| Generic 3-up feature cards | Replace with agent story | Agent narrative converts better |
| Live signals / data table | Keep | Demonstrates real product value |
| Testimonials | Keep | Social proof anchors credibility |
