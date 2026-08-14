import { ExternalLink, Play } from 'lucide-react';
import type { VideoEvidenceSnippet, VideoEntityType } from '@/services/videoEvidenceService';
import { useVideoEvidenceMap } from '@/services/videoEvidenceService';

function label(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function timestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  return `${mins}:${String(seconds % 60).padStart(2, '0')}`;
}

export function VideoEvidenceLink({ snippets }: { snippets?: VideoEvidenceSnippet[] }) {
  const first = snippets?.[0];
  if (!first) return null;
  return (
    <a
      href={first.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => event.stopPropagation()}
      className="inline-flex items-center gap-1 text-[11px] font-medium text-cyan-400 hover:text-cyan-300 hover:underline"
      title={`Watch ${label(first.evidenceType).toLowerCase()} at ${timestamp(first.startSeconds)}`}
    >
      <Play className="h-3 w-3" fill="currentColor" />
      Watch evidence
    </a>
  );
}

export function ProfileVideoEvidence({
  entityType,
  entityId,
  title = 'Video evidence',
}: {
  entityType: VideoEntityType;
  entityId: string;
  title?: string;
}) {
  const evidence = useVideoEvidenceMap(entityType, entityId ? [entityId] : []);
  const snippets = evidence[entityId] || [];
  if (!snippets.length) return null;
  const featured = snippets[0];

  return (
    <section className="mb-10 rounded-xl border border-cyan-500/25 bg-zinc-900/35 p-4 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[15px] font-medium text-zinc-200">{title}</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Verified moments from public source videos. Open any clip at the cited timestamp.
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-cyan-500/25 px-2 py-1 text-[10px] uppercase tracking-wider text-cyan-400">
          {snippets.length} {snippets.length === 1 ? 'clip' : 'clips'}
        </span>
      </div>

      {featured.embedUrl && (
        <div className="mb-4 aspect-video overflow-hidden rounded-lg border border-zinc-700 bg-black">
          <iframe
            className="h-full w-full"
            src={featured.embedUrl}
            title={featured.title}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      <div className="space-y-2">
        {snippets.map((snippet) => (
          <a
            key={snippet.id}
            href={snippet.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-start gap-3 rounded-lg border border-zinc-800 bg-black/20 p-3 hover:border-cyan-500/35"
          >
            <span className="mt-0.5 rounded bg-cyan-500/10 px-2 py-1 text-[10px] font-mono text-cyan-400">
              {timestamp(snippet.startSeconds)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-medium text-zinc-200">{label(snippet.evidenceType)}</span>
              <span className="mt-0.5 block line-clamp-2 text-xs leading-relaxed text-zinc-500">{snippet.excerpt}</span>
            </span>
            <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-zinc-600 group-hover:text-cyan-400" />
          </a>
        ))}
      </div>
    </section>
  );
}

