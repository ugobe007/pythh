/**
 * A raise campaign is the Pixero-shaped output of a URL:
 * strategy, deck, messaging, meetings, then the term sheet.
 * The investor list is who the campaign is taken to.
 */

export type RaiseStageId = 'strategy' | 'deck' | 'messaging' | 'meetings' | 'term_sheet';

export type RaiseStage = {
  id: RaiseStageId;
  label: string;
  title: string;
  body: string;
  status: string;
};

export type RaiseCampaignInput = {
  startupName: string;
  sectors?: string[] | null;
  stage?: string | null;
  godScore?: number | null;
  vcCount?: number | null;
  angelCount?: number | null;
  topInvestorName?: string | null;
  why?: string | null;
};

export type RaiseCampaign = {
  startupName: string;
  stages: RaiseStage[];
};

function roundLabel(stage?: string | null): string {
  const cleaned = stage?.replace(/-/g, ' ').trim();
  return cleaned ? `${cleaned} round` : 'this round';
}

function sectorLabel(sectors?: string[] | null): string {
  const first = sectors?.find((item) => item && item.trim());
  return first?.trim() || 'the market on your site';
}

export function buildRaiseCampaign(input: RaiseCampaignInput): RaiseCampaign {
  const name = input.startupName.trim() || 'Your startup';
  const round = roundLabel(input.stage);
  const sector = sectorLabel(input.sectors);
  const lead = input.topInvestorName?.trim() || 'the lead investor on this list';
  const why = input.why?.trim();
  const fit = why || `${name} and ${lead} line up for ${round}.`;
  const god = typeof input.godScore === 'number' ? ` Readiness score ${Math.round(input.godScore)}.` : '';
  const mix = [
    input.vcCount != null ? `${input.vcCount} VCs` : null,
    input.angelCount != null ? `${input.angelCount} angels` : null,
  ].filter(Boolean).join(' and ');
  const who = mix ? `${mix} fit ${round}.` : `The investors below fit ${round}.`;

  return {
    startupName: name,
    stages: [
      {
        id: 'strategy',
        label: 'Strategy',
        title: `Who funds ${round}`,
        body: `${who} Lead with ${lead}. ${fit}${god}`,
        status: 'Ready',
      },
      {
        id: 'deck',
        label: 'Deck',
        title: 'The story investors can underwrite',
        body: `Five slides from the site: the problem in ${sector}, why now, what ${name} has built, why ${lead} fits, and the ask for ${round}.`,
        status: 'Outline',
      },
      {
        id: 'messaging',
        label: 'Messaging',
        title: `The note to ${lead}`,
        body: fit,
        status: 'Draft',
      },
      {
        id: 'meetings',
        label: 'Meetings',
        title: 'Outreach that asks for the meeting',
        body: `We take that note to ${lead} and the rest of this list and ask for a meeting. Nothing is sent until you approve it.`,
        status: 'On approval',
      },
      {
        id: 'term_sheet',
        label: 'Term sheet',
        title: 'Help once a yes is on the table',
        body: 'When a meeting becomes a yes, we work the term sheet with you: valuation, ownership, and the terms that decide the round.',
        status: 'After a yes',
      },
    ],
  };
}
