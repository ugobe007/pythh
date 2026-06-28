/**
 * Homepage teaser — today's Signal Art thumbnail linking to /art.
 */

import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Sparkles } from "lucide-react";
import { apiUrl } from "@/lib/apiConfig";
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
  generated_at: string;
}

export default function SignalArtTeaser() {
  const [teaser, setTeaser] = useState<ArtTeaser | null>(null);
  const [thumbFailed, setThumbFailed] = useState(false);
  const [rasterFailed, setRasterFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl("/api/art/teaser"), { headers: { Accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.edition_date) setTeaser(d as ArtTeaser);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!teaser) return null;

  const cacheBust = encodeURIComponent(teaser.generated_at || teaser.edition_date);
  const thumbSrc = teaser.thumbnail_url
    ? `${teaser.thumbnail_url}${teaser.thumbnail_url.includes("?") ? "&" : "?"}v=${cacheBust}`
    : null;
  const rasterSrc = teaser.raster_url
    ? `${teaser.raster_url}${teaser.raster_url.includes("?") ? "&" : "?"}v=${cacheBust}`
    : null;
  const imageSrc = thumbSrc && !thumbFailed ? thumbSrc : rasterSrc && !rasterFailed ? rasterSrc : null;

  if (!imageSrc) return null;

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
              View today's composition
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
