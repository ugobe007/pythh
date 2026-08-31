# VC funding news → Signals / GOD calibration notes

**Date:** 2026-08-30  
**Branch:** `cursor/vc-funding-signal-analysis-b98d`  
**Artifacts:** `reports/vc-funding-themes-2026-08-30.json`, `/opt/cursor/artifacts/scrape-ssot.log`, `/opt/cursor/artifacts/scrape-vc-intel.log`

## What we ran

| Job | Result |
|-----|--------|
| `RSS_MAX_SOURCES=80 npm run scrape:ssot` | **1,474** RSS items → **883** events inserted, **98** graph joins; 276 stale skipped |
| `npm run scrape:high-volume:smoke` | +1 discovered startup; VC news sources yielded little new entity extract |
| `npm run intel:scrape-vc -- --limit=40 --stale-days=3` | **40/40** firm rows scraped into `vc_intelligence` |
| `node scripts/analyze-vc-funding-themes.mjs --days=45` | Theme / sector / round / GOD-component report |

**Pre → post (14d `startup_events`):** ~78 events / **4 FUNDING** → **~690+** events / **46+ FUNDING** (and climbing through the scrape window). Last 6h alone inserted **~600+** events.

## What VCs are funding right now (from press)

Clean FUNDING headlines from this scrape (examples):

| Company / deal | Why the money (press framing) | Theme |
|----------------|-------------------------------|-------|
| **Instinct** — $250–350M / ~$2.5B val | Viral consumer AI assistant; velocity + valuation | AI, valuation |
| **Gatik** — $200M | Self-driving trucks + **PepsiCo commercial deal** | Robotics + traction proof |
| **a16z** — $1.1B AI infra fund | Chips, robots, infra — LPs still flooding AI stack | AI infra |
| **Lambda** — $1B debt | Neocloud buying chips | Hardware / infra |
| **Owner** — $240M | Restaurant management platform | Vertical SaaS / ops |
| **Yardstik** — $30M | Post-hire fraud / workforce monitoring | B2B compliance |
| **Runable** — $21M | AI agents for SMB growth | AI agents + SMB |
| **Faro** — $37.3M Series B | AI for clinical trials (Merck GHI + S32) | Health × AI |
| **Atorie** — $9.5M | Luxury consumer without markup | Consumer |
| **Certain Energy** — £10M Series A | Long-duration battery storage | Climate / energy |
| **ColibriTD** — €4M | Quantum simulation platform | Deep tech |
| **Verascient** — $1.2M pre-seed | Company knowledge → AI agents | AI agents / enterprise |
| **Neno** — €6.6M | AI-native financial services | Fintech × AI |
| **Flowt** — pre-seed | Climate-smart business financing (Kenya) | Climate + fintech |
| **Repodo** — €8.2M | AI-native audit (ex-Lunar founders) | AI × compliance |

### Theme frequency (45d raise corpus)

From `analyze-vc-funding-themes.mjs` (headline + raise-like pool):

1. **AI/ML** — dominant (~22–30% of corpus)  
2. **Valuation / mega-round language** — status signaling still loud  
3. **Enterprise / B2B / platform**  
4. **Seed / early** language still present  
5. **Climate / energy**  
6. **Robotics / hardware**  
7. **Health / bio**  
8. **Fintech**  
9. **Defense / space** (smaller but real)  
10. **Team / founder pedigree** — **rare in headlines** (~1–3%)

**Why capital is moving (press “because”):**

1. **AI product + distribution velocity** (Instinct) — market FOMO + consumer pull  
2. **Commercial traction attached to hard tech** (Gatik × PepsiCo) — not thesis alone  
3. **Infra / chips / compute** (Lambda, a16z AI fund) — picks-and-shovels  
4. **Vertical SaaS with clear buyer** (Owner, Yardstik, audit/clinical AI)  
5. **Climate hardware with round clarity** (Certain Energy)  
6. **Agentic workflows for SMBs / knowledge** (Runable, Verascient)

## What VCs say they want (fresh `vc_intelligence`)

From ~38 firms scraped this run (preferences when present):

| Dimension | Top preferences |
|-----------|-----------------|
| **Sectors** | healthcare, technology, deep_tech, ai_ml, crypto/web3, b2b_saas, fintech |
| **Stages** | **series-a**, **seed**, then buyout / growth equity (PE-heavy names in the 40-firm sample) |
| **Signals** | **network effects**, **team_first**, unit economics, revenue-first, vision |

Example thesis (Coyote): healthcare/wellness + behavioral health; prioritizes team, vision, **unit economics**.

## GOD / Signals calibration read

**Live weights today:** team 0.22 / **traction 0.30** / market 0.20 / product 0.15 / vision 0.13.

| Finding | Implication |
|---------|-------------|
| Traction is the highest mean component in the funded join cohort (~42 vs vision ~32) | **Keep traction ≥ 0.30**; do not re-center on vision |
| Press almost never leads with pedigree; leads with product category + amount + commercial proof | Team 0.22 is a floor, not a raise candidate |
| AI saturates headlines; mega-valuations inflate “market” without fundamentals | Raise **news_momentum / capital_convergence** for AI **only when** traction or commercial evidence tags fire; otherwise AI label → mild market bump only |
| Seed + Series A dominate classified rounds when round is known | `capital_convergence` should weight **seed/A velocity** over late vanity raises |
| Climate + robotics show up as real check flow, not just blog thesis | Market sector priors: don’t underweight climate/hardware vs pure SaaS |
| Vision language is weak in both press and funded means | Keep vision ≤ 0.13 until proof-cohort gate (≥5 verified post-prediction pairs) |

### Recommended next calibrations (proposal — not applied)

1. **No live GOD weight change yet** — proof cohort still <5; keep 1.3.0 weights.  
2. **Signal bridge:** boost `commercial_deal` / customer-logo evidence into traction before GOD (Gatik-style).  
3. **AI sector prior:** split **applied AI with revenue/users** vs **infra mega-raise**; only the former should move GOD hard.  
4. **Parser hygiene:** many FUNDING false positives (`Raised on AI`, geographic subjects); tighten `source-quality` + frame subject for raise headlines — improves signal purity for scoring.  
5. **Sector tags on `startup_uploads`:** Gaming/Climate co-tags pollute joins (e.g. Vals AI); sector ontology cleanup needed before sector→weight automation.
6. **Megacorp parents as startups:** `Alphabet` (Google parent, abc.xyz) was `entity_gate=qualified` with GOD 81 and entered funded-cohort + matching. Block via brand ontology + name gate. **Alphabet Ventures** = GV (Google Ventures) — already investor-track. After name-gate ship: `npm run entity-gate:execute` so existing Alphabet* rows flip to `junk` and `EnhancedMatchingService` skips them.

## Clean funded cohort (recommended)

Press headlines stay unfiltered; the **funded cohort** join can be sliced for calibration:

| Filter | Purpose |
|--------|---------|
| `--min-god=N` | Drop low-GOD ledger rows (noise / weak joins) |
| `--exclude-sectors=Gaming,Media` | Drop sector-tag pollution from RSS inference |
| default junk-name drop | Uses `startupNameGate` + `isValidStartupName` (Boil, That, Company, …) |
| `--include-junk-names` | Opt out of name filtering |

```bash
# Clean slice (Gaming out, GOD≥55, junk names dropped)
npm run analyze:vc-funding-themes:clean

# Same flags explicitly
npm run analyze:vc-funding-themes -- --min-god=55 --exclude-sectors=Gaming

# Full unfiltered cohort (legacy behavior)
npm run analyze:vc-funding-themes -- --days=45 --include-junk-names
```

**Interpretation:** With clean filters, expect a smaller cohort (~60–80 deals vs ~400+ deduped) and higher GOD means (total ~70–75, traction ~75–80). Use this slice for GOD calibration; use unfiltered press themes for “what VCs are talking about.”

## How to re-run (full pipeline)

```bash
RSS_MAX_SOURCES=80 npm run scrape:ssot
npm run intel:scrape-vc -- --limit=40 --stale-days=3
npm run analyze:vc-funding-themes:clean -- --out=reports/vc-funding-themes-$(date -u +%F).json
```
