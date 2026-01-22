import React, { useEffect, useState } from "react";

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

type EngineStatus = {
  tiles: HealthTile[];
  timestamp: string;
};

type EventsResponse = {
  events: EventRow[];
  total: number;
  timestamp: string;
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
  const [status, setStatus] = useState<EngineStatus | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEngineData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchEngineData, 30000);
    return () => clearInterval(interval);
  }, []);

  async function fetchEngineData() {
    try {
      const [statusRes, eventsRes] = await Promise.all([
        fetch('http://localhost:3002/api/engine/status'),
        fetch('http://localhost:3002/api/events?limit=20')
      ]);

      if (!statusRes.ok || !eventsRes.ok) {
        throw new Error('API request failed');
      }

      const statusData: EngineStatus = await statusRes.json();
      const eventsData: EventsResponse = await eventsRes.json();

      setStatus(statusData);
      setEvents(eventsData.events);
      setError(null);
    } catch (err) {
      console.error('[Engine] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-white/60">Loading engine status...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 p-6">
        <div className="text-sm font-semibold text-rose-200">Connection Error</div>
        <div className="mt-2 text-sm text-rose-300/80">
          {error}
        </div>
        <button
          onClick={fetchEngineData}
          className="mt-4 px-4 py-2 rounded-lg border border-rose-400/30 bg-rose-400/20 text-rose-200 hover:bg-rose-400/30 transition"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <header className="mb-6">
        <div className="text-[12px] uppercase tracking-wider text-white/45">
          Engine status
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Command Center</h1>
        <div className="mt-2 text-sm text-white/60">
          Live telemetry from scraper, scoring, matching, and ML systems.
        </div>
      </header>

      {/* Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {status?.tiles.map((t) => (
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
            <div className="text-xs text-white/45">Auto-refreshes every 30s · Last update: {status?.timestamp ? new Date(status.timestamp).toLocaleTimeString() : 'unknown'}</div>
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

      {/* Wiring note */}
      <div className="mt-6 text-sm text-white/60">
        ✅ Phase B: Wired to <span className="text-white/80 font-semibold">ai_logs</span> table · Auto-refresh: 30s
      </div>
    </div>
  );
}
