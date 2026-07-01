const DEFAULT_FALLBACK = "onboarding@resend.dev";

function getOutreachFallbackAddress() {
  return process.env.OUTREACH_FALLBACK_FROM || process.env.OUTREACH_TEST_FROM || DEFAULT_FALLBACK;
}

/**
 * Use @pythh.ai only when OUTREACH_USE_PYTHH_DOMAIN=true (set after Resend shows domain Verified).
 * RESEND_VERIFIED_DOMAIN alone does not switch the sender — it was easy to set before DNS was done.
 */
function getOutreachFromAddress() {
  if (process.env.OUTREACH_USE_PYTHH_DOMAIN === "true") {
    return process.env.OUTREACH_FROM || "pythia@pythh.ai";
  }
  const explicit = process.env.OUTREACH_FROM?.trim();
  if (explicit && !explicit.endsWith("@pythh.ai")) {
    return explicit;
  }
  return getOutreachFallbackAddress();
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
  getOutreachFallbackAddress,
  isDomainNotVerifiedError,
  isResendSandboxError,
  isSandboxFromAddress,
};
