'use strict';

/** Max startups per investor virtual portfolio (agents/INVESTOR_CANON.md). */
const INVESTOR_PORTFOLIO_MAX_PICKS = 10;

function portfolioPickMeta(picksUsed) {
  const used = Math.max(0, Number(picksUsed) || 0);
  return {
    picks_used: used,
    picks_max: INVESTOR_PORTFOLIO_MAX_PICKS,
    picks_remaining: Math.max(0, INVESTOR_PORTFOLIO_MAX_PICKS - used),
  };
}

module.exports = {
  INVESTOR_PORTFOLIO_MAX_PICKS,
  portfolioPickMeta,
};
