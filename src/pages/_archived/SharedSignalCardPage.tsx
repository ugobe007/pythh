/**
 * Shared Signal Card View
 * 
 * Public view when someone accesses a shared signal card via link.
 * Shows the signal details with optional commenting if enabled.
 */

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Send, Lock, Clock, ExternalLink } from 'lucide-react';
import { getSharedItem, addComment, getComments, type SignalCardComment } from '../services/signalCardSharingService';
import VCQuoteCard from '../components/VCQuoteCard';

// Lens color mapping
const LENS_COLORS: Record<string, string> = {
  god: '#22d3ee',
  yc: '#f97316',
  sequoia: '#ef4444',
  a16z: '#a855f7',
  foundersfund: '#22c55e',
  greylock: '#6366f1',
};

const LENS_NAMES: Record<string, string> = {
  god: 'GOD Score',
  yc: 'YC',
  sequoia: 'Sequoia',
  a16z: 'a16z',
  foundersfund: 'Founders Fund',
  greylock: 'Greylock',
};

export default function SharedSignalCardPage() {
  const { token } = useParams<{ token: string }>();
  const [item, setItem] = useState<any>(null);
  const [canComment, setCanComment] = useState(false);
  const [comments, setComments] = useState<SignalCardComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (token) {
      loadSharedItem();
    }
  }, [token]);

  const loadSharedItem = async () => {
    setIsLoading(true);
    const result = await getSharedItem(token!);
    
    if (result.success && result.item) {
      setItem(result.item);
      setCanComment(result.canComment ?? false);
      
      if (result.canComment) {
        const commentsResult = await getComments({ itemId: result.item.id });
        setComments(commentsResult.comments);
      }
    } else {
      setError(result.error || 'Signal card not found or link has expired');
    }
    
    setIsLoading(false);
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !item) return;
    
    setIsSending(true);
    const result = await addComment({ itemId: item.id }, newComment.trim());
    setIsSending(false);

    if (result.success) {
      setNewComment('');
      // Refresh comments
      const commentsResult = await getComments({ itemId: item.id });
      setComments(commentsResult.comments);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0e13] flex items-center justify-center">
        <div className="text-zinc-500">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0e13] flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-xl text-white mb-2">Access Denied</h1>
          <p className="text-zinc-500 mb-6">{error}</p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-violet-400 hover:text-violet-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Go to PYTHH
          </Link>
        </div>
      </div>
    );
  }

  const lensAccent = item?.lens_id ? LENS_COLORS[item.lens_id] || '#22d3ee' : '#22d3ee';
  const lensName = item?.lens_id ? LENS_NAMES[item.lens_id] || item.lens_id : null;

  return (
    <div 
      className="min-h-screen"
      style={{ 
        background: 'linear-gradient(180deg, #0a0e13 0%, #0d1117 50%, #0a0e13 100%)',
        fontFamily: 'Inter, system-ui, sans-serif'
      }}
    >
      {/* Header */}
      <header className="border-b border-zinc-800/60">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="text-white font-semibold text-lg tracking-tight">
              pythh
            </Link>
            <div className="text-xs text-zinc-500 flex items-center gap-2">
              <Lock className="w-3 h-3" />
              Shared Signal Card
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        {/* Signal Card */}
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800/60 overflow-hidden">
          {/* Card Header */}
          <div className="px-6 py-6 border-b border-zinc-800/40">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
                  📡 Signal Card
                </div>
                <h1 className="text-2xl font-bold text-white">
                  {item.entity_name || 'Unknown'}
                </h1>
                <p className="text-zinc-500 mt-1 capitalize">
                  {item.entity_type}
                </p>
              </div>
              
              {lensName && (
                <div 
                  className="px-3 py-1.5 rounded-lg text-sm font-medium"
                  style={{ 
                    backgroundColor: `${lensAccent}15`,
                    color: lensAccent,
                    border: `1px solid ${lensAccent}30`
                  }}
                >
                  {lensName}
                </div>
              )}
            </div>

            {/* Score Display */}
            {item.score_value && (
              <div className="flex items-center gap-6 mt-6">
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Score</div>
                  <div 
                    className="text-4xl font-bold tabular-nums"
                    style={{ color: lensAccent }}
                  >
                    {item.score_value.toFixed(1)}
                  </div>
                </div>
                
                {item.rank && (
                  <div>
                    <div className="text-xs text-zinc-500 mb-1">Rank</div>
                    <div className="text-2xl font-bold text-white">
                      #{item.rank}
                      {item.rank_delta !== null && item.rank_delta !== 0 && (
                        <span className={`text-sm ml-2 ${item.rank_delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {item.rank_delta > 0 ? '↑' : '↓'}{Math.abs(item.rank_delta)}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                
                {item.time_window && (
                  <div>
                    <div className="text-xs text-zinc-500 mb-1">Window</div>
                    <div className="text-lg text-zinc-300">{item.time_window}</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Context */}
          {item.context && (
            <div className="px-6 py-4 border-b border-zinc-800/40 bg-zinc-900/30">
              <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Context</div>
              <p className="text-zinc-400 text-sm">{item.context}</p>
            </div>
          )}

          {/* Notes from founder */}
          {item.notes && item.notes.length > 0 && (
            <div className="px-6 py-4 border-b border-zinc-800/40">
              <div className="text-xs text-zinc-500 uppercase tracking-wider mb-3">
                Founder Notes
              </div>
              {item.notes.map((note: any, idx: number) => (
                <div key={idx} className="text-zinc-300 text-sm bg-zinc-800/30 rounded-lg p-3 mb-2 last:mb-0">
                  {note.note}
                  <div className="text-xs text-zinc-600 mt-2">
                    {new Date(note.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Comments section */}
          {canComment && (
            <div className="px-6 py-4">
              <div className="flex items-center gap-2 text-xs text-zinc-500 uppercase tracking-wider mb-4">
                <MessageSquare className="w-3 h-3" />
                Discussion
              </div>

              {/* Comment input */}
              <div className="flex gap-3 mb-6">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmitComment()}
                  placeholder="Add a comment..."
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                />
                <button
                  onClick={handleSubmitComment}
                  disabled={isSending || !newComment.trim()}
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>

              {/* Comments list */}
              {comments.length > 0 ? (
                <div className="space-y-4">
                  {comments.map((comment) => (
                    <div key={comment.id} className="bg-zinc-800/30 rounded-lg p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center text-violet-400 text-sm font-medium">
                          {(comment.author?.display_name || 'A')[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="text-zinc-300 text-sm font-medium">
                            {comment.author?.display_name || 'Anonymous'}
                          </div>
                          <div className="text-zinc-600 text-xs">
                            {new Date(comment.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <p className="text-zinc-400 text-sm pl-11">{comment.comment}</p>

                      {/* Replies */}
                      {comment.replies && comment.replies.length > 0 && (
                        <div className="ml-11 mt-3 space-y-3 border-l-2 border-zinc-700 pl-4">
                          {comment.replies.map((reply) => (
                            <div key={reply.id}>
                              <div className="flex items-center gap-2 mb-1">
                                <div className="text-zinc-400 text-xs font-medium">
                                  {reply.author?.display_name || 'Anonymous'}
                                </div>
                                <div className="text-zinc-600 text-xs">
                                  {new Date(reply.created_at).toLocaleDateString()}
                                </div>
                              </div>
                              <p className="text-zinc-500 text-sm">{reply.comment}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-zinc-600 text-sm">
                  No comments yet. Be the first to share your thoughts.
                </div>
              )}
            </div>
          )}
        </div>

        {/* VC Wisdom */}
        <div className="mt-8">
          <VCQuoteCard variant="featured" allowRefresh={true} />
        </div>

        {/* CTA */}
        <div className="mt-8 text-center">
          <p className="text-zinc-500 text-sm mb-4">
            Want to track signals like this?
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium transition-colors"
          >
            Try PYTHH
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/60 mt-12">
        <div className="max-w-3xl mx-auto px-6 py-8 text-center">
          <p className="text-zinc-600 text-sm">
            Capital moves in patterns. We make them visible.
          </p>
        </div>
      </footer>
    </div>
  );
}
