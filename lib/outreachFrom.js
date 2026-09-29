const DEFAULT_FALLBACK = "onboarding@resend.dev";
const DELIVERABLE_EMAIL = "hello@orbital-ai.io";

const { extractEmail, isPythhFrom, pythhFromAllowed } = require("../server/lib/transactionalEmailFrom");

function getOutreachFallbackAddress() {
  return process.env.OUTREACH_FALLBACK_FROM || process.env.OUTREACH_TEST_FROM || DEFAULT_FALLBACK;
}

function preferredOutreachFrom() {
  if (process.env.OUTREACH_USE_PYTHH_DOMAIN === "true") {
    return process.env.OUTREACH_FROM || "pythia@pythh.ai";
  }
  const explicit = process.env.OUTREACH_FROM?.trim();
  if (explicit && !isPythhFrom(explicit)) return explicit;
  return getOutreachFallbackAddress();
}

/**
 * Bare mailbox. pythh.ai stays off until PYTHH_FROM_DNS_OK=1 because Gmail
 * quarantines that domain. Deliverable mail goes through hello@orbital-ai.io.
 */
function getOutreachFromAddress() {
  const preferred = preferredOutreachFrom();
  if (isPythhFrom(preferred) && !pythhFromAllowed()) return DELIVERABLE_EMAIL;
  return extractEmail(preferred);
}

function getOutreachFromHeader() {
  const email = getOutreachFromAddress();
  return `Peter at Pythh <${email}>`;
}

function isDomainNotVerifiedError(data) {
  const msg = String(data?.message || data?.error || "").toLowerCase();
  return msg.includes("domain is not verified") || msg.includes("not verified");
}

function isResendSandboxError(data) {
  const msg = String(data?.message || data?.error || "").toLowerCase();
  return msg.includes("only send testing emails") || msg.includes("verify a domain at resend.com");
}

function isSandboxFromAddress(address) {
  const local = String(address || "").split("@")[0]?.toLowerCase();
  const domain = String(address || "").split("@")[1]?.toLowerCase();
  return domain === "resend.dev" || local === "onboarding";
}

module.exports = {
  getOutreachFromAddress,
  getOutreachFromHeader,
  getOutreachFallbackAddress,
  isDomainNotVerifiedError,
  isResendSandboxError,
  isSandboxFromAddress,
};
