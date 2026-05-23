/**
 * PYTHIA voice — shared persona for outreach, product copy, and agent prompts.
 *
 * Plain English. No jargon. Calm analyst who explains clearly.
 */

const PYTHIA_PRINCIPLES = [
  "Calm and measured — no hype, no exclamation marks, no urgency language.",
  "Curious and informative — say what you looked at and what stood out.",
  "Friendly but professional — warm, never chatty or salesy.",
  "Analyst first — clear rankings, plain reasons, no insider vocabulary.",
];

const PYTHIA_SYSTEM_PROMPT = `You are PYTHIA, the research analyst at Pythh (pythh.ai).

Voice:
- Calm, cool, collected. Never hype. Never exclamation marks.
- Curious and informative — explain what you looked at and what stood out.
- Friendly but not overly friendly — professional warmth, not buddy energy.
- A true analyst — rank clearly, explain simply, show your reasoning in one line.

Write like a smart colleague, not a product brochure.

Avoid jargon and vague phrases like:
"registered against focus", "alignment orbit", "signal read", "conviction themes",
"observatory-grade", "deck flow", "names flagged", "registered", "orbit", "thesis fit"
(unless you explain it in plain words).

Prefer plain language:
"startups that fit how [Firm] invests", "ranked best match first", "why it stood out",
"sector and stage", "traction", "who's raising".`;

function vcSubject({ sector, firm, emailType, count }) {
  if (emailType === "personal") {
    return `${sector}: ${count} startups matched to you`;
  }
  return `${sector}: ${count} startups for ${firm}`;
}

function vcHeadline({ sector, firm, count, isPersonal }) {
  if (isPersonal) {
    return `${count} ${sector} startups that fit your profile`;
  }
  return `${count} ${sector} startups that fit ${firm}`;
}

function vcIntro({ count, sector, firm, isPersonal }) {
  const fitTarget = isPersonal ? "you" : firm;
  return (
    `I've been tracking ${sector} — who's raising, what stage they're at, and where traction is picking up. ` +
    `Here are ${count} that look like a strong fit for ${fitTarget}, ranked best match first. ` +
    `Each row includes a one-line note on why it stood out.`
  );
}

function vcFootnote() {
  return "Ranked by fit. Not a pitch inbox.";
}

function vcMethodology({ firm, sector, stage, checkSize, isPersonal }) {
  const investProfile = isPersonal
    ? `your sector and stage (${sector}, ${stage ?? "early stage"}, ${checkSize ?? "seed to Series A"})`
    : `how ${firm} typically invests (${sector}, ${stage ?? "early stage"}, ${checkSize ?? "seed to Series A"})`;
  return (
    `How I picked these: sector and stage match, team strength, traction, market momentum, ` +
    `and fit with ${investProfile}. Updated daily.`
  );
}

function vcCtaTitle() {
  return "Use this list in Claude or Cursor";
}

function vcCtaBody() {
  return (
    "Same rankings, updated daily. Connect Pythh to your AI agent if you want to ask questions in plain English."
  );
}

function vcCtaText() {
  return `Use this list in Claude or Cursor:
→ https://pythh.ai/developers
→ https://pythh.ai/investors`;
}

function vcEmailKicker() {
  return "PYTHIA · Startup matches";
}

function vcFromName() {
  return "PYTHIA at Pythh";
}

module.exports = {
  PYTHIA_PRINCIPLES,
  PYTHIA_SYSTEM_PROMPT,
  vcSubject,
  vcHeadline,
  vcIntro,
  vcFootnote,
  vcMethodology,
  vcCtaTitle,
  vcCtaBody,
  vcCtaText,
  vcEmailKicker,
  vcFromName,
};
