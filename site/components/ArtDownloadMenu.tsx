import { useState } from 'react';
import { Download, Loader2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/_core/hooks/useAuth';
import { apiUrl } from '@/lib/apiConfig';
import { G, G_BORDER, BORDER, CARD, MUTED, DIM } from '@/lib/designTokens';

type ArtFormat = 'pdf' | 'png' | 'jpg' | 'svg';

const FORMATS: { id: ArtFormat; label: string }[] = [
  { id: 'pdf', label: 'PDF' },
  { id: 'png', label: 'PNG' },
  { id: 'jpg', label: 'JPEG' },
  { id: 'svg', label: 'SVG' },
];

function triggerBlobDownload(blob: Blob, filename: string) {
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 500);
}

function parseFilename(disposition: string | null, fallback: string): string {
  if (!disposition) return fallback;
  const m = disposition.match(/filename="([^"]+)"/i);
  return m?.[1] || fallback;
}

interface ArtDownloadMenuProps {
  editionDate: string;
  disabled?: boolean;
}

export default function ArtDownloadMenu({ editionDate, disabled }: ArtDownloadMenuProps) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [activeFormat, setActiveFormat] = useState<ArtFormat | null>(null);

  const loginPath = `/login?redirect=${encodeURIComponent(`/art?date=${editionDate}`)}`;

  const goLogin = () => {
    window.location.assign(loginPath);
  };

  const handleDownload = async (format: ArtFormat) => {
    if (!isAuthenticated) {
      goLogin();
      return;
    }

    setActiveFormat(format);
    try {
      const url = apiUrl(`/api/art/${editionDate}/download?format=${format}`);
      const res = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: '*/*' },
      });

      if (res.status === 401) {
        toast.error('Sign in required to download.');
        goLogin();
        return;
      }

      if (!res.ok) {
        let msg = `Download failed (${res.status})`;
        try {
          const err = (await res.json()) as { error?: string };
          if (err.error) msg = err.error;
        } catch {
          /* not json */
        }
        toast.error(msg);
        return;
      }

      const blob = await res.blob();
      const filename = parseFilename(
        res.headers.get('Content-Disposition'),
        `pythh-signal-art-${editionDate}.${format === 'jpg' ? 'jpg' : format}`,
      );
      triggerBlobDownload(blob, filename);
      toast.success(`Downloaded ${filename}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Download failed';
      toast.error(msg);
    } finally {
      setActiveFormat(null);
    }
  };

  if (!isAuthenticated && !authLoading) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={goLogin}
        className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        style={{
          border: `1px solid ${G_BORDER}`,
          backgroundColor: CARD,
          color: MUTED,
        }}
      >
        <Lock size={14} />
        Sign up to download
      </button>
    );
  }

  return (
    <div
      className="flex flex-col items-center gap-3 w-full max-w-md"
      role="group"
      aria-label="Download artwork formats"
    >
      <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider" style={{ color: DIM }}>
        <Download size={12} />
        Download artwork
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {FORMATS.map(({ id, label }) => {
          const busy = activeFormat === id;
          return (
            <button
              key={id}
              type="button"
              disabled={disabled || authLoading || activeFormat !== null}
              onClick={() => void handleDownload(id)}
              className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
              style={{
                border: `1px solid ${busy ? G_BORDER : BORDER}`,
                backgroundColor: busy ? 'rgba(16,185,129,0.12)' : CARD,
                color: busy ? G : MUTED,
              }}
            >
              {busy ? <Loader2 size={13} className="animate-spin" /> : null}
              {busy ? 'Preparing…' : label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
