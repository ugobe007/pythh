# Outbound queue — weekly thesis (2026-07-02)

**Do today.** LinkedIn auth blocked — post on **X first**. Paste LinkedIn when account unlocks.

Track UTMs: `page_view` / `url_submitted` with `utm_campaign=thesis_fit`

---

## X / Twitter (post now)

```
Pythh Weekly · AI/ML
2363 startups at GOD 70+ · 289 pre-seed/seed investors · 731 new this week

Thesis fit > cold lists.

Paste your URL → https://pythh.ai/find-investors?utm_source=x&utm_medium=social&utm_campaign=thesis_fit

— Peter
```

Post at: https://x.com/compose/post

---

## LinkedIn (when auth restored)

```
Peter · Pythh Match Desk — Weekly AI/ML snapshot

This week: 2363 startups scored 70+ in AI/ML. 289 investors actively covering pre-seed/seed.

Signal delta: 731 new names approved (+119 vs prior week).

Most founders don't need more investor names. They need to know which firms are actually deploying in their thesis — and how to frame the conversation.

Top scored: Alt-qq (100), Pluto (98), AheadComputing (97)

Paste your startup URL → ranked shortlist in ~20 seconds (free):
https://pythh.ai/find-investors?utm_source=linkedin&utm_medium=social&utm_campaign=thesis_fit

Reply if you want help framing for a specific firm.
```

---

## Peter email batch

Run (or verify cron sent):

```bash
npm run outreach:startup
```

Monitor replies at `pythia@pythh.ai` — intro concierge handles warm intros.

---

## Share proof card (1 DM)

Pick any strong match from admin, send `/matches/preview/:id` link to one founder you know with:

> "Ran your space through our matcher — here's who actually fits your thesis."

That fires human `page_view` + preview path.
