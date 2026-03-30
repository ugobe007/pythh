/**
 * ImproveScoreWizard — 3-step flow to improve GOD score after URL match
 * =====================================================================
 * Step 1: Know your score — Show GOD score + what it means
 * Step 2: Add evidence — Deck upload + press URLs (earn bonus)
 * Step 3: See impact — Confirmation + what they've unlocked
 *
 * Shown to founders after they submit URL and see matches.
 */

import { useState, useRef, useEffect } from 'react';
import { X, Upload, FileText, Loader2, ArrowRight, CheckCircle2, Target, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { apiUrl } from '@/lib/apiConfig';
import { GOD_SCORE_COPY } from '@/components/pythh/GODScoreExplainer';

const PYTHH_STARTUP_KEY = 'pythh_startup_id';

type WizardStep = 1 | 2 | 3;

interface ImproveScoreWizardProps {
  isOpen: boolean;
  onClose: () => void;
  startupId: string;
  displayName: string;
  godScore?: number;
  hasDeck?: boolean;
  onSuccess?: () => void;
}

export default function ImproveScoreWizard({
  isOpen,
  onClose,
  startupId,
  displayName,
  godScore,
  hasDeck = false,
  onSuccess,
}: ImproveScoreWizardProps) {
  const { isLoggedIn } = useAuth();
  const [step, setStep] = useState<WizardStep>(1);
  const [needsSignup, setNeedsSignup] = useState(!isLoggedIn);

  // Signup state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signupError, setSignupError] = useState('');
  const [signingUp, setSigningUp] = useState(false);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deckUploaded, setDeckUploaded] = useState(hasDeck);
  const [pressUrl, setPressUrl] = useState('');
  const [pressSubmitting, setPressSubmitting] = useState(false);
  const [pressError, setPressError] = useState<string | null>(null);
  const [pressAdded, setPressAdded] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setNeedsSignup(!isLoggedIn);
      setDeckUploaded(hasDeck);
    }
  }, [isOpen, isLoggedIn, hasDeck]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email?.trim() || !password?.trim()) return;
    setSignupError('');
    setSigningUp(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { name: email.split('@')[0], role: 'founder' } },
      });
      if (error?.message.toLowerCase().includes('already registered')) {
        const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInErr) throw signInErr;
        if (signInData?.session) {
          localStorage.setItem(PYTHH_STARTUP_KEY, startupId);
          setNeedsSignup(false);
          setStep(2);
        }
        return;
      }
      if (error) throw error;
      if (data?.session) {
        localStorage.setItem(PYTHH_STARTUP_KEY, startupId);
        setNeedsSignup(false);
        setStep(2);
      }
    } catch (err: unknown) {
      setSignupError(err instanceof Error ? err.message : 'Sign up failed. Please try again.');
    } finally {
      setSigningUp(false);
    }
  };

  const handleDeckUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      const res = await fetch(apiUrl('/api/deck/upload'), { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.detail || 'Upload failed');
      setDeckUploaded(true);
      onSuccess?.();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleAddPressUrl = async () => {
    const url = pressUrl.trim();
    if (!url) return;
    try {
      new URL(url);
    } catch {
      setPressError('Please enter a valid URL.');
      return;
    }
    setPressError(null);
    setPressSubmitting(true);
    try {
      const res = await fetch(apiUrl('/api/deck/press-url'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startupId, url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'Failed to add press URL');
      setPressAdded((prev) => [...prev, url]);
      setPressUrl('');
      onSuccess?.();
    } catch (err) {
      setPressError(err instanceof Error ? err.message : 'Failed to add. Try again.');
    } finally {
      setPressSubmitting(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setSignupError('');
    setUploadError(null);
    setPressError(null);
    setPressUrl('');
    setPressAdded([]);
    onClose();
  };

  const goToStep2 = () => {
    if (needsSignup) return;
    setStep(2);
  };

  const goToStep3 = () => setStep(3);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50" onClick={handleClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-zinc-900 border border-zinc-700/60 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden"
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

            {/* Step indicator */}
            <div className="flex gap-2 mb-6">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    step >= s ? 'bg-cyan-500' : 'bg-zinc-700'
                  }`}
                />
              ))}
            </div>

            {/* Step 1: Know your score */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                    <Target className="w-6 h-6 text-cyan-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white">Step 1: Know your score</h2>
                    <p className="text-sm text-zinc-400">Understand what investors see</p>
                  </div>
                </div>

                <div className="rounded-xl bg-zinc-800/60 border border-zinc-700/50 p-5 text-center">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Your GOD score</p>
                  <p className="text-4xl font-bold text-white">
                    {godScore != null ? godScore : '—'}
                  </p>
                  <p className="text-xs text-zinc-500 mt-2 max-w-[280px] mx-auto">
                    {GOD_SCORE_COPY.tagline}
                  </p>
                </div>

                <div className="border-t border-zinc-800 pt-4">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">
                    What VCs evaluate
                  </p>
                  <ul className="text-xs text-zinc-400 space-y-1.5">
                    {GOD_SCORE_COPY.vcCriteria.map(({ label, desc }) => (
                      <li key={label} className="flex gap-2">
                        <span className="text-cyan-400/80 font-medium w-14">{label}</span>
                        <span>{desc}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {needsSignup ? (
                  <div className="space-y-4 pt-2">
                    <p className="text-sm text-zinc-500">
                      Sign up to add evidence and boost your score for <span className="text-white">{displayName}</span>.
                    </p>
                    <form onSubmit={handleSignUp} className="space-y-4">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@company.com"
                        className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:border-cyan-500 outline-none"
                        required
                      />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password (6+ chars)"
                        className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:border-cyan-500 outline-none"
                        required
                        minLength={6}
                      />
                      {signupError && <p className="text-sm text-red-400">{signupError}</p>}
                      <button
                        type="submit"
                        disabled={signingUp}
                        className="w-full py-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {signingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        Continue to add evidence
                      </button>
                    </form>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={goToStep2}
                    className="w-full py-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium flex items-center justify-center gap-2"
                  >
                    Add evidence to boost your score
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            {/* Step 2: Add evidence */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white">Step 2: Add evidence</h2>
                    <p className="text-sm text-zinc-400">Show proof of your accomplishments</p>
                  </div>
                </div>

                <p className="text-sm text-zinc-500">
                  Startups with evidence get a score boost. Add your deck and press to improve your position.
                </p>

                {/* Deck upload */}
                <div>
                  <p className="text-xs text-zinc-400 mb-2">Pitch deck</p>
                  {deckUploaded ? (
                    <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-4 py-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                      <span className="text-sm text-emerald-300">Deck uploaded — score will update</span>
                    </div>
                  ) : (
                    <>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,application/pdf"
                        onChange={handleDeckUpload}
                        className="hidden"
                      />
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-zinc-600 rounded-xl p-6 text-center cursor-pointer hover:border-cyan-500/50 hover:bg-zinc-800/40 transition-colors"
                      >
                        {uploading ? (
                          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-2" />
                        ) : (
                          <Upload className="w-8 h-8 text-zinc-500 mx-auto mb-2" />
                        )}
                        <p className="text-white font-medium text-sm">
                          {uploading ? 'Scoring your deck…' : 'Upload PDF (max 10MB)'}
                        </p>
                        <p className="text-xs text-zinc-500 mt-0.5">We extract metrics and update your GOD score</p>
                      </div>
                      {uploadError && <p className="text-sm text-red-400 mt-2">{uploadError}</p>}
                    </>
                  )}
                </div>

                {/* Press URLs */}
                <div>
                  <p className="text-xs text-zinc-400 mb-2">Press coverage</p>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={pressUrl}
                      onChange={(e) => setPressUrl(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddPressUrl())}
                      placeholder="https://techcrunch.com/..."
                      className="flex-1 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:border-cyan-500 outline-none text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleAddPressUrl}
                      disabled={!pressUrl.trim() || pressSubmitting}
                      className="px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-medium disabled:opacity-50"
                    >
                      {pressSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add'}
                    </button>
                  </div>
                  {pressAdded.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {pressAdded.map((u) => (
                        <li key={u} className="flex items-center gap-2 text-xs text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {u.length > 50 ? u.slice(0, 50) + '…' : u}
                        </li>
                      ))}
                    </ul>
                  )}
                  {pressError && <p className="text-sm text-red-400 mt-1">{pressError}</p>}
                  <p className="text-[10px] text-zinc-600 mt-1">Add article URLs for third-party validation</p>
                </div>

                <button
                  type="button"
                  onClick={goToStep3}
                  className="w-full py-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium flex items-center justify-center gap-2"
                >
                  See your impact
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Step 3: See impact */}
            {step === 3 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-amber-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white">Step 3: See your impact</h2>
                    <p className="text-sm text-zinc-400">You&apos;re on your way</p>
                  </div>
                </div>

                <div className="rounded-xl bg-zinc-800/60 border border-zinc-700/50 p-5 space-y-3">
                  <p className="text-sm text-zinc-400">
                    {deckUploaded || pressAdded.length > 0 ? (
                      <>
                        You&apos;ve added evidence of your accomplishments. Your GOD score will update on the next
                        recalculation (usually within an hour). Founders with decks and press get a boost.
                      </>
                    ) : (
                      <>
                        Add your deck and press URLs in Step 2 to earn an accomplishment bonus. This helps
                        investors see your traction and validation.
                      </>
                    )}
                  </p>
                  <ul className="text-xs text-zinc-500 space-y-1">
                    {deckUploaded && (
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        Pitch deck — metrics extracted, score will reflect
                      </li>
                    )}
                    {pressAdded.length > 0 && (
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        {pressAdded.length} press URL(s) added
                      </li>
                    )}
                    {!deckUploaded && (
                      <li className="flex items-center gap-2 text-zinc-600">
                        <FileText className="w-4 h-4 shrink-0" />
                        Upload deck for +2 score bonus
                      </li>
                    )}
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={handleClose}
                  className="w-full py-3 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white font-medium"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
