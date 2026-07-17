'use strict';

/**
 * Classify investors as angel vs VC for shortlist mixing and browse filters.
 */

const { getInvestorStageProfile } = require('./stageInvestorFit');

/**
 * @param {object|null|undefined} investor
 * @returns {'angel'|'vc'}
 */
function getInvestorClass(investor) {
  if (!investor || typeof investor !== 'object') return 'vc';

  if (investor.is_individual === true) return 'angel';

  const type = String(investor.type || '').toLowerCase();
  if (type.includes('angel') || type.includes('individual') || type.includes('scout')) {
    return 'angel';
  }

  const capitalType = String(investor.capital_type || '').toLowerCase();
  if (capitalType.includes('angel')) return 'angel';

  const firm = investor.firm != null && String(investor.firm).trim();
  if (firm) return 'vc';

  const profile = getInvestorStageProfile(investor);
  if (profile.isAngel || profile.isAccelerator) return 'angel';

  return 'vc';
}

/**
 * @param {object} investor
 * @param {string} filter - all | angel | vc | balanced
 */
function investorMatchesClassFilter(investor, filter) {
  const f = String(filter || 'all').toLowerCase().trim();
  if (!f || f === 'all' || f === 'balanced') return true;
  const cls = getInvestorClass(investor);
  if (f === 'angel' || f === 'angels') return cls === 'angel';
  if (f === 'vc' || f === 'vcs') return cls === 'vc';
  return true;
}

module.exports = {
  getInvestorClass,
  investorMatchesClassFilter,
};
