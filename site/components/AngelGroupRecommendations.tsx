import { useEffect, useState } from 'react';
import { ArrowUpRight, Building2, CalendarClock, MapPin, RefreshCw } from 'lucide-react';
import { apiUrl } from '@/lib/apiConfig';
import { trackFunnelEvent } from '@/lib/matchEngagement';

type AngelGroup = {
  slug: string;
  name: string;
  city: string;
  state: string;
  region: string;
  meeting_frequency?: string;
  application_url: string;
  source_url: string;
  why_this_group: string;
  geographic_preference?: string;
  founder_preparation: string[];
};

export default function AngelGroupRecommendations({
  startupId,
  startupName,
  sectors,
  stage,
  state,
}: {
  startupId?: string;
  startupName: string;
  sectors?: string[] | null;
  stage?: string | null;
  state?: string | null;
}) {
  const [groups, setGroups] = useState<AngelGroup[]>([]);
  const [rotation, setRotation] = useState(() => {
    if (typeof window === 'undefined') return 0;
    try {
      const storageKey = `pythh:angel-rotation:${startupId || startupName}`;
      const previousRotation = Number.parseInt(sessionStorage.getItem(storageKey) || '-1', 10);
      const nextRotation = Number.isFinite(previousRotation) ? previousRotation + 1 : 0;
      sessionStorage.setItem(storageKey, String(nextRotation));
      return nextRotation;
    } catch {
      return 0;
    }
  });
  const [isRotating, setIsRotating] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams({
      sectors: (sectors || []).join(','),
      stage: stage || '',
      state: state || '',
      limit: '3',
      rotation: String(rotation),
      seed: startupId || startupName,
    });
    setIsRotating(true);
    fetch(apiUrl(`/api/angel-intelligence/recommendations?${params}`))
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((payload) => setGroups(Array.isArray(payload?.recommendations) ? payload.recommendations : []))
      .catch(() => setGroups([]))
      .finally(() => setIsRotating(false));
  }, [rotation, sectors, stage, state, startupId, startupName]);

  if (!groups.length) return null;

  return (
    <section className="mb-8 rounded-xl border border-cyan-500/25 bg-cyan-500/5 p-5">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[1.5px] text-cyan-400">Angel intelligence</p>
          <h2 className="mt-1 text-lg font-semibold text-white">Organized angel capital for {startupName}</h2>
          <p className="mt-1 text-xs text-zinc-400">
            Source-backed groups with structured founder application or screening processes.
          </p>
        </div>
        <button
          type="button"
          disabled={isRotating}
          onClick={() => {
            setRotation((current) => {
              const next = current + 1;
              try {
                sessionStorage.setItem(`pythh:angel-rotation:${startupId || startupName}`, String(next));
              } catch {
                // Rotation still works when browser storage is unavailable.
              }
              return next;
            });
            void trackFunnelEvent('angel_groups_rotated', { startup_id: startupId });
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-wait disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRotating ? 'animate-spin' : ''}`} />
          Show different groups
        </button>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {groups.map((group) => (
          <article key={group.slug} className="flex flex-col rounded-xl border border-zinc-800 bg-zinc-950/65 p-4">
            <div className="flex items-start gap-2">
              <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
              <div>
                <h3 className="text-sm font-semibold text-white">{group.name}</h3>
                <p className="mt-1 text-xs leading-relaxed text-zinc-400">{group.why_this_group}</p>
              </div>
            </div>
            <div className="mt-4 space-y-2 text-[11px] text-zinc-400">
              <p className="flex gap-2"><MapPin className="h-3.5 w-3.5 shrink-0 text-cyan-400" />{group.city}</p>
              <p className="flex gap-2"><CalendarClock className="h-3.5 w-3.5 shrink-0 text-cyan-400" />{group.meeting_frequency || 'Schedule with organizer'}</p>
            </div>
            <div className="mt-4 border-t border-zinc-800 pt-3">
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">Before applying</p>
              <p className="mt-1 text-[11px] text-zinc-400">{group.founder_preparation[0]}</p>
            </div>
            <a
              href={group.application_url}
              target="_blank"
              rel="noreferrer"
              onClick={() => void trackFunnelEvent('angel_group_apply_clicked', {
                startup_id: startupId,
                angel_group_slug: group.slug,
              })}
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-500"
            >
              View application process <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </article>
        ))}
      </div>
      <p className="mt-4 text-[10px] text-zinc-600">
        Pythh only displays groups with a public source and application path. Confirm eligibility and current terms directly.
      </p>
    </section>
  );
}
