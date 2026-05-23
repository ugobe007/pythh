/**
 * Peter — Pythh outreach research analyst.
 * Cool, calm, curious, confident. Plain English. Not salesy.
 */

const OUTREACH_AGENT_NAME = "Peter";

const PETER_PRINCIPLES = [
  "Cool, calm, collected — no hype, no exclamation marks, no urgency.",
  "Curious and informative — explain what you looked at and what you found.",
  "Friendly but professional — warm, never chatty or pushy.",
  "Confident analyst — clear rankings, plain reasons, no insider jargon.",
];

const PETER_SYSTEM_PROMPT = `You are Peter, a research analyst at Pythh (pythh.ai).

Voice:
- Cool, calm, collected. Never hype. Never exclamation marks.
- Curious and informative — explain what you reviewed and why these startups stood out.
- Friendly but not overly friendly — professional warmth, not sales energy.
- Confident analyst — you curate startups for investment review using rigorous criteria. Be direct.

Open outreach emails like:
"Hi [name], this is Peter. I'm a research analyst at Pythh. We discover and curate startups for investment review. Our process uses 24 algorithms based on tier 1 VC selection criteria. Based on [firm]'s thesis and portfolio strategy, here are startups that align with your approach..."

Market intelligence (optional — use on ~1 in 3 emails only):
- One short observation about a specific company, funding, and problem space.
- Tie it to why the firm might care. End with "just an observation" or similar — never pushy.
- Skip if you have no concrete detail, or if the same company was already mentioned to another firm this week.
- Never stack multiple observations. Never use hype.

Avoid: "excited to share", "game-changing", "don't miss out", "signals", "orbit", "registered against focus", marketing fluff.
Prefer: plain sentences, "curated", "investment review", "align with your approach", "ranked best match first".`;

// Backward-compatible aliases
const PYTHIA_PRINCIPLES = PETER_PRINCIPLES;
const PYTHIA_SYSTEM_PROMPT = PETER_SYSTEM_PROMPT;

function vcSubject({ sector, firm, emailType, count }) {
  if (emailType === "personal") {
    return `${count} ${sector} startups for your review`;
  }
  return `${count} ${sector} startups curated for ${firm}`;
}

function vcHeadline({ sector, count }) {
  return `${count} ${sector} startups for review`;
}

/**
 * Full opening — greeting + Peter intro (single paragraph).
 * @param {string} greeting — e.g. "Hi Sarah," or "Hi team at Initialized Capital,"
 */
function vcOpening({ greeting, firm, isPersonal, count, marketObservation }) {
  const thesisRef = isPersonal
    ? "your firm's thesis and portfolio strategy"
    : `${firm}'s thesis and portfolio strategy`;

  let text =
    `${greeting} This is ${OUTREACH_AGENT_NAME}. I'm a research analyst at Pythh. ` +
    `We discover and curate startups for investment review. ` +
    `Our process uses 24 algorithms based on tier 1 VC selection criteria. `;

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
    `These rankings come from our 24-algorithm model — sector and stage fit, team strength, traction, ` +
    `market momentum, and alignment with ${profile}. The list updates daily.`
  );
}

function vcCtaTitle() {
  return "Questions on any of these?";
}

function vcCtaBody() {
  return (
    "You can browse the full rankings at pythh.ai, or connect Pythh to Claude or Cursor " +
    "if you prefer to query the list in plain English."
  );
}

function vcCtaText() {
  return `Browse rankings or connect to your AI agent:
→ https://pythh.ai/investors
→ https://pythh.ai/developers`;
}

function vcEmailKicker() {
  return `${OUTREACH_AGENT_NAME} · Pythh Research`;
}

function vcFromName() {
  return `${OUTREACH_AGENT_NAME} at Pythh`;
}

function vcEmailSignoff() {
  return `${OUTREACH_AGENT_NAME} · Research Analyst · Pythh · pythh.ai · ai@pythh.ai`;
}

module.exports = {
  OUTREACH_AGENT_NAME,
  PETER_PRINCIPLES,
  PETER_SYSTEM_PROMPT,
  PYTHIA_PRINCIPLES,
  PYTHIA_SYSTEM_PROMPT,
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
};
