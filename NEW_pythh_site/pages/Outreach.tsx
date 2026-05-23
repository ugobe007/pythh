import { useState, useEffect, useCallback, useRef } from "react";
import DashboardLayout from "../components/DashboardLayout";
import {
  Send, RefreshCw, Mail, Eye, ExternalLink, Loader2,
  FileText, Inbox, MessageSquare, X, CheckSquare, Square,
} from "lucide-react";

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
  target_name?: string | null;
  actual_recipient?: string | null;
  status?: string;
}
interface DraftRow {
  id: string; email: string; actual_recipient?: string | null;
  email_type: "vc_leads" | "startup_matches"; subject: string;
  target_name?: string | null; campaign_slug: string; sent_at: string;
  status: string;
}
interface ReplyRow {
  id: string; from_email: string; to_email: string; subject: string;
  text_body: string; html_body?: string | null; created_at: string;
  read_at?: string | null;
}
interface MessageDetail {
  id: string; email: string; actual_recipient?: string | null;
  subject: string; html_body?: string | null; text_body?: string | null;
  target_name?: string | null; email_type: string; status: string;
  sent_at: string; campaign_slug: string;
}
interface Job {
  jobId: string; status: "running" | "done" | "error";
  log: string[]; startedAt: string; finishedAt: string | null;
  exitCode: number | null; mode: string; limit: number;
  dryRun?: boolean; draftOnly?: boolean;
}

// ── Config ────────────────────────────────────────────────────────────────────

const API = import.meta.env.VITE_API_URL || "https://hot-honey.fly.dev";
const LIMIT_PER_PAGE = 50;
const DEFAULT_CAMPAIGN = `vc-${new Date().toISOString().slice(0, 7)}`;

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

const S = {
  box: { background: "oklch(0.15 0.01 264)", border: "1px solid oklch(0.22 0.01 264)", borderRadius: 10, padding: "20px 24px" },
  label: { fontSize: 10, fontWeight: 700, color: "oklch(0.4 0.01 264)", letterSpacing: "0.1em", textTransform: "uppercase" as const, display: "block", marginBottom: 6 },
  input: { padding: "7px 10px", background: "oklch(0.12 0.01 264)", border: "1px solid oklch(0.22 0.01 264)", borderRadius: 6, color: "oklch(0.9 0.005 264)", fontSize: 12, width: "100%", boxSizing: "border-box" as const },
};

// ── Message Preview Modal ─────────────────────────────────────────────────────

function MessagePreviewModal({ messageId, onClose }: { messageId: string; onClose: () => void }) {
  const [msg, setMsg] = useState<MessageDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/outreach/message/${messageId}`)
      .then((r) => r.json())
      .then((d) => setMsg(d.message ?? null))
      .finally(() => setLoading(false));
  }, [messageId]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      onClick={onClose}>
      <div style={{ background: "oklch(0.14 0.01 264)", border: "1px solid oklch(0.25 0.01 264)", borderRadius: 12, width: "100%", maxWidth: 720, maxHeight: "90vh", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid oklch(0.22 0.01 264)", display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "oklch(0.5 0.01 264)", marginBottom: 4 }}>EMAIL PREVIEW</div>
            {loading ? <div style={{ color: "oklch(0.4 0.01 264)", fontSize: 12 }}>Loading…</div> : msg && (
              <>
                <div style={{ fontSize: 14, fontWeight: 600, color: "oklch(0.9 0.01 264)" }}>{msg.subject}</div>
                <div style={{ fontSize: 11, color: "oklch(0.5 0.01 264)", marginTop: 4 }}>
                  To: {msg.actual_recipient || msg.email}
                  {msg.target_name && ` · ${msg.target_name}`}
                </div>
              </>
            )}
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "oklch(0.5 0.01 264)", padding: 4 }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: 0 }}>
          {loading && <div style={{ padding: 32, textAlign: "center", color: "oklch(0.4 0.01 264)" }}>Loading email…</div>}
          {!loading && msg?.html_body && (
            <iframe
              srcDoc={msg.html_body}
              title="Email preview"
              sandbox=""
              style={{ width: "100%", height: 480, border: "none", background: "#fff" }}
            />
          )}
          {!loading && msg && !msg.html_body && msg.text_body && (
            <pre style={{ padding: 20, fontSize: 12, lineHeight: 1.7, color: "oklch(0.7 0.01 264)", whiteSpace: "pre-wrap", margin: 0 }}>{msg.text_body}</pre>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Web Inbox (Drafts / Sent / Replies) ───────────────────────────────────────

function WebInbox({ onRefresh }: { onRefresh: () => void }) {
  const [tab, setTab] = useState<"drafts" | "sent" | "replies">("drafts");
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [sent, setSent] = useState<Contact[]>([]);
  const [replies, setReplies] = useState<ReplyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const loadInbox = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/outreach/inbox`);
      if (!r.ok) throw new Error("Failed to load inbox");
      const d = await r.json();
      setDrafts(d.drafts ?? []);
      setSent(d.sent ?? []);
      setReplies(d.replies ?? []);
    } catch {
      setDrafts([]); setSent([]); setReplies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadInbox(); }, [loadInbox]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAllDrafts() {
    if (selected.size === drafts.length) setSelected(new Set());
    else setSelected(new Set(drafts.map((d) => d.id)));
  }

  async function sendSelected() {
    if (selected.size === 0) return;
    if (!confirm(`Send ${selected.size} approved draft(s) via Resend? This cannot be undone.`)) return;
    setSending(true);
    try {
      const r = await fetch(`${API}/api/outreach/send-drafts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      const d = await r.json();
      if (!r.ok) { alert(d.error ?? "Send failed"); return; }
      alert(`Sent ${d.sent}, failed ${d.failed}`);
      setSelected(new Set());
      loadInbox();
      onRefresh();
    } finally {
      setSending(false);
    }
  }

  async function markRead(id: string) {
    await fetch(`${API}/api/outreach/replies/${id}/read`, { method: "POST" });
    loadInbox();
  }

  const tabs = [
    { key: "drafts" as const, label: "Drafts", count: drafts.length, icon: FileText, color: "oklch(0.75 0.15 270)" },
    { key: "sent" as const, label: "Sent", count: sent.length, icon: Send, color: "oklch(0.85 0.17 162)" },
    { key: "replies" as const, label: "Replies", count: replies.filter((r) => !r.read_at).length, icon: MessageSquare, color: "oklch(0.78 0.15 200)" },
  ];

  return (
    <div style={S.box}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <Inbox size={16} style={{ color: "oklch(0.85 0.17 162)" }} />
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "oklch(0.85 0.17 162)" }}>
          PYTHH INBOX
        </div>
        <span style={{ fontSize: 10, color: "oklch(0.4 0.01 264)" }}>Review drafts before sending · track sent mail · read replies</span>
        <button onClick={loadInbox} style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", background: "transparent", border: "1px solid oklch(0.22 0.01 264)", color: "oklch(0.5 0.01 264)", borderRadius: 6, cursor: "pointer", fontSize: 11 }}>
          <RefreshCw size={11} /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {tabs.map(({ key, label, count, icon: Icon, color }) => (
          <button key={key} onClick={() => setTab(key)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600,
              border: `1px solid ${tab === key ? color : "oklch(0.22 0.01 264)"}`,
              background: tab === key ? "oklch(0.18 0.01 264)" : "transparent",
              color: tab === key ? color : "oklch(0.5 0.01 264)" }}>
            <Icon size={13} /> {label}
            {count > 0 && <span style={{ fontSize: 10, opacity: 0.8 }}>({count})</span>}
          </button>
        ))}
      </div>

      {/* Draft actions */}
      {tab === "drafts" && drafts.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, padding: "10px 14px", background: "oklch(0.12 0.01 264)", borderRadius: 8 }}>
          <button onClick={selectAllDrafts} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", background: "transparent", border: "1px solid oklch(0.22 0.01 264)", borderRadius: 6, cursor: "pointer", fontSize: 11, color: "oklch(0.6 0.01 264)" }}>
            {selected.size === drafts.length ? <CheckSquare size={13} /> : <Square size={13} />}
            {selected.size === drafts.length ? "Deselect all" : "Select all"}
          </button>
          <span style={{ fontSize: 11, color: "oklch(0.45 0.01 264)" }}>{selected.size} selected</span>
          <button onClick={sendSelected} disabled={selected.size === 0 || sending}
            style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, padding: "7px 16px", fontSize: 12, fontWeight: 700, borderRadius: 6, cursor: "pointer",
              border: "1px solid oklch(0.65 0.2 25)", background: selected.size > 0 ? "oklch(0.55 0.2 25)" : "transparent",
              color: selected.size > 0 ? "#fff" : "oklch(0.4 0.01 264)", opacity: sending ? 0.6 : 1 }}>
            {sending ? <><Loader2 size={13} className="animate-spin" /> Sending…</> : <><Send size={13} /> Approve & Send Selected</>}
          </button>
        </div>
      )}

      {/* List */}
      <div style={{ border: "1px solid oklch(0.2 0.01 264)", borderRadius: 8, overflow: "hidden" }}>
        {loading && <div style={{ padding: 32, textAlign: "center", color: "oklch(0.4 0.01 264)", fontSize: 12 }}>Loading…</div>}

        {!loading && tab === "drafts" && drafts.length === 0 && (
          <div style={{ padding: 40, textAlign: "center" }}>
            <FileText size={28} style={{ color: "oklch(0.3 0.01 264)", marginBottom: 10 }} />
            <div style={{ color: "oklch(0.45 0.01 264)", fontSize: 13 }}>No drafts yet</div>
            <div style={{ color: "oklch(0.35 0.01 264)", fontSize: 11, marginTop: 4 }}>
              Drafts auto-generate when you open this page. One email per firm — no duplicate partners.
            </div>
          </div>
        )}

        {!loading && tab === "drafts" && drafts.map((d, i) => (
          <div key={d.id} style={{ padding: "12px 16px", borderBottom: "1px solid oklch(0.18 0.01 264)", background: i % 2 === 0 ? "oklch(0.15 0.01 264)" : "oklch(0.14 0.01 264)", display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => toggleSelect(d.id)} style={{ background: "transparent", border: "none", cursor: "pointer", color: selected.has(d.id) ? "oklch(0.75 0.15 270)" : "oklch(0.35 0.01 264)", padding: 0 }}>
              {selected.has(d.id) ? <CheckSquare size={16} /> : <Square size={16} />}
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: "oklch(0.85 0.01 264)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {d.target_name || d.email}
              </div>
              <div style={{ fontSize: 11, color: "oklch(0.5 0.01 264)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.subject}</div>
              <div style={{ fontSize: 10, color: "oklch(0.4 0.01 264)", marginTop: 2 }}>
                {d.actual_recipient || d.email} · {d.campaign_slug}
              </div>
            </div>
            <button onClick={() => setPreviewId(d.id)}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", fontSize: 11, borderRadius: 6, cursor: "pointer", border: "1px solid oklch(0.25 0.01 264)", background: "transparent", color: "oklch(0.6 0.01 264)" }}>
              <Eye size={12} /> Preview
            </button>
          </div>
        ))}

        {!loading && tab === "sent" && sent.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: "oklch(0.4 0.01 264)", fontSize: 12 }}>No sent emails yet</div>
        )}
        {!loading && tab === "sent" && sent.map((c, i) => (
          <div key={c.id} style={{ padding: "12px 16px", borderBottom: "1px solid oklch(0.18 0.01 264)", background: i % 2 === 0 ? "oklch(0.15 0.01 264)" : "oklch(0.14 0.01 264)", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: "oklch(0.85 0.01 264)" }}>{c.target_name || c.email}</div>
              <div style={{ fontSize: 11, color: "oklch(0.5 0.01 264)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.subject}</div>
            </div>
            <StatusPill c={c} />
            <div style={{ fontSize: 10, color: "oklch(0.4 0.01 264)", fontFamily: "monospace", minWidth: 90, textAlign: "right" }}>{fmt(c.sent_at)}</div>
            <button onClick={() => setPreviewId(c.id)}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", fontSize: 11, borderRadius: 6, cursor: "pointer", border: "1px solid oklch(0.25 0.01 264)", background: "transparent", color: "oklch(0.6 0.01 264)" }}>
              <Eye size={12} />
            </button>
          </div>
        ))}

        {!loading && tab === "replies" && replies.length === 0 && (
          <div style={{ padding: 40, textAlign: "center" }}>
            <MessageSquare size={28} style={{ color: "oklch(0.3 0.01 264)", marginBottom: 10 }} />
            <div style={{ color: "oklch(0.45 0.01 264)", fontSize: 13 }}>No replies captured yet</div>
            <div style={{ color: "oklch(0.35 0.01 264)", fontSize: 11, marginTop: 4 }}>
              Replies appear here when Resend inbound webhook is configured
            </div>
            <a href="https://mail.google.com/mail/u/0/#inbox" target="_blank" rel="noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 14, fontSize: 11, color: "oklch(0.75 0.15 270)" }}>
              <ExternalLink size={11} /> Check Gmail (ugobe07@gmail.com)
            </a>
          </div>
        )}
        {!loading && tab === "replies" && replies.map((r, i) => (
          <div key={r.id} style={{ padding: "12px 16px", borderBottom: "1px solid oklch(0.18 0.01 264)", background: i % 2 === 0 ? "oklch(0.15 0.01 264)" : "oklch(0.14 0.01 264)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              {!r.read_at && <span style={pill("#1a2e05","#84cc16")}>New</span>}
              <span style={{ fontSize: 12, fontWeight: 600, color: "oklch(0.85 0.01 264)" }}>{r.from_email}</span>
              <span style={{ fontSize: 10, color: "oklch(0.4 0.01 264)", marginLeft: "auto", fontFamily: "monospace" }}>{fmt(r.created_at)}</span>
              {!r.read_at && (
                <button onClick={() => markRead(r.id)} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 4, cursor: "pointer", border: "1px solid oklch(0.25 0.01 264)", background: "transparent", color: "oklch(0.5 0.01 264)" }}>
                  Mark read
                </button>
              )}
            </div>
            <div style={{ fontSize: 11, color: "oklch(0.6 0.01 264)", marginBottom: 6 }}>{r.subject}</div>
            <div style={{ fontSize: 11, color: "oklch(0.5 0.01 264)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
              {(r.text_body || "").slice(0, 300)}{(r.text_body || "").length > 300 ? "…" : ""}
            </div>
          </div>
        ))}
      </div>

      {previewId && <MessagePreviewModal messageId={previewId} onClose={() => setPreviewId(null)} />}
    </div>
  );
}

// ── Draft generator (top bar) ─────────────────────────────────────────────────

function DraftGeneratorBar({ onLaunched }: { onLaunched: () => void }) {
  const [mode, setMode]         = useState<"vc" | "startup">("vc");
  const [limit, setLimit]       = useState(20);
  const [campaign, setCampaign] = useState(DEFAULT_CAMPAIGN);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [dryRun, setDryRun]     = useState(false);
  const [testTo, setTestTo]     = useState("");
  const [job, setJob]           = useState<Job | null>(null);
  const [launching, setLaunching] = useState(false);
  const [autoStatus, setAutoStatus] = useState<string | null>(null);
  const pollRef                 = useRef<ReturnType<typeof setInterval> | null>(null);
  const logRef                  = useRef<HTMLDivElement>(null);
  const autoRanRef              = useRef(false);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [job?.log.length]);

  useEffect(() => {
    if (job?.status !== "running") {
      if (pollRef.current) clearInterval(pollRef.current);
      if (job?.status === "done") {
        setAutoStatus("Drafts ready — review in inbox below");
        onLaunched();
      }
      return;
    }
    pollRef.current = setInterval(async () => {
      const r = await fetch(`${API}/api/outreach/run/${job.jobId}`);
      if (r.ok) { const j = await r.json(); setJob(j); }
    }, 1500);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [job?.status, job?.jobId, onLaunched]);

  // Auto-generate VC drafts on first page load when inbox is low
  useEffect(() => {
    if (autoRanRef.current) return;
    autoRanRef.current = true;
    setAutoStatus("Checking for drafts…");
    fetch(`${API}/api/outreach/ensure-drafts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit, campaign }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.triggered && d.jobId) {
          setAutoStatus(`Auto-generating ${limit} VC drafts (one per firm)…`);
          setJob({
            jobId: d.jobId,
            status: "running",
            log: [],
            startedAt: new Date().toISOString(),
            finishedAt: null,
            exitCode: null,
            mode: "vc",
            limit,
            draftOnly: true,
          });
        } else if (d.reason === "enough_drafts") {
          setAutoStatus(`${d.draftCount} drafts ready`);
        } else if (d.reason === "already_running") {
          setAutoStatus("Draft generation already in progress…");
          if (d.jobId) {
            setJob({
              jobId: d.jobId,
              status: "running",
              log: [],
              startedAt: new Date().toISOString(),
              finishedAt: null,
              exitCode: null,
              mode: "vc",
              limit,
              draftOnly: true,
            });
          }
        } else {
          setAutoStatus(null);
        }
      })
      .catch(() => setAutoStatus(null));
  }, [limit, campaign]);

  async function launch(draftOnly: boolean) {
    setLaunching(true);
    setJob(null);
    setAutoStatus(null);
    try {
      const r = await fetch(`${API}/api/outreach/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode, limit, draftOnly,
          dryRun: draftOnly ? false : dryRun,
          campaign: campaign || DEFAULT_CAMPAIGN,
          testTo: testTo || undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok) { alert(j.error ?? "Launch failed"); return; }
      setJob({ ...j, log: [], mode, limit, dryRun, draftOnly, startedAt: new Date().toISOString(), finishedAt: null, exitCode: null });
    } finally {
      setLaunching(false);
    }
  }

  return (
    <div style={S.box}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "oklch(0.75 0.15 270)", marginBottom: 6 }}>
            GENERATE DRAFTS
          </div>
          <div style={{ fontSize: 12, color: "oklch(0.5 0.01 264)" }}>
            One email per firm — highest-scored partner only. Drafts appear in the inbox below for preview and approval.
          </div>
          {autoStatus && (
            <div style={{ fontSize: 11, color: "oklch(0.75 0.15 270)", marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
              {(job?.status === "running" || autoStatus.includes("progress")) && <Loader2 size={12} className="animate-spin" />}
              {autoStatus}
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} style={{ ...S.input, width: 72 }}>
            {[5, 10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <div style={{ display: "flex", gap: 4 }}>
            {(["vc", "startup"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)}
                style={{ padding: "7px 12px", fontSize: 11, fontWeight: 600, borderRadius: 6, cursor: "pointer",
                  border: `1px solid ${mode === m ? "oklch(0.75 0.15 270)" : "oklch(0.22 0.01 264)"}`,
                  background: mode === m ? "oklch(0.18 0.01 264)" : "transparent",
                  color: mode === m ? "oklch(0.75 0.15 270)" : "oklch(0.5 0.01 264)" }}>
                {m === "vc" ? "VC" : "Startup"}
              </button>
            ))}
          </div>
          <button onClick={() => launch(true)} disabled={launching || job?.status === "running"}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 18px", fontSize: 13, fontWeight: 700, borderRadius: 6, cursor: "pointer",
              border: "1px solid oklch(0.75 0.15 270)", background: "oklch(0.55 0.2 25)", color: "#fff",
              opacity: launching || job?.status === "running" ? 0.5 : 1 }}>
            {launching || job?.status === "running"
              ? <><Loader2 size={14} className="animate-spin" /> Generating…</>
              : <><FileText size={14} /> Generate {limit} Drafts</>}
          </button>
        </div>
      </div>

      <button onClick={() => setShowAdvanced(!showAdvanced)}
        style={{ fontSize: 11, padding: "4px 0", background: "transparent", border: "none", cursor: "pointer", color: "oklch(0.45 0.01 264)", marginBottom: showAdvanced ? 12 : 0 }}>
        {showAdvanced ? "Hide" : "Show"} advanced options
      </button>

      {showAdvanced && (
        <div style={{ padding: "14px 16px", background: "oklch(0.12 0.01 264)", borderRadius: 8, border: "1px solid oklch(0.2 0.01 264)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={S.label}>Campaign slug</label>
              <input type="text" value={campaign} onChange={(e) => setCampaign(e.target.value)} style={S.input} />
            </div>
            <div>
              <label style={S.label}>Test to email (optional)</label>
              <input type="email" placeholder="you@example.com" value={testTo} onChange={(e) => setTestTo(e.target.value)} style={S.input} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12 }}>
              <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
              Dry run (log only)
            </label>
            <button onClick={() => launch(false)} disabled={launching || job?.status === "running" || dryRun}
              style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, padding: "7px 16px", fontSize: 12, fontWeight: 700, borderRadius: 6, cursor: "pointer",
                border: "1px solid oklch(0.65 0.2 25)", background: dryRun ? "transparent" : "oklch(0.55 0.2 25)", color: dryRun ? "oklch(0.4 0.01 264)" : "#fff",
                opacity: dryRun ? 0.5 : 1 }}>
              <Send size={13} /> Send immediately
            </button>
          </div>
        </div>
      )}

      {job && job.log.length > 0 && (
        <div ref={logRef}
          style={{ marginTop: 12, height: 100, overflowY: "auto", background: "oklch(0.1 0.01 264)", borderRadius: 8, padding: "8px 10px",
            fontFamily: "monospace", fontSize: 10, lineHeight: 1.5, color: "oklch(0.6 0.01 264)" }}>
          {job.log.slice(-30).map((line, i) => (
            <div key={i} style={{ color: line.includes("✓") || line.includes("draft") ? "oklch(0.85 0.17 162)" : line.includes("[err]") ? "oklch(0.65 0.2 25)" : "oklch(0.6 0.01 264)" }}>
              {line}
            </div>
          ))}
        </div>
      )}
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
  const [inboxKey, setInboxKey]   = useState(0);

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

  const refreshAll = useCallback(() => {
    load();
    setInboxKey((k) => k + 1);
    fetch(`${API}/api/outreach/campaigns`).then((r) => r.json())
      .then((d) => setCampaigns(d.campaigns ?? [])).catch(() => {});
  }, [load]);

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

        <div className="mb-6">
          <h1 className="text-xl font-bold">Outreach Dashboard</h1>
          <p className="text-xs mt-1" style={{ color: "oklch(0.45 0.01 264)" }}>
            Drafts auto-fill when you open this page. Preview, approve, and send — one email per firm.
          </p>
        </div>

        <div style={{ marginBottom: 24 }}>
          <DraftGeneratorBar onLaunched={refreshAll} />
        </div>

        <div style={{ marginBottom: 24 }}>
          <WebInbox key={inboxKey} onRefresh={refreshAll} />
        </div>

        {/* Tracking section */}
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "oklch(0.4 0.01 264)", marginBottom: 14 }}>
          DELIVERY TRACKING
        </div>

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

        {block && (
          <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
            <StatCard label="Sent"         value={block.sent}          color="oklch(0.75 0.15 270)" />
            <StatCard label="Opened"       value={block.opened}        sub={`${block.openRate}% open rate`} color="oklch(0.85 0.17 162)" />
            <StatCard label="Clicked"      value={block.clicked}       color="oklch(0.78 0.15 200)" />
            <StatCard label="Bounced"      value={block.bounced}       color="oklch(0.65 0.2 25)" />
            <StatCard label="Unsubscribed" value={block.unsubscribed}  color="oklch(0.65 0.18 300)" />
          </div>
        )}

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
                Generate drafts above, review them, then approve & send.
              </div>
            </div>
          )}
          {!loading && contacts.map((c, i) => (
            <div key={c.id} style={{ padding: "12px 16px", borderBottom: "1px solid oklch(0.18 0.01 264)",
              background: i % 2 === 0 ? "oklch(0.15 0.01 264)" : "oklch(0.14 0.01 264)",
              display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: "0 0 190px", minWidth: 140 }}>
                <div style={{ fontSize: 12, color: "oklch(0.85 0.01 264)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.target_name || c.email}</div>
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

        {total > LIMIT_PER_PAGE && (
          <div style={{ display: "flex", justifyContent: "center", gap: 10 }}>
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
              style={{ padding: "5px 14px", background: "transparent", border: "1px solid oklch(0.22 0.01 264)", color: "oklch(0.5 0.01 264)", borderRadius: 6, cursor: "pointer", fontSize: 11 }}>← Prev</button>
            <span style={{ color: "oklch(0.4 0.01 264)", fontSize: 11, lineHeight: "28px" }}>Page {page + 1} of {Math.ceil(total / LIMIT_PER_PAGE)}</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={(page + 1) * LIMIT_PER_PAGE >= total}
              style={{ padding: "5px 14px", background: "transparent", border: "1px solid oklch(0.22 0.01 264)", color: "oklch(0.5 0.01 264)", borderRadius: 6, cursor: "pointer", fontSize: 11 }}>Next →</button>
          </div>
        )}

        {/* External links */}
        <div style={{ marginTop: 32, padding: "16px 20px", background: "oklch(0.12 0.01 264)", borderRadius: 8, border: "1px solid oklch(0.2 0.01 264)" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "oklch(0.4 0.01 264)", marginBottom: 10 }}>EXTERNAL</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <a href="https://mail.google.com/mail/u/0/#inbox" target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "oklch(0.6 0.01 264)", display: "flex", alignItems: "center", gap: 5 }}>
              <Mail size={12} /> Gmail (ugobe07@gmail.com) <ExternalLink size={10} />
            </a>
            <a href="https://resend.com/emails" target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "oklch(0.6 0.01 264)", display: "flex", alignItems: "center", gap: 5 }}>
              <ExternalLink size={12} /> Resend delivery logs <ExternalLink size={10} />
            </a>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
