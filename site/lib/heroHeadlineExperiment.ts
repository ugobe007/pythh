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

export const HERO_PRIMARY_CTA = 'Automate your raise';

export function defaultHeroCopy(previewFirst: boolean): HeroHeadlineCopy {
  if (previewFirst) {
    return {
      headline: 'You build the company. Pythh runs the raise.',
      subline: 'Paste your URL — Oracle qualifies investors, runs outreach, and books meetings on your behalf.',
      cta: HERO_PRIMARY_CTA,
    };
  }
  return {
    headline: 'You build the company. Pythh runs the raise.',
    subline:
      'Submit your URL. Oracle analyzes your company, contacts fit investors, and runs outreach toward qualified meetings.',
    cta: HERO_PRIMARY_CTA,
  };
}

export function mergeHeroHeadlineCopy(
  entryAssignment: GrowthAssignment | null,
  headlineAssignment: GrowthAssignment | null,
): HeroHeadlineCopy {
  const previewFirst = entryAssignment?.schema?.entry === 'url_with_preview';
  const base = (entryAssignment?.copy ?? {}) as Partial<HeroHeadlineCopy>;
  const overlay = (headlineAssignment?.copy ?? {}) as Partial<HeroHeadlineCopy>;
  const defaults = defaultHeroCopy(previewFirst);
  const baseCopy = base as Partial<HeroHeadlineCopy>;
  const overlayCopy = overlay as Partial<HeroHeadlineCopy>;
  return {
    headline: overlayCopy.headline || baseCopy.headline || defaults.headline,
    subline: overlayCopy.subline || baseCopy.subline || defaults.subline,
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
