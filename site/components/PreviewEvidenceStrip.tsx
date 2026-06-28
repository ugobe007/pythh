/**
 * Evidence-and-rejection-first strip on instant match preview (F-2026-0624-15).
 */

type Props = {
  totalInNetwork: number;
  shownCount: number;
  startupName?: string;
};

export default function PreviewEvidenceStrip({ totalInNetwork, shownCount, startupName }: Props) {
  const total = Math.max(totalInNetwork, shownCount, 0);
  const shown = Math.max(shownCount, 0);
  const filtered = Math.max(total - shown, 0);

  return (
    <div className="mb-6 rounded-xl border border-zinc-700/80 bg-zinc-900/60 px-4 py-4 sm:px-5">
      <p className="text-[10px] uppercase tracking-[2px] text-zinc-500 mb-2">How we ranked this</p>
      <p className="text-sm text-zinc-200 leading-relaxed">
        We screened{' '}
        <span className="font-semibold text-white tabular-nums">{total.toLocaleString()}</span>{' '}
        investors against {startupName ? `${startupName}'s` : 'your'} signals — stage, sector, and check size.
        {filtered > 0 && (
          <>
            {' '}
            <span className="text-zinc-400">
              <span className="font-medium text-zinc-300 tabular-nums">{filtered.toLocaleString()}</span> didn&apos;t
              fit.
            </span>
          </>
        )}{' '}
        <span className="font-semibold text-emerald-400 tabular-nums">{shown}</span> strong matches below — with the
        evidence for each.
      </p>
    </div>
  );
}
