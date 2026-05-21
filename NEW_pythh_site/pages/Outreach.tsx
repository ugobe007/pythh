import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "../components/DashboardLayout";

// ── Types ─────────────────────────────────────────────────────────────────────

interface StatBlock {
  sent: number;
  opened: number;
  clicked: number;
  bounced: number;
  unsubscribed: number;
  openRate: number;
}

interface Stats {
  total: StatBlock;
  vc: StatBlock;
  startup: StatBlock;
  campaign: string;
}

interface Contact {
  id: string;
  email: string;
  email_type: "vc_leads" | "startup_matches";
  subject: string;
  sent_at: string;
  opened_at: string | null;
  clicked_at: string | null;
  bounced_at: string | null;
  unsubscribed_at: string | null;
  campaign_slug: string;
  resend_message_id: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const API = import.meta.env.VITE_API_URL || "https://hot-honey.fly.dev";

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function statusPill(c: Contact) {
  if (c.bounced_at)      return <span style={pill("#7f1d1d","#ef4444")}>Bounced</span>;
  if (c.unsubscribed_at) return <span style={pill("#1e1b4b","#818cf8")}>Unsub</span>;
  if (c.clicked_at)      return <span style={pill("#052e16","#22c55e")}>Clicked</span>;
  if (c.opened_at)       return <span style={pill("#1a2e05","#84cc16")}>Opened</span>;
  return <span style={pill("#1e293b","#64748b")}>Sent</span>;
}

function pill(bg: string, color: string): React.CSSProperties {
  return { background: bg, color, border: `1px solid ${color}`, borderRadius: 4, fontSize: 10, fontWeight: 700, padding: "2px 7px", fontFamily: "monospace", letterSpacing: "0.05em", textTransform: "uppercase" as const };
}

function StatCard({ label, value, sub, color = "#22c55e" }: { label: string; value: number | string; sub?: string; color?: string }) {
  return (
    <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: "16px 20px", flex: 1, minWidth: 120 }}>
      <div style={{ fontSize: 10, fontFamily: "monospace", color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color, fontFamily: "monospace", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Outreach() {
  const [campaigns, setCampaigns]   = useState<{ slug: string; sent_at: string }[]>([]);
  const [campaign, setCampaign]     = useState<string>("all");
  const [mode, setMode]             = useState<"all" | "vc_leads" | "startup_matches">("all");
  const [stats, setStats]           = useState<Stats | null>(null);
  const [contacts, setContacts]     = useState<Contact[]>([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(0);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  const LIMIT = 50;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const camp = campaign === "all" ? "" : `&campaign=${encodeURIComponent(campaign)}`;
      const type = mode === "all"     ? "" : `&type=${mode}`;

      const [statsRes, contactsRes] = await Promise.all([
        fetch(`${API}/api/outreach/stats?${camp}`),
        fetch(`${API}/api/outreach/contacts?${camp}${type}&page=${page}&limit=${LIMIT}`),
      ]);

      if (!statsRes.ok || !contactsRes.ok) throw new Error("API error");

      const [s, c] = await Promise.all([statsRes.json(), contactsRes.json()]);
      setStats(s);
      setContacts(c.contacts ?? []);
      setTotal(c.total ?? 0);
    } catch (e: any) {
      setError(e.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [campaign, mode, page]);

  useEffect(() => {
    fetch(`${API}/api/outreach/campaigns`)
      .then((r) => r.json())
      .then((d) => setCampaigns(d.campaigns ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const block = stats ? (mode === "vc_leads" ? stats.vc : mode === "startup_matches" ? stats.startup : stats.total) : null;

  return (
    <DashboardLayout>

      <div style={{ maxWidth: 1200, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#a78bfa", fontFamily: "monospace", marginBottom: 6 }}>PYTHIA · Outreach</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#f1f5f9", margin: "0 0 8px" }}>Outreach Dashboard</h1>
          <p style={{ color: "#64748b", fontSize: 14, margin: 0 }}>
            Track all prospecting emails — VC firm leads and startup investor matches.
            Replies land in <span style={{ color: "#94a3b8", fontFamily: "monospace" }}>ugobe07@gmail.com</span>.
          </p>

          {/* Email login link */}
          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a href="https://mail.google.com/mail/u/0/#search/from%3Apythia%40pythh.ai+OR+to%3Apythia%40pythh.ai" target="_blank" rel="noreferrer"
               style={{ fontSize: 12, color: "#a78bfa", border: "1px solid #3b1d6e", padding: "5px 12px", borderRadius: 6, textDecoration: "none" }}>
              Check pythia@pythh.ai replies →
            </a>
            <a href="https://resend.com/emails" target="_blank" rel="noreferrer"
               style={{ fontSize: 12, color: "#64748b", border: "1px solid #1e293b", padding: "5px 12px", borderRadius: 6, textDecoration: "none" }}>
              Resend send log →
            </a>
          </div>
        </div>

        {/* Campaign + mode filters */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 4, background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, padding: 4 }}>
            {(["all", "vc_leads", "startup_matches"] as const).map((m) => (
              <button key={m} onClick={() => { setMode(m); setPage(0); }}
                style={{ padding: "5px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
                  background: mode === m ? "#1e293b" : "transparent",
                  color: mode === m ? "#f1f5f9" : "#64748b" }}>
                {m === "all" ? "All" : m === "vc_leads" ? "VC Leads" : "Startup Matches"}
              </button>
            ))}
          </div>

          <select value={campaign} onChange={(e) => { setCampaign(e.target.value); setPage(0); }}
            style={{ background: "#0f172a", border: "1px solid #1e293b", color: "#94a3b8", padding: "6px 12px", borderRadius: 8, fontSize: 12 }}>
            <option value="all">All campaigns</option>
            {campaigns.map((c) => (
              <option key={c.slug} value={c.slug}>{c.slug}</option>
            ))}
          </select>

          <button onClick={load} style={{ marginLeft: "auto", padding: "6px 14px", background: "transparent", border: "1px solid #1e293b", color: "#64748b", borderRadius: 8, cursor: "pointer", fontSize: 12 }}>
            Refresh
          </button>
        </div>

        {/* Stats row */}
        {block && (
          <div style={{ display: "flex", gap: 12, marginBottom: 28, flexWrap: "wrap" }}>
            <StatCard label="Sent"         value={block.sent}      color="#a78bfa" />
            <StatCard label="Opened"       value={block.opened}    sub={`${block.openRate}% open rate`} color="#22c55e" />
            <StatCard label="Clicked"      value={block.clicked}   color="#22d3ee" />
            <StatCard label="Bounced"      value={block.bounced}   color="#ef4444" />
            <StatCard label="Unsubscribed" value={block.unsubscribed} color="#f59e0b" />
          </div>
        )}

        {/* Split stats VC vs Startup */}
        {stats && mode === "all" && (
          <div style={{ display: "flex", gap: 12, marginBottom: 28 }}>
            {[{ label: "VC Leads", data: stats.vc, color: "#a78bfa" }, { label: "Startup Matches", data: stats.startup, color: "#22c55e" }].map(({ label, data, color }) => (
              <div key={label} style={{ flex: 1, background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: "14px 18px" }}>
                <div style={{ fontSize: 10, fontFamily: "monospace", color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>{label}</div>
                <div style={{ display: "flex", gap: 20 }}>
                  {[["Sent", data.sent], ["Opened", data.opened], ["Clicked", data.clicked], ["Bounced", data.bounced]].map(([k, v]) => (
                    <div key={k as string}>
                      <div style={{ fontSize: 18, fontWeight: 700, color, fontFamily: "monospace" }}>{v}</div>
                      <div style={{ fontSize: 10, color: "#475569" }}>{k}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Contact table */}
        <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #1e293b", background: "#0d1424", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#334155", fontFamily: "monospace" }}>
              RECIPIENT · SUBJECT · STATUS · SENT
            </span>
            <span style={{ fontSize: 11, color: "#334155", fontFamily: "monospace" }}>{total} total</span>
          </div>

          {loading && (
            <div style={{ padding: 40, textAlign: "center", color: "#475569" }}>Loading…</div>
          )}
          {error && (
            <div style={{ padding: 20, color: "#ef4444", fontSize: 13 }}>Error: {error}</div>
          )}

          {!loading && contacts.length === 0 && (
            <div style={{ padding: 40, textAlign: "center" }}>
              <div style={{ color: "#334155", fontSize: 13, marginBottom: 8 }}>No emails sent yet in this campaign.</div>
              <div style={{ color: "#1e293b", fontSize: 12, fontFamily: "monospace" }}>
                Run: npm run outreach:vc -- --limit 20
              </div>
            </div>
          )}

          {!loading && contacts.map((c, i) => (
            <div key={c.id} style={{ padding: "13px 16px", borderBottom: "1px solid #0d1424", background: i % 2 === 0 ? "#0f172a" : "#0b1320", display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
              <div style={{ flex: "0 0 180px", minWidth: 140 }}>
                <div style={{ fontSize: 13, color: "#f1f5f9", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.email}</div>
                <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
                  <span style={{ border: `1px solid ${c.email_type === "vc_leads" ? "#3b1d6e" : "#14532d"}`,
                    color: c.email_type === "vc_leads" ? "#a78bfa" : "#22c55e",
                    padding: "1px 5px", borderRadius: 3, fontSize: 9, fontFamily: "monospace", fontWeight: 700 }}>
                    {c.email_type === "vc_leads" ? "VC" : "STARTUP"}
                  </span>
                  {" · "}{c.campaign_slug}
                </div>
              </div>

              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 12, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.subject}</div>
              </div>

              <div style={{ flex: "0 0 80px", textAlign: "center" }}>{statusPill(c)}</div>

              <div style={{ flex: "0 0 130px", textAlign: "right" }}>
                <div style={{ fontSize: 11, color: "#475569", fontFamily: "monospace" }}>{fmt(c.sent_at)}</div>
                {c.opened_at && <div style={{ fontSize: 10, color: "#22c55e", marginTop: 2 }}>opened {fmt(c.opened_at)}</div>}
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        {total > LIMIT && (
          <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 20 }}>
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
              style={{ padding: "6px 16px", background: "transparent", border: "1px solid #1e293b", color: "#64748b", borderRadius: 8, cursor: "pointer" }}>← Prev</button>
            <span style={{ color: "#475569", fontSize: 12, lineHeight: "30px" }}>Page {page + 1} of {Math.ceil(total / LIMIT)}</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={(page + 1) * LIMIT >= total}
              style={{ padding: "6px 16px", background: "transparent", border: "1px solid #1e293b", color: "#64748b", borderRadius: 8, cursor: "pointer" }}>Next →</button>
          </div>
        )}

        {/* Run instructions */}
        <div style={{ marginTop: 32, background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: "20px 24px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#334155", fontFamily: "monospace", marginBottom: 12 }}>RUN THE OUTREACH AGENT</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              ["VC dry run",      "npm run outreach:vc:dry"],
              ["Startup dry run", "npm run outreach:startup:dry"],
              ["Send VC (live)",  "npm run outreach:vc -- --limit 50"],
              ["Send startups",   "npm run outreach:startup -- --limit 100"],
            ].map(([label, cmd]) => (
              <div key={cmd} style={{ background: "#0b0f1a", border: "1px solid #1e293b", borderRadius: 8, padding: "10px 14px" }}>
                <div style={{ fontSize: 11, color: "#475569", marginBottom: 4 }}>{label}</div>
                <code style={{ fontSize: 12, color: "#a78bfa", fontFamily: "monospace" }}>{cmd}</code>
              </div>
            ))}
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
