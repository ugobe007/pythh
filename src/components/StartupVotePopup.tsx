import { useState } from 'react';
import { ThumbsUp, ThumbsDown, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface StartupVotePopupProps {
  isOpen: boolean;
  onClose: () => void;
  startup: {
    id: string | number;
    name: string;
    description: string;
  };
}

export default function StartupVotePopup({ isOpen, onClose, startup }: StartupVotePopupProps) {
  const [voted, setVoted] = useState(false);
  const [voteType, setVoteType] = useState<'yes' | 'no' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleVote = async (vote: 'yes' | 'no') => {
    setIsSubmitting(true);
    
    try {
      // Insert vote into database
      const userId = localStorage.getItem('anon_user_id') || crypto.randomUUID();
      if (!localStorage.getItem('anon_user_id')) {
        localStorage.setItem('anon_user_id', userId);
      }
      
      const { error } = await (supabase.from as any)('votes')
        .insert({
          user_id: userId,
          vote: vote,
          weight: 1.0,
          metadata: { startup_local_id: String(startup.id) },
          created_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error submitting vote:', error);
        return;
      }

      setVoteType(vote);
      setVoted(true);
      
      // Auto-close after 2 seconds
      setTimeout(() => {
        onClose();
        // Reset state for next time
        setTimeout(() => {
          setVoted(false);
          setVoteType(null);
        }, 300);
      }, 2000);
    } catch (error) {
      console.error('Error submitting vote:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="relative bg-gradient-to-br from-slate-800 to-slate-700 rounded-3xl p-8 max-w-md w-full border-2 border-slate-500 shadow-2xl shadow-cyan-500/20"
        onClick={(e) => e.stopPropagation()}
      >
        {/* pyth ai Accent */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-xs font-bold px-4 py-1 rounded-full">
          🔥 pyth ai
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        {!voted ? (
          <>
            {/* Header */}
            <div className="text-center mb-6 mt-2">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">What do you think?</h2>
              <p className="text-cyan-600 text-lg font-semibold">{startup.name}</p>
              <p className="text-gray-600 text-sm mt-2 line-clamp-2">{startup.description}</p>
            </div>

            {/* Vote Buttons */}
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleVote('yes')}
                disabled={isSubmitting}
                className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-bold py-5 px-6 rounded-2xl transition-all shadow-lg shadow-cyan-500/30 hover:scale-105 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center gap-2"
              >
                <span className="text-2xl">🔮</span>
                <span>Sweet Deal!</span>
              </button>

              <button
                onClick={() => handleVote('no')}
                disabled={isSubmitting}
                className="bg-white hover:bg-gray-50 text-gray-700 font-bold py-5 px-6 rounded-2xl transition-all border-2 border-gray-200 hover:border-gray-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center gap-2"
              >
                <span className="text-2xl">👋</span>
                <span>Pass</span>
              </button>
            </div>

            <p className="text-gray-500 text-xs text-center mt-4">
              Help us find the hottest startups for investors
            </p>
          </>
        ) : (
          <>
            {/* Thank You Message */}
            <div className="text-center py-4">
              <div className="text-6xl mb-4">
                {voteType === 'yes' ? '🔮' : '👋'}
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                {voteType === 'yes' ? 'Great taste!' : 'Got it!'}
              </h2>
              <p className="text-gray-600">
                {voteType === 'yes' 
                  ? 'We\'ll show you more like this' 
                  : 'Thanks for the feedback'}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
