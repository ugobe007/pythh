'use strict';

const assert = require('assert');
const {
  extractProprietaryTechFromText,
  assessProprietaryTech,
  investorRequiresProprietaryTech,
  applyTechVcMatchAdjustment,
} = require('../lib/proprietaryTechAssessment');

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (e) {
    console.error(`✗ ${name}`);
    throw e;
  }
}

test('detects services/engineering firms as non-proprietary', () => {
  const text = `
    Sands Engineers is a civil engineering firm providing design-build and consulting services
    for municipal infrastructure projects across the Southeast.
  `;
  const profile = assessProprietaryTech({ text, companyName: 'Sands Engineers' });
  assert.strictEqual(profile.has_proprietary_tech, false);
  assert.ok(profile.negative_evidence.length >= 1);
});

test('detects proprietary language and patents in text', () => {
  const text = `
    Our proprietary battery chemistry enables 2x energy density. We have 12 patents pending
    and a dedicated R&D lab advancing novel materials science.
  `;
  const profile = assessProprietaryTech({ text, companyName: 'Acme Battery' });
  assert.strictEqual(profile.has_proprietary_tech, true);
  assert.ok(profile.evidence.length >= 2);
});

test('merges verified patent database signals', () => {
  const profile = assessProprietaryTech({
    text: 'We build advanced robotics systems.',
    companyName: 'RoboCo',
    patentSignals: [{
      signal: 'PATENT_FILED',
      evidence: '4 patents found (USPTO:4). Latest: 2024-01-01',
      source: 'USPTO:4',
    }],
  });
  assert.strictEqual(profile.has_proprietary_tech, true);
  assert.strictEqual(profile.patent_count, 4);
  assert.strictEqual(profile.patent_verified, true);
});

test('Khosla Ventures requires proprietary tech and penalizes services startups', () => {
  const investor = { firm: 'Khosla Ventures', name: 'Vinod Khosla', investment_thesis: 'Deep tech and breakthrough science' };
  assert.strictEqual(investorRequiresProprietaryTech(investor, null).required, true);

  const startup = {
    name: 'Sands Engineers',
    pitch: 'Civil engineering services and consulting for infrastructure projects.',
    proprietary_tech_profile: assessProprietaryTech({
      text: 'Civil engineering firm providing consulting and design-build services.',
      companyName: 'Sands Engineers',
    }),
  };

  const base = {
    score: 78,
    fitAnalysis: { is_super_match: true, faith: 12 },
    confidence: 'high',
  };
  const adjusted = applyTechVcMatchAdjustment(base, startup, investor, { top_themes: ['deep tech'] });
  assert.ok(adjusted.score <= 50, `expected penalty, got ${adjusted.score}`);
  assert.strictEqual(adjusted.fitAnalysis.tech_vc_fit, 'weak');
  assert.strictEqual(adjusted.fitAnalysis.is_super_match, false);
});

test('no penalty for deep tech investor when startup has patents', () => {
  const investor = { firm: 'Khosla Ventures' };
  const startup = {
    name: 'Acme Battery',
    proprietary_tech_profile: assessProprietaryTech({
      text: 'Patented battery chemistry with proprietary manufacturing process.',
      patentSignals: [{ signal: 'PATENT_FILED', evidence: '2 patents found (USPTO:2)' }],
    }),
  };
  const base = { score: 80, fitAnalysis: {}, confidence: 'high' };
  const adjusted = applyTechVcMatchAdjustment(base, startup, investor, null);
  assert.strictEqual(adjusted.score, 80);
  assert.strictEqual(adjusted.fitAnalysis.tech_vc_fit, 'strong');
});

console.log('\nAll proprietary tech assessment tests passed.');
