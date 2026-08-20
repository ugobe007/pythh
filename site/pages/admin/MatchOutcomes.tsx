import { Helmet } from "react-helmet-async";
import { useCallback, useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { apiUrl } from "@/lib/apiConfig";

type ProofSummary = {
  verified_pairs: number;
  pending_review: number;
  search_queue_pending: number;
  search_queue_complete: number;
};

type VerifiedPair = {
  id: string;
  startup: string;
  investor: string;
  evidence_type: string;
  event_at: string;
  match_at: string;
  days_after_match: number;
  match_score: number | null;
  source_provider: string;
  source_url: string;
  source_tier: string;
};

type PendingRow = {
  id: string;
  startup: string;
  investor: string;
  event_at: string;
  match_at: string;
  days_after_match: number;
  source_provider: string;
  source_url: string;
  source_tier: string;
  issuer_primary: boolean;
};

const border = "oklch(0.22 0.01 264)";
const panelBg = "oklch(0.15 0.01 264)";
const muted = "oklch(0.5 0.01 264)";

function initialTab(): "proof" | "review" {
  if (typeof window === "undefined") return "proof";
  const q = new URLSearchParams(window.location.search).get("tab");
  return q === "review" ? "review" : "proof";
}

export default function MatchOutcomesPage() {
  const [tab, setTab] = useState<"proof" | "review">(initialTab);
  const [summary, setSummary] = useState<ProofSummary | null>(null);
  const [timeline, setTimeline] = useState<{ month: string; count: number }[]>([]);
  const [verified, setVerified] = useState<VerifiedPair[]>([]);
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [proofRes, pendingRes] = await Promise.all([
        fetch(apiUrl("/api/admin/match-outcomes/proof")),
        fetch(apiUrl("/api/admin/match-outcomes/pending?limit=50")),
      ]);
      if (!proofRes.ok) {
        const body = await proofRes.json().catch(() => ({}));
        const raw = body.error || `Proof ${proofRes.status}`;
        if (/ENOTFOUND\s+base/i.test(String(raw))) {
          throw new Error(
            "Fly API still has a broken DATABASE_URL (hostname \"base\"). Merge PR #22 so the proof endpoint uses Supabase instead, then refresh.",
          );
        }
        throw new Error(raw);
      }
      if (!pendingRes.ok) throw new Error((await pendingRes.json().catch(() => ({}))).error || `Pending ${pendingRes.status}`);
      const proof = await proofRes.json();
      const pend = await pendingRes.json();
      setSummary(proof.summary);
      setTimeline(proof.timeline || []);
      setVerified(proof.verified_pairs || []);
      setPending(pend.rows || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const review = async (evidenceId: string, decision: "verified" | "rejected", force = false) => {
    setBusyId(evidenceId);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/admin/match-outcomes/review"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          evidenceId,
          decision,
          note: notes[evidenceId]?.trim() || undefined,
          force,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Review failed (${res.status})`);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <DashboardLayout>
      <Helmet>
        <title>Match Outcomes Proof — Pythh.ai</title>
      </Helmet>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Match Outcomes Proof</h1>
          <p className="mt-1 text-xs" style={{ color: muted }}>
            Live-or-die metric: after Pythh matched startup × investor, did post-prediction funding occur?
            Verify issuer-primary sources only (Business Wire, PR Newswire, GlobeNewswire, company blog).
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded border px-3 py-2 text-xs font-bold"
          style={{ borderColor: border }}
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded border p-3 text-sm text-red-300" style={{ borderColor: "oklch(0.45 0.12 25)" }}>
          {error}
        </div>
      )}

      {summary && (
        <div className="mb-6 grid gap-3 sm:grid-cols-4">
          {[
            ["Verified pairs", summary.verified_pairs],
            ["Pending review", summary.pending_review],
            ["Search queue pending", summary.search_queue_pending],
            ["Search complete", summary.search_queue_complete],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-lg border p-4" style={{ borderColor: border, background: panelBg }}>
              <div className="text-[11px] uppercase tracking-wide" style={{ color: muted }}>
                {label}
              </div>
              <div className="mt-1 text-2xl font-bold font-mono">{value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="mb-4 flex gap-2 relative z-10">
        <button
          type="button"
          onClick={() => {
            setTab("proof");
            const url = new URL(window.location.href);
            url.searchParams.delete("tab");
            window.history.replaceState({}, "", url);
          }}
          className="rounded px-3 py-2 text-xs font-bold cursor-pointer"
          style={{
            background: tab === "proof" ? "oklch(0.7 0.17 162)" : "transparent",
            color: tab === "proof" ? "oklch(0.13 0.01 264)" : muted,
            border: `1px solid ${border}`,
          }}
        >
          Proof dashboard
        </button>
        <button
          type="button"
          onClick={() => {
            setTab("review");
            const url = new URL(window.location.href);
            url.searchParams.set("tab", "review");
            window.history.replaceState({}, "", url);
          }}
          className="rounded px-3 py-2 text-xs font-bold cursor-pointer"
          style={{
            background: tab === "review" ? "oklch(0.7 0.17 162)" : "transparent",
            color: tab === "review" ? "oklch(0.13 0.01 264)" : muted,
            border: `1px solid ${border}`,
          }}
        >
          Review queue ({pending.length || summary?.pending_review || 0})
        </button>
      </div>

      {loading && <p className="text-sm">Loading…</p>}

      {!loading && tab === "proof" && (
        <div className="grid gap-6">
          <section className="rounded-lg border p-4" style={{ borderColor: border, background: panelBg }}>
            <h2 className="text-sm font-bold">Verified pairs by event month</h2>
            {timeline.length === 0 ? (
              <p className="mt-2 text-xs" style={{ color: muted }}>
                No verified pairs yet.
              </p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {timeline.map((t) => (
                  <div key={t.month} className="rounded border px-3 py-2 text-xs font-mono" style={{ borderColor: border }}>
                    {t.month}: <strong>{t.count}</strong>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="grid gap-3">
            {verified.map((row) => (
              <article key={row.id} className="rounded-lg border p-4" style={{ borderColor: border, background: panelBg }}>
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold">
                      {row.startup} × {row.investor}
                    </div>
                    <div className="mt-1 text-[11px] font-mono" style={{ color: muted }}>
                      +{row.days_after_match}d after match · score {row.match_score ?? "—"} · {row.source_tier}
                    </div>
                  </div>
                  <div className="text-[11px]" style={{ color: muted }}>
                    {new Date(row.event_at).toLocaleDateString()}
                  </div>
                </div>
                <a className="mt-2 inline-block text-xs" href={row.source_url} target="_blank" rel="noreferrer" style={{ color: "oklch(0.8 0.16 162)" }}>
                  {row.source_provider} ↗
                </a>
              </article>
            ))}
          </section>
        </div>
      )}

      {!loading && tab === "review" && (
        <div className="grid gap-4">
          {pending.length === 0 && (
            <div className="rounded-lg border p-6 text-sm" style={{ borderColor: border }}>
              No evidence waiting for review. Search agent will add candidates as the queue advances.
            </div>
          )}
          {pending.map((row) => (
            <article key={row.id} className="rounded-lg border p-4" style={{ borderColor: border, background: panelBg }}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-bold">
                    {row.startup} × {row.investor}
                  </div>
                  <div className="mt-1 text-[11px] font-mono" style={{ color: muted }}>
                    +{row.days_after_match}d · {row.source_tier}
                    {row.issuer_primary ? " · issuer-primary" : " · not issuer-primary"}
                  </div>
                </div>
                <div className="text-[11px]" style={{ color: muted }}>
                  {new Date(row.event_at).toLocaleDateString()}
                </div>
              </div>
              <a className="mt-2 inline-block text-xs" href={row.source_url} target="_blank" rel="noreferrer" style={{ color: "oklch(0.8 0.16 162)" }}>
                Open source ({row.source_provider}) ↗
              </a>
              <textarea
                className="mt-3 w-full rounded-md border bg-transparent p-2 text-xs"
                style={{ borderColor: "oklch(0.25 0.01 264)" }}
                placeholder="Optional review note"
                value={notes[row.id] ?? ""}
                onChange={(e) => setNotes((n) => ({ ...n, [row.id]: e.target.value }))}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() => void review(row.id, "verified", false)}
                  className="rounded px-3 py-2 text-xs font-bold"
                  style={{ background: "oklch(0.7 0.17 162)", color: "oklch(0.13 0.01 264)" }}
                  title="Requires issuer-primary URL unless forced"
                >
                  Verify
                </button>
                {!row.issuer_primary && (
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => {
                      if (confirm("Force-verify a non-issuer-primary source?")) void review(row.id, "verified", true);
                    }}
                    className="rounded border px-3 py-2 text-xs font-bold"
                    style={{ borderColor: border }}
                  >
                    Force verify
                  </button>
                )}
                <button
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() => void review(row.id, "rejected")}
                  className="rounded border px-3 py-2 text-xs font-bold"
                  style={{ borderColor: "oklch(0.55 0.18 25)", color: "oklch(0.75 0.16 25)" }}
                >
                  Reject
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
