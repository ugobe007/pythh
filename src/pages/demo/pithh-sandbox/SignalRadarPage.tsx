import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { makeInitialVM, normalizeUrl } from "./fakeEngine";
import { DataSource, createApiDataSource, createFakeDataSource } from "./dataSource";
import { mergeViewModelDelta } from "./mergeHelpers";
import { SurfaceMode, SurfaceViewModel } from "./types";
import { getRuntimeConfig, type RuntimeConfig } from "./runtimeConfig";
import TopBar from "./components/TopBar";
import SignalTape from "./components/SignalTape";
import RightRail from "./components/RightRail";
import MatchEngineStrip from "./components/MatchEngineStrip";
import LiveMatchingStrip from "../components/LiveMatchingStrip";
import TopSignalStartups from "../components/TopSignalStartups";
import "./pithh.css";

type ScanCursor = string | null;

export default function SignalRadarPage() {
  const navigate = useNavigate();

  const [vm, setVm] = useState<SurfaceViewModel>(() => makeInitialVM());
  const [rawUrl, setRawUrl] = useState("");
  const [config, setConfig] = useState<RuntimeConfig | null>(null);

  // lifecycle
  const abortRef = useRef<AbortController | null>(null);
  const trackingTimerRef = useRef<number | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const liveMatchesTimerRef = useRef<number | null>(null);

  // datasource
  const dataSourceRef = useRef<DataSource>(createFakeDataSource());

  // scan state
  const cursorRef = useRef<ScanCursor>(null);
  const scanIdRef = useRef<string | null>(null);
  const startupIdRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);

  // live matches state
  const [liveMatchesLoading, setLiveMatchesLoading] = useState(false);

  const log = (op: string, msg: string, data?: unknown) => {
    console.log(`[PYTHH:${op}] ${msg}`, data ?? "");
  };

  function pushFeed(text: string, confidence: number) {
    setVm((prev) => ({
      ...prev,
      feed: [
        {
          id: `fi_${Date.now()}_${Math.random()}`,
          text,
          timestamp: new Date().toISOString(),
          confidence,
          impacts: [],
        },
        ...prev.feed,
      ].slice(0, 30),
    }));
  }

  function cleanup() {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    inFlightRef.current = false;

    if (trackingTimerRef.current) {
      window.clearInterval(trackingTimerRef.current);
      trackingTimerRef.current = null;
    }

    if (scanTimerRef.current) {
      window.clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }

    if (liveMatchesTimerRef.current) {
      window.clearInterval(liveMatchesTimerRef.current);
      liveMatchesTimerRef.current = null;
    }

    cursorRef.current = null;
    scanIdRef.current = null;
  }

  function setMode(next: SurfaceMode, reason: string) {
    log("mode", `${vm.mode} → ${next} (${reason})`);
    setVm((prev) => ({ ...prev, mode: next, pulseSeq: prev.pulseSeq + 1 }));
  }

  useEffect(() => {
    getRuntimeConfig().then((cfg) => {
      setConfig(cfg);
      log("init", `Datasource: ${cfg.mode} (${cfg.reason})`);

      if (cfg.mode === "api" && cfg.apiHealthy) {
        dataSourceRef.current = createApiDataSource(cfg.apiBase);
        pushFeed("[OK] API healthy. Ready for live scan.", 0.9);
      } else {
        dataSourceRef.current = createFakeDataSource();
        pushFeed("[GUARD] API unavailable. Running fake data.", 0.85);
      }

      // Start live matches polling (background, continuous)
      startLiveMatchesPoll();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startLiveMatchesPoll() {
    if (liveMatchesTimerRef.current) window.clearInterval(liveMatchesTimerRef.current);

    // Fetch immediately
    fetchLiveMatches();

    // Then poll every 30 seconds for updates
    liveMatchesTimerRef.current = window.setInterval(() => {
      fetchLiveMatches();
    }, 30000);
  }

  async function fetchLiveMatches() {
    // Only fetch if we have a startup ID in context (after URL submit)
    if (!startupIdRef.current) return;

    setLiveMatchesLoading(true);
    try {
      const res = await dataSourceRef.current.getLiveMatches({
        startup_id: startupIdRef.current,
        limit: 10,
      });

      if (res.ok && res.matches.length > 0) {
        setVm((prev) => {
          const hadMatches = prev.matches && prev.matches.length > 0;
          if (!hadMatches) {
            // First time showing matches - announce in feed
            pushFeed(
              `${res.total_count} investors aligned with your signals`,
              0.95
            );
          }
          return {
            ...prev,
            matches: res.matches,
            matchesTotal: res.total_count,
          };
        });
      }
    } catch (e) {
      log("matches", "fetch failed", e);
    } finally {
      setLiveMatchesLoading(false);
    }
  }

  function startTrackingPoll() {
    if (trackingTimerRef.current) window.clearInterval(trackingTimerRef.current);

    trackingTimerRef.current = window.setInterval(async () => {
      if (vm.mode !== "tracking") return;
      if (inFlightRef.current) return;
      if (!startupIdRef.current) return;

      inFlightRef.current = true;
      const ac = new AbortController();
      abortRef.current = ac;

      try {
        const res = await dataSourceRef.current.pollTracking(
          startupIdRef.current,
          cursorRef.current ?? undefined
        );

        if (res?.delta) {
          setVm((prev) => mergeViewModelDelta(prev, res.delta));
        }

        if (typeof res?.cursor === "string") cursorRef.current = res.cursor;
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        log("tracking", "poll failed", e);
        pushFeed("Temporary polling error. Retrying…", 0.7);
      } finally {
        inFlightRef.current = false;
      }
    }, 2500);
  }

  function startScanPoll(scanId: string) {
    if (scanTimerRef.current) window.clearInterval(scanTimerRef.current);

    scanTimerRef.current = window.setInterval(async () => {
      if (inFlightRef.current) return;
      if (!scanIdRef.current) return;

      inFlightRef.current = true;
      const ac = new AbortController();
      abortRef.current = ac;

      try {
        const res = await dataSourceRef.current.pollScan(scanId);

        if (!res.ok) {
          pushFeed(`Scan error: ${res.reason ?? "unknown"}`, 0.9);
          setMode("global", "Scan failed");
          cleanup();
          return;
        }

        if (res.status === "building") {
          return;
        }

        if (res.status === "failed") {
          pushFeed("Scan failed. Try again.", 0.95);
          setMode("global", "Scan failed");
          cleanup();
          return;
        }

        if (res.status === "ready") {
          if (res.vm) {
            setVm((prev) => {
              let next = mergeViewModelDelta(prev, res.vm ?? {});
              if (res.vm?.startup) next = { ...next, startup: res.vm.startup };
              return next;
            });
          }

          if (typeof res.cursor === "string") cursorRef.current = res.cursor;

          setMode("reveal", "Scan ready");
          pushFeed("Tracking started — live deltas will appear here.", 0.9);

          if (cursorRef.current) {
            setMode("tracking", "Begin tracking");
            startTrackingPoll();
          } else {
            pushFeed("No cursor returned from scan. Check datasource implementation.", 0.6);
          }

          if (scanTimerRef.current) {
            window.clearInterval(scanTimerRef.current);
            scanTimerRef.current = null;
          }
        }
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        log("scan", "poll failed", e);
        pushFeed("Temporary scan error. Retrying…", 0.7);
      } finally {
        inFlightRef.current = false;
      }
    }, 1500);
  }

  async function onSubmit() {
    const n = normalizeUrl(rawUrl);
    if (!n.ok) {
      pushFeed(`URL rejected: ${n.reason}`, 1.0);
      return;
    }

    cleanup();
    setMode("injecting", "User submitted URL");
    pushFeed(`Signal scan initiated for ${new URL(n.url).hostname.replace(/^www\./, "")}`, 1.0);

    inFlightRef.current = true;
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const resolved = await dataSourceRef.current.resolveStartup({ url: n.url });
      if (!resolved.ok || !resolved.startup) {
        throw new Error(resolved.reason ?? "Resolve failed");
      }

      const startup = resolved.startup;
      startupIdRef.current = startup.id;

      setVm((prev) => ({
        ...prev,
        startup,
        radar: {
          ...prev.radar,
          you: { initials: startup.initials, intensity: 0.9 },
          events: [],
          arcs: [],
          phaseChange: null,
        },
        pulseSeq: prev.pulseSeq + 1,
      }));

      pushFeed(`We found you: ${startup.name} • ${startup.category ?? ""} • ${startup.stage ?? ""}`, 1.0);

      pushFeed("Computing signals + investor alignment…", 0.95);

      const scan = await dataSourceRef.current.createScan({ startup_id: startup.id });
      if (!scan.ok || !scan.scan) {
        throw new Error(scan.reason ?? "Scan create failed");
      }

      scanIdRef.current = scan.scan.scan_id;
      startScanPoll(scan.scan.scan_id);
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      log("submit", "scan failed", e);
      setMode("global", "Failure");
      pushFeed(`Scan failed: ${e?.message ?? "unknown error"}`, 1.0);
    } finally {
      inFlightRef.current = false;
    }
  }

  function onReset() {
    cleanup();
    setRawUrl("");
    startupIdRef.current = null;
    setVm(makeInitialVM());
    pushFeed("Reset to global.", 0.9);
  }

  function navigateToSignalsContext() {
    navigate("/signals-context", {
      state: {
        startup_id: vm.startup?.id,
        cursor: cursorRef.current,
        power: vm.panels?.power,
        window: vm.panels?.fundraisingWindow,
        last_scan_time: new Date().toISOString(),
      },
    });
  }

  const statusBadge = useMemo(() => {
    if (vm.mode === "global") return "LIVE";
    if (vm.mode === "injecting") return "INJECTING";
    return "TRACKING YOU";
  }, [vm.mode]);

  return (
    <div className={`pithh ${vm.mode}`}>
      <TopBar status={statusBadge} subtitle="Watching capital alignment in real time" />

      <div className="injectBar">
        <div className="injectContent">
          <input
            type="text"
            value={rawUrl}
            onChange={(e) => setRawUrl(e.target.value)}
            placeholder="e.g., autoops.ai"
            className="injectInput"
            onKeyDown={(e) => {
              if (e.key === "Enter") onSubmit();
            }}
          />
          <button onClick={onSubmit} className="injectButton">
            Overlay Signals →
          </button>
          <button onClick={onReset} className="injectButton secondary">
            Reset
          </button>
        </div>

        <div className="injectSubtext">
          {vm.mode === "global"
            ? "See how your company aligns with live market signals"
            : "Tracking your signals overlay"}
          {config?.mode ? <span className="dsBadge">Datasource: {config.mode}</span> : null}
        </div>
      </div>

      {/* LIVE MATCHING STRIP: Auto-rotating proof of live matching */}
      <LiveMatchingStrip />

      {/* MATCH ENGINE STRIP: Live investor matches from the matching engine */}
      {vm.matches && vm.matches.length > 0 && (
        <MatchEngineStrip
          matches={vm.matches}
          totalCount={vm.matchesTotal || 0}
          loading={liveMatchesLoading}
          onViewAll={() => {
            if (vm.startup?.id) {
              navigate("/investor-matches", { state: { startup_id: vm.startup.id } });
            }
          }}
        />
      )}

      {/* Signal Tape - Full Width */}
      <div className="w-full">
        <SignalTape channels={vm.channels} latestFeed={vm.feed[0] ?? null} pulseSeq={vm.pulseSeq} />
      </div>

      {/* Top Signal Startups Table */}
      <div className="w-full px-6 py-12">
        <TopSignalStartups />
      </div>
    </div>
  );
}
