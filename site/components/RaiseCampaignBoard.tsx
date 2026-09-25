import { buildRaiseCampaign, type RaiseCampaignInput } from '@/lib/raiseCampaign';
import { BORDER, CARD, DIM, G, MUTED, TEXT } from '@/lib/designTokens';

export default function RaiseCampaignBoard(input: RaiseCampaignInput) {
  const campaign = buildRaiseCampaign(input);

  return (
    <section className="mb-8" aria-labelledby="raise-campaign-heading">
      <p className="text-[11px] font-semibold tracking-[0.18em] uppercase mb-2" style={{ color: G }}>
        Raise campaign
      </p>
      <h2 id="raise-campaign-heading" className="text-xl font-bold mb-1" style={{ color: TEXT }}>
        {campaign.startupName} — automate this raise
      </h2>
      <p className="text-sm leading-relaxed mb-4 max-w-[62ch]" style={{ color: MUTED }}>
        Strategy, deck, messaging, meetings, and the term sheet. The investors below are who this campaign goes to.
      </p>
      <ol className="grid gap-2">
        {campaign.stages.map((stage, index) => (
          <li
            key={stage.id}
            className="rounded-xl px-4 py-3 grid grid-cols-[auto_1fr_auto] gap-3 items-start"
            style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}
          >
            <span className="text-[11px] font-mono pt-0.5" style={{ color: G }}>{index + 1}</span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold tracking-[0.16em] uppercase mb-0.5" style={{ color: DIM }}>
                {stage.label}
              </p>
              <p className="text-sm font-semibold mb-1" style={{ color: TEXT }}>{stage.title}</p>
              <p className="text-xs leading-relaxed" style={{ color: MUTED }}>{stage.body}</p>
            </div>
            <span className="text-[10px] font-semibold tracking-wide uppercase whitespace-nowrap" style={{ color: G }}>
              {stage.status}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
