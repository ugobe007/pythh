import { useState } from 'react';
import { curatedMarketMovements } from '@marketMovement';
import {
  buildAdvisorMatches,
  buildDeckAssessment,
  buildPositioning,
  type ToolMatch,
} from '@/lib/founderFreeTools';
import { BORDER, CARD, DIM, G, MUTED, TEXT } from '@/lib/designTokens';

type Props = {
  startupId?: string | null;
  startupName: string;
  tagline?: string | null;
  description?: string | null;
  sectors?: string[] | null;
  stage?: string | null;
  scoreComponents?: {
    team?: number | null;
    traction?: number | null;
    market?: number | null;
    product?: number | null;
    vision?: number | null;
  } | null;
  matches?: ToolMatch[] | null;
};

const TOOLS = [
  {
    id: 'deck',
    title: 'Deck assessment',
    promise: 'Five recommendations from the public story and your scores.',
  },
  {
    id: 'positioning',
    title: 'Positioning',
    promise: 'Your one-line story, plus sourced examples of how other startups led.',
  },
  {
    id: 'advisors',
    title: 'Advisors',
    promise: 'Angels and operators already on your shortlist. No invented people.',
  },
] as const;

type ToolId = (typeof TOOLS)[number]['id'];

function storageKey(startupId?: string | null): string | null {
  return startupId ? `pythh_collected_tools:${startupId}` : null;
}

function readCollected(startupId?: string | null): ToolId[] {
  const key = storageKey(startupId);
  if (!key || typeof localStorage === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is ToolId => id === 'deck' || id === 'positioning' || id === 'advisors');
  } catch {
    return [];
  }
}

export default function FounderFreeTools(props: Props) {
  const [collected, setCollected] = useState<ToolId[]>(() => readCollected(props.startupId));
  const [open, setOpen] = useState<ToolId | null>(null);
  const deck = buildDeckAssessment(props);
  const positioning = buildPositioning(props, curatedMarketMovements());
  const advisors = buildAdvisorMatches(props.matches);

  const collect = (id: ToolId) => {
    setCollected((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      const key = storageKey(props.startupId);
      if (key) localStorage.setItem(key, JSON.stringify(next));
      return next;
    });
    setOpen(id);
  };

  return (
    <section aria-labelledby="free-tools-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.18em] uppercase mb-1" style={{ color: G }}>
            Free tools
          </p>
          <h3 id="free-tools-heading" className="text-lg font-bold" style={{ color: TEXT }}>
            Collect these and come back
          </h3>
        </div>
        <p className="text-xs" style={{ color: DIM }}>
          {collected.length} of {TOOLS.length} on this account
        </p>
      </div>
      <p className="text-sm mb-4 max-w-[68ch]" style={{ color: MUTED }}>
        Deck, positioning, and advisors stay free. They use the public site, your scores, and this shortlist. Sending notes is still the paid step.
      </p>
      <div className="grid gap-3">
        {TOOLS.map((tool) => {
          const isCollected = collected.includes(tool.id);
          const isOpen = open === tool.id;
          return (
            <article key={tool.id} className="rounded-xl border" style={{ borderColor: BORDER, backgroundColor: CARD }}>
              <div className="px-4 py-3 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold" style={{ color: TEXT }}>{tool.title}</p>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: MUTED }}>{tool.promise}</p>
                </div>
                {isCollected ? (
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : tool.id)}
                    className="text-xs font-semibold shrink-0"
                    style={{ color: G }}
                  >
                    {isOpen ? 'Hide' : 'Open'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => collect(tool.id)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg shrink-0"
                    style={{ backgroundColor: G, color: 'oklch(0.13 0.01 264)' }}
                  >
                    Collect
                  </button>
                )}
              </div>
              {isCollected && isOpen && (
                <div className="px-4 pb-4 border-t" style={{ borderColor: BORDER }}>
                  {tool.id === 'deck' && (
                    <ol className="mt-3 space-y-3">
                      {deck.map((item, index) => (
                        <li key={item.title}>
                          <p className="text-sm font-semibold" style={{ color: TEXT }}>{index + 1}. {item.title}</p>
                          <p className="text-xs mt-1 leading-relaxed" style={{ color: MUTED }}>{item.body}</p>
                        </li>
                      ))}
                    </ol>
                  )}
                  {tool.id === 'positioning' && (
                    <div className="mt-3 space-y-3">
                      <p className="text-sm leading-relaxed" style={{ color: TEXT }}>{positioning.thesis}</p>
                      {positioning.examples.map((example) => (
                        <div key={example.name}>
                          <p className="text-sm font-semibold" style={{ color: TEXT }}>{example.name}</p>
                          <p className="text-xs mt-1 leading-relaxed" style={{ color: MUTED }}>{example.why}</p>
                          {example.caveat && (
                            <p className="text-[11px] mt-1" style={{ color: DIM }}>{example.caveat}</p>
                          )}
                          <a href={example.sourceUrl} target="_blank" rel="noreferrer" className="text-[11px] underline" style={{ color: G }}>
                            {example.sourceName}
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                  {tool.id === 'advisors' && (
                    <div className="mt-3 space-y-3">
                      <p className="text-xs leading-relaxed" style={{ color: MUTED }}>{advisors.note}</p>
                      {advisors.advisors.map((advisor) => (
                        <div key={`${advisor.name}-${advisor.firm || ''}`}>
                          <p className="text-sm font-semibold" style={{ color: TEXT }}>
                            {advisor.name}
                            {advisor.firm ? <span style={{ color: DIM }}> · {advisor.firm}</span> : null}
                            {advisor.score != null ? <span className="font-mono text-xs ml-2" style={{ color: G }}>{advisor.score}</span> : null}
                          </p>
                          <p className="text-xs mt-1 leading-relaxed" style={{ color: MUTED }}>{advisor.why}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
