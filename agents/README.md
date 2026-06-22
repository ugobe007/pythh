# Pythh AI Agent System

Continuous product improvement via specialized agents on the [Claude Agent SDK agent loop](https://code.claude.com/docs/en/agent-sdk/agent-loop).

## Layers

| Layer | Agent | Scope | Cadence |
|-------|-------|-------|---------|
| **Product** | `agents/product/` | Cross-domain review, new services, backlog prioritization | Weekly |
| **Growth** | `agents/growth/` | Founder/investor signup schemas & copy A/B tests | Weekly |
| **Pipeline** | scripts (no LLM) | Data health, enrichment, match quality metrics | Weekly runbook |

The **Product Agent** reads pipeline + growth metrics, maintains `opportunity-registry.json`, and proposes **one** shippable improvement per run (feature, service, or experiment). The **Growth Agent** executes narrow funnel experiments delegated from product or the registry.

## Human-in-the-loop

```
Metrics → Agent proposes → You approve → Agent or you implement → Deploy → Measure
```

Agents **never** auto-deploy. Draft opportunities and experiment variants stay `"status": "draft"` until you promote them.

## Commands

```bash
npm run product:metrics      # unified snapshot (pipeline + growth + backlog)
npm run product:agent        # full product review loop
npm run product:agent:plan   # plan-only, no edits

npm run growth:metrics
npm run growth:agent

npm run pipeline:weekly-dashboard
npm run pipeline:weekly-runbook
```

## Reports

All JSON reports land in `reports/`:

- `product-metrics-YYYY-MM-DD.json`
- `product-agent-run-YYYY-MM-DD.json`
- `growth-metrics-YYYY-MM-DD.json`
- `pipeline-weekly-YYYY-MM-DD.json`

## Adding a new domain agent

1. Create `agents/<domain>/CLAUDE.md` with goals, constraints, and run steps.
2. Add a metrics snapshot script if the domain has measurable KPIs.
3. Register the domain in `agents/product/domains.json`.
4. Wire a npm script + optional GitHub workflow schedule.
