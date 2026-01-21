import { useEffect, useState } from "react";
import {
  PythhResponse,
  assertPythhResponse,
} from "../contracts/pythh.contract";

/**
 * usePythhResults — Contract-enforced /results loader
 * ====================================================
 * This hook is constitutionally bound to pythh.contract.ts.
 * 
 * It will HARD FAIL if the backend returns an invalid shape.
 * This prevents silent UI corruption.
 * 
 * Usage:
 *   const { data, error, loading } = usePythhResults(url);
 *   if (data) {
 *     // Render from data.top5, data.misaligned, etc.
 *   }
 */
export function usePythhResults(url: string) {
  const [data, setData] = useState<PythhResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!url) return;

    let aborted = false;

    async function fetchResults() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/pythh?url=${encodeURIComponent(url)}`);
        const json = await res.json();

        // HARD CONTRACT ASSERTION
        // This will throw if the response doesn't match PythhResponse v1.0
        assertPythhResponse(json, "Frontend PythhResponse");

        if (!aborted) {
          setData(json);
        }
      } catch (err: any) {
        console.error("Pythh fetch error:", err);
        if (!aborted) {
          setError(
            err?.message ||
              "Capital alignment service returned an invalid response."
          );
        }
      } finally {
        if (!aborted) {
          setLoading(false);
        }
      }
    }

    fetchResults();

    return () => {
      aborted = true;
    };
  }, [url]);

  return { data, error, loading };
}

/**
 * usePythhResultsWithRetry — Same as above but with retry logic
 * =============================================================
 * Use this when you want automatic retries on transient failures.
 */
export function usePythhResultsWithRetry(url: string, maxRetries = 3) {
  const [data, setData] = useState<PythhResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [retryCount, setRetryCount] = useState<number>(0);

  useEffect(() => {
    if (!url) return;

    let aborted = false;

    async function fetchWithRetry(attempt: number) {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/pythh?url=${encodeURIComponent(url)}`);
        const json = await res.json();

        // HARD CONTRACT ASSERTION
        assertPythhResponse(json, "Frontend PythhResponse");

        if (!aborted) {
          setData(json);
          setRetryCount(0);
        }
      } catch (err: any) {
        console.error(`Pythh fetch error (attempt ${attempt}):`, err);
        
        if (!aborted) {
          if (attempt < maxRetries) {
            setRetryCount(attempt + 1);
            // Exponential backoff
            setTimeout(() => fetchWithRetry(attempt + 1), Math.pow(2, attempt) * 1000);
          } else {
            setError(
              err?.message ||
                "Capital alignment service returned an invalid response."
            );
          }
        }
      } finally {
        if (!aborted && retryCount >= maxRetries) {
          setLoading(false);
        }
      }
    }

    fetchWithRetry(0);

    return () => {
      aborted = true;
    };
  }, [url, maxRetries]);

  return { data, error, loading, retryCount };
}
