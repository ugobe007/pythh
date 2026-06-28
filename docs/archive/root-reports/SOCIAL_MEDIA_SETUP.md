# Social Media Setup Guide

This guide walks through getting API credentials for every platform and wiring them into Fly.io.

---

## Overview

The daily poster runs at **9:00 AM** via PM2. It rotates content types by day:

| Day | Content Type |
|-----|-------------|
| Sunday | `weekly_stats` — past 7 days of platform activity |
| Monday | `hot_match` — top startup-investor pair |
| Tuesday | `startup_spotlight` — featured startup |
| Wednesday | `hot_match` |
| Thursday | `sector_insight` — trending sectors by deal count |
| Friday | `startup_spotlight` |
| Saturday | `vc_signal` — featured investor's thesis |

Platforms without credentials are **silently skipped** — add them incrementally.

---

## Step 1: Apply the Database Migration

Run this in your Supabase SQL editor (one-time setup):

```
Supabase Dashboard → SQL Editor → paste contents of create-social-posts-table.sql → Run
```

---

## Step 2: Twitter / X

**Cost:** Free tier allows 1,500 tweets/month (read-only token); Basic ($100/mo) for posting.

1. Go to [developer.twitter.com](https://developer.twitter.com/)
2. **Create an App** under a Project
3. Set **App Permissions** → `Read and Write`
4. Under **Keys and Tokens**, generate:
   - API Key & Secret
   - Access Token & Secret (for your account)
5. Note all four values

**Required env vars:**
```bash
TWITTER_API_KEY=your_api_key
TWITTER_API_SECRET=your_api_key_secret
TWITTER_ACCESS_TOKEN=your_access_token
TWITTER_ACCESS_TOKEN_SECRET=your_access_token_secret
```

**Install the SDK (once):**
```bash
npm install twitter-api-v2
```

---

## Step 3: LinkedIn (Company Page)

LinkedIn tokens expire every **60 days** — calendar-reminder to refresh.

1. Go to [developer.linkedin.com](https://developer.linkedin.com/) → **Create App**
2. Associate the app with your company LinkedIn page
3. Add the products: **Share on LinkedIn** and **Sign In with LinkedIn using OpenID Connect**
4. OAuth 2.0 scopes needed: `w_member_social`, `w_organization_social`
5. Generate an access token via the [LinkedIn Token Generator](https://www.linkedin.com/developers/tools/oauth/token-generator) or OAuth flow
6. Find your **Organization ID** (urn:li:organization:XXXXXXX):
   - Go to your LinkedIn Company Page URL: `linkedin.com/company/YOUR_COMPANY/`
   - The numeric ID is in the page's admin URL or via API: `GET https://api.linkedin.com/v2/organizationalEntityAcls?q=roleAssignee`

**Required env vars:**
```bash
LINKEDIN_ACCESS_TOKEN=your_60_day_access_token
LINKEDIN_ORGANIZATION_ID=123456789
```

**Token refresh reminder:** Set a calendar event for 55 days to regenerate the token, then re-run:
```bash
fly secrets set LINKEDIN_ACCESS_TOKEN=new_token
```

---

## Step 4: Threads

1. Go to [developers.facebook.com](https://developers.facebook.com/) → **Create App** → choose **Other** → **Business**
2. Add the **Threads API** product to your app
3. Under **Threads API → Permissions**, request: `threads_basic`, `threads_content_publish`
4. Generate a **long-lived access token** (valid 60 days, refreshable):
   ```
   GET https://graph.threads.net/access_token?grant_type=th_exchange_token&client_id={app-id}&client_secret={app-secret}&access_token={short-lived-token}
   ```
5. Get your Threads account ID:
   ```
   GET https://graph.threads.net/v1.0/me?access_token={token}
   ```

**Required env vars:**
```bash
THREADS_ACCESS_TOKEN=your_long_lived_token
THREADS_ACCOUNT_ID=your_threads_user_id
```

---

## Step 5: Instagram

> ⚠️ Instagram Graph API does **not** support text-only posts — it requires an image.
> The current codebase skips Instagram until image generation is wired up.
> Placeholder env vars are recognized but posting will log a warning.

When ready to enable:
1. Facebook Business Account + Instagram Business/Creator account required
2. Connect Instagram account to a Facebook Page
3. Same Meta Developer App as Threads — add **Instagram Graph API** product
4. Permissions needed: `instagram_basic`, `instagram_content_publish`
5. Get Instagram Business Account ID:
   ```
   GET https://graph.facebook.com/v18.0/me/accounts?access_token={token}
   # Then: GET https://graph.facebook.com/v18.0/{page-id}?fields=instagram_business_account&access_token={token}
   ```

**Required env vars:**
```bash
INSTAGRAM_ACCESS_TOKEN=your_page_access_token
INSTAGRAM_BUSINESS_ACCOUNT_ID=instagram_account_id
```

---

## Step 6: Set Fly Secrets

Add all credentials to your Fly app:

```bash
# Twitter/X
fly secrets set \
  TWITTER_API_KEY="..." \
  TWITTER_API_SECRET="..." \
  TWITTER_ACCESS_TOKEN="..." \
  TWITTER_ACCESS_TOKEN_SECRET="..."

# LinkedIn
fly secrets set \
  LINKEDIN_ACCESS_TOKEN="..." \
  LINKEDIN_ORGANIZATION_ID="..."

# Threads
fly secrets set \
  THREADS_ACCESS_TOKEN="..." \
  THREADS_ACCOUNT_ID="..."

# Instagram (optional — for future use)
fly secrets set \
  INSTAGRAM_ACCESS_TOKEN="..." \
  INSTAGRAM_BUSINESS_ACCOUNT_ID="..."
```

---

## Step 7: Deploy and Start the PM2 Process

```bash
# Deploy the updated code
fly deploy --remote-only

# On the Fly machine, start/reload the social-poster process
fly ssh console
pm2 reload ecosystem.config.js --only social-poster
pm2 save
```

---

## Testing

### Preview copy (no posting):
```bash
node server/social-poster.js --preview
node server/social-poster.js --preview --type=hot_match
```

### Force a live test post:
```bash
node server/social-poster.js --type=weekly_stats
```

### Via admin API (once deployed):
```bash
# Preview
curl "https://pythh.ai/api/admin/social-posts/preview?type=hot_match" \
  -H "x-admin-key: YOUR_ADMIN_SECRET"

# Trigger live post
curl -X POST "https://pythh.ai/api/admin/social-posts/trigger" \
  -H "x-admin-key: YOUR_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"type": "startup_spotlight"}'

# View post history
curl "https://pythh.ai/api/admin/social-posts" \
  -H "x-admin-key: YOUR_ADMIN_SECRET"
```

---

## Monitoring

Posts are logged to the `social_posts` Supabase table. Check for failures:

```sql
SELECT platform, status, error, created_at
FROM social_posts
ORDER BY created_at DESC
LIMIT 20;
```

PM2 logs:
```bash
pm2 logs social-poster
```
