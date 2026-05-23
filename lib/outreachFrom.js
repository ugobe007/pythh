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

module.exports = {
  getOutreachFromAddress,
  getOutreachFallbackAddress,
  isDomainNotVerifiedError,
};
