# TestSprite Testing Setup Guide

## Prerequisites

1. **TestSprite API Key** - Get from https://testsprite.com/
2. **Dev Server Running** - `npm run dev` on port 5173
3. **MCP Configuration** - TestSprite configured in `~/.cursor/mcp.json`

## Step-by-Step Setup

### 1. Get TestSprite API Key
- Sign up at https://testsprite.com/
- Get your API key from the dashboard
- Add to `~/.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "TestSprite": {
      "command": "npx @testsprite/testsprite-mcp@latest",
      "env": {
        "API_KEY": "your_actual_api_key_here"
      }
    }
  }
}
```

### 2. Start Dev Server
```bash
cd ~/Desktop/hot-honey
npm run dev
# Server should be running on http://localhost:5173
```

### 3. Run TestSprite

The correct workflow is:
1. Generate code summary (already done - saved to `testsprite_tests/tmp/code_summary.json`)
2. Generate test plan
3. Bootstrap tests (requires dev server running)
4. Execute tests

## What's the Correct Approach?

Please let me know:
- Do you have a TestSprite API key?
- Should I use a different testing approach?
- Is there a specific TestSprite command or workflow you prefer?


