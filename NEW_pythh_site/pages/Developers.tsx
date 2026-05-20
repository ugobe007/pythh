import { ArrowRight, Terminal, RefreshCw, Zap, Globe } from "lucide-react";
import SharedNavbar from "@/components/SharedNavbar";

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

export default function Developers() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "oklch(0.09 0.01 264)" }}>
      <SharedNavbar activePath="/developers" />

      <div className="container pt-32 pb-24 max-w-2xl">
        {/* Brand mark */}
        <div className="mb-10">
          <svg width="40" height="40" viewBox="0 0 52 52" fill="none">
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

        <h1
          className="font-display font-bold mb-4"
          style={{ fontSize: "clamp(2rem, 5vw, 3.2rem)", color: "oklch(0.97 0.005 264)", letterSpacing: "-0.02em", lineHeight: 1.06 }}
        >
          Connect your AI to<br />Pythh's live deal network.
        </h1>
        <p className="text-base leading-relaxed mb-12" style={{ color: "oklch(0.55 0.01 264)", maxWidth: 500 }}>
          Point Claude, Cursor, or any MCP-compatible AI at Pythh.
          Query 33,000+ scored startups and 6,250+ investors in plain English.
        </p>

        {/* Config snippet */}
        <div className="rounded-xl overflow-hidden mb-4" style={{ border: "1px solid oklch(0.19 0.01 264)" }}>
          <div
            className="flex items-center gap-2 px-4 py-2.5"
            style={{ backgroundColor: "oklch(0.12 0.01 264)", borderBottom: "1px solid oklch(0.17 0.01 264)" }}
          >
            <Terminal size={12} style={{ color: "oklch(0.42 0.01 264)" }} />
            <span className="text-xs font-mono" style={{ color: "oklch(0.46 0.01 264)" }}>claude_desktop_config.json</span>
          </div>
          <pre
            className="px-5 py-5 text-xs overflow-x-auto leading-relaxed"
            style={{ backgroundColor: "oklch(0.105 0.01 264)", color: "oklch(0.72 0.01 264)", fontFamily: "monospace" }}
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

        {/* Get key */}
        <div className="mb-16">
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
              className="flex-1 px-4 py-3 rounded-lg text-sm outline-none"
              style={{ backgroundColor: "oklch(0.12 0.01 264)", border: "1px solid oklch(0.21 0.01 264)", color: "oklch(0.88 0.005 264)" }}
            />
            <button
              type="submit"
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold whitespace-nowrap transition-all"
              style={{ border: "1px solid #7c3aed", color: "#a78bfa" }}
              onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "#a78bfa"; el.style.color = "#c4b5fd"; }}
              onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "#7c3aed"; el.style.color = "#a78bfa"; }}
            >
              Connect AI agent <ArrowRight size={14} />
            </button>
          </form>
          <p className="text-xs mt-2.5" style={{ color: "oklch(0.36 0.01 264)" }}>
            Free tier · 5 tools · 50 calls/day · No credit card. Keys sent within 24 hours.
          </p>
        </div>

        {/* Tools */}
        <p className="text-xs font-semibold tracking-widest uppercase mb-5" style={{ color: "oklch(0.42 0.01 264)" }}>
          Available tools
        </p>
        <div className="space-y-px mb-16">
          {TOOLS.map((tool) => (
            <div
              key={tool.name}
              className="flex items-start gap-5 px-4 py-3.5"
              style={{ backgroundColor: "oklch(0.115 0.01 264)", borderBottom: "1px solid oklch(0.15 0.01 264)" }}
            >
              <code className="text-xs font-mono mt-0.5 flex-shrink-0 w-48" style={{ color: tool.tier === "pro" ? "#22d3ee" : "#a78bfa" }}>
                {tool.name}
              </code>
              <p className="text-xs flex-1 leading-relaxed" style={{ color: "oklch(0.55 0.01 264)" }}>{tool.desc}</p>
              <span className="text-[10px] font-semibold uppercase tracking-wider flex-shrink-0" style={{ color: tool.tier === "pro" ? "#22d3ee" : "#a78bfa" }}>
                {tool.tier}
              </span>
            </div>
          ))}
        </div>

        {/* Four pillars */}
        <div className="grid grid-cols-2 gap-6">
          {[
            { icon: RefreshCw, label: "Updated every 24h",  desc: "Continuous scraping keeps startup and investor data fresh." },
            { icon: Zap,       label: "Stateless HTTP MCP",  desc: "No persistent connection required. Bearer token auth." },
            { icon: Globe,     label: "Any MCP client",      desc: "Claude, Cursor, ChatGPT, Copilot — any compatible AI." },
            { icon: Terminal,  label: "Plain English queries", desc: "No SQL. No API spec memorization. Just ask." },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label}>
              <Icon size={16} className="mb-2.5" style={{ color: "#a78bfa" }} />
              <p className="text-sm font-semibold text-white mb-1">{label}</p>
              <p className="text-xs leading-relaxed" style={{ color: "oklch(0.46 0.01 264)" }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t" style={{ borderColor: "oklch(0.16 0.01 264)" }}>
        <div className="container py-7 flex items-center justify-between">
          <p className="text-xs" style={{ color: "oklch(0.32 0.01 264)" }}>© 2026 Pythh Capital</p>
          <a href="mailto:api@pythh.ai" className="text-xs transition-colors" style={{ color: "oklch(0.38 0.01 264)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "oklch(0.6 0.01 264)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "oklch(0.38 0.01 264)")}>
            api@pythh.ai
          </a>
        </div>
      </div>
    </div>
  );
}
