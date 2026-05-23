/** Resend rejects @pythh.ai until the domain is verified. Use resend.dev sandbox by default. */
function getOutreachFromAddress() {
  const verified = process.env.RESEND_VERIFIED_DOMAIN === "pythh.ai";
  if (verified) {
    return process.env.OUTREACH_FROM || "pythia@pythh.ai";
  }
  return process.env.OUTREACH_FALLBACK_FROM || process.env.OUTREACH_TEST_FROM || "onboarding@resend.dev";
}

module.exports = { getOutreachFromAddress };
