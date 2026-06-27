#!/usr/bin/env node
/**
 * Test ontological inference engine — objects, conditions, variables, results.
 * Run: node scripts/test-ontological-inference.js
 */

'use strict';

const { inferOntologicalFrame, inferOntologicalFrames } = require('../lib/ontologicalInferenceEngine');
const { extractOntologicalFramesFromArticles } = require('../lib/ontologyNewsInference');
const { scoreNarrativeRole } = require('../server/services/inferenceService');

const CASES = [
  {
    text: 'Sequoia led a $55M Series B in Harvey alongside Conviction Partners.',
    expect: {
      frame: 'INVESTMENT',
      hasStartup: 'Harvey',
      hasInvestor: 'Sequoia',
      hasAssociation: true,
    },
  },
  {
    text: 'Acme raises $12M seed round to expand into Europe with 2 million developers on the platform.',
    expect: {
      frame: 'FUNDING',
      hasStartup: 'Acme',
      hasPopulus: true,
      hasLocation: true,
    },
  },
  {
    text: 'We are aggressively hiring senior enterprise sales leaders in San Francisco this quarter.',
    expect: {
      hasCondition: 'hiring',
      hasTime: true,
      hasLocation: true,
    },
  },
  {
    text: 'The round was oversubscribed — strong demand from top-tier funds backed by a16z and General Catalyst.',
    expect: {
      hasTemperature: 'hot',
      hasAssociation: true,
    },
  },
  {
    text: 'Stripe acquired Bridge for strategic expansion into payments infrastructure.',
    expect: {
      frame: 'ACQUISITION',
      minObjects: 1,
    },
  },
];

let passed = 0;
let failed = 0;

console.log('🧠 Ontological Inference Engine Tests\n');

for (const [i, c] of CASES.entries()) {
  const frame = inferOntologicalFrame(c.text);
  const errs = [];

  if (!frame) {
    errs.push('no frame returned');
  } else {
    const exp = c.expect;
    if (exp.frame && frame.frame_type !== exp.frame) {
      errs.push(`frame_type: expected ${exp.frame}, got ${frame.frame_type}`);
    }
    if (exp.hasStartup) {
      const names = frame.objects.map((o) => o.name);
      if (!names.some((n) => n && n.toLowerCase().includes(exp.hasStartup.toLowerCase()))) {
        errs.push(`missing startup ${exp.hasStartup} in [${names.join(', ')}]`);
      }
    }
    if (exp.hasInvestor) {
      const inv = frame.objects.filter((o) => o.entity_type === 'INVESTOR' || o.role === 'investor');
      if (!inv.some((o) => o.name && o.name.toLowerCase().includes(exp.hasInvestor.toLowerCase()))) {
        errs.push(`missing investor ${exp.hasInvestor}`);
      }
    }
    if (exp.hasAssociation && frame.variables.association.length === 0) {
      errs.push('expected association variable');
    }
    if (exp.hasPopulus && frame.variables.populus.length === 0) {
      errs.push('expected populus variable');
    }
    if (exp.hasLocation && frame.variables.location.length === 0) {
      errs.push('expected location variable');
    }
    if (exp.hasTime && frame.variables.time.length === 0 && !frame.variables.time_bucket) {
      errs.push('expected time variable');
    }
    if (exp.hasCondition === 'hiring') {
      const hiring = frame.conditions.some((x) => /hiring|recruit|appoint/i.test(x.verb || x.description || ''));
      if (!hiring) errs.push('expected hiring condition');
    }
    if (exp.hasTemperature) {
      const hot = frame.variables.temperature.some((t) => t.level === exp.hasTemperature);
      if (!hot) errs.push(`expected temperature ${exp.hasTemperature}`);
    }
    if (exp.minObjects && frame.objects.length < exp.minObjects) {
      errs.push(`expected >= ${exp.minObjects} objects, got ${frame.objects.length}`);
    }
    if (frame.conditions.length === 0) errs.push('expected at least one condition');
    if (frame.results.length === 0) errs.push('expected at least one result');
  }

  const ok = errs.length === 0;
  console.log(`${i + 1}. ${ok ? '✓' : '✗'} ${c.text.slice(0, 70)}${c.text.length > 70 ? '…' : ''}`);
  if (!ok) {
    errs.forEach((e) => console.log(`   → ${e}`));
    if (frame) {
      console.log(`   objects: ${frame.objects.map((o) => `${o.name}(${o.entity_type})`).join(', ') || '—'}`);
      console.log(`   conditions: ${frame.conditions.map((x) => x.signal_class).join(', ') || '—'}`);
      console.log(`   vars: time=${frame.variables.time.length} loc=${frame.variables.location.length} temp=${frame.variables.temperature.length} pop=${frame.variables.populus.length}`);
    }
    failed++;
  } else {
    passed++;
  }
}

// Multi-sentence passage
const passage = inferOntologicalFrames(
  'Harvey raised $100M Series C led by Sequoia. The company is hiring engineers in New York. Oversubscribed round signals strong investor conviction.',
);
console.log(`\n6. ${passage.frames.length >= 2 ? '✓' : '✗'} Multi-sentence passage (${passage.frames.length} frames)`);
console.log(`   summary startups: ${passage.summary?.startups?.join(', ') || '—'}`);
console.log(`   summary investors: ${passage.summary?.investors?.join(', ') || '—'}`);
if (passage.frames.length >= 2) passed++; else failed++;

console.log(`\n📊 ${passed}/${passed + failed} passed`);

// RSS noise regression cases
console.log('\n📰 RSS noise regression\n');

const RSS_CASES = [
  {
    title: 'Colombian fintech Addi gets banking licence and credit upsize - Latin Lawyer',
    startup: 'Addi',
    reject: ['Colombian fintech Addi gets banking licence and', 'Latin Lawyer Addi Secures', 'Valuation', 'ARR'],
    expectStartup: 'Addi',
  },
  {
    title: 'GetLatka Nango Revenue Nango Revenue reaches $5M ARR - GetLatka',
    startup: 'Nango',
    reject: ['GetLatka Nango Revenue', 'ARR'],
    expectStartup: 'Nango',
  },
  {
    title: 'Addi raises $50M Series B to expand buy-now-pay-later in Latin America',
    startup: 'Addi',
    reject: ['Colombian fintech'],
    expectStartup: 'Addi',
  },
];

let rssPassed = 0;
let rssFailed = 0;

for (const [i, c] of RSS_CASES.entries()) {
  const result = extractOntologicalFramesFromArticles(
    [{ title: c.title, content: c.title }],
    c.startup,
    { scoreNarrativeRole },
  );
  const names = (result?.frames || []).flatMap((f) => f.objects.map((o) => o.name).filter(Boolean));
  const errs = [];

  if (c.expectStartup && !names.some((n) => n.toLowerCase() === c.expectStartup.toLowerCase())) {
    errs.push(`missing startup ${c.expectStartup} in [${names.join(', ')}]`);
  }
  for (const bad of c.reject || []) {
    if (names.some((n) => n && n.toLowerCase().includes(bad.toLowerCase()))) {
      errs.push(`rejected junk entity present: ${bad}`);
    }
  }

  const ok = errs.length === 0;
  console.log(`${i + 1}. ${ok ? '✓' : '✗'} ${c.title.slice(0, 65)}…`);
  if (!ok) {
    errs.forEach((e) => console.log(`   → ${e}`));
    console.log(`   objects: ${names.join(', ') || '—'}`);
    rssFailed++;
  } else {
    rssPassed++;
  }
}

console.log(`\n📊 RSS: ${rssPassed}/${rssPassed + rssFailed} passed`);
process.exit(failed + rssFailed > 0 ? 1 : 0);
