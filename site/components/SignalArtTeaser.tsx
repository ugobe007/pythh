/**
 * Homepage teaser — today's Signal Art thumbnail linking to /art.
 */

import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Sparkles } from "lucide-react";
import { apiUrl, fetchTimeoutSignal } from "@/lib/apiConfig";
import {
  G,
  GOLD,
  G_BORDER,
  G_SUBTLE,
  BORDER,
  CARD,
  MUTED,
  DIM,
  PAGE,
} from "@/lib/designTokens";

interface ArtTeaser {
  edition_date: string;
  title: string | null;
  subtitle: string | null;
  layout_mode: string | null;
  thumbnail_url: string | null;
  raster_url: string | null;
  preview_url?: string | null;
  svg_url?: string | null;
  generated_at: string;
  stale?: boolean;
  is_today?: boolean;
}

async function fetchArtTeaser(): Promise<ArtTeaser | null> {
  const headers = { Accept: "application/json" };

  try {
    const res = await fetch(apiUrl("/api/art/teaser"), {
      headers,
      signal: fetchTimeoutSignal(12_000),
    });
    if (res.ok) {
      const data = (await res.json()) as ArtTeaser;
      if (data?.edition_date) return data;
    }
  } catch {
    /* fall through */
  }

  try {
    const archRes = await fetch(apiUrl("/api/art/archive?limit=1"), {
      headers,
      signal: fetchTimeoutSignal(12_000),
    });
    if (!archRes.ok) return null;
    const arch = (await archRes.json()) as {
      editions?: Array<{
        edition_date: string;
        title?: string | null;
        subtitle?: string | null;
        layout_mode?: string | null;
        thumbnail_url?: string | null;
        generated_at: string;
      }>;
    };
    const latest = arch.editions?.[0];
    if (!latest?.edition_date) return null;
    return {
      edition_date: latest.edition_date,
      title: latest.title ?? null,
      subtitle: latest.subtitle ?? null,
      layout_mode: latest.layout_mode ?? null,
      thumbnail_url: latest.thumbnail_url ?? null,
      raster_url: null,
      generated_at: latest.generated_at,
      stale: true,
    };
  } catch {
    return null;
  }
}

export default function SignalArtTeaser() {
  const [teaser, setTeaser] = useState<ArtTeaser | null>(null);
  const [thumbFailed, setThumbFailed] = useState(false);
  const [rasterFailed, setRasterFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchArtTeaser().then((d) => {
      if (!cancelled && d?.edition_date) setTeaser(d);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!teaser) return null;

  const cacheBust = encodeURIComponent(teaser.generated_at || teaser.edition_date);
  const withBust = (url: string) => `${url}${url.includes("?") ? "&" : "?"}v=${cacheBust}`;
  const thumbSrc = teaser.thumbnail_url ? withBust(teaser.thumbnail_url) : null;
  const rasterSrc = teaser.raster_url ? withBust(teaser.raster_url) : null;
  const previewSrc = teaser.preview_url
    ? withBust(teaser.preview_url.startsWith("/api/") ? apiUrl(teaser.preview_url) : teaser.preview_url)
    : teaser.svg_url
      ? withBust(apiUrl(teaser.svg_url))
      : null;
  const imageSrc =
    thumbSrc && !thumbFailed
      ? thumbSrc
      : rasterSrc && !rasterFailed
        ? rasterSrc
        : previewSrc && !rasterFailed
          ? previewSrc
          : null;
  const staticThumb = `/art/${teaser.edition_date}-thumb.jpg?v=${cacheBust}`;

  return (
    <section className="border-y" style={{ borderColor: BORDER, backgroundColor: PAGE }}>
      <div className="container max-w-[1180px] mx-auto px-6 py-8">
        <Link
          href="/art"
          className="group flex flex-col sm:flex-row items-stretch sm:items-center gap-5 rounded-2xl p-4 sm:p-5 transition-colors"
          style={{
            border: `1px solid ${BORDER}`,
            backgroundColor: CARD,
            boxShadow: `0 0 40px ${G_SUBTLE}`,
          }}
        >
          <div
            className="relative flex-shrink-0 w-full sm:w-[140px] md:w-[160px] aspect-square sm:aspect-auto sm:h-[140px] md:h-[160px] rounded-xl overflow-hidden mx-auto sm:mx-0"
            style={{
              border: `1px solid ${G_BORDER}`,
              backgroundColor: "#050508",
            }}
          >
            {imageSrc ? (
              <img
                src={imageSrc}
                alt={teaser.title || "Today's Signal Art"}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                loading="lazy"
                decoding="async"
                onError={() => {
                  if (thumbSrc && !thumbFailed) setThumbFailed(true);
                  else setRasterFailed(true);
                }}
              />
            ) : (
              <img
                src={staticThumb}
                alt={teaser.title || "Today's Signal Art"}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                loading="lazy"
                decoding="async"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            )}
            {!imageSrc && (
              <div
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                style={{ color: DIM }}
              >
                <Sparkles size={28} style={{ color: G, opacity: 0.5 }} />
              </div>
            )}
            <div
              className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{
                background: "linear-gradient(135deg, transparent 40%, oklch(0.696 0.17 162.48 / 0.12) 100%)",
              }}
            />
          </div>

          <div className="flex-1 min-w-0 text-center sm:text-left">
            <p
              className="inline-flex items-center gap-1.5 text-[10px] font-mono font-semibold uppercase tracking-widest mb-2"
              style={{ color: G }}
            >
              <Sparkles size={11} />
              Signal Art
              {teaser.stale && (
                <span className="normal-case tracking-normal font-normal" style={{ color: DIM }}>
                  · latest edition
                </span>
              )}
            </p>
            <h2 className="font-display font-bold text-lg md:text-xl text-white mb-1 truncate">
              {teaser.title || "Today's oracle composition"}
            </h2>
            <p className="text-sm mb-3 line-clamp-2" style={{ color: MUTED }}>
              {teaser.subtitle
                ? `PYTHH saw ${teaser.subtitle.toLowerCase()} — flowing sci-fi signals between today and tomorrow.`
                : "PYTHH sees between today and tomorrow — one living composition per day from live market signals."}
            </p>
            <p className="inline-flex items-center gap-2 text-xs font-mono font-semibold uppercase tracking-wider transition-colors" style={{ color: GOLD }}>
              {teaser.stale ? "View composition" : "View today's composition"}
              <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
            </p>
            {teaser.layout_mode && (
              <p className="text-[10px] font-mono mt-2 uppercase tracking-widest" style={{ color: DIM }}>
                {teaser.layout_mode} layout · {teaser.edition_date}
              </p>
            )}
          </div>
        </Link>
      </div>
    </section>
  );
}
