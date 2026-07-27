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

export const HERO_PRIMARY_CTA = 'See my five matches';

const TRUSTED_HERO_SUBLINE =
  'Paste your startup URL. Create a free account to reveal five matched investors and save your results.';

export function defaultHeroCopy(previewFirst: boolean): HeroHeadlineCopy {
  if (previewFirst) {
    return {
      headline: 'Find five investors who fit your startup.',
      subline: TRUSTED_HERO_SUBLINE,
      cta: HERO_PRIMARY_CTA,
    };
  }
  return {
    headline: 'Find five investors who fit your startup.',
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
    // Keep the expectation-setting copy stable; stale experiments must not
    // reintroduce claims that outreach happens before founder approval.
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
