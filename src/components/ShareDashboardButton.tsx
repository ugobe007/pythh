/**
 * SHARE DASHBOARD BUTTON
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * Inline share control for founder / investor dashboards.
 * Creates a share link via POST /api/share-links, copies URL to clipboard.
 * Manages existing links (copy, revoke).
 * 
 * Supabase design language: minimal, text-based, no buttons.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:3002' : '');

const APP_URL = typeof window !== 'undefined' ? window.location.origin : '';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ShareDashboardButtonProps {
  /** 'founder_dashboard' or 'investor_pipeline' */
  shareType: 'founder_dashboard' | 'investor_pipeline';
  /** Payload to freeze into the share link */
  payload: Record<string, any>;
  /** Optional startup ID (for founder shares) */
  startupId?: string;
  /** Auth token for API calls */
  authToken?: string;
}

interface ExistingLink {
  id: string;
  token: string;
  created_at: string;
  expires_at: string | null;
  view_count: number;
}

// ═════════════════════════════════════════════════════════════════════════════

export default function ShareDashboardButton({ shareType, payload, startupId, authToken }: ShareDashboardButtonProps) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [existing, setExisting] = useState<ExistingLink | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  // ─── Check for existing link ────────────────────────────
  const loadExisting = useCallback(async () => {
    setLoadingExisting(true);
    try {
      const res = await fetch(`${API_BASE}/api/share-links/my/list`, { headers });
      if (res.ok) {
        const links = await res.json();
        // Find most recent non-revoked link of this type
        const match = links.find(
          (l: any) => l.share_type === shareType && !l.revoked_at &&
            (!l.expires_at || new Date(l.expires_at) > new Date())
        );
        if (match) setExisting(match);
      }
    } catch {
      // silent
    } finally {
      setLoadingExisting(false);
    }
  }, [shareType, authToken]);

  useEffect(() => {
    if (open && !existing) loadExisting();
  }, [open]);

  // ─── Create share link ─────────────────────────────────
  const createLink = async () => {
    setCreating(true);
    setError(null);
    try {
      const body: Record<string, any> = {
        share_type: shareType,
        payload,
        visibility: 'public',
      };
      if (startupId) body.startup_id = startupId;

      const res = await fetch(`${API_BASE}/api/share-links`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to create link');
      }
      const data = await res.json();
      const link: ExistingLink = {
        id: data.id,
        token: data.token,
        created_at: data.created_at || new Date().toISOString(),
        expires_at: data.expires_at,
        view_count: 0,
      };
      setExisting(link);
      await copyToClipboard(link.token);
    } catch (err: any) {
      setError(err.message || 'Failed');
    } finally {
      setCreating(false);
    }
  };

  // ─── Copy URL ──────────────────────────────────────────
  const copyToClipboard = async (token: string) => {
    const url = `${APP_URL}/s/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  // ─── Revoke link ───────────────────────────────────────
  const revokeLink = async () => {
    if (!existing) return;
    setRevoking(true);
    try {
      await fetch(`${API_BASE}/api/share-links/${existing.token}/revoke`, {
        method: 'POST',
        headers,
      });
      setExisting(null);
    } catch {
      // silent
    } finally {
      setRevoking(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────
  const label = shareType === 'founder_dashboard' ? 'Share dashboard' : 'Share pipeline';

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1.5"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m9.86-4.122a4.5 4.5 0 0 0-1.242-7.244l-4.5-4.5a4.5 4.5 0 0 0-6.364 6.364L4.34 8.374" transform="translate(1.5, 1.5) scale(0.875)" />
        </svg>
        {label}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Popover */}
          <div className="absolute top-full left-0 mt-2 z-50 w-72 bg-zinc-900 border border-zinc-800/50 rounded-lg shadow-2xl shadow-black/50">
            <div className="p-4 space-y-3">
              <p className="text-xs text-zinc-400 leading-relaxed">
                {shareType === 'founder_dashboard'
                  ? 'Share a read-only snapshot of your signals, GOD score, and matched investors.'
                  : 'Share your deal flow pipeline with partners and co-investors.'}
              </p>

              {loadingExisting ? (
                <p className="text-xs text-zinc-600">Loading…</p>
              ) : existing ? (
                // Existing link
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={`${APP_URL}/s/${existing.token}`}
                      className="flex-1 text-[11px] bg-zinc-800/50 text-zinc-300 px-2 py-1.5 rounded border border-zinc-700/50 font-mono truncate"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                    <button
                      onClick={() => copyToClipboard(existing.token)}
                      className={`text-xs px-2 py-1 rounded transition-colors ${
                        copied ? 'text-emerald-400 bg-emerald-400/10' : 'text-zinc-400 hover:text-zinc-200 bg-zinc-800/50 hover:bg-zinc-700/50'
                      }`}
                    >
                      {copied ? '✓' : 'Copy'}
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-600">
                      {existing.view_count} view{existing.view_count !== 1 ? 's' : ''}
                      {existing.expires_at && <> · Expires {new Date(existing.expires_at).toLocaleDateString()}</>}
                    </span>
                    <button
                      onClick={revokeLink}
                      disabled={revoking}
                      className="text-red-400/60 hover:text-red-400 transition-colors"
                    >
                      {revoking ? 'Revoking…' : 'Revoke'}
                    </button>
                  </div>
                </div>
              ) : (
                // Create new
                <div className="space-y-2">
                  <button
                    onClick={createLink}
                    disabled={creating}
                    className="w-full text-xs text-center py-2 rounded border border-zinc-700/50 bg-zinc-800/30 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/70 transition-colors disabled:opacity-50"
                  >
                    {creating ? 'Creating…' : 'Create shareable link'}
                  </button>
                  {error && <p className="text-xs text-red-400">{error}</p>}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
