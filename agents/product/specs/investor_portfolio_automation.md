# Investor Portfolio Automation

**Status:** Building  
**Opportunity ID:** `investor_portfolio_automation`  
**Priority:** P0 (investor retention + differentiation)  
**Canon:** `agents/INVESTOR_CANON.md`

## Problem

Investors sign up but lack a sticky, differentiated reason to stay. Founders get instant match preview; investors get a form and a digest. Competitors (Affinity, Carta, Harmonic) own **CRM-of-record** gravity. Pythh must offer **automated dealflow + tracked virtual portfolio** — not another static list.

## Canonical promise

> Investors automate dealflow and portfolio management with Pythh: pick **10 startups**, track signals over time, route thesis-fit deals, and (roadmap) sync to Carta, Smartsheet, Standard Metrics.

## Solution

### Phase 1 — Virtual portfolio picks (MVP, ≤1 week)

| Item | Detail |
|------|--------|
| Cap | **10 startups** per investor (`investor_portfolio_picks` or enforce on `investor_lookup_list_items`) |
| API | Extend `POST /api/investor-lookup/portfolio/items` — 409 at cap, return `{ picks_used, picks_max }` |
| UI | Portfolio page in `NEW_pythh_site` — pick list, GOD delta since entry, link to `/portfolio/:id` detail |
| Signup complete | CTA: “Pick your first 3 from explore” |
| Events | `investor_portfolio_pick_added`, `investor_portfolio_cap_reached` |

Existing infra:

- `server/routes/investorLookup.js` — virtual portfolio list
- `server/services/investorLookupService.js` — `getOrCreateVirtualPortfolioListId`
- `src/pages/InvestorPortfolioPage.tsx` — reference UI (port to NEW_pythh_site)
- Public Oracle fund: `/portfolio`, `virtual_portfolio` table (separate from investor picks)

### Phase 2 — Portfolio delta loop (≤2 weeks)

- Weekly email: “N of your 10 moved — score + funding summary”
- Reuse `previewMatchDelta` pattern for investor pick set
- Metric: `return_visit_7d`, `investor_weekly_active`

### Phase 3 — Export & integrations (≤4 weeks)

| Integration | MVP | Full |
|-------------|-----|------|
| CSV/JSON export | Pick list + entry/current GOD + MOIC estimate | Scheduled export |
| Smartsheet | Zapier/webhook template | Native API |
| Standard Metrics | Document OAuth scope | KPI overlay on picks |
| Carta | Export format matching cap table import | Partner API when available |

Do **not** claim live Carta/SM sync until OAuth ships.

### Phase 4 — MCP tools

Extend MCP surface:

- `list_my_portfolio_picks`
- `add_portfolio_pick` (respect 10 cap)
- `portfolio_delta_7d`
- `export_portfolio_csv`

## Success metrics

| Metric | Baseline | Target (30d) |
|--------|----------|--------------|
| Investors with ≥1 pick | TBD | 40% of signups |
| Avg picks per active investor | — | ≥3 |
| Investors at 10-pick cap | — | 10% (power users) |
| `return_visit_7d` (investors) | ~0 | 15% |
| Portfolio sync export usage | 0 | ≥5/week |

## Copy (experiment registry)

Update `investor_signup_schema` variants to test portfolio-forward headlines (see INVESTOR_CANON).

## Dependencies

- Investor signup completion fix (shipped 2026-06-25)
- `investor_dealflow_digest` — links into pick flow
- Explore / search UI for investors

## Open questions

- Single shared `virtual_portfolio` table vs per-investor `investor_lookup` lists only?
- Do investor picks contribute to public track record or stay private?
- IC-style notes per pick (already supported as `notes` on list items)?
