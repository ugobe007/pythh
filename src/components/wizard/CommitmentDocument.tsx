/**
 * COMMITMENT DOCUMENT
 * Renders the provisional/active readiness doc.
 * Provisional → "Investment Memo" once all tasks are proved.
 */

import { useState } from 'react';
import { CheckCircle, Clock, Copy, ExternalLink, Lock, Unlock } from 'lucide-react';

interface ScoreSnapshot {
  total: number;
  team: number;
  traction: number;
  market: number;
  product: number;
  vision: number;
}

interface Commitment {
  task_key: string;
  component: string;
  task: string;
  deadline: string | null;
  status: string;
  impact: string;
  proof: unknown;
}

interface DocContent {
  header: {
    startup_name: string;
    website: string | null;
    generated_date: string;
    status: 'provisional' | 'active';
  };
  offer: {
    raise_amount: number | null;
    stage: string;
    sectors: string[];
    what_we_build: string | null;
  };
  score_snapshot: ScoreSnapshot;
  projections: {
    projected_score: number;
    projected_gain: number;
    proved_gain: number;
  };
  commitments: Commitment[];
  note: string;
}

interface CommitmentDocumentProps {
  document: {
    id: string;
    version: number;
    is_provisional: boolean;
    generated_at: string;
    content: DocContent;
  };
  onProveTask?: (commitment: Commitment) => void;
}

const COMPONENT_LABELS: Record<string, string> = {
  team: 'Team',
  traction: 'Traction',
  market: 'Market',
  product: 'Product',
  vision: 'Vision',
};

const STATUS_STYLES: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  acknowledged: {
    color: '#facc15',
    icon: <Clock className="w-3 h-3" />,
    label: 'Committed',
  },
  in_progress: {
    color: '#38bdf8',
    icon: <Clock className="w-3 h-3" />,
    label: 'In Progress',
  },
  completed: {
    color: '#34d399',
    icon: <CheckCircle className="w-3 h-3" />,
    label: 'Completed',
  },
  pending: {
    color: 'rgba(255,255,255,0.3)',
    icon: <Clock className="w-3 h-3" />,
    label: 'Pending',
  },
};

function ScoreBar({ label, score }: { label: string; score: number }) {
  const color = score >= 70 ? '#34d399' : score >= 50 ? '#facc15' : '#f87171';
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs w-16 shrink-0" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
      <span className="text-xs font-mono w-8 text-right" style={{ color }}>{score}</span>
    </div>
  );
}

export default function CommitmentDocument({ document: doc, onProveTask }: CommitmentDocumentProps) {
  const [copied, setCopied] = useState(false);
  const c = doc.content;
  const isActive = !doc.is_provisional;

  const activeCommitments = c.commitments.filter(cm => cm.status !== 'skipped');
  const completedCount = c.commitments.filter(cm => cm.status === 'completed').length;
  const totalActive = activeCommitments.length;

  const copyMarkdown = () => {
    const text = [
      `# ${c.header.startup_name} — ${isActive ? 'Investment Memo' : 'Commitment Doc (Provisional)'}`,
      `**Website:** ${c.header.website || '—'}`,
      `**Stage:** ${c.offer.stage} | **Sector:** ${c.offer.sectors.join(', ')}`,
      c.offer.raise_amount ? `**Raise:** $${Number(c.offer.raise_amount).toLocaleString()}` : '',
      '',
      '## Summary',
      c.offer.what_we_build || '—',
      '',
      '## GOD Score Snapshot',
      `Total: ${c.score_snapshot.total}/100`,
      `Team: ${c.score_snapshot.team} | Traction: ${c.score_snapshot.traction} | Market: ${c.score_snapshot.market} | Product: ${c.score_snapshot.product} | Vision: ${c.score_snapshot.vision}`,
      '',
      '## Commitments',
      ...activeCommitments.map(cm =>
        `- [${cm.status === 'completed' ? '✓' : ' '}] ${cm.task} — Deadline: ${cm.deadline ? new Date(cm.deadline).toLocaleDateString() : 'TBD'} | ${cm.impact}`
      ),
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="w-full rounded-2xl overflow-hidden"
      style={{
        background: '#0d0d0d',
        border: `1px solid ${isActive ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.08)'}`,
        boxShadow: isActive ? '0 0 40px rgba(52,211,153,0.06)' : 'none',
      }}
    >
      {/* Header bar */}
      <div
        className="px-6 py-4 flex items-center justify-between"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center gap-3">
          {isActive
            ? <Unlock className="w-4 h-4 text-emerald-400" />
            : <Lock className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.3)' }} />
          }
          <div>
            <h2
              className="text-sm font-semibold text-white"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              {isActive ? 'Investment Memo' : 'Commitment Doc'}
            </h2>
            <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {isActive ? 'Ready to share with investors' : `Provisional · v${doc.version}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isActive && (
            <span
              className="text-[11px] px-2.5 py-1 rounded-full font-semibold"
              style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }}
            >
              Active
            </span>
          )}
          <button
            onClick={copyMarkdown}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition"
            style={{
              color: copied ? '#34d399' : 'rgba(255,255,255,0.4)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <Copy className="w-3 h-3" />
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Company + offer */}
        <div>
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3
                className="text-lg font-bold text-white"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                {c.header.startup_name}
              </h3>
              {c.header.website && (
                <a
                  href={c.header.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs mt-0.5 transition"
                  style={{ color: 'rgba(255,255,255,0.35)' }}
                >
                  {c.header.website.replace(/^https?:\/\//, '')}
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
            </div>
            <div className="text-right">
              <span
                className="text-xs px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                {c.offer.stage}
              </span>
              {c.offer.raise_amount && (
                <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Raising ${Number(c.offer.raise_amount).toLocaleString()}
                </p>
              )}
            </div>
          </div>
          {c.offer.sectors.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {c.offer.sectors.map(s => (
                <span
                  key={s}
                  className="text-[11px] px-2 py-0.5 rounded"
                  style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  {s}
                </span>
              ))}
            </div>
          )}
          {c.offer.what_we_build && (
            <p className="text-sm mt-3 leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
              {c.offer.what_we_build.substring(0, 300)}{c.offer.what_we_build.length > 300 ? '...' : ''}
            </p>
          )}
        </div>

        {/* Score snapshot */}
        <div
          className="rounded-xl p-4"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>GOD Score</span>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-white font-mono">{c.score_snapshot.total}</span>
              {c.projections.projected_gain > 0 && (
                <span className="text-xs font-semibold text-emerald-400">
                  → ~{c.projections.projected_score} projected
                </span>
              )}
            </div>
          </div>
          <div className="space-y-2">
            {Object.entries(c.score_snapshot)
              .filter(([k]) => k !== 'total')
              .map(([key, score]) => (
                <ScoreBar key={key} label={COMPONENT_LABELS[key] || key} score={score as number} />
              ))}
          </div>
        </div>

        {/* Progress */}
        {totalActive > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Commitments
              </span>
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {completedCount}/{totalActive} completed
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full overflow-hidden mb-4" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${totalActive ? (completedCount / totalActive) * 100 : 0}%`,
                  background: '#34d399',
                }}
              />
            </div>
          </div>
        )}

        {/* Commitments table */}
        {activeCommitments.length > 0 && (
          <div className="space-y-2">
            {activeCommitments.map((cm, i) => {
              const style = STATUS_STYLES[cm.status] || STATUS_STYLES.pending;
              return (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-xl px-4 py-3"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
                >
                  <span className="mt-0.5 flex-shrink-0" style={{ color: style.color }}>
                    {style.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm text-white leading-tight">{cm.task}</p>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
                        style={{ background: `${style.color}15`, color: style.color }}
                      >
                        {style.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        {COMPONENT_LABELS[cm.component]}
                      </span>
                      <span className="text-[11px] text-emerald-500">{cm.impact}</span>
                      {cm.deadline && (
                        <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
                          By {new Date(cm.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>
                  {onProveTask && cm.status === 'acknowledged' && (
                    <button
                      onClick={() => onProveTask(cm)}
                      className="shrink-0 text-[11px] px-2.5 py-1 rounded-lg transition"
                      style={{
                        background: 'rgba(52,211,153,0.08)',
                        color: '#34d399',
                        border: '1px solid rgba(52,211,153,0.2)',
                      }}
                    >
                      + Proof
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Note */}
        {doc.is_provisional && (
          <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.25)' }}>
            {c.note}
          </p>
        )}
      </div>
    </div>
  );
}
