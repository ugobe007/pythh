# 🔑 Required API Keys & Credentials

## ✅ Currently Set in Fly.io

These are already configured:

1. **Supabase** ✅
   - `VITE_SUPABASE_URL`: https://unkpogyhhjbvxxjvmxlt.supabase.co
   - `VITE_SUPABASE_ANON_KEY`: sb_publishable_Ii6LaEBqdDaBkPfNl_lsXg_kiUGPiD2
   - `SUPABASE_SERVICE_KEY`: sb_secret_llXRmHdvg4iWw9NNuKtNiQ_o-nuPQT_

2. **OpenAI** ✅
   - `VITE_OPENAI_API_KEY`: Set in Fly.io secrets
   - Used for: AI document scanning, startup data enrichment, news intelligence

3. **MongoDB** ✅
   - `VITE_MONGODB_URI`: Set in Fly.io secrets
   - Used for: Additional data storage (if needed)

---

## ⚠️ Potentially Needed (Check Usage)

### 1. **Anthropic API Key** (Claude)
**Status**: ⚠️ May be needed
**Used in**: `discover-startups-from-rss.js`
**Purpose**: AI-powered startup discovery from RSS feeds

**How to get:**
1. Go to https://console.anthropic.com/
2. Navigate to API Keys
3. Create new key
4. Copy the key (starts with `sk-ant-`)

**To set:**
```bash
flyctl secrets set ANTHROPIC_API_KEY=sk-ant-your-key-here
```

**Check if needed:**
- Check if `discover-startups-from-rss.js` is actively running
- If RSS discovery is working without it, may not be needed

---

### 2. **Resend API Key** (Email Notifications)
**Status**: ⚠️ Optional
**Used in**: `scripts/notifications.ts`, `server/services/emailNotifications.ts`
**Purpose**: Sending email notifications
**MCP Server**: Available via Cursor IDE MCP integration

**How to get:**
1. Go to https://resend.com/
2. Sign up / Log in
3. Navigate to API Keys
4. Create new key
5. Copy the key (starts with `re_`)

**To set:**
```bash
# For local development
echo "RESEND_API_KEY=re_your-key-here" >> .env

# For production (Fly.io)
flyctl secrets set RESEND_API_KEY=re_your-key-here
```

**MCP Configuration:**
- See `MCP_SETUP.md` for Cursor IDE MCP server setup
- Template available in `mcp.json.template`

**Check if needed:**
- Only needed if you want email notifications
- System will work without it (notifications just won't send)

---

### 2b. **TestSprite API Key** (Testing & QA)
**Status**: ⚠️ Optional
**Used in**: Automated testing via MCP server
**Purpose**: Run automated tests, generate test reports, check code quality
**MCP Server**: Available via Cursor IDE MCP integration

**How to get:**
1. Go to https://testsprite.com/ (or check their documentation)
2. Sign up / Log in
3. Navigate to API Keys section
4. Create new API key
5. Copy the key

**To set:**
```bash
# For local development
echo "TESTSPRITE_API_KEY=your-key-here" >> .env

# For production (if needed)
flyctl secrets set TESTSPRITE_API_KEY=your-key-here
```

**MCP Configuration:**
- See `MCP_SETUP.md` for Cursor IDE MCP server setup
- Template available in `mcp.json.template`
- Run `./scripts/setup-mcp.sh` for automated setup

**Check if needed:**
- Only needed if you want to use TestSprite for automated testing
- Useful for CI/CD and quality assurance

---

### 3. **Crunchbase API Key** (Optional)
**Status**: ⚠️ Optional
**Used in**: Investor/startup data enrichment
**Purpose**: Enhanced data from Crunchbase

**How to get:**
1. Go to https://data.crunchbase.com/
2. Sign up for API access
3. Get API key

**To set:**
```bash
flyctl secrets set CRUNCHBASE_API_KEY=your-key-here
```

**Note**: System works without this - it's for enhanced data only

---

## 📋 Summary Checklist

### Required (Already Set) ✅
- [x] Supabase URL
- [x] Supabase Anon Key
- [x] Supabase Service Key
- [x] OpenAI API Key
- [x] MongoDB URI (if used)

### Optional (Check if Needed)
- [ ] Anthropic API Key (for RSS discovery AI)
- [ ] Resend API Key (for email notifications) - MCP available
- [ ] TestSprite API Key (for automated testing) - MCP available
- [ ] Crunchbase API Key (for enhanced data)

---

## 🔍 How to Check What's Actually Needed

### 1. Check Active Services
```bash
# Check what scripts are running
pm2 list

# Check automation engine logs
tail -f logs/automation.log
```

### 2. Check Error Logs
```bash
# Look for "API key" or "authentication" errors
grep -i "api.*key\|auth\|unauthorized" logs/*.log
```

### 3. Test Each Service
- **RSS Discovery**: Run `node discover-startups-from-rss.js` - if it errors about Anthropic, you need that key
- **Notifications**: Check if emails are being sent - if not and you want them, add Resend key
- **Data Enrichment**: Check if Crunchbase data is being used - if not, key not needed

---

## 🚀 Quick Setup Commands

If you want to add optional keys:

```bash
# Anthropic (for RSS AI)
flyctl secrets set ANTHROPIC_API_KEY=sk-ant-your-key-here

# Resend (for emails) - MCP available
flyctl secrets set RESEND_API_KEY=re_your-key-here

# TestSprite (for testing) - MCP available
flyctl secrets set TESTSPRITE_API_KEY=your-key-here

# Crunchbase (for enhanced data)
flyctl secrets set CRUNCHBASE_API_KEY=your-key-here
```

---

## 📝 Notes

1. **Supabase credentials are embedded in the build** - you need to rebuild locally with them
2. **OpenAI key is set** - used for AI features
3. **Anthropic key** - only needed if RSS discovery AI is active
4. **Resend key** - only needed for email notifications (MCP server available)
5. **TestSprite key** - only needed for automated testing (MCP server available)
6. **Crunchbase key** - optional enhancement, not required

**MCP Server Setup:**
- See `MCP_SETUP.md` for complete MCP configuration guide
- Run `./scripts/setup-mcp.sh` for automated setup
- MCP servers allow you to use Resend and TestSprite directly from Cursor IDE

---

**Current Status**: Core system is fully configured ✅
**Optional Enhancements**: Add keys above if you want those features





