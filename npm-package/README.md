# @pythh/connect

Connect Claude, Cursor, or any MCP-compatible AI agent to Pythh's live startup scoring engine, investor database, and real-time market signals — in one command.

## Quick start

```bash
npx @pythh/connect --key YOUR_API_KEY
```

Get a free key at **[pythh.ai/developers](https://pythh.ai/developers)**.

---

## Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "pythh": {
      "command": "npx",
      "args": ["-y", "@pythh/connect", "--key", "YOUR_API_KEY"]
    }
  }
}
```

## Cursor

Add to `.cursor/mcp.json` in your project (or `~/.cursor/mcp.json` globally):

```json
{
  "mcpServers": {
    "pythh": {
      "command": "npx",
      "args": ["-y", "@pythh/connect", "--key", "YOUR_API_KEY"]
    }
  }
}
```

## Environment variable

If you prefer not to put the key in config files:

```bash
export PYTHH_API_KEY=YOUR_API_KEY
npx @pythh/connect
```

---

## What your AI can do once connected

| Query | What Pythh does |
|---|---|
| "Find AI infra startups with GOD score above 75" | Searches 33,000+ scored startups |
| "Who are the best investors for [URL]?" | Runs PYTHIA's matching engine, returns ranked VCs |
| "What's the funding momentum in fintech right now?" | Returns live sector heat from 400+ sources |
| "Score this startup URL" | Live-scrapes and scores in real time |

---

## Available tools

| Tool | Tier | Description |
|---|---|---|
| `get_network_status` | Free | Live network stats |
| `get_rankings` | Free | Top startups by GOD score |
| `search_startups` | Free | Search 33,000+ startups |
| `search_investors` | Free | Search 6,250+ investors |
| `get_market_signals` | Free | Sector momentum and funding heat |
| `match_investors` | Free | Ranked investors for a startup domain |
| `get_startup_profile` | Pro | Full GOD score breakdown |
| `get_investor_profile` | Pro | Thesis, check size, portfolio data |
| `score_startup_url` | Pro | Live-score any URL via PYTHIA |

---

## How it works

This package is a thin **stdio-to-HTTP proxy**. When your AI client sends an MCP message, `@pythh/connect` forwards it to `mcp.pythh.ai` with your API key attached — then streams the response back to your client. No data is stored locally.

**Requires Node 18+.**

---

## Links

- Docs & API keys: [pythh.ai/developers](https://pythh.ai/developers)
- Support: [api@pythh.ai](mailto:api@pythh.ai)
