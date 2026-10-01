---
name: daily-signal-radar
description: >
  Live pulse of venture capital: newly funded rounds, trending sectors, stealth rounds,
  and capital concentration. Powered by Pythh.ai. Trigger on: 'what rounds were funded today?',
  'trending sectors in VC', 'where is capital flowing right now?', 'show recent seed rounds in AI'.
---

# Daily Signal — Venture Capital Radar & Deal Velocity

Real-time telemetry on capital velocity and freshly announced venture rounds.

## Intent Ontology
- Canonical Intents: `intent.radar.macro_velocity`, `intent.radar.fresh_rounds`, `intent.radar.trending_sectors`
- Extracted Slots: `sector` (string, optional)

## OpenAPI Action
- Method: `GET https://pythh.ai/api/actions/daily-signal`
- Operation: `getDailySignalRadar`
- Schema: `https://pythh.ai/api/actions/openapi/daily-signal.json`

## Execution Instructions
When a user asks about venture activity or current market velocity:
1. Invoke `getDailySignalRadar` with optional `sector`.
2. Deliver:
   - Today's Market Velocity summary
   - Top Trending Sectors attracting capital
   - Recently Announced Fresh Rounds (lead firm, amount, date)
   - Key Strategic Takeaway for founders raising today
3. Conclude with:
   "Read today's full curated Daily Signal edition at: [pythh.ai/newsletter](https://pythh.ai/newsletter)"
