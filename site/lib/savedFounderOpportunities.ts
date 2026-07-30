export type SavedFounderOpportunity = {
  key: string;
  type: 'pitch_event' | 'angel_group';
  slug: string;
  name: string;
  organizer?: string;
  location?: string;
  schedule?: string;
  applicationUrl: string;
  why: string;
  startupId?: string;
  savedAt: string;
};

const STORAGE_KEY = 'pythh:saved-founder-opportunities:v1';
export const SAVED_OPPORTUNITIES_EVENT = 'pythh:saved-opportunities-changed';

export function readSavedFounderOpportunities(): SavedFounderOpportunity[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function isFounderOpportunitySaved(type: SavedFounderOpportunity['type'], slug: string): boolean {
  const key = `${type}:${slug}`;
  return readSavedFounderOpportunities().some((item) => item.key === key);
}

export function toggleSavedFounderOpportunity(
  opportunity: Omit<SavedFounderOpportunity, 'key' | 'savedAt'>,
): { saved: boolean; items: SavedFounderOpportunity[] } {
  const key = `${opportunity.type}:${opportunity.slug}`;
  const current = readSavedFounderOpportunities();
  const exists = current.some((item) => item.key === key);
  const items = exists
    ? current.filter((item) => item.key !== key)
    : [{ ...opportunity, key, savedAt: new Date().toISOString() }, ...current];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(SAVED_OPPORTUNITIES_EVENT, { detail: items }));
  return { saved: !exists, items };
}
