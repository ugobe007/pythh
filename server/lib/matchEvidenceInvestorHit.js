/**
 * Strict investor hit checks for auto-verify of funding evidence.
 * Avoids firm-field pollution (e.g. Alchemist Accelerator with firm="Accel").
 */
'use strict';

function norm(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

/**
 * True when the article phrase cleanly identifies this investor entity.
 * Accepts: exact name, org entity (name===firm===phrase), or "Partner (Firm)" with firm===phrase.
 */
function isCleanInvestorHit(investor, phrase) {
  const p = norm(phrase);
  if (!p || p.length < 4) return false;
  const name = norm(investor?.name);
  const firm = norm(investor?.firm);
  if (name === p) return true;
  if (firm === p && name === firm) return true;
  const paren = String(investor?.name || '').match(/\(([^)]+)\)/);
  if (firm === p && paren && norm(paren[1]) === p) return true;
  return false;
}

/** Prefer org entities / clean hits; drop junk substring collisions. */
function filterCleanHits(mentions) {
  const out = [];
  const seen = new Set();
  for (const mention of mentions || []) {
    const investor = mention.investor || mention;
    const phrase = mention.investorNameRaw || mention.phrase || investor?.firm || investor?.name;
    if (!isCleanInvestorHit(investor, phrase)) continue;
    if (!investor?.id || seen.has(investor.id)) continue;
    seen.add(investor.id);
    out.push({ ...mention, investor, investorNameRaw: phrase });
  }
  return out;
}

module.exports = { norm, isCleanInvestorHit, filterCleanHits };
