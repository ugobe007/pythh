# Data brain

The corpus is already in `startup_uploads`, `startup_signal_scores`, and `investor_quotes`. The daily brain reads that data and writes one pack to `data_brain_insights`. It does not invent companies or quotes, and it does not change `GOD_SCORE_CONFIG` weights or `startup_investor_matches.created_at`.

```bash
npm run brain:daily:dry
npm run brain:daily
```

Scheduled job `data-brain` on Platform Daily Batch runs at 06:15 UTC, after the signal bridge has refreshed `startup_signal_scores`.

## What the pack contains

- **Sector mix and tag alerts.** How often each specific sector tag appears. A tag on 35% or more of the window is an alert, not a trend.
- **Sector momentum.** Specific sectors whose approved-startup counts rose or cooled versus the prior 30 days. A rise is reported only when the prior window is in the sample and has at least 3 rows.
- **Keywords.** Terms that show up more often in high-signal companies (`signals_total` ≥ 6.5) than in the rest of the window. A term becomes a match hint only when those companies also share one specific sector.
- **Thesis phrases.** Two-word phrases taken from spoken `investing_in` / `looking_for` quotes. `invested_in` lines are not turned into new portfolio claims.
- **Score shape.** Share of rows with traction at 100, share whose market score sits in the 49–56 band, and names whose copy is a headline or boilerplate.

Generic sectors (Technology, SaaS, AI/ML, Enterprise) are not used as match hints. A learned term has to point at a specific sector such as Infrastructure, HealthTech, or CleanTech.

## How matching uses it

On each match pass the server loads the newest pack. When a startup has no specific stored sector, `sectorsForMatching` may add up to two learned sectors if the description contains a term from the pack. That list is what the candidate pool and the sector score both see. Startups that already have a specific sector are left on their stored tags.

## How scoring uses it

`toScoringProfileFromStartupUpload` drops headline and boilerplate sentences from tagline, pitch, description, and value proposition before `calculateHotScore` pattern-matches them. Structured ARR, customers, and round amounts stay. A Pulse article or “raised $92m in Series C” line no longer counts as traction text. The next score calculation picks this up; this job does not rewrite stored scores by itself.
