# Next Steps — Growth & Retention (2026-06-24)

Last deploy: find-investors landing, preview→Oracle bridge, 70% `matches_preview`, outbound playbook + investor digest wiring.

## Immediate (this week)

### 1. Verify production

- [ ] `/find-investors` loads and submits URL → `/matches?url=`
- [ ] Preview sticky bar → `/pricing` with `pricing_viewed` (`source=preview_sticky`)
- [ ] Preview email capture works (`RESEND_API_KEY` on Fly)
- [ ] `npm run funnel:heartbeat` → 13/13 healthy

### 2. First outbound push

Use `agents/growth/outbound/find-investors-playbook.md`:
- [ ] One Reddit post (r/startups or r/Entrepreneur)
- [ ] One LinkedIn post
- [ ] Track UTMs in `url_submitted` / page_view payloads

### 3. Investor digest dry run

```bash
npm run digest:investor:dry -- --to your@email.com
npm run digest:investor:dry -- --to signed-up
```

- [ ] Confirm matches render + links hit `pythh.ai/investors`
- [ ] Live batch when ready: `npm run digest:investor` (defaults to `--to signed-up`)

## Monitor (7–14 days)

| Signal | Current (~7d) | Target |
|--------|---------------|--------|
| `preview_view_per_url` | ~6.6% | >15% |
| `founder_signup_completed` | 2–4 | +5/week |
| `preview_email_captured` | 0 | >0 |
| `pricing_viewed` (preview_sticky) | low | measurable |
| `investor_dealflow_digest_sent` | 0 | ≥1 batch |
| `signups/day` | ~0.7 | path to 100/day |

```bash
npm run conversion:funnel
npm run growth:cycle
```

## Experiment decisions (after ~20 events/variant)

| Experiment | Action if winning |
|------------|-------------------|
| `founder_hero_entry` (70% preview) | Push to 90% |
| `founder_preview_gate_cta` | Ship winner copy site-wide |
| `pricing_oracle_cta` | Promote variant permanently |

## P0 backlog (pick next)

1. **Acquisition scale** — paid test ($500) on `/find-investors` landing
2. **Preview leak** — if `preview_view_per_url` still <10%, audit client-side redirect/race on `/matches?url=`
3. **Intro activation** — wire `match_intro_requested` on preview per-match CTAs (currently 0)
4. **Investor cron** — scheduled Mon 08:30 UTC via `batch-platform-weekly.yml` (manual: Actions → Platform Weekly Batch → investor-dealflow-digest)
5. **Email nurture** — post-preview shortlist email (complement in-app capture)

## Agent focus triggers (auto in funnel snapshot)

- URL → preview leak → outbound + matches_preview traffic
- Preview → signup gap → intro/email capture
- Investor signups without digest → run `digest:investor`
- Pricing views without checkout → Oracle CTA experiment
