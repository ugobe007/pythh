# Awareness Playbook — Jul 16, 2026

**North star:** 100 signups/day  
**Binding constraint today:** ~10 human page views/day (not conversion)  
**Human funnel (7d):** 73 page views → 48 URL submits → 27 previews → 0 signups

Raw `url_submitted` (~2,100/7d) is **97% synthetic** — ignore it for decisions.

---

## Week 1 priority stack

| P | Workstream | Target (14d) | How we know it worked |
|---|------------|--------------|------------------------|
| **P0** | LinkedIn + shareable previews | +30 human `page_view`/week | UTM `utm_source=linkedin` in funnel |
| **P0** | `/find-investors` push | +15 human `url_submitted`/week | `home_hero` + `find_investors` sources |
| **P1** | Peter email repair | Open/click tracking live; bounce <5% | `pythh_prospecting_log.opened_at` > 0 |
| **P2** | Preview→signup (after traffic) | `match_intro_requested` > 0 | Post-781b824 instrumentation |

**HALT** until traffic exists: new oracle-gap / delta / evidence-strip experiments.

---

## Channel 1 — LinkedIn (3 posts/week)

Use posts in `2026-07-16-linkedin-posts.md` (scroll-stopping hooks, not brochure copy).

**Cadence**

| Day | Post type | Asset |
|-----|-----------|-------|
| Mon | Signal Art + market read | Today's oracle image |
| Wed | Proof / scoreboard | Oracle funded picks stat |
| Fri | Challenge CTA | "Paste your URL" |

**UTM (always):**
```
https://pythh.ai/find-investors?utm_source=linkedin&utm_medium=social&utm_campaign=awareness_jul16
```

**Engagement (daily, 10 min):** Comment on 3 fundraising threads with *specific* value first, link second. Never lead with the link.

**Attach image:** Signal Art JPEG from Supabase or `public/art/YYYY-MM-DD.jpg` — visual posts outperform text-only 3–5× on LinkedIn.

---

## Channel 2 — Shareable match preview

After any human preview (demo, founder call, comment thread), send a **public share link**:

```
https://pythh.ai/matches/preview/<startup_id>?utm_source=share&utm_medium=referral&utm_campaign=preview_share
```

**How to generate:** Run preview for a startup → click **Share preview link** on the match strip (or build from `startup_id` in admin).

**Use cases:**
- Reply to "who should I pitch?" with *their* ranked shortlist link
- DM warm intros: "Here's what PYTHH sees for [Startup] — 8 thesis-fit investors"
- LinkedIn comment: "Happy to run yours — paste URL or I'll share a preview link"

**Track:** `page_view` with `source=share_preview` in funnel.

---

## Channel 3 — `/find-investors` push

**Primary CTA URL (cold traffic):**
```
https://pythh.ai/find-investors?utm_source=<channel>&utm_medium=community&utm_campaign=find_investors
```

**Do not** send cold traffic to `/matches?url=` — always lead with `/find-investors`.

**Reddit (1×/week):** r/startups value post — see `find-investors-playbook.md`  
**X (2×/week):** Short hook + link — see linkedin-posts file, X variants  
**Indie Hackers (1×/week):** Show IH cross-post

---

## Peter email — deliverability audit (Jul 16)

| Metric | 7d | All-time |
|--------|-----|----------|
| Sent | 117 | 384 |
| Delivered (Resend) | ✓ | ✓ |
| Bounced | 7 (6%) | 34 (8.9%) |
| Opens recorded | **0** | **0** |
| Clicks recorded | **0** | **0** |
| UTM conversions | 0 | 0 |

### Diagnosis

1. **Delivery works** — `pythia@pythh.ai` from verified `pythh.ai` domain; Resend shows `delivered`.
2. **Open tracking is blind** — 384 lifetime sends, 0 `opened_at` ever. Likely causes:
   - Resend dashboard webhook missing `email.opened` / `email.clicked` → `https://hot-honey.fly.dev/api/webhooks/webhook/resend`
   - Apple Mail Privacy / corporate scanners suppress pixel opens
   - **Fix:** Track **clicks** (UTM links in CTA) as primary KPI, not opens
3. **List quality** — emails go to `founder@company.com` from Hunter; 8.9% bounce suggests stale/wrong contacts
4. **No sends since Jul 14** — weekly cron may have missed Tue run; verify GitHub Actions `Peter Outreach Weekly`
5. **Zero engagement** — subject "8 investors that fit [Startup]" may land in Promotions; no proof hook in subject line

### Fixes (this week)

- [ ] **Resend dashboard:** Webhook → `https://hot-honey.fly.dev/api/webhooks/webhook/resend` — subscribe to `email.opened`, `email.clicked`, `email.bounced`, `email.complained`; set `RESEND_WEBHOOK_SECRET` on Fly
- [ ] **Subject A/B:** Test proof-led subject: `"[Name] — 3 investors actively deploying in [sector]"` vs current
- [ ] **Pause bulk founder blast** until bounce < 3%; run `--dry-run --limit=5` and manually verify recipients
- [ ] **Click-first CTA:** Every email CTA must use `utm_source=peter&utm_medium=email&utm_campaign=peter-founder-2026-07`
- [ ] **Test send:** `node scripts/peter-founder-outreach.mjs --dry-run --limit=3` then `--test-to=you@email.com`

---

## Measurement (run after every push)

```bash
npm run conversion:funnel
npm run funnel:heartbeat
npm run growth:metrics
```

**Human-only targets (7d window):**

| Metric | Now | 14d target |
|--------|-----|------------|
| `page_view` (human) | 73 | 150+ |
| `url_submitted` (human) | 48 | 80+ |
| `instant_matches_viewed` | 27 | 50+ |
| `founder_signup_completed` | 0 | 5+ |
| Peter `clicked_at` | 0 | 3+ |

---

## Do not

- Optimize on raw `url_submitted` (2,100+ synthetic)
- Ship new preview gates before human traffic doubles
- Spam the same LinkedIn post weekly — rotate hooks (art, proof, challenge)
- Promise guaranteed intros or funding
