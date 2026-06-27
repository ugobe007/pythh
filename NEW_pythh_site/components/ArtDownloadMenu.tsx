import { useState } from 'react';
import { useLocation } from 'wouter';
import { Download, Loader2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { G, G_BORDER, BORDER, CARD, MUTED, DIM } from '@/lib/designTokens';

type ArtFormat = 'pdf' | 'png' | 'jpg' | 'svg';

const FORMATS: { id: ArtFormat; label: string }[] = [
  { id: 'pdf', label: 'PDF (print-ready)' },
  { id: 'png', label: 'PNG (full resolution)' },
  { id: 'jpg', label: 'JPEG' },
  { id: 'svg', label: 'SVG (vector)' },
];

function triggerBlobDownload(base64: string, filename: string, mimeType: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: mimeType });
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(blobUrl);
}

interface ArtDownloadMenuProps {
  editionDate: string;
  disabled?: boolean;
}

export default function ArtDownloadMenu({ editionDate, disabled }: ArtDownloadMenuProps) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const download = trpc.art.downloadEdition.useMutation();
  const [open, setOpen] = useState(false);
  const [activeFormat, setActiveFormat] = useState<ArtFormat | null>(null);

  const loginPath = `/login?redirect=${encodeURIComponent(`/art?date=${editionDate}`)}`;

  const handleDownload = async (format: ArtFormat) => {
    if (!isAuthenticated) {
      setLocation(loginPath);
      return;
    }
    setActiveFormat(format);
    try {
      const result = await download.mutateAsync({ editionDate, format });
      triggerBlobDownload(result.base64, result.filename, result.mimeType);
      toast.success(`Downloaded ${result.filename}`);
      setOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Download failed';
      toast.error(msg);
    } finally {
      setActiveFormat(null);
    }
  };

  const busy = download.isPending;

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled || authLoading}
        onClick={() => {
          if (!isAuthenticated) {
            setLocation(loginPath);
            return;
          }
          setOpen((v) => !v);
        }}
        className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        style={{
          border: `1px solid ${G_BORDER}`,
          backgroundColor: CARD,
          color: isAuthenticated ? G : MUTED,
        }}
      >
        {busy ? (
          <Loader2 size={14} className="animate-spin" />
        ) : isAuthenticated ? (
          <Download size={14} />
        ) : (
          <Lock size={14} />
        )}
        {isAuthenticated ? 'Download artwork' : 'Sign up to download'}
      </button>

      {open && isAuthenticated && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Close download menu"
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute right-0 top-full mt-2 z-50 min-w-[200px] rounded-xl py-1 shadow-xl"
            style={{ border: `1px solid ${BORDER}`, backgroundColor: CARD }}
          >
            {FORMATS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                disabled={busy}
                onClick={() => void handleDownload(id)}
                className="w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-white/5 disabled:opacity-50"
                style={{ color: activeFormat === id ? G : MUTED }}
              >
                {activeFormat === id && busy ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 size={12} className="animate-spin" />
                    Preparing…
                  </span>
                ) : (
                  label
                )}
              </button>
            ))}
            <p className="px-4 py-2 text-[10px] font-mono uppercase tracking-wider" style={{ color: DIM }}>
              Free with account
            </p>
          </div>
        </>
      )}
    </div>
  );
}
