# Match Preview Marketing Service

**Committed:** Feb 21, 2026 — `75cfa442 feat: public shareable match preview page`

This document describes the **Public Shareable Match Preview** system — the outbound marketing surface for Pythh that enables viral social media distribution of startup match results.

---

## What This Is

A public, no-auth landing page at `/matches/preview/:startupId` that shows a startup's GOD Score and their top investor matches. The page is designed to be linked from X (Twitter) and LinkedIn posts, either by the Pythh team or by the founders themselves.

**Core value loop:**
1. Pythh team identifies a top GOD-score startup
2. Team manually posts on X/LinkedIn with the preview URL
3. Founders and investors click → see the startup's match profile
4. Non-signed-up founders see their matches are real → click CTA → sign up
5. Attribution tracked via `ref=preview` query param

---

## Files

| File | Purpose |
|------|---------|
| `server/routes/previewRoute.js` | REST API — `GET /api/preview/:startupId` |
| `src/pages/MatchPreviewPage.tsx` | React landing page — `/matches/preview/:startupId` |
| `server/index.js` | Route registration (lines 5264–5266) |
| `src/App.tsx` | Frontend route registration (line 250) |

---

## URL Format

```
https://pythh.ai/matches/preview/{startupId}
```

`startupId` must be a valid UUID matching a record in `startup_uploads` with `status = 'approved'`. Unapproved or invalid startups return 404.

**To generate a preview link for any startup:** Get the startup's UUID from the `startup_uploads` table in Supabase, then append it to the base URL above.

---

## API Endpoint

```
GET /api/preview/:startupId
```

**No authentication required.** Publicly accessible.

**Security gate:** Only serves startups where `status = 'approved'` in `startup_uploads`. Returns 404 for pending, rejected, or nonexistent startups.

**Data fetched:**
- Startup from `startup_uploads` (name, tagline, website, `total_god_score`, all 5 component scores)
- Top 10 matches from `startup_investor_matches` ordered by `match_score DESC`
- Full investor details via FK join on `investors` table (name, firm, title, sectors, stage, check sizes, tier, Twitter/LinkedIn URLs, photo)
- Percentile rank: `total_god_score` compared against all approved startups

**Response shape:**
```json
{
  "startup": {
    "id": "uuid",
    "name": "Startup Name",
    "tagline": "We are building X",
    "website": "https://...",
    "god_score": 78,
    "score_components": {
      "team": 82,
      "traction": 75,
      "market": 71,
      "product": 80,
      "vision": 68
    },
    "percentile": 8
  },
  "total_matches": 247,
  "matches": [
    {
      "match_score": 91,
      "why_you_match": "Strong alignment on B2B SaaS Series A...",
      "investor": {
        "name": "Jane Smith",
        "firm": "Acme Ventures",
        "title": "Partner",
        "sectors": ["SaaS", "Enterprise"],
        "stage": "Series A",
        "check_size_min": 500000,
        "check_size_max": 2000000,
        "investor_tier": 1,
        "twitter_url": "https://twitter.com/...",
        "linkedin_url": "https://linkedin.com/in/...",
        "photo_url": "https://..."
      }
    }
  ]
}
```

**Registration in `server/index.js`:**
```js
const previewRoute = require('./routes/previewRoute');
app.use('/api/preview', previewRoute);
```

---

## Frontend Page

**Route:** `/matches/preview/:startupId`  
**File:** `src/pages/MatchPreviewPage.tsx` (473 lines)  
**Lazy-loaded** in `src/App.tsx`.

### Page Structure

1. **Sticky navbar** — Pythh logo + "Claim your matches" CTA button → `/signup?ref=preview&startup={id}`

2. **Hero section** — Startup name (large), tagline, website pill with live green pulse indicator

3. **GOD Score stat row** — 3 columns inline:
   - GOD Score: large number `/100`
   - Percentile: `Top X%` in amber
   - Total matches: `{N} investors matched`

4. **Score breakdown bars** — Team, Traction, Market, Product, Vision
   - Color coding: emerald (≥70), cyan (≥55), amber (≥40), zinc/gray (<40)

5. **Visible investor cards (matches 1–5)** — Full detail:
   - Photo/initials avatar
   - Firm + investor name + title
   - Match percentage bar (color-coded)
   - Sector tags
   - Check size badge
   - Tier 1/Tier 2 badge
   - `why_you_match` snippet (the AI explanation of why this match was made)

6. **Blurred investor cards (matches 6–10)** — Same layout but:
   - CSS: `blur-sm select-none pointer-events-none`
   - Gradient overlay + "Unlock all {N} matches" CTA in the center
   - Drives signups

7. **Share section** — Three buttons:
   - **X (Twitter):** Opens `twitter.com/intent/tweet` with pre-filled text
   - **LinkedIn:** Opens `linkedin.com/sharing/share-offsite/?url={previewUrl}`
   - **Copy Link:** Copies preview URL to clipboard

8. **Bottom CTA card** — Honey jar 🍯 emoji, pitch copy, green "Claim your free profile →" button → `/signup?ref=preview&startup={id}`

---

## Social Sharing

### X (Twitter) Share Text

```
🔥 @{StartupName} just got matched with {N} investors on @pythhai

Pythh GOD Score: {score}/100 (top {X}%)

See their top investor matches 👇
https://pythh.ai/matches/preview/{startupId}

#startups #venturecapital #fundraising
```

Opened via: `https://twitter.com/intent/tweet?text={encodedText}`

### LinkedIn Share

```
https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fpythh.ai%2Fmatches%2Fpreview%2F{startupId}
```

---

## Attribution Tracking

All CTA links include `?ref=preview&startup={startupId}` so signups from this surface can be tracked in analytics. Example:

```
/signup?ref=preview&startup=a1b2c3d4-e5f6-...
```

---

## How to Operate (Manual Posting Workflow)

1. Go to Supabase → `startup_uploads` table
2. Filter by `status = 'approved'`, sort by `total_god_score DESC`
3. Pick a high-scoring startup (GOD Score ≥ 70 recommended)
4. Copy its `id` (UUID)
5. Construct: `https://pythh.ai/matches/preview/{uuid}`
6. Visit the URL to validate it loads correctly
7. Click the **X share button** on the page — it pre-populates the tweet with `@{startupName}` and `@pythhai`
8. Post. Or copy the URL and craft a custom post.

---

## What Is NOT Built (Intentional Non-Scope)

The following were considered but deliberately not built to avoid scope creep:

| Feature | Status | Notes |
|---------|--------|-------|
| Automated X/LinkedIn posting bot | ❌ Not built | Would require X/LinkedIn API credentials; manual-first approach chosen |
| Email to founders with their preview link | ❌ Not built | Could be triggered on `status` changing to `approved`; email infra (Resend) already in place |
| Admin queue for scheduling social posts | ❌ Not built | Manual workflow sufficient at current scale |
| Analytics dashboard for preview page views | ❌ Not built | `ref=preview` attribution exists; full analytics tracking not wired |

---

## Potential Future Automation

When ready to automate (do NOT build prematurely — read this doc first to avoid duplication):

1. **Founder notification email**: Trigger on `startup_uploads.status` changing to `'approved'` → send email via Resend with preview URL and share instructions. Email infra is already configured (`server/services/emailService.ts`).

2. **Automated social posting**: Would need X API v2 OAuth + LinkedIn Marketing API. Store credentials in `.env` as `X_API_KEY`, `X_API_SECRET`, `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`. Build as a new PM2 job: `server/jobs/socialPostScheduler.js`.

3. **Webhook on high-score match**: When a startup crosses a GOD Score threshold (e.g. 75+), auto-trigger a social post draft for admin review.

---

## Database Tables Used

| Table | Usage |
|-------|-------|
| `startup_uploads` | Startup data, `status` gate, GOD score fields |
| `startup_investor_matches` | Match scores + `why_you_match` explanations |
| `investors` | FK join for investor profile details |

---

## Related Documentation

- [SYSTEM_GUARDIAN.md](SYSTEM_GUARDIAN.md) — Health monitoring for database and match quality
- [copilot-instructions.md](.github/copilot-instructions.md) — GOD Algorithm overview and data flow
- `src/services/matchingService.ts` — How matches are generated
- `server/services/startupScoringService.ts` — How GOD scores are calculated
