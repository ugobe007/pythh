import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('top nav is Product + Pricing, not a seven-link bar', () => {
  const nav = readFileSync(new URL('../site/components/SharedNavbar.tsx', import.meta.url), 'utf8');
  assert.match(nav, /AI for capital alignment/);
  assert.match(nav, /aria-haspopup="menu"/);
  assert.match(nav, /Product/);
  assert.match(nav, /heading: "Founders"/);
  assert.match(nav, /heading: "Investors"/);
  assert.doesNotMatch(nav, /Daily Signal — prominent/);
  assert.doesNotMatch(nav, /NAV_LINKS = \[/);
});

test('homepage hero leads with capital alignment and one CTA', () => {
  const home = readFileSync(new URL('../site/Home.tsx', import.meta.url), 'utf8');
  const hero = readFileSync(new URL('../site/lib/heroHeadlineExperiment.ts', import.meta.url), 'utf8');
  assert.match(hero, /We Find Investors Who Will Fund You/);
  assert.match(hero, /HERO_PRIMARY_CTA = 'Automate your raise'/);
  assert.match(home, /id="hero-cta"/);
  assert.match(home, /id="hero-status-bar"/);
  assert.match(home, /Startups funded/);
  assert.match(home, /Matches funded/);
  assert.match(home, /Investors/);
  assert.doesNotMatch(home, /Investor Intelligence · Live/);
  assert.doesNotMatch(home, /<LiveMatchHighlight/);
  assert.doesNotMatch(home, /<SignalArtTeaser/);
  assert.doesNotMatch(home, /<AgentIntroSection/);
});
