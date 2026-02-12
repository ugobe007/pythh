// ============================================================================
// Oracle Milestone Celebration Modal
// ============================================================================
// Animated celebration modal shown when user achieves a milestone:
//   - Confetti animation
//   - Milestone icon & title
//   - Reward unlock message
//   - CTA to continue
// ============================================================================

import React, { useEffect, useState } from 'react';
import { Award, Star, Zap, Trophy, Target, Sparkles, X } from 'lucide-react';
import Confetti from 'react-confetti';
import { useWindowSize } from '../hooks/useWindowSize';

interface Milestone {
  id: string;
  milestone_type: string;
  title: string;
  description: string | null;
  icon: string | null;
  reward_text: string | null;
  reward_action_url: string | null;
  achieved_at: string | null;
  is_celebrated: boolean;
}

interface MilestoneCelebrationModalProps {
  milestone: Milestone;
  onClose: () => void;
  onContinue?: () => void;
}

const MILESTONE_ICONS: Record<string, React.ReactNode> = {
  wizard_complete: <Trophy className="w-12 h-12 text-amber-400" />,
  first_insight: <Sparkles className="w-12 h-12 text-purple-400" />,
  '5_actions_done': <Target className="w-12 h-12 text-emerald-400" />,
  score_70_plus: <Award className="w-12 h-12 text-yellow-400" />,
  score_80_plus: <Star className="w-12 h-12 text-blue-400" />,
  score_90_plus: <Zap className="w-12 h-12 text-pink-400" />,
  first_cohort: <Target className="w-12 h-12 text-indigo-400" />,
  investor_match: <Sparkles className="w-12 h-12 text-green-400" />,
};

export const MilestoneCelebrationModal: React.FC<MilestoneCelebrationModalProps> = ({
  milestone,
  onClose,
  onContinue,
}) => {
  const { width, height } = useWindowSize();
  const [showConfetti, setShowConfetti] = useState(true);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    // Auto-hide confetti after 5 seconds
    const timer = setTimeout(() => {
      setShowConfetti(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const handleContinue = () => {
    if (onContinue) {
      onContinue();
    } else {
      handleClose();
    }
  };

  const icon = MILESTONE_ICONS[milestone.milestone_type] || (
    <Award className="w-12 h-12 text-purple-400" />
  );

  return (
    <>
      {/* Confetti */}
      {showConfetti && (
        <Confetti
          width={width}
          height={height}
          recycle={false}
          numberOfPieces={500}
          gravity={0.3}
        />
      )}

      {/* Modal Overlay */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-opacity duration-300 ${
          isClosing ? 'opacity-0' : 'opacity-100'
        }`}
        onClick={handleClose}
      >
        {/* Modal Content */}
        <div
          className={`bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-purple-500/30 rounded-3xl p-8 max-w-md w-full shadow-2xl transform transition-all duration-300 ${
            isClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-white/40 hover:text-white/80 transition"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Icon with Glow */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-purple-500/20 blur-2xl rounded-full"></div>
              <div className="relative bg-white/10 rounded-full p-6 border border-white/20">
                {icon}
              </div>
            </div>
          </div>

          {/* Title */}
          <h2 className="text-3xl font-bold text-white text-center mb-2">
            🎉 Milestone Unlocked!
          </h2>

          {/* Milestone Title */}
          <p className="text-xl font-semibold text-purple-300 text-center mb-4">
            {milestone.title}
          </p>

          {/* Description */}
          {milestone.description && (
            <p className="text-white/60 text-center text-sm mb-6">
              {milestone.description}
            </p>
          )}

          {/* Reward */}
          {milestone.reward_text && (
            <div className="bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/20 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <Star className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-amber-300 font-semibold text-sm">
                    {milestone.reward_text}
                  </p>
                  {milestone.reward_action_url && (
                    <a
                      href={milestone.reward_action_url}
                      className="text-amber-400/80 hover:text-amber-400 text-xs underline"
                    >
                      Learn more →
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* CTA Button */}
          <button
            onClick={handleContinue}
            className="w-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white font-semibold py-3 px-6 rounded-xl transition-all transform hover:scale-105"
          >
            {milestone.reward_action_url ? 'Claim Reward' : 'Continue'}
          </button>

          {/* Fun Stats */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <p className="text-white/40 text-xs text-center">
              Achieved on {new Date(milestone.achieved_at || Date.now()).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

// ============================================================================
// Milestone Progress Card
// ============================================================================
// Shows progress toward next milestone

interface MilestoneProgressCardProps {
  currentMilestones: Milestone[];
  nextMilestone: {
    type: string;
    title: string;
    description: string;
    progress: number;  // 0-100
    target: number;
    current: number;
    icon: string;
  } | null;
}

export const MilestoneProgressCard: React.FC<MilestoneProgressCardProps> = ({
  currentMilestones,
  nextMilestone,
}) => {
  if (!nextMilestone) {
    return null;
  }

  const icon = MILESTONE_ICONS[nextMilestone.type] || (
    <Target className="w-8 h-8 text-purple-400" />
  );

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <Target className="w-5 h-5 text-purple-400" />
          Next Milestone
        </h3>
        <span className="text-xs text-white/40">
          {currentMilestones.length} unlocked
        </span>
      </div>

      <div className="flex items-start gap-4">
        <div className="w-16 h-16 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
          {icon}
        </div>

        <div className="flex-1">
          <h4 className="text-white font-semibold mb-1">{nextMilestone.title}</h4>
          <p className="text-white/60 text-sm mb-3">{nextMilestone.description}</p>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/40">
                {nextMilestone.current} / {nextMilestone.target}
              </span>
              <span className="text-purple-400 font-semibold">
                {Math.round(nextMilestone.progress)}%
              </span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-purple-600 to-purple-400 transition-all duration-500"
                style={{ width: `${nextMilestone.progress}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Achievement Badge Grid
// ============================================================================
// Display all earned milestones as badges

interface AchievementBadgeGridProps {
  milestones: Milestone[];
  onClick?: (milestone: Milestone) => void;
}

export const AchievementBadgeGrid: React.FC<AchievementBadgeGridProps> = ({
  milestones,
  onClick,
}) => {
  if (milestones.length === 0) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
        <Trophy className="w-12 h-12 text-white/20 mx-auto mb-4" />
        <p className="text-white/60 text-sm">
          No milestones unlocked yet. Complete the Oracle wizard to start earning achievements!
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {milestones.map((milestone) => {
        const icon = MILESTONE_ICONS[milestone.milestone_type] || (
          <Award className="w-8 h-8 text-purple-400" />
        );

        return (
          <button
            key={milestone.id}
            onClick={() => onClick && onClick(milestone)}
            className="bg-white/5 border border-white/10 hover:border-purple-500/30 rounded-xl p-4 transition-all transform hover:scale-105 text-left"
          >
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center">
                {icon}
              </div>
              <div>
                <p className="text-white font-semibold text-sm">{milestone.title}</p>
                <p className="text-white/40 text-xs mt-1">
                  {new Date(milestone.achieved_at || Date.now()).toLocaleDateString('en-US', {
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};
