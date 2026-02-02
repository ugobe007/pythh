/**
 * PYTHH SHARE BUTTON — Canonical Sharing Component (v1)
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * Sharing is about understanding the board.
 * Sharing is NOT about contacting investors.
 * 
 * Share popover (same everywhere):
 * ✅ Copy summary
 * Create public link (or "Copy public link" if already created)
 * Revoke link (only if a link exists)
 * 
 * Microcopy: "Public links are read-only. You can revoke anytime."
 * 
 * Defaults:
 * - expires_at = NULL (never expires)
 * - Every link is revocable via revoked_at
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useState, useRef, useEffect } from 'react';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export type ShareType = 
  | 'score_snapshot'
  | 'investor_brief'
  | 'market_slice'
  | 'scorecard_item';

interface SharePayload {
  type: ShareType;
  // Score Snapshot
  startupName?: string;
  lensId?: string;
  lensLabel?: string;
  window?: string;
  score?: number;
  rank?: number;
  rankDelta?: number;
  topDrivers?: string[];
  // Investor Brief
  investorName?: string;
  behavioralPattern?: string[];
  timing?: string;
  signalsTheyRespondTo?: string[];
  // Market Slice
  sector?: string;
  sectorFilter?: string;
  topCount?: number;
  // Scorecard Item
  entityName?: string;
  entityType?: string;
  note?: string;
}

interface LinkPayload {
  share_type: 'score_snapshot' | 'investor_brief' | 'market_slice';
  startup_id?: string;
  investor_id?: string;
  lens_id?: string;
  window?: string;
  filters?: Record<string, any>;
  top_n?: number;
  snapshot?: Record<string, any>;
}

interface ShareButtonProps {
  payload: SharePayload;
  size?: 'sm' | 'md';
  showLabel?: boolean;
  className?: string;
  /** If true, shows popover with options. If false, just copies summary on click. */
  expandable?: boolean;
  /** Additional data for creating share link */
  linkPayload?: LinkPayload;
}

// ═══════════════════════════════════════════════════════════════
// SUMMARY GENERATORS — Clean, shareable text blocks
// ═══════════════════════════════════════════════════════════════

const generateScoreSnapshotSummary = (p: SharePayload): string => {
  const lines: string[] = [];
  
  lines.push(`📊 ${p.startupName} — ${p.lensLabel || p.lensId || 'GOD'} Lens`);
  lines.push('');
  
  if (p.score !== undefined && p.rank !== undefined) {
    let scoreLine = `Score: ${p.score} · Rank #${p.rank}`;
    if (p.rankDelta !== undefined && p.rankDelta !== 0) {
      const arrow = p.rankDelta > 0 ? '↑' : '↓';
      scoreLine += ` (${arrow}${Math.abs(p.rankDelta)} this week)`;
    }
    lines.push(scoreLine);
  }
  
  if (p.window) {
    lines.push(`Window: ${p.window}`);
  }
  
  if (p.topDrivers && p.topDrivers.length > 0) {
    lines.push('');
    lines.push('Top drivers:');
    p.topDrivers.slice(0, 3).forEach(d => {
      lines.push(`• ${d}`);
    });
  }
  
  lines.push('');
  lines.push('— via Pythh');
  
  return lines.join('\n');
};

const generateInvestorBriefSummary = (p: SharePayload): string => {
  const lines: string[] = [];
  
  lines.push(`🎯 ${p.investorName}`);
  lines.push('');
  
  if (p.timing) {
    lines.push(`Current timing: ${p.timing}`);
    lines.push('');
  }
  
  if (p.behavioralPattern && p.behavioralPattern.length > 0) {
    lines.push('Behavioral pattern:');
    p.behavioralPattern.slice(0, 3).forEach(b => {
      lines.push(`• ${b}`);
    });
    lines.push('');
  }
  
  if (p.signalsTheyRespondTo && p.signalsTheyRespondTo.length > 0) {
    lines.push('Signals they respond to:');
    p.signalsTheyRespondTo.slice(0, 3).forEach(s => {
      lines.push(`• ${s}`);
    });
  }
  
  lines.push('');
  lines.push('— via Pythh');
  
  return lines.join('\n');
};

const generateMarketSliceSummary = (p: SharePayload): string => {
  const lines: string[] = [];
  
  const sectorLabel = p.sectorFilter && p.sectorFilter !== 'all' 
    ? ` · ${p.sectorFilter}` 
    : '';
  lines.push(`📈 Market View — ${p.lensLabel || p.lensId || 'GOD'} Lens${sectorLabel}`);
  lines.push('');
  
  if (p.window) {
    lines.push(`Window: ${p.window}`);
  }
  
  if (p.topCount) {
    lines.push(`Showing top ${p.topCount} startups`);
  }
  
  lines.push('');
  lines.push('— via Pythh');
  
  return lines.join('\n');
};

const generateScorecardItemSummary = (p: SharePayload): string => {
  const lines: string[] = [];
  
  const typeLabel = p.entityType === 'investor' ? '🎯' : '📊';
  lines.push(`${typeLabel} ${p.entityName}`);
  
  if (p.score !== undefined) {
    lines.push(`Score: ${p.score}`);
  }
  
  // Note: user notes are NEVER included in public shares
  
  lines.push('');
  lines.push('— via Pythh');
  
  return lines.join('\n');
};

const generateSummary = (payload: SharePayload): string => {
  switch (payload.type) {
    case 'score_snapshot':
      return generateScoreSnapshotSummary(payload);
    case 'investor_brief':
      return generateInvestorBriefSummary(payload);
    case 'market_slice':
      return generateMarketSliceSummary(payload);
    case 'scorecard_item':
      return generateScorecardItemSummary(payload);
    default:
      return '';
  }
};

// ═══════════════════════════════════════════════════════════════
// SHARE BUTTON COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function ShareButton({ 
  payload, 
  size = 'md', 
  showLabel = false,
  className = '',
  expandable = false,
  linkPayload,
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const [showPopover, setShowPopover] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [isCreatingLink, setIsCreatingLink] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowPopover(false);
      }
    };
    if (showPopover) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPopover]);

  const handleCopy = async () => {
    const summary = generateSummary(payload);
    
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleCreateLink = async () => {
    if (!linkPayload) return;
    
    setIsCreatingLink(true);
    
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002';
      const response = await fetch(`${apiUrl}/api/share-links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          share_type: linkPayload.share_type,
          payload: linkPayload,
          // Never expires by default, always public, no notes
        }),
      });
      
      if (!response.ok) throw new Error('Failed to create link');
      
      const data = await response.json();
      setShareUrl(data.url);
      setShareToken(data.token);
    } catch (err) {
      console.error('Failed to create share link:', err);
    } finally {
      setIsCreatingLink(false);
    }
  };

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const handleRevoke = async () => {
    if (!shareToken) return;
    
    setIsRevoking(true);
    
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002';
      const response = await fetch(`${apiUrl}/api/share-links/${shareToken}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!response.ok) throw new Error('Failed to revoke link');
      
      // Clear the link state
      setShareUrl(null);
      setShareToken(null);
    } catch (err) {
      console.error('Failed to revoke link:', err);
    } finally {
      setIsRevoking(false);
    }
  };

  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';

  // Simple mode: just copy on click
  if (!expandable) {
    return (
      <button
        onClick={handleCopy}
        className={`
          inline-flex items-center gap-1.5
          text-[#5f5f5f] hover:text-[#8f8f8f] 
          transition-colors
          ${className}
        `}
        title={copied ? 'Copied!' : 'Copy summary'}
      >
        {copied ? (
          <svg className={iconSize} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className={iconSize} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
        )}
        {showLabel && (
          <span className={`${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
            {copied ? 'Copied' : 'Share'}
          </span>
        )}
      </button>
    );
  }

  // Expandable mode: popover with options
  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setShowPopover(!showPopover)}
        className={`
          inline-flex items-center gap-1.5
          text-[#5f5f5f] hover:text-[#8f8f8f] 
          transition-colors
          ${className}
        `}
        title="Share options"
      >
        <svg className={iconSize} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
        {showLabel && (
          <span className={`${size === 'sm' ? 'text-xs' : 'text-sm'}`}>Share</span>
        )}
      </button>

      {showPopover && (
        <div className="absolute right-0 top-full mt-2 z-50 bg-[#232323] border border-[#2e2e2e] rounded-lg shadow-xl w-72 overflow-hidden">
          {/* Copy Summary Option */}
          <button
            onClick={() => {
              handleCopy();
              // Don't close popover so user can also create link
            }}
            className="w-full text-left px-4 py-3 hover:bg-[#2e2e2e] transition-colors flex items-center gap-3"
          >
            <svg className="w-5 h-5 text-[#5f5f5f]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <div className="flex-1">
              <div className="text-sm text-[#c0c0c0]">
                {copied ? '✓ Copied!' : 'Copy summary'}
              </div>
            </div>
          </button>

          {/* Create/Copy Link Option */}
          {linkPayload && (
            <>
              <div className="h-px bg-[#2e2e2e]" />
              
              {shareUrl ? (
                // Link exists - show copy + revoke
                <div className="px-4 py-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={shareUrl}
                      className="flex-1 text-xs bg-[#1c1c1c] border border-[#2e2e2e] rounded px-2 py-1.5 text-[#c0c0c0] font-mono truncate"
                    />
                    <button
                      onClick={handleCopyLink}
                      className="px-3 py-1.5 text-xs bg-[#3ECF8E] text-black rounded font-medium hover:bg-[#3ECF8E]/90 transition-colors whitespace-nowrap"
                    >
                      {linkCopied ? '✓' : 'Copy'}
                    </button>
                  </div>
                  
                  {/* Revoke action */}
                  <button
                    onClick={handleRevoke}
                    disabled={isRevoking}
                    className="w-full text-left text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                  >
                    {isRevoking ? 'Revoking...' : 'Revoke link'}
                  </button>
                </div>
              ) : (
                // No link yet - show create button
                <button
                  onClick={handleCreateLink}
                  disabled={isCreatingLink}
                  className="w-full text-left px-4 py-3 hover:bg-[#2e2e2e] transition-colors flex items-center gap-3 disabled:opacity-50"
                >
                  <svg className="w-5 h-5 text-[#5f5f5f]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  <div className="flex-1">
                    <div className="text-sm text-[#c0c0c0]">
                      {isCreatingLink ? 'Creating...' : 'Create public link'}
                    </div>
                  </div>
                </button>
              )}
              
              {/* Microcopy */}
              <div className="px-4 py-2 border-t border-[#2e2e2e]">
                <span className="text-xs text-[#5f5f5f]">
                  Public links are read-only. You can revoke anytime.
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// COPY SUMMARY TEXT BUTTON (simpler variant)
// ═══════════════════════════════════════════════════════════════

interface CopySummaryButtonProps {
  summary: string;
  className?: string;
}

export function CopySummaryButton({ summary, className = '' }: CopySummaryButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`text-sm text-[#5f5f5f] hover:text-[#8f8f8f] transition-colors ${className}`}
    >
      {copied ? 'Copied!' : 'Copy summary'}
    </button>
  );
}
