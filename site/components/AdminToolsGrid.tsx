import { Link } from "wouter";
import { ADMIN_TOOL_CATEGORIES, ADMIN_TOOLS, type AdminToolCategory } from "@/config/adminToolsRegistry";

const CATEGORY_BORDER: Record<AdminToolCategory, string> = {
  scoring: "oklch(0.55 0.15 80 / 0.35)",
  matching: "oklch(0.65 0.15 270 / 0.35)",
  data: "oklch(0.78 0.15 200 / 0.35)",
  pipeline: "oklch(0.85 0.17 162 / 0.35)",
  outreach: "oklch(0.75 0.15 270 / 0.35)",
  system: "oklch(0.35 0.01 264 / 0.6)",
};

function ToolCard({ tool }: { tool: (typeof ADMIN_TOOLS)[number] }) {
  return (
    <Link href={tool.route}
      className="block no-underline rounded-lg border p-3 transition-colors hover:bg-white/[0.03]"
      style={{ borderColor: CATEGORY_BORDER[tool.category], background: "oklch(0.15 0.01 264)" }}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="text-sm font-semibold" style={{ color: "oklch(0.92 0.005 264)" }}>{tool.label}</span>
        {tool.vital && (
          <span className="text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 font-bold"
            style={{ color: "oklch(0.65 0.2 25)", borderColor: "oklch(0.55 0.2 25 / 0.4)", background: "oklch(0.55 0.2 25 / 0.1)" }}>
            core
          </span>
        )}
      </div>
      <p className="text-[11px] leading-snug m-0" style={{ color: "oklch(0.45 0.01 264)" }}>{tool.description}</p>
    </Link>
  );
}

export default function AdminToolsGrid({ category, compact }: { category?: AdminToolCategory; compact?: boolean }) {
  const categories = category ? ADMIN_TOOL_CATEGORIES.filter((c) => c.id === category) : ADMIN_TOOL_CATEGORIES;

  return (
    <div className="space-y-5">
      {!compact && (
        <p className="text-[11px] m-0" style={{ color: "oklch(0.4 0.01 264)" }}>
          {ADMIN_TOOLS.length} admin tools — GOD weights, signal weights, matching, scrapers.
        </p>
      )}
      {categories.map(({ id, label }) => {
        const tools = ADMIN_TOOLS.filter((t) => t.category === id).sort((a, b) => {
          if (Boolean(a.vital) !== Boolean(b.vital)) return a.vital ? -1 : 1;
          return a.label.localeCompare(b.label);
        });
        if (!tools.length) return null;
        return (
          <section key={id}>
            {!compact && (
              <h3 className="text-[10px] font-bold uppercase tracking-widest mb-2 m-0" style={{ color: "oklch(0.4 0.01 264)" }}>
                {label}
              </h3>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {tools.map((tool) => <ToolCard key={tool.id} tool={tool} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}
