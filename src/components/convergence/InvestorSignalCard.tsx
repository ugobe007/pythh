/**
 * INVESTOR SIGNAL CARD - Single investor convergence card
 * =======================================================
 */

import type { InvestorMatch } from '../../types/convergence';

interface Props {
  investor: InvestorMatch;
}

export function InvestorSignalCard({ investor }: Props) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-6 hover:border-cyan-400/30 transition">
      
      {/* Top Row: Firm Identity + Match Score */}
      <div className="flex items-start justify-between mb-4">
        <FirmIdentity investor={investor} />
        <div className="text-right">
          <MatchScore score={investor.match_score_0_100} />
          <StateBadge state={investor.signal_state} />
        </div>
      </div>
      
      {/* Fit Metrics Row */}
      <FitMetricsRow fit={investor.fit} />
      
      {/* Why This Match */}
      <WhyList why={investor.why} />
      
      {/* Signal Meta */}
      <SignalMeta 
        signalAge={investor.signal_age_hours} 
        confidence={investor.confidence} 
      />
    </div>
  );
}

function FirmIdentity({ investor }: { investor: InvestorMatch }) {
  return (
    <div className="flex-1">
      <h3 className="text-lg font-bold text-white">{investor.firm_name}</h3>
      {investor.partner_name && (
        <p className="text-xs text-gray-500 mt-0.5">{investor.partner_name}</p>
      )}
    </div>
  );
}

function MatchScore({ score }: { score: number }) {
  return (
    <div className="text-2xl font-bold text-cyan-400 mb-1">
      {Math.round(score)}
    </div>
  );
}

function StateBadge({ state }: { state: string }) {
  const config = {
    breakout: { emoji: '🚀', label: 'Breakout', bg: 'bg-red-500/20', text: 'text-red-400' },
    surge: { emoji: '🔥', label: 'Surge', bg: 'bg-orange-500/20', text: 'text-orange-400' },
    warming: { emoji: '🌡', label: 'Warming', bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
    watch: { emoji: '👀', label: 'Watch', bg: 'bg-blue-500/20', text: 'text-blue-400' }
  };
  
  const cfg = config[state as keyof typeof config] || config.watch;
  
  return (
    <div className={`text-xs px-2 py-1 rounded inline-block ${cfg.bg} ${cfg.text}`}>
      {cfg.emoji} {cfg.label}
    </div>
  );
}

function FitMetricsRow({ fit }: { fit: InvestorMatch['fit'] }) {
  return (
    <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
      <div>
        <span className="text-gray-500">Stage Fit:</span>{' '}
        <span className="text-gray-300 capitalize">{fit.stage_fit}</span>
      </div>
      <div>
        <span className="text-gray-500">Sector Fit:</span>{' '}
        <span className="text-gray-300">{fit.sector_fit_pct}%</span>
      </div>
      <div>
        <span className="text-gray-500">Portfolio Adj.:</span>{' '}
        <span className="text-gray-300 capitalize">{fit.portfolio_adjacency}</span>
      </div>
      <div>
        <span className="text-gray-500">Velocity Align.:</span>{' '}
        <span className="text-gray-300 capitalize">{fit.velocity_alignment}</span>
      </div>
    </div>
  );
}

function WhyList({ why }: { why: InvestorMatch['why'] }) {
  return (
    <div className="mb-4">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">
        Why This Investor Appears
      </p>
      <ul className="space-y-1">
        {why.bullets.map((bullet, i) => (
          <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
            <span className="text-cyan-400 mt-0.5">•</span>
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SignalMeta({ signalAge, confidence }: { signalAge: number; confidence: string }) {
  const confidenceColors = {
    high: 'bg-green-500/10 text-green-400',
    med: 'bg-yellow-500/10 text-yellow-400',
    low: 'bg-gray-500/10 text-gray-400'
  };
  
  const ageText = signalAge === 1 ? '1 hour ago' : 
                  signalAge < 24 ? `${signalAge} hours ago` :
                  `${Math.floor(signalAge / 24)} days ago`;
  
  return (
    <div className="flex items-center justify-between text-xs text-gray-500">
      <span>Signal Age: {ageText}</span>
      <span className={`px-2 py-1 rounded capitalize ${confidenceColors[confidence as keyof typeof confidenceColors]}`}>
        Confidence: {confidence}
      </span>
    </div>
  );
}
