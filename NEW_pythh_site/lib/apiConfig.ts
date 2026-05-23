/**
 * API base for NEW_pythh_site on pythh.ai (Vercel).
 * Prefer same-origin `/api/...` so vercel.json proxies to Fly — avoids CORS and keeps URLs on pythh.ai.
 */

const DEV_DEFAULT_API_BASE = "http://localhost:3002";

export function getApiBase(): string {
  let raw = (import.meta.env.VITE_API_URL ?? "").trim();

  if (typeof window !== "undefined" && import.meta.env.PROD && raw) {
    try {
      const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
      if (u.hostname.endsWith(".fly.dev")) {
        const h = window.location.hostname;
        if (h === "pythh.ai" || h === "www.pythh.ai") {
          raw = "";
        }
      }
    } catch {
      /* ignore bad VITE_API_URL */
    }
  }

  if (raw) {
    if (import.meta.env.PROD && /localhost|127\.0\.0\.1/.test(raw)) {
      return "";
    }
    return raw.replace(/\/$/, "");
  }

  if (import.meta.env.DEV) {
    return DEV_DEFAULT_API_BASE.replace(/\/$/, "");
  }

  return "";
}

export function apiUrl(path: string): string {
  const base = getApiBase();
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}
