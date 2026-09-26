import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { distinctiveFitScore, sectorsForMatching } = require('../lib/distinctiveInvestorFit.js');

const roboticsFund = {
  name: 'Bolt Robotics',
  firm: 'Bolt Robotics',
  sectors: ['Robotics', 'AI/ML'],
  stage: ['Seed'],
  investor_score: 55,
  investment_thesis: 'We back robotics and autonomous systems companies.',
};
const generalist = {
  name: 'Sequoia Capital',
  firm: 'Sequoia Capital',
  sectors: ['AI/ML', 'Fintech', 'Healthcare', 'Consumer', 'Crypto', 'SaaS', 'Enterprise'],
  stage: ['Seed', 'Series A'],
  investor_score: 95,
  investment_thesis: 'We invest in technology companies across sectors.',
};
const fintechFund = {
  name: 'Payments Fund',
  firm: 'Payments Fund',
  sectors: ['Fintech'],
  stage: ['Seed'],
  investor_score: 60,
  investment_thesis: 'Payments infrastructure and banking software.',
};

test('a robotics startup ranks a robotics fund above a higher-score generalist', () => {
  const startup = {
    name: 'Harbor Robotics',
    sectors: ['Robotics'],
    stage: 1,
    description: 'Autonomous warehouse robots.',
  };
  assert.ok(distinctiveFitScore(startup, roboticsFund) > distinctiveFitScore(startup, generalist));
});

test('a fintech startup does not share the robotics startup top investor', () => {
  const robotics = { name: 'Harbor Robotics', sectors: ['Robotics'], stage: 1, description: 'Warehouse robots.' };
  const fintech = { name: 'Ledger Pay', sectors: ['Fintech'], stage: 1, description: 'Payments infrastructure for banks.' };
  const pool = [roboticsFund, generalist, fintechFund];
  const top = (startup) => pool.slice().sort((a, b) => distinctiveFitScore(startup, b) - distinctiveFitScore(startup, a))[0];
  assert.equal(top(robotics).firm, 'Bolt Robotics');
  assert.equal(top(fintech).firm, 'Payments Fund');
  assert.notEqual(top(robotics).firm, top(fintech).firm);
});

test('a payments description is not matched as generic Technology', () => {
  const sectors = sectorsForMatching({
    name: 'Ledger Pay',
    website: 'https://ledgerpay.com',
    sectors: ['Technology'],
    description: 'Payments infrastructure for banks.',
  });
  assert.ok(sectors.some((sector) => /fintech/i.test(sector)));
});

test('a generic Technology tag does not hide a robotics company name', () => {
  const sectors = sectorsForMatching({
    name: 'Harbor Robotics',
    website: 'https://harborrobotics.com',
    sectors: ['Technology'],
    description: 'Autonomous warehouse robots.',
  });
  assert.ok(sectors.some((sector) => /robot/i.test(sector)));
});
