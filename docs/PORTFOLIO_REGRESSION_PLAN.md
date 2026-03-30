# Portfolio Regression: GOD Score Validation & Calibration

> **Goal:** Manually import VC portfolio companies, score them with GOD, track performance, and run regression to validate and fine-tune the scoring system.

---

## 1. Why This Matters

- **Validation:** Do high GOD scores correlate with real outcomes (funding, exits)?
- **Calibration:** Which components (team, traction, market, product, vision) predict success?
- **Feedback loop:** ML recommendations today use internal signals; portfolio outcomes are ground truth.

---

## 2. Data Flow

```
[VC Portfolio Page] → Manual copy (CSV) → Import script
                                              ↓
                                    vc_portfolio_exhaust
                                    (source_type='manual')
                                              ↓
                              Match to startup_uploads (get GOD)
                                              ↓
                              Track performance (manual or from DB)
                                              ↓
                              Regression: GOD vs performance
                                              ↓
                              ml_recommendations / weight tuning
```

---

## 3. Schema (Already Exists)

### `vc_portfolio_exhaust`

| Column | Use |
|--------|-----|
| investor_id | Which VC |
| startup_id | Link to startup_uploads (null if no match) |
| startup_name | Company name (from portfolio page) |
| startup_website | Optional, helps matching |
| source_type | **'manual'** for hand-entered |
| source_url | Portfolio page URL |
| round | e.g. "Seed", "Series A" |
| amount | Investment amount |
| filing_date | When invested |
| raw | JSONB for performance: `{performance_status, exit_date, exit_value, raised_again}` |

### Performance in `raw`

Store manually entered outcomes:

```json
{
  "performance_status": "exited" | "raised_again" | "active" | "failed",
  "exit_date": "2024-03-15",
  "exit_value_usd": 50000000,
  "raised_again_date": "2023-06-01",
  "next_round_amount_usd": 5000000
}
```

---

## 4. Manual Import Workflow

### Step 1: Gather Data

1. Open VC portfolio page (e.g. Sequoia, a16z, YC).
2. Copy company names (and URLs if visible) into a spreadsheet.
3. Add columns: `investor`, `company_name`, `company_website`, `round`, `source_url`.
4. Save as CSV under **`VC_Portfolio_Companies/`** in the repo (see that folder’s `README.md`). CSV files there are gitignored by default.

### Step 2: Import

```bash
# Import from CSV (creates vc_portfolio_exhaust rows, matches to startups)
npm run portfolio:import -- path/to/portfolio.csv

# Or directly
node scripts/import-portfolio-csv.js path/to/portfolio.csv

# With options
node scripts/import-portfolio-csv.js portfolio.csv --investor=Sequoia --source-url="https://..."

# Dry run (preview, no DB writes)
node scripts/import-portfolio-csv.js portfolio.csv --dry-run
```

Template: `scripts/portfolio-import-template.csv`

**Important:** The first argument must be a **real file path** on your machine (e.g. `~/Desktop/my-vc-portfolio.csv`). Paths like `/path/to/your-portfolio.csv` or `your-portfolio.csv` in docs are placeholders only. Do not paste comment lines starting with `#` into the shell (zsh will try to run them).

**URL-only CSV:** If you only have company URLs, use columns `investor`, `company_name` (optional), and `company_website` / `company_url` / `url` for the link.

### Step 3: Match & Score

- Import script tries to match `company_name` / `company_website` to `startup_uploads`.
- Matched → `startup_id` set, GOD score available.
- Unmatched → `startup_id` null; you can later create startups and re-run matching.

### Step 4: Add Performance Data

Either:
- **A.** Update `raw` in vc_portfolio_exhaust with outcomes (script or admin UI).
- **B.** Use existing startup_uploads data: `total_funding_usd`, `last_round_amount_usd` = proxy for "performed."

---

## 5. Regression Metrics

| Outcome | Definition | Source |
|---------|------------|--------|
| **funded_again** | Raised a follow-on round | startup_uploads.total_funding_usd, last_round_amount_usd, or raw |
| **exited** | Acquisition or IPO | raw.performance_status, portfolio_events, or startup_exits |
| **performance_tier** | 0=failed, 1=active, 2=raised again, 3=exited | Derived |

### Regression Types

1. **Logistic:** `funded_again ~ god_score` (probability of raising)
2. **Logistic:** `exited ~ god_score` (probability of exit)
3. **Linear:** `ln(exit_value) ~ god_score` (for exited companies)
4. **Component analysis:** Which of team/traction/market/product/vision predicts best?

---

## 6. Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `import-portfolio-csv.js` | `npm run portfolio:import -- file.csv` | Import CSV → vc_portfolio_exhaust, match to startups |
| `portfolio-regression.js` | `npm run portfolio:regression` | Run regression, output correlation & recommendations |
| `portfolio-import-template.csv` | — | CSV template with column headers |

---

## 7. Output → GOD Tuning

Regression output can feed:

1. **ml_recommendations** – if we add a `portfolio_validation` recommendation type.
2. **god_algorithm_config** – manual weight tweaks based on which components predict.
3. **Documentation** – "GOD score X correlates with Y% funded rate" for marketing.

---

## 8. Next Steps

1. [ ] Create `scripts/import-portfolio-csv.js`
2. [ ] Create `scripts/portfolio-regression.js`
3. [ ] (Optional) Add `portfolio_performance` columns to vc_portfolio_exhaust for cleaner querying
4. [ ] Run pilot: import 2–3 VC portfolios (50–100 companies each), add performance where known, run regression
