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
  const proofStrip = readFileSync(new URL('../site/components/HomeProofStrip.tsx', import.meta.url), 'utf8');
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
  assert.match(home, /revealMatches/);
  assert.match(home, /persistJoinPreview/);
  assert.match(form, /progressive/);
  assert.match(form, /revealMatches/);
  assert.match(form, /See my matches/);
  assert.match(form, /Opening your first five investor matches/);
  assert.match(form, /Where should we send the full ranked list/);
  assert.match(home, /id="hero-cta"/);
  assert.match(proofStrip, /id="hero-status-bar"/);
  assert.match(home, /<HomeFeaturedMatch/);
  assert.match(home, /<HomeProofStrip/);
  assert.doesNotMatch(home, /Investor Intelligence · Live/);
  assert.doesNotMatch(home, /<LiveMatchHighlight/);
  assert.doesNotMatch(home, /<SignalArtTeaser/);
  assert.doesNotMatch(home, /<AgentIntroSection/);
  assert.match(home, /<HomeLiveTape/);
});

test('homepage live board is a compact feed below the proof strip', () => {
  const board = readFileSync(new URL('../site/components/HomeLiveNetwork.tsx', import.meta.url), 'utf8');
  assert.match(board, /id="live-matches"/);
  assert.match(board, /id="live-results"/);
  assert.match(board, /useRecentMatches/);
  assert.match(board, /\/api\/newsletter\/today/);
  assert.match(board, /Who just got funded/);
  assert.match(board, /HomeLiveTape/);
  assert.match(board, /LivewireMatchPanel/);
  assert.match(board, /LIVEWIRE_PAGE_SIZE/);
  assert.match(board, /LIVE_TAPE_POOL/);
  assert.doesNotMatch(board, /INVESTOR_SIGNALS/);
  assert.doesNotMatch(board, /Loading the match network/);
});

test('featured match is a six-row livewire tape and proof strip keeps the pair claim', () => {
  const featured = readFileSync(new URL('../site/components/HomeFeaturedMatch.tsx', import.meta.url), 'utf8');
  const panel = readFileSync(new URL('../site/components/LivewireMatchPanel.tsx', import.meta.url), 'utf8');
  const proof = readFileSync(new URL('../site/components/HomeProofStrip.tsx', import.meta.url), 'utf8');
  const tokens = readFileSync(new URL('../site/lib/designTokens.ts', import.meta.url), 'utf8');
  const indexHtml = readFileSync(new URL('../site/index.html', import.meta.url), 'utf8');
  assert.match(featured, /FEATURED_PAGE_SIZE = LIVEWIRE_PAGE_SIZE/);
  assert.match(panel, /LIVEWIRE_PAGE_SIZE = 6/);
  assert.match(panel, /Livewire matches/);
  assert.match(panel, /Inspect the network/);
  assert.match(featured, /LivewireMatchPanel/);
  assert.doesNotMatch(featured, /Investor fit:/);
  assert.doesNotMatch(featured, /Startup GOD/);
  assert.doesNotMatch(featured, /Why this match/);
  assert.doesNotMatch(featured, /matchReasons/);
  assert.doesNotMatch(featured, /Loading the match/);
  assert.match(proof, /Verified outcome/);
  assert.match(proof, /Startups funded \(scale\)/);
  assert.match(proof, /Investors in the network/);
  assert.match(proof, /Later funded/);
  assert.match(proof, /Methodology/);
  assert.match(tokens, /MUTED = "oklch\(0\.74/);
  assert.doesNotMatch(indexHtml, /maximum-scale/);
});

test('homepage featured match and live tape rotate through a pool', () => {
  const featured = readFileSync(new URL('../site/components/HomeFeaturedMatch.tsx', import.meta.url), 'utf8');
  const tape = readFileSync(new URL('../site/components/HomeLiveNetwork.tsx', import.meta.url), 'utf8');
  assert.match(featured, /FEATURED_PAGE_SIZE = LIVEWIRE_PAGE_SIZE/);
  assert.match(featured, /FEATURED_MATCH_POOL = 18/);
  assert.match(featured, /FEATURED_MATCH_FETCH = 20/);
  assert.match(featured, /FEATURED_MATCH_ROTATE_MS = 8000/);
  assert.match(featured, /uniqueMatchPairs/);
  assert.match(featured, /setInterval/);
  assert.match(featured, /prefers-reduced-motion/);
  assert.match(featured, /LivewireMatchPanel/);
  assert.match(tape, /LIVE_TAPE_POOL = 18/);
  assert.match(tape, /uniqueMatchPairs/);
  assert.match(tape, /LIVE_TAPE_ROTATE_MS = 8000/);
  assert.match(tape, /setInterval/);
  assert.match(tape, /LivewireMatchPanel/);
  assert.match(tape, /id="live-matches-next"/);
});

test('homepage sections use purple chrome and keep emerald for scores and CTAs', () => {
  const tokens = readFileSync(new URL('../site/lib/designTokens.ts', import.meta.url), 'utf8');
  const home = readFileSync(new URL('../site/Home.tsx', import.meta.url), 'utf8');
  const proof = readFileSync(new URL('../site/components/HomeProofStrip.tsx', import.meta.url), 'utf8');
  const featured = readFileSync(new URL('../site/components/HomeFeaturedMatch.tsx', import.meta.url), 'utf8');
  const panel = readFileSync(new URL('../site/components/LivewireMatchPanel.tsx', import.meta.url), 'utf8');
  assert.match(tokens, /PURPLE_ACCENT = "oklch\(0\.72 0\.16 305\)"/);
  assert.match(tokens, /PURPLE_WASH = "oklch\(0\.14 0\.03 305\)"/);
  assert.match(tokens, /export const PURPLE = G/);
  assert.match(home, /PURPLE_WASH/);
  assert.match(home, /PURPLE_ACCENT/);
  assert.match(proof, /PURPLE_ACCENT/);
  assert.match(proof, /color: G/);
  assert.match(featured, /LivewireMatchPanel/);
  assert.match(panel, /PURPLE_BORDER/);
  assert.match(panel, /PURPLE_ACCENT/);
  assert.match(panel, /Inspect the network/);
  assert.match(panel, /GOLD/);
});
