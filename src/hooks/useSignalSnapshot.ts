import { useEffect, useMemo, useState } from "react";
import type { Mode, SignalSnapshot } from "../types/snapshot";
import { computeSnapshot } from "../services/snapshot/client";

export function useSignalSnapshot(params: { startupUrl?: string; startupId?: string; mode: Mode }) {
  const { startupUrl, startupId, mode } = params;

  const key = useMemo(() => JSON.stringify({ startupUrl, startupId, mode }), [startupUrl, startupId, mode]);

  const [data, setData] = useState<SignalSnapshot | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    computeSnapshot({ startupUrl, startupId, mode })
      .then((snap) => {
        if (!alive) return;
        setData(snap);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Unknown error");
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [key]);

  return { snapshot: data, loading, error };
}
