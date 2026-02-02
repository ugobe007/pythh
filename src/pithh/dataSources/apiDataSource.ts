/**
 * PRODUCTION API DATASOURCE
 * =========================
 *
 * Complete implementation with:
 * - AbortController per request + timeout
 * - Safe JSON parsing (no crashes on bad responses)
 * - HTTP error handling + status codes
 * - Normalized error shapes: { ok: false, reason, status? }
 * - Timing logs: [PYTHH:api:operation] with ms duration
 * - No merge logic (that's elsewhere in modeGuards/mergeHelpers)
 *
 * Drop-in replacement for FakeDataSource.
 */

import type {
  UUID,
  ResolveStartupRequest,
  ResolveStartupResponse,
  CreateScanRequest,
  CreateScanResponse,
  GetScanResponse,
  TrackingUpdateResponse,
  AlertSubscribeRequest,
  AlertSubscribeResponse,
} from "../types";

/**
 * DataSource interface (what SignalRadarPage expects)
 */
export interface DataSource {
  resolveStartup(req: ResolveStartupRequest): Promise<ResolveStartupResponse>;
  createScan(req: CreateScanRequest): Promise<CreateScanResponse>;
  pollScan(scan_id: UUID): Promise<GetScanResponse>;
  pollTracking(startup_id: UUID, cursor?: string): Promise<TrackingUpdateResponse>;
  subscribe(req: AlertSubscribeRequest): Promise<AlertSubscribeResponse>;
}

type ApiErrorShape = {
  ok: false;
  reason: string;
  status?: number;
};

function nowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function joinUrl(baseUrl: string, path: string): string {
  const b = baseUrl.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

function safeJsonParse<T>(text: string): { ok: true; value: T } | { ok: false; err: string } {
  try {
    return { ok: true, value: JSON.parse(text) as T };
  } catch (e: any) {
    return { ok: false, err: e?.message ?? "invalid_json" };
  }
}

function normalizeFailure(reason: string, status?: number): ApiErrorShape {
  return { ok: false, reason, status };
}

function log(op: string, msg: string, extra?: Record<string, any>) {
  if (extra) console.log(`[PYTHH:api:${op}] ${msg}`, extra);
  else console.log(`[PYTHH:api:${op}] ${msg}`);
}

/**
 * Production-ready API datasource
 * Implements all 5 endpoints with error recovery
 */
export class ApiDataSource implements DataSource {
  private baseUrl: string;
  private timeoutMs: number;

  constructor(baseUrl: string, timeoutMs = 10000) {
    this.baseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
    this.timeoutMs = timeoutMs;
    log("init", `ApiDataSource initialized at ${this.baseUrl} (timeout: ${timeoutMs}ms)`);
  }

  async resolveStartup(req: ResolveStartupRequest): Promise<ResolveStartupResponse> {
    return this.requestJson<ResolveStartupResponse>("resolveStartup", "POST", "/api/v1/startups/resolve", req);
  }

  async createScan(req: CreateScanRequest): Promise<CreateScanResponse> {
    return this.requestJson<CreateScanResponse>("createScan", "POST", "/api/v1/scans", req);
  }

  async pollScan(scan_id: UUID): Promise<GetScanResponse> {
    const path = `/api/v1/scans/${encodeURIComponent(scan_id)}`;
    return this.requestJson<GetScanResponse>("pollScan", "GET", path);
  }

  async pollTracking(startup_id: UUID, cursor?: string): Promise<TrackingUpdateResponse> {
    const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
    const path = `/api/v1/startups/${encodeURIComponent(startup_id)}/tracking${qs}`;
    return this.requestJson<TrackingUpdateResponse>("pollTracking", "GET", path);
  }

  async subscribe(req: AlertSubscribeRequest): Promise<AlertSubscribeResponse> {
    return this.requestJson<AlertSubscribeResponse>("subscribe", "POST", "/api/v1/alerts/subscribe", req);
  }

  /**
   * Core HTTP request helper with error recovery + timing
   */
  private async requestJson<T extends { ok: boolean; reason?: string }>(
    op: string,
    method: "GET" | "POST",
    path: string,
    body?: any
  ): Promise<T> {
    const url = joinUrl(this.baseUrl, path);
    const start = nowMs();

    // AbortController per request + timeout gate
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), this.timeoutMs);

    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    let payload: string | undefined;

    if (method === "POST") {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body ?? {});
    }

    log(op, `${method} ${path}`);

    try {
      const res = await fetch(url, {
        method,
        headers,
        body: payload,
        signal: controller.signal,
      });

      const ms = Math.round(nowMs() - start);
      const text = await res.text();

      // Safe parse
      const parsed = text ? safeJsonParse<T>(text) : { ok: true as const, value: ({ ok: res.ok } as unknown as T) };

      if (!res.ok) {
        // Prefer server-provided reason
        const serverReason =
          parsed.ok && typeof (parsed.value as any)?.reason === "string"
            ? String((parsed.value as any).reason)
            : `http_${res.status}`;

        log(op, `${method} ${path} → HTTP ${res.status} in ${ms}ms`, { reason: serverReason });
        return normalizeFailure(serverReason, res.status) as unknown as T;
      }

      if (!parsed.ok) {
        log(op, `${method} ${path} → parse error in ${ms}ms`, { err: parsed.err });
        return normalizeFailure("bad_json", res.status) as unknown as T;
      }

      // Success: ensure ok:true
      const result = parsed.value as any;
      if (typeof result.ok !== "boolean") {
        result.ok = true;
      }

      log(op, `${method} ${path} → OK in ${ms}ms`);
      return result as T;
    } catch (e: any) {
      const ms = Math.round(nowMs() - start);

      if (e?.name === "AbortError") {
        log(op, `${method} ${path} → TIMEOUT in ${ms}ms`);
        return normalizeFailure("timeout", 0) as unknown as T;
      }

      const errMsg = e?.message ?? "network_error";
      log(op, `${method} ${path} → NETWORK ERROR in ${ms}ms`, { error: errMsg });
      return normalizeFailure("network_error", 0) as unknown as T;
    } finally {
      window.clearTimeout(timeout);
    }
  }
}

/**
 * Factory helper
 */
export function createApiDataSource(baseUrl: string): DataSource {
  return new ApiDataSource(baseUrl);
}
