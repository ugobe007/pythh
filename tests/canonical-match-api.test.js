'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  shapeMatchForApi,
  buildPreviewMatchList,
  resolvePreviewMixOptions,
} = require('../lib/canonicalMatchApi');

function row(name, firm, score, why, type = 'VC') {
  return {
    match_score: score,
    why_you_match: why,
    investor: { id: name, name, firm, type },
  };
}

describe('shapeMatchForApi', () => {
  it('always returns string why_you_match from DB arrays', () => {
    const out = shapeMatchForApi(
      row('Sarah Chen', 'Eclipse Ventures', 80, ['Stage match', 'Sector fit'])
    );
    assert.equal(typeof out.why_you_match, 'string');
    assert.match(out.why_you_match, /Stage match/);
    assert.equal(out.investor_class, 'vc');
  });

  it('coerces investor firm and name to strings', () => {
    const out = shapeMatchForApi({
      match_score: 72,
      why_you_match: null,
      investor: { id: '1', name: '  Jane  ', firm: ' Acme VC ' },
    });
    assert.equal(out.investor.name, 'Jane');
    assert.equal(out.investor.firm, 'Acme VC');
  });
});

describe('buildPreviewMatchList', () => {
  it('returns canonical preview rows with mixed classes', () => {
    const raw = [
      row('Angel Adams', null, 90, ['Angel check'], 'Angel'),
      row('Sarah Chen', 'Eclipse Ventures', 80, ['VC fit'], 'VC'),
    ];
    const out = buildPreviewMatchList(raw, { total: 2, mix: 'all' });
    assert.equal(out.length, 2);
    for (const m of out) {
      assert.equal(typeof m.why_you_match, 'string');
      assert.ok(m.investor_class === 'angel' || m.investor_class === 'vc');
    }
  });
});

describe('resolvePreviewMixOptions', () => {
  it('defaults early startups to balanced mix', () => {
    const opts = resolvePreviewMixOptions({ stage: 1 }, 'balanced');
    assert.equal(opts.mix, 'balanced');
  });
});
