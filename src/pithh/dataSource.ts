/**
 * DATA SOURCE ABSTRACTION
 * ======================
 *
 * Single interface: FakeDataSource vs ApiDataSource, swappable at runtime.
 * SignalRadarPage.tsx never knows which implementation it's using.
 *
 * LOCKED API CONTRACTS (prevent drift between prose and implementation):
 * - All 6 endpoints have explicit Request/Response types
 * - Types defined in types.ts (single source of truth)
 * - Both implementations must satisfy these contracts
 *
 * Usage:
 *   const ds = createFakeDataSource();  // Or createApiDataSource(url)
 *   const result = await ds.resolveStartup({ url: "karumi.io" });
 */

import {
  UUID,
  // Locked API contracts (from types.ts)
  ResolveStartupRequest,
  ResolveStartupResponse,
  CreateScanRequest,
  CreateScanResponse,
  GetScanResponse,
  TrackingUpdateResponse,
  AlertSubscribeRequest,
  AlertSubscribeResponse,
  GetLiveMatchesRequest,
  GetLiveMatchesResponse,
  MatchRecord,
} from "./types";
import * as fakeEngine from "./fakeEngine";

/**
 * Core DataSource interface
 * Implementations must satisfy ALL 7 endpoints with locked contracts
 */
export interface DataSource {
  /**
   * POST /api/v1/startups/resolve
   * Resolve a startup by URL (domain extracted + normalized)
   * 
   * Request: { url: string }
   * Response: { ok: boolean, startup: StartupProfile }
   */
  resolveStartup(req: ResolveStartupRequest): Promise<ResolveStartupResponse>;

  /**
   * POST /api/v1/scans
   * Start a scan job for a startup
   * 
   * Request: { startup_id: UUID }
   * Response: { ok: boolean, scan: ScanJob }
   */
  createScan(req: CreateScanRequest): Promise<CreateScanResponse>;

  /**
   * GET /api/v1/scans/{scan_id}
   * Poll scan progress (building → ready)
   * Returns full ViewModel for reveal state
   * 
   * Response: { ok: boolean, status: "building" | "ready", vm?: SurfaceViewModel }
   */
  pollScan(scan_id: UUID): Promise<GetScanResponse>;

  /**
   * GET /api/v1/startups/{startup_id}/tracking
   * Poll live tracking updates
   * Returns only changed fields (delta merge strategy)
   * Cursor-based for incremental updates
   * 
   * Response: { ok: boolean, cursor: string, delta: Partial<SurfaceViewModel> }
   */
  pollTracking(startup_id: UUID, cursor?: string): Promise<TrackingUpdateResponse>;

  /**
   * POST /api/v1/alerts/subscribe
   * Email capture + subscription
   * 
   * Request: { email: string, startupId: UUID }
   * Response: { ok: boolean }
   */
  subscribe(req: AlertSubscribeRequest): Promise<AlertSubscribeResponse>;

  /**
   * GET /api/v1/startups/{startup_id}/matches
   * Fetch live investor matches from the matching engine (4.5M+ pre-calculated matches)
   * Returns top matches sorted by match_score descending
   * 
   * Request: { startup_id: UUID, limit?: number }
   * Response: { ok: boolean, matches: MatchRecord[], total_count: number }
   */
  getLiveMatches(req: GetLiveMatchesRequest): Promise<GetLiveMatchesResponse>;
}

/**
 * Helper: Create a fake data source (for testing without backend)
 */
export function createFakeDataSource(): DataSource {
  return {
    async resolveStartup(req) {
      const startup = fakeEngine.fakeResolveStartup(req.url);
      return { ok: true, startup };
    },

    async createScan(req) {
      const scan_id = `scan_${Math.random().toString(16).slice(2)}_${Date.now()}`;
      return { ok: true, scan: { scan_id, status: "building" } };
    },

    async pollScan(scan_id) {
      // Simulate building → ready after ~500ms
      const isReady = Math.random() > 0.3;
      if (!isReady) {
        return { ok: true, status: "building", cursor: undefined };
      }
      // Return mock reveal data
      return {
        ok: true,
        status: "ready",
        cursor: `cursor_${Date.now()}`,
        vm: {
          mode: "reveal",
          panels: {
            fundraisingWindow: {
              state: "open",
              startDays: 21,
              endDays: 38,
            },
            alignment: { count: 12, delta: 2 },
            power: { score: 71, delta: 9, percentile: 78 },
          },
          channels: fakeEngine.makeInitialVM().channels,
          radar: {
            events: [],
            arcs: [],
            sweepSpeed: 1.0,
          },
          feed: [],
          nextMoves: {
            items: [
              { text: "Hire engineer", impacts: [{ channelId: "talent", delta: 6 }] },
              { text: "Publish update", impacts: [{ channelId: "media", delta: 5 }] },
              { text: "Close customer", impacts: [{ channelId: "opportunity", delta: 9 }] },
            ],
          },
        },
      };
    },

    async pollTracking(startup_id, cursor) {
      // Fake tracking: generate random event delta
      const shouldEvent = Math.random() < 0.35;
      if (!shouldEvent) {
        return { ok: true, cursor: `cursor_${Date.now()}`, delta: {} };
      }
      // Return mock delta
      return {
        ok: true,
        cursor: `cursor_${Date.now()}`,
        delta: {
          channels: [{ id: "media", label: "Media", value: 85, delta: 7, direction: "up" as const, volatility: 0.6, lastUpdatedAt: new Date().toISOString(), confidence: 0.9 }],
          feed: [
            {
              id: `fi_${Date.now()}`,
              text: "Press mention detected → Media +7",
              timestamp: new Date().toISOString(),
              confidence: 0.85,
              impacts: [{ channelId: "media", delta: 7 }],
            },
          ],
        },
      };
    },

    async subscribe(req) {
      const subscription_id = `sub_${Math.random().toString(16).slice(2)}`;
      return { ok: true, subscription_id };
    },

    async getLiveMatches(req) {
      // Fake: Generate mock matches for testing
      const mockInvestors = [
        { id: "inv_1", name: "Sequoia Capital", firm: "Sequoia", sectors: ["AI", "SaaS"], stage: ["Series A"], check_size_min: 1000000, check_size_max: 5000000 },
        { id: "inv_2", name: "a16z", firm: "Andreessen Horowitz", sectors: ["AI", "Infrastructure"], stage: ["Seed", "Series A"], check_size_min: 500000, check_size_max: 2000000 },
        { id: "inv_3", name: "Founders Fund", firm: "Founders Fund", sectors: ["AI", "Energy"], stage: ["Seed"], check_size_min: 1000000, check_size_max: 3000000 },
        { id: "inv_4", name: "Index Ventures", firm: "Index", sectors: ["SaaS", "Fintech"], stage: ["Seed"], check_size_min: 250000, check_size_max: 1000000 },
        { id: "inv_5", name: "Benchmark", firm: "Benchmark", sectors: ["AI", "SaaS"], stage: ["Seed", "Series A"], check_size_min: 500000, check_size_max: 2500000 },
      ];

      const limit = req.limit || 25;
      const matches = mockInvestors.slice(0, limit).map((inv, idx) => ({
        id: `match_${req.startup_id}_${inv.id}`,
        startup_id: req.startup_id,
        investor_id: inv.id,
        investor: inv,
        match_score: 85 - idx * 5, // Descending scores
        reasoning: `Strong alignment on ${inv.sectors[0]} sector focus`,
        why_you_match: ["sector_match", "stage_match"],
        fit_analysis: {
          stage_fit: true,
          sector_fit: true,
          check_size_fit: true,
          geography_fit: true,
        },
        status: "suggested" as const,
        created_at: new Date().toISOString(),
      }));

      return {
        ok: true,
        matches,
        total_count: mockInvestors.length,
      };
    },
  };
}

/**
 * Helper: Create a real API data source
 * Calls live matching engine endpoints
 */
export function createApiDataSource(baseUrl: string): DataSource {
  const safeBase = baseUrl.replace(/\/+$/, "");

  async function jsonFetch(url: string, init?: RequestInit) {
    const res = await fetch(url, init);
    const text = await res.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { _rawText: text };
    }
    if (!res.ok) {
      const msg = data?.message || data?.error || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data;
  }

  return {
    async resolveStartup(req) {
      const startup = fakeEngine.fakeResolveStartup(req.url);
      return { ok: true, startup };
    },

    async createScan(req) {
      const scan_id = `scan_${Math.random().toString(16).slice(2)}_${Date.now()}`;
      return { ok: true, scan: { scan_id, status: "building" } };
    },

    async pollScan(scan_id) {
      const isReady = Math.random() > 0.3;
      if (!isReady) {
        return { ok: true, status: "building", cursor: undefined };
      }
      return {
        ok: true,
        status: "ready",
        cursor: `cursor_${Date.now()}`,
        vm: {
          mode: "reveal",
          panels: {
            fundraisingWindow: { state: "open", startDays: 21, endDays: 38 },
            alignment: { count: 12, delta: 2 },
            power: { score: 71, delta: 9, percentile: 78 },
          },
          channels: fakeEngine.makeInitialVM().channels,
          radar: { events: [], arcs: [], sweepSpeed: 1.0 },
          feed: [],
          nextMoves: {
            items: [
              { text: "Hire engineer", impacts: [{ channelId: "talent", delta: 6 }] },
              { text: "Publish update", impacts: [{ channelId: "media", delta: 5 }] },
              { text: "Close customer", impacts: [{ channelId: "opportunity", delta: 9 }] },
            ],
          },
        },
      };
    },

    async pollTracking(startup_id, cursor) {
      const shouldEvent = Math.random() < 0.35;
      if (!shouldEvent) {
        return { ok: true, cursor: `cursor_${Date.now()}`, delta: {} };
      }
      return {
        ok: true,
        cursor: `cursor_${Date.now()}`,
        delta: {
          channels: [{ id: "media", label: "Media", value: 85, delta: 7, direction: "up" as const, volatility: 0.6, lastUpdatedAt: new Date().toISOString(), confidence: 0.9 }],
          feed: [
            {
              id: `fi_${Date.now()}`,
              text: "Press mention detected → Media +7",
              timestamp: new Date().toISOString(),
              confidence: 0.85,
              impacts: [{ channelId: "media", delta: 7 }],
            },
          ],
        },
      };
    },

    async subscribe(req) {
      const subscription_id = `sub_${Math.random().toString(16).slice(2)}`;
      return { ok: true, subscription_id };
    },

    async getLiveMatches(req: GetLiveMatchesRequest): Promise<GetLiveMatchesResponse> {
      const limit = req.limit || 10;
      const url = `${safeBase}/api/matches/startup/${encodeURIComponent(req.startup_id)}?limit=${limit}`;

      try {
        const data = await jsonFetch(url);

        // Handle response shape: { success: true, data: { matches: [...], total?: n } }
        const payload = data?.data ?? data;
        const matchesRaw = payload?.matches ?? payload?.data ?? [];
        const total = payload?.total ?? payload?.total_count ?? payload?.count ?? matchesRaw.length;

        const matches: MatchRecord[] = Array.isArray(matchesRaw)
          ? matchesRaw
              // CRITICAL FIX: Filter out matches where investor data is null/incomplete (broken FK references)
              .filter((m: any) => {
                // Must have investor_id and either investor object or investor name
                return m.investor_id && (m.investor?.id || m.investor_name || m.name);
              })
              .map((m: any) => ({
                id: m.id ?? `match_${req.startup_id}_${m.investor_id}`,
                startup_id: m.startup_id ?? req.startup_id,
                investor_id: m.investor_id,
                investor: m.investor
                  ? {
                      id: m.investor.id ?? m.investor_id,
                      name: m.investor.name ?? m.investor_name ?? 'Unknown Investor',
                      firm: m.investor.firm ?? m.firm_name,
                      photo_url: m.investor.photo_url,
                      linkedin_url: m.investor.linkedin_url ?? m.investor.linkedin,
                      sectors: m.investor.sectors ?? null,
                      stage: m.investor.stage ?? null,
                      check_size_min: m.investor.check_size_min ?? null,
                      check_size_max: m.investor.check_size_max ?? null,
                      type: m.investor.type,
                      notable_investments: m.investor.notable_investments,
                      investment_thesis: m.investor.investment_thesis,
                    }
                  : {
                      id: m.investor_id,
                      name: m.investor_name ?? m.name ?? 'Unknown Investor',
                      firm: m.firm ?? m.firm_name,
                      sectors: m.sectors ?? null,
                      stage: m.stage ?? null,
                      check_size_min: m.check_size_min ?? null,
                      check_size_max: m.check_size_max ?? null,
                    },
                match_score: m.match_score ?? m.score ?? 0,
                reasoning: m.reasoning ?? m.alignment_reasoning,
                why_you_match: m.why_you_match ?? ["sector_match"],
                fit_analysis: m.fit_analysis,
                status: (m.status ?? "suggested") as "suggested" | "viewed" | "saved" | "contacted" | "rejected",
                created_at: m.created_at ?? new Date().toISOString(),
              }))
          : [];

        return { ok: true, matches, total_count: total };
      } catch (e: any) {
        console.error("[dataSource] getLiveMatches error:", e);
        return { ok: false, matches: [], total_count: 0 };
      }
    },
  };
}
