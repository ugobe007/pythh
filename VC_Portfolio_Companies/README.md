# VC Portfolio Companies

Put **manually collected** portfolio data here (**`.csv` only** for import). The scraper cannot reach many VC portfolio pages; this folder is the hand-curated source of truth for regression work.

**Not RTF:** If you used TextEdit and got `VC_Portfolio_Companies.rtf` at the **repo root**, that is not the same as this folder. Export or re-save as plain-text CSV (TextEdit: Format → Make Plain Text, then save as `VC_Portfolio_Companies/my-list.csv`), or use Excel/Sheets → Download CSV.

## CSV format

Same as `scripts/portfolio-import-template.csv`:

| Column | Required | Notes |
|--------|----------|--------|
| `investor` | If not using `--investor=` on CLI | Name must match (partial) an `investors` row |
| `company_name` | Yes | Display name from the portfolio page |
| `company_website` | Recommended | Or `company_url` / `url` — improves matching to GOD scores |
| `round` | No | e.g. Seed, Series A |
| `amount` | No | Optional |
| `source_url` | No | Portfolio page URL |

## Import into the database

From the **repo root** (`hot-honey`):

```bash
# Dry run
node scripts/import-portfolio-csv.js VC_Portfolio_Companies/your-fund.csv --dry-run

# Apply (set investor + source if every row is the same fund)
npm run portfolio:import -- VC_Portfolio_Companies/your-fund.csv --investor=Sequoia --source-url="https://..."
```

Then:

```bash
npm run portfolio:regression
```

## Git

CSV and spreadsheet files in this folder are **ignored** so you do not accidentally commit lists or URLs. Only this README is tracked. Copy templates from `scripts/portfolio-import-template.csv` into this folder locally.
