import { useEffect, useMemo, useState } from "react";
import type { InvestorsResponse } from "../types/investors";
import type { Mode } from "../types/snapshot";
import { fetchInvestors } from "../services/investors/client";

export function useInvestors(params: { startupId?: string; startupUrl?: string; mode: Mode }) {
  const { startupId, startupUrl, mode } = params;
  const key = useMemo(() => JSON.stringify({ startupId, startupUrl, mode }), [startupId, startupUrl, mode]);

  const [data, setData] = useState<InvestorsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    fetchInvestors({ startupId, startupUrl, mode })
      .then((r) => {
        if (!alive) return;
        setData(r);
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

  return { investors: data, loading, error };
}
