import React from 'react';
import { Link } from 'react-router-dom';
import { getInvestorProfile, getTierColor } from '../utils/firePointsManager';
import { TIER_THRESHOLDS } from '../types/gamification';

/**
 * FIRE POINTS WIDGET
 * ===================
 * Displays user's fire points, tier, and unlocked perks
 */
const FirePointsWidget: React.FC = () => {
  const profile = getInvestorProfile();

  if (!profile) return null;

  const { firePoints, tier, perks } = profile;
  const unlockedPerks = perks.filter(p => p.isUnlocked);
  
  // Calculate progress to next tier
  const tierKeys = Object.keys(TIER_THRESHOLDS) as Array<keyof typeof TIER_THRESHOLDS>;
  const currentTierIndex = tierKeys.indexOf(tier);
  const nextTier = tierKeys[currentTierIndex + 1];
  const nextTierThreshold = nextTier ? TIER_THRESHOLDS[nextTier] : null;
  
  const progress = nextTierThreshold 
    ? ((firePoints.total - TIER_THRESHOLDS[tier]) / (nextTierThreshold - TIER_THRESHOLDS[tier])) * 100
    : 100;

  return (
    <div className="bg-white/80 backdrop-blur-md rounded-3xl shadow-xl p-6 border-2 border-slate-600">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="text-4xl">🔥</div>
          <div>
            <h3 className="text-2xl font-bold text-cyan-600">Fire Points</h3>
            <p className="text-sm text-slate-600">Level up your investor game</p>
          </div>
        </div>
        <Link
          to="/account"
          className="px-3 py-1.5 bg-cyan-100 hover:bg-cyan-200 text-cyan-700 text-sm font-medium rounded-lg transition-all"
        >
          Account
        </Link>
      </div>

      {/* Points Display */}
      <div className="mb-6">
        <div className={`bg-gradient-to-r ${getTierColor(tier)} rounded-2xl p-6 text-white text-center shadow-lg`}>
          <p className="text-sm opacity-90 mb-1">Your Total</p>
          <p className="text-5xl font-bold mb-2">{firePoints.total}</p>
          <div className="flex items-center justify-center gap-2">
            <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-medium backdrop-blur-sm">
              {tier} Tier
            </span>
            {firePoints.streak > 0 && (
              <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-medium backdrop-blur-sm">
                🔥 {firePoints.streak} day streak
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Progress to Next Tier */}
      {nextTier && (
        <div className="mb-6">
          <div className="flex justify-between text-sm text-slate-600 mb-2">
            <span>Progress to {nextTier}</span>
            <span className="font-bold">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r ${getTierColor(tier)} transition-all duration-500`}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          {nextTierThreshold && (
            <p className="text-xs text-slate-500 mt-1">
              {nextTierThreshold - firePoints.total} points to go
            </p>
          )}
        </div>
      )}

      {/* Today's Activity */}
      {firePoints.earnedToday > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4">
          <p className="text-green-700 text-sm font-medium">
            ✅ +{firePoints.earnedToday} points earned today!
          </p>
        </div>
      )}

      {/* Unlocked Perks */}
      {unlockedPerks.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-slate-700 mb-3">Your Perks ({unlockedPerks.length})</h4>
          <div className="grid grid-cols-2 gap-2">
            {unlockedPerks.map((perk) => (
              <div
                key={perk.id}
                className="bg-gradient-to-br from-slate-800 to-slate-700 border border-slate-600 rounded-xl p-3 text-center"
              >
                <div className="text-2xl mb-1">{perk.icon}</div>
                <p className="text-xs font-medium text-slate-700">{perk.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Locked Perks Preview */}
      {unlockedPerks.length < perks.length && (
        <div className="mt-4">
          <h4 className="text-sm font-bold text-slate-700 mb-3">Coming Soon</h4>
          <div className="space-y-2">
            {perks
              .filter(p => !p.isUnlocked)
              .slice(0, 2)
              .map((perk) => (
                <div
                  key={perk.id}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center gap-3 opacity-60"
                >
                  <div className="text-2xl">{perk.icon}</div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-slate-700">{perk.name}</p>
                    <p className="text-xs text-slate-500">
                      🔒 Unlock at {perk.unlockedAt} points
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FirePointsWidget;
