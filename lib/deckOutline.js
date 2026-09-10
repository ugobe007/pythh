'use strict';

/**
 * Paid PPT outline — what each slide should say and how to position the pitch.
 * Uses only fields we already have. Does not invent traction dollars or raise amounts.
 */

function text(value) {
  if (value == null) return '';
  return String(value).trim();
}

function sectorLine(sectors) {
  if (!Array.isArray(sectors) || !sectors.length) return null;
  return sectors.map((s) => String(s).trim()).filter(Boolean).slice(0, 3).join(' · ');
}

function scoreLine(components) {
  const c = components || {};
  const parts = ['team', 'traction', 'market', 'product', 'vision']
    .map((key) => {
      const n = Number(c[key]);
      return Number.isFinite(n) ? `${key} ${Math.round(n)}/100` : null;
    })
    .filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

function topFirmNames(matches, limit = 5) {
  const names = [];
  const seen = new Set();
  for (const match of Array.isArray(matches) ? matches : []) {
    const inv = match.investor || {};
    const label = text(inv.firm) || text(inv.name);
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(label);
    if (names.length >= limit) break;
  }
  return names;
}

function buildDeckOutline({ startup = {}, matches = [], fundingStage = null } = {}) {
  const name = text(startup.name) || 'Your startup';
  const tagline = text(startup.tagline);
  const description = text(startup.description);
  const stage = text(fundingStage || startup.stage).replace(/-/g, ' ');
  const sectors = sectorLine(startup.sectors);
  const god = Number.isFinite(Number(startup.god_score)) ? Math.round(Number(startup.god_score)) : null;
  const scores = scoreLine(startup.score_components);
  const firms = topFirmNames(matches);
  const whyBits = (Array.isArray(matches) ? matches : [])
    .map((m) => text(m.why_you_match).split(/\s*[·•]\s*/)[0])
    .filter(Boolean)
    .slice(0, 3);

  const positioning = {
    thesis: [
      name,
      sectors ? `is a ${sectors} company` : 'should name the category in one line',
      stage ? `raising a ${stage} round` : 'should confirm the round before the ask slide',
      tagline ? `— ${tagline}` : '',
    ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim(),
    say: whyBits.length
      ? whyBits
      : ['Lead with the buyer and the job to be done.', 'Show proof you already have — not a TAM fantasy.', 'Name the five firms this shortlist already ranked.'],
    avoid: [
      'Do not put a likelihood or “they will fund you” claim on any slide.',
      'Do not invent revenue, users, or a raise amount we do not have.',
      'Do not paste investor email addresses into the deck.',
    ],
  };

  const slides = [
    {
      n: 1,
      title: 'Title',
      shouldSay: `${name}${tagline ? ` — ${tagline}` : ''}. One category line${sectors ? ` (${sectors})` : ''}. Founder names on the footer.`,
      position: 'The first five seconds should tell a partner what you sell and to whom.',
    },
    {
      n: 2,
      title: 'Problem',
      shouldSay: description
        ? `Open with the pain in the current workflow. Use this as source material, not as slide copy: ${description.slice(0, 280)}`
        : 'Name the buyer, the broken workflow, and the cost of the status quo. No market-size number unless you can source it.',
      position: 'Make the problem expensive and specific. Avoid “the $XBbn market.”',
    },
    {
      n: 3,
      title: 'Solution',
      shouldSay: `${name} should be the obvious next sentence after the problem. Show the product doing the job, not a feature dump.`,
      position: 'One sentence a partner can repeat in their Monday meeting.',
    },
    {
      n: 4,
      title: 'Why now',
      shouldSay: 'The change in the market, regulation, or buyer stack that makes this raise timely. If you do not have one, cut the slide.',
      position: 'Timing is a fact, not a vibe.',
    },
    {
      n: 5,
      title: 'Market',
      shouldSay: sectors
        ? `Define the ${sectors} buyer and the budget they already spend. Bottom-up count beats a top-down TAM.`
        : 'Define the buyer and the budget they already spend. Bottom-up count beats a top-down TAM.',
      position: 'Partners underwrite a customer, not a category headline.',
    },
    {
      n: 6,
      title: 'Product',
      shouldSay: 'Three screens or one architecture diagram. What is hard to copy.',
      position: 'Proof you built it. Not a roadmap of things you might build.',
    },
    {
      n: 7,
      title: 'Traction',
      shouldSay: scores
        ? `Use only numbers you can defend. Internal GOD components on file: ${scores}${god != null ? ` · GOD ${god}/100` : ''}. Do not turn those scores into revenue.`
        : 'Use only numbers you can defend: revenue, users, logos, waitlist, or design partners. If you have none, show speed of learning.',
      position: 'A real number beats a projected hockey stick.',
    },
    {
      n: 8,
      title: 'Team',
      shouldSay: 'Who built this before, who owns the customer, who writes the code. Gaps you are hiring for this raise.',
      position: 'Partners bet on the people who will still be in the room after the wire.',
    },
    {
      n: 9,
      title: 'Why these investors',
      shouldSay: firms.length
        ? `Walk the room through this shortlist: ${firms.join(', ')}. One line each on thesis fit — not a claim they will invest.`
        : 'Show the five firms you are actually walking. Thesis fit only.',
      position: 'This slide is a map, not a prediction.',
    },
    {
      n: 10,
      title: 'Ask',
      shouldSay: stage
        ? `State the ${stage} raise only if the amount is real. Use of proceeds in three buckets. 18-month milestone.`
        : 'Confirm the round first. Then amount, use of proceeds in three buckets, 18-month milestone.',
      position: 'The ask is a number and a plan, not a teaser.',
    },
  ];

  return {
    startup_name: name,
    positioning,
    slides,
  };
}

module.exports = { buildDeckOutline };
