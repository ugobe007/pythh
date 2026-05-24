import { useNavigate } from "react-router-dom";
import {
  ADMIN_TOOL_CATEGORIES,
  ADMIN_TOOLS,
  type AdminTool,
  type AdminToolCategory,
} from "../../config/adminToolsRegistry";

const CATEGORY_COLOR: Record<AdminToolCategory, string> = {
  scoring: "border-amber-500/40 hover:bg-amber-500/10 hover:border-amber-500/60",
  matching: "border-purple-500/40 hover:bg-purple-500/10 hover:border-purple-500/60",
  data: "border-cyan-500/40 hover:bg-cyan-500/10 hover:border-cyan-500/60",
  pipeline: "border-green-500/40 hover:bg-green-500/10 hover:border-green-500/60",
  outreach: "border-emerald-500/40 hover:bg-emerald-500/10 hover:border-emerald-500/60",
  system: "border-slate-500/40 hover:bg-slate-500/10 hover:border-slate-500/60",
};

const PRIORITY_BADGE: Record<AdminTool["priority"], string> = {
  vital: "bg-red-500/20 text-red-300 border-red-500/30",
  important: "bg-yellow-500/15 text-yellow-300 border-yellow-500/25",
  routine: "bg-slate-700/50 text-slate-400 border-slate-600/40",
};

function ToolCard({ tool, onOpen }: { tool: AdminTool; onOpen: (route: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(tool.route)}
      className={`text-left p-3 rounded-lg border bg-slate-800/40 transition-all group ${CATEGORY_COLOR[tool.category]}`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="text-sm font-semibold text-white group-hover:text-amber-200 transition-colors">
          {tool.label}
        </span>
        {tool.priority === "vital" && (
          <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${PRIORITY_BADGE[tool.priority]}`}>
            core
          </span>
        )}
      </div>
      <p className="text-xs text-slate-500 leading-snug">{tool.description}</p>
    </button>
  );
}

interface AdminToolsGridProps {
  /** Show only one category */
  category?: AdminToolCategory;
  /** Compact: hide category headers */
  compact?: boolean;
}

export default function AdminToolsGrid({ category, compact }: AdminToolsGridProps) {
  const navigate = useNavigate();

  const categories = category
    ? ADMIN_TOOL_CATEGORIES.filter((c) => c.id === category)
    : ADMIN_TOOL_CATEGORIES;

  return (
    <div className="space-y-6">
      {!compact && (
        <p className="text-xs text-slate-500">
          {ADMIN_TOOLS.length} admin tools — former console restored. Core: GOD weights, signal scores, matching engine, scrapers.
        </p>
      )}
      {categories.map(({ id, label }) => {
        const tools = ADMIN_TOOLS.filter((t) => t.category === id);
        if (!tools.length) return null;
        return (
          <section key={id}>
            {!compact && (
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">
                {label}
              </h3>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              {tools.map((tool) => (
                <ToolCard key={tool.id} tool={tool} onOpen={(route) => navigate(route)} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
