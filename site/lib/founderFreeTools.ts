/**
 * Free account tools. Built only from the public story, scores, shortlist,
 * and sourced example companies. Does not invent revenue, people, or competitors.
 */

export type ScoreComponents = {
  team?: number | null;
  traction?: number | null;
  market?: number | null;
  product?: number | null;
  vision?: number | null;
};

export type ToolMatch = {
  match_score?: number | null;
  why_you_match?: string | null;
  investor_class?: string | null;
  investor?: { name?: string | null; firm?: string | null } | null;
};

export type ToolExample = {
  kind: string;
  name: string;
  sector: string;
  headline: string;
  caveat?: string | null;
  sourceName: string;
  sourceUrl: string;
};

export type DeckRecommendation = {
  title: string;
  body: string;
};

export type PositioningExample = {
  name: string;
  headline: string;
  why: string;
  sourceName: string;
  sourceUrl: string;
  caveat: string | null;
  fit: 'same' | 'adjacent' | 'example';
};

export type AdvisorMatch = {
  name: string;
  firm: string | null;
  why: string;
  score: number | null;
};

type DeckInput = {
  startupName: string;
  tagline?: string | null;
  description?: string | null;
  sectors?: string[] | null;
  stage?: string | null;
  scoreComponents?: ScoreComponents | null;
  matches?: ToolMatch[] | null;
};

function scoreLine(label: string, score: number | null): string {
  return score == null ? `${label} is not on this profile yet.` : `${label} is ${score}/100.`;
}

const COMPONENT_ADVICE: Record<keyof ScoreComponents, { title: string; line: (score: number | null, sector: string) => string }> = {
  traction: {
    title: 'Put proof on the traction slide',
    line: (score) =>
      `${scoreLine('Traction', score)} One sourced number — customers, usage, or revenue you can point to — beats a chart of hopes. Do not invent a run rate.`,
  },
  team: {
    title: 'Name who has already done this',
    line: (score) =>
      `${scoreLine('Team', score)} Put the founders on the slide and the one thing each has already shipped or sold. Do not add advisors you have not asked.`,
  },
  market: {
    title: 'Name the buyer, not the market size',
    line: (score, sector) =>
      `${scoreLine('Market', score)} Define the ${sector} buyer and the budget they already spend. Skip a top-down TAM you cannot source.`,
  },
  product: {
    title: 'Show the product doing one job',
    line: (score) =>
      `${scoreLine('Product', score)} One screen of the product doing the job is the slide. A feature list is not.`,
  },
  vision: {
    title: 'Write the sentence a partner can repeat',
    line: (score) =>
      `${scoreLine('Vision', score)} One sentence: who it is for, and what changes if you win. Cut the mission paragraph.`,
  },
};

function sectorLabel(sectors?: string[] | null): string {
  const first = sectors?.find((item) => item && item.trim());
  return first?.trim() || 'your';
}

function componentScore(components: ScoreComponents | null | undefined, key: keyof ScoreComponents): number | null {
  const value = components?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : null;
}

export function buildDeckAssessment(input: DeckInput): DeckRecommendation[] {
  const sector = sectorLabel(input.sectors);
  const ranked = (Object.keys(COMPONENT_ADVICE) as (keyof ScoreComponents)[])
    .map((key) => {
      const score = componentScore(input.scoreComponents, key);
      const advice = COMPONENT_ADVICE[key];
      return {
        priority: score == null ? -1 : score,
        title: advice.title,
        body: advice.line(score, sector),
      };
    })
    .sort((left, right) => left.priority - right.priority || left.title.localeCompare(right.title));

  const recommendations = ranked.slice(0, 5).map(({ title, body }) => ({ title, body }));
  const firms = (input.matches || [])
    .map((match) => {
      const angel = String(match.investor_class || '').toLowerCase() === 'angel';
      const label = angel
        ? match.investor?.name || match.investor?.firm
        : match.investor?.firm || match.investor?.name;
      return label?.trim() || '';
    })
    .filter((name) => name.length > 0)
    .slice(0, 3);
  if (firms.length && recommendations.length === 5) {
    recommendations[4] = {
      title: 'Name the investors this shortlist already ranked',
      body: `The ask slide can name ${firms.join(', ')}. Say why each fits. The shortlist is a fit list, not a commitment.`,
    };
  }
  if (!input.stage?.trim() && recommendations.length === 5) {
    recommendations[3] = {
      title: 'Confirm the round before the ask',
      body: 'The public story does not name the round. Put seed, Series A, or whatever it is on the ask slide before you send the deck.',
    };
  }
  return recommendations.slice(0, 5);
}

const GENERIC_TOKENS = new Set(['ai', 'ml', 'for', 'and', 'the', 'tech']);

function tokens(value: string): string[] {
  return value.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 1);
}

function categoryFit(sectors: string[] | null | undefined, exampleSector: string): PositioningExample['fit'] {
  const startup = new Set(tokens((sectors || []).join(' ')));
  const example = tokens(exampleSector);
  if (example.some((token) => !GENERIC_TOKENS.has(token) && startup.has(token))) return 'same';
  if (example.some((token) => token === 'ai') && (startup.has('ai') || startup.has('ml'))) return 'adjacent';
  return 'example';
}

export function buildPositioning(
  input: { startupName: string; tagline?: string | null; description?: string | null; sectors?: string[] | null },
  examples: ToolExample[],
): { thesis: string; examples: PositioningExample[] } {
  const name = input.startupName.trim() || 'Your startup';
  const tagline = input.tagline?.trim();
  const description = input.description?.trim();
  const sector = sectorLabel(input.sectors);
  const thesis = tagline
    ? `${name} — ${tagline}`
    : description
      ? `${name} — ${description.slice(0, 160)}${description.length > 160 ? '…' : ''}`
      : `${name} still needs a one-line description of the ${sector} job.`;

  const startups = examples.filter((example) => example.kind !== 'new_fund' && example.name && example.sourceUrl);
  const ranked = startups
    .map((example) => ({ example, fit: categoryFit(input.sectors, example.sector) }))
    .sort((left, right) => {
      const order = { same: 0, adjacent: 1, example: 2 };
      return order[left.fit] - order[right.fit];
    })
    .slice(0, 3)
    .map(({ example, fit }) => {
      const lead = `They led with: ${example.headline}.`;
      const why = fit === 'same'
        ? `Close to your category (${example.sector}). ${lead}`
        : fit === 'adjacent'
          ? `Also filed under AI, in ${example.sector}. ${lead} Not a claim that you compete.`
          : `Different category (${example.sector}). ${lead} Use it as a positioning example, not a comp.`;
      return {
        name: example.name,
        headline: example.headline,
        why,
        sourceName: example.sourceName,
        sourceUrl: example.sourceUrl,
        caveat: example.caveat || null,
        fit,
      };
    });

  return { thesis, examples: ranked };
}

export function buildAdvisorMatches(matches: ToolMatch[] | null | undefined): {
  advisors: AdvisorMatch[];
  note: string;
} {
  const advisors = (matches || [])
    .filter((match) => {
      const klass = String(match.investor_class || '').toLowerCase();
      const why = String(match.why_you_match || '').toLowerCase();
      return klass === 'angel' || /\b(angel|operator|advisor)\b/.test(why);
    })
    .slice(0, 5)
    .map((match) => {
      const name = match.investor?.name?.trim() || match.investor?.firm?.trim() || 'Advisor';
      const firm = match.investor?.firm && match.investor.firm !== name ? match.investor.firm : null;
      const why = match.why_you_match?.trim()
        || 'On your shortlist as an angel or operator. A conversation is not an intro.';
      return {
        name,
        firm,
        why,
        score: typeof match.match_score === 'number' ? Math.round(match.match_score) : null,
      };
    });

  if (!advisors.length) {
    return {
      advisors: [],
      note: 'No angel or operator is on this shortlist. Fund partners stay investors. We will not invent an advisor.',
    };
  }
  return {
    advisors,
    note: 'Already on your shortlist. Collecting this does not email them. Nothing is sent until you approve it.',
  };
}
