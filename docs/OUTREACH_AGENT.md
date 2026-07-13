# Pythh Outreach Agent

Automated email campaign system that identifies hot leads and drives sign-ups for Pythh's MCP services.

## What it does

| Mode | Recipients | Content | CTA |
|------|-----------|---------|-----|
| **vc** | VC firms with inferred emails | 10 startup matches ranked by GOD score · sector · thesis fit | Connect AI agent → pythh.ai/developers |
| **startup** | Founders with Pythh accounts | Top 5 investor matches with match reason & GOD score | See all matches → pythh.ai/activate |

Each email:
- Uses Pythh's dark-themed brand design (inline CSS, email-safe)
- Includes real match data pulled live from Supabase
- Has a dedup guard (same campaign slug = no re-send)
- Logs every send to `pythh_prospecting_log` for analytics

### Contact resolution (startups + VCs)

Same playbook on both sides:

| Address type | Examples | Greeting |
|--------------|----------|----------|
| **Intake / team** | `info@`, `team@`, `support@`, `inquiries@`, `pitch@`, `deals@` | "Hi team at {Company}," |
| **Personal** | `marc@`, `sarah.chen@`, first-name local parts | "Hi {First}," |

**Startups:** uses `submitted_email` when present (excluding scraper placeholders like `bulk@import.com`). Otherwise infers `info@{domain}` when the website has MX records.

**VCs:** uses `email_best_guess` from the email inference script (`npm run enrich:emails`) — personal partner permutations first, then intake slugs.

Only truly junk addresses are blocked (`noreply@`, test inboxes, bulk import rows).

---

## Prerequisites

1. **Apply the migration** — adds the `pythh_prospecting_log` table:

```bash
psql "$DATABASE_URL" -f supabase/migrations/20260521120000_prospecting_outreach_log.sql
```

2. **Env vars** needed:

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (bypasses RLS) |
| `RESEND_API_KEY` | Resend API key for sending emails |

3. **Investor emails** must be populated by the email inference script first:

```bash
npm run enrich:emails       # infer emails for recent investors
npm run enrich:emails:all   # infer for all investors (slow)
```

---

## Usage

### Dry run (preview, no sends)

```bash
npm run outreach:vc:dry          # VC mode — shows what would be sent
npm run outreach:startup:dry     # Startup mode — shows what would be sent
npm run outreach:all:dry         # Both modes
```

### Live run (sends real emails)

```bash
npm run outreach:vc              # Send VC emails (default limit: 20)
npm run outreach:startup         # Send startup emails (default limit: 20)

# With custom limit
node scripts/outreach-agent.js --mode vc --limit 100

# With campaign tag (prevents re-sending in same campaign)
node scripts/outreach-agent.js --mode vc --campaign vc-june-2026 --limit 50

# Send everything to a test address (safe testing)
node scripts/outreach-agent.js --mode startup --test-to you@yourmail.com --dry-run
```

### Scheduled (weekly cron)

**GitHub Actions (recommended):** `.github/workflows/outreach-peter-weekly.yml`
- **Monday 08:00 ET** — VC mode (Peter · curated startups via `outreach-agent.js`)
- **Tuesday 08:00 ET** — Founder mode (Peter · thesis-fit investors via `peter-founder-outreach.mjs` — Hunter + ZeroBounce)

Manual dispatch: Actions → *Peter Outreach Weekly* → choose mode, limit, scan depth, draft-only.

**GitHub secrets required for founder runs:** `HUNTER_API_KEY`, `ZEROBOUNCE_API_KEY` (plus existing `SUPABASE_*`, `RESEND_API_KEY`).

**Local scheduler:**

```bash
# Run founder outreach once (live send, scan 300)
npm run peter:outreach:cron

# Daemon — Tuesday 8am ET founder runs (+ Monday VC if both modes)
npm run peter:outreach:cron:daemon

# Draft queue only
OUTREACH_DRAFT_ONLY=true npm run peter:outreach:cron
```

Legacy combined scheduler (VC + founder):

```bash
# Run once (both modes, live send)
npm run outreach:cron

# Draft queue only
OUTREACH_DRAFT_ONLY=true npm run outreach:cron

# Single mode
node scripts/cron/outreach-scheduler.js --mode startup

# Daemon — Monday/Tuesday 8am ET by default
npm run outreach:cron:daemon
```

Required for live sends: `OUTREACH_USE_PYTHH_DOMAIN=true`, `RESEND_API_KEY`, `OUTREACH_FROM=pythia@pythh.ai`.

Override via env:
```bash
OUTREACH_VC_SCHEDULE="0 9 * * 1"      # Monday 9am
OUTREACH_STARTUP_SCHEDULE="0 9 * * 3"  # Wednesday 9am
OUTREACH_LIMIT=20
OUTREACH_SCAN=400                      # founder run scan depth
```

---

## Campaign slugs

The `--campaign` flag controls dedup: the same email address will only be contacted once per campaign slug. If you don't supply `--campaign`, it defaults to `{mode}-{YYYY-MM}` (e.g. `vc-2026-05`).

```bash
# June campaign — fresh dedup window
node scripts/outreach-agent.js --mode vc --campaign vc-june-2026 --limit 100
```

---

## Analytics

All sent emails are logged to `pythh_prospecting_log`:

```sql
-- How many emails sent per campaign
select campaign_slug, email_type, count(*) as sent
from pythh_prospecting_log
group by campaign_slug, email_type
order by min(sent_at) desc;

-- Bounce / open tracking (populated by Resend webhooks)
select email, email_type, sent_at, opened_at, bounced_at
from pythh_prospecting_log
where bounced_at is not null;
```

---

## Matching engine

Outreach uses the same **6-component match model** as instant submit (`lib/outreachMatch.js`):

| Component | Weight | What it measures |
|-----------|--------|------------------|
| Sector fit | up to 40 | Taxonomy-aware sector overlap |
| Stage fit | up to 20 | Startup stage vs investor stage prefs |
| Investor quality | up to 20 | Investor GOD score + tier bonus |
| Startup quality | up to 25 | Startup GOD score |
| Signal bonus | up to 10 | Market momentum from GOD-derived signal |
| Faith alignment | up to 15 | Conviction themes from investor signals |

Each email row includes a **match score** and a **human-readable reason** generated from the fit analysis — not generic sector substring matching.

---

## Email quality audit

Before campaigns, audit investor email types:

```bash
npm run outreach:audit
```

| Type | % (typical) | Greeting | Subject pattern |
|------|-------------|----------|-----------------|
| **Personal** | ~24% | `Hi {firstName},` | Signals forming in {sector} — aligned with your orbit |
| **Intake** | ~76% | `Hi team at {firm},` | Signal digest: {sector} clusters entering {firm}'s orbit |
| **Generic** | ~0% | Treat as intake | Same as intake |

---

## Copy positioning (Peter · Match Desk)

**Peter** is the outbound persona — a calm Silicon Valley insider who helps founders and investors connect the *right* way: thesis fit, messaging, and timing. He is **not** PYTHIA (the in-product scoring engine). Never use "oracle" or "AI agent" in founder outreach emails.

**Founder emails** — Peter explains why most passes are thesis misalignment, ranks thesis-fit investors, and gives framing notes per row. CTA: full shortlist on pythh.ai/activate.

**VC emails** — Peter curates startups ranked against firm thesis. CTA: browse rankings or connect MCP.

Voice lives in `lib/pythiaVoice.js` (founder + VC helpers).

---

## Preview sends (safe testing)

```bash
# Dry run — no send
node scripts/outreach-agent.js --mode vc --limit 1 --dry-run --test-to you@yourmail.com

# Live preview to your inbox (uses onboarding@resend.dev when --test-to is set)
node scripts/outreach-agent.js --mode vc --limit 1 --campaign preview-test --test-to you@yourmail.com
node scripts/outreach-agent.js --mode startup --limit 1 --campaign preview-test --test-to you@yourmail.com
```

Production sends use `pythia@pythh.ai` (requires verified domain in Resend).

---
- Dark background (`#0b0f1a`) matching pythh.ai
- Inline CSS (no external stylesheets — email-safe)
- Monospace fonts for scores and data tables
- Stroke-only CTA buttons (`border: 1px solid` — no fills)
- Mobile-friendly `max-width: 600px` container

**VC email structure:**
1. Pythh brand header + headline
2. GOD score table (10 startup rows with score, name, sector, link)
3. "How Pythh matched these" explanation box
4. MCP sign-up CTA (Connect AI agent → pythh.ai/developers)
5. Unsubscribe footer

**Startup email structure:**
1. Pythh brand header + personalized headline
2. GOD score badge for their startup
3. Match table (5 investors with match score, name, firm, match reason, SUPER badge)
4. "See all matches / Connect AI agent" CTA
5. Unsubscribe footer

---

## Sender configuration

All emails send from: **Peter at Pythh** (`Peter at Pythh <pythia@pythh.ai>` or `peter@pythh.ai` when configured).

Make sure `pythia@pythh.ai` is verified in Resend and has a valid DKIM/DMARC record on `pythh.ai`.
