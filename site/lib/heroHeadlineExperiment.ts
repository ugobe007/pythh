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

export function defaultHeroCopy(previewFirst: boolean): HeroHeadlineCopy {
  if (previewFirst) {
    return {
      headline: 'Find investors that match your signals.',
      subline: 'Paste your URL — ranked shortlist in ~20 seconds. Free preview.',
      cta: 'See my matches',
    };
  }
  return {
    headline: 'Find investors that match your thesis.',
    subline:
      'Submit your URL. Pythh reads your signals, matches you to top investors and automates your funding round.',
    cta: 'Find my investors',
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
  return {
    headline: overlay.headline || base.headline || defaults.headline,
    subline: overlay.subline || base.subline || defaults.subline,
    cta: overlay.cta || base.cta || defaults.cta,
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
