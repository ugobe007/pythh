import { buildRaiseCampaign, type RaiseCampaignInput, type RaiseStage } from '@/lib/raiseCampaign';
import { BORDER, CARD, DIM, G, GOLD, MUTED, TEXT } from '@/lib/designTokens';

type Props = RaiseCampaignInput & {
  /** Account page already saved the matches, so the summary leads. */
  saved?: boolean;
  matchCount?: number | null;
};

function StepRow({
  index,
  label,
  timing,
  status,
  title,
  body,
  paid,
  open,
  here,
}: {
  index: string;
  label: string;
  timing: string;
  status: string;
  title: string;
  body?: string;
  paid: boolean;
  open?: boolean;
  here?: boolean;
}) {
  const hot = here || open;
  return (
    <li
      className={`rounded-2xl ${hot ? 'px-5 py-5' : 'px-4 py-3.5'}`}
      style={{
        background: here
          ? 'linear-gradient(120deg, oklch(0.26 0.07 162), oklch(0.13 0.02 264) 70%)'
          : open
            ? 'linear-gradient(120deg, oklch(0.24 0.07 305), oklch(0.13 0.02 280) 68%)'
            : CARD,
        border: here
          ? `1px solid ${G}`
          : open
            ? '1px solid oklch(0.62 0.14 305 / 0.75)'
            : `1px solid ${BORDER}`,
        boxShadow: here
          ? '0 0 36px oklch(0.696 0.17 162.48 / 0.22)'
          : open
            ? '0 0 28px oklch(0.62 0.14 305 / 0.16)'
            : undefined,
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <p className={`font-semibold ${hot ? 'text-lg' : 'text-sm'}`} style={{ color: TEXT }}>
          <span
            className={`mr-2.5 inline-grid place-items-center rounded-lg font-bold ${hot ? 'h-8 w-8 text-sm' : 'h-6 w-6 text-[11px]'}`}
            style={{
              background: here ? G : open ? 'oklch(0.72 0.16 305)' : paid ? 'oklch(0.28 0.06 70)' : 'oklch(0.22 0.012 264)',
              color: here || open ? 'oklch(0.12 0.02 162)' : paid ? GOLD : MUTED,
              fontFamily: 'JetBrains Mono, ui-monospace, monospace',
            }}
          >
            {index}
          </span>
          {label}
          <span className="font-normal" style={{ color: MUTED }}> — {timing}</span>
        </p>
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]"
          style={{
            color: here ? 'oklch(0.12 0.02 162)' : paid ? GOLD : open ? 'oklch(0.12 0.03 305)' : G,
            background: here ? G : paid ? 'oklch(0.769 0.188 70.08 / 0.14)' : open ? 'oklch(0.78 0.14 305)' : 'oklch(0.696 0.17 162.48 / 0.12)',
          }}
        >
          {here ? 'Now' : status}
        </span>
      </div>
      <p className={`mt-2 leading-relaxed ${hot ? 'text-base' : 'text-xs'}`} style={{ color: hot ? TEXT : MUTED }}>{title}</p>
      {open && body && (
        <p className="mt-2 text-sm leading-relaxed" style={{ color: MUTED }}>{body}</p>
      )}
    </li>
  );
}

function positioning(stages: RaiseStage[]): RaiseStage | undefined {
  return stages.find((stage) => stage.id === 'strategy');
}

export default function RaiseCampaignBoard({ saved = false, matchCount, ...input }: Props) {
  const campaign = buildRaiseCampaign(input);
  const next = positioning(campaign.stages);
  const countLabel = typeof matchCount === 'number' && matchCount > 0
    ? `${matchCount} investor match${matchCount === 1 ? '' : 'es'}`
    : 'the investor matches';

  return (
    <section className="mb-8" aria-labelledby="raise-path-heading">
      <p className="text-[11px] font-semibold tracking-[0.18em] uppercase mb-2" style={{ color: G }}>
        {saved ? 'Where this raise stands' : 'The path'}
      </p>
      <h2 id="raise-path-heading" className="font-display text-2xl sm:text-3xl font-bold mb-2 leading-tight" style={{ color: TEXT }}>
        {saved ? `${campaign.startupName} is saved` : 'Positioning is next. The pitch deck is not.'}
      </h2>
      <p className="text-sm leading-relaxed mb-4 max-w-[68ch]" style={{ color: MUTED }}>
        {saved
          ? `Done, and free: we read ${campaign.startupName} and saved ${countLabel}. Next, still free: positioning — who should fund this round. The pitch deck comes after that. The deck outline, sending notes, and term-sheet help need Scout or Oracle.`
          : 'The investors on this page are free. Positioning — who to lead with, and why — is the next step, and it is free. The pitch deck comes after positioning. You pay when you want the deck outline, the notes sent, or help on a term sheet.'}
      </p>
      <ol className="space-y-2.5">
        <StepRow
          index="1"
          label="Matches"
          timing={saved ? 'Done' : 'On this page'}
          status="Free"
          title={saved ? `${countLabel} saved to this account.` : 'The ranked investors above. That list is the point of this page.'}
          paid={false}
          here={!saved}
          open={saved}
        />
        {campaign.stages.map((stage, index) => (
          <StepRow
            key={stage.id}
            index={String(index + 2)}
            label={stage.label}
            timing={stage.timing}
            status={stage.status}
            title={stage.title}
            body={stage.id === 'strategy' ? stage.body : undefined}
            paid={stage.paid}
            open={stage.id === 'strategy'}
          />
        ))}
      </ol>
      {next && !saved && (
        <p className="text-xs mt-3 leading-relaxed" style={{ color: DIM }}>
          Saving is free and opens positioning on your account. You do not need a pitch deck to do that.
        </p>
      )}
    </section>
  );
}
