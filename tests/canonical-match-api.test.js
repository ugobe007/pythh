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
    assert.equal(typeof out.fitness_score, 'number');
    assert.equal(out.fitness_methodology_version, 'fitness_v1');
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

  it('excludes investors that target the wrong funding lifecycle', () => {
    const rows = [
      {
        investor_id: 'preseed-only',
        match_score: 95,
        investors: { id: 'preseed-only', name: 'Preseed Fund', firm: 'Preseed Fund', type: 'VC', stage: ['Pre-Seed'] },
      },
      {
        investor_id: 'seed',
        match_score: 80,
        investors: { id: 'seed', name: 'Seed Fund', firm: 'Seed Fund', type: 'VC', stage: ['Seed'] },
      },
    ];
    const result = buildPreviewMatchList(rows, {
      mix: 'all',
      total: 5,
      startup: { funding_stage: 'seed' },
    });
    assert.deepEqual(result.map((match) => match.investor_id), ['seed']);
    assert.equal(result[0].funding_lifecycle_fit.level, 'exact');
  });
});

describe('resolvePreviewMixOptions', () => {
  it('defaults early startups to balanced mix', () => {
    const opts = resolvePreviewMixOptions({ stage: 1 }, 'balanced');
    assert.equal(opts.mix, 'balanced');
  });
});
