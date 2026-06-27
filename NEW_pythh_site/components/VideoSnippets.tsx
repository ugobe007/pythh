/**
 * Autoplay micro-demos — "video snippets" until Loom/MP4 assets ship.
 * Each card loops a product moment founders can watch in ~20s.
 */
import { useEffect, useRef, useState } from "react";
import { Play, Pause, ChevronLeft, ChevronRight } from "lucide-react";
import { G, PAGE, TEXT, MUTED, BORDER } from "@/lib/designTokens";

type SnippetId = "url" | "god" | "match" | "portfolio";

const SNIPPETS: Array<{
  id: SnippetId;
  title: string;
  subtitle: string;
  durationMs: number;
}> = [
  { id: "url", title: "Paste your URL", subtitle: "Public signals extracted in seconds", durationMs: 14000 },
  { id: "god", title: "GOD Score", subtitle: "Five dimensions, one composite", durationMs: 16000 },
  { id: "match", title: "Investor matches", subtitle: "Ranked with why-you-fit", durationMs: 15000 },
  { id: "portfolio", title: "Portfolio signals", subtitle: "Daily events on tracked picks", durationMs: 14000 },
];

function UrlSnippet({ tick }: { tick: number }) {
  const phase = tick % 14;
  const typed = "acme.ai".slice(0, Math.min(phase >= 2 ? phase - 1 : 0, 7));
  const scanning = phase >= 4 && phase < 10;
  const done = phase >= 10;
  const steps = ["Reading site", "Extracting team", "Scoring traction", "Mapping market"];
  const activeStep = scanning ? Math.min(3, Math.floor((phase - 4) / 1.5)) : done ? 3 : -1;

  return (
    <div className="h-full flex flex-col p-5 font-mono text-xs">
      <div className="rounded-lg p-3 mb-4" style={{ background: "oklch(0.08 0.01 264)", border: `1px solid ${BORDER}` }}>
        <span style={{ color: MUTED }}>https://</span>
        <span style={{ color: G }}>{typed}</span>
        <span className="inline-block w-2 h-3 ml-0.5 animate-pulse" style={{ background: G, opacity: phase < 4 ? 1 : 0 }} />
      </div>
      <div className="flex-1 space-y-2">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2 transition-opacity duration-300" style={{ opacity: i <= activeStep ? 1 : 0.25 }}>
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: i < activeStep ? G : i === activeStep ? "#eab308" : MUTED }}
            />
            <span style={{ color: i <= activeStep ? TEXT : MUTED }}>{s}</span>
            {i === activeStep && scanning && <span className="ml-auto" style={{ color: "#eab308" }}>…</span>}
            {done && i === 3 && <span className="ml-auto" style={{ color: G }}>✓</span>}
          </div>
        ))}
      </div>
      {done && (
        <p className="mt-3 text-[10px] tracking-wide uppercase" style={{ color: G }}>
          12 investors aligned · 4.2s
        </p>
      )}
    </div>
  );
}

function GodSnippet({ tick }: { tick: number }) {
  const dims = [
    { label: "Team", score: 16, color: "#22d3ee" },
    { label: "Traction", score: 14, color: G },
    { label: "Market", score: 17, color: "#a855f7" },
    { label: "Product", score: 15, color: "#eab308" },
    { label: "Vision", score: 13, color: "#f97316" },
  ];
  const progress = Math.min(1, tick / 12);
  const total = Math.round(dims.reduce((s, d) => s + d.score, 0) * progress);

  return (
    <div className="h-full p-5 flex flex-col">
      <div className="flex items-baseline justify-between mb-4">
        <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: MUTED }}>GOD Score</span>
        <span className="text-3xl font-bold font-mono tabular-nums" style={{ color: "#eab308" }}>{total}</span>
      </div>
      <div className="flex-1 space-y-3">
        {dims.map((d, i) => {
          const fill = Math.min(1, Math.max(0, progress * dims.length - i)) * (d.score / 20);
          return (
            <div key={d.label}>
              <div className="flex justify-between text-[10px] font-mono mb-1">
                <span style={{ color: MUTED }}>{d.label}</span>
                <span style={{ color: TEXT }}>{Math.round(d.score * fill)}/20</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "oklch(0.14 0.01 264)" }}>
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${fill * 100}%`, background: d.color }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MatchSnippet({ tick }: { tick: number }) {
  const investors = [
    { firm: "Sequoia Capital", fit: 94, signal: "Surge" },
    { firm: "a16z", fit: 89, signal: "Warm" },
    { firm: "Benchmark", fit: 86, signal: "Active" },
  ];
  const expanded = tick >= 8;

  return (
    <div className="h-full p-5 flex flex-col gap-2">
      {investors.map((inv, i) => {
        const visible = tick >= i * 2;
        const isTop = i === 0 && expanded;
        return (
          <div
            key={inv.firm}
            className="rounded-lg p-3 transition-all duration-300"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? "translateY(0)" : "translateY(8px)",
              background: isTop ? "oklch(0.696 0.17 162.48 / 0.08)" : "oklch(0.08 0.01 264)",
              border: `1px solid ${isTop ? G : BORDER}`,
            }}
          >
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold" style={{ color: TEXT }}>{inv.firm}</span>
              <span className="text-[10px] font-mono" style={{ color: G }}>{inv.fit}% fit</span>
            </div>
            {isTop && (
              <p className="text-[10px] mt-2 leading-relaxed" style={{ color: MUTED }}>
                Portfolio adjacency · viewed 3 similar startups · {inv.signal} signal
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PortfolioSnippet({ tick }: { tick: number }) {
  const events = [
    { emoji: "💰", text: "Runware raises $50M Series A", t: 0 },
    { emoji: "🚀", text: "Midas launches mGLOBAL on Aave", t: 3 },
    { emoji: "📊", text: "NeuBird ΔGOD −15 · review tier", t: 6 },
  ];

  return (
    <div className="h-full p-5 flex flex-col">
      <p className="text-[10px] font-mono uppercase tracking-widest mb-3" style={{ color: MUTED }}>Last 24h · Oracle fund</p>
      <div className="flex-1 space-y-2">
        {events.map((e) => {
          const visible = tick >= e.t;
          return (
            <div
              key={e.text}
              className="flex gap-2 items-start text-[11px] leading-snug transition-opacity duration-300"
              style={{ opacity: visible ? 1 : 0.2 }}
            >
              <span>{e.emoji}</span>
              <span style={{ color: visible ? TEXT : MUTED }}>{e.text}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 pt-3 border-t text-[10px] font-mono" style={{ borderColor: BORDER, color: G }}>
        10 events · fund locked · tracking {tick >= 9 ? "847" : "…"} holdings
      </div>
    </div>
  );
}

function SnippetStage({ id, tick }: { id: SnippetId; tick: number }) {
  switch (id) {
    case "url": return <UrlSnippet tick={tick} />;
    case "god": return <GodSnippet tick={tick} />;
    case "match": return <MatchSnippet tick={tick} />;
    case "portfolio": return <PortfolioSnippet tick={tick} />;
  }
}

export default function VideoSnippets() {
  const [active, setActive] = useState(0);
  const [tick, setTick] = useState(0);
  const [playing, setPlaying] = useState(true);
  const ref = useRef<HTMLElement>(null);
  const inView = useRef(true);

  const snippet = SNIPPETS[active];

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { inView.current = e.isIntersecting; }, { threshold: 0.25 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!playing || !inView.current) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [playing, active]);

  useEffect(() => {
    if (tick * 1000 >= snippet.durationMs) {
      setTick(0);
      setActive((a) => (a + 1) % SNIPPETS.length);
    }
  }, [tick, snippet.durationMs]);

  const go = (dir: -1 | 1) => {
    setTick(0);
    setActive((a) => (a + dir + SNIPPETS.length) % SNIPPETS.length);
  };

  return (
    <section ref={ref} className="mb-20">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <p className="text-[10px] font-mono tracking-widest uppercase mb-2" style={{ color: "oklch(0.38 0.01 264)" }}>
            watch pythh work
          </p>
          <h2 className="text-2xl font-bold" style={{ letterSpacing: "-0.02em", color: "oklch(0.95 0.005 264)" }}>
            How PYTHH works — in 30 seconds
          </h2>
          <p className="text-sm mt-1.5 max-w-lg" style={{ color: "oklch(0.48 0.01 264)" }}>
            Four core flows — URL to matches, scoring, outreach, and portfolio tracking — in under 30 seconds each.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => go(-1)} className="p-2 rounded-lg" style={{ border: `1px solid ${BORDER}`, color: MUTED }} aria-label="Previous snippet">
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono"
            style={{ border: `1px solid ${G}44`, color: G, background: `${G}11` }}
          >
            {playing ? <Pause size={14} /> : <Play size={14} />}
            {playing ? "Pause" : "Play"}
          </button>
          <button type="button" onClick={() => go(1)} className="p-2 rounded-lg" style={{ border: `1px solid ${BORDER}`, color: MUTED }} aria-label="Next snippet">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[240px_1fr] gap-4">
        <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0">
          {SNIPPETS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => { setActive(i); setTick(0); }}
              className="text-left rounded-xl p-4 flex-shrink-0 lg:flex-shrink transition-colors min-w-[200px] lg:min-w-0"
              style={{
                background: i === active ? "oklch(0.696 0.17 162.48 / 0.08)" : "oklch(0.105 0.01 264)",
                border: `1px solid ${i === active ? G : BORDER}`,
              }}
            >
              <p className="text-xs font-semibold mb-0.5" style={{ color: TEXT }}>{s.title}</p>
              <p className="text-[10px]" style={{ color: MUTED }}>{s.subtitle}</p>
            </button>
          ))}
        </div>

        <div
          className="rounded-2xl overflow-hidden aspect-video max-h-[320px]"
          style={{ background: PAGE, border: `1px solid ${BORDER}`, boxShadow: "0 24px 48px oklch(0 0 0 / 0.35)" }}
        >
          <SnippetStage id={snippet.id} tick={tick} />
        </div>
      </div>

      <div className="flex gap-2 mt-3 justify-center">
        {SNIPPETS.map((_, i) => (
          <span
            key={i}
            className="h-1 rounded-full transition-all duration-300"
            style={{ width: i === active ? 24 : 8, background: i === active ? G : BORDER }}
          />
        ))}
      </div>
    </section>
  );
}
