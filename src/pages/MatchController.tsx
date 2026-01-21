/**
 * MATCH CONTROLLER
 * ================
 * Thin controller route: scan → redirect to /results
 * 
 * This is NOT a results page. It:
 * 1. Receives ?url=... from homepage form
 * 2. Calls /api/scan (or resolves startup)
 * 3. Redirects to /results?url=... (the real product surface)
 * 
 * INVARIANT: /match never renders results or diagnostics.
 */

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, Sparkles } from "lucide-react";
import { resolveStartupFromUrl } from "../lib/startupResolver";

// Analysis steps for loading UI
const SCAN_STEPS = [
  { label: "Resolving startup...", duration: 800 },
  { label: "Analyzing sector alignment...", duration: 600 },
  { label: "Computing investor matches...", duration: 700 },
  { label: "Building your results...", duration: 500 },
];

export default function MatchController() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const url = params.get("url");

  useEffect(() => {
    if (!url) {
      // No URL provided - redirect to homepage
      navigate("/", { replace: true });
      return;
    }

    let alive = true;
    let stepTimer: NodeJS.Timeout;

    // Animate through scan steps
    const animateSteps = () => {
      let currentStep = 0;
      const advanceStep = () => {
        if (!alive || currentStep >= SCAN_STEPS.length - 1) return;
        currentStep++;
        setStep(currentStep);
        stepTimer = setTimeout(advanceStep, SCAN_STEPS[currentStep].duration);
      };
      stepTimer = setTimeout(advanceStep, SCAN_STEPS[0].duration);
    };

    const runScan = async () => {
      try {
        animateSteps();

        // Resolve startup (creates or finds in DB)
        const result = await resolveStartupFromUrl(url);
        
        if (!alive) return;

        // Build redirect URL
        const qs = new URLSearchParams({ url });
        
        // If we got a startup ID, pass it
        if (result.startup?.id) {
          qs.set("startupId", result.startup.id);
        }

        // Redirect to the real results page
        navigate(`/results?${qs.toString()}`, { replace: true });
      } catch (err) {
        if (!alive) return;
        console.error("[MatchController] Scan failed:", err);
        
        // Even on error, redirect to results with error flag
        // The results page will show a degraded state
        const qs = new URLSearchParams({ 
          url, 
          reason: "scan_failed",
          error: err instanceof Error ? err.message : "Unknown error"
        });
        navigate(`/results?${qs.toString()}`, { replace: true });
      }
    };

    runScan();

    return () => {
      alive = false;
      if (stepTimer) clearTimeout(stepTimer);
    };
  }, [url, navigate]);

  // Loading UI while scan runs
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-4">
        {/* Animated icon */}
        <div className="relative mb-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-violet-600/30 to-cyan-600/30 border border-violet-500/30 flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-violet-400 animate-pulse" />
          </div>
          <div className="absolute inset-0 w-16 h-16 mx-auto rounded-2xl bg-violet-500/20 animate-ping" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-white mb-2">
          Building your investor matches
        </h1>
        
        {/* URL being scanned */}
        <p className="text-gray-400 text-sm mb-6 truncate">
          {url?.replace(/^https?:\/\//, "")}
        </p>

        {/* Progress steps */}
        <div className="space-y-2">
          {SCAN_STEPS.map((s, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 transition-all duration-300 ${
                i <= step ? "opacity-100" : "opacity-30"
              }`}
            >
              {i < step ? (
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                </div>
              ) : i === step ? (
                <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
              ) : (
                <div className="w-5 h-5 rounded-full border border-gray-700" />
              )}
              <span className={`text-sm ${i <= step ? "text-gray-300" : "text-gray-600"}`}>
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {/* Error state (rarely shown - we redirect even on error) */}
        {error && (
          <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
