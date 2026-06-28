# MCP Server Quick Start

## 🚀 Quick Setup (3 Steps)

### 1. Add API Keys to `.env`
```bash
RESEND_API_KEY=re_your_key_here
TESTSPRITE_API_KEY=your_key_here
```

### 2. Run Setup Script
```bash
./scripts/setup-mcp.sh
```

### 3. Restart Cursor IDE
Close and reopen Cursor to load MCP servers.

## ✅ What's Implemented

### Files Created
- ✅ `MCP_SETUP.md` - Complete setup guide
- ✅ `MCP_QUICK_START.md` - This file
- ✅ `mcp.json.template` - MCP config template
- ✅ `scripts/setup-mcp.sh` - Automated setup script
- ✅ Updated `REQUIRED_API_KEYS.md` - Added TestSprite info

### MCP Servers Configured
1. **Resend** - Email service (already in use)
2. **TestSprite** - Testing & QA tool

## 📖 Usage

### In Cursor IDE
Once configured, you can use MCP servers directly in Cursor:

```
@Resend send email to user@example.com
@TestSprite run tests for MatchingEngine
```

### In Code
Resend is already integrated:
```typescript
import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY);
```

## 🔗 Resources

- Full guide: `MCP_SETUP.md`
- API keys: `REQUIRED_API_KEYS.md`
- Setup script: `./scripts/setup-mcp.sh`


