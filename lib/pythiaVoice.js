/**
 * Peter — Pythh match advisor (outbound persona).
 * Silicon Valley insider tone: thesis, messaging, and timing alignment.
 * Cool, calm, clever. Plain English. Never salesy. Never "AI agent" energy in email.
 *
 * Product engine = PYTHIA (in-app). Outbound human face = Peter.
 */

const OUTREACH_AGENT_NAME = "Peter";

const PETER_PRINCIPLES = [
  "Cool, calm, collected — no hype, no exclamation marks, no urgency.",
  "Silicon Valley insider — you know how meetings actually get won (thesis, framing, timing), not pitch-event theater.",
  "Empathetic to founders — building is hard; misaligned rooms waste months.",
  "Clever but plain — explain why each investor fits; never jargon or 'AI scored you'.",
  "Confident advisor — ranked lists, specific reasons, no empty cheerleading.",
];

const PETER_SYSTEM_PROMPT = `You are Peter, a match advisor at Pythh (pythh.ai).

You are NOT an AI bot in email — you are the human face of Pythh outreach. Never say PYTHIA, oracle, or agent in founder emails.

Voice:
- Cool, calm, collected. Never hype. Never exclamation marks.
- Silicon Valley insider who helps founders connect the right way: thesis fit, messaging, timing.
- You understand: warm intros and pitch events fail when founders walk into the wrong thesis.
- Outside the Bay, founders rarely get coached by exited founders — you bring that clarity.
- Friendly, professional warmth — never chatty, never pushy.

Founder outreach opens like:
"Hi [name], this is Peter. I work with founders on the part pitch decks skip — matching your story to investors who are actually deploying in your space, at your stage, on your timeline. Most passes aren't about your company — they're thesis misalignment..."

VC outreach opens like:
"Hi [name], this is Peter. I'm a match advisor at Pythh. We curate startups for investment review against firm thesis and portfolio patterns..."

Avoid: "excited to share", "game-changing", PYTHIA, oracle, "signals", marketing fluff, urgency.
Prefer: "thesis fit", "how to frame the conversation", "ranked best match first", "deploying in your sector".`;

// Backward-compatible aliases
const PYTHIA_PRINCIPLES = PETER_PRINCIPLES;
const PYTHIA_SYSTEM_PROMPT = PETER_SYSTEM_PROMPT;

// ── VC (investor) outreach ───────────────────────────────────────────────────

function vcSubject({ sector, firm, emailType, count }) {
  if (emailType === "personal") {
    return `${count} ${sector} startups for your review`;
  }
  return `${count} ${sector} startups curated for ${firm}`;
}

function vcHeadline({ sector, count }) {
  return `${count} ${sector} startups for review`;
}

function vcOpening({ greeting, firm, isPersonal, count, marketObservation }) {
  const thesisRef = isPersonal
    ? "your firm's thesis and portfolio strategy"
    : `${firm}'s thesis and portfolio strategy`;

  let text =
    `${greeting} This is ${OUTREACH_AGENT_NAME}. I'm a match advisor at Pythh. ` +
    `We curate startups for investment review — sector, stage, traction, and fit with how you actually deploy. `;

  if (marketObservation) {
    text += `${marketObservation} `;
  }

  text += `Based on ${thesisRef}, here are ${count} startups that align with your approach — ranked best match first.`;
  return text;
}

function vcFootnote() {
  return "Each row includes a short note on why it stood out.";
}

function vcMethodology({ firm, sector, stage, checkSize, isPersonal }) {
  const profile = isPersonal
    ? `your focus (${sector}, ${stage ?? "early stage"}, ${checkSize ?? "seed to Series A"})`
    : `${firm}'s typical investments (${sector}, ${stage ?? "early stage"}, ${checkSize ?? "seed to Series A"})`;
  return (
    `Rankings reflect sector and stage fit, team strength, traction, market momentum, and alignment with ${profile}. ` +
    `The list updates daily.`
  );
}

function vcCtaTitle() {
  return "Questions on any of these?";
}

function vcCtaBody() {
  return (
    "Browse the full rankings at pythh.ai, or connect Pythh to Claude or Cursor " +
    "if you prefer to query the list in plain English."
  );
}

function vcCtaText() {
  return `Browse rankings or connect to your AI agent:
→ https://pythh.ai/investors
→ https://pythh.ai/developers`;
}

function vcEmailKicker() {
  return `${OUTREACH_AGENT_NAME} · Pythh Match Desk`;
}

function vcFromName() {
  return `${OUTREACH_AGENT_NAME} at Pythh`;
}

function vcEmailSignoff() {
  return `${OUTREACH_AGENT_NAME} · Match Advisor · Pythh · pythh.ai · ai@pythh.ai`;
}

// ── Founder (startup) outreach ───────────────────────────────────────────────

function founderSubject({ startupName, count }) {
  const label = startupName || "your startup";
  return `${count} thesis-fit investors for ${label}`;
}

function founderHeadline({ startupName, count }) {
  return `${count} investors worth your time`;
}

/**
 * Opening paragraph — Peter as SV insider on thesis / messaging / timing.
 */
function founderOpening({ greeting, startupName, count }) {
  const name = startupName || "your startup";
  return (
    `${greeting} This is ${OUTREACH_AGENT_NAME}. I work with founders on the part pitch decks skip — ` +
    `matching your story to investors who are actually deploying in your space, at your stage, on your timeline.\n\n` +
    `Most "that's interesting, but we'll pass" meetings aren't about your company. They're thesis misalignment — ` +
    `the wrong room, the wrong framing, or showing up before they're deploying in your category. In Silicon Valley, ` +
    `exited founders coach each other on that before anyone takes a meeting. Outside the Bay, most founders never get that loop.\n\n` +
    `I ran <strong style="color:#94a3b8;">${name}</strong> against 6,000+ investor profiles — sector, stage, check size, ` +
    `portfolio patterns, and recent deployment. These <strong style="color:#94a3b8;">${count}</strong> firms ranked highest for thesis fit. ` +
    `Each row below says why — so you know how to frame the conversation, not just who to email.`
  );
}

function founderOpeningText({ greeting, startupName, count }) {
  const name = startupName || "your startup";
  return (
    `${greeting} This is ${OUTREACH_AGENT_NAME}. I work with founders on the part pitch decks skip — ` +
    `matching your story to investors who are actually deploying in your space, at your stage, on your timeline.\n\n` +
    `Most "that's interesting, but we'll pass" meetings aren't about your company. They're thesis misalignment — ` +
    `the wrong room, the wrong framing, or showing up before they're deploying in your category. In Silicon Valley, ` +
    `exited founders coach each other on that before anyone takes a meeting. Outside the Bay, most founders never get that loop.\n\n` +
    `I ran ${name} against 6,000+ investor profiles — sector, stage, check size, portfolio patterns, and recent deployment. ` +
    `These ${count} firms ranked highest for thesis fit. Each row below says why — so you know how to frame the conversation, not just who to email.`
  );
}

function founderAlignmentTagline() {
  return "Thesis · messaging · timing — ranked best fit first.";
}

function founderTableLabel() {
  return "INVESTOR · THESIS FIT · HOW TO FRAME IT";
}

function founderScoreLabel(godScore) {
  if (godScore >= 70) return "Strong · Signals land clearly with thesis-fit investors";
  if (godScore >= 55) return "Solid · Room to sharpen framing for top-tier firms";
  return "Emerging · Focus on stage-aligned investors first";
}

function founderScoreCaption() {
  return "How clearly your public signals read against how investors decide — not a grade on your worth.";
}

function founderFootnote() {
  return "A warm intro still needs alignment. Start with thesis fit, then tune your story to each firm's portfolio.";
}

function founderCtaTitle() {
  return "Your full shortlist + framing notes";
}

function founderCtaBody() {
  return (
    "See every match, refine your score, and get outreach copy tuned to each firm's thesis. " +
    "Free to start — no deck required."
  );
}

function founderCtaPrimaryUrl(encodedUrl, utm = {}) {
  const parts = [];
  if (encodedUrl) parts.push(`startup=${encodedUrl}`);
  const source = utm.source ?? "peter";
  const medium = utm.medium ?? "email";
  const campaign = utm.campaign;
  parts.push(`utm_source=${encodeURIComponent(source)}`);
  parts.push(`utm_medium=${encodeURIComponent(medium)}`);
  if (campaign) parts.push(`utm_campaign=${encodeURIComponent(campaign)}`);
  return `https://pythh.ai/activate?${parts.join("&")}`;
}

function founderCtaText({ encodedUrl = "", utm = {} } = {}) {
  const primary = founderCtaPrimaryUrl(encodedUrl, utm);
  return `See your full match list and alignment notes:
→ ${primary}

Questions on how to frame for a specific firm? Reply to this email.`;
}

function founderEmailKicker() {
  return `${OUTREACH_AGENT_NAME} · Pythh Match Desk`;
}

function founderEmailSignoff() {
  return `${OUTREACH_AGENT_NAME} · Match Advisor · Pythh · pythh.ai · Reply if you want help framing for a specific firm.`;
}

function defaultMatchReason() {
  return "Sector and stage overlap with recent portfolio activity — worth framing your narrative around their last few deals.";
}

module.exports = {
  OUTREACH_AGENT_NAME,
  PETER_PRINCIPLES,
  PETER_SYSTEM_PROMPT,
  PYTHIA_PRINCIPLES,
  PYTHIA_SYSTEM_PROMPT,
  defaultMatchReason,
  vcSubject,
  vcHeadline,
  vcOpening,
  vcFootnote,
  vcMethodology,
  vcCtaTitle,
  vcCtaBody,
  vcCtaText,
  vcEmailKicker,
  vcFromName,
  vcEmailSignoff,
  founderSubject,
  founderHeadline,
  founderOpening,
  founderOpeningText,
  founderAlignmentTagline,
  founderTableLabel,
  founderScoreLabel,
  founderScoreCaption,
  founderFootnote,
  founderCtaTitle,
  founderCtaBody,
  founderCtaPrimaryUrl,
  founderCtaText,
  founderEmailKicker,
  founderEmailSignoff,
};
