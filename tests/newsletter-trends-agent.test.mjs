import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  collectEvidence,
  templateTrendReport,
} = require('../server/lib/newsletterTrendAgent.js');
const {
  newsletterPublicUrl,
  newsletterOutboundLine,
} = require('../lib/newsletterOutbound.js');
const { buildBriefEmailHtml, buildBriefEmailText } = require('../server/lib/newsletterEmail.js');
const { vcCtaText, founderCtaText, founderEmailSignoff, vcEmailSignoff } = require('../lib/pythiaVoice.js');
const { buildColdEmail } = require('../lib/outreachEmailCopy.js');

const home = readFileSync(new URL('../site/Home.tsx', import.meta.url), 'utf8');
const newsletterPage = readFileSync(new URL('../site/pages/Newsletter.tsx', import.meta.url), 'utf8');
const generator = readFileSync(new URL('../server/newsletter-generator.js', import.meta.url), 'utf8');
const peterFounder = readFileSync(new URL('../scripts/peter-founder-outreach.mjs', import.meta.url), 'utf8');
const peterInvestor = readFileSync(new URL('../scripts/peter-investor-outreach.mjs', import.meta.url), 'utf8');
const outreachAgent = readFileSync(new URL('../scripts/outreach-agent.js', import.meta.url), 'utf8');
const activation = readFileSync(new URL('../server/lib/founderActivationEmail.js', import.meta.url), 'utf8');
const dealflow = readFileSync(new URL('../scripts/investor-dealflow-digest.mjs', import.meta.url), 'utf8');
const portfolioDelta = readFileSync(new URL('../scripts/investor-portfolio-delta-digest.mjs', import.meta.url), 'utf8');
const weeklySignal = readFileSync(new URL('../scripts/send-weekly-signal-digest.js', import.meta.url), 'utf8');
const pkg = readFileSync(new URL('../package.json', import.meta.url), 'utf8');

function sampleEdition() {
  return {
    date: '2026-09-22',
    hottestStartups: [
      {
        name: 'Lumen',
        why: 'live signal: news momentum · Strongest on traction 88',
        pillars: [{ label: 'team', value: 42 }, { label: 'traction', value: 88 }],
        repeat_founder: false,
        signals: { news_momentum: 1.2 },
      },
      {
        name: 'Atlas',
        why: 'repeat founder · Strongest on team 91',
        pillars: [{ label: 'team', value: 91 }, { label: 'traction', value: 70 }],
        repeat_founder: true,
        signals: { news_momentum: 0.2 },
      },
    ],
    signalsThatMatter: {
      leading: { label: 'News Momentum', blurb: 'press and mention velocity', pct: 64 },
      coverage: 120,
    },
    sectorTrends: [{ sector: 'AI Infra' }],
    moneyMoves: [{ company: 'Lumen', stage: 'Seed' }],
    topMatches: [{ startup: { name: 'Lumen' }, investor: { firm_name: 'Accel' } }],
    vcNews: [{ title: 'Hot AI infra startup draws spotlight after seed' }],
  };
}

test('trend agent names optics, team shape, and growth-rate screens', () => {
  const evidence = collectEvidence(sampleEdition(), {
    signalsThatMatter: { leading: { label: 'Investor Receptivity' } },
    sectorTrends: [{ sector: 'Fintech' }],
  });
  assert.ok(evidence.opticsNames.includes('Lumen'));
  assert.ok(evidence.soloNames.includes('Lumen'));
  assert.ok(evidence.growthNames.includes('Lumen'));
  assert.ok(evidence.repeatNames.includes('Atlas'));
  assert.equal(evidence.signalShift.from, 'Investor Receptivity');
  assert.equal(evidence.signalShift.to, 'News Momentum');

  const report = templateTrendReport(evidence);
  assert.match(report.headline, /Attention|Growth|Team|preference/i);
  const keys = report.drivers.map((d) => d.key);
  assert.ok(keys.includes('optics'));
  assert.ok(keys.includes('team'));
  assert.ok(keys.includes('growth'));
  assert.ok(keys.includes('sentiment'));
  assert.ok(report.shifts.some((s) => /News Momentum/.test(s.detail)));
  assert.match(report.thesis, /preference/);
});

test('trend report ships on the compiled edition and Daily Signal page', () => {
  assert.match(generator, /runNewsletterTrendAgent/);
  assert.match(generator, /result\.trendReport/);
  assert.match(newsletterPage, /trendReport/);
  assert.match(newsletterPage, /shaping capital/);
});

test('homepage points readers at /newsletter as Daily Signal', () => {
  const nav = readFileSync(new URL('../site/components/SharedNavbar.tsx', import.meta.url), 'utf8');
  assert.match(home, /href="\/newsletter"/);
  assert.match(home, /data-testid="hero-daily-signal"/);
  assert.match(home, /Read today.?s Daily Signal|Read today&rsquo;s Daily Signal/);
  assert.match(home, /label: "Daily Signal", href: "\/newsletter"/);
  const heroCta = home.indexOf('id="hero-cta"');
  const heroSignal = home.indexOf('data-testid="hero-daily-signal"');
  assert.ok(heroCta >= 0 && heroSignal > heroCta && heroSignal - heroCta < 900);
  assert.match(nav, /href="\/newsletter"/);
  assert.match(nav, /Daily Signal/);
});

test('daily brief email renders the shaping-capital trend panel', () => {
  const nl = {
    date: '2026-09-22',
    trendReport: {
      headline: 'Attention is still writing the shortlist.',
      thesis: 'Checks follow visibility more than compounding.',
      drivers: [{
        key: 'optics',
        label: 'Optics and attention',
        finding: 'Lumen is carrying press velocity.',
        why_it_matters: 'A crowded tape can look like conviction.',
      }],
    },
  };
  const html = buildBriefEmailHtml(nl, { siteUrl: 'https://pythh.ai' });
  assert.match(html, /What's shaping capital/);
  assert.match(html, /Attention is still writing the shortlist/);
  assert.match(html, /Optics and attention/);
  const text = buildBriefEmailText(nl, { siteUrl: 'https://pythh.ai' });
  assert.match(text, /WHAT'S SHAPING CAPITAL/);
  assert.match(text, /Attention is still writing the shortlist/);
});

test('Pythh outbound to founders and investors links Daily Signal', () => {
  assert.equal(newsletterPublicUrl('http://localhost:5173'), 'https://pythh.ai/newsletter');
  assert.match(newsletterOutboundLine(), /pythh\.ai\/newsletter/);
  assert.match(vcCtaText(), /pythh\.ai\/newsletter/);
  assert.match(founderCtaText({}), /Daily Signal: https:\/\/pythh\.ai\/newsletter/);
  assert.match(founderEmailSignoff(), /pythh\.ai\/newsletter/);
  assert.match(vcEmailSignoff(), /pythh\.ai\/newsletter/);
  assert.match(peterFounder, /https:\/\/pythh\.ai\/newsletter/);
  assert.match(peterInvestor, /https:\/\/pythh\.ai\/newsletter/);
  assert.match(outreachAgent, /https:\/\/pythh\.ai\/newsletter/);
  assert.match(activation, /https:\/\/pythh\.ai\/newsletter/);
  assert.match(dealflow, /\/newsletter/);
  assert.match(portfolioDelta, /\/newsletter/);
  assert.match(weeklySignal, /https:\/\/pythh\.ai\/newsletter/);
  assert.match(pkg, /"newsletter:trends"/);
});

test('founder-to-VC cold drafts stay off the newsletter', () => {
  const email = buildColdEmail(
    { name: 'Neon', website: 'https://neon.tech', tagline: 'serverless postgres' },
    { name: 'Jane', firm_name: 'Accel' },
    null,
    { match_score: 80, reasoning: 'Stage fit' },
  );
  assert.doesNotMatch(String(email), /pythh\.ai\/newsletter/);
});
