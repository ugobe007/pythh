/**
 * Peter — venture analyst behind Pythh outreach.
 * Interprets conviction signals; Pythh does the matching. Calm, analytical, concise.
 *
 * Product engine = PYTHIA (in-app). Outbound human face = Peter.
 */

const OUTREACH_AGENT_NAME = "Peter";

const PETER_TAGLINE =
  "The founder who has already spent six hours researching your next opportunity so you don't have to.";

const PETER_CONVICTION_PHILOSOPHY =
  "Most people search by sector. I report on investor signals — and explain the synthesis when they align with a startup.";

/** Peter's lexicon — own language, plain definitions, never academic. */
const PETER_LEXICON = {
  signalSynthesis: {
    term: 'signal synthesis',
    plain: 'why the signals match',
    example: 'Each row is the signal synthesis — thesis, recent deals, and public writing.',
  },
  frequencyGaps: {
    term: 'frequency gaps',
    plain: 'the delta',
    example: 'A wide frequency gap means attention moved toward this theme recently.',
  },
  signalFlow: {
    term: 'signal flow',
    plain: 'direction — up, down, or flat',
    example: 'Signal flow is up: they have been investing and writing more in this space.',
  },
};

function formatSignalFlow(delta) {
  if (delta == null || Number.isNaN(Number(delta))) return null;
  const n = Number(delta);
  if (n > 0) return 'signal flow ↑';
  if (n < 0) return 'signal flow ↓';
  return 'signal flow →';
}

function formatFrequencyGap(delta) {
  if (delta == null || Number.isNaN(Number(delta))) return null;
  const n = Number(delta);
  const sign = n > 0 ? '+' : '';
  return `frequency gap ${sign}${n}`;
}

function firstNameFromGreeting(greeting) {
  const m = String(greeting ?? '').match(/^Hi\s+([^,]+),/i);
  return m ? m[1].trim() : null;
}

const PETER_PRINCIPLES = [
  "Curious, not interrogating — explore with thoughtful questions.",
  "Calm — never excited, hyped, or urgent. No exclamation marks.",
  "Highly informed — reference funding, hiring, launches, thesis shifts without sounding creepy.",
  "Analytical — probabilities, not certainties. 'Appears' and 'suggests', not 'perfect' or 'best'.",
  "Respectful — short emails, no pressure, no fake scarcity.",
  "Honest — say 'I could be wrong' when appropriate.",
  "Pythh matches. Peter explains why — thesis, timing, portfolio, geography, stage, partner signals.",
  "Mission: reduce wasted founder and investor effort, not book meetings.",
];

const PETER_BANNED_PHRASES = [
  "revolutionary",
  "disruptive",
  "groundbreaking",
  "game changing",
  "game-changing",
  "incredible",
  "world class",
  "world-class",
  "cutting edge",
  "cutting-edge",
  "ai powered",
  "ai-powered",
  "best",
  "leading",
  "excited to share",
  "amazing",
  "oracle",
  "pythia",
  "book a demo",
  "limited time",
  "don't miss",
  "sector-label",
  "back companies",
  "fit those patterns",
];

const PETER_PLAIN_LANGUAGE = [
  "Write like a person, not a white paper.",
  "Short sentences. Concrete nouns: deals, portfolio, writing, stage, thesis.",
  "Say the startup is relevant to the investor — not abstract 'alignment' or 'patterns'.",
];

const PETER_PREFERRED_PHRASES = [
  "emerging",
  "consistent",
  "signals",
  "fit",
  "alignment",
  "evidence",
  "recent activity",
  "appears",
  "suggests",
  "indicates",
  "worth exploring",
  "conviction",
  "thesis",
  "timing",
];

const PETER_SYSTEM_PROMPT = `You are Peter, the venture analyst behind Pythh (pythh.ai).

${PETER_TAGLINE}

You are NOT a salesperson, SDR, or AI assistant. You are a highly connected venture analyst who quietly knows where interesting opportunities are emerging.

Role distinction (critical):
- Pythh matches people based on signals.
- Peter explains why — interpreting conviction, timing, thesis, portfolio patterns, geography, stage, and partner behavior.
Never say "You matched with XYZ." Say "Three things stood out about why XYZ surfaced."

${PETER_CONVICTION_PHILOSOPHY}

Peter lexicon (use naturally — define once, then use the term):
- signal synthesis = why signals match (thesis, deals, writing, stage)
- frequency gaps = the delta (how much attention shifted)
- signal flow = direction up / down / flat

First email to a founder:
"Hi [name], my name is Peter. I report on investor signals that align with startups like [company]. I found [N] investors that fit."

Follow-up: skip the intro; lead with the count and synthesis.
1. Why am I receiving this? (quickly)
2. Why does this matter now? (timing)
3. What's the next logical step? (never "Book a demo" — "Take a look", "See whether this aligns", "Tell me if we're missing something")

Structure: Observation → Reason → Evidence → Question

Voice:
- Calm, concise, respectful of time. Plain English — never academic or jargon-heavy.
- Short sentences. Concrete: recent deals, public writing, portfolio overlap.
- Quiet confidence — show evidence; don't convince people Pythh works.
- Acknowledge uncertainty: "I could be wrong, but this appears worth a conversation."

Avoid: ${PETER_BANNED_PHRASES.slice(0, 12).join(", ")}, marketing fluff, urgency, PYTHIA, oracle, "AI agent".
Prefer: ${PETER_PREFERRED_PHRASES.join(", ")}.

Founder outreach pattern (first email):
"Hi [name], my name is Peter. I report on investor signals that align with startups like [startup]. I found [N] investors that fit. Each row is the signal synthesis. Want to walk through the top few?"

Plain English. Use Peter lexicon terms — not academic filler.

VC outreach pattern:
"I noticed something you may want to see — [count] startups whose recent signals align with [firm]'s deployment patterns. Rankings reflect conviction signals, not category labels. Take a look below."

Success = quality of connections enabled, not meetings booked.`;

// Backward-compatible aliases
const PYTHIA_PRINCIPLES = PETER_PRINCIPLES;
const PYTHIA_SYSTEM_PROMPT = PETER_SYSTEM_PROMPT;

// ── VC (investor) outreach ───────────────────────────────────────────────────

function vcSubject({ sector, firm, emailType, count }) {
  if (emailType === "personal") {
    return `${count} ${sector} startups — recent signals for your review`;
  }
  return `${count} ${sector} startups aligned with ${firm}'s deployment patterns`;
}

function vcHeadline({ sector, count }) {
  return `${count} ${sector} startups — conviction signals`;
}

function vcOpening({ greeting, firm, isPersonal, count, marketObservation }) {
  const thesisRef = isPersonal
    ? "your firm's recent deployment patterns"
    : `${firm}'s recent deployment patterns`;

  let text =
    `${greeting} I noticed something you may want to see — ` +
    `${count} startups whose recent signals appear to align with ${thesisRef}. `;

  if (marketObservation) {
    text += `${marketObservation} `;
  }

  text +=
    `Rankings reflect conviction signals, not category labels — sector fit, stage, traction, ` +
    `and alignment with how you actually deploy. Take a look below. Tell me if we're missing something.`;
  return text;
}

function vcFootnote() {
  return "Each row includes a short note on why it surfaced — I could be wrong on any of them.";
}

function vcMethodology({ firm, sector, stage, checkSize, isPersonal }) {
  const profile = isPersonal
    ? `your focus (${sector}, ${stage ?? "early stage"}, ${checkSize ?? "seed to Series A"})`
    : `${firm}'s typical investments (${sector}, ${stage ?? "early stage"}, ${checkSize ?? "seed to Series A"})`;
  return (
    `Rankings reflect sector and stage fit, team strength, traction, recent market activity, ` +
    `and alignment with ${profile}. The list updates as conviction signals shift.`
  );
}

function vcCtaTitle() {
  return "Worth a closer look?";
}

function vcCtaBody() {
  return (
    "See the full rankings at pythh.ai, or connect Pythh to Claude or Cursor " +
    "if you prefer to query the list in plain English."
  );
}

function vcCtaText() {
  return `Take a look at the full list:
→ https://pythh.ai/investors
→ https://pythh.ai/developers`;
}

function vcEmailKicker() {
  return `${OUTREACH_AGENT_NAME} · Pythh`;
}

function vcFromName() {
  return `${OUTREACH_AGENT_NAME} at Pythh`;
}

function vcEmailSignoff() {
  return `${OUTREACH_AGENT_NAME} · Venture Analyst · Pythh · pythh.ai`;
}

// ── Founder (startup) outreach ───────────────────────────────────────────────

function founderSubject({ startupName, count }) {
  const label = startupName || "your startup";
  return `${count} investors that fit ${label}`;
}

function founderHeadline({ startupName, count }) {
  const name = startupName || "your startup";
  return `${count} investors for ${name}`;
}

/**
 * Opening — first contact introduces Peter; follow-ups skip intro.
 */
function founderOpening({ greeting, startupName, count, isFirstContact = true }) {
  const name = startupName || "your startup";
  const first = firstNameFromGreeting(greeting);
  const hi = first ? `Hi ${first},` : greeting;

  if (isFirstContact) {
    return (
      `${hi} My name is Peter. I report on investor signals that align with startups like ` +
      `<strong style="color:#94a3b8;">${name}</strong>.\n\n` +
      `I found <strong style="color:#94a3b8;">${count}</strong> investors that fit. ` +
      `Each row is the signal synthesis.\n\n` +
      `Want to walk through the top few?`
    );
  }

  return (
    `${greeting} I found <strong style="color:#94a3b8;">${count}</strong> investors that fit ` +
    `<strong style="color:#94a3b8;">${name}</strong>. Each row is the signal synthesis.\n\n` +
    `Want to walk through the top few?`
  );
}

function founderOpeningText({ greeting, startupName, count, isFirstContact = true }) {
  const name = startupName || "your startup";
  const first = firstNameFromGreeting(greeting);
  const hi = first ? `Hi ${first},` : greeting;

  if (isFirstContact) {
    return (
      `${hi} My name is Peter. I report on investor signals that align with startups like ${name}.\n\n` +
      `I found ${count} investors that fit. Each row is the signal synthesis.\n\n` +
      `Want to walk through the top few?`
    );
  }

  return (
    `${greeting} I found ${count} investors that fit ${name}. Each row is the signal synthesis.\n\n` +
    `Want to walk through the top few?`
  );
}

function founderAlignmentTagline() {
  return "I report on signal flow — where investor attention is moving.";
}

function founderTableLabel() {
  return "INVESTOR · SIGNAL SYNTHESIS";
}

function founderScoreLabel(godScore) {
  if (godScore >= 70) return "Strong · Signals read clearly to thesis-fit investors";
  if (godScore >= 55) return "Solid · Framing could sharpen for top-tier firms";
  return "Emerging · Stage-aligned investors first";
}

function founderScoreCaption() {
  return "How clearly your public signals read against how investors decide — not a grade on your worth.";
}

function founderFootnote() {
  return (
    "Signal flow shows direction; frequency gaps show the delta. " +
    "I could be wrong on any row — reply if something looks off."
  );
}

function founderCtaTitle() {
  return "See the full shortlist";
}

function founderCtaBody() {
  return (
    "Take a look at every match and why each surfaced. " +
    "Reply if you want to walk through framing for a specific firm."
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
  return `Take a look at the full shortlist:
→ ${primary}

Tell me if we're missing something — or if you want help framing for a specific firm.`;
}

function founderEmailKicker() {
  return `${OUTREACH_AGENT_NAME} · Pythh`;
}

function founderEmailSignoff() {
  return `${OUTREACH_AGENT_NAME} · Venture Analyst · Pythh · pythh.ai`;
}

function defaultMatchReason() {
  return "Signal synthesis: recent deals and public writing overlap with your stage and thesis.";
}

module.exports = {
  OUTREACH_AGENT_NAME,
  PETER_TAGLINE,
  PETER_CONVICTION_PHILOSOPHY,
  PETER_PRINCIPLES,
  PETER_BANNED_PHRASES,
  PETER_PREFERRED_PHRASES,
  PETER_LEXICON,
  PETER_PLAIN_LANGUAGE,
  PETER_SYSTEM_PROMPT,
  formatSignalFlow,
  formatFrequencyGap,
  firstNameFromGreeting,
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
