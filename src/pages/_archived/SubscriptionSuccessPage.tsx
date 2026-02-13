import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  CheckCircle, 
  Sparkles, 
  ArrowRight,
  Gift,
  Mail
} from 'lucide-react';
import FlameIcon from '../components/FlameIcon';
import { TIER_DETAILS, TierName } from '../lib/stripe';
import confetti from 'canvas-confetti';
import LogoDropdownMenu from '../components/LogoDropdownMenu';

const SubscriptionSuccessPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tier = (searchParams.get('tier') as TierName) || 'flame';
  const sessionId = searchParams.get('session_id');
  
  const tierDetails = TIER_DETAILS[tier];

  useEffect(() => {
    // Celebrate!
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;

    const randomInRange = (min: number, max: number) => {
      return Math.random() * (max - min) + min;
    };

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);

      confetti({
        particleCount,
        startVelocity: 30,
        spread: 360,
        origin: {
          x: randomInRange(0.1, 0.3),
          y: Math.random() - 0.2,
        },
        colors: ['#f97316', '#ef4444', '#8b5cf6', '#fbbf24'],
      });

      confetti({
        particleCount,
        startVelocity: 30,
        spread: 360,
        origin: {
          x: randomInRange(0.7, 0.9),
          y: Math.random() - 0.2,
        },
        colors: ['#f97316', '#ef4444', '#8b5cf6', '#fbbf24'],
      });
    }, 250);

    return () => clearInterval(interval);
  }, []);

  const tierColors: Record<string, string> = {
    spark: 'from-gray-500 to-gray-600',
    flame: 'from-cyan-600 to-blue-600',
    inferno: 'from-red-500 to-purple-600',
    scout: 'from-blue-500 to-cyan-500',
    dealflow_pro: 'from-indigo-500 to-purple-600',
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-lg w-full text-center"
      >
        {/* Success Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="mb-8"
        >
          <div className={`w-24 h-24 rounded-full bg-gradient-to-br ${tierColors[tier]} mx-auto flex items-center justify-center shadow-2xl`}>
            <CheckCircle className="w-12 h-12 text-white" />
          </div>
        </motion.div>

        {/* Welcome Message */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h1 className="text-4xl font-bold text-white mb-4">
            Welcome to {tierDetails.name}! 🎉
          </h1>
          <p className="text-xl text-gray-400 mb-8">
            Your subscription is now active. Let's get you matched!
          </p>
        </motion.div>

        {/* Plan Details Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700 mb-8"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="text-3xl">{tierDetails.icon}</span>
            <span className="text-2xl font-bold text-white">{tierDetails.name} Plan</span>
          </div>
          
          {tier !== 'spark' && (
            <div className="flex items-center justify-center gap-2 text-green-400 mb-4">
              <Gift className="w-5 h-5" />
              <span>7-day free trial started</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-sm">
            {tierDetails.features.slice(0, 6).map((feature, i) => (
              <div key={i} className="flex items-center gap-2 text-gray-300">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span className="text-left">{feature}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Next Steps */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="space-y-3"
        >
          <h3 className="text-lg font-semibold text-white mb-4">What's Next?</h3>
          
          <div className="space-y-3">
            <button
              onClick={() => navigate('/matching-engine')}
              className="w-full py-4 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-cyan-500/25 transition-all flex items-center justify-center gap-2"
            >
              <FlameIcon variant={5} size="sm" />
              Start Matching Now
              <ArrowRight className="w-5 h-5" />
            </button>

            <button
              onClick={() => navigate('/services')}
              className="w-full py-4 bg-gray-700 text-white font-semibold rounded-xl hover:bg-gray-600 transition-all flex items-center justify-center gap-2"
            >
              <Sparkles className="w-5 h-5" />
              Explore AI Services
            </button>

            <button
              onClick={() => navigate('/profile')}
              className="w-full py-3 text-gray-400 hover:text-white transition-colors"
            >
              Complete your profile →
            </button>
          </div>
        </motion.div>

        {/* Email Confirmation */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-sm text-gray-500 mt-8 flex items-center justify-center gap-2"
        >
          <Mail className="w-4 h-4" />
          A confirmation email has been sent to your inbox
        </motion.p>
      </motion.div>
    </div>
  );
};

export default SubscriptionSuccessPage;
