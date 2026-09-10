import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { hasPaidRaiseAccess, PAID_RAISE_SERVICES } from '../site/lib/pricingPlans.ts';
import { buildDeckOutline } from '../lib/deckOutline.js';

test('free users do not have paid raise access; scout trialing does', () => {
  assert.equal(hasPaidRaiseAccess(null), false);
  assert.equal(hasPaidRaiseAccess({ plan: 'scout', status: 'canceled' }), false);
  assert.equal(hasPaidRaiseAccess({ plan: 'scout', status: 'trialing' }), true);
  assert.equal(hasPaidRaiseAccess({ plan: 'oracle', status: 'active' }), true);
  assert.equal(hasPaidRaiseAccess({ role: 'admin' }), true);
});

test('paid raise services include email, calls, term sheets, and PPT outline', () => {
  assert.deepEqual(
    PAID_RAISE_SERVICES.map((s) => s.id),
    ['email', 'calls', 'terms', 'deck'],
  );
});

test('deck outline positions the pitch without inventing dollars or likelihood', () => {
  const outline = buildDeckOutline({
    startup: {
      name: 'Readyforrobots',
      tagline: 'Autonomy for factory floors',
      sectors: ['Robotics', 'Industrial'],
      stage: 'seed',
      god_score: 60,
      score_components: { team: 55, traction: 40, market: 70, product: 62, vision: 58 },
    },
    matches: [
      { why_you_match: 'Stage match · industrial thesis', investor: { firm: 'Autotech Ventures' } },
    ],
    fundingStage: 'seed',
  });
  assert.equal(outline.slides.length, 10);
  assert.match(outline.positioning.thesis, /Readyforrobots/);
  assert.match(outline.slides[8].shouldSay, /Autotech Ventures/);
  const spoken = JSON.stringify({ thesis: outline.positioning.thesis, slides: outline.slides });
  assert.doesNotMatch(spoken, /likely to invest|\$[0-9]+B TAM/);
  assert.ok(outline.slides[6].shouldSay.includes('40/100'));
});

test('lead UI and relay require a paid plan for email', () => {
  const lead = readFileSync(new URL('../site/components/MatchInvestorLead.tsx', import.meta.url), 'utf8');
  const preview = readFileSync(new URL('../site/components/InstantMatchPreview.tsx', import.meta.url), 'utf8');
  const relay = readFileSync(new URL('../server/routes/matchLeadRelay.js', import.meta.url), 'utf8');
  assert.match(lead, /Email, calls, and the deck outline are on Scout/);
  assert.match(preview, /PaidRaisePanel/);
  assert.match(preview, /Matches are free/);
  assert.doesNotMatch(preview, /outreach optional later/);
  assert.match(relay, /requirePaidUser/);
  assert.match(relay, /plan_required/);
  assert.match(relay, /deck-outline/);
});
