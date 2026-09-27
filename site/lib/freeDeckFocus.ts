export type DeckFocusItem = {
  title: string;
  detail: string;
};

/** Same three priorities as the server when a startup has no sector or score yet. */
export const FREE_DECK_FOCUS: DeckFocusItem[] = [
  {
    title: 'Who pays',
    detail:
      'Name the buyer and the budget they already spend. One sentence a partner can repeat. Leave the market-size headline off the slide.',
  },
  {
    title: 'Proof you have',
    detail: 'Put the proof you already have on one slide: users, revenue, or a signed pilot. Do not invent a number.',
  },
  {
    title: 'Why you, why now',
    detail: 'Say why this team can win, and what changed so the raise is timely. If you cannot name the change, cut that slide.',
  },
];
