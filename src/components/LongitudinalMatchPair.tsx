import React, { useMemo, useState } from "react";
import { ExternalLink, MapPin, Copy, Bookmark, UserRound, Building2, Check } from "lucide-react";

type Props = {
  startup: {
    id: string | number;
    name?: string;
    tagline?: string;
    description?: string;
    website?: string;
    location?: string;
    sectors?: string[];
    stage?: any;
    total_god_score?: number | null;
  };
  investor: {
    id: string;
    name: string;
    firm?: string;
    photo_url?: string;
    linkedin_url?: string;
    // legacy compatibility (optional)
    linkedin?: string;

    sectors?: string[];
    stage?: string[] | string;
    check_size_min?: number | null;
    check_size_max?: number | null;
    geography?: string;
    geography_focus?: any;
  };
  matchScore: number;
  reasoning?: string[];
  isAnalyzing?: boolean;

  // Optional actions (parent owns state + side effects)
  onViewInvestor?: (investorId: string) => void;
  onCopyOutreach?: (payload: {
    startupId: string | number;
    startupName: string;
    investorId: string;
    investorName: string;
    investorFirm?: string;
    linkedinUrl?: string;
    reasons: string[];
    matchScore: number;
  }) => void;
  onToggleSave?: (payload: {
    startupId: string | number;
    investorId: string;
    saved: boolean;
  }) => void;
  isSaved?: boolean;
};

function fmtStage(stage: any) {
  if (stage === null || stage === undefined) return "";
  if (typeof stage === "number") {
    const map = ["Idea", "Pre-seed", "Seed", "Series A", "Series B", "Series C+"];
    return map[stage] || "Seed";
  }
  return String(stage);
}

function fmtCheck(min?: number | null, max?: number | null) {
  if (!min && !max) return "Check size undisclosed";
  const f = (n: number) => {
    if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
    return `$${n}`;
  };
  const left = min ? f(min) : "$0";
  const right = max ? f(max) : "$10M+";
  return `${left} – ${right}`;
}

function hostOf(url?: string) {
  if (!url) return "";
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function topReasons(reasons?: string[]) {
  const r = (reasons || []).map((x) => (x || "").trim()).filter(Boolean);
  return r.slice(0, 2);
}

function clampMatchScore(score: number) {
  if (!Number.isFinite(score)) return 0;
  const n = Math.round(score);
  return Math.max(0, Math.min(100, n));
}

// Fallback clipboard copy for Safari/insecure contexts
function fallbackCopyToClipboard(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand("copy");
      document.body.removeChild(textarea);
      resolve();
    } catch (err) {
      document.body.removeChild(textarea);
      reject(err);
    }
  });
}

// Normalize LinkedIn URL
function normalizeLinkedInUrl(url: string): string {
  if (!url) return "";
  const trimmed = url.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

export default function LongitudinalMatchPair({
  startup,
  investor,
  matchScore,
  reasoning,
  isAnalyzing,

  onViewInvestor,
  onCopyOutreach,
  onToggleSave,
  isSaved = false,
}: Props) {
  const startupId = startup?.id;
  const investorId = investor?.id;
  const startupName = startup?.name || "Startup";
  const startupHost = hostOf(startup?.website);
  const startupStage = fmtStage(startup?.stage);
  const startupSectors = (startup?.sectors || []).slice(0, 3);

  const invName = investor?.name || "Investor";
  const invFirm = (investor?.firm || "").trim();
  const invSectors = (investor?.sectors || []).slice(0, 3);
  const invStages = Array.isArray(investor?.stage)
    ? investor.stage.slice(0, 2).join(" • ")
    : investor?.stage
    ? String(investor.stage)
    : "";
  const invCheck = fmtCheck(investor?.check_size_min, investor?.check_size_max);

  const linkedinUrl = normalizeLinkedInUrl(investor?.linkedin_url || (investor as any)?.linkedin || "");
  const score = clampMatchScore(matchScore);
  const reasons = useMemo(() => topReasons(reasoning), [reasoning]);
  
  // Action availability (disable if IDs missing)
  const canSave = !!startupId && !!investorId;
  const canCopy = !!startupId && !!investorId && !!startupName && !!invName;
  const canViewInvestor = !!investorId;

  // UI state for toast notifications
  const [showCopyToast, setShowCopyToast] = useState(false);
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [saveToastMessage, setSaveToastMessage] = useState("");
  const [copyError, setCopyError] = useState(false);
  
  // Optimistic save state
  const [optimisticSaved, setOptimisticSaved] = useState(isSaved);
  const [photoError, setPhotoError] = useState(false);

  // Sync optimistic state with prop
  React.useEffect(() => {
    setOptimisticSaved(isSaved);
  }, [isSaved]);

  // Telemetry: Track match view (stable deps to prevent double-firing)
  React.useEffect(() => {
    if (!startupId || !investorId) return;
    console.log(`📊 [Telemetry] matchpair_viewed`, { startup_id: startupId, investor_id: investorId, matchScore: score });
    // TODO: Send to analytics service
    // analytics.track('matchpair_viewed', { startup_id: startupId, investor_id: investorId, matchScore: score });
  }, [startupId, investorId, score]);

  const handleCopy = async () => {
    if (!onCopyOutreach) return;
    if (!startupId || !investorId) {
      console.warn('⚠️ Missing IDs — cannot copy outreach');
      return;
    }
    
    setCopyError(false);
    onCopyOutreach({
      startupId,
      startupName,
      investorId,
      investorName: invName,
      investorFirm: invFirm || undefined,
      linkedinUrl: linkedinUrl || undefined,
      reasons,
      matchScore: score,
    });

    // Show success toast
    setShowCopyToast(true);
    setTimeout(() => setShowCopyToast(false), 2500);
  };

  const handleSave = () => {
    if (!onToggleSave) return;
    if (!startupId || !investorId) {
      console.warn('⚠️ Missing IDs — cannot save match');
      return;
    }
    
    // Optimistic update
    const newSavedState = !optimisticSaved;
    setOptimisticSaved(newSavedState);
    
    // Show toast
    setSaveToastMessage(newSavedState ? "Saved ✅" : "Removed");
    setShowSaveToast(true);
    setTimeout(() => setShowSaveToast(false), 2000);
    
    // Call parent handler
    onToggleSave({
      startupId,
      investorId,
      saved: newSavedState,
    });
  };

  return (
    <div className="w-full space-y-3 relative">
      {/* Toast notifications */}
      {showCopyToast && (
        <div role="status" aria-live="polite" className="fixed top-20 right-6 z-50 px-4 py-2.5 rounded-xl bg-green-500/90 backdrop-blur-md border border-green-400/50 text-white text-sm font-medium shadow-lg animate-in slide-in-from-top-5 fade-in duration-300">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4" aria-hidden="true" />
            Outreach copied ✅
          </div>
        </div>
      )}
      
      {showSaveToast && (
        <div role="status" aria-live="polite" className="fixed top-20 right-6 z-50 px-4 py-2.5 rounded-xl bg-blue-500/90 backdrop-blur-md border border-blue-400/50 text-white text-sm font-medium shadow-lg animate-in slide-in-from-top-5 fade-in duration-300">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4" aria-hidden="true" />
            {saveToastMessage}
          </div>
        </div>
      )}

      {/* STARTUP CARD (pinned) */}
      <div className="w-full rounded-2xl border border-white/10 bg-[#0b0b0b]/70 backdrop-blur-md px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-lg">
                🔥
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="text-white font-semibold text-[15px] truncate">
                    {startupName}
                  </h3>

                  {startupHost && (
                    <a
                      href={startup?.website?.startsWith("http") ? startup.website : `https://${startup.website}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-white/45 font-mono truncate hover:text-white/70 inline-flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-white/30 rounded"
                      aria-label={`Visit ${startupName} website (opens in new tab)`}
                    >
                      {startupHost}
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  )}
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {startupStage && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/70">
                      {startupStage}
                    </span>
                  )}

                  {startupSectors.map((t) => (
                    <span
                      key={t}
                      className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/60"
                    >
                      {t}
                    </span>
                  ))}

                  {startup?.location && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/55 inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {startup.location}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {(startup?.tagline || startup?.description) && (
              <p className="mt-3 text-[13px] text-white/60 leading-snug line-clamp-2">
                {startup?.tagline || startup?.description}
              </p>
            )}
          </div>

          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <div className="text-[11px] text-white/45">GOD</div>
            <div className="text-white font-semibold text-[16px]">
              {startup?.total_god_score ?? "—"}
            </div>
          </div>
        </div>
      </div>

      {/* INVESTOR CARD (longitudinal, prize) */}
      <div className="w-full rounded-2xl border border-white/10 bg-[#0b0b0b]/55 backdrop-blur-md px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-11 w-11 rounded-xl overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
              {investor?.photo_url && !photoError ? (
                <img
                  src={investor.photo_url}
                  alt={invFirm ? `${invFirm} — ${invName}` : invName}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  onError={() => setPhotoError(true)}
                />
              ) : (
                <span className="text-lg">👤</span>
              )}
            </div>

            <div className="min-w-0">
              {/* Title row */}
              <div className="flex items-center gap-2 min-w-0">
                <h3 className="text-white font-semibold text-[15px] truncate">
                  {invFirm || invName}
                </h3>

                {/* If firm exists, show person name as subtle sublabel */}
                {invFirm && (
                  <span className="text-[12px] text-white/45 truncate inline-flex items-center gap-1">
                    <UserRound className="h-3 w-3" />
                    {invName}
                  </span>
                )}

                {linkedinUrl && (
                  <a
                    href={linkedinUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-white/45 hover:text-white/70 flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-white/30 rounded"
                    aria-label={`Open ${invFirm || invName} LinkedIn profile (opens in new tab)`}
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </a>
                )}
              </div>

              {/* Meta chips */}
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {invStages && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/70">
                    {invStages}
                  </span>
                )}

                <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/60">
                  {invCheck}
                </span>

                {investor?.geography && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/55 inline-flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {investor.geography}
                  </span>
                )}

                {invSectors.map((t) => (
                  <span
                    key={t}
                    className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/60"
                  >
                    {t}
                  </span>
                ))}
              </div>

              {/* Reasons */}
              {reasons.length > 0 && (
                <div className="mt-3 text-[12px] text-white/55 space-y-1">
                  {reasons.map((r, idx) => (
                    <div key={idx} className="line-clamp-1">
                      • {r}
                    </div>
                  ))}
                </div>
              )}

              {/* CTA row (product) */}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onViewInvestor?.(investor.id)}
                  disabled={!canViewInvestor || !onViewInvestor}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 text-[12px] font-medium transition disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-white/30"
                  aria-label={`View ${invFirm || invName} profile`}
                >
                  View investor
                </button>

                <button
                  type="button"
                  onClick={handleCopy}
                  disabled={!canCopy || !onCopyOutreach}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 text-[12px] font-medium transition inline-flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-white/30"
                  aria-label="Copy outreach message to clipboard"
                >
                  <Copy className="h-4 w-4" aria-hidden="true" />
                  Copy outreach
                </button>

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!canSave || !onToggleSave}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 text-[12px] font-medium transition inline-flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-white/30"
                  aria-label={optimisticSaved ? "Remove from saved matches" : "Save this match"}
                  aria-pressed={optimisticSaved}
                >
                  <Bookmark className={`h-4 w-4 ${optimisticSaved ? "fill-white text-white" : "text-white/70"}`} aria-hidden="true" />
                  {optimisticSaved ? "Saved" : "Save"}
                </button>
              </div>
            </div>
          </div>

          {/* Score column */}
          <div className="flex flex-col items-end flex-shrink-0">
            <div className="text-[11px] text-white/45">Match</div>
            <div className={`text-white font-semibold text-[18px] leading-none ${isAnalyzing ? 'animate-pulse' : ''}`}>
              {score}%
            </div>
            {isAnalyzing ? (
              <div className="mt-2 text-[11px] text-white/40 italic">re-scoring…</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
