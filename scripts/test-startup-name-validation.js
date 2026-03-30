#!/usr/bin/env node
/**
 * Unit tests for startup name validation, headline extraction, and garbage detection.
 * Run: node scripts/test-startup-name-validation.js
 * Exits 0 on pass, 1 on fail.
 */

const { isValidStartupName } = require('../lib/startupNameValidator');
const { extractCompanyName } = require('../lib/headlineExtractor');

// Replicate isGarbage logic from cleanup-garbage.js (without DB)
const GARBAGE_PATTERNS = [
  /^smoketest/i, /^testnew/i, /^\d+$/, /^oil$/i, /^app$/i, /^push$/i,
  /^['\u2018\u2019"\u201C\u201D\(]/, /^Understanding\s+/i,
];
const KNOWN_GOOD_STARTUPS = new Set([
  '1password', 'deel', 'mews', 'wise', 'stripe', 'notion', 'linear',
  'vercel', 'supabase', 'ramp', 'brex', 'mercury',
].map(s => s.toLowerCase()));

function isGarbage(name) {
  if (!name || name.trim().length === 0) return true;
  const n = name.trim();
  if (KNOWN_GOOD_STARTUPS.has(n.toLowerCase())) return false;
  if (GARBAGE_PATTERNS.some(p => p.test(n))) return true;
  if (n.length <= 1) return true;
  const check = isValidStartupName(n);
  return !check.isValid;
}

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    passed++;
    return true;
  }
  failed++;
  console.error(`  ❌ ${msg}`);
  return false;
}

function ok(result, msg) {
  return assert(result === true || (result && result.isValid === true), msg);
}

function notOk(result, msg) {
  return assert(result === false || (result && result.isValid === false), msg);
}

console.log('Testing startup name validation...\n');

// --- isValidStartupName ---
console.log('1. isValidStartupName — valid names');
ok(isValidStartupName('Deel').isValid, 'Deel');
ok(isValidStartupName('1Password').isValid, '1Password');
ok(isValidStartupName('Stripe').isValid, 'Stripe');
ok(isValidStartupName('Mews').isValid, 'Mews');
ok(isValidStartupName('Acme Corp').isValid, 'Acme Corp');
ok(isValidStartupName('Shellworks').isValid, 'Shellworks');
ok(isValidStartupName('May Health').isValid, 'May Health');
ok(isValidStartupName('YC-backed Diligent AI').isValid, 'YC-backed Diligent AI');
ok(isValidStartupName('YC alum Mendel').isValid, 'YC alum Mendel');
ok(isValidStartupName('Respan Announces').isValid, 'Respan Announces → salvage Respan');
ok(isValidStartupName('Translucent Announces').isValid, 'Translucent Announces → salvage');
ok(isValidStartupName('May Health').isValid, 'May + company-like second word');
ok(isValidStartupName('Grace Robotics').isValid, 'Grace + Robotics (descriptor second word)');
ok(isValidStartupName('モジョ').isValid, 'Unicode letters (not ASCII-only)');

console.log('\n2. isValidStartupName — garbage (must reject)');
notOk(isValidStartupName('Man Pleads Guilty').isValid, 'Man Pleads Guilty');
notOk(isValidStartupName('Goodwin Advises Shellworks On').isValid, 'Goodwin Advises...');
notOk(isValidStartupName('By Jay').isValid, 'By Jay');
notOk(isValidStartupName('Understanding Personal Finance').isValid, 'Understanding...');
notOk(isValidStartupName('Weekly Roundup').isValid, 'Weekly Roundup');
notOk(isValidStartupName('Top 10 Startups').isValid, 'Top 10 Startups');
notOk(isValidStartupName('').isValid, 'empty string');
notOk(isValidStartupName(null).isValid, 'null');
notOk(isValidStartupName('a').isValid, 'single char');
notOk(isValidStartupName('test123').isValid, 'test123');
notOk(isValidStartupName('123').isValid, 'pure numbers');
notOk(isValidStartupName('Elizabeth Warren').isValid, 'politician full name');
notOk(isValidStartupName('Senator Elizabeth Warren').isValid, 'title + politician');
notOk(isValidStartupName('Jerome Powell').isValid, 'Fed chair as entity');
notOk(isValidStartupName('White House').isValid, 'institution');
notOk(isValidStartupName('Rate Hike Says').isValid, 'headline tail: ... Says');
notOk(isValidStartupName('Elizabeth Warren Announces').isValid, 'blocklist stem after Announces strip');
notOk(isValidStartupName('Someone, Former CEO of X').isValid, 'comma former CEO fragment');
notOk(isValidStartupName('Jennifer Lopez').isValid, 'likely person: common given + surname');
notOk(isValidStartupName('Chris Murphy').isValid, 'likely person (also often a politician headline)');
notOk(isValidStartupName('Acme has raised $5M').isValid, 'has raised + $ in name field');
notOk(isValidStartupName('Breaking: Acme').isValid, 'Breaking: wire prefix');
notOk(isValidStartupName('One Two Three Four Five Six Seven').isValid, '7 words (>6 max)');

console.log('\n3. extractCompanyName — headlines → company');
assert(extractCompanyName('Goodwin Advises Shellworks On $10M') === 'Shellworks', 'Law firm: Shellworks');
assert(extractCompanyName('Acme raises $15M Series A') === 'Acme', 'Funding: Acme');
assert(extractCompanyName('Stripe secures $6.5B round') === 'Stripe', 'Funding: Stripe');
assert(extractCompanyName('Deel launches payroll in UK') === 'Deel', 'Launch: Deel');
assert(extractCompanyName('Mews: Hospitality platform raises $185M') === 'Mews', 'Colon: Mews');
assert(extractCompanyName('KKR to sell CoolIT for $4.75b') === 'CoolIT', 'Sell X for $Y');
assert(extractCompanyName('Paymentology Partners with Chikwama Pay to Launch') === 'Chikwama Pay', 'Partners with X');
// Verb-centric: descriptor + proper noun
assert(extractCompanyName('Mexican edtech Mattilda raises $50 million in financing') === 'Mattilda', 'Descriptor+noun: Mattilda');
assert(extractCompanyName('Spanish edtech BCAS raises $30M debt') === 'BCAS', 'Descriptor+noun: BCAS');
assert(extractCompanyName('YC-backed Mandel AI raises seed') === 'Mandel AI', 'YC-backed: Mandel AI');
assert(extractCompanyName('Bladder cancer innovator Combat secures Series A') === 'Combat', 'Innovator+noun: Combat');

console.log('\n4. extractCompanyName — garbage headlines (must return null)');
assert(extractCompanyName('Man Pleads Guilty to Fraud') === null, 'Headline fragment');
assert(extractCompanyName('Understanding Personal Finance') === null, 'Article title');
assert(extractCompanyName('Weekly Digest') === null, 'Digest');
assert(extractCompanyName('Top 10 Startups to Watch') === null, 'Listicle');
assert(extractCompanyName('') === null, 'empty');
assert(extractCompanyName('Hi') === null, 'too short');
assert(extractCompanyName('Peter Thiel Backs AI Cow Collar Startup at $2B') === null, 'Descriptor fragment (disassociation)');

console.log('\n5. isGarbage (cleanup logic) — known good never garbage');
assert(!isGarbage('Deel'), 'Deel not garbage');
assert(!isGarbage('1Password'), '1Password not garbage');
assert(!isGarbage('Stripe'), 'Stripe not garbage');
assert(!isGarbage('Mews'), 'Mews not garbage');

console.log('\n6. isGarbage — must flag garbage');
assert(isGarbage('Man Pleads Guilty'), 'Man Pleads Guilty');
assert(isGarbage('Goodwin Advises Shellworks On'), 'Law firm phrase');
assert(isGarbage('smoketest123'), 'smoketest');
assert(isGarbage('123'), 'pure numbers');
assert(isGarbage('oil'), 'oil');
assert(isGarbage('app'), 'app');
assert(isGarbage('Is Latest Clean Energy'), 'headline: Is Latest...');
assert(isGarbage('Gets Prison Time After'), 'headline: Gets Prison...');
assert(isGarbage('Spanish edtech BCAS'), 'descriptor headline');
assert(isGarbage('Opening'), 'single verb');
assert(isGarbage('Morgan Stanley'), 'financial institution');
assert(isGarbage('Next.js'), 'framework');

// --- Summary ---
console.log('\n═══════════════════════════════════════');
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log('═══════════════════════════════════════');

if (failed > 0) {
  process.exit(1);
}
