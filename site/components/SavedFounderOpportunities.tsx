import { useEffect, useState } from 'react';
import { ArrowUpRight, Bookmark, Building2, CalendarDays } from 'lucide-react';
import {
  readSavedFounderOpportunities,
  SAVED_OPPORTUNITIES_EVENT,
  type SavedFounderOpportunity,
} from '@/lib/savedFounderOpportunities';

export default function SavedFounderOpportunities() {
  const [items, setItems] = useState<SavedFounderOpportunity[]>([]);

  useEffect(() => {
    const refresh = () => setItems(readSavedFounderOpportunities());
    refresh();
    window.addEventListener(SAVED_OPPORTUNITIES_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(SAVED_OPPORTUNITIES_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  if (!items.length) return null;

  return (
    <section className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <Bookmark className="mt-0.5 h-5 w-5 fill-emerald-400 text-emerald-400" />
        <div>
          <p className="text-[10px] uppercase tracking-[1.5px] text-emerald-400">Saved opportunities</p>
          <h2 className="mt-1 text-lg font-semibold text-white">Your pitch and angel shortlist</h2>
          <p className="mt-1 text-xs text-zinc-400">Return here anytime—no new match run required.</p>
        </div>
      </div>
      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {items.map((item) => (
          <article key={item.key} className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
            <div className="flex gap-3">
              {item.type === 'pitch_event'
                ? <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                : <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />}
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-zinc-500">
                  {item.type === 'pitch_event' ? item.organizer || 'Pitch event' : 'Angel group'}
                </p>
                <h3 className="mt-1 text-sm font-semibold text-white">{item.name}</h3>
                <p className="mt-1 text-xs text-zinc-400">{item.why}</p>
                {(item.location || item.schedule) && (
                  <p className="mt-2 text-[11px] text-zinc-500">
                    {[item.location, item.schedule].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
            </div>
            <a
              href={item.applicationUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300"
            >
              Open application <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}
