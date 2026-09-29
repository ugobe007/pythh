const DEFAULT_FALLBACK = "onboarding@resend.dev";
const PYTHH_FROM = "pythia@pythh.ai";

function getOutreachFallbackAddress() {
  return process.env.OUTREACH_FALLBACK_FROM || process.env.OUTREACH_TEST_FROM || DEFAULT_FALLBACK;
}

/**
 * Use @pythh.ai when OUTREACH_USE_PYTHH_DOMAIN=true.
 * Peter is Pythh. The mailbox is pythia@pythh.ai.
 */
function getOutreachFromAddress() {
  if (process.env.OUTREACH_USE_PYTHH_DOMAIN === "true") {
    const configured = String(process.env.OUTREACH_FROM || PYTHH_FROM).trim();
    const angled = configured.match(/<([^>]+)>/);
    return (angled ? angled[1] : configured).trim().toLowerCase();
  }
  const explicit = process.env.OUTREACH_FROM?.trim();
  if (explicit && !explicit.toLowerCase().endsWith("@pythh.ai")) {
    return explicit;
  }
  return getOutreachFallbackAddress();
}

function getOutreachFromHeader() {
  return `Peter at Pythh <${getOutreachFromAddress()}>`;
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
