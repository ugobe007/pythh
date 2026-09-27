export type CampaignStage = 'pre-seed' | 'seed' | 'series-a';
export type CampaignPriority = 'revenue' | 'hire' | 'customers' | 'product';

export type CampaignBrief = {
  url: string;
  stage: CampaignStage | null;
  hasRevenue: boolean | null;
  hasProduct: boolean | null;
  priorities: CampaignPriority[];
};

const KEY = 'pythh_campaign_brief';

export const STAGE_CHOICES: { id: CampaignStage; label: string }[] = [
  { id: 'pre-seed', label: 'Pre-seed' },
  { id: 'seed', label: 'Seed' },
  { id: 'series-a', label: 'Series A' },
];

export const PRIORITY_CHOICES: { id: CampaignPriority; label: string }[] = [
  { id: 'revenue', label: 'Reach revenue' },
  { id: 'hire', label: 'Hire the team' },
  { id: 'customers', label: 'Pick up customers' },
  { id: 'product', label: 'Ship the next version' },
];

function emptyBrief(url: string): CampaignBrief {
  return { url, stage: null, hasRevenue: null, hasProduct: null, priorities: [] };
}

export function readCampaignBrief(url: string): CampaignBrief {
  if (typeof sessionStorage === 'undefined') return emptyBrief(url);
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return emptyBrief(url);
    const parsed = JSON.parse(raw) as CampaignBrief;
    if (!parsed || parsed.url !== url) return emptyBrief(url);
    return {
      url,
      stage: parsed.stage ?? null,
      hasRevenue: typeof parsed.hasRevenue === 'boolean' ? parsed.hasRevenue : null,
      hasProduct: typeof parsed.hasProduct === 'boolean' ? parsed.hasProduct : null,
      priorities: Array.isArray(parsed.priorities) ? parsed.priorities : [],
    };
  } catch {
    return emptyBrief(url);
  }
}

export function writeCampaignBrief(brief: CampaignBrief): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(KEY, JSON.stringify(brief));
}

export function briefReadyForMatch(brief: CampaignBrief): boolean {
  return Boolean(brief.stage) && brief.hasRevenue != null && brief.hasProduct != null;
}

export function campaignSubmitBody(brief: CampaignBrief): Record<string, unknown> {
  return {
    funding_stage: brief.stage,
    has_revenue: brief.hasRevenue,
    has_product: brief.hasProduct,
    raise_priorities: brief.priorities,
  };
}
