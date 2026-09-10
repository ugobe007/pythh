/**
 * Home / awareness hero headline experiment (vs Startups.com "10x faster" benchmark).
 */

import {
  fetchGrowthAssignment,
  trackGrowthEvent,
  type GrowthAssignment,
} from '@/lib/growthExperiment';

export const HEADLINE_EXPERIMENT_ID = 'founder_hero_headline_speed';

export type HeroHeadlineCopy = {
  headline: string;
  subline: string;
  cta: string;
};

export const HERO_PRIMARY_CTA = 'Preview my matches';

/** Accent phrase in the H1 — rendered in brand emerald. */
export const HERO_HEADLINE_ACCENT = 'most likely to fund your startup';

/** Public subline — URL first, ranked matches to the inbox. */
const TRUSTED_HERO_SUBLINE =
  'Paste your website. Pythh analyzes your market, traction, and investor thesis fit, then sends ranked matches to your inbox every morning.';

export function defaultHeroCopy(previewFirst: boolean): HeroHeadlineCopy {
  if (previewFirst) {
    return {
      headline: 'Find the investors most likely to fund your startup.',
      subline: TRUSTED_HERO_SUBLINE,
      cta: HERO_PRIMARY_CTA,
    };
  }
  return {
    headline: 'Find the investors most likely to fund your startup.',
    subline: TRUSTED_HERO_SUBLINE,
    cta: HERO_PRIMARY_CTA,
  };
}

export function mergeHeroHeadlineCopy(
  entryAssignment: GrowthAssignment | null,
  headlineAssignment: GrowthAssignment | null,
): HeroHeadlineCopy {
  const previewFirst = entryAssignment?.schema?.entry === 'url_with_preview';
  const defaults = defaultHeroCopy(previewFirst);
  return {
    // Keep the public promise stable. Historical growth experiments remain
    // useful for attribution, but must not overwrite the approved homepage.
    headline: defaults.headline,
    // Keep the public subline stable; stale experiments must not overwrite it.
    subline: TRUSTED_HERO_SUBLINE,
    // CTA label is fixed — experiment copy must not override (avoids stale "See my matches" from DB).
    cta: HERO_PRIMARY_CTA,
  };
}

export async function loadHeroExperiments(): Promise<{
  entry: GrowthAssignment | null;
  headline: GrowthAssignment | null;
}> {
  const [entry, headline] = await Promise.all([
    fetchGrowthAssignment('founder'),
    fetchGrowthAssignment('founder', HEADLINE_EXPERIMENT_ID),
  ]);
  return { entry, headline };
}

export function trackHeroHeadlineExposure(
  headlineAssignment: GrowthAssignment | null,
  path: string,
): void {
  if (!headlineAssignment) return;
  void trackGrowthEvent(headlineAssignment, 'hero_headline_viewed', { path });
}

export function trackHeroUrlSubmitted(
  url: string,
  source: string,
  headlineAssignment: GrowthAssignment | null,
): void {
  if (!headlineAssignment) return;
  void trackGrowthEvent(headlineAssignment, 'founder_url_submitted', { url, source });
}
