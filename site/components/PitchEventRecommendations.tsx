import { useEffect, useState } from 'react';
import { ArrowUpRight, Bookmark, CalendarDays, MapPin, Ticket } from 'lucide-react';
import { apiUrl } from '@/lib/apiConfig';
import { trackFunnelEvent } from '@/lib/matchEngagement';
import { isFounderOpportunitySaved, toggleSavedFounderOpportunity } from '@/lib/savedFounderOpportunities';

type PitchEvent = {
  slug: string;
  organizer: string;
  name: string;
  description: string;
  location: string;
  format: string;
  schedule_label: string;
  application_fee_label: string;
  application_url: string;
  source_url: string;
  why_this_event: string;
  last_verified_at: string;
};

export default function PitchEventRecommendations({
  startupId,
  startupName,
  sectors,
  stage,
}: {
  startupId?: string;
  startupName: string;
  sectors?: string[] | null;
  stage?: string | null;
}) {
  const [events, setEvents] = useState<PitchEvent[]>([]);
  const [savedSlugs, setSavedSlugs] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const params = new URLSearchParams({
      sectors: (sectors || []).join(','),
      stage: stage || '',
      limit: '3',
    });
    fetch(apiUrl(`/api/pitch-events/recommendations?${params}`))
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((payload) => setEvents(Array.isArray(payload?.recommendations) ? payload.recommendations : []))
      .catch(() => setEvents([]));
  }, [sectors, stage]);

  useEffect(() => {
    setSavedSlugs(new Set(events.filter((event) => isFounderOpportunitySaved('pitch_event', event.slug)).map((event) => event.slug)));
  }, [events]);

  if (!events.length) return null;

  return (
    <section className="mb-8 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-5">
      <div className="mb-5">
        <p className="text-[10px] uppercase tracking-[1.5px] text-emerald-400">Pitch opportunities</p>
        <h2 className="mt-1 text-lg font-semibold text-white">Events matched to {startupName}</h2>
        <p className="mt-1 text-xs text-zinc-400">
          Apply to pitch in front of investors. Schedules and fees are linked to the organizer for confirmation.
        </p>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {events.map((event) => (
          <article key={event.slug} className="flex flex-col rounded-xl border border-zinc-800 bg-zinc-950/65 p-4">
            <p className="text-[10px] uppercase tracking-wide text-emerald-400">{event.organizer}</p>
            <h3 className="mt-1 text-sm font-semibold text-white">{event.name}</h3>
            <p className="mt-2 text-xs leading-relaxed text-zinc-400">{event.why_this_event}</p>
            <div className="mt-4 space-y-2 text-[11px] text-zinc-400">
              <p className="flex gap-2"><CalendarDays className="h-3.5 w-3.5 shrink-0 text-emerald-400" />{event.schedule_label}</p>
              <p className="flex gap-2"><MapPin className="h-3.5 w-3.5 shrink-0 text-emerald-400" />{event.location} · {event.format}</p>
              <p className="flex gap-2"><Ticket className="h-3.5 w-3.5 shrink-0 text-emerald-400" />{event.application_fee_label}</p>
            </div>
            <div className="mt-5 grid grid-cols-[auto_1fr] gap-2">
              <button
                type="button"
                aria-label={savedSlugs.has(event.slug) ? `Remove ${event.name} from saved opportunities` : `Save ${event.name}`}
                onClick={() => {
                  const result = toggleSavedFounderOpportunity({
                    type: 'pitch_event',
                    slug: event.slug,
                    name: event.name,
                    organizer: event.organizer,
                    location: `${event.location} · ${event.format}`,
                    schedule: event.schedule_label,
                    applicationUrl: event.application_url,
                    why: event.why_this_event,
                    startupId,
                  });
                  setSavedSlugs((current) => {
                    const next = new Set(current);
                    result.saved ? next.add(event.slug) : next.delete(event.slug);
                    return next;
                  });
                  void trackFunnelEvent('pitch_event_saved', { startup_id: startupId, event_slug: event.slug, saved: result.saved });
                }}
                className={`inline-flex items-center justify-center rounded-lg border px-3 ${
                  savedSlugs.has(event.slug)
                    ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                    : 'border-zinc-700 text-zinc-400 hover:border-emerald-500/50 hover:text-emerald-300'
                }`}
              >
                <Bookmark className={`h-4 w-4 ${savedSlugs.has(event.slug) ? 'fill-current' : ''}`} />
              </button>
              <a
                href={event.application_url}
                target="_blank"
                rel="noreferrer"
                onClick={() => void trackFunnelEvent('pitch_event_apply_clicked', {
                  startup_id: startupId,
                  event_slug: event.slug,
                  organizer: event.organizer,
                })}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-500"
              >
                View & apply <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </article>
        ))}
      </div>
      <p className="mt-4 text-[10px] text-zinc-600">
        Opportunities are recommendations, not endorsements. Confirm eligibility, deadlines, and fees with each organizer.
      </p>
    </section>
  );
}
