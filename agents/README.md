# Pythh AI Agent System

Continuous improvement toward **100 signups/day** via specialized agents on the [Claude Agent SDK agent loop](https://code.claude.com/docs/en/agent-sdk/agent-loop).

**North star:** `agents/north-star.json`

## Layers

| Layer | Agent | Scope | Cadence |
|-------|-------|-------|---------|
| **Research** | `agents/research/` | Market survey — founder pain, workflow friction, funding gaps | Weekly (before Product) |
| **Product** | `agents/product/` | Cross-domain review, backlog, specs, experiments | Weekly |
| **Growth** | `agents/growth/` | Signup schemas & copy A/B tests | Weekly |
| **Pipeline** | scripts (no LLM) | Data health, enrichment, match quality | Weekly runbook |

```
Research (market signals) → Product (what to build) → Growth (how to convert) → Ship → Measure
```

The **Research Sub-Agent** scans RSS + internal events for workflow friction and missing data, writes market briefs, and hands high-confidence findings to the **Product Agent**. Product prioritizes the backlog and delegates signup tests to **Growth**.

## Human-in-the-loop

```
Metrics → Agents propose → You approve → Implement → Deploy → Measure
```

Agents **never** auto-deploy. Draft findings, opportunities, and experiment variants stay draft until you promote them.

## Commands

```bash
npm run research:snapshot     # RSS + DB friction scan + signup velocity
npm run research:agent        # full market research loop

npm run product:metrics       # unified snapshot (includes research summary)
npm run product:agent         # product decisions + specs
npm run product:agent:plan

npm run growth:metrics
npm run growth:agent

npm run pipeline:weekly-dashboard
```

## Reports

- `reports/research-snapshot-*.json` / `research-agent-*.json`
- `agents/research/briefs/*-market-brief.md`
- `reports/product-metrics-*.json` / `product-agent-run-*.json`
- `reports/growth-metrics-*.json`
- `reports/pipeline-weekly-*.json`

## Path to 100 signups/day

| Phase | Signups/day | What agents focus on |
|-------|-------------|----------------------|
| Validate | 1 | Research finds real pain; Growth tests one hero variant |
| Repeatable | 10 | Instrument funnel; one winning experiment |
| Scale | 30 | Research-informed features + engagement loops |
| Target | 100 | Multi-channel + retention; match quality trusted |

## Adding a new domain agent

1. Create `agents/<domain>/CLAUDE.md`
2. Add metrics/snapshot script if measurable KPIs exist
3. Register in `agents/product/domains.json`
4. Wire npm script + GitHub workflow
