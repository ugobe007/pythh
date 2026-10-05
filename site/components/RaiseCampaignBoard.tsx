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
  const accent = here ? G : open ? 'oklch(0.72 0.16 305)' : 'transparent';
  return (
    <li
      className="px-4 py-3.5"
      style={{
        background: here
          ? 'linear-gradient(90deg, oklch(0.17 0.04 162), oklch(0.13 0.012 264))'
          : open
            ? 'linear-gradient(90deg, oklch(0.17 0.04 305), oklch(0.12 0.012 264))'
            : CARD,
        boxShadow: `inset 3px 0 0 ${accent}`,
        opacity: paid && !open ? 0.78 : 1,
      }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-sm font-semibold" style={{ color: TEXT }}>
          <span
            className="mr-2 inline-grid h-5 w-5 place-items-center rounded text-[11px] font-bold"
            style={{
              background: here ? G : open ? 'oklch(0.72 0.16 305)' : 'oklch(0.2 0.01 264)',
              color: here || open ? 'oklch(0.12 0.02 162)' : MUTED,
              fontFamily: 'JetBrains Mono, ui-monospace, monospace',
            }}
          >
            {index}
          </span>
          {label}
          <span className="font-normal" style={{ color: MUTED }}> — {timing}</span>
        </p>
        <span className="text-[10px] font-semibold tracking-wide uppercase" style={{ color: paid ? GOLD : here ? G : open ? 'oklch(0.78 0.14 305)' : G }}>
          {here ? 'Now' : status}
        </span>
      </div>
      <p className={`mt-1.5 leading-relaxed ${open ? 'text-sm' : 'text-xs'}`} style={{ color: open || here ? TEXT : MUTED }}>{title}</p>
      {open && body && (
        <p className="text-sm mt-2 leading-relaxed" style={{ color: MUTED }}>{body}</p>
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
      <ol className="rounded-xl border overflow-hidden divide-y" style={{ borderColor: BORDER, backgroundColor: CARD }}>
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
