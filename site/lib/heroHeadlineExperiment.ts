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

export const HERO_PRIMARY_CTA = 'Find matches';

/** Accent phrase in the H1 — rendered in brand emerald. */
export const HERO_HEADLINE_ACCENT = 'Meet Your Investors';

/** Public subline — URL first, so the field is the obvious next step. */
const TRUSTED_HERO_SUBLINE =
  'Paste your startup URL below. We score the company and rank investors for this round.';

export function defaultHeroCopy(previewFirst: boolean): HeroHeadlineCopy {
  const headline = 'Meet Your Investors. We connect the dots to fund your round.';
  if (previewFirst) {
    return {
      headline,
      subline: TRUSTED_HERO_SUBLINE,
      cta: HERO_PRIMARY_CTA,
    };
  }
  return {
    headline,
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
