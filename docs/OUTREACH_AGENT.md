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

```bash
# Run once (both modes)
npm run outreach:cron

# Daemon — Monday/Tuesday 8am ET by default
npm run outreach:cron:daemon
```

Default schedule:
- **Monday 08:00 ET** — VC mode
- **Tuesday 08:00 ET** — Startup mode

Override via env:
```bash
OUTREACH_VC_SCHEDULE="0 9 * * 1"      # Monday 9am
OUTREACH_STARTUP_SCHEDULE="0 9 * * 3"  # Wednesday 9am
OUTREACH_LIMIT=100
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

## Email design

Both email templates use:
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

All emails send from: `PYTHIA at Pythh <pythia@pythh.ai>`

Make sure `pythia@pythh.ai` is verified in Resend and has a valid DKIM/DMARC record on `pythh.ai`.
