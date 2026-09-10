import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('top nav is Explore + Pricing, not a seven-link bar', () => {
  const nav = readFileSync(new URL('../site/components/SharedNavbar.tsx', import.meta.url), 'utf8');
  assert.match(nav, /AI for capital alignment/);
  assert.match(nav, /aria-haspopup="menu"/);
  assert.match(nav, /Explore/);
  assert.match(nav, /heading: "Founders"/);
  assert.match(nav, /heading: "Investors"/);
  assert.doesNotMatch(nav, /Daily Signal — prominent/);
  assert.doesNotMatch(nav, /NAV_LINKS = \[/);
  assert.match(nav, /Get daily matches/);
  assert.doesNotMatch(nav, /Automate your raise/);
});

test('homepage hero leads with one explained match and URL-first CTA', () => {
  const home = readFileSync(new URL('../site/Home.tsx', import.meta.url), 'utf8');
  const hero = readFileSync(new URL('../site/lib/heroHeadlineExperiment.ts', import.meta.url), 'utf8');
  const form = readFileSync(new URL('../site/components/NewsletterJoinForm.tsx', import.meta.url), 'utf8');
  assert.match(hero, /Find the investors most likely to fund your startup/);
  assert.match(hero, /HERO_HEADLINE_ACCENT = 'most likely to fund your startup'/);
  assert.match(home, /<HeroHeadline/);
  assert.match(hero, /Paste your website\. Pythh analyzes your market, traction, and investor thesis fit/);
  assert.doesNotMatch(hero, /You build the company/);
  assert.match(hero, /HERO_PRIMARY_CTA = 'Preview my matches'/);
  assert.match(home, /PREVIEW_MATCHES_CTA/);
  assert.match(home, /NewsletterJoinForm/);
  assert.match(home, /progressive/);
  assert.match(form, /progressive/);
  assert.match(form, /Where should we send the full ranked list/);
  assert.match(home, /id="hero-cta"/);
  assert.match(home, /id="hero-status-bar"/);
  assert.match(home, /<HomeFeaturedMatch/);
  assert.match(home, /<HomeProofStrip/);
  assert.doesNotMatch(home, /Investor Intelligence · Live/);
  assert.doesNotMatch(home, /<LiveMatchHighlight/);
  assert.doesNotMatch(home, /<SignalArtTeaser/);
  assert.doesNotMatch(home, /<AgentIntroSection/);
  assert.match(home, /<HomeLiveMatches/);
  assert.match(home, /<HomeLiveResults/);
});

test('homepage live board is a compact feed below the proof strip', () => {
  const board = readFileSync(new URL('../site/components/HomeLiveNetwork.tsx', import.meta.url), 'utf8');
  assert.match(board, /id="live-matches"/);
  assert.match(board, /id="live-results"/);
  assert.match(board, /useRecentMatches/);
  assert.match(board, /\/api\/newsletter\/today/);
  assert.match(board, /Who just got funded/);
  assert.match(board, /See all live matches/);
  assert.match(board, /limit = 3/);
  assert.doesNotMatch(board, /INVESTOR_SIGNALS/);
  assert.doesNotMatch(board, /Loading the match network/);
});

test('featured match and proof strip make scores and the pair claim readable', () => {
  const featured = readFileSync(new URL('../site/components/HomeFeaturedMatch.tsx', import.meta.url), 'utf8');
  const proof = readFileSync(new URL('../site/components/HomeProofStrip.tsx', import.meta.url), 'utf8');
  const tokens = readFileSync(new URL('../site/lib/designTokens.ts', import.meta.url), 'utf8');
  const indexHtml = readFileSync(new URL('../site/index.html', import.meta.url), 'utf8');
  assert.match(featured, /Investor fit:/);
  assert.match(featured, /How scoring works/);
  assert.match(featured, /Why this match/);
  assert.match(featured, /minHeight: 280/);
  assert.doesNotMatch(featured, /Loading the match/);
  assert.match(proof, /Verified outcome/);
  assert.match(proof, /Startups funded \(scale\)/);
  assert.match(proof, /Investors in the network/);
  assert.match(proof, /Later funded/);
  assert.match(proof, /Methodology/);
  assert.match(tokens, /MUTED = "oklch\(0\.74/);
  assert.doesNotMatch(indexHtml, /maximum-scale/);
});
