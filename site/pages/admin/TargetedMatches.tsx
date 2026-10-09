import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "wouter";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  Mail,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";

const G = "oklch(0.696 0.17 162.48)";
const MUTED = "oklch(0.55 0.01 264)";
const BORDER = "oklch(0.22 0.01 264)";
const PANEL = "oklch(0.15 0.01 264)";
const TEXT = "oklch(0.97 0.005 264)";
const DANGER = "oklch(0.65 0.18 25)";

type TargetedMatch = {
  rank: number;
  investor_id: string | null;
  match_score: number;
  fit_rank: number;
  confidence_level: string | null;
  strategy: {
    why_you_match: string[];
    why_you_match_text: string;
    reasoning: string | null;
    investment_thesis: string | null;
    fit_analysis: Record<string, unknown> | null;
  };
  contact: {
    email: string | null;
    email_type: string | null;
    email_status: string | null;
    linkedin_url: string | null;
    twitter_url: string | null;
    website: string | null;
    contactable: boolean;
  };
  investor: {
    id: string | null;
    name: string | null;
    firm: string | null;
    type: string | null;
    sectors: string[];
    stage: string | string[] | null;
    check_size_min: number | null;
    check_size_max: number | null;
    investor_tier: string | null;
    total_investments: number | null;
    last_investment_date: string | null;
    photo_url: string | null;
  };
};

const fieldStyle = {
  backgroundColor: "oklch(0.1 0.01 264)",
  border: `1px solid ${BORDER}`,
  color: TEXT,
  borderRadius: 8,
  minHeight: 40,
  padding: "0 10px",
  width: "100%",
  fontSize: 13,
} as const;

function checkSizeLabel(min: number | null, max: number | null) {
  if (min == null && max == null) return null;
  const fmt = (n: number) =>
    n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M` : `$${Math.round(n / 1000)}k`;
  if (min != null && max != null) return `${fmt(min)}–${fmt(max)}`;
  if (min != null) return `${fmt(min)}+`;
  return `up to ${fmt(max!)}`;
}

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function matchesToCsv(matches: TargetedMatch[]) {
  const headers = [
    "rank",
    "firm",
    "name",
    "match_score",
    "confidence",
    "email",
    "email_type",
    "linkedin",
    "twitter",
    "website",
    "stage",
    "sectors",
    "check_size",
    "why_you_match",
    "reasoning",
    "investment_thesis",
  ];
  const lines = [headers.join(",")];
  for (const m of matches) {
    const check = checkSizeLabel(m.investor.check_size_min, m.investor.check_size_max) || "";
    lines.push(
      [
        m.rank,
        m.investor.firm || "",
        m.investor.name || "",
        m.match_score,
        m.confidence_level || "",
        m.contact.email || "",
        m.contact.email_type || "",
        m.contact.linkedin_url || "",
        m.contact.twitter_url || "",
        m.contact.website || "",
        Array.isArray(m.investor.stage) ? m.investor.stage.join("; ") : m.investor.stage || "",
        (m.investor.sectors || []).join("; "),
        check,
        m.strategy.why_you_match_text || "",
        m.strategy.reasoning || "",
        m.strategy.investment_thesis || "",
      ]
        .map((v) => csvEscape(String(v ?? "")))
        .join(","),
    );
  }
  return lines.join("\n");
}

function FitChips({ fit }: { fit: Record<string, unknown> | null }) {
  if (!fit) return null;
  const keys = [
    "sector",
    "stage",
    "investor_quality",
    "startup_quality",
    "signal",
    "faith",
  ] as const;
  const chips = keys
    .map((k) => {
      const v = fit[k];
      if (v == null || typeof v === "object") return null;
      const n = Number(v);
      return { k, v: Number.isFinite(n) ? n.toFixed(0) : String(v) };
    })
    .filter(Boolean) as { k: string; v: string }[];
  if (!chips.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
      {chips.map((c) => (
        <span
          key={c.k}
          style={{
            fontSize: 10,
            fontFamily: "ui-monospace, monospace",
            padding: "2px 8px",
            borderRadius: 999,
            border: `1px solid ${BORDER}`,
            color: MUTED,
          }}
        >
          {c.k.replace(/_/g, " ")} {c.v}
        </span>
      ))}
    </div>
  );
}

function MatchRow({ match }: { match: TargetedMatch }) {
  const [open, setOpen] = useState(match.rank <= 3);
  const check = checkSizeLabel(match.investor.check_size_min, match.investor.check_size_max);

  return (
    <div
      style={{
        border: `1px solid ${BORDER}`,
        borderRadius: 10,
        background: PANEL,
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "grid",
          gridTemplateColumns: "28px 36px 1.4fr 1fr 72px 1.2fr",
          gap: 10,
          alignItems: "center",
          padding: "12px 14px",
          background: "transparent",
          border: 0,
          color: TEXT,
          textAlign: "left",
          cursor: "pointer",
        }}
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, color: G }}>#{match.rank}</span>
        <div>
          <div style={{ fontWeight: 650, fontSize: 13 }}>{match.investor.firm || "—"}</div>
          <div style={{ fontSize: 11, color: MUTED }}>{match.investor.name || "—"}</div>
        </div>
        <div style={{ fontSize: 11, color: MUTED }}>
          {match.contact.email ? (
            <span style={{ color: TEXT }}>{match.contact.email}</span>
          ) : (
            <span style={{ color: DANGER }}>no email</span>
          )}
          {match.contact.email_type ? (
            <div style={{ fontSize: 10, marginTop: 2 }}>{match.contact.email_type}</div>
          ) : null}
        </div>
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 13, color: G }}>
          {Math.round(match.match_score)}
        </div>
        <div style={{ fontSize: 11, color: MUTED }}>
          {(Array.isArray(match.investor.stage)
            ? match.investor.stage.slice(0, 2).join(", ")
            : match.investor.stage) || "—"}
          {check ? ` · ${check}` : ""}
        </div>
      </button>

      {open && (
        <div style={{ padding: "0 14px 14px", borderTop: `1px solid ${BORDER}` }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 14,
              paddingTop: 12,
            }}
          >
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: G, marginBottom: 6 }}>
                STRATEGY
              </div>
              {match.strategy.why_you_match.length ? (
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.45 }}>
                  {match.strategy.why_you_match.map((line) => (
                    <li key={line} style={{ marginBottom: 4 }}>
                      {line}
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>No why-you-match bullets.</p>
              )}
              {match.strategy.reasoning ? (
                <p style={{ fontSize: 12, color: MUTED, margin: "10px 0 0", lineHeight: 1.45 }}>
                  {match.strategy.reasoning}
                </p>
              ) : null}
              <FitChips fit={match.strategy.fit_analysis} />
            </div>

            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: G, marginBottom: 6 }}>
                CONTACT
              </div>
              <div style={{ display: "grid", gap: 6, fontSize: 12 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <Mail size={12} style={{ color: MUTED }} />
                  <span>{match.contact.email || "—"}</span>
                  {match.contact.email ? (
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(match.contact.email || "");
                        toast.success("Email copied");
                      }}
                      style={{
                        border: `1px solid ${BORDER}`,
                        background: "transparent",
                        color: G,
                        borderRadius: 6,
                        padding: "2px 8px",
                        fontSize: 10,
                        cursor: "pointer",
                      }}
                    >
                      Copy
                    </button>
                  ) : null}
                </div>
                {match.contact.linkedin_url ? (
                  <a href={match.contact.linkedin_url} target="_blank" rel="noreferrer" style={{ color: G }}>
                    LinkedIn ↗
                  </a>
                ) : (
                  <span style={{ color: MUTED }}>No LinkedIn</span>
                )}
                {match.contact.twitter_url ? (
                  <a href={match.contact.twitter_url} target="_blank" rel="noreferrer" style={{ color: G }}>
                    Twitter/X ↗
                  </a>
                ) : null}
                {match.contact.website ? (
                  <a href={match.contact.website} target="_blank" rel="noreferrer" style={{ color: MUTED }}>
                    {match.contact.website}
                  </a>
                ) : null}
              </div>
              {match.strategy.investment_thesis ? (
                <>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      color: G,
                      margin: "14px 0 6px",
                    }}
                  >
                    THESIS
                  </div>
                  <p style={{ fontSize: 12, color: MUTED, margin: 0, lineHeight: 1.45 }}>
                    {match.strategy.investment_thesis}
                  </p>
                </>
              ) : null}
              {(match.investor.sectors || []).length ? (
                <p style={{ fontSize: 11, color: MUTED, margin: "10px 0 0" }}>
                  Sectors: {match.investor.sectors.slice(0, 8).join(", ")}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TargetedMatchesPage() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const isAdmin = user?.role === "admin";
  const [url, setUrl] = useState("neon.tech");
  const [limit, setLimit] = useState(25);
  const [force, setForce] = useState(true);
  const [result, setResult] = useState<{
    startup: {
      id: string;
      name: string | null;
      website: string | null;
      total_god_score: number | null;
      sectors: string[];
      stage: string | string[] | null;
    };
    match_count: number;
    engine_error: string | null;
    matches: TargetedMatch[];
  } | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      window.location.href = getLoginUrl("/admin/targeted-matches");
    }
  }, [authLoading, isAuthenticated]);

  const run = trpc.admin.runTargetedMatch.useMutation({
    onSuccess: (data) => {
      setResult(data as typeof result);
      toast.success(`${(data as { match_count?: number }).match_count ?? 0} targeted matches ready`);
    },
    onError: (err) => toast.error(err.message || "Targeted match failed"),
  });

  const contactableCount = useMemo(
    () => result?.matches.filter((m) => m.contact.email).length ?? 0,
    [result],
  );

  const downloadCsv = () => {
    if (!result?.matches.length) return;
    const blob = new Blob([matchesToCsv(result.matches)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `targeted-matches-${result.startup.name || result.startup.id}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const copyEmails = async () => {
    const emails = (result?.matches || []).map((m) => m.contact.email).filter(Boolean) as string[];
    if (!emails.length) {
      toast.error("No emails in this result set");
      return;
    }
    await navigator.clipboard.writeText(emails.join("\n"));
    toast.success(`${emails.length} emails copied`);
  };

  return (
    <DashboardLayout>
      <Helmet>
        <title>Targeted Matches — Pythh admin</title>
      </Helmet>

      <div style={{ maxWidth: 1100 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: G, marginBottom: 8 }}>
          MATCHING
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 8px" }}>Targeted matches</h1>
        <p style={{ fontSize: 13, color: MUTED, marginTop: 0, maxWidth: 720 }}>
          Run the live matching engine for a specific startup URL. Returns up to 25 firm-deduped investors with
          full strategy (why / reasoning / thesis / fit) and contact fields including email. Admin-only — emails
          are never exposed on public APIs.
        </p>

        {authLoading && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: MUTED }}>
            <Loader2 className="animate-spin" size={16} /> Checking session…
          </div>
        )}

        {!authLoading && isAuthenticated && !isAdmin && (
          <p style={{ fontSize: 13, color: DANGER }}>Admin access required.</p>
        )}

        {isAdmin && (
          <>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run.mutate({ url: url.trim(), limit, force });
              }}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 120px auto auto",
                gap: 10,
                alignItems: "end",
                padding: 16,
                borderRadius: 12,
                background: PANEL,
                border: `1px solid ${BORDER}`,
                marginBottom: 18,
              }}
            >
              <label style={{ fontSize: 11, color: MUTED }}>
                Startup URL
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="neon.tech"
                  style={{ ...fieldStyle, marginTop: 4 }}
                  required
                />
              </label>
              <label style={{ fontSize: 11, color: MUTED }}>
                Limit (max 25)
                <input
                  type="number"
                  min={1}
                  max={25}
                  value={limit}
                  onChange={(e) => setLimit(Math.max(1, Math.min(25, Number(e.target.value) || 25)))}
                  style={{ ...fieldStyle, marginTop: 4 }}
                />
              </label>
              <label
                style={{
                  fontSize: 12,
                  color: MUTED,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  minHeight: 40,
                  marginBottom: 2,
                }}
              >
                <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
                Force rematch
              </label>
              <button
                type="submit"
                disabled={run.isPending || !url.trim()}
                style={{
                  minHeight: 40,
                  padding: "0 16px",
                  borderRadius: 8,
                  border: `1px solid ${G}`,
                  background: G,
                  color: "oklch(0.12 0.02 162)",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: run.isPending ? "wait" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  opacity: run.isPending ? 0.7 : 1,
                }}
              >
                {run.isPending ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
                {run.isPending ? "Matching…" : "Run matches"}
              </button>
            </form>

            {result && (
              <>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 12,
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 14,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>
                      {result.startup.name || result.startup.website || result.startup.id}
                    </div>
                    <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
                      {result.match_count} matches · {contactableCount} with email
                      {result.startup.total_god_score != null
                        ? ` · GOD ${Math.round(Number(result.startup.total_god_score))}`
                        : ""}
                      {result.engine_error ? ` · engine note: ${result.engine_error}` : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Link
                      href={`/matches/preview/${result.startup.id}`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 12,
                        color: G,
                        border: `1px solid ${BORDER}`,
                        borderRadius: 8,
                        padding: "8px 10px",
                        textDecoration: "none",
                      }}
                    >
                      <ExternalLink size={12} /> Preview
                    </Link>
                    <button
                      type="button"
                      onClick={() => void copyEmails()}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 12,
                        color: TEXT,
                        border: `1px solid ${BORDER}`,
                        borderRadius: 8,
                        padding: "8px 10px",
                        background: "transparent",
                        cursor: "pointer",
                      }}
                    >
                      <Copy size={12} /> Copy emails
                    </button>
                    <button
                      type="button"
                      onClick={downloadCsv}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 12,
                        color: TEXT,
                        border: `1px solid ${BORDER}`,
                        borderRadius: 8,
                        padding: "8px 10px",
                        background: "transparent",
                        cursor: "pointer",
                      }}
                    >
                      <Download size={12} /> CSV
                    </button>
                  </div>
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  {result.matches.map((m) => (
                    <MatchRow key={`${m.investor_id}-${m.rank}`} match={m} />
                  ))}
                  {!result.matches.length && (
                    <p style={{ fontSize: 13, color: DANGER }}>No matches returned for this URL.</p>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
