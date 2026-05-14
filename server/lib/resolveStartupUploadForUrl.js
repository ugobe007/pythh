/**
 * Single resolver: submitted URL → approved startup_uploads row (if any).
 * Used by POST /api/instant/submit and POST /api/discovery/submit so both gateways
 * agree on which startup_id backs a URL.
 *
 * Order: exact website variants → resolve_startup_by_url RPC → company_domain →
 *        bounded fuzzy OR + same scoring as legacy instant (Tier 3).
 */

const { normalizeUrl, extractDomain } = require("../utils/urlNormalizer");

const STARTUP_SELECT =
  "id, name, website, sectors, stage, total_god_score, status, enrichment_token, data_completeness";

/** Same as instantSubmit extractCompanyName (website string → first label lower). */
function extractCompanyNameFromWebsite(website) {
  const d = extractDomain(website || "");
  return d.split(".")[0].toLowerCase();
}

/**
 * Root domain = last two labels of a domain, ignoring www.
 * "www.stripe.com" → "stripe.com", "app.linear.app" → "linear.app"
 * Used for domain coherence: a candidate from fintechnews.org never matches a stripe.com query.
 */
function getRootDomain(d) {
  const clean = String(d || "").toLowerCase().replace(/^www\./, "").split("/")[0];
  const parts = clean.split(".");
  return parts.length >= 2 ? parts.slice(-2).join(".") : clean;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} website
 * @returns {Promise<string|null>}
 */
async function getStartupUploadIdByExactWebsite(supabase, website) {
  const { data, error } = await supabase
    .from("startup_uploads")
    .select("id")
    .eq("website", website)
    .limit(1);
  if (error) return null;
  return data?.[0]?.id ?? null;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ inputRaw: string, log?: (s: string) => void }} ctx
 * @returns {Promise<object|null>} startup row or null
 */
async function resolveApprovedStartupUploadForUrl(supabase, ctx) {
  const log = typeof ctx.log === "function" ? ctx.log : () => {};
  const inputRaw = String(ctx.inputRaw || "").trim();
  if (!inputRaw) return null;

  const domain = extractDomain(inputRaw);
  const urlNormalized = normalizeUrl(inputRaw);
  const companyName = domain.split(".")[0].toLowerCase();
  if (!companyName || companyName.length < 2) return null;

  const baseUrl = `https://${domain}`;
  const wwwUrl = `https://www.${domain}`;

  const websiteExactVariants = [
    baseUrl,
    `${baseUrl}/`,
    wwwUrl,
    `${wwwUrl}/`,
    `http://${domain}`,
    `http://${domain}/`,
    `http://www.${domain}`,
    `http://www.${domain}/`,
    // Bare domain variants — some rows are stored without protocol
    domain,
    `www.${domain}`,
  ];

  // Tier 1: exact website match — no status filter because an exact URL is authoritative.
  // Prefer approved > others, then highest god score, then oldest (canonical) row.
  {
    const { data: exRows, error: exErr } = await supabase
      .from("startup_uploads")
      .select(STARTUP_SELECT)
      .in("website", websiteExactVariants)
      .not("status", "eq", "deleted")
      .order("total_god_score", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(5); // fetch a few so we can prefer approved
    if (!exErr && exRows?.length) {
      // Prefer approved rows first
      const approved = exRows.filter((r) => r.status === "approved");
      if (approved[0]) {
        log(`  ✓ [resolve] exact website (batch) → ${approved[0].name} [approved]`);
        return approved[0];
      }
      // For non-approved rows: require name coherence (name must contain the company label)
      // This filters out junk rows like "Investing" stored at openai.com
      const coherent = exRows.filter((r) =>
        (r.name || "").toLowerCase().includes(companyName)
      );
      const best = coherent[0] ?? null;
      if (best) {
        log(`  ✓ [resolve] exact website (batch) → ${best.name} [${best.status}]`);
        return best;
      }
    }
  }

  // RPC: try canonical URLs only (deduplicated)
  const rpcUrls = [...new Set([baseUrl, wwwUrl, inputRaw].filter(Boolean))];
  for (const u of rpcUrls) {
    const { data: rpcData, error: rpcErr } = await supabase.rpc("resolve_startup_by_url", { p_url: u });
    if (rpcErr || !rpcData) continue;
    const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    const sid = row?.startup_id;
    if (!sid) continue;
    const { data: suRows, error: suErr } = await supabase
      .from("startup_uploads")
      .select(STARTUP_SELECT)
      .eq("id", sid)
      .eq("status", "approved")
      .limit(1);
    if (!suErr && suRows?.[0]?.id) {
      const resolved = suRows[0];
      // Reject sub-page matches: if the stored website has a path beyond the root,
      // it's a scraped inner page (e.g. openai.com/index/partner) not the company itself
      const resolvedPath = (resolved.website || "").replace(/^https?:\/\/[^/]+/, "").replace(/^\/+$/, "");
      if (resolvedPath && resolvedPath.length > 1) {
        log(`  ✗ [resolve] RPC matched sub-page, skipping: ${resolved.website}`);
        continue;
      }
      log(`  ✓ [resolve] resolve_startup_by_url → ${resolved.name}`);
      return resolved;
    }
  }

  // Single batched IN query for company_domain variants
  {
    const { data: cd, error: cdErr } = await supabase
      .from("startup_uploads")
      .select(STARTUP_SELECT)
      .in("company_domain", [domain, `www.${domain}`])
      .eq("status", "approved")
      .order("total_god_score", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1);
    if (!cdErr && cd?.[0]?.id) {
      log(`  ✓ [resolve] company_domain (batch) → ${cd[0].name}`);
      return cd[0];
    }
  }

  const searchedRoot = getRootDomain(domain);

  // Tier 4a: prefix-match on canonical URL forms (rows whose website STARTS WITH our domain)
  const prefixPatterns = [
    `website.eq.${baseUrl}`,
    `website.eq.${baseUrl}/`,
    `website.eq.${wwwUrl}`,
    `website.eq.${wwwUrl}/`,
    `website.ilike.${baseUrl}/%`,
    `website.ilike.${wwwUrl}/%`,
  ];
  let { data: candidates, error: searchErr } = await supabase
    .from("startup_uploads")
    .select(STARTUP_SELECT)
    .or(prefixPatterns.join(","))
    .eq("status", "approved")
    .limit(30);

  // Filter immediately to domain-coherent rows (eliminates article pages stored under the wrong domain)
  candidates = (candidates || []).filter((c) => getRootDomain(extractDomain(c.website || "")) === searchedRoot);

  if (candidates.length === 0 && !searchErr) {
    // Tier 4b: company_name label search — but ONLY over rows that share the root domain
    // Search by website prefix; do NOT use name.ilike here (it pulls in junk articles)
    const domainVariantPatterns = [
      `website.ilike.%${domain}%`,
    ];
    const fallback = await supabase
      .from("startup_uploads")
      .select(STARTUP_SELECT)
      .or(domainVariantPatterns.join(","))
      .eq("status", "approved")
      .limit(100);
    // Hard filter: only keep rows whose root domain matches
    candidates = (fallback.data || []).filter(
      (c) => getRootDomain(extractDomain(c.website || "")) === searchedRoot
    );
    searchErr = fallback.error;
  }

  if (searchErr) {
    log(`  ✗ [resolve] search error: ${searchErr.message}`);
    return null;
  }

  if (!candidates || candidates.length === 0) {
    log(`  ✗ [resolve] no domain-coherent candidates for ${domain}`);
    return null;
  }

  const scored = candidates.map((c) => {
    let score = 0;
    const candidateCompanyName = extractCompanyNameFromWebsite(c.website || "");
    const candidateNameLower = (c.name || "").toLowerCase();
    const candidateWebsiteLower = (c.website || "").toLowerCase();

    // All candidates here are already domain-coherent — score by URL proximity
    if (c.website && normalizeUrl(c.website) === urlNormalized) score = 100;
    else if (candidateCompanyName === companyName) score = 90;
    else if (candidateWebsiteLower.startsWith(`https://${companyName}.`) ||
             candidateWebsiteLower.startsWith(`http://${companyName}.`) ||
             candidateWebsiteLower.startsWith(`https://www.${companyName}.`)) score = 85;
    else if (candidateWebsiteLower.startsWith(baseUrl) || candidateWebsiteLower.startsWith(wwwUrl)) score = 80;
    else if (candidateNameLower.startsWith(companyName)) score = 70;
    else if (candidateNameLower.includes(companyName)) score = 60;
    else score = 40; // domain-coherent but weak name signal
    return { ...c, matchScore: score };
  });
  scored.sort((a, b) => b.matchScore - a.matchScore);

  const best = scored[0];
  const { matchScore: _ms, ...row } = best;
  log(`  ✓ [resolve] domain-coherent ranked → ${row.name} (score ${_ms})`);
  return row;
}

module.exports = {
  resolveApprovedStartupUploadForUrl,
  getStartupUploadIdByExactWebsite,
  STARTUP_SELECT,
};
