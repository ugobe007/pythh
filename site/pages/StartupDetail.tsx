/**
 * /startup/:startupId — public startup profile (rankings + explore deep links).
 * Oracle portfolio picks use /portfolio/:startupId for the full dossier.
 */

import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, ExternalLink, Activity, Target } from "lucide-react";
import SharedNavbar from "@/components/SharedNavbar";
import InlineMeta from "@/components/design/InlineMeta";
import StartupCTA from "@/components/design/StartupCTA";
import {
  G, CYAN, AMBER, MUTED, DIM, BORDER, PAGE,
  godScoreColor,
} from "@/lib/designTokens";

interface StartupProfile {
  id: string;
  name: string;
  tagline: string | null;
  website: string | null;
  pitch: string | null;
  description: string | null;
  sectors: string[];
  stage_estimate: string | null;
  total_god_score: number | null;
  recent_activity: Array<{ type: string; date: string; description: string }>;
}

export default function StartupDetail() {
  const params = useParams<{ startupId: string }>();
  const startupId = params?.startupId;

  const [startup, setStartup] = useState<StartupProfile | null>(null);
  const [inPortfolio, setInPortfolio] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!startupId) return;
    setLoading(true);
    setError(null);

    Promise.all([
      fetch(`/api/investor-lookup/startup/${startupId}`).then(async (r) => {
        const json = await r.json();
        if (!r.ok || !json.ok) throw new Error(json.error || "Not found");
        return json.data as StartupProfile;
      }),
      fetch(`/api/portfolio/${startupId}`).then((r) => r.ok),
    ])
      .then(([detail, portfolio]) => {
        setStartup(detail);
        setInPortfolio(portfolio);
      })
      .catch(() => setError("Startup not found."))
      .finally(() => setLoading(false));
  }, [startupId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: PAGE }}>
        <div className="flex flex-col items-center gap-3" style={{ color: DIM }}>
          <Activity size={24} className="animate-pulse" style={{ color: G }} />
          <span className="text-sm font-mono">Loading startup profile…</span>
        </div>
      </div>
    );
  }

  if (error || !startup) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: PAGE }}>
        <SharedNavbar activePath="/rankings" />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <p className="mb-4 text-sm font-mono" style={{ color: AMBER }}>{error || "Startup not found"}</p>
            <Link href="/rankings" className="text-sm font-mono flex items-center gap-1 justify-center" style={{ color: G }}>
              <ArrowLeft size={13} /> Back to rankings
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const websiteUrl = startup.website
    ? (startup.website.startsWith("http") ? startup.website : `https://${startup.website}`)
    : null;
  const summary = startup.description || startup.pitch || null;

  return (
    <div className="min-h-screen" style={{ backgroundColor: PAGE, color: "oklch(0.94 0.005 264)" }}>
      <Helmet>
        <title>{startup.name} — Pythh Startup Profile</title>
      </Helmet>

      <SharedNavbar activePath="/rankings" />

      <main className="container max-w-3xl pt-24 pb-20 px-4 sm:px-6 space-y-8">
        <Link
          href="/rankings"
          className="inline-flex items-center gap-1.5 text-xs font-mono transition-colors"
          style={{ color: DIM }}
        >
          <ArrowLeft size={12} /> Rankings
        </Link>

        <div className="space-y-4 pb-8 border-b" style={{ borderColor: BORDER }}>
          <h1 className="text-3xl font-display font-bold tracking-tight">{startup.name}</h1>
          {startup.tagline && (
            <p className="text-sm leading-relaxed max-w-xl" style={{ color: MUTED }}>{startup.tagline}</p>
          )}
          <InlineMeta
            items={[
              ...(startup.sectors ?? []).slice(0, 3).map((s) => ({ text: s, color: CYAN })),
              startup.stage_estimate ? { text: startup.stage_estimate, color: MUTED } : { text: "" },
              startup.total_god_score != null
                ? { text: `GOD ${startup.total_god_score}`, color: godScoreColor(startup.total_god_score) }
                : { text: "" },
            ]}
          />
          <div className="flex flex-wrap gap-3 pt-2">
            {websiteUrl && (
              <a
                href={websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-mono transition-colors"
                style={{ color: G }}
              >
                <ExternalLink size={12} />
                {startup.website?.replace(/^https?:\/\//, "")}
              </a>
            )}
            {inPortfolio && (
              <Link
                href={`/portfolio/${startup.id}`}
                className="inline-flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded border transition-colors"
                style={{ borderColor: `${G}40`, color: G }}
              >
                Oracle portfolio dossier →
              </Link>
            )}
          </div>
        </div>

        {summary && (
          <section className="space-y-2">
            <h2 className="text-xs font-mono uppercase tracking-widest" style={{ color: DIM }}>Overview</h2>
            <p className="text-sm leading-relaxed" style={{ color: MUTED }}>{summary}</p>
          </section>
        )}

        {startup.recent_activity.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-mono uppercase tracking-widest" style={{ color: DIM }}>Recent signals</h2>
            <ul className="space-y-2">
              {startup.recent_activity.slice(0, 5).map((a, i) => (
                <li
                  key={`${a.type}-${i}`}
                  className="text-sm px-3 py-2 rounded border"
                  style={{ borderColor: BORDER, color: MUTED }}
                >
                  {a.description}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section
          className="p-5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          style={{ borderColor: BORDER, backgroundColor: "oklch(0.12 0.01 264)" }}
        >
          <div className="flex items-start gap-3">
            <Target size={18} style={{ color: G, flexShrink: 0, marginTop: 2 }} />
            <div>
              <p className="text-sm font-semibold">See investor matches</p>
              <p className="text-xs mt-0.5" style={{ color: MUTED }}>
                Ranked shortlist with thesis fit and match scores.
              </p>
            </div>
          </div>
          <StartupCTA href={`/matches/preview/${startup.id}`} showArrow>
            View matches
          </StartupCTA>
        </section>
      </main>
    </div>
  );
}
