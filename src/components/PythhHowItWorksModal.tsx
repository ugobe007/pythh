/**
 * PythhHowItWorksModal — First-visit animated walkthrough
 * Shows how Pythh works: Enter URL → Get matched → See signals
 * localStorage: pythh_how_it_works_dismissed
 */

import React, { useEffect, useState } from 'react';

const STORAGE_KEY = 'pythh_how_it_works_dismissed';

export function hasSeenHowItWorks(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setHowItWorksSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY, 'true');
  } catch {}
}

interface PythhHowItWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STEPS = [
  {
    title: 'Enter your URL',
    desc: 'Drop your startup website (e.g. yourstartup.com). We’ll read your page and profile.',
    icon: '🔗',
    highlight: 'url',
  },
  {
    title: 'Get matched in ~30 sec',
    desc: 'Our GOD algorithm scores you 0–100 and finds your top 50 investor matches by fit and thesis.',
    icon: '⚡',
    highlight: 'match',
  },
  {
    title: 'See signals + intro lines',
    desc: 'Signal scores show investor timing. Copy-paste intro lines for each match. Get the meeting.',
    icon: '📊',
    highlight: 'signals',
  },
];

export default function PythhHowItWorksModal({ isOpen, onClose }: PythhHowItWorksModalProps) {
  const [step, setStep] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [iconError, setIconError] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setStep(0);
      return;
    }
    setIconError(false);
    const t = setInterval(() => {
      setStep((s) => (s + 1) % STEPS.length);
    }, 2800);
    return () => clearInterval(t);
  }, [isOpen]);

  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose();
    }
    if (isOpen) window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [isOpen]);

  const handleClose = () => {
    if (dontShowAgain) setHowItWorksSeen();
    onClose();
  };

  if (!isOpen) return null;

  const s = STEPS[step];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div
        className="relative w-full max-w-lg rounded-2xl border border-cyan-500/40 bg-[#0d1117] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl" />

        {/* Close */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          aria-label="Close"
        >
          <span className="text-xl leading-none">×</span>
        </button>

        <div className="p-8 pt-10 relative">
          {/* Icon only — no text; white outline on black per brand */}
          {!iconError && (
            <div className="mb-6">
              <img
                src="/images/pythh_oracle.png"
                alt=""
                className="h-16 w-16 object-contain"
                onError={() => setIconError(true)}
              />
            </div>
          )}
          <h2 className="text-xl font-bold text-white mb-1">
            How Pythh works
          </h2>
          <p className="text-sm text-zinc-500 mb-8">
            Three steps to find the investors who want to fund you
          </p>

          {/* Step content */}
          <div
            key={step}
            className="min-h-[140px] flex flex-col items-start"
            style={{ animation: 'fade-in 0.35s ease-out' }}
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="flex items-center justify-center w-12 h-12 rounded-xl border border-cyan-500/50 bg-cyan-500/5 text-2xl">
                {s.icon}
              </span>
              <span className="text-lg font-semibold text-white">{s.title}</span>
            </div>
            <p className="text-zinc-400 text-sm leading-relaxed pl-0">
              {s.desc}
            </p>
            {/* Mini illustration per step */}
            <div className="mt-6 w-full flex justify-center">
              {s.highlight === 'url' && (
                <div className="w-full max-w-xs h-12 rounded-lg border border-cyan-500/40 bg-zinc-900/80 flex items-center px-4">
                  <span className="text-cyan-400/80 text-sm font-mono">https://yourstartup.com</span>
                  <span className="ml-auto text-xs text-zinc-500 animate-pulse">Enter URL</span>
                </div>
              )}
              {s.highlight === 'match' && (
                <div className="flex gap-2">
                  {[72, 68, 65, 61].map((score, i) => (
                    <div
                      key={i}
                      className="w-14 h-14 rounded-lg border border-cyan-500/30 bg-zinc-900/80 flex items-center justify-center text-cyan-400 font-mono text-sm"
                      style={{ animationDelay: `${i * 120}ms` }}
                    >
                      {score}
                    </div>
                  ))}
                </div>
              )}
              {s.highlight === 'signals' && (
                <div className="w-full max-w-xs space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-500">Signal</span>
                    <span className="text-cyan-400 font-mono">8.7</span>
                  </div>
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-cyan-500 rounded-full transition-all duration-500"
                      style={{ width: '87%' }}
                    />
                  </div>
                  <p className="text-[10px] text-zinc-600 truncate">
                    &ldquo;We&apos;re building the Stripe for…&rdquo;
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Step dots */}
          <div className="flex gap-2 mt-8 justify-center">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  i === step
                    ? 'bg-cyan-400 scale-125'
                    : 'bg-zinc-600 hover:bg-zinc-500'
                }`}
                aria-label={`Step ${i + 1}`}
              />
            ))}
          </div>

          {/* Don't show again + CTA */}
          <div className="mt-8 pt-6 border-t border-zinc-800">
            <label className="flex items-center gap-2 cursor-pointer group mb-4">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="rounded border-zinc-600 bg-zinc-900 text-cyan-500 focus:ring-cyan-500/50"
              />
              <span className="text-sm text-zinc-500 group-hover:text-zinc-400">
                Don&apos;t show this again
              </span>
            </label>
            <button
              onClick={handleClose}
              className="w-full py-3 px-4 rounded-lg border border-cyan-500/60 text-cyan-400 font-medium hover:bg-cyan-500/10 hover:border-cyan-400/80 transition-colors"
            >
              Get started →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
