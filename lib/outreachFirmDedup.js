/**
 * Firm-level dedup for VC outreach — one email per firm (domain or name).
 */

const { classifyOutreachEmail } = require("./investorEmailInfer.js");

const GENERIC_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "hotmail.com", "outlook.com",
  "icloud.com", "me.com", "aol.com", "protonmail.com", "live.com",
]);

/** Canonical firm key: prefer email domain, else normalized firm name. */
function normalizeFirmKey(inv) {
  const email = String(inv.email_best_guess ?? inv.email ?? "").toLowerCase().trim();
  const domain = email.split("@")[1]?.replace(/^www\./, "") ?? "";
  if (domain && !GENERIC_EMAIL_DOMAINS.has(domain)) {
    return `domain:${domain}`;
  }

  const firm = (inv.firm && inv.firm !== "null" ? String(inv.firm) : "").trim();
  if (firm) {
    return `firm:${firm.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}`;
  }

  const name = String(inv.name ?? "").trim();
  if (name) {
    return `name:${name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}`;
  }

  return `investor:${inv.id}`;
}

/** Prefer firm intake address over multiple partner inboxes at the same firm. */
function intakeLocalRank(email) {
  const local = String(email).split("@")[0]?.toLowerCase() ?? "";
  if (["pitch", "deals", "hello", "invest", "partnerships", "info"].includes(local)) return 200;
  if (local === "contact") return 100;
  return 0;
}

function recipientRank(inv) {
  const email = inv.email_best_guess ?? inv.email ?? "";
  const type = classifyOutreachEmail(email, inv.name);
  const score = Number(inv.investor_score ?? 0);
  const typeBonus = type === "intake" ? 10_000 + intakeLocalRank(email) : type === "personal" ? 0 : 5_000;
  return typeBonus + score;
}

/** Keep a single best recipient per firm from a candidate list. */
function pickOnePerFirm(investors) {
  const buckets = new Map();
  for (const inv of investors ?? []) {
    if (!inv.email_best_guess && !inv.email) continue;
    const key = normalizeFirmKey(inv);
    const prev = buckets.get(key);
    if (!prev || recipientRank(inv) > recipientRank(prev)) {
      buckets.set(key, inv);
    }
  }
  return [...buckets.values()].sort(
    (a, b) => (b.investor_score ?? 0) - (a.investor_score ?? 0)
  );
}

module.exports = {
  normalizeFirmKey,
  recipientRank,
  pickOnePerFirm,
  GENERIC_EMAIL_DOMAINS,
};
