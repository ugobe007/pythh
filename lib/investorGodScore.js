'use strict';

/**
 * Investor GOD score v4 (0–100) — shared by recalculate-investor-scores.js
 * and unit tests.
 *
 * Buckets:
 *   Profile Completeness  (0-25)
 *   Investment Focus      (0-25)
 *   Capital Readiness     (0-20)
 *   Track Record          (0-20)
 *   Activity & Velocity   (0-10)
 *
 * Operator / successful-founder public-thesis signal folds into profile/focus/track
 * without raising bucket ceilings (see lib/operatorFounderInvestors.js).
 */

const { operatorFounderGodBonus } = require('./operatorFounderInvestors');

function calculateInvestorScore(investor) {
  const signals = [];

  // ── PROFILE COMPLETENESS (0-25) ──────────────────────────────────────────
  let profileScore = 0;

  const bio = investor.bio || '';
  if (bio.length > 200) { profileScore += 8; signals.push('Detailed bio'); }
  else if (bio.length > 50) { profileScore += 5; signals.push('Has bio'); }
  else if (bio.length > 0) { profileScore += 2; }

  if (investor.name && investor.firm) { profileScore += 4; }
  else if (investor.name || investor.firm) { profileScore += 2; }

  const geos = investor.geography_focus || [];
  if (geos.length >= 1) { profileScore += 5; signals.push('Geography defined'); }

  const thesis = investor.investment_thesis || '';
  if (thesis.length > 200) { profileScore += 6; signals.push('Deep thesis'); }
  else if (thesis.length > 50) { profileScore += 4; signals.push('Has thesis'); }
  else if (thesis.length > 0) { profileScore += 2; }

  let socialCount = 0;
  if (investor.linkedin_url) socialCount++;
  if (investor.twitter_url) socialCount++;
  if (investor.is_verified) { socialCount++; signals.push('Verified'); }
  profileScore += Math.min(socialCount * 2, 4);

  // Public thesis themes from faith backfill / blog scrape (content, not URL presence).
  const themes = Array.isArray(investor.signals?.top_themes) ? investor.signals.top_themes : [];
  if (themes.length >= 3) {
    profileScore += 3;
    signals.push('Public thesis themes');
  } else if (themes.length >= 1) {
    profileScore += 1;
  }
  if (investor.blog_url && (themes.length > 0 || thesis.length > 100)) {
    profileScore += 1;
    signals.push('Blog thesis signal');
  }

  profileScore = Math.min(Math.round(profileScore), 25);

  // ── INVESTMENT FOCUS (0-25) ───────────────────────────────────────────────
  let focusScore = 0;

  const sectors = investor.sectors || [];
  if (sectors.length >= 1 && sectors.length <= 3) { focusScore += 10; signals.push(`Focus: ${sectors.slice(0, 2).join(', ')}`); }
  else if (sectors.length <= 6) { focusScore += 7; }
  else if (sectors.length > 6) { focusScore += 4; }

  const stages = investor.stage || [];
  if (stages.length >= 1 && stages.length <= 2) { focusScore += 9; }
  else if (stages.length <= 4) { focusScore += 6; }
  else if (stages.length > 0) { focusScore += 3; }

  const invType = (investor.type || '').toLowerCase();
  if (invType === 'vc') { focusScore += 5; }
  else if (invType.includes('operator') || invType === 'operator_angel') {
    focusScore += 5;
    signals.push('Operator angel type');
  }
  else if (invType === 'angel') { focusScore += 4; }
  else if (['pe', 'cvc', 'family office', 'accelerator', 'corporate vc'].includes(invType)) { focusScore += 3; }
  else if (invType) { focusScore += 2; }

  focusScore = Math.min(Math.round(focusScore), 25);

  // ── CAPITAL READINESS (0-20) ──────────────────────────────────────────────
  let capitalScore = 0;

  const minCheck = investor.check_size_min || 0;
  const maxCheck = investor.check_size_max || 0;
  if (minCheck > 0 && maxCheck > 0) { capitalScore += 8; signals.push(`Check: $${(minCheck / 1e6).toFixed(1)}M–$${(maxCheck / 1e6).toFixed(1)}M`); }
  else if (minCheck > 0 || maxCheck > 0) { capitalScore += 4; }

  const fundSize = investor.fund_size_estimate_usd || investor.active_fund_size || 0;
  if (fundSize >= 1_000_000_000) { capitalScore += 7; signals.push('Mega fund $1B+'); }
  else if (fundSize >= 500_000_000) { capitalScore += 6; signals.push('Large fund $500M+'); }
  else if (fundSize >= 100_000_000) { capitalScore += 5; }
  else if (fundSize >= 20_000_000) { capitalScore += 3; }
  else if (fundSize > 0) { capitalScore += 2; }

  if (investor.leads_rounds) { capitalScore += 5; signals.push('Leads rounds'); }
  else if (investor.follows_rounds) { capitalScore += 2; }

  capitalScore = Math.min(Math.round(capitalScore), 20);

  // ── TRACK RECORD (0-20) ───────────────────────────────────────────────────
  let trackScore = 0;

  const investments = investor.total_investments || 0;
  if (investments >= 100) { trackScore += 8; signals.push('100+ investments'); }
  else if (investments >= 50) { trackScore += 6; }
  else if (investments >= 20) { trackScore += 4; }
  else if (investments >= 5) { trackScore += 2; }

  const exits = investor.successful_exits || 0;
  if (exits >= 10) { trackScore += 8; signals.push('10+ exits'); }
  else if (exits >= 5) { trackScore += 5; }
  else if (exits >= 1) { trackScore += 2; }

  const notable = investor.notable_investments;
  const notableCount = Array.isArray(notable) ? notable.length
    : (notable && typeof notable === 'object' ? Object.keys(notable).length : 0);
  if (notableCount >= 5) { trackScore += 4; signals.push(`${notableCount} notable investments`); }
  else if (notableCount >= 1) { trackScore += 2; }

  trackScore = Math.min(Math.round(trackScore), 20);

  // ── ACTIVITY & VELOCITY (0-10) ────────────────────────────────────────────
  let activityScore = 0;

  const lastInvDate = investor.last_investment_date;
  if (lastInvDate) {
    const daysSince = Math.floor((Date.now() - new Date(lastInvDate).getTime()) / 86_400_000);
    if (daysSince <= 60) { activityScore += 8; signals.push('Invested <60 days ago'); }
    else if (daysSince <= 180) { activityScore += 6; signals.push('Invested <6 months ago'); }
    else if (daysSince <= 365) { activityScore += 4; }
    else if (daysSince <= 730) { activityScore += 2; }
  }

  const velocity = investor.deployment_velocity_index || 0;
  if (velocity >= 70) { activityScore += 2; signals.push('High deployment velocity'); }
  else if (velocity >= 40) { activityScore += 1; }

  activityScore = Math.min(Math.round(activityScore), 10);

  // ── OPERATOR FOUNDER / PUBLIC THESIS (within existing caps) ───────────────
  const opBonus = operatorFounderGodBonus(investor);
  if (opBonus.profile || opBonus.focus || opBonus.track) {
    profileScore = Math.min(25, profileScore + opBonus.profile);
    focusScore = Math.min(25, focusScore + opBonus.focus);
    trackScore = Math.min(20, trackScore + opBonus.track);
    for (const s of opBonus.signals) signals.push(`operator:${s}`);
  }

  const total = Math.min(profileScore + focusScore + capitalScore + trackScore + activityScore, 100);

  let tier;
  if (total >= 70) tier = 'elite';
  else if (total >= 50) tier = 'strong';
  else if (total >= 30) tier = 'solid';
  else tier = 'emerging';

  return {
    total: Math.round(total),
    breakdown: {
      profile: profileScore,
      focus: focusScore,
      capital: capitalScore,
      track: trackScore,
      activity: activityScore,
    },
    tier,
    signals,
  };
}

module.exports = {
  calculateInvestorScore,
};
