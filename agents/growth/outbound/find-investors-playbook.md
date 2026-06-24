# Find Investors — Outbound & Community Playbook

**Goal:** Drive first-time founders (no warm network) to `https://pythh.ai/find-investors` → URL preview → signup.

**North star:** 100 signups/day. This playbook targets the acquisition gap (`signups/day < 1`).

**Tracking:** Append UTM params so funnel snapshot can attribute traffic:
- `?utm_source=<channel>&utm_medium=community&utm_campaign=find_investors`

Example link:
```
https://pythh.ai/find-investors?utm_source=reddit&utm_medium=community&utm_campaign=find_investors
```

---

## Core message (all channels)

**One-liner:** Paste your startup URL — see which investors actually fit your stage and sector in ~30 seconds. No signup required for preview.

**Proof points:**
- Matches ranked by thesis fit + live signals (fundraising, hiring, GTM)
- Built for founders without a warm intro network
- Free preview; signup only to unlock intros

**CTA:** `https://pythh.ai/find-investors`

---

## Reddit

### r/startups — value post (recommended)

**Title:** I built a free tool that shows which VCs match your startup URL (no network required)

**Body:**
```
Raising without warm intros is brutal — most founder tools assume you already know who to talk to.

I built Pythh to flip that: paste your startup URL and it returns investor matches ranked by thesis fit + timing signals (who's actively deploying in your sector/stage).

Preview is free (3 matches visible). Signup unlocks full list + intro workflow.

Try it: https://pythh.ai/find-investors?utm_source=reddit_startups&utm_medium=community&utm_campaign=find_investors

Happy to answer questions on how matching works. Not trying to spam — genuinely looking for feedback from founders in the 0→1 raise.
```

**Comment reply template (when asked "how does it work?"):**
```
It scrapes/public signals from your site + sector tags, runs them against our investor graph (thesis, stage, check size, recent activity), and ranks by fit score + urgency. Preview shows top 3 without an account. Full list needs a free founder signup.
```

### r/Entrepreneur — shorter post

**Title:** Free investor match preview from your startup URL

**Body:**
```
If you're raising and don't have a VC network yet — paste your URL here and see who fits in ~30 sec:

https://pythh.ai/find-investors?utm_source=reddit_entrepreneur&utm_medium=community&utm_campaign=find_investors

No credit card. Preview before signup. Would love feedback from anyone actively fundraising.
```

### r/SaaS / r/indiehackers cross-post

Use the r/Entrepreneur version; swap `utm_source=reddit_saas` or `reddit_indiehackers`.

**Rules:** Read sub rules before posting. Prefer genuine founder voice; disclose you're building the product. Reply to every comment in the first 2 hours.

---

## LinkedIn

### Founder-facing post

```
Most founders waste weeks building investor lists from Crunchbase exports and Twitter threads.

We built something simpler: paste your startup URL → see investors ranked by thesis fit + live deployment signals.

Built for first-time founders without warm intros.

Free preview (no signup): https://pythh.ai/find-investors?utm_source=linkedin&utm_medium=social&utm_campaign=find_investors

If you're raising pre-seed/seed — try it and tell me what's missing.
```

### Comment on fundraising posts

```
Have you tried matching from your URL instead of a static list? Pythh gives a free preview of thesis-fit investors: https://pythh.ai/find-investors?utm_source=linkedin_comment&utm_medium=community&utm_campaign=find_investors
```

---

## X (Twitter)

### Thread opener

```
Raising without intros?

Paste your startup URL → see which investors actually fit your stage + sector.

Free preview, no signup required 🧵
```

**Tweet 2:**
```
Most tools assume you already know who to email.

Pythh ranks investors by thesis fit + timing signals (fundraising, hiring, GTM velocity).

Built for founders starting from zero network.
```

**Tweet 3 (CTA):**
```
Try it: https://pythh.ai/find-investors?utm_source=twitter&utm_medium=social&utm_campaign=find_investors

Reply with your URL — I'll tell you if the preview looks right.
```

### Single tweet

```
Paste your startup URL. See investor matches in 30 sec. Free preview → https://pythh.ai/find-investors?utm_source=twitter&utm_medium=social&utm_campaign=find_investors
```

---

## Indie Hackers

**Title:** Show IH: Investor match preview from your startup URL (no network needed)

**Body:** Use the r/startups post body; set `utm_source=indiehackers`.

Engage in "Fundraising" and "Show IH" categories weekly.

---

## Hacker News — Show HN (when ready)

**Title:** Show HN: Paste your startup URL, see thesis-matched investors (free preview)

**Body:**
```
Hi HN — I built Pythh for founders who don't have a warm VC network.

Paste your startup URL → ranked investor matches based on thesis fit + public signals (fundraising, hiring, sector momentum). Preview shows top matches without signup.

https://pythh.ai/find-investors?utm_source=hn&utm_medium=community&utm_campaign=find_investors

Stack: React/Vercel frontend, Node/Fly API, Supabase. Matching uses a GOD score + signal pipeline over ~10k startups and curated investors.

Looking for feedback on match quality and false positives. Happy to go deep on architecture in comments.
```

**Timing:** Tuesday–Thursday, 8–10am US Eastern. Have a founder account ready to demo live URLs in comments.

---

## Direct outreach (accelerators, founder Slack/Discord)

**DM template:**
```
Hey [Name] — saw you're supporting [cohort/community]. We built a free investor-match preview for founders without warm intros (paste URL → see ranked VCs).

Would this be useful for your founders? Happy to share a custom link or walk through a demo: https://pythh.ai/find-investors?utm_source=dm&utm_medium=outbound&utm_campaign=find_investors
```

**Communities to try:** On Deck alumni Slack, South Park Commons, Latitud, Founder Institute local chapters, YC cofounder matching adjacent groups (respect no-promo rules).

---

## Weekly cadence

| Day | Action |
|-----|--------|
| Mon | LinkedIn post + 5 thoughtful comments on fundraising threads |
| Tue | Reddit r/startups or r/Entrepreneur (rotate weekly) |
| Wed | X thread + reply to 10 "raising advice" posts |
| Thu | Indie Hackers engagement |
| Fri | Review `npm run conversion:funnel` — `url_submitted`, `preview_view_per_url`, `founder_signup_completed` |

---

## Success metrics (7–14 days)

| Metric | Target |
|--------|--------|
| `url_submitted` from UTM/community | +20/week |
| `preview_view_per_url` | >15% (from ~6.6%) |
| `founder_signup_completed` | +5/week |
| `preview_email_captured` | >0 |

Run after each push:
```bash
npm run conversion:funnel
npm run funnel:heartbeat
```

---

## Do not

- Spam the same post across subs in one day
- Promise guaranteed intros or funding
- Link to `/matches` without context — always lead with `/find-investors` for cold traffic
- Use investor-facing copy on founder channels (keep investor digest separate)
