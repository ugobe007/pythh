/**
 * ImproveScoreModal — Sign up → Upload deck (and optionally press)
 * ================================================================
 * Flow: Click "Upload deck" → Sign up first (if not logged in) → Then upload
 * Used on SignalMatches results page to capture founders and improve their score.
 */

import { useState, useRef, useEffect } from 'react';
import { X, Upload, FileText, Loader2, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { apiUrl } from '@/lib/apiConfig';

const PYTHH_STARTUP_KEY = 'pythh_startup_id';

interface ImproveScoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  startupId: string;
  displayName: string;
  godScore?: number;
  onSuccess?: () => void;
}

export default function ImproveScoreModal({
  isOpen,
  onClose,
  startupId,
  displayName,
  godScore,
  onSuccess,
}: ImproveScoreModalProps) {
  const { isLoggedIn } = useAuth();
  const [phase, setPhase] = useState<'signup' | 'upload'>(
    isLoggedIn ? 'upload' : 'signup'
  );
  useEffect(() => {
    if (isOpen) setPhase(isLoggedIn ? 'upload' : 'signup');
  }, [isOpen, isLoggedIn]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signupError, setSignupError] = useState('');
  const [signingUp, setSigningUp] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [pressUrl, setPressUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email?.trim() || !password?.trim()) return;
    setSignupError('');
    setSigningUp(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { name: email.split('@')[0], role: 'founder' },
        },
      });
      if (error) {
        if (error.message.toLowerCase().includes('already registered')) {
          const { data: signInData, error: signInErr } =
            await supabase.auth.signInWithPassword({
              email: email.trim(),
              password,
            });
          if (signInErr) throw signInErr;
          if (signInData?.session) {
            localStorage.setItem(PYTHH_STARTUP_KEY, startupId);
            setPhase('upload');
          }
          return;
        }
        throw error;
      }
      if (data?.session) {
        localStorage.setItem(PYTHH_STARTUP_KEY, startupId);
        setPhase('upload');
      }
    } catch (err: unknown) {
      setSignupError(
        err instanceof Error ? err.message : 'Sign up failed. Please try again.'
      );
    } finally {
      setSigningUp(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.type !== 'application/pdf') {
      setUploadError('Please select a PDF file.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File must be under 10MB.');
      return;
    }
    setUploadError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append('deck', file);
      form.append('startup_id', startupId);
      const res = await fetch(apiUrl('/api/deck/upload'), {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.detail || 'Upload failed');
      setUploadSuccess(true);
      onSuccess?.();
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'Upload failed. Please try again.'
      );
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleClose = () => {
    setPhase(isLoggedIn ? 'upload' : 'signup');
    setSignupError('');
    setUploadError(null);
    setUploadSuccess(false);
    setPressUrl('');
    onClose();
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
        onClick={handleClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-zinc-900 border border-zinc-700/60 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6 relative">
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white transition"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            {phase === 'signup' ? (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                    <FileText className="w-6 h-6 text-cyan-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white">
                      Improve your score
                    </h2>
                    <p className="text-sm text-zinc-400">
                      Sign up to upload your deck and get better matches
                    </p>
                  </div>
                </div>
                <p className="text-sm text-zinc-500 mb-4">
                  Upload your pitch deck for <span className="text-white">{displayName}</span>.
                  We&apos;ll analyze it and update your GOD score for better investor fits.
                </p>
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">
                      Password
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 outline-none"
                      required
                      minLength={6}
                    />
                  </div>
                  {signupError && (
                    <p className="text-sm text-red-400">{signupError}</p>
                  )}
                  <button
                    type="submit"
                    disabled={signingUp}
                    className="w-full py-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                  >
                    {signingUp ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Creating account…
                      </>
                    ) : (
                      <>
                        Continue to upload
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
                <p className="text-xs text-zinc-500 mt-4 text-center">
                  Already have an account? Sign in with your email above.
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <Upload className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white">
                      Upload your deck
                    </h2>
                    <p className="text-sm text-zinc-400">
                      {displayName} {godScore != null && `· GOD ${godScore}`}
                    </p>
                  </div>
                </div>
                {uploadSuccess ? (
                  <div className="py-8 text-center">
                    <p className="text-emerald-400 font-medium mb-1">
                      Deck uploaded successfully
                    </p>
                    <p className="text-sm text-zinc-500 mb-6">
                      Your GOD score has been updated. Close to see your new matches.
                    </p>
                    <button
                      onClick={handleClose}
                      className="px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white text-sm transition-colors"
                    >
                      Done
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,application/pdf"
                      onChange={handleUpload}
                      className="hidden"
                    />
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-zinc-600 rounded-xl p-8 text-center cursor-pointer hover:border-cyan-500/50 hover:bg-zinc-800/40 transition-colors"
                    >
                      {uploading ? (
                        <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mx-auto mb-3" />
                      ) : (
                        <Upload className="w-10 h-10 text-zinc-500 mx-auto mb-3" />
                      )}
                      <p className="text-white font-medium mb-1">
                        {uploading ? 'Scoring your deck…' : 'Click to upload PDF'}
                      </p>
                      <p className="text-xs text-zinc-500">
                        Max 10MB · We&apos;ll extract signals and update your GOD score
                      </p>
                    </div>
                    {uploadError && (
                      <p className="text-sm text-red-400 mt-3">{uploadError}</p>
                    )}
                    {/* Press articles — coming soon placeholder */}
                    <div className="mt-6 pt-6 border-t border-zinc-800">
                      <p className="text-xs text-zinc-500 mb-2">
                        Have press coverage? Add article URLs to boost your score.
                      </p>
                      <input
                        type="url"
                        value={pressUrl}
                        onChange={(e) => setPressUrl(e.target.value)}
                        placeholder="https://techcrunch.com/..."
                        disabled
                        className="w-full px-3 py-2 rounded-lg bg-zinc-800/50 border border-zinc-800 text-zinc-600 text-sm cursor-not-allowed"
                      />
                      <p className="text-[10px] text-zinc-600 mt-1">
                        Coming soon
                      </p>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
