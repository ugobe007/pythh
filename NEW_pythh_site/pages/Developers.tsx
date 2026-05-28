import { useState } from "react";
import { ArrowRight, Terminal, RefreshCw, Zap, Globe, Copy, Check } from "lucide-react";
import SharedNavbar from "@/components/SharedNavbar";
import SectionLabel from "@/components/design/SectionLabel";
import StartupCTA from "@/components/design/StartupCTA";
import { G, G_BORDER, G_SUBTLE, PAGE, BORDER, CARD, MUTED, DIM, TEXT, GOLD, VIOLET, VIOLET_BORDER } from "@/lib/designTokens";

// ─── Data ────────────────────────────────────────────────────────────────────

const TOOLS = [
  { name: "get_network_status",   tier: "free", desc: "Live stats — startups scored, investors qualified, active matches." },
  { name: "get_rankings",         tier: "free", desc: "Top startups by GOD score with sector and stage filters." },
  { name: "search_startups",      tier: "free", desc: "Search 33,000+ startups by name, sector, or keyword." },
  { name: "search_investors",     tier: "free", desc: "Search 6,250+ investors by name, firm, or thesis." },
  { name: "get_market_signals",   tier: "free", desc: "Recent funding events and sector momentum signals." },
  { name: "match_investors",      tier: "pro",  desc: "Ranked investor matches for a given startup URL." },
  { name: "get_startup_profile",  tier: "pro",  desc: "Full GOD score and signal breakdown for a startup." },
  { name: "get_investor_profile", tier: "pro",  desc: "Thesis, portfolio, check size, and sector prefs." },
  { name: "score_startup_url",    tier: "pro",  desc: "Live-scrape and score a URL — GOD score in real time." },
];

const OUTCOMES = [
  {
    q: '"Find me SaaS startups with a GOD score above 75 in AI infrastructure"',
    a: "Returns a ranked list from 33,000+ scored startups — with sector, stage, team signals, and traction data — in seconds.",
  },
  {
    q: '"Who are the top investors for this startup? [URL]"',
    a: "Submits to PYTHIA's matching engine. Returns ranked VCs with thesis fit, check-size compatibility, timing signals, and outreach angles.",
  },
  {
    q: '"What\'s the funding momentum in fintech right now?"',
    a: "Calls get_market_signals. Returns live funding velocity, sector heat, and behavioral trend data — updated daily from 400+ sources.",
  },
  {
    q: '"Score this startup URL and tell me if it\'s investor-ready"',
    a: "Live-scrapes and scores the URL in real time. Returns a full GOD score breakdown across 5 dimensions with specific improvement signals.",
  },
];

type SetupTab = "cli" | "desktop" | "cursor";

const SETUP: Record<SetupTab, { label: string; filename?: string; code: string; note?: string }> = {
  cli: {
    label: "npx (recommended)",
    code: `npx @pythh/connect --key YOUR_API_KEY`,
    note: "Requires Node 18+  ·  Key injected automatically  ·  Works with any MCP client",
  },
  desktop: {
    label: "Claude Desktop",
    filename: "~/Library/Application Support/Claude/claude_desktop_config.json",
    code: `{
  "mcpServers": {
    "pythh": {
      "command": "npx",
      "args": ["-y", "@pythh/connect", "--key", "YOUR_API_KEY"]
    }
  }
}`,
    note: "Restart Claude Desktop after saving  ·  Pythh will appear in your tools list",
  },
  cursor: {
    label: "Cursor",
    filename: "~/.cursor/mcp.json",
    code: `{
  "mcpServers": {
    "pythh": {
      "command": "npx",
      "args": ["-y", "@pythh/connect", "--key", "YOUR_API_KEY"]
    }
  }
}`,
    note: "Reload Cursor window after saving  ·  Use Cmd+Shift+P → \"MCP: List Servers\" to verify",
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handleCopy}
      className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all"
      style={{
        color: copied ? "#22c55e" : "oklch(0.45 0.01 264)",
        border: `1px solid ${copied ? "#22c55e40" : "oklch(0.2 0.01 264)"}`,
        backgroundColor: "oklch(0.1 0.01 264)",
        opacity: 1,
      }}
      title="Copy to clipboard"
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

/** Very lightweight JSON syntax tinting — no external dep */
function SyntaxJson({ code }: { code: string }) {
  const tokens: { text: string; color: string }[] = [];
  const lines = code.split("\n");

  lines.forEach((line, li) => {
    const keyMatch = line.match(/^(\s*)("[\w-]+")(\s*:\s*)(.*)$/);
    if (keyMatch) {
      const [, indent, key, colon, value] = keyMatch;
      tokens.push({ text: indent, color: "inherit" });
      tokens.push({ text: key, color: "#a78bfa" });
      tokens.push({ text: colon, color: "oklch(0.55 0.01 264)" });
      tokens.push({ text: value, color: "#22d3ee" });
    } else {
      tokens.push({ text: line, color: "oklch(0.55 0.01 264)" });
    }
    if (li < lines.length - 1) tokens.push({ text: "\n", color: "inherit" });
  });

  return (
    <>
      {tokens.map((tok, i) => (
        <span key={i} style={{ color: tok.color }}>{tok.text}</span>
      ))}
    </>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Developers() {
  const [tab, setTab] = useState<SetupTab>("cli");

  return (
    <div className="min-h-screen" style={{ backgroundColor: PAGE }}>
      <SharedNavbar activePath="/developers" />

      <div className="container pt-28 pb-24" style={{ maxWidth: "1200px" }}>

        <div className="mb-14">
          <SectionLabel className="mb-3" color={VIOLET}>Pythh Connect · MCP API</SectionLabel>
          <h1
            className="font-display font-bold leading-tight mb-4"
            style={{ fontSize: "clamp(2rem, 4.5vw, 3rem)", color: TEXT, letterSpacing: "-0.02em" }}
          >
            Connect your AI agent<br />to live deal intelligence.
          </h1>
          <p className="text-base leading-relaxed" style={{ color: MUTED, maxWidth: 580 }}>
            Point Claude, Cursor, or any MCP-compatible AI at Pythh's live scoring engine, investor database, and
            real-time market signals. Query 33,000+ startups and 6,250+ investors in plain English — no SQL, no API spec.
          </p>
        </div>

        {/* ── Two-panel main layout ── */}
        <div className="grid lg:grid-cols-2 gap-14 xl:gap-20">

          {/* ─── LEFT: Value + CTA ─── */}
          <div>
            {/* What your AI can do */}
            <div className="mb-10">
              <SectionLabel className="mb-5">When you connect, your AI can</SectionLabel>
              <div className="space-y-3">
                {OUTCOMES.map(({ q, a }) => (
                  <div
                    key={q}
                    className="p-4 border"
                    style={{ backgroundColor: CARD, borderColor: BORDER }}
                  >
                    <p className="text-xs font-mono mb-2" style={{ color: VIOLET }}>{q}</p>
                    <p className="text-sm leading-relaxed" style={{ color: MUTED }}>{a}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-5 border mb-10" style={{ backgroundColor: CARD, borderColor: BORDER }}>
              <p className="text-sm font-semibold text-white mb-1">Get your API key</p>
              <p className="text-xs mb-4" style={{ color: "oklch(0.45 0.01 264)" }}>
                Free tier · 5 tools · 50 calls/day · No credit card required. Keys delivered within 24 hours.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const email = (e.currentTarget.elements.namedItem("email") as HTMLInputElement).value;
                  if (email) window.location.href = `mailto:api@pythh.ai?subject=API Key Request&body=Email: ${email}`;
                }}
                className="flex flex-col sm:flex-row gap-3"
              >
                <input
                  name="email"
                  type="email"
                  placeholder="you@company.com"
                  required
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm outline-none"
                  style={{ backgroundColor: "oklch(0.1 0.01 264)", border: "1px solid oklch(0.22 0.01 264)", color: "oklch(0.88 0.005 264)" }}
                />
                <button
                  type="submit"
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all"
                  style={{ border: "1px solid #7c3aed", color: "#a78bfa" }}
                  onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "#a78bfa"; el.style.color = "#c4b5fd"; }}
                  onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "#7c3aed"; el.style.color = "#a78bfa"; }}
                >
                  Connect AI agent <ArrowRight size={14} />
                </button>
              </form>
            </div>

            {/* Four pillars */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: RefreshCw, label: "Updated every 24h",     desc: "Continuous scraping keeps startup and investor data fresh. You're never querying a stale dataset." },
                { icon: Zap,       label: "Stateless HTTP",         desc: "No persistent connection. Bearer token auth. Works behind any firewall or proxy." },
                { icon: Globe,     label: "Any MCP client",         desc: "Claude, Cursor, ChatGPT, Copilot — any AI that supports the open MCP protocol." },
                { icon: Terminal,  label: "Plain English queries",   desc: "No SQL. No API spec. Ask naturally. Pythh returns structured, ranked results." },
              ].map(({ icon: Icon, label, desc }) => (
                <div
                  key={label}
                  className="p-4 rounded-xl"
                  style={{ backgroundColor: "oklch(0.115 0.01 264)", border: "1px solid oklch(0.19 0.01 264)" }}
                >
                  <Icon size={15} className="mb-2.5" style={{ color: "#a78bfa" }} />
                  <p className="text-sm font-semibold text-white mb-1">{label}</p>
                  <p className="text-xs leading-relaxed" style={{ color: "oklch(0.46 0.01 264)" }}>{desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ─── RIGHT: Setup + Tool catalog ─── */}
          <div className="lg:sticky lg:top-24 lg:self-start">

            {/* ── Setup block ── */}
            <div className="mb-8">
              <p className="text-xs font-mono tracking-widest uppercase mb-4" style={{ color: "oklch(0.42 0.01 264)" }}>
                Connect in 30 seconds
              </p>

              {/* Terminal window */}
              <div className="rounded-xl overflow-hidden" style={{ border: "2px solid oklch(0.22 0.01 264)", backgroundColor: "oklch(0.08 0.01 264)" }}>

                {/* Window chrome — tab bar */}
                <div className="flex items-center gap-0 px-4 border-b" style={{ borderColor: "oklch(0.17 0.01 264)", backgroundColor: "oklch(0.105 0.01 264)" }}>
                  {/* Traffic lights */}
                  <div className="flex items-center gap-1.5 pr-4 py-3 border-r flex-shrink-0" style={{ borderColor: "oklch(0.17 0.01 264)" }}>
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#ff5f57" }} />
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#febc2e" }} />
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#28c840" }} />
                  </div>
                  {/* Tabs */}
                  <div className="flex items-stretch gap-0 flex-1">
                    {(Object.keys(SETUP) as SetupTab[]).map((key) => (
                      <button
                        key={key}
                        onClick={() => setTab(key)}
                        className="px-4 py-3 text-xs font-mono font-medium transition-all border-r"
                        style={{
                          color: tab === key ? "#c4b5fd" : "oklch(0.4 0.01 264)",
                          backgroundColor: tab === key ? "oklch(0.08 0.01 264)" : "transparent",
                          borderColor: "oklch(0.17 0.01 264)",
                          borderBottom: tab === key ? "2px solid #a78bfa" : "2px solid transparent",
                          marginBottom: "-1px",
                        }}
                      >
                        {SETUP[key].label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* File path bar */}
                {SETUP[tab].filename && (
                  <div className="flex items-center gap-2 px-4 py-2 border-b" style={{ backgroundColor: "oklch(0.09 0.01 264)", borderColor: "oklch(0.14 0.01 264)" }}>
                    <Terminal size={11} style={{ color: "oklch(0.38 0.01 264)" }} />
                    <span className="text-[11px] font-mono" style={{ color: "oklch(0.42 0.01 264)" }}>{SETUP[tab].filename}</span>
                  </div>
                )}

                {/* Code body */}
                <div className="relative group">
                  <pre
                    className="px-6 py-5 overflow-x-auto leading-relaxed"
                    style={{
                      backgroundColor: "oklch(0.08 0.01 264)",
                      color: tab === "cli" ? "#22c55e" : "oklch(0.82 0.01 264)",
                      fontFamily: "'Menlo', 'Monaco', 'Consolas', monospace",
                      fontSize: "0.875rem",
                      lineHeight: "1.7",
                    }}
                  >
                    {tab === "cli" ? (
                      <>
                        <span style={{ color: "oklch(0.5 0.01 264)", userSelect: "none" }}>$ </span>
                        <span style={{ color: "#c4b5fd" }}>npx </span>
                        <span style={{ color: "oklch(0.88 0.005 264)" }}>@pythh/connect </span>
                        <span style={{ color: "#22d3ee" }}>--key </span>
                        <span style={{ color: "#eab308" }}>YOUR_API_KEY</span>
                      </>
                    ) : (
                      <SyntaxJson code={SETUP[tab].code} />
                    )}
                  </pre>

                  {/* Copy button */}
                  <CopyButton text={SETUP[tab].code} />
                </div>

                {/* Note bar */}
                {SETUP[tab].note && (
                  <div className="px-5 py-2.5 border-t" style={{ borderColor: "oklch(0.14 0.01 264)", backgroundColor: "oklch(0.09 0.01 264)" }}>
                    <p className="text-[11px] font-mono" style={{ color: "oklch(0.42 0.01 264)" }}>{SETUP[tab].note}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Tool catalog */}
            <div>
              <p className="text-xs font-mono tracking-widest uppercase mb-3" style={{ color: "oklch(0.42 0.01 264)" }}>
                Available tools
              </p>
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid oklch(0.17 0.01 264)" }}>
                {TOOLS.map((tool, i) => (
                  <div
                    key={tool.name}
                    className="flex items-start gap-4 px-4 py-3"
                    style={{
                      backgroundColor: i % 2 === 0 ? "oklch(0.105 0.01 264)" : "oklch(0.095 0.01 264)",
                      borderBottom: i < TOOLS.length - 1 ? "1px solid oklch(0.14 0.01 264)" : "none",
                    }}
                  >
                    <code
                      className="text-xs font-mono mt-0.5 flex-shrink-0"
                      style={{ color: tool.tier === "pro" ? "#22d3ee" : "#a78bfa", minWidth: "10.5rem" }}
                    >
                      {tool.name}
                    </code>
                    <p className="text-xs flex-1 leading-relaxed" style={{ color: "oklch(0.52 0.01 264)" }}>
                      {tool.desc}
                    </p>
                    <span
                      className="text-[10px] font-mono font-semibold uppercase tracking-wider flex-shrink-0 mt-0.5"
                      style={{ color: tool.tier === "pro" ? "#22d3ee" : "#a78bfa" }}
                    >
                      {tool.tier}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-4 mt-3 text-[11px] font-mono" style={{ color: "oklch(0.36 0.01 264)" }}>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: "#a78bfa" }} />
                  free — 50 calls/day
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: "#22d3ee" }} />
                  pro — unlimited
                </span>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t" style={{ borderColor: "oklch(0.16 0.01 264)" }}>
        <div className="container py-7 flex items-center justify-between">
          <p className="text-xs" style={{ color: "oklch(0.32 0.01 264)" }}>© 2026 Pythh Capital</p>
          <a
            href="mailto:api@pythh.ai"
            className="text-xs transition-colors"
            style={{ color: "oklch(0.38 0.01 264)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "oklch(0.6 0.01 264)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "oklch(0.38 0.01 264)")}
          >
            api@pythh.ai
          </a>
        </div>
      </div>
    </div>
  );
}
