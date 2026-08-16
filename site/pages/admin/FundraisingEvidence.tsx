import { useState } from "react";
import { Helmet } from "react-helmet-async";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";

type Decision = "verified" | "rejected";

export default function FundraisingEvidence() {
  const utils = trpc.useUtils();
  const pending = trpc.outreach.pendingFundraisingEvidence.useQuery({ limit: 50 });
  const review = trpc.outreach.reviewFundraisingEvidence.useMutation({
    onSuccess: () => utils.outreach.pendingFundraisingEvidence.invalidate(),
  });
  const [notes, setNotes] = useState<Record<number, string>>({});

  const decide = (outcomeId: number, decision: Decision) => {
    const reviewNote = notes[outcomeId]?.trim();
    if (reviewNote && reviewNote.length < 8) {
      alert("Review note must be at least 8 characters or left empty");
      return;
    }
    review.mutate({ outcomeId, decision, ...(reviewNote ? { reviewNote } : {}) });
  };

  return (
    <DashboardLayout>
      <Helmet><title>Fundraising Evidence — Pythh.ai</title></Helmet>
      <div className="mb-6">
        <h1 className="text-xl font-bold">Fundraising Evidence</h1>
        <p className="text-xs mt-1" style={{ color: "oklch(0.5 0.01 264)" }}>
          Verify only evidence that demonstrates diligence, a term sheet, or committed capital. A verified decision becomes model-evaluation evidence; it does not change live ranking.
        </p>
      </div>

      {pending.isLoading && <p className="text-sm">Loading pending evidence…</p>}
      {pending.error && <p className="text-sm text-red-400">Unable to load evidence: {pending.error.message}</p>}
      {!pending.isLoading && !pending.error && pending.data?.length === 0 && (
        <div className="rounded-lg border p-6 text-sm" style={{ borderColor: "oklch(0.22 0.01 264)" }}>No evidence is waiting for review.</div>
      )}

      <div className="grid gap-4">
        {(pending.data ?? []).map((item) => {
          const metadata = (item.metadata ?? {}) as Record<string, unknown>;
          const evidenceUrl = typeof metadata.evidence_url === "string" ? metadata.evidence_url : null;
          return (
            <article key={item.id} className="rounded-lg border p-4" style={{ borderColor: "oklch(0.22 0.01 264)", background: "oklch(0.15 0.01 264)" }}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-bold">{item.eventType.replaceAll("_", " ")}</div>
                  <div className="mt-1 text-[11px] font-mono" style={{ color: "oklch(0.5 0.01 264)" }}>
                    Outcome #{item.id} · run {item.runId} · startup {item.startupId ?? "missing"} · investor {item.investorId ?? "missing"}
                  </div>
                </div>
                <div className="text-[11px]" style={{ color: "oklch(0.5 0.01 264)" }}>{new Date(item.occurredAt).toLocaleString()}</div>
              </div>
              {typeof metadata.note === "string" && <p className="mt-3 text-sm whitespace-pre-wrap">{metadata.note}</p>}
              {evidenceUrl && <a className="mt-2 inline-block text-xs" href={evidenceUrl} target="_blank" rel="noreferrer" style={{ color: "oklch(0.8 0.16 162)" }}>Open submitted evidence ↗</a>}
              {typeof metadata.amount_usd === "number" && <div className="mt-2 text-sm font-mono">${metadata.amount_usd.toLocaleString()} committed</div>}
              <textarea
                className="mt-4 w-full rounded-md border bg-transparent p-2 text-xs"
                style={{ borderColor: "oklch(0.25 0.01 264)" }}
                placeholder="Optional audit note (recommended for rejection)"
                value={notes[item.id] ?? ""}
                onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))}
              />
              <div className="mt-3 flex gap-2">
                <button disabled={review.isPending} onClick={() => decide(item.id, "verified")} className="rounded px-3 py-2 text-xs font-bold" style={{ background: "oklch(0.7 0.17 162)", color: "oklch(0.13 0.01 264)" }}>Verify evidence</button>
                <button disabled={review.isPending} onClick={() => decide(item.id, "rejected")} className="rounded border px-3 py-2 text-xs font-bold" style={{ borderColor: "oklch(0.55 0.18 25)", color: "oklch(0.75 0.16 25)" }}>Reject</button>
              </div>
            </article>
          );
        })}
      </div>
    </DashboardLayout>
  );
}
