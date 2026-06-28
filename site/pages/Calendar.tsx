import { useState } from "react";
import DashboardLayout from "../components/DashboardLayout";

// ── Types ─────────────────────────────────────────────────────────────────────

interface MeetingSlot {
  label: string;   // "Mon Jun 2, 10:00 AM ET"
  iso: string;     // ISO 8601
  gcalUrl: string; // Google Calendar one-click link
}

interface ProposedMeeting {
  id: string;
  contact: string;
  firm: string;
  type: "vc" | "startup";
  subject: string;
  slots: MeetingSlot[];
  status: "proposed" | "confirmed" | "declined";
  confirmedSlot?: MeetingSlot;
  createdAt: string;
}

// ── Google Calendar link builder ──────────────────────────────────────────────

function gcalUrl(opts: { title: string; start: Date; end: Date; description?: string; guests?: string[] }) {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: opts.title,
    dates: `${fmt(opts.start)}/${fmt(opts.end)}`,
    details: opts.description ?? "",
    add: (opts.guests ?? []).join(","),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// ── Slot generator — next 5 business days, 3 time options each ────────────────

function generateSlots(contactEmail: string, firm: string): MeetingSlot[] {
  const slots: MeetingSlot[] = [];
  const now = new Date();
  let d = new Date(now);
  d.setDate(d.getDate() + 1);

  const HOURS = [10, 14, 16]; // 10am, 2pm, 4pm ET

  while (slots.length < 3) {
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) {
      const hour = HOURS[slots.length % HOURS.length];
      const start = new Date(d);
      start.setHours(hour, 0, 0, 0);
      const end = new Date(start);
      end.setMinutes(30);

      const label = start.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });

      slots.push({
        label,
        iso: start.toISOString(),
        gcalUrl: gcalUrl({
          title: `Pythh intro call — ${firm}`,
          start,
          end,
          description: `Intro call with ${contactEmail} via Pythh outreach.\n\nPythh.ai — AI-powered startup × investor matching.`,
          guests: [contactEmail, "ugobe07@gmail.com"],
        }),
      });
    }
    d.setDate(d.getDate() + 1);
  }
  return slots;
}

// ── Static demo data (real data comes from pythh_outreach_meetings once wired) ─

function useMeetings(): ProposedMeeting[] {
  const now = new Date().toISOString();
  return [
    {
      id: "demo-1",
      contact: "pitch@firstround.com",
      firm: "First Round Capital",
      type: "vc",
      subject: "10 AI/ML startups matched to First Round Capital's thesis",
      slots: generateSlots("pitch@firstround.com", "First Round Capital"),
      status: "proposed",
      createdAt: now,
    },
    {
      id: "demo-2",
      contact: "pitch@nea.com",
      firm: "New Enterprise Associates",
      type: "vc",
      subject: "10 AI/ML startups matched to NEA's thesis",
      slots: generateSlots("pitch@nea.com", "NEA"),
      status: "proposed",
      createdAt: now,
    },
    {
      id: "demo-3",
      contact: "info@anterior.com",
      firm: "Anterior",
      type: "startup",
      subject: "Your top 5 investor matches are ready",
      slots: generateSlots("info@anterior.com", "Anterior"),
      status: "proposed",
      createdAt: now,
    },
  ];
}

// ── Components ────────────────────────────────────────────────────────────────

function MeetingCard({ m, onCopy }: { m: ProposedMeeting; onCopy: (text: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const typeColor = m.type === "vc" ? "#a78bfa" : "#22c55e";
  const typeBg    = m.type === "vc" ? "#160929" : "#052e16";
  const typeBorder = m.type === "vc" ? "#3b1d6e" : "#14532d";

  const emailBody = `Hi,

Following up on my note about Pythh — happy to jump on a quick 30-min call to walk through how our signal engine works and what it found for ${m.firm}.

Here are a few times that work:
${m.slots.map((s, i) => `${i + 1}. ${s.label}`).join("\n")}

Just reply with your preference and I'll send a calendar invite.

Best`;

  return (
    <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, marginBottom: 16, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "16px 20px", display: "flex", alignItems: "flex-start", gap: 14, cursor: "pointer" }} onClick={() => setExpanded(!expanded)}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: "#f1f5f9" }}>{m.firm}</span>
            <span style={{ background: typeBg, color: typeColor, border: `1px solid ${typeBorder}`, fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 3, fontFamily: "monospace", textTransform: "uppercase" }}>
              {m.type === "vc" ? "VC LEAD" : "STARTUP"}
            </span>
            <span style={{ background: "#1e293b", color: "#94a3b8", fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 3, fontFamily: "monospace", textTransform: "uppercase" }}>
              {m.status}
            </span>
          </div>
          <div style={{ fontSize: 12, color: "#64748b" }}>{m.contact}</div>
          <div style={{ fontSize: 11, color: "#475569", marginTop: 2, fontStyle: "italic" }}>{m.subject}</div>
        </div>
        <div style={{ color: "#334155", fontSize: 18, lineHeight: 1 }}>{expanded ? "▲" : "▼"}</div>
      </div>

      {expanded && (
        <div style={{ borderTop: "1px solid #1e293b", padding: "16px 20px" }}>
          {/* Meeting slots */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#334155", fontFamily: "monospace", marginBottom: 10 }}>PROPOSED TIMES — click to add to Google Calendar</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {m.slots.map((slot, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ color: "#475569", fontSize: 12, fontFamily: "monospace", width: 16 }}>{i + 1}.</span>
                  <span style={{ color: "#94a3b8", fontSize: 13, flex: 1 }}>{slot.label}</span>
                  <a href={slot.gcalUrl} target="_blank" rel="noreferrer"
                    style={{ fontSize: 11, color: typeColor, border: `1px solid ${typeBorder}`, padding: "3px 10px", borderRadius: 5, textDecoration: "none", whiteSpace: "nowrap" }}>
                    Add to Calendar →
                  </a>
                </div>
              ))}
            </div>
          </div>

          {/* Follow-up email */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#334155", fontFamily: "monospace", marginBottom: 8 }}>
              FOLLOW-UP EMAIL — copy and send to {m.contact}
            </div>
            <div style={{ background: "#0b0f1a", border: "1px solid #1e293b", borderRadius: 8, padding: "14px 16px", position: "relative" }}>
              <pre style={{ margin: 0, fontFamily: "monospace", fontSize: 12, color: "#94a3b8", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{emailBody}</pre>
              <button
                onClick={() => { navigator.clipboard.writeText(emailBody); onCopy("Email copied!"); }}
                style={{ position: "absolute", top: 8, right: 8, background: "transparent", border: "1px solid #1e293b", color: "#64748b", padding: "3px 10px", borderRadius: 5, cursor: "pointer", fontSize: 11 }}>
                Copy
              </button>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <a href={`mailto:${m.contact}?subject=Following up — ${encodeURIComponent(m.firm)}&body=${encodeURIComponent(emailBody)}`}
               style={{ fontSize: 12, color: typeColor, border: `1px solid ${typeBorder}`, padding: "6px 16px", borderRadius: 7, textDecoration: "none" }}>
              Open in Mail →
            </a>
            <button onClick={() => onCopy(m.contact)} style={{ fontSize: 12, color: "#64748b", border: "1px solid #1e293b", padding: "6px 16px", borderRadius: 7, background: "transparent", cursor: "pointer" }}>
              Copy email address
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Calendar() {
  const meetings = useMeetings();
  const [toast, setToast] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "vc" | "startup">("all");

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  const filtered = meetings.filter((m) => filter === "all" || m.type === filter);

  return (
    <DashboardLayout>
      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 80, left: "50%", transform: "translateX(-50%)", background: "#1e293b", color: "#f1f5f9", padding: "8px 20px", borderRadius: 8, fontSize: 13, zIndex: 9999, border: "1px solid #334155" }}>
          {toast}
        </div>
      )}

      <div style={{ maxWidth: 900, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#22c55e", fontFamily: "monospace", marginBottom: 6 }}>PYTHIA · Meetings</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#f1f5f9", margin: "0 0 8px" }}>Meeting Pipeline</h1>
          <p style={{ color: "#64748b", fontSize: 14, margin: 0 }}>
            Proposed meeting times from your outreach campaigns. Click any slot to add it to Google Calendar,
            or copy the follow-up email to send directly.
          </p>

          {/* Calendar links */}
          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a href="https://calendar.google.com" target="_blank" rel="noreferrer"
              style={{ fontSize: 12, color: "#22c55e", border: "1px solid #14532d", padding: "5px 12px", borderRadius: 6, textDecoration: "none" }}>
              Open Google Calendar →
            </a>
            <a href="https://mail.google.com/mail/u/0/#inbox" target="_blank" rel="noreferrer"
              style={{ fontSize: 12, color: "#64748b", border: "1px solid #1e293b", padding: "5px 12px", borderRadius: 6, textDecoration: "none" }}>
              Check Gmail (ugobe07) →
            </a>
            <a href="/admin/outreach"
              style={{ fontSize: 12, color: "#a78bfa", border: "1px solid #3b1d6e", padding: "5px 12px", borderRadius: 6, textDecoration: "none" }}>
              ← Outreach Dashboard
            </a>
          </div>
        </div>

        {/* How it works */}
        <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: "16px 20px", marginBottom: 24 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#334155", fontFamily: "monospace", marginBottom: 10 }}>HOW MEETING BOOKING WORKS</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            {[
              ["1", "Outreach agent sends email", "Email lands in VC/founder inbox with your thesis match"],
              ["2", "They reply to ugobe07@gmail.com", "Reply-to is set to your Gmail — you see it immediately"],
              ["3", "Pick a slot + click Add to Calendar", "One-click adds to Google Calendar with contact as guest"],
              ["4", "Send follow-up email", "Copy the pre-written follow-up and send from Mail"],
            ].map(([n, title, desc]) => (
              <div key={n} style={{ display: "flex", gap: 10 }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#1e293b", fontFamily: "monospace", lineHeight: 1.2, flexShrink: 0 }}>{n}</div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8", marginBottom: 2 }}>{title}</div>
                  <div style={{ fontSize: 11, color: "#475569" }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Filter */}
        <div style={{ display: "flex", gap: 4, background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, padding: 4, marginBottom: 20, width: "fit-content" }}>
          {(["all", "vc", "startup"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding: "5px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
                background: filter === f ? "#1e293b" : "transparent",
                color: filter === f ? "#f1f5f9" : "#64748b" }}>
              {f === "all" ? "All" : f === "vc" ? "VC Firms" : "Startups"}
            </button>
          ))}
        </div>

        {/* Meeting cards */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "#334155" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📅</div>
            <div style={{ fontSize: 14, marginBottom: 6 }}>No meetings proposed yet.</div>
            <div style={{ fontSize: 12 }}>Run the outreach agent and meetings will appear here.</div>
          </div>
        ) : (
          filtered.map((m) => <MeetingCard key={m.id} m={m} onCopy={showToast} />)
        )}

        {/* Note about live data */}
        <div style={{ marginTop: 24, padding: "14px 18px", background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10 }}>
          <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.6 }}>
            <span style={{ color: "#f59e0b", fontFamily: "monospace", fontWeight: 700 }}>NOTE: </span>
            Meeting cards above are generated from your current outreach campaign contacts. Once a contact replies and confirms a slot,
            update their status in <a href="/admin/outreach" style={{ color: "#a78bfa" }}>Outreach Dashboard</a>.
            Future versions will auto-detect replies via Gmail API and confirm meetings automatically.
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
