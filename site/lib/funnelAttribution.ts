/**
 * UTM + url_submitted attribution for funnel analytics.
 */

import { trackFunnelEvent } from '@/lib/matchEngagement';
import { trackGrowthEvent, type GrowthAssignment } from '@/lib/growthExperiment';

const UTM_STORAGE_KEY = 'pythh_utm';

function getUtmParamsFromSearch(search: string): Record<string, string> {
  const params = new URLSearchParams(search);
  const out: Record<string, string> = {};
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
    const v = params.get(key);
    if (v) out[key] = v;
  }
  return out;
}

/** Persist UTMs from landing URL for later funnel events (e.g. Peter email → /activate). */
export function captureUtmFromUrl(): void {
  if (typeof window === 'undefined') return;
  const utm = getUtmParamsFromSearch(window.location.search);
  if (Object.keys(utm).length) {
    sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utm));
  }
}

export function getUtmParams(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const fromUrl = getUtmParamsFromSearch(window.location.search);
  if (Object.keys(fromUrl).length) return fromUrl;
  try {
    const raw = sessionStorage.getItem(UTM_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Record<string, string>;
  } catch {
    /* ignore */
  }
  return {};
}

/** Fire ai_logs url_submitted + optional growth founder_url_submitted with UTM attribution. */
export function trackUrlSubmitted(
  url: string,
  source: string,
  assignment?: GrowthAssignment | null,
): void {
  const utm = getUtmParams();
  void trackFunnelEvent('url_submitted', { url, source, ...utm });
  if (assignment) {
    void trackGrowthEvent(assignment, 'founder_url_submitted', { url, source, ...utm });
  }
}

const FIRST_PREVIEW_KEY = 'pythh_first_preview_at';

/** Record first preview timestamp; emit return_visit_7d when user returns within 7 days. */
export function trackReturnVisitIfEligible(path: string): void {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  const raw = localStorage.getItem(FIRST_PREVIEW_KEY);
  if (!raw) {
    localStorage.setItem(FIRST_PREVIEW_KEY, String(now));
    return;
  }
  const first = parseInt(raw, 10);
  if (!Number.isFinite(first) || first === now) return;
  const daysSince = (now - first) / 86_400_000;
  if (daysSince <= 0 || daysSince > 7) return;
  const sessionKey = `pythh_return_visit_logged:${path}`;
  if (sessionStorage.getItem(sessionKey)) return;
  sessionStorage.setItem(sessionKey, '1');
  void trackFunnelEvent('return_visit_7d', {
    path,
    days_since_first_preview: Math.round(daysSince * 10) / 10,
    source: 'return_visit_hook',
  });
}

export function markFirstPreviewSeen(): void {
  if (typeof window === 'undefined') return;
  if (!localStorage.getItem(FIRST_PREVIEW_KEY)) {
    localStorage.setItem(FIRST_PREVIEW_KEY, String(Date.now()));
  }
}
