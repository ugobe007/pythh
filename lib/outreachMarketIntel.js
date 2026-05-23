/**
 * Optional market-intelligence line for Peter VC outreach.
 * Used sparingly — not every email, not the same company twice per campaign.
 */

function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** ~35% of emails get an observation (deterministic per investor + campaign). */
function shouldIncludeMarketObservation(investorId, campaign, rate = 0.35) {
  if (!investorId) return false;
  const bucket = hashSeed(`${investorId}:${campaign ?? "default"}`) % 1000;
  return bucket / 1000 < rate;
}

function formatFundingAmount(raw) {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim();
  const suffix = s.match(/([0-9.]+)\s*([kmb])/i);
  if (suffix) {
    const n = parseFloat(suffix[1]);
    const unit = suffix[2].toLowerCase();
    if (!Number.isFinite(n) || n <= 0) return null;
    if (unit === "b") return `$${n % 1 === 0 ? n : n.toFixed(1).replace(/\.0$/, "")}B`;
    if (unit === "m") return `$${n % 1 === 0 ? n : n.toFixed(1).replace(/\.0$/, "")}M`;
    if (unit === "k") return `$${Math.round(n)}K`;
  }
  const n = typeof raw === "number" ? raw : parseFloat(s.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  if (n >= 1_000_000) return `$${Math.round(n / 1_000_000)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}

function problemPhrase(lead, sector) {
  const tagline = (lead.tagline || "").trim();
  if (tagline.length >= 20 && tagline.length <= 140) {
    return tagline.replace(/\.$/, "");
  }
  const reason = (lead.match_reason || "").split(".")[0]?.trim();
  if (reason && reason.length >= 15 && reason.length <= 120) {
    return reason.replace(/\.$/, "");
  }
  const s = sector || "their space";
  return `a problem in ${s} that matches active fund mandates`;
}

function observationTemplates() {
  return [
    (name, amount, problem, firm) =>
      amount
        ? `I noticed ${name} raised ${amount} to work on ${problem}. That looks like a deal ${firm} would participate in — just an observation.`
        : `I noticed ${name} is focused on ${problem}. That looks like a deal ${firm} would participate in — just an observation.`,
    (name, amount, problem) =>
      amount
        ? `Separately — ${name} closed ${amount} recently for ${problem}. Worth a look if you're tracking that part of the market.`
        : `Separately — ${name} is getting traction on ${problem}. Worth a look if you're tracking that part of the market.`,
    (name, amount, problem) =>
      amount
        ? `One market note: ${name} announced ${amount} for ${problem}. Not on your list below, but it rhymes with how you invest.`
        : null,
  ];
}

/**
 * Pick one observation for this investor, or null.
 * @param {object} opts
 * @param {object} opts.investor
 * @param {object[]} opts.leads — ranked startups (may pick from top 5, not always #1)
 * @param {Set<string>} opts.usedCompanies — names already used this campaign run
 * @param {string} opts.campaign
 */
function pickMarketObservation({ investor, leads, usedCompanies, campaign, rate }) {
  const inclusionRate = rate ?? parseFloat(process.env.OUTREACH_MARKET_INTEL_RATE ?? "0.35");
  if (!shouldIncludeMarketObservation(investor.id, campaign, inclusionRate)) return null;
  if (!leads?.length) return null;

  const firm =
    investor.firm && investor.firm !== "null"
      ? investor.firm
      : investor.name ?? "your firm";
  const sector = Array.isArray(investor.sectors)
    ? investor.sectors[0]
    : investor.sectors ?? "technology";

  const seed = hashSeed(`${investor.id}:${campaign}:pick`);
  const candidates = leads.slice(0, 5);
  const ordered = [...candidates].sort(
    (a, b) => hashSeed(`${seed}:${a.id ?? a.name}`) - hashSeed(`${seed}:${b.id ?? b.name}`)
  );

  const templates = observationTemplates();
  const templateIdx = seed % templates.length;

  for (const lead of ordered) {
    const name = (lead.name ?? lead.website ?? "").trim();
    if (!name || usedCompanies.has(name.toLowerCase())) continue;

    const amount =
      formatFundingAmount(lead.latest_funding_amount) ||
      formatFundingAmount(lead.extracted_data?.funding_amount) ||
      formatFundingAmount(lead.raise_amount);

    const problem = problemPhrase(lead, sector);
    const line = templates[templateIdx](name, amount, problem, firm);
    if (!line) continue;

    usedCompanies.add(name.toLowerCase());
    return line;
  }

  return null;
}

module.exports = {
  shouldIncludeMarketObservation,
  pickMarketObservation,
  formatFundingAmount,
};
