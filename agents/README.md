# Pythh AI Agent System

Continuous optimization toward **100 signups/day** and **visitor → signup → use → pay** via specialized agents on the [Claude Agent SDK agent loop](https://code.claude.com/docs/en/agent-sdk/agent-loop).

**North star:** `agents/north-star.json`  
**Orchestrator mandate (voice + anti-passivity):** `agents/ORCHESTRATOR.md`

## Voice

Pythh agents optimize for **picky + skeptical + motivating** — like good investors and wary founders. ~40% critique/filter, ~60% actionable opportunity. **No passive cycles** (monitor-only is banned).

## Conversion chain

```
Visitor → preview (/matches?url=) → signup → use (matches, wizard) → pricing → checkout → paid
```

Agents measure and improve **each stage**. Daily metrics run automatically; LLM agents rotate to propose experiments and specs.

## Layers

| Layer | Agent | Scope | Cadence |
|-------|-------|-------|---------|
| **Research** | `agents/research/` | Market pain, pricing sensitivity, workflow friction | Autopilot Mon/Thu |
| **Growth** | `agents/growth/` | Signup schemas, hero entry, pricing copy A/B | Autopilot Tue/Fri |
| **Product** | `agents/product/` | Backlog, specs, cross-domain decisions | Autopilot Wed/Sat/Sun |
| **Pipeline** | scripts (no LLM) | Data health, enrichment, match quality | Weekly runbook |

```
Research → Product (what to build) → Growth (how to convert) → Ship → Measure → repeat
```

## Autopilot (continuous)

```bash
npm run agents:autopilot              # daily metrics + orchestrator brief + today's LLM agent
npm run agents:autopilot -- --full      # all three LLM agents
npm run agents:autopilot -- --metrics-only
npm run orchestrator:brief              # weakest funnel stage + active mandate

npm run conversion:funnel             # visitor→signup→use→pay snapshot
npm run funnel:heartbeat              # synthetic E2E probe (pythh.ai)
npm run test:wizard-e2e               # Playwright: Round → Go back to unlocks
npm run check:deploy-sha              # prod pythh-build meta vs git HEAD
```

**GitHub:** `.github/workflows/agents-autopilot-daily.yml` runs at 11:00 UTC (requires `ANTHROPIC_API_KEY` secret).

| UTC day | LLM agent |
|---------|-----------|
| Mon, Thu | Research |
| Tue, Fri | Growth |
| Wed, Sat, Sun | Product |

## Human-in-the-loop

```
Metrics → Agents propose → You approve → Implement → Deploy → Measure
```

Agents **never** auto-deploy. Draft findings, opportunities, and experiment variants stay `draft` until you promote to `running`.

## Commands

```bash
npm run research:snapshot
npm run research:agent

npm run product:metrics
npm run product:agent

npm run growth:metrics
npm run growth:agent
npm run growth:sync-registry

npm run pipeline:weekly-dashboard
```

## Reports

- `reports/orchestrator-brief-*.json` — daily weakest stage + active mandate
- `reports/conversion-funnel-*.json` — full funnel + conversion rates
- `reports/funnel-heartbeat-*.json` — synthetic stage verification (+ wizard unlock UI)
- `reports/wizard-unlock-e2e-*.json` — Playwright Round→unlocks handoff
- `reports/research-snapshot-*.json` / `research-agent-*.json`
- `agents/research/briefs/*-market-brief.md`
- `reports/product-metrics-*.json` / `product-agent-run-*.json`
- `reports/growth-metrics-*.json`

## Path to 100 signups/day + paid conversion

| Phase | Signups/day | Paid focus |
|-------|-------------|------------|
| Validate | 1 | Instrument funnel; first checkout events |
| Repeatable | 10 | One winning signup + pricing experiment |
| Scale | 30 | Activation loops (intro → wizard → paywall) |
| Target | 100 | Multi-channel + retention; MRR experiments |
