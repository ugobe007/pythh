# 🔑 Setting Up Anthropic API Key

## Current Status
- **Key ID**: `apikey_01Rj2N8SVvo6BePZj99NhmiT`
- **Status**: Active
- **Partial Hint**: `sk-ant-api03-R2D...igAA`
- **Full Key**: Not retrievable (only shown once at creation)

## Solution: Create New Key

Since Anthropic keys can't be retrieved after creation, you need to create a new one:

### Step 1: Go to Anthropic Console
1. Visit: https://console.anthropic.com/settings/keys
2. Log in to your account

### Step 2: Create New Key
1. Click **"Create Key"** button
2. Give it a name (e.g., "Hot Match RSS Discovery")
3. Click **"Create Key"**
4. **IMPORTANT**: Copy the full key immediately - it starts with `sk-ant-` and looks like:
   ```
   sk-ant-api03-R2D...igAA
   ```
   (You'll see the complete value, not just the partial hint)

### Step 3: Set in Fly.io
Once you have the full key, run:
```bash
flyctl secrets set ANTHROPIC_API_KEY=sk-ant-your-full-key-here
```

### Step 4: Verify
```bash
flyctl secrets list | grep ANTHROPIC
```

---

## Alternative: Check Local .env File

If you saved the key when you created it, check your local `.env` file:
```bash
cat .env | grep ANTHROPIC
```

If it's there, you can set it in Fly.io:
```bash
flyctl secrets set ANTHROPIC_API_KEY=$(grep ANTHROPIC_API_KEY .env | cut -d '=' -f2)
```

---

## What This Key Is Used For

- **RSS Discovery**: `discover-startups-from-rss.js` uses Claude to extract startup information from news articles
- **AI Intelligence**: Helps identify startups, funding rounds, and key details from RSS feeds
- **Data Enrichment**: Fills in missing startup data using AI inference

---

## After Setting the Key

The RSS discovery script will automatically use it. You can test with:
```bash
node discover-startups-from-rss.js
```

---

**Note**: The old key (apikey_01Rj2N8SVvo6BePZj99NhmiT) can be kept active or revoked after you create and set the new one.





