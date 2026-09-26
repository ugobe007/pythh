/**
 * Pitch deck and videos on the founder account profile.
 * Files upload directly to private storage; the API only records ownership.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, Film, Loader2, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { apiUrl } from '@/lib/apiConfig';
import { BORDER, CARD, DIM, G, MUTED, TEXT } from '@/lib/designTokens';

type MediaItem = {
  id: string;
  kind: 'deck' | 'video';
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  url: string | null;
};

type MediaList = {
  deck: MediaItem | null;
  videos: MediaItem[];
};

const DECK_ACCEPT = '.pdf,.ppt,.pptx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation';
const VIDEO_ACCEPT = 'video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov';

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function readError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (body && typeof body.error === 'string' && body.error) return body.error;
  } catch {
    /* ignore */
  }
  return 'Something went wrong. Try again.';
}

async function uploadFile(file: File): Promise<void> {
  const signRes = await fetch(apiUrl('/api/profile/media/sign'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    }),
  });
  if (!signRes.ok) throw new Error(await readError(signRes));
  const signed = await signRes.json() as { storagePath: string; signedUrl: string };
  if (!signed.signedUrl || !signed.storagePath) throw new Error('Could not start the upload.');

  const body = new FormData();
  body.append('cacheControl', '3600');
  body.append('', file, file.name);
  const putRes = await fetch(signed.signedUrl, {
    method: 'PUT',
    body,
    headers: { 'x-upsert': 'false' },
  });
  if (!putRes.ok) throw new Error('The file did not finish uploading. Try again.');

  const commitRes = await fetch(apiUrl('/api/profile/media/commit'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      storagePath: signed.storagePath,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    }),
  });
  if (!commitRes.ok) throw new Error(await readError(commitRes));
}

export default function ProfileMediaUploads() {
  const deckInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [media, setMedia] = useState<MediaList>({ deck: null, videos: [] });
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<'deck' | 'video' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestRef.current;
    try {
      const response = await fetch(apiUrl('/api/profile/media'), { credentials: 'include' });
      if (!response.ok) throw new Error(await readError(response));
      const data = await response.json() as MediaList;
      if (requestId !== requestRef.current) return;
      setMedia({
        deck: data.deck || null,
        videos: Array.isArray(data.videos) ? data.videos : [],
      });
      setLoaded(true);
      setError(null);
    } catch (err) {
      if (requestId !== requestRef.current) return;
      throw err;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    load()
      .catch((err: Error) => {
        if (!cancelled && requestRef.current > 0) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function onFiles(kind: 'deck' | 'video', list: FileList | null) {
    const files = Array.from(list || []);
    if (!files.length) return;
    setBusy(kind);
    setError(null);
    let failed = false;
    try {
      for (const file of files) {
        await uploadFile(file);
      }
      toast.success(kind === 'deck' ? 'Deck saved to your profile' : 'Video saved to your profile');
    } catch (err) {
      failed = true;
      const message = err instanceof Error ? err.message : 'Upload failed.';
      setError(message);
      toast.error(message);
    } finally {
      if (failed) await load().catch(() => {/* ignore */});
      else await load();
      setBusy(null);
      if (deckInputRef.current) deckInputRef.current.value = '';
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  }

  async function remove(item: MediaItem) {
    setError(null);
    try {
      const response = await fetch(apiUrl(`/api/profile/media/${item.id}`), {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error(await readError(response));
      await load();
      toast.success(item.kind === 'deck' ? 'Deck removed' : 'Video removed');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not remove that file.';
      setError(message);
      toast.error(message);
    }
  }

  return (
    <section className="rounded-xl border p-5" style={{ borderColor: BORDER, backgroundColor: CARD }}>
      <p className="text-[10px] uppercase tracking-[1.5px] mb-2" style={{ color: G }}>
        Account profile
      </p>
      <h2 className="font-display font-bold text-lg mb-1" style={{ color: TEXT }}>
        Deck and videos
      </h2>
      <p className="text-sm mb-5" style={{ color: MUTED }}>
        Add your pitch deck and any product or founder videos. They stay private on this account and save as soon as the upload finishes.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-sm" style={{ color: DIM }}>
          <Loader2 size={14} className="animate-spin" />
          Loading your files…
        </div>
      ) : (
        <div className="space-y-5">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FileText size={14} style={{ color: G }} />
              <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>
                Pitch deck
              </p>
            </div>
            {loaded && media.deck ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5" style={{ borderColor: BORDER }}>
                <div className="min-w-0">
                  {media.deck.url ? (
                    <a href={media.deck.url} target="_blank" rel="noreferrer" className="text-sm underline truncate block" style={{ color: TEXT }}>
                      {media.deck.fileName}
                    </a>
                  ) : (
                    <p className="text-sm truncate" style={{ color: TEXT }}>{media.deck.fileName}</p>
                  )}
                  <p className="text-[11px]" style={{ color: DIM }}>{formatBytes(media.deck.sizeBytes)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void remove(media.deck as MediaItem)}
                  className="inline-flex items-center gap-1 text-xs shrink-0"
                  style={{ color: DIM }}
                >
                  <Trash2 size={12} />
                  Remove
                </button>
              </div>
            ) : loaded ? (
              <p className="text-xs mb-2" style={{ color: DIM }}>
                No deck yet. PDF, PPT, or PPTX, up to 25 MB.
              </p>
            ) : null}
            <input
              ref={deckInputRef}
              type="file"
              accept={DECK_ACCEPT}
              className="hidden"
              onChange={(event) => void onFiles('deck', event.target.files)}
            />
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => deckInputRef.current?.click()}
              className="mt-2 inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-60"
              style={{ backgroundColor: G, color: 'oklch(0.13 0.01 264)' }}
            >
              {busy === 'deck' ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {media.deck ? 'Replace deck' : 'Upload deck'}
            </button>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <Film size={14} style={{ color: G }} />
              <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>
                Videos
              </p>
            </div>
            {loaded && media.videos.length ? (
              <ul className="space-y-3 mb-3">
                {media.videos.map((video) => (
                  <li key={video.id} className="rounded-lg border p-3" style={{ borderColor: BORDER }}>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0">
                        <p className="text-sm truncate" style={{ color: TEXT }}>{video.fileName}</p>
                        <p className="text-[11px]" style={{ color: DIM }}>{formatBytes(video.sizeBytes)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void remove(video)}
                        className="inline-flex items-center gap-1 text-xs shrink-0"
                        style={{ color: DIM }}
                      >
                        <Trash2 size={12} />
                        Remove
                      </button>
                    </div>
                    {video.url && (
                      <video
                        controls
                        playsInline
                        preload="metadata"
                        src={video.url}
                        className="w-full rounded-md max-h-64 bg-black"
                      />
                    )}
                  </li>
                ))}
              </ul>
            ) : loaded ? (
              <p className="text-xs mb-2" style={{ color: DIM }}>
                No videos yet. MP4, WEBM, or MOV, up to 100 MB each. Eight videos max.
              </p>
            ) : null}
            <input
              ref={videoInputRef}
              type="file"
              accept={VIDEO_ACCEPT}
              multiple
              className="hidden"
              onChange={(event) => void onFiles('video', event.target.files)}
            />
            <button
              type="button"
              disabled={busy !== null || media.videos.length >= 8}
              onClick={() => videoInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold border disabled:opacity-60"
              style={{ borderColor: BORDER, color: TEXT, backgroundColor: 'transparent' }}
            >
              {busy === 'video' ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              Upload video
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs mt-3" style={{ color: 'oklch(0.75 0.15 27)' }}>{error}</p>
      )}
    </section>
  );
}
