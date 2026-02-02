/**
 * HowSignalsWorkModal
 * Educational popup: Scrapers → GOD Scoring → Matching → Signals Extraction
 * Dismissible, shown once per session
 */

import React, { useState, useEffect } from "react";

interface HowSignalsWorkModalProps {
  open?: boolean;
  onClose?: () => void;
}

export function HowSignalsWorkModal({
  open = true,
  onClose,
}: HowSignalsWorkModalProps) {
  const [isOpen, setIsOpen] = useState(open);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const dismissedKey = "pythh-how-signals-dismissed";
    const wasDismissed = sessionStorage.getItem(dismissedKey);
    if (wasDismissed) {
      setIsOpen(false);
      setDismissed(true);
    }
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    sessionStorage.setItem("pythh-how-signals-dismissed", "true");
    onClose?.();
  };

  if (!isOpen || dismissed) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-gradient-to-br from-white/10 to-white/5 border border-cyan-500/30 rounded-lg max-w-2xl w-full backdrop-blur-md shadow-2xl">
          {/* Header */}
          <div className="border-b border-white/5 px-6 py-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">How Signals Work</h2>
            <button
              onClick={handleClose}
              className="text-white/50 hover:text-white/80 transition-colors text-2xl leading-none"
            >
              ×
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-8 max-h-[60vh] overflow-y-auto">
            {/* Workflow Diagram */}
            <div className="mb-8">
              <div className="flex items-center justify-between gap-3 text-xs text-white/60 mb-6">
                {/* Step 1: Scrapers */}
                <div className="flex-1 text-center">
                  <div className="bg-white/5 border border-cyan-500/20 rounded-lg p-3 mb-2">
                    <div className="text-xl mb-1">🔍</div>
                    <div className="font-semibold text-white">Scrapers</div>
                    <div className="text-xs text-white/40 mt-1">
                      SEC Filings<br />
                      Portfolio Data<br />
                      Market Signals
                    </div>
                  </div>
                </div>

                {/* Arrow */}
                <div className="text-cyan-400 text-lg">→</div>

                {/* Step 2: GOD Scoring */}
                <div className="flex-1 text-center">
                  <div className="bg-white/5 border border-cyan-500/20 rounded-lg p-3 mb-2">
                    <div className="text-xl mb-1">📊</div>
                    <div className="font-semibold text-white">GOD Scoring</div>
                    <div className="text-xs text-white/40 mt-1">
                      Team Score<br />
                      Traction Score<br />
                      Market Score
                    </div>
                  </div>
                </div>

                {/* Arrow */}
                <div className="text-cyan-400 text-lg">→</div>

                {/* Step 3: Matching */}
                <div className="flex-1 text-center">
                  <div className="bg-white/5 border border-cyan-500/20 rounded-lg p-3 mb-2">
                    <div className="text-xl mb-1">⚡</div>
                    <div className="font-semibold text-white">Matching</div>
                    <div className="text-xs text-white/40 mt-1">
                      Score × Semantics<br />
                      Sector Alignment<br />
                      Stage Fit
                    </div>
                  </div>
                </div>

                {/* Arrow */}
                <div className="text-cyan-400 text-lg">→</div>

                {/* Step 4: Signals */}
                <div className="flex-1 text-center">
                  <div className="bg-white/5 border border-cyan-500/20 rounded-lg p-3 mb-2">
                    <div className="text-xl mb-1">📡</div>
                    <div className="font-semibold text-white">Signals</div>
                    <div className="text-xs text-white/40 mt-1">
                      Extracted<br />
                      Tracked<br />
                      Live
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Signal Types */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-white mb-4">Four Signal Types</h3>

              {[
                {
                  name: "Capital Movement",
                  desc: "Where investors are investing and planning to invest",
                },
                {
                  name: "Capital Saturation",
                  desc: "How much capital is flowing into a sector at a given time",
                },
                {
                  name: "Velocity",
                  desc: "How quickly capital is moving in a direction",
                },
                {
                  name: "Signal Conversion",
                  desc: "Who is receiving funding now and why",
                },
              ].map((signal) => (
                <div
                  key={signal.name}
                  className="bg-white/3 border border-cyan-500/10 rounded-lg p-3"
                >
                  <div className="text-sm font-medium text-cyan-300">{signal.name}</div>
                  <div className="text-xs text-white/50 mt-1">{signal.desc}</div>
                </div>
              ))}
            </div>

            {/* Footer note */}
            <div className="mt-6 text-xs text-white/40 bg-white/2 border border-white/5 rounded-lg p-3">
              Pythh extracts and tracks these signals in real-time. Once you inject your startup, you'll see your personal signal overlay overlaid on the market baseline.
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-white/5 px-6 py-4 flex justify-end gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 rounded-lg bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-sm font-medium hover:bg-cyan-500/30 hover:border-cyan-500/50 transition-all"
            >
              Got it, let's signal
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default HowSignalsWorkModal;
