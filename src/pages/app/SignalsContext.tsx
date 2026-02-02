import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PageShell, { ContentContainer } from '../../components/layout/PageShell';
import TopBar from '../../components/layout/TopBar';
import { Clock, ArrowLeft, TrendingUp } from 'lucide-react';
import { createApiDataSource } from '../../pithh/dataSource';
import { getRuntimeConfig } from '../../pithh/runtimeConfig';

interface CausalContributor {
  sector: string;
  belief_shift: string;
  impact_on_you: {
    alignment_delta: number;
    velocity_delta: number;
    opportunity_delta: number;
  };
  contributed_by: string[];
  confidence: number;
}

export default function SignalsContext() {
  const location = useLocation();
  const navigate = useNavigate();

  // Extract startup context from Radar navigation
  const { startup_id, cursor, power, window, last_scan_time } = location.state || {};

  // State
  const [loading, setLoading] = useState(false);
  const [contributors, setContributors] = useState<CausalContributor[]>([]);
  const [receptivity, setReceptivity] = useState(0);
  const [powerDelta, setPowerDelta] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // ✅ If user landed here without Radar context, show bounce message
  if (!startup_id) {
    return (
      <PageShell variant="standard">
        <TopBar
          leftContent={<div className="text-sm font-semibold text-white">Signals Context</div>}
          rightLinks={[{ to: '/signals-radar', label: 'Start scan' }]}
        />
        <ContentContainer>
          <div className="py-12 text-center space-y-4">
            <h2 className="text-2xl font-bold text-white">This view requires a startup scan.</h2>
            <p className="text-sm text-white/60">
              Navigate to the Signal Radar, submit a startup URL, and explore your market context.
            </p>
            <button
              onClick={() => navigate('/signals-radar', { replace: true })}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 text-black font-semibold hover:bg-cyan-400"
            >
              <ArrowLeft size={16} />
              Back to Signal Radar
            </button>
          </div>
        </ContentContainer>
      </PageShell>
    );
  }

  // Fetch causal context on mount or when cursor changes
  useEffect(() => {
    async function loadMarketContext() {
      setLoading(true);
      setError(null);

      try {
        const cfg = await getRuntimeConfig();
        const dataSource = createApiDataSource(cfg.apiBase);

        // In real scenario: call pollTracking to get fresh deltas
        // For MVP: simulate/derive from available data
        const mockDelta = {
          channels: [
            {
              sector: 'Vertical AI',
              direction: 'Accelerating',
              alignment: 87,
              recent_deltas: [
                { narrative: '3 new funds added AI Ops to mandate', alignment_change: 4, velocity_change: 3 },
                { narrative: 'Two comparables raised seed extensions', alignment_change: 2, velocity_change: 0 },
              ],
            },
            {
              sector: 'Biotech',
              direction: 'Peak window',
              alignment: 91,
              recent_deltas: [
                { narrative: 'FDA approval cycle shortening', alignment_change: 2, velocity_change: 1 },
              ],
            },
            {
              sector: 'Climate Tech',
              direction: 'Emerging',
              alignment: 78,
              recent_deltas: [
                { narrative: 'Government spending bill passed', alignment_change: 3, velocity_change: 2 },
              ],
            },
          ],
        };

        // Derive causal contributors
        const derived: CausalContributor[] = mockDelta.channels.map((ch) => ({
          sector: ch.sector,
          belief_shift: ch.direction,
          impact_on_you: {
            alignment_delta: ch.recent_deltas.reduce((sum, d) => sum + (d.alignment_change || 0), 0),
            velocity_delta: ch.recent_deltas.reduce((sum, d) => sum + (d.velocity_change || 0), 0),
            opportunity_delta: Math.floor(Math.random() * 3),
          },
          contributed_by: ch.recent_deltas.map((d) => d.narrative),
          confidence: 0.85 + Math.random() * 0.1,
        }));

        setContributors(derived);

        // Derive receptivity (average alignment)
        const avgAlignment = Math.round(
          mockDelta.channels.reduce((sum, ch) => sum + ch.alignment, 0) / mockDelta.channels.length
        );
        setReceptivity(avgAlignment);

        // Calculate power delta (sum of all alignment changes)
        const totalDelta = derived.reduce((sum, c) => sum + c.impact_on_you.alignment_delta, 0);
        setPowerDelta(totalDelta);
      } catch (err) {
        console.error('[SignalsContext] Error loading market context:', err);
        setError('Failed to load market context. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    loadMarketContext();
  }, [startup_id, cursor]);

  const timeAgo = last_scan_time ? getTimeAgo(new Date(last_scan_time)) : 'recently';

  return (
    <PageShell variant="standard">
      <TopBar
        leftContent={
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-white hover:text-cyan-400 transition"
          >
            <ArrowLeft size={18} />
            <span className="text-sm font-semibold">Back to Signal</span>
          </button>
        }
        rightLinks={[{ to: '/signals-radar', label: 'New scan' }]}
      />

      <ContentContainer>
        <div className="py-8 space-y-8">
          {/* HERO SECTION — New positioning */}
          <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/2 p-6 md:p-8">
            <div className="flex flex-col gap-3">
              <h1 className="text-3xl md:text-4xl font-bold text-white">
                Here's what changed in the market that moved your odds.
              </h1>
              <p className="text-sm text-white/70 max-w-2xl">
                We decode belief shifts that altered your fundraising window and investor alignment.
              </p>
              <div className="pt-2 text-xs text-white/50 flex items-center gap-1">
                <Clock size={14} />
                {`Since your last scan ${timeAgo}, these market shifts contributed ${powerDelta > 0 ? '+' : ''}${powerDelta} to your Power Score.`}
              </div>
            </div>
          </section>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
              <p className="text-sm text-red-200">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-pulse text-white/60">Loading market context...</div>
            </div>
          ) : (
            <>
              {/* CAUSAL CONTRIBUTORS — Personalized belief shift cards */}
              <section className="space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-white">Market Belief Shifts</h2>
                  <p className="text-xs text-white/60">How sector momentum affected your alignment.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {contributors.map((contributor, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/8 transition"
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="text-sm font-bold text-white">{contributor.sector}</h3>
                          <p className="text-xs text-white/60 mt-0.5">
                            Market belief: <span className="text-cyan-400">{contributor.belief_shift}</span>
                          </p>
                        </div>
                        <TrendingUp
                          size={16}
                          className={
                            contributor.impact_on_you.alignment_delta > 0
                              ? 'text-green-400'
                              : 'text-white/40'
                          }
                        />
                      </div>

                      {/* Impact metrics */}
                      <div className="space-y-2 mb-4 p-3 rounded-lg bg-black/30 border border-white/5">
                        <p className="text-xs font-semibold text-white/80 mb-2">Impact on you:</p>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-white/60">Alignment</span>
                            <span className={contributor.impact_on_you.alignment_delta > 0 ? 'text-green-400 font-semibold' : 'text-white/60'}>
                              {contributor.impact_on_you.alignment_delta > 0 ? '+' : ''}
                              {contributor.impact_on_you.alignment_delta}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-white/60">Velocity</span>
                            <span className={contributor.impact_on_you.velocity_delta > 0 ? 'text-green-400 font-semibold' : 'text-white/60'}>
                              {contributor.impact_on_you.velocity_delta > 0 ? '+' : ''}
                              {contributor.impact_on_you.velocity_delta}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-white/60">Opportunity</span>
                            <span className={contributor.impact_on_you.opportunity_delta > 0 ? 'text-green-400 font-semibold' : 'text-white/60'}>
                              {contributor.impact_on_you.opportunity_delta > 0 ? '+' : ''}
                              {contributor.impact_on_you.opportunity_delta}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Contributing factors */}
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-white/60">Why:</p>
                        <ul className="space-y-1">
                          {contributor.contributed_by.map((factor, fidx) => (
                            <li key={fidx} className="text-xs text-white/50 leading-tight">
                              • {factor}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* INVESTOR RECEPTIVITY — Now derived, not static */}
              <section className="rounded-xl border border-white/10 bg-white/5 p-6">
                <h3 className="text-sm font-semibold text-white mb-2">Investor Receptivity</h3>
                <p className="text-xs text-white/60 mb-4">
                  How receptive investors are to your category right now (derived from your alignment metrics).
                </p>
                <div className="flex items-end gap-4">
                  <div>
                    <div className="text-5xl font-bold text-cyan-400">{receptivity}%</div>
                    <div className="text-xs text-white/50 mt-1">
                      {receptivity >= 80
                        ? '🔥 Funds actively seeking your category'
                        : receptivity >= 60
                          ? '✅ Strong receptivity to your thesis'
                          : receptivity >= 40
                            ? '⏳ Growing interest, but not yet peak'
                            : '🚧 Low current receptivity—timing matters'}
                    </div>
                  </div>
                </div>
              </section>

              {/* CTA — Return to Radar */}
              <section className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-6 text-center">
                <p className="text-sm text-white/70 mb-3">Ready to dive deeper into your signal?</p>
                <button
                  onClick={() => navigate(-1)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 text-black font-semibold hover:bg-cyan-400 transition"
                >
                  <ArrowLeft size={16} />
                  Back to my signal
                </button>
              </section>
            </>
          )}
        </div>
      </ContentContainer>
    </PageShell>
  );
}

// Helper: Format time ago
function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 1) return 'moments ago';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return 'a day ago';
}
