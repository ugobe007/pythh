/**
 * Plain-language GOD score — investors' readiness read on your startup (0–100).
 */

type Props = {
  score: number | null | undefined;
  compact?: boolean;
};

export default function GodScoreExplainer({ score, compact = false }: Props) {
  const display = score != null ? Math.round(score) : '—';

  if (compact) {
    return (
      <p className="text-[11px] leading-relaxed" style={{ color: 'oklch(0.5 0.01 264)' }}>
        <span className="font-semibold" style={{ color: '#22d3ee' }}>GOD {display}/100</span>
        {' '}— how ready investors think you are for a meeting (team, traction, market, product, vision).
      </p>
    );
  }

  return (
    <div
      className="rounded-xl px-4 py-3 mb-5 text-left"
      style={{ backgroundColor: 'oklch(0.12 0.01 264)', border: '1px solid oklch(0.22 0.01 264)' }}
    >
      <p className="text-[10px] font-semibold tracking-widest mb-1.5" style={{ color: '#22d3ee' }}>
        WHAT IS GOD SCORE?
      </p>
      <p className="text-xs leading-relaxed mb-2" style={{ color: 'oklch(0.6 0.01 264)' }}>
        A 0–100 investor readiness score from your public signals — team, traction, market, product, and vision.
        Higher scores mean partners take meetings more seriously and fewer &ldquo;pass&rdquo; objections.
      </p>
      <p className="text-sm font-mono font-semibold" style={{ color: '#22c55e' }}>
        Your score today: {display}/100
      </p>
      <p className="text-[11px] mt-2" style={{ color: 'oklch(0.42 0.01 264)' }}>
        Readiness improvements are optional. Your matched investors and outreach drafts are available without finishing every card.
      </p>
    </div>
  );
}
