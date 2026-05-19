import { ArrowRight, Database, Code2, Zap, Globe, Lock, RefreshCw, Terminal } from "lucide-react";

const TOOLS = [
  { name: "get_network_status", tier: "free", desc: "Live stats — total startups, investors, matches, last refresh timestamp." },
  { name: "get_rankings", tier: "free", desc: "Top-ranked startups by GOD score with sector and stage filters." },
  { name: "search_startups", tier: "free", desc: "Search 33,000+ startups by name, sector, or keyword." },
  { name: "search_investors", tier: "free", desc: "Search 6,250+ investors by name, firm, or thesis keyword." },
  { name: "get_market_signals", tier: "free", desc: "Recent funding events, thesis shifts, and sector momentum." },
  { name: "match_investors", tier: "pro", desc: "Given a startup URL, return ranked investor matches with reasoning." },
  { name: "get_startup_profile", tier: "pro", desc: "Full GOD score breakdown and signal profile for a specific startup." },
  { name: "get_investor_profile", tier: "pro", desc: "Thesis, portfolio, check size, and sector preferences for an investor." },
  { name: "score_startup_url", tier: "pro", desc: "Live-scrape and score a startup URL — returns GOD score in real time." },
];

const EXAMPLE_PROMPTS = [
  {
    role: "VC / Investor",
    prompts: [
      "Show me the top 10 AI infrastructure startups by signal score this week.",
      "Which B2B SaaS founders in the Pythh network are raising a Seed round?",
      "What sector signals are trending in climate tech right now?",
    ],
  },
  {
    role: "Founder",
    prompts: [
      "Match my startup pythh.ai with investors who fund AI tools at Seed stage.",
      "Who are the top investors backing developer tools right now?",
      "Show me investors who have recently shifted thesis toward agentic AI.",
    ],
  },
];

export default function Developers() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "oklch(0.09 0.01 264)" }}>
      {/* Top bar */}
      <div className="border-b" style={{ borderColor: "oklch(0.18 0.01 264)" }}>
        <div className="container py-4 flex items-center justify-between">
          <a href="/" className="font-display font-bold text-white tracking-tight">pythh.ai</a>
          <a href="/activate" className="text-xs font-semibold" style={{ color: "oklch(0.696 0.17 162.48)" }}>
            Try PYTHIA →
          </a>
        </div>
      </div>

      {/* Hero */}
      <div className="container py-24 max-w-3xl">
        {/* Icon + label */}
        <div className="mb-8">
          <svg width="44" height="44" viewBox="0 0 52 52" fill="none" aria-label="Pythh Connect">
            <polygon points="26,4 46,15 46,37 26,48 6,37 6,15" stroke="#a78bfa" strokeWidth="1.4" strokeLinejoin="round" />
            <line x1="26" y1="17" x2="16" y2="33" stroke="#a78bfa" strokeWidth="1" strokeLinecap="round" strokeDasharray="3 3" />
            <line x1="26" y1="17" x2="36" y2="33" stroke="#22d3ee" strokeWidth="1" strokeLinecap="round" strokeDasharray="3 3" />
            <line x1="16" y1="33" x2="36" y2="33" stroke="#22c55e" strokeWidth="1" strokeLinecap="round" strokeDasharray="3 3" />
            <circle cx="26" cy="17" r="2.5" stroke="#a78bfa" strokeWidth="1.2" />
            <circle cx="16" cy="33" r="2.5" stroke="#22d3ee" strokeWidth="1.2" />
            <circle cx="36" cy="33" r="2.5" stroke="#22c55e" strokeWidth="1.2" />
          </svg>
          <div className="flex items-baseline gap-3 mt-3">
            <span className="text-sm font-semibold tracking-wider uppercase" style={{ color: "#c4b5fd" }}>Pythh Connect</span>
            <span className="text-xs" style={{ color: "#22c55e" }}>· MCP API</span>
          </div>
        </div>

        <h1 className="font-display font-bold mb-4" style={{ fontSize: "clamp(2.2rem, 5vw, 3.8rem)", color: "oklch(0.97 0.005 264)", letterSpacing: "-0.02em", lineHeight: 1.05 }}>
          Pythh's Signal Intelligence,<br />
          <span style={{ color: "#a78bfa" }}>queryable by any AI.</span>
        </h1>
        <p className="text-base leading-relaxed mb-10" style={{ color: "oklch(0.58 0.01 264)", maxWidth: 560 }}>
          Connect Claude, Cursor, or any MCP-compatible AI assistant to Pythh's live deal network.
          Query 33,000+ scored startups and 6,250+ investors in plain English — refreshed every 24 hours.
        </p>

        {/* MCP config snippet */}
        <div className="rounded-xl overflow-hidden mb-10" style={{ border: "1px solid oklch(0.2 0.01 264)" }}>
          <div
            className="flex items-center gap-2 px-4 py-2.5"
            style={{ backgroundColor: "oklch(0.115 0.01 264)", borderBottom: "1px solid oklch(0.18 0.01 264)" }}
          >
            <Terminal size={13} style={{ color: "oklch(0.45 0.01 264)" }} />
            <span className="text-xs font-mono" style={{ color: "oklch(0.5 0.01 264)" }}>
              claude_desktop_config.json — add Pythh Connect
            </span>
          </div>
          <pre
            className="px-5 py-4 text-xs overflow-x-auto leading-relaxed"
            style={{ backgroundColor: "oklch(0.1 0.01 264)", color: "oklch(0.75 0.01 264)", fontFamily: "monospace" }}
          >{`{
  "mcpServers": {
    "pythh": {
      "type": "http",
      "url": "https://mcp.pythh.ai/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}`}</pre>
        </div>

        {/* Get key CTA */}
        <div
          className="rounded-xl p-6 mb-16"
          style={{ backgroundColor: "oklch(0.115 0.01 264)", border: "1px solid oklch(0.21 0.01 264)" }}
        >
          <h2 className="font-display font-semibold text-white mb-2">Get your free API key</h2>
          <p className="text-sm mb-5" style={{ color: "oklch(0.55 0.01 264)" }}>
            Free tier includes 5 tools, 50 calls/day. No credit card required.
            Pro and enterprise tiers available for higher volume and full tool access.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const email = (e.currentTarget.elements.namedItem("email") as HTMLInputElement).value;
              if (email) {
                window.location.href = `mailto:api@pythh.ai?subject=Pythh Connect API Key Request&body=Email: ${email}%0AUse case: `;
              }
            }}
            className="flex flex-col sm:flex-row gap-3"
          >
            <input
              name="email"
              type="email"
              placeholder="you@company.com"
              required
              className="flex-1 px-4 py-3 rounded-lg text-sm outline-none"
              style={{ backgroundColor: "oklch(0.14 0.01 264)", border: "1px solid oklch(0.24 0.01 264)", color: "oklch(0.9 0.005 264)" }}
            />
            <button
              type="submit"
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold transition-all whitespace-nowrap"
              style={{ border: "1px solid #7c3aed", color: "#a78bfa" }}
              onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "#a78bfa"; el.style.color = "#c4b5fd"; }}
              onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "#7c3aed"; el.style.color = "#a78bfa"; }}
            >
              Request API key <ArrowRight size={14} />
            </button>
          </form>
          <p className="text-xs mt-3" style={{ color: "oklch(0.38 0.01 264)" }}>
            Keys are provisioned manually — expect a response within 24 hours.
          </p>
        </div>
      </div>

      {/* Tools */}
      <div className="border-t" style={{ borderColor: "oklch(0.16 0.01 264)" }}>
        <div className="container py-20">
          <h2 className="font-display font-bold mb-2" style={{ fontSize: "clamp(1.5rem, 3vw, 2.2rem)", color: "oklch(0.97 0.005 264)" }}>
            9 tools. Live data.
          </h2>
          <p className="text-sm mb-10" style={{ color: "oklch(0.5 0.01 264)" }}>
            Free tools are available to all API keys. Pro tools require a Pro or Enterprise key.
          </p>
          <div className="space-y-2">
            {TOOLS.map((tool) => (
              <div
                key={tool.name}
                className="flex items-start gap-4 px-5 py-4 rounded-xl"
                style={{ backgroundColor: "oklch(0.115 0.01 264)", border: "1px solid oklch(0.19 0.01 264)" }}
              >
                <code
                  className="text-xs font-mono mt-0.5 flex-shrink-0"
                  style={{ color: tool.tier === "pro" ? "#22d3ee" : "#a78bfa", minWidth: 220 }}
                >
                  {tool.name}
                </code>
                <p className="text-sm flex-1" style={{ color: "oklch(0.58 0.01 264)" }}>{tool.desc}</p>
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider flex-shrink-0 mt-0.5"
                  style={{ color: tool.tier === "pro" ? "#22d3ee" : "#a78bfa" }}
                >
                  {tool.tier}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Example prompts */}
      <div className="border-t" style={{ borderColor: "oklch(0.16 0.01 264)" }}>
        <div className="container py-20">
          <h2 className="font-display font-bold mb-10" style={{ fontSize: "clamp(1.5rem, 3vw, 2.2rem)", color: "oklch(0.97 0.005 264)" }}>
            Example prompts to try
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            {EXAMPLE_PROMPTS.map((group) => (
              <div key={group.role}>
                <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: "oklch(0.45 0.01 264)" }}>
                  {group.role}
                </p>
                <div className="space-y-3">
                  {group.prompts.map((prompt) => (
                    <div
                      key={prompt}
                      className="px-4 py-3 rounded-lg text-sm"
                      style={{ backgroundColor: "oklch(0.115 0.01 264)", border: "1px solid oklch(0.19 0.01 264)", color: "oklch(0.68 0.01 264)", fontStyle: "italic" }}
                    >
                      "{prompt}"
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Features row */}
      <div className="border-t" style={{ borderColor: "oklch(0.16 0.01 264)" }}>
        <div className="container py-16">
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: RefreshCw, label: "Updated every 24h", desc: "Live scraping and scoring pipeline keeps the data fresh." },
              { icon: Lock, label: "API key auth", desc: "Bearer token authentication. Per-key rate limits and tier controls." },
              { icon: Zap, label: "Stateless HTTP", desc: "MCP over streamable HTTP — no persistent connection required." },
              { icon: Globe, label: "Any MCP client", desc: "Works with Claude, Cursor, Copilot, Cline, and any MCP-compatible AI." },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label}>
                <Icon size={18} className="mb-3" style={{ color: "#a78bfa" }} />
                <p className="text-sm font-semibold text-white mb-1">{label}</p>
                <p className="text-xs leading-relaxed" style={{ color: "oklch(0.48 0.01 264)" }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer strip */}
      <div className="border-t" style={{ borderColor: "oklch(0.16 0.01 264)", backgroundColor: "oklch(0.11 0.01 264)" }}>
        <div className="container py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs" style={{ color: "oklch(0.35 0.01 264)" }}>© 2026 Pythh Capital · Signal Intelligence</p>
          <div className="flex items-center gap-6">
            <a href="/" className="text-xs transition-colors" style={{ color: "oklch(0.4 0.01 264)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "oklch(0.65 0.01 264)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "oklch(0.4 0.01 264)")}>Home</a>
            <a href="/oracle" className="text-xs transition-colors" style={{ color: "oklch(0.4 0.01 264)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "oklch(0.65 0.01 264)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "oklch(0.4 0.01 264)")}>Oracle</a>
            <a href="/activate" className="text-xs transition-colors" style={{ color: "oklch(0.4 0.01 264)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "oklch(0.65 0.01 264)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "oklch(0.4 0.01 264)")}>Activate PYTHIA</a>
            <a href="mailto:api@pythh.ai" className="text-xs transition-colors" style={{ color: "oklch(0.4 0.01 264)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "oklch(0.65 0.01 264)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "oklch(0.4 0.01 264)")}>api@pythh.ai</a>
          </div>
        </div>
      </div>
    </div>
  );
}
