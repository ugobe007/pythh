import { useState, useEffect, useCallback, useRef } from "react";
import DashboardLayout from "../components/DashboardLayout";
import { Send, RefreshCw, Mail, Eye, ExternalLink, CheckCircle, XCircle, Loader2 } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface StatBlock {
  sent: number; opened: number; clicked: number;
  bounced: number; unsubscribed: number; openRate: number;
}
interface Stats {
  total: StatBlock; vc: StatBlock; startup: StatBlock; campaign: string;
}
interface Contact {
  id: string; email: string; email_type: "vc_leads" | "startup_matches";
  subject: string; sent_at: string; opened_at: string | null;
  clicked_at: string | null; bounced_at: string | null;
  unsubscribed_at: string | null; campaign_slug: string;
  resend_message_id: string | null;
}
interface Job {
  jobId: string; status: "running" | "done" | "error";
  log: string[]; startedAt: string; finishedAt: string | null;
  exitCode: number | null; mode: string; limit: number; dryRun: boolean;
}

// ── Config ────────────────────────────────────────────────────────────────────

const API = import.meta.env.VITE_API_URL || "https://hot-honey.fly.dev";
const LIMIT_PER_PAGE = 50;

// ── Email templates (preview) ─────────────────────────────────────────────────

const VC_TEMPLATE = `Subject: 10 investment-grade [SECTOR] startups matched to [FIRM]'s thesis

Hi [NAME],

I'm PYTHIA, the AI matching engine at Pythh.ai. Our platform surfaces
founder–investor fit signals before they hit TechCrunch.

We've identified 10 startups whose trajectory, team, and market timing
align with [FIRM]'s recent portfolio thesis. Here's a sample:

  1. [Company A] — [Sector] · GOD Score 87 · Seed · Raising $2M
     "Why it matches: [reason]"
  2. [Company B] — [Sector] · GOD Score 81 · Pre-Seed · Raising $800K
     "Why it matches: [reason]"
  … (8 more)

Want the full ranked list + data room access?
→ pythh.ai/activate  |  Try our MCP for AI-native deal flow

— PYTHIA
pythia@pythh.ai  ·  Reply to this email to connect`;

const STARTUP_TEMPLATE = `Subject: Your top 5 investor matches — [COMPANY]

Hi [FOUNDER],

I'm PYTHIA, Pythh.ai's AI matching engine. Based on your startup's
signals, team, and market timing, here are your top 5 investor matches:

  1. [Investor A] — [Firm] · $2M–$10M checks · Focus: [sector]
     "Why they match: [reason]"
  2. [Investor B] — [Firm] · $500K–$2M checks · Focus: [sector]
     "Why they match: [reason]"
  … (3 more)

Get the full ranked list + intro requests:
→ pythh.ai/activate  |  Upgrade to access 6,000+ investor profiles

— PYTHIA
pythia@pythh.ai  ·  Replies go to ugobe07@gmail.com`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function pill(bg: string, color: string): React.CSSProperties {
  return { background: bg, color, border: `1px solid ${color}`, borderRadius: 4, fontSize: 10,
    fontWeight: 700, padding: "2px 7px", fontFamily: "monospace", letterSpacing: "0.05em",
    textTransform: "uppercase" as const };
}
function StatusPill({ c }: { c: Contact }) {
  if (c.bounced_at)      return <span style={pill("#7f1d1d","#ef4444")}>Bounced</span>;
  if (c.unsubscribed_at) return <span style={pill("#1e1b4b","#818cf8")}>Unsub</span>;
  if (c.clicked_at)      return <span style={pill("#052e16","#22c55e")}>Clicked</span>;
  if (c.opened_at)       return <span style={pill("#1a2e05","#84cc16")}>Opened</span>;
  return <span style={pill("#1e293b","#64748b")}>Sent</span>;
}

function StatCard({ label, value, sub, color = "#22c55e" }: { label: string; value: number | string; sub?: string; color?: string }) {
  return (
    <div style={{ background: "oklch(0.15 0.01 264)", border: "1px solid oklch(0.22 0.01 264)", borderRadius: 10, padding: "16px 20px", flex: 1, minWidth: 110 }}>
      <div style={{ fontSize: 9, fontFamily: "monospace", color: "oklch(0.4 0.01 264)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color, fontFamily: "monospace", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "oklch(0.4 0.01 264)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── Campaign Launcher ─────────────────────────────────────────────────────────

function CampaignLauncher({ onLaunched }: { onLaunched: () => void }) {
  const [mode, setMode]         = useState<"vc" | "startup">("vc");
  const [limit, setLimit]       = useState(20);
  const [dryRun, setDryRun]     = useState(true);
  const [campaign, setCampaign] = useState("");
  const [testTo, setTestTo]     = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [job, setJob]           = useState<Job | null>(null);
  const [launching, setLaunching] = useState(false);
  const pollRef                 = useRef<ReturnType<typeof setInterval> | null>(null);
  const logRef                  = useRef<HTMLDivElement>(null);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [job?.log.length]);

  // Poll job status while running
  useEffect(() => {
    if (job?.status !== "running") {
      if (pollRef.current) clearInterval(pollRef.current);
      if (job?.status === "done") onLaunched();
      return;
    }
    pollRef.current = setInterval(async () => {
      const r = await fetch(`${API}/api/outreach/run/${job.jobId}`);
      if (r.ok) { const j = await r.json(); setJob(j); }
    }, 1500);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [job?.status, job?.jobId, onLaunched]);

  async function launch() {
    setLaunching(true);
    setJob(null);
    try {
      const r = await fetch(`${API}/api/outreach/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, limit, dryRun, campaign: campaign || undefined, testTo: testTo || undefined }),
      });
      const j = await r.json();
      if (!r.ok) { alert(j.error ?? "Launch failed"); return; }
      setJob({ ...j, log: [], mode, limit, dryRun, startedAt: new Date().toISOString(), finishedAt: null, exitCode: null });
    } finally {
      setLaunching(false);
    }
  }

  const S = {
    box: { background: "oklch(0.15 0.01 264)", border: "1px solid oklch(0.22 0.01 264)", borderRadius: 10, padding: "20px 24px" },
    label: { fontSize: 10, fontWeight: 700, color: "oklch(0.4 0.01 264)", letterSpacing: "0.1em", textTransform: "uppercase" as const, display: "block", marginBottom: 6 },
    input: { padding: "7px 10px", background: "oklch(0.12 0.01 264)", border: "1px solid oklch(0.22 0.01 264)", borderRadius: 6, color: "oklch(0.9 0.005 264)", fontSize: 12, width: "100%", boxSizing: "border-box" as const },
  };

  return (
    <div style={S.box}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "oklch(0.75 0.15 270)", marginBottom: 16 }}>
        CAMPAIGN LAUNCHER
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* Mode */}
        <div>
          <label style={S.label}>Mode</label>
          <div style={{ display: "flex", gap: 6 }}>
            {(["vc", "startup"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)}
                style={{ flex: 1, padding: "7px 0", fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: "pointer",
                  border: `1px solid ${mode === m ? "oklch(0.75 0.15 270)" : "oklch(0.22 0.01 264)"}`,
                  background: mode === m ? "oklch(0.18 0.01 264)" : "transparent",
                  color: mode === m ? "oklch(0.75 0.15 270)" : "oklch(0.5 0.01 264)" }}>
                {m === "vc" ? "VC Leads" : "Startups"}
              </button>
            ))}
          </div>
        </div>

        {/* Limit */}
        <div>
          <label style={S.label}>Limit (recipients)</label>
          <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} style={{ ...S.input }}>
            {[5, 10, 20, 50, 100, 200, 500].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        {/* Campaign slug */}
        <div>
          <label style={S.label}>Campaign slug (optional)</label>
          <input type="text" placeholder={`${mode}-${new Date().toISOString().slice(0, 7)}`}
            value={campaign} onChange={(e) => setCampaign(e.target.value)} style={S.input} />
        </div>

        {/* Test to */}
        <div>
          <label style={S.label}>Test to email (optional)</label>
          <input type="email" placeholder="you@example.com"
            value={testTo} onChange={(e) => setTestTo(e.target.value)} style={S.input} />
        </div>
      </div>

      {/* Dry run toggle + buttons */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
          <div
            onClick={() => setDryRun(!dryRun)}
            style={{ width: 38, height: 20, borderRadius: 10, position: "relative", cursor: "pointer",
              background: dryRun ? "oklch(0.75 0.15 270)" : "oklch(0.65 0.2 25)",
              transition: "background 0.2s" }}>
            <div style={{ position: "absolute", top: 2, left: dryRun ? 2 : 20, width: 16, height: 16,
              borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
          </div>
          <span style={{ color: dryRun ? "oklch(0.75 0.15 270)" : "oklch(0.65 0.2 25)", fontWeight: 600, fontSize: 12 }}>
            {dryRun ? "DRY RUN — no emails sent" : "LIVE — emails will be sent"}
          </span>
        </label>

        <button onClick={() => setShowPreview(!showPreview)}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", fontSize: 12, borderRadius: 6, cursor: "pointer",
            border: "1px solid oklch(0.25 0.01 264)", background: "transparent", color: "oklch(0.55 0.01 264)" }}>
          <Eye size={13} /> {showPreview ? "Hide" : "Preview"} Template
        </button>

        <button onClick={launch} disabled={launching || job?.status === "running"}
          style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, padding: "8px 22px",
            fontSize: 13, fontWeight: 700, borderRadius: 6, cursor: "pointer",
            border: `1px solid ${dryRun ? "oklch(0.75 0.15 270)" : "oklch(0.65 0.2 25)"}`,
            background: dryRun ? "transparent" : "oklch(0.55 0.2 25)", 
            color: dryRun ? "oklch(0.75 0.15 270)" : "#fff",
            opacity: launching || job?.status === "running" ? 0.5 : 1 }}>
          {launching || job?.status === "running"
            ? <><Loader2 size={14} className="animate-spin" /> Running…</>
            : <><Send size={14} /> {dryRun ? "Run Preview" : `Send to ${limit} Recipients`}</>}
        </button>
      </div>

      {/* Template preview */}
      {showPreview && (
        <div style={{ marginTop: 16, padding: "14px 16px", background: "oklch(0.12 0.01 264)", borderRadius: 8, border: "1px solid oklch(0.2 0.01 264)" }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: "oklch(0.4 0.01 264)", marginBottom: 10 }}>
            EMAIL TEMPLATE PREVIEW — {mode === "vc" ? "VC LEADS" : "STARTUP MATCHES"}
          </div>
          <pre style={{ fontSize: 11, color: "oklch(0.65 0.01 264)", lineHeight: 1.7, margin: 0, whiteSpace: "pre-wrap", fontFamily: "monospace" }}>
            {mode === "vc" ? VC_TEMPLATE : STARTUP_TEMPLATE}
          </pre>
          <div style={{ marginTop: 10, fontSize: 10, color: "oklch(0.4 0.01 264)" }}>
            Placeholders are filled from the Supabase database at send time. GOD scores, sector, and match reasons are generated dynamically per recipient.
          </div>
        </div>
      )}

      {/* Job log */}
      {job && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            {job.status === "running" && <Loader2 size={13} className="animate-spin" style={{ color: "oklch(0.75 0.15 270)" }} />}
            {job.status === "done"    && <CheckCircle size={13} style={{ color: "oklch(0.85 0.17 162)" }} />}
            {job.status === "error"   && <XCircle size={13} style={{ color: "oklch(0.65 0.2 25)" }} />}
            <span style={{ fontSize: 11, fontWeight: 700, color: job.status === "done" ? "oklch(0.85 0.17 162)" : job.status === "error" ? "oklch(0.65 0.2 25)" : "oklch(0.75 0.15 270)" }}>
              {job.status === "running" ? "Running…" : job.status === "done" ? "Complete" : "Error"}
            </span>
            <span style={{ fontSize: 10, color: "oklch(0.4 0.01 264)", marginLeft: 8 }}>
              {job.mode.toUpperCase()} · {job.limit} limit · {job.dryRun ? "DRY RUN" : "LIVE"}
            </span>
            {job.finishedAt && (
              <span style={{ fontSize: 10, color: "oklch(0.4 0.01 264)" }}>
                · Finished {fmt(job.finishedAt)}
              </span>
            )}
          </div>
          <div ref={logRef}
            style={{ height: 200, overflowY: "auto", background: "oklch(0.1 0.01 264)", borderRadius: 8, padding: "10px 12px",
              fontFamily: "monospace", fontSize: 11, lineHeight: 1.6, color: "oklch(0.6 0.01 264)" }}>
            {job.log.length === 0
              ? <span style={{ color: "oklch(0.35 0.01 264)" }}>Starting…</span>
              : job.log.map((line, i) => {
                  const isGood = line.includes("✓") || line.includes("Done");
                  const isBad  = line.includes("[err]") || line.includes("✗");
                  return (
                    <div key={i} style={{ color: isGood ? "oklch(0.85 0.17 162)" : isBad ? "oklch(0.65 0.2 25)" : "oklch(0.6 0.01 264)" }}>
                      {line}
                    </div>
                  );
                })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Reply Inbox Section ────────────────────────────────────────────────────────

function ReplyInbox() {
  const gmailSearchUrl = "https://mail.google.com/mail/u/0/#search/from%3Apythh.ai+OR+subject%3APythh+OR+subject%3APYTHIA";
  const gmailInboxUrl  = "https://mail.google.com/mail/u/0/#inbox";

  return (
    <div style={{ background: "oklch(0.15 0.01 264)", border: "1px solid oklch(0.22 0.01 264)", borderRadius: 10, padding: "20px 24px" }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "oklch(0.85 0.17 162)", marginBottom: 16 }}>
        REPLY INBOX
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* How replies work */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10, color: "oklch(0.8 0.01 264)" }}>How replies work</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              ["1. Email sent", "Pythh sends from pythia@pythh.ai via Resend"],
              ["2. Reply-To set", "All replies route to ugobe07@gmail.com"],
              ["3. You reply", "Respond directly from Gmail — they see it as coming from you"],
              ["4. Tracking", "Opens, clicks, bounces tracked in the table below via Resend webhook"],
            ].map(([step, desc]) => (
              <div key={step as string} style={{ display: "flex", gap: 10 }}>
                <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "monospace", color: "oklch(0.5 0.01 264)", minWidth: 100 }}>{step}</span>
                <span style={{ fontSize: 12, color: "oklch(0.55 0.01 264)" }}>{desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick links */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10, color: "oklch(0.8 0.01 264)" }}>Check your replies</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <a href={gmailSearchUrl} target="_blank" rel="noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "oklch(0.12 0.01 264)", border: "1px solid oklch(0.22 0.01 264)", borderRadius: 8, textDecoration: "none" }}>
              <Mail size={14} style={{ color: "oklch(0.85 0.17 162)" }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "oklch(0.85 0.01 264)" }}>Gmail — Search Pythh replies</div>
                <div style={{ fontSize: 10, color: "oklch(0.45 0.01 264)" }}>Filters for emails from/about Pythh · ugobe07@gmail.com</div>
              </div>
              <ExternalLink size={11} style={{ color: "oklch(0.4 0.01 264)", marginLeft: "auto" }} />
            </a>

            <a href={gmailInboxUrl} target="_blank" rel="noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "oklch(0.12 0.01 264)", border: "1px solid oklch(0.22 0.01 264)", borderRadius: 8, textDecoration: "none" }}>
              <Mail size={14} style={{ color: "oklch(0.75 0.15 270)" }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "oklch(0.85 0.01 264)" }}>Gmail Inbox (ugobe07)</div>
                <div style={{ fontSize: 10, color: "oklch(0.45 0.01 264)" }}>All inbound — check for replies from VCs and founders</div>
              </div>
              <ExternalLink size={11} style={{ color: "oklch(0.4 0.01 264)", marginLeft: "auto" }} />
            </a>

            <a href="https://resend.com/emails" target="_blank" rel="noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "oklch(0.12 0.01 264)", border: "1px solid oklch(0.22 0.01 264)", borderRadius: 8, textDecoration: "none" }}>
              <ExternalLink size={14} style={{ color: "oklch(0.65 0.18 300)" }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "oklch(0.85 0.01 264)" }}>Resend Dashboard</div>
                <div style={{ fontSize: 10, color: "oklch(0.45 0.01 264)" }}>Delivery logs, bounce details, open events</div>
              </div>
              <ExternalLink size={11} style={{ color: "oklch(0.4 0.01 264)", marginLeft: "auto" }} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Outreach() {
  const [campaigns, setCampaigns] = useState<{ slug: string; sent_at: string }[]>([]);
  const [campaign, setCampaign]   = useState<string>("all");
  const [modeFilter, setModeFilter] = useState<"all" | "vc_leads" | "startup_matches">("all");
  const [stats, setStats]         = useState<Stats | null>(null);
  const [contacts, setContacts]   = useState<Contact[]>([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(0);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const camp = campaign === "all" ? "" : `campaign=${encodeURIComponent(campaign)}&`;
      const type = modeFilter === "all" ? "" : `type=${modeFilter}&`;
      const [sRes, cRes] = await Promise.all([
        fetch(`${API}/api/outreach/stats?${camp}`),
        fetch(`${API}/api/outreach/contacts?${camp}${type}page=${page}&limit=${LIMIT_PER_PAGE}`),
      ]);
      if (!sRes.ok || !cRes.ok) throw new Error("API error");
      const [s, c] = await Promise.all([sRes.json(), cRes.json()]);
      setStats(s); setContacts(c.contacts ?? []); setTotal(c.total ?? 0);
    } catch (e: any) {
      setError(e.message ?? "Failed to load");
    } finally { setLoading(false); }
  }, [campaign, modeFilter, page]);

  useEffect(() => {
    fetch(`${API}/api/outreach/campaigns`).then((r) => r.json())
      .then((d) => setCampaigns(d.campaigns ?? [])).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const block = stats
    ? (modeFilter === "vc_leads" ? stats.vc : modeFilter === "startup_matches" ? stats.startup : stats.total)
    : null;

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold">Outreach Dashboard</h1>
          <p className="text-xs mt-1" style={{ color: "oklch(0.45 0.01 264)" }}>
            Draft, send, and track prospecting campaigns. Replies land at{" "}
            <code style={{ color: "oklch(0.75 0.15 270)" }}>ugobe07@gmail.com</code>.
          </p>
        </div>

        {/* Campaign Launcher */}
        <div style={{ marginBottom: 24 }}>
          <CampaignLauncher onLaunched={() => { load(); fetch(`${API}/api/outreach/campaigns`).then((r) => r.json()).then((d) => setCampaigns(d.campaigns ?? [])).catch(() => {}); }} />
        </div>

        {/* Reply inbox */}
        <div style={{ marginBottom: 24 }}>
          <ReplyInbox />
        </div>

        {/* Tracking section */}
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "oklch(0.4 0.01 264)", marginBottom: 14 }}>
          EMAIL TRACKING
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 4, background: "oklch(0.15 0.01 264)", border: "1px solid oklch(0.22 0.01 264)", borderRadius: 8, padding: 4 }}>
            {(["all", "vc_leads", "startup_matches"] as const).map((m) => (
              <button key={m} onClick={() => { setModeFilter(m); setPage(0); }}
                style={{ padding: "4px 12px", borderRadius: 5, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600,
                  background: modeFilter === m ? "oklch(0.22 0.01 264)" : "transparent",
                  color: modeFilter === m ? "oklch(0.85 0.01 264)" : "oklch(0.5 0.01 264)" }}>
                {m === "all" ? "All" : m === "vc_leads" ? "VC Leads" : "Startup Matches"}
              </button>
            ))}
          </div>
          <select value={campaign} onChange={(e) => { setCampaign(e.target.value); setPage(0); }}
            style={{ background: "oklch(0.15 0.01 264)", border: "1px solid oklch(0.22 0.01 264)", color: "oklch(0.6 0.01 264)", padding: "5px 10px", borderRadius: 8, fontSize: 11 }}>
            <option value="all">All campaigns</option>
            {campaigns.map((c) => <option key={c.slug} value={c.slug}>{c.slug}</option>)}
          </select>
          <button onClick={load}
            style={{ display: "flex", alignItems: "center", gap: 5, marginLeft: "auto", padding: "5px 12px", background: "transparent", border: "1px solid oklch(0.22 0.01 264)", color: "oklch(0.5 0.01 264)", borderRadius: 6, cursor: "pointer", fontSize: 11 }}>
            <RefreshCw size={11} /> Refresh
          </button>
        </div>

        {/* Stat cards */}
        {block && (
          <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
            <StatCard label="Sent"         value={block.sent}          color="oklch(0.75 0.15 270)" />
            <StatCard label="Opened"       value={block.opened}        sub={`${block.openRate}% open rate`} color="oklch(0.85 0.17 162)" />
            <StatCard label="Clicked"      value={block.clicked}       color="oklch(0.78 0.15 200)" />
            <StatCard label="Bounced"      value={block.bounced}       color="oklch(0.65 0.2 25)" />
            <StatCard label="Unsubscribed" value={block.unsubscribed}  color="oklch(0.65 0.18 300)" />
          </div>
        )}

        {/* VC vs Startup split */}
        {stats && modeFilter === "all" && (
          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            {[{ label: "VC Leads", data: stats.vc, color: "oklch(0.75 0.15 270)" }, { label: "Startup Matches", data: stats.startup, color: "oklch(0.85 0.17 162)" }].map(({ label, data, color }) => (
              <div key={label} style={{ flex: 1, background: "oklch(0.15 0.01 264)", border: "1px solid oklch(0.22 0.01 264)", borderRadius: 10, padding: "14px 18px" }}>
                <div style={{ fontSize: 9, fontFamily: "monospace", color: "oklch(0.4 0.01 264)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>{label}</div>
                <div style={{ display: "flex", gap: 20 }}>
                  {(["sent","opened","clicked","bounced"] as const).map((k) => (
                    <div key={k}>
                      <div style={{ fontSize: 18, fontWeight: 700, color, fontFamily: "monospace" }}>{(data as any)[k]}</div>
                      <div style={{ fontSize: 10, color: "oklch(0.4 0.01 264)" }}>{k}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Contact log */}
        <div style={{ background: "oklch(0.15 0.01 264)", border: "1px solid oklch(0.22 0.01 264)", borderRadius: 10, overflow: "hidden", marginBottom: 20 }}>
          <div style={{ padding: "10px 16px", borderBottom: "1px solid oklch(0.2 0.01 264)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "oklch(0.35 0.01 264)", fontFamily: "monospace" }}>
              RECIPIENT · SUBJECT · STATUS · SENT
            </span>
            <span style={{ fontSize: 10, color: "oklch(0.35 0.01 264)", fontFamily: "monospace" }}>{total} total</span>
          </div>

          {loading && <div style={{ padding: 32, textAlign: "center", color: "oklch(0.4 0.01 264)" }}>Loading…</div>}
          {error   && <div style={{ padding: 16, color: "oklch(0.65 0.2 25)", fontSize: 12 }}>Error: {error}</div>}
          {!loading && contacts.length === 0 && (
            <div style={{ padding: 40, textAlign: "center" }}>
              <div style={{ color: "oklch(0.35 0.01 264)", fontSize: 13, marginBottom: 6 }}>No emails sent yet.</div>
              <div style={{ color: "oklch(0.3 0.01 264)", fontSize: 11, fontFamily: "monospace" }}>
                Use the Campaign Launcher above to send your first campaign.
              </div>
            </div>
          )}
          {!loading && contacts.map((c, i) => (
            <div key={c.id} style={{ padding: "12px 16px", borderBottom: "1px solid oklch(0.18 0.01 264)",
              background: i % 2 === 0 ? "oklch(0.15 0.01 264)" : "oklch(0.14 0.01 264)",
              display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: "0 0 190px", minWidth: 140 }}>
                <div style={{ fontSize: 12, color: "oklch(0.85 0.01 264)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.email}</div>
                <div style={{ fontSize: 10, color: "oklch(0.45 0.01 264)", marginTop: 2 }}>
                  <span style={{ border: `1px solid ${c.email_type === "vc_leads" ? "oklch(0.35 0.15 270)" : "oklch(0.3 0.17 162)"}`,
                    color: c.email_type === "vc_leads" ? "oklch(0.75 0.15 270)" : "oklch(0.75 0.17 162)",
                    padding: "1px 5px", borderRadius: 3, fontSize: 9, fontFamily: "monospace", fontWeight: 700 }}>
                    {c.email_type === "vc_leads" ? "VC" : "STARTUP"}
                  </span>
                  {" · "}{c.campaign_slug}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 11, color: "oklch(0.6 0.01 264)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.subject}</div>
              </div>
              <div style={{ flex: "0 0 80px", textAlign: "center" }}><StatusPill c={c} /></div>
              <div style={{ flex: "0 0 130px", textAlign: "right" }}>
                <div style={{ fontSize: 10, color: "oklch(0.4 0.01 264)", fontFamily: "monospace" }}>{fmt(c.sent_at)}</div>
                {c.opened_at && <div style={{ fontSize: 9, color: "oklch(0.75 0.17 162)", marginTop: 2 }}>opened {fmt(c.opened_at)}</div>}
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        {total > LIMIT_PER_PAGE && (
          <div style={{ display: "flex", justifyContent: "center", gap: 10 }}>
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
              style={{ padding: "5px 14px", background: "transparent", border: "1px solid oklch(0.22 0.01 264)", color: "oklch(0.5 0.01 264)", borderRadius: 6, cursor: "pointer", fontSize: 11 }}>← Prev</button>
            <span style={{ color: "oklch(0.4 0.01 264)", fontSize: 11, lineHeight: "28px" }}>Page {page + 1} of {Math.ceil(total / LIMIT_PER_PAGE)}</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={(page + 1) * LIMIT_PER_PAGE >= total}
              style={{ padding: "5px 14px", background: "transparent", border: "1px solid oklch(0.22 0.01 264)", color: "oklch(0.5 0.01 264)", borderRadius: 6, cursor: "pointer", fontSize: 11 }}>Next →</button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
