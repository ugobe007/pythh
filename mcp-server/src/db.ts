/**
 * db.ts — Supabase query layer for Pythh Connect MCP
 *
 * All queries return live data — no caching of the dataset. Each result
 * includes `data_as_of` reflecting the record's last enrichment timestamp.
 * This is the structural advantage over static datasets: Pythh's scraping
 * pipeline updates the underlying tables continuously.
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import "dotenv/config";

let _sb: SupabaseClient | null = null;

function sb(): SupabaseClient {
  if (!_sb) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_KEY are required");
    _sb = createClient(url, key);
  }
  return _sb;
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function dataAsOf(row: Record<string, unknown>): string {
  const ts = (row.updated_at ?? row.matched_at ?? row.created_at ?? new Date().toISOString()) as string;
  return ts;
}

function normalizeSectors(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return [raw]; }
  }
  return [];
}

// ─── 1. search_startups ───────────────────────────────────────────────────────

export interface StartupRow {
  id: string;
  name: string;
  sectors: string[];
  stage: string | null;
  website: string | null;
  god_score: number;
  entity_gate: string;
  data_as_of: string;
}

export async function searchStartups(opts: {
  sector?: string;
  stage?: string;
  min_god_score?: number;
  max_god_score?: number;
  name?: string;
  limit?: number;
}): Promise<StartupRow[]> {
  const limit = Math.min(opts.limit ?? 10, 50);

  let q = sb()
    .from("startup_uploads")
    .select("id, name, sectors, stage, website, total_god_score, entity_gate, updated_at")
    .eq("entity_gate", "qualified")
    .order("total_god_score", { ascending: false })
    .limit(limit);

  if (opts.min_god_score !== undefined) q = q.gte("total_god_score", opts.min_god_score);
  if (opts.max_god_score !== undefined) q = q.lte("total_god_score", opts.max_god_score);
  if (opts.stage) q = q.ilike("stage", `%${opts.stage}%`);
  if (opts.name) q = q.ilike("name", `%${opts.name}%`);

  const { data, error } = await q;
  if (error) throw new Error(`searchStartups: ${error.message}`);

  let rows = (data ?? []) as Record<string, unknown>[];

  // Filter by sector client-side (JSONB array contains)
  if (opts.sector) {
    const s = opts.sector.toLowerCase();
    rows = rows.filter((r) =>
      normalizeSectors(r.sectors).some((sec) => sec.toLowerCase().includes(s))
    );
  }

  return rows.map((r) => ({
    id: String(r.id ?? ""),
    name: String(r.name ?? ""),
    sectors: normalizeSectors(r.sectors),
    stage: r.stage ? String(r.stage) : null,
    website: r.website ? String(r.website) : null,
    god_score: Number(r.total_god_score ?? 0),
    entity_gate: String(r.entity_gate ?? ""),
    data_as_of: dataAsOf(r),
  }));
}

// ─── 2. get_startup_profile ───────────────────────────────────────────────────

export interface StartupProfile extends StartupRow {
  god_team: number | null;
  god_traction: number | null;
  god_market: number | null;
  god_product: number | null;
  god_vision: number | null;
  god_grit: number | null;
  god_momentum: number | null;
  match_gen_status: string | null;
  match_gen_completed_at: string | null;
}

export async function getStartupProfile(id: string): Promise<StartupProfile | null> {
  const { data, error } = await sb()
    .from("startup_uploads")
    .select([
      "id", "name", "sectors", "stage", "website",
      "total_god_score", "entity_gate", "updated_at",
      "god_team", "god_traction", "god_market", "god_product",
      "god_vision", "god_grit", "god_momentum",
      "match_gen_status", "match_gen_completed_at",
    ].join(", "))
    .eq("id", id)
    .single();

  if (error || !data) return null;
  const r = data as unknown as Record<string, unknown>;
  return {
    id: String(r.id),
    name: String(r.name ?? ""),
    sectors: normalizeSectors(r.sectors),
    stage: r.stage ? String(r.stage) : null,
    website: r.website ? String(r.website) : null,
    god_score: Number(r.total_god_score ?? 0),
    entity_gate: String(r.entity_gate ?? ""),
    data_as_of: dataAsOf(r),
    god_team: r.god_team != null ? Number(r.god_team) : null,
    god_traction: r.god_traction != null ? Number(r.god_traction) : null,
    god_market: r.god_market != null ? Number(r.god_market) : null,
    god_product: r.god_product != null ? Number(r.god_product) : null,
    god_vision: r.god_vision != null ? Number(r.god_vision) : null,
    god_grit: r.god_grit != null ? Number(r.god_grit) : null,
    god_momentum: r.god_momentum != null ? Number(r.god_momentum) : null,
    match_gen_status: r.match_gen_status ? String(r.match_gen_status) : null,
    match_gen_completed_at: r.match_gen_completed_at ? String(r.match_gen_completed_at) : null,
  };
}

// ─── 3. search_investors ──────────────────────────────────────────────────────

export interface InvestorRow {
  id: string;
  name: string;
  firm: string | null;
  sectors: string[];
  investor_score: number;
  entity_gate: string;
  website: string | null;
  data_as_of: string;
}

export async function searchInvestors(opts: {
  sector?: string;
  min_score?: number;
  name?: string;
  firm?: string;
  limit?: number;
}): Promise<InvestorRow[]> {
  const limit = Math.min(opts.limit ?? 10, 50);

  let q = sb()
    .from("investors")
    .select("id, name, firm, sectors, investor_score, entity_gate, website, updated_at")
    .eq("entity_gate", "qualified")
    .order("investor_score", { ascending: false })
    .limit(limit);

  const minScore = opts.min_score ?? 30;
  q = q.gte("investor_score", minScore);

  if (opts.name) q = q.ilike("name", `%${opts.name}%`);
  if (opts.firm) q = q.ilike("firm", `%${opts.firm}%`);

  const { data, error } = await q;
  if (error) throw new Error(`searchInvestors: ${error.message}`);

  let rows = (data ?? []) as Record<string, unknown>[];

  if (opts.sector) {
    const s = opts.sector.toLowerCase();
    rows = rows.filter((r) =>
      normalizeSectors(r.sectors).some((sec) => sec.toLowerCase().includes(s))
    );
  }

  return rows.map((r) => ({
    id: String(r.id ?? ""),
    name: String(r.name ?? ""),
    firm: r.firm ? String(r.firm) : null,
    sectors: normalizeSectors(r.sectors),
    investor_score: Number(r.investor_score ?? 0),
    entity_gate: String(r.entity_gate ?? ""),
    website: r.website ? String(r.website) : null,
    data_as_of: dataAsOf(r),
  }));
}

// ─── 4. get_investor_profile ──────────────────────────────────────────────────

export interface InvestorProfile extends InvestorRow {
  url: string | null;
  stage_preference: string | null;
  check_size_min: number | null;
  check_size_max: number | null;
  portfolio_count: number | null;
}

export async function getInvestorProfile(opts: { id?: string; name?: string }): Promise<InvestorProfile | null> {
  let q = sb()
    .from("investors")
    .select([
      "id", "name", "firm", "sectors", "investor_score", "entity_gate",
      "website", "url", "stage_preference", "check_size_min", "check_size_max",
      "portfolio_count", "updated_at",
    ].join(", "))
    .limit(1);

  if (opts.id) {
    q = q.eq("id", opts.id);
  } else if (opts.name) {
    q = q.ilike("name", `%${opts.name}%`);
  } else {
    return null;
  }

  const { data, error } = await q;
  if (error || !data?.length) return null;
  const r = data[0] as unknown as Record<string, unknown>;

  return {
    id: String(r.id),
    name: String(r.name ?? ""),
    firm: r.firm ? String(r.firm) : null,
    sectors: normalizeSectors(r.sectors),
    investor_score: Number(r.investor_score ?? 0),
    entity_gate: String(r.entity_gate ?? ""),
    website: r.website ? String(r.website) : null,
    url: r.url ? String(r.url) : null,
    stage_preference: r.stage_preference ? String(r.stage_preference) : null,
    check_size_min: r.check_size_min != null ? Number(r.check_size_min) : null,
    check_size_max: r.check_size_max != null ? Number(r.check_size_max) : null,
    portfolio_count: r.portfolio_count != null ? Number(r.portfolio_count) : null,
    data_as_of: dataAsOf(r),
  };
}

// ─── 5. match_investors ───────────────────────────────────────────────────────

export interface InvestorMatch {
  investor_id: string;
  name: string;
  firm: string | null;
  sectors: string[];
  investor_score: number;
  sector_fit: "strong" | "adjacent" | "weak";
  website: string | null;
  data_as_of: string;
}

export async function matchInvestors(opts: {
  sector: string;
  stage?: string;
  min_investor_score?: number;
  limit?: number;
}): Promise<InvestorMatch[]> {
  const limit = Math.min(opts.limit ?? 15, 50);
  const minScore = opts.min_investor_score ?? 50;

  const { data, error } = await sb()
    .from("investors")
    .select("id, name, firm, sectors, investor_score, entity_gate, website, updated_at")
    .eq("entity_gate", "qualified")
    .gte("investor_score", minScore)
    .order("investor_score", { ascending: false })
    .limit(200);

  if (error) throw new Error(`matchInvestors: ${error.message}`);

  const sectorLower = opts.sector.toLowerCase();
  const rows = (data ?? []) as Record<string, unknown>[];

  const scored = rows
    .map((r) => {
      const sectors = normalizeSectors(r.sectors);
      const sectorStr = sectors.join(" ").toLowerCase();
      let fit: "strong" | "adjacent" | "weak" = "weak";
      if (sectorStr.includes(sectorLower)) fit = "strong";
      else if (isAdjacentSector(sectorLower, sectorStr)) fit = "adjacent";
      return { r, fit, score: Number(r.investor_score ?? 0) };
    })
    .filter(({ fit }) => fit !== "weak")
    .sort((a, b) => {
      const fitRank = { strong: 2, adjacent: 1, weak: 0 };
      if (fitRank[a.fit] !== fitRank[b.fit]) return fitRank[b.fit] - fitRank[a.fit];
      return b.score - a.score;
    })
    .slice(0, limit);

  return scored.map(({ r, fit }) => ({
    investor_id: String(r.id),
    name: String(r.name ?? ""),
    firm: r.firm ? String(r.firm) : null,
    sectors: normalizeSectors(r.sectors),
    investor_score: Number(r.investor_score ?? 0),
    sector_fit: fit,
    website: r.website ? String(r.website) : null,
    data_as_of: dataAsOf(r),
  }));
}

function isAdjacentSector(query: string, target: string): boolean {
  const adjacency: Record<string, string[]> = {
    fintech: ["payments", "banking", "insurance", "lending", "crypto", "blockchain", "wealthtech"],
    "ai/ml": ["machine learning", "deep learning", "nlp", "llm", "automation", "data"],
    saas: ["enterprise software", "b2b", "cloud", "platform"],
    "developer tools": ["devtools", "developer experience", "api", "infrastructure"],
    healthtech: ["medtech", "biotech", "digital health", "clinical"],
    climate: ["cleantech", "energy", "sustainability", "greentech"],
    cybersecurity: ["security", "privacy", "identity", "zero trust"],
    gaming: ["games", "esports", "metaverse", "virtual reality", "ar", "vr"],
  };
  const neighbors = adjacency[query] ?? [];
  return neighbors.some((n) => target.includes(n));
}

// ─── 6. get_market_signals ────────────────────────────────────────────────────

export interface MarketSignals {
  top_sectors: { sector: string; count: number; avg_god_score: number }[];
  high_momentum_startups: StartupRow[];
  network_last_updated: string;
  data_as_of: string;
}

export async function getMarketSignals(opts: { sector?: string } = {}): Promise<MarketSignals> {
  const { data: startups } = await sb()
    .from("startup_uploads")
    .select("name, sectors, total_god_score, stage, website, updated_at")
    .eq("entity_gate", "qualified")
    .gte("total_god_score", 60)
    .order("total_god_score", { ascending: false })
    .limit(500);

  const rows = (startups ?? []) as Record<string, unknown>[];

  // Aggregate sectors
  const sectorMap: Record<string, { count: number; total: number }> = {};
  for (const r of rows) {
    for (const sec of normalizeSectors(r.sectors)) {
      if (!sectorMap[sec]) sectorMap[sec] = { count: 0, total: 0 };
      sectorMap[sec].count++;
      sectorMap[sec].total += Number(r.total_god_score ?? 0);
    }
  }

  let topSectors = Object.entries(sectorMap)
    .map(([sector, { count, total }]) => ({
      sector,
      count,
      avg_god_score: Math.round(total / count),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Filter by sector if requested
  let filteredRows = rows;
  if (opts.sector) {
    const s = opts.sector.toLowerCase();
    filteredRows = rows.filter((r) =>
      normalizeSectors(r.sectors).some((sec) => sec.toLowerCase().includes(s))
    );
    topSectors = topSectors.filter((s2) => s2.sector.toLowerCase().includes(s));
  }

  const highMomentum: StartupRow[] = filteredRows.slice(0, 5).map((r) => ({
    id: "",
    name: String(r.name ?? ""),
    sectors: normalizeSectors(r.sectors),
    stage: r.stage ? String(r.stage) : null,
    website: r.website ? String(r.website) : null,
    god_score: Number(r.total_god_score ?? 0),
    entity_gate: "qualified",
    data_as_of: dataAsOf(r),
  }));

  const lastUpdated = rows[0] ? dataAsOf(rows[0]) : new Date().toISOString();

  return {
    top_sectors: topSectors,
    high_momentum_startups: highMomentum,
    network_last_updated: lastUpdated,
    data_as_of: new Date().toISOString(),
  };
}

// ─── 7. get_rankings ──────────────────────────────────────────────────────────

export interface RankingsResult {
  startups: (StartupRow & { rank: number })[];
  total: number;
  sector_filter: string | null;
  data_as_of: string;
}

export async function getRankings(opts: {
  sector?: string;
  limit?: number;
}): Promise<RankingsResult> {
  const limit = Math.min(opts.limit ?? 20, 100);

  const { data, count } = await sb()
    .from("startup_uploads")
    .select("id, name, sectors, stage, website, total_god_score, entity_gate, updated_at", {
      count: "exact",
    })
    .eq("entity_gate", "qualified")
    .gte("total_god_score", 1)
    .order("total_god_score", { ascending: false })
    .limit(opts.sector ? 500 : limit);

  let rows = (data ?? []) as Record<string, unknown>[];

  if (opts.sector) {
    const s = opts.sector.toLowerCase();
    rows = rows.filter((r) =>
      normalizeSectors(r.sectors).some((sec) => sec.toLowerCase().includes(s))
    ).slice(0, limit);
  }

  return {
    startups: rows.map((r, i) => ({
      rank: i + 1,
      id: String(r.id ?? ""),
      name: String(r.name ?? ""),
      sectors: normalizeSectors(r.sectors),
      stage: r.stage ? String(r.stage) : null,
      website: r.website ? String(r.website) : null,
      god_score: Number(r.total_god_score ?? 0),
      entity_gate: String(r.entity_gate ?? ""),
      data_as_of: dataAsOf(r),
    })),
    total: count ?? 0,
    sector_filter: opts.sector ?? null,
    data_as_of: new Date().toISOString(),
  };
}

// ─── 8. get_network_status ────────────────────────────────────────────────────

export interface NetworkStatus {
  total_startups: number;
  qualified_startups: number;
  total_investors: number;
  qualified_investors: number;
  active_matches: number;
  high_confidence_matches: number;
  startups_scored_last_24h: number;
  server_version: string;
  network_last_updated: string;
  data_as_of: string;
}

export async function getNetworkStatus(): Promise<NetworkStatus> {
  const since24h = new Date(Date.now() - 86_400_000).toISOString();

  const [
    { count: totalStartups },
    { count: qualifiedStartups },
    { count: totalInvestors },
    { count: qualifiedInvestors },
    { count: activeMatches },
    { count: highConfMatches },
    { count: recent24h },
  ] = await Promise.all([
    sb().from("startup_uploads").select("*", { count: "exact", head: true }),
    sb().from("startup_uploads").select("*", { count: "exact", head: true }).eq("entity_gate", "qualified"),
    sb().from("investors").select("*", { count: "exact", head: true }),
    sb().from("investors").select("*", { count: "exact", head: true }).eq("entity_gate", "qualified"),
    sb().from("pythh_matches").select("*", { count: "exact", head: true }).eq("status", "active"),
    sb().from("pythh_matches").select("*", { count: "exact", head: true }).eq("status", "active").gte("confidence", 0.75),
    sb().from("startup_uploads").select("*", { count: "exact", head: true }).gte("updated_at", since24h),
  ]);

  return {
    total_startups: totalStartups ?? 0,
    qualified_startups: qualifiedStartups ?? 0,
    total_investors: totalInvestors ?? 0,
    qualified_investors: qualifiedInvestors ?? 0,
    active_matches: activeMatches ?? 0,
    high_confidence_matches: highConfMatches ?? 0,
    startups_scored_last_24h: recent24h ?? 0,
    server_version: process.env.MCP_SERVER_VERSION ?? "1.0.0",
    network_last_updated: new Date().toISOString(),
    data_as_of: new Date().toISOString(),
  };
}

// ─── 9. validate_api_key (used by auth.ts) ────────────────────────────────────

export type ApiTier = "free" | "pro" | "enterprise";

export interface ApiKeyRecord {
  id: string;
  key: string;
  tier: ApiTier;
  calls_today: number;
  daily_limit: number;
  owner_email: string | null;
  active: boolean;
}

export async function lookupApiKey(key: string): Promise<ApiKeyRecord | null> {
  const { data, error } = await sb()
    .from("mcp_api_keys")
    .select("id, key, tier, calls_today, daily_limit, owner_email, active")
    .eq("key", key)
    .eq("active", true)
    .single();

  if (error || !data) return null;
  const r = data as Record<string, unknown>;
  return {
    id: String(r.id),
    key: String(r.key),
    tier: String(r.tier) as ApiTier,
    calls_today: Number(r.calls_today ?? 0),
    daily_limit: Number(r.daily_limit ?? 20),
    owner_email: r.owner_email ? String(r.owner_email) : null,
    active: Boolean(r.active),
  };
}

export async function incrementKeyUsage(keyId: string): Promise<void> {
  await sb().rpc("increment_mcp_key_usage", { key_id: keyId });
}
