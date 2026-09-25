declare module '@marketMovement' {
  export interface MarketMovementCard {
    id: string;
    kind: 'revenue_breakout' | 'acquisition' | 'new_fund' | 'growth' | 'funding_round';
    label: string;
    name: string;
    sector: string;
    headline: string;
    detail: string;
    caveat: string | null;
    sourceName: string;
    sourceUrl: string;
    companyUrl: string | null;
    asOf: string | null;
    heat: number;
    investors: string[];
  }

  export function curatedMarketMovements(): MarketMovementCard[];
}
