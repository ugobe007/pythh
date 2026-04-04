import { Fragment, type ReactNode } from 'react';
import {
  Award,
  Brain,
  Compass,
  Gem,
  Layers,
  Link2,
  Radio,
  Repeat2,
  Sun,
  Target,
  Zap,
} from 'lucide-react';
import { HotMoneyFlameMark } from './FlameIcon';

/** Psychological / deal signals from `startup_uploads` */
export type StartupSignalFlags = {
  is_oversubscribed?: boolean | null;
  has_followon?: boolean | null;
  is_competitive?: boolean | null;
  is_bridge_round?: boolean | null;
  has_sector_pivot?: boolean | null;
  has_social_proof_cascade?: boolean | null;
  is_repeat_founder?: boolean | null;
  has_cofounder_exit?: boolean | null;
};

type StartupStripProps = {
  flags: StartupSignalFlags;
  /** Best GOD / enhanced ≥ 85 — flame */
  hotScoreTier?: boolean;
  /** Best GOD / enhanced in [70, 85) — sun (warming); mutually exclusive with hotScoreTier */
  warmingScoreTier?: boolean;
  /** Strong psychological multiplier from enrichment */
  psychBoost?: boolean;
  /** Tighter for dense tables (e.g. rankings) */
  compact?: boolean;
  className?: string;
};

/** Outline-only chips — stroke + icon color, no fill */
const chip =
  'inline-flex items-center justify-center rounded-md border shrink-0 transition-colors bg-transparent';

/**
 * Icon-only badges for startup rows — distinguishes deals beyond a single GOD number.
 */
export function StartupSignalBadgeStrip({
  flags,
  hotScoreTier = false,
  warmingScoreTier = false,
  psychBoost = false,
  compact = false,
  className = '',
}: StartupStripProps) {
  const icon = compact ? 'h-3 w-3' : 'h-3.5 w-3.5';
  const pad = compact ? 'p-0.5' : 'p-1';

  const items: { key: string; node: ReactNode }[] = [];

  if (hotScoreTier) {
    items.push({
      key: 'hot-score',
      node: (
        <span
          key="hot-score"
          title="Hot — top-tier GOD / readiness (85+)"
          className="inline-flex items-center"
        >
          <HotMoneyFlameMark variant={5} className={icon} />
        </span>
      ),
    });
  } else if (warmingScoreTier) {
    items.push({
      key: 'warming-score',
      node: (
        <span
          key="warming-score"
          title="Warming — strong readiness (70–84)"
          className="inline-flex items-center text-amber-300/90"
        >
          <Sun className={icon} strokeWidth={2.2} />
        </span>
      ),
    });
  }

  if (flags.is_oversubscribed) {
    items.push({
      key: 'oversub',
      node: (
        <span
          key="oversub"
          title="Oversubscribed / high demand"
          className="inline-flex items-center"
        >
          <HotMoneyFlameMark variant={5} className={icon} />
        </span>
      ),
    });
  }

  if (flags.has_followon) {
    items.push({
      key: 'followon',
      node: (
        <span
          key="followon"
          title="Follow-on interest"
          className={`${chip} ${pad} border-sky-500/35 bg-sky-500/10 text-sky-300`}
        >
          <Gem className={icon} strokeWidth={2.2} />
        </span>
      ),
    });
  }

  if (flags.is_competitive) {
    items.push({
      key: 'competitive',
      node: (
        <span
          key="competitive"
          title="Competitive round"
          className={`${chip} ${pad} border-amber-500/40 text-amber-300`}
        >
          <Zap className={icon} strokeWidth={2.2} />
        </span>
      ),
    });
  }

  if (flags.has_social_proof_cascade) {
    items.push({
      key: 'social',
      node: (
        <span
          key="social"
          title="Social proof / cascade"
          className={`${chip} ${pad} border-cyan-500/40 text-cyan-300`}
        >
          <Radio className={icon} strokeWidth={2.2} />
        </span>
      ),
    });
  }

  if (flags.is_repeat_founder) {
    items.push({
      key: 'repeat',
      node: (
        <span
          key="repeat"
          title="Repeat founder"
          className={`${chip} ${pad} border-emerald-500/40 text-emerald-400`}
        >
          <Repeat2 className={icon} strokeWidth={2.2} />
        </span>
      ),
    });
  }

  if (flags.is_bridge_round) {
    items.push({
      key: 'bridge',
      node: (
        <span
          key="bridge"
          title="Bridge round"
          className={`${chip} ${pad} border-zinc-500/45 text-zinc-300`}
        >
          <Link2 className={icon} strokeWidth={2.2} />
        </span>
      ),
    });
  }

  if (flags.has_sector_pivot) {
    items.push({
      key: 'pivot',
      node: (
        <span
          key="pivot"
          title="Sector pivot"
          className={`${chip} ${pad} border-violet-500/40 text-violet-300`}
        >
          <Compass className={icon} strokeWidth={2.2} />
        </span>
      ),
    });
  }

  if (flags.has_cofounder_exit) {
    items.push({
      key: 'exit',
      node: (
        <span
          key="exit"
          title="Cofounder with prior exit"
          className={`${chip} ${pad} border-rose-500/40 text-rose-300`}
        >
          <Award className={icon} strokeWidth={2.2} />
        </span>
      ),
    });
  }

  if (psychBoost) {
    items.push({
      key: 'psych',
      node: (
        <span
          key="psych"
          title="Strong psychological signal multiplier"
          className={`${chip} ${pad} border-fuchsia-500/40 text-fuchsia-300`}
        >
          <Brain className={icon} strokeWidth={2.2} />
        </span>
      ),
    });
  }

  if (items.length === 0) return null;

  return (
    <span className={`inline-flex items-center gap-1 flex-wrap ${className}`} aria-hidden>
      {items.map(({ key, node }) => (
        <Fragment key={key}>{node}</Fragment>
      ))}
    </span>
  );
}

export type InvestorBadgeRow = {
  investor_score: number | null;
  investment_pace_per_year: number | null;
  total_investments: number | null;
  sectors: string[] | null;
  stage: string[] | null;
};

type InvestorBadgesProps = {
  row: InvestorBadgeRow;
  selectedIndustry: string;
  selectedStage: string;
  compact?: boolean;
  className?: string;
};

/**
 * Distinct investors beyond a single score — pace, portfolio depth, tier, sector fit.
 */
export function InvestorActivityBadgeStrip({
  row,
  selectedIndustry,
  selectedStage,
  compact = false,
  className = '',
}: InvestorBadgesProps) {
  const icon = compact ? 'h-3 w-3' : 'h-3.5 w-3.5';
  const pad = compact ? 'p-0.5' : 'p-1';
  const items: ReactNode[] = [];

  const sectorFit = (row.sectors || []).some(
    (s) => s.toLowerCase() === selectedIndustry.toLowerCase()
  );
  const stageFit =
    selectedStage !== 'Any' &&
    (row.stage || []).some((s) =>
      s.toLowerCase().includes(selectedStage.toLowerCase().replace('+', ''))
    );

  if (typeof row.investment_pace_per_year === 'number' && row.investment_pace_per_year >= 8) {
    items.push(
      <span
        key="pace"
        title="Deploying fast (high deals/year)"
        className="inline-flex items-center"
      >
        <HotMoneyFlameMark variant={5} className={icon} />
      </span>
    );
  } else if (typeof row.investment_pace_per_year === 'number' && row.investment_pace_per_year >= 5) {
    items.push(
      <span
        key="pace-mid"
        title="Active deployment pace"
        className={`${chip} ${pad} border-amber-500/40 text-amber-400`}
      >
        <Zap className={icon} strokeWidth={2.2} />
      </span>
    );
  }

  if (typeof row.investor_score === 'number' && row.investor_score >= 85) {
    items.push(
      <span
        key="score-hot"
        title="Hot — very high investor score"
        className="inline-flex items-center"
      >
        <HotMoneyFlameMark variant={5} className={icon} />
      </span>
    );
  } else if (typeof row.investor_score === 'number' && row.investor_score >= 70) {
    items.push(
      <span
        key="score-warming"
        title="Warming — strong investor score (70–84)"
        className="inline-flex items-center text-amber-300/90"
      >
        <Sun className={icon} strokeWidth={2.2} />
      </span>
    );
  }

  if (typeof row.total_investments === 'number' && row.total_investments >= 40) {
    items.push(
      <span
        key="portfolio"
        title="Large portfolio / high activity"
        className={`${chip} ${pad} border-cyan-500/40 text-cyan-300`}
      >
        <Layers className={icon} strokeWidth={2.2} />
      </span>
    );
  }

  if (sectorFit) {
    items.push(
      <span
        key="sector"
        title="Sector match"
        className={`${chip} ${pad} border-emerald-500/40 text-emerald-400`}
      >
        <Target className={icon} strokeWidth={2.2} />
      </span>
    );
  } else if (stageFit) {
    items.push(
      <span
        key="stage"
        title="Stage alignment"
        className={`${chip} ${pad} border-violet-500/40 text-violet-300`}
      >
        <Target className={icon} strokeWidth={2.2} />
      </span>
    );
  }

  if (items.length === 0) return null;

  return (
    <span className={`inline-flex items-center gap-1 flex-wrap ${className}`} aria-hidden>
      {items}
    </span>
  );
}
