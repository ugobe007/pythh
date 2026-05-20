#!/usr/bin/env node
/**
 * @pythh/connect — Pythh Connect MCP stdio proxy
 *
 * Bridges any MCP client (Claude Desktop, Cursor, etc.) running over stdio
 * to the Pythh Connect HTTP MCP server at mcp.pythh.ai, injecting your API
 * key automatically into every request.
 *
 * Usage:
 *   npx @pythh/connect --key YOUR_API_KEY
 *   PYTHH_API_KEY=YOUR_KEY npx @pythh/connect
 *
 * Get a key: https://pythh.ai/developers
 */

import { Client }                           from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport }    from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Server }                           from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport }             from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// ── CLI args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function flag(name) {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : undefined;
}

const apiKey   = flag("--key")      ?? process.env.PYTHH_API_KEY ?? "";
const endpoint = flag("--endpoint") ?? "https://mcp.pythh.ai/mcp";
const VERSION  = "1.0.0";

// ── Warn (stderr — invisible to MCP client) ───────────────────────────────────

if (!apiKey) {
  process.stderr.write(
    "\n[pythh-connect] No API key provided — running in anonymous mode.\n" +
    "  For full access: npx @pythh/connect --key YOUR_KEY\n" +
    "  Get a free key:  https://pythh.ai/developers\n\n"
  );
}

// ── Remote client → mcp.pythh.ai ─────────────────────────────────────────────

const remoteClient = new Client(
  { name: "@pythh/connect-proxy", version: VERSION },
  { capabilities: {} }
);

const authHeaders = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};

const httpTransport = new StreamableHTTPClientTransport(new URL(endpoint), {
  requestInit: { headers: authHeaders },
});

// ── Local stdio server ────────────────────────────────────────────────────────

const localServer = new Server(
  { name: "pythh-connect", version: VERSION },
  { capabilities: { tools: {} } }
);

// Forward tools/list → remote
localServer.setRequestHandler(ListToolsRequestSchema, async () => {
  return await remoteClient.listTools();
});

// Forward tools/call → remote (Bearer key is baked into httpTransport)
localServer.setRequestHandler(CallToolRequestSchema, async (req) => {
  return await remoteClient.callTool({
    name: req.params.name,
    arguments: req.params.arguments ?? {},
  });
});

// ── Connect and start ─────────────────────────────────────────────────────────

async function main() {
  try {
    await remoteClient.connect(httpTransport);
  } catch (err) {
    process.stderr.write(
      `[pythh-connect] Could not reach ${endpoint}: ${err.message}\n` +
      "  Check your internet connection or try again in a moment.\n"
    );
    process.exit(1);
  }

  const stdioTransport = new StdioServerTransport();
  await localServer.connect(stdioTransport);
}

main().catch((err) => {
  process.stderr.write(`[pythh-connect] Fatal: ${err.message}\n`);
  process.exit(1);
});
