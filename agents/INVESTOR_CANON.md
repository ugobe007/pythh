# Investor Canon — Pythh

**Read this for any investor-facing product, growth, research, or copy work.**  
Complements `agents/ORCHESTRATOR.md` (voice + loops) with the **investor value proposition** and roadmap.

---

## Core promise

**Investors automate dealflow and portfolio management with Pythh.**

Pythh is not a static directory or another CRM spreadsheet. It is a **live signal engine** that:

1. **Routes thesis-fit startups** to the investor (digest, MCP, explore)
2. **Tracks picks over time** — GOD score momentum, funding, exits, sector drift
3. **Connects to how investors already work** — agents (MCP), email, and (roadmap) portfolio systems

Voice: same as orchestrator — **picky, skeptical, motivating**. Show what we screened out; prove fit with evidence; end with one clear action.

---

## Primary investor loops

| Loop | Hook | Return trigger | Metric |
|------|------|----------------|--------|
| **Thesis dealflow** | Weekly digest + explore ranked by GOD | New matches in your sectors | `investor_weekly_active` |
| **Virtual portfolio (10 picks)** | Pick up to **10 startups** — your tracked book | Signal delta, funding, score moves on *your* picks | `investor_portfolio_pick_added`, `return_visit_7d` |
| **Agent-native workflow** | MCP: query, rank, explain, save to portfolio | Daily agent checks / Cursor rules | MCP tool calls, `investor_portfolio_pick_added` |
| **Portfolio sync (roadmap)** | Export / sync to Carta, Smartsheet, Standard Metrics | One-click refresh into existing PM stack | `portfolio_sync_completed` |

Every investor proposal must name **which loop** it strengthens.

---

## Virtual portfolio — investor product (canonical)

### What it is

Each investor builds a **personal virtual portfolio of up to 10 startups**, tracked over time:

- **Entry snapshot:** GOD score, stage, sector, valuation estimate at pick date
- **Live tracking:** score delta, funding rounds, exits, signal velocity
- **Performance view:** MOIC-style marks, health tier, “what changed this week”

Distinct from **Oracle's public fund** (`/portfolio` — Pythh-curated picks crossing GOD 70).  
Investor portfolios are **user-owned books** via `/api/investor-lookup/portfolio` (see `docs/INVESTOR_LOOKUP_API.md`).

### Rules (product)

| Rule | Value |
|------|--------|
| Max picks per investor | **10** |
| Pick action | Save from explore, digest link, or MCP `save_to_portfolio` |
| Tracking period | Indefinite while account active; weekly delta email optional |
| Empty state CTA | “Pick your first 3 from today's thesis matches” |

### MVP (shipped / in progress)

- Signup → explore → save to virtual portfolio (investor-lookup API)
- Post-signup complete page: orient to **pick 10 + track**
- Digest links into startup detail → save

### Next (backlog — do not over-promise in copy)

- Enforced **10-pick cap** + pick counter UI
- **Portfolio dashboard** in `site/` (port from `src/pages/InvestorPortfolioPage.tsx`)
- **Weekly portfolio delta** email (“3 of your 10 moved this week”)
- **Compare** investor picks vs Oracle fund / sector benchmark

---

## Portfolio management integrations (roadmap)

Investors already live in **Carta**, **Smartsheet**, **Standard Metrics**, and spreadsheets. Pythh should **meet them there**, not replace overnight.

### Integration principles

1. **Export first** — CSV/JSON of picks + scores + deltas (≤1 week)
2. **Read-only sync** — pull pick list + marks into Smartsheet/Airtable via API
3. **Partner APIs** — Carta cap table awareness; Standard Metrics KPI pull where OAuth available
4. **MCP as universal adapter** — “Sync my Pythh portfolio to…” as agent tool

### Named systems (priority order)

| System | Use case | Phase |
|--------|----------|-------|
| **Smartsheet / Airtable** | Deal pipeline boards, IC memos | Export + webhook |
| **Standard Metrics** | Portfolio company KPIs vs Pythh signals | OAuth read (roadmap) |
| **Carta** | Cap table, ownership, valuations | Partner API / export |
| **Google Sheets** | Ad-hoc LP reporting | CSV + Apps Script template |

Copy may say **“Connect your portfolio tools (coming soon)”** — not “integrated with Carta today” until OAuth ships.

Spec: `agents/product/specs/investor_portfolio_automation.md`

---

## Signup & positioning copy (canonical)

**Headline options (test via `investor_signup_schema`):**

- “Automate dealflow — track your top 10 picks”
- “Thesis-fit startups, ranked live. Build a portfolio that updates itself.”
- “Get dealflow routed to your inbox” (email-first variant — subline carries portfolio hook)

**Subline:**

> Pick up to 10 startups. Pythh tracks GOD signals, funding, and momentum — and routes new thesis-fit deals to you. Connect MCP for agent-native workflow; portfolio tool sync coming soon.

**Post-signup (complete page):**

1. Pick startups from explore (goal: 3 picks in first session, 10 over 7 days)
2. Connect MCP at `/developers`
3. Optional: complete firm + thesis for better routing

---

## Agent division (investor work)

| Agent | Investor focus |
|-------|----------------|
| **Growth** | Signup schema, digest outbound, signup→first pick conversion |
| **Product** | 10-pick cap, portfolio UI, delta emails, integration export |
| **Research** | How VCs use Carta/SM/Sheets; distrust of dealflow tools |
| **Pipeline** | Match quality + inventory so investor digest has signal |

---

## Decision filter (investor)

1. Does this get an investor to **pick ≥1 startup** in session 1?
2. Does this give a reason to **return weekly** (delta on *their* 10)?
3. Does this reduce **spreadsheet manual work** (export/sync/MCP)?
4. Can we **measure** it in 7 days?

If fewer than 2 are “yes,” deprioritize.

---

## Compaction

Preserve: 10-pick limit, loop names, integration roadmap phase, API paths (`/api/investor-lookup/portfolio`), metrics, voice ratio.
