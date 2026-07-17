'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { getInvestorClass } = require('../lib/investorClass');
const {
  buildMixedInvestorShortlist,
  defaultPreviewMixOptions,
  annotateMatchesWithInvestorClass,
} = require('../lib/mixedInvestorShortlist');

function match(name, firm, score, type = 'VC') {
  return {
    match_score: score,
    investor: { id: name, name, firm, type },
  };
}

describe('getInvestorClass', () => {
  it('classifies angels and individuals', () => {
    assert.equal(getInvestorClass({ type: 'Angel', stage: ['Seed'] }), 'angel');
    assert.equal(getInvestorClass({ type: 'VC', is_individual: true, name: 'Jane Doe' }), 'angel');
  });

  it('classifies VC firms', () => {
    assert.equal(
      getInvestorClass({ type: 'VC', firm: 'Eclipse Ventures', stage: ['Series A'] }),
      'vc'
    );
  });
});

describe('buildMixedInvestorShortlist', () => {
  it('reserves slots for both angels and VCs in balanced mode', () => {
    const rows = [
      match('Angel A', null, 90, 'Angel'),
      match('Angel B', null, 88, 'Angel'),
      match('Angel C', null, 86, 'Angel'),
      match('Angel D', null, 84, 'Angel'),
      match('Angel E', null, 82, 'Angel'),
      match('Sarah Chen', 'Eclipse Ventures', 80, 'VC'),
      match('Mike Park', 'Construct Capital', 78, 'VC'),
      match('Alex Rivera', 'Toyota Ventures', 76, 'VC'),
    ];

    const out = buildMixedInvestorShortlist(rows, { total: 6, mix: 'balanced', vcSlots: 3, angelSlots: 3 });
    assert.equal(out.length, 6);

    const classes = out.map((m) => getInvestorClass(m.investor));
    const vcCount = classes.filter((c) => c === 'vc').length;
    const angelCount = classes.filter((c) => c === 'angel').length;
    assert.ok(vcCount >= 2, `expected at least 2 VCs, got ${vcCount}`);
    assert.ok(angelCount >= 2, `expected at least 2 angels, got ${angelCount}`);
  });

  it('filters to VC-only when requested', () => {
    const rows = [
      match('Angel A', null, 95, 'Angel'),
      match('Sarah Chen', 'Eclipse Ventures', 80, 'VC'),
    ];
    const out = buildMixedInvestorShortlist(rows, { total: 5, mix: 'vc' });
    assert.equal(out.length, 1);
    assert.equal(getInvestorClass(out[0].investor), 'vc');
  });
});

describe('defaultPreviewMixOptions', () => {
  it('uses balanced split for early startups', () => {
    const opts = defaultPreviewMixOptions({ stage: 1 }, 10);
    assert.equal(opts.mix, 'balanced');
    assert.equal(opts.vcSlots + opts.angelSlots, 10);
  });

  it('skews VC for late startups', () => {
    const opts = defaultPreviewMixOptions({ stage: 5 }, 10);
    assert.equal(opts.mix, 'vc');
  });
});

describe('annotateMatchesWithInvestorClass', () => {
  it('adds investor_class field', () => {
    const out = annotateMatchesWithInvestorClass([match('Angel A', null, 90, 'Angel')]);
    assert.equal(out[0].investor_class, 'angel');
  });
});
