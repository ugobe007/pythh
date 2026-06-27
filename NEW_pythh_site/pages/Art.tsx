/**
 * /art — Pythh Signal Art
 * Digital abstract compositions: layered signal motifs, seed-randomized layout, Gemini raster.
 */

import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import SharedNavbar from '@/components/SharedNavbar';
import SectionLabel from '@/components/design/SectionLabel';
import StartupCTA from '@/components/design/StartupCTA';
import { apiUrl } from '@/lib/apiConfig';
import { trackFunnelEventOnce } from '@/lib/matchEngagement';
import { trackReturnVisitIfEligible } from '@/lib/funnelAttribution';
import {
  G,
  GOLD,
  G_BORDER,
  G_SUBTLE,
  PAGE,
  BORDER,
  CARD,
  MUTED,
  DIM,
  TEXT,
} from '@/lib/designTokens';

interface LegendItem {
  key: string;
  label: string;
  value: string;
}

interface ArtCopy {
  title: string;
  subtitle: string;
  process: string;
  philosophy: string;
  introspection: string;
  legend: LegendItem[];
  featured_startup?: string | null;
  featured_match?: string | null;
  copy_source?: string;
  raster_provider?: string | null;
  art_direction?: string;
  layout_mode?: string;
  signal_layers?: number;
}

interface ArtEdition {
  edition_date: string;
  seed: number;
  svg: string;
  copy: ArtCopy;
  raster_url?: string | null;
  raster_provider?: string | null;
  art_direction?: string;
  layout_mode?: string;
  signal_layers?: number;
  generated_at: string;
}

interface ArchiveItem {
  edition_date: string;
  copy?: { title?: string; subtitle?: string };
  generated_at: string;
}

function useArtDate(): string | null {
  const [location] = useLocation();
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const d = params.get('date');
  return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

export default function Art() {
  const dateParam = useArtDate();
  const [edition, setEdition] = useState<ArtEdition | null>(null);
  const [archive, setArchive] = useState<ArchiveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rasterFailed, setRasterFailed] = useState(false);

  useEffect(() => {
    void trackFunnelEventOnce('pythh_art_page_view', 'page_view', {
      path: '/art',
      source: 'signal_art',
    });
    trackReturnVisitIfEligible('/art');
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);

    (async () => {
      setLoading(true);
      setError(null);
      setRasterFailed(false);
      try {
        const endpoint = dateParam ? apiUrl(`/api/art/${dateParam}`) : apiUrl('/api/art/today');
        const res = await fetch(endpoint, {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as ArtEdition;
        if (!cancelled) setEdition(data);

        const archRes = await fetch(apiUrl('/api/art/archive?limit=14'), {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        if (archRes.ok && !cancelled) {
          const arch = (await archRes.json()) as { editions: ArchiveItem[] };
          setArchive(arch.editions || []);
        }
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : 'Failed to load composition';
          setError(msg.includes('abort') ? 'Request timed out — try refreshing' : msg);
        }
      } finally {
        clearTimeout(timeout);
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [dateParam]);

  const copy = edition?.copy;
  const rasterSrc =
    edition?.raster_url
      ? `${edition.raster_url}${edition.raster_url.includes('?') ? '&' : '?'}v=${encodeURIComponent(edition.generated_at || String(edition.seed))}`
      : null;
  const showRaster = Boolean(rasterSrc) && !rasterFailed;
  const showSvg = Boolean(edition?.svg) && (!showRaster || rasterFailed);

  return (
    <div className="min-h-screen" style={{ backgroundColor: PAGE, color: TEXT }}>
      <Helmet>
        <title>
          {copy?.title ? `${copy.title} — Pythh Signal Art` : 'Pythh Signal Art — daily abstract composition'}
        </title>
        <meta
          name="description"
          content="Signal Art: PYTHH the oracle sees between today and tomorrow — flowing sci-fi signals in motion, one edition per day from live market data."
        />
      </Helmet>

      <SharedNavbar activePath="/art" />

      <main className="container pt-24 pb-20 max-w-5xl mx-auto px-4">
        <SectionLabel color={G} className="flex items-center gap-1.5">
          <Sparkles size={12} />
          Signal Art
        </SectionLabel>
        <h1 className="font-display text-3xl md:text-4xl font-bold text-white mt-2 mb-2">
          {loading ? 'Composing…' : copy?.title || 'Signal Composition'}
        </h1>
        <p className="text-base mb-8 max-w-2xl" style={{ color: MUTED }}>
          {copy?.subtitle ||
            'PYTHH sees between today and tomorrow — flowing sci-fi signals in motion, composed from live market data.'}
          {(copy?.layout_mode || edition?.layout_mode) && (
            <span className="ml-2 text-[10px] font-mono uppercase tracking-widest" style={{ color: DIM }}>
              · {copy?.layout_mode || edition?.layout_mode} layout
            </span>
          )}
          {(copy?.signal_layers || edition?.signal_layers) != null && (
            <span className="ml-2 text-[10px] font-mono uppercase tracking-widest" style={{ color: DIM }}>
              · {copy?.signal_layers ?? edition?.signal_layers} layers
            </span>
          )}
          {copy?.copy_source === 'pythia' && (
            <span className="ml-2 text-[10px] font-mono uppercase tracking-widest" style={{ color: G }}>
              · PYTHIA artist statement
            </span>
          )}
          {edition?.raster_provider && (
            <span className="ml-2 text-[10px] font-mono uppercase tracking-widest" style={{ color: GOLD }}>
              · Google AI Studio
            </span>
          )}
        </p>

        {error && (
          <div
            className="rounded-xl p-4 mb-8 text-sm"
            style={{ border: `1px solid ${BORDER}`, backgroundColor: CARD, color: MUTED }}
          >
            Could not load today&apos;s composition ({error}). The daily batch may not have run yet.
          </div>
        )}

        <div
          className="rounded-2xl overflow-hidden mb-10 aspect-square max-w-2xl mx-auto w-full min-h-[280px]"
          style={{
            border: `1px solid ${BORDER}`,
            backgroundColor: '#050508',
            boxShadow: `0 0 80px ${G_SUBTLE}`,
          }}
        >
          {loading ? (
            <div className="w-full h-full min-h-[280px] flex items-center justify-center" style={{ color: DIM }}>
              Rendering signal field…
            </div>
          ) : showRaster ? (
            <img
              src={rasterSrc!}
              alt={copy?.title || 'Signal Art composition'}
              className="w-full h-full object-cover bg-[#050508]"
              loading="eager"
              decoding="async"
              onError={() => setRasterFailed(true)}
            />
          ) : showSvg ? (
            <div
              className="w-full h-full min-h-[280px] [&>svg]:w-full [&>svg]:h-full"
              dangerouslySetInnerHTML={{ __html: edition!.svg }}
            />
          ) : (
            <div className="w-full h-full min-h-[280px] flex items-center justify-center px-6 text-center text-sm" style={{ color: DIM }}>
              No composition available for this date yet.
            </div>
          )}
        </div>

        {copy && (
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            <article className="rounded-xl p-6" style={{ border: `1px solid ${BORDER}`, backgroundColor: CARD }}>
              <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: GOLD }}>
                What PYTHH saw
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: MUTED }}>
                {copy.process}
              </p>
            </article>
            <article className="rounded-xl p-6" style={{ border: `1px solid ${BORDER}`, backgroundColor: CARD }}>
              <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: G }}>
                Philosophy
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: MUTED }}>
                {copy.philosophy}
              </p>
            </article>
            <article className="md:col-span-2 rounded-xl p-6" style={{ border: `1px solid ${G_BORDER}`, backgroundColor: G_SUBTLE }}>
              <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: G }}>
                Introspection
              </h2>
              <p className="text-base leading-relaxed text-white/90 italic">&ldquo;{copy.introspection}&rdquo;</p>
              {(copy.featured_startup || copy.featured_match) && (
                <p className="text-xs mt-4 font-mono" style={{ color: DIM }}>
                  {copy.featured_startup && <>Focal: {copy.featured_startup}</>}
                  {copy.featured_startup && copy.featured_match && ' · '}
                  {copy.featured_match && <>Tension: {copy.featured_match}</>}
                </p>
              )}
            </article>
          </div>
        )}

        {copy?.legend?.length ? (
          <section className="mb-12">
            <h2 className="text-sm font-semibold text-white mb-4">Signal legend</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {copy.legend.map((item) => (
                <div
                  key={item.key}
                  className="rounded-lg px-4 py-3 text-sm"
                  style={{ border: `1px solid ${BORDER}`, backgroundColor: CARD }}
                >
                  <div style={{ color: DIM }}>{item.label}</div>
                  <div className="font-medium text-white mt-0.5">{item.value}</div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {archive.length > 1 && (
          <section className="mb-12">
            <h2 className="text-sm font-semibold text-white mb-4">Archive</h2>
            <div className="flex flex-wrap gap-2">
              {archive.map((item) => (
                <Link
                  key={item.edition_date}
                  href={`/art?date=${item.edition_date}`}
                  className="text-xs font-mono px-3 py-1.5 rounded-full transition-colors"
                  style={{
                    border: `1px solid ${item.edition_date === edition?.edition_date ? G_BORDER : BORDER}`,
                    color: item.edition_date === edition?.edition_date ? G : MUTED,
                    backgroundColor: item.edition_date === edition?.edition_date ? G_SUBTLE : 'transparent',
                  }}
                >
                  {item.edition_date}
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="flex flex-wrap gap-4 items-center justify-between pt-6 border-t" style={{ borderColor: BORDER }}>
          <Link href="/newsletter" className="inline-flex items-center gap-2 text-sm" style={{ color: MUTED }}>
            <ArrowLeft size={14} />
            Daily Signal Brief
          </Link>
          <Link href="/matches" className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: G }}>
            See your matches
            <ArrowRight size={14} />
          </Link>
        </div>

        <div className="mt-16 rounded-xl p-8 text-center" style={{ border: `1px solid ${BORDER}`, backgroundColor: CARD }}>
          <p className="text-lg font-semibold text-white mb-2">Your startup has a shape in this market too.</p>
          <p className="text-sm mb-6" style={{ color: MUTED }}>
            Paste your URL — ranked investor shortlist in ~20 seconds.
          </p>
          <StartupCTA href="/find-investors" showArrow>
            See my matches
          </StartupCTA>
        </div>
      </main>
    </div>
  );
}
