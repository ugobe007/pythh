import React, { useMemo } from "react";

type HealthTile = {
  label: string;
  status: "ok" | "warn" | "down";
  primary: string;
  secondary: string;
};

type EventRow = {
  ts: string;
  type: string;
  action: string;
  status: "ok" | "warn" | "error";
  note: string;
};

function StatusDot({ status }: { status: HealthTile["status"] }) {
  const cls =
    status === "ok"
      ? "bg-emerald-400"
      : status === "warn"
      ? "bg-amber-400"
      : "bg-rose-400";
  return <span className={`inline-block h-2 w-2 rounded-full ${cls}`} />;
}

function Badge({ status }: { status: EventRow["status"] }) {
  const cls =
    status === "ok"
      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
      : status === "warn"
      ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
      : "border-rose-400/30 bg-rose-400/10 text-rose-200";
  return (
    <span className={`text-[11px] px-2 py-1 rounded-md border ${cls}`}>
      {status.toUpperCase()}
    </span>
  );
}

export default function Engine() {
  const tiles: HealthTile[] = useMemo(
    () => [
      {
        label: "Scraper",
        status: "ok",
        primary: "Throughput: 42/min",
        secondary: "Queue: 118 · Error rate: 0.8% · Last ok: 2m ago",
      },
      {
        label: "GOD Scoring",
        status: "ok",
        primary: "Recalc: 1,284 startups / 24h",
        secondary: "Last run: 6m ago · Drift: none detected",
      },
      {
        label: "Matching",
        status: "warn",
        primary: "Generated: 9,410 matches / 24h",
        secondary: "Coverage: 71% · Guardian triggered regen: 1h ago",
      },
      {
        label: "ML Learning",
        status: "ok",
        primary: "Model: v0.7 · Train set: 182k",
        secondary: "Last train: 9h ago · Feature deltas: stable",
      },
    ],
    []
  );

  const events: EventRow[] = useMemo(
    () => [
      {
        ts: "2026-01-21 14:08:12",
        type: "scrape",
        action: "mega-scraper tick",
        status: "ok",
        note: "fetched 38 sources · parsed 112 items",
      },
      {
        ts: "2026-01-21 14:01:03",
        type: "score",
        action: "score-recalculator run",
        status: "ok",
        note: "updated 86 startups · 14 changed materially",
      },
      {
        ts: "2026-01-21 13:58:47",
        type: "guardian",
        action: "health check",
        status: "warn",
        note: "matching coverage dipped below threshold",
      },
      {
        ts: "2026-01-21 13:58:52",
        type: "match",
        action: "match-regenerator trigger",
        status: "ok",
        note: "regenerated 1,120 matches for affected cohort",
      },
      {
        ts: "2026-01-21 13:50:10",
        type: "ml",
        action: "training ingest",
        status: "ok",
        note: "ingested 2,409 labeled outcomes",
      },
    ],
    []
  );

  return (
    <div>
      <header className="mb-6">
        <div className="text-[12px] uppercase tracking-wider text-white/45">
          Engine status
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Command Center</h1>
        <div className="mt-2 text-sm text-white/60">
          You should always know what the scraper, scoring, matching, and learning systems are doing.
        </div>
      </header>

      {/* Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {tiles.map((t) => (
          <div
            key={t.label}
            className="rounded-2xl border border-white/10 bg-white/5 p-5"
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-white/85">{t.label}</div>
              <StatusDot status={t.status} />
            </div>
            <div className="mt-3 text-lg font-semibold text-white/90">{t.primary}</div>
            <div className="mt-2 text-sm text-white/60">{t.secondary}</div>
          </div>
        ))}
      </div>

      {/* Event stream */}
      <div className="mt-8 rounded-2xl border border-white/10 bg-white/5">
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-white/85">Recent engine events</div>
            <div className="text-xs text-white/45">Mocked now · wire to ai_logs in Phase B</div>
          </div>
          <div className="text-xs text-white/40">types: scrape · score · match · ml · guardian</div>
        </div>

        <div className="border-t border-white/10">
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="text-white/50">
                <tr className="border-b border-white/10">
                  <th className="text-left font-medium px-5 py-3">Time</th>
                  <th className="text-left font-medium px-5 py-3">Type</th>
                  <th className="text-left font-medium px-5 py-3">Action</th>
                  <th className="text-left font-medium px-5 py-3">Status</th>
                  <th className="text-left font-medium px-5 py-3">Note</th>
                </tr>
              </thead>
              <tbody className="text-white/75">
                {events.map((e, idx) => (
                  <tr key={idx} className="border-b border-white/10 last:border-b-0">
                    <td className="px-5 py-3 whitespace-nowrap text-white/55">{e.ts}</td>
                    <td className="px-5 py-3 whitespace-nowrap">{e.type}</td>
                    <td className="px-5 py-3">{e.action}</td>
                    <td className="px-5 py-3"><Badge status={e.status} /></td>
                    <td className="px-5 py-3 text-white/60">{e.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Next wiring note */}
      <div className="mt-6 text-sm text-white/60">
        Phase B wiring targets: <span className="text-white/80 font-semibold">ai_logs</span> (event stream) and
        <span className="text-white/80 font-semibold"> system-guardian</span> (health summary).
      </div>
    </div>
  );
}
