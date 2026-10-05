import { useState } from 'react';
import { DIM, G, MUTED, TEXT } from '@/lib/designTokens';
import FreeDeckFocus from '@/components/FreeDeckFocus';
import {
  PRIORITY_CHOICES,
  STAGE_CHOICES,
  readCampaignBrief,
  writeCampaignBrief,
  type CampaignBrief,
  type CampaignPriority,
  type CampaignStage,
} from '@/lib/campaignBrief';

type QualifyStep = 'stage' | 'revenue' | 'product';

const STEPS: QualifyStep[] = ['stage', 'revenue', 'product'];

function Choice({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl px-4 py-4 text-left text-base font-semibold"
      style={{
        color: selected ? 'oklch(0.12 0.02 162)' : TEXT,
        background: selected ? G : 'oklch(0.16 0.016 264)',
        border: `1px solid ${selected ? G : 'oklch(0.34 0.02 162)'}`,
        boxShadow: selected ? '0 0 24px oklch(0.696 0.17 162.48 / 0.28)' : undefined,
      }}
    >
      {label}
    </button>
  );
}

export default function CampaignQuestions({
  url,
  onQualified,
}: {
  url: string;
  onQualified: (brief: CampaignBrief) => void;
}) {
  const [step, setStep] = useState<QualifyStep>('stage');
  const [brief, setBrief] = useState<CampaignBrief>(() => ({
    ...readCampaignBrief(url),
    stage: null,
    hasRevenue: null,
    hasProduct: null,
    priorities: [],
  }));

  const save = (next: CampaignBrief) => {
    setBrief(next);
    writeCampaignBrief(next);
  };

  const index = STEPS.indexOf(step);

  return (
    <section className="max-w-xl mx-auto py-8">
      <p className="text-[13px] font-medium mb-2" style={{ color: G }}>
        {index + 1} of 3
      </p>
      {step === 'stage' && (
        <>
          <h1 className="font-display font-semibold mb-4" style={{ color: TEXT, fontSize: '1.75rem', letterSpacing: '-0.03em' }}>
            What round is this?
          </h1>
          <div className="space-y-2">
            {STAGE_CHOICES.map((choice) => (
              <Choice
                key={choice.id}
                label={choice.label}
                selected={brief.stage === choice.id}
                onClick={() => {
                  save({ ...brief, url, stage: choice.id as CampaignStage });
                  setStep('revenue');
                }}
              />
            ))}
          </div>
        </>
      )}
      {step === 'revenue' && (
        <>
          <h1 className="font-display font-semibold mb-4" style={{ color: TEXT, fontSize: '1.75rem', letterSpacing: '-0.03em' }}>
            Does the company have revenue?
          </h1>
          <div className="space-y-2">
            <Choice
              label="Revenue"
              selected={brief.hasRevenue === true}
              onClick={() => {
                save({ ...brief, url, hasRevenue: true });
                setStep('product');
              }}
            />
            <Choice
              label="No revenue"
              selected={brief.hasRevenue === false}
              onClick={() => {
                save({ ...brief, url, hasRevenue: false });
                setStep('product');
              }}
            />
          </div>
        </>
      )}
      {step === 'product' && (
        <>
          <h1 className="font-display font-semibold mb-4" style={{ color: TEXT, fontSize: '1.75rem', letterSpacing: '-0.03em' }}>
            Is there a working product?
          </h1>
          <div className="space-y-2">
            <Choice
              label="Working product"
              selected={brief.hasProduct === true}
              onClick={() => {
                const next = { ...brief, url, hasProduct: true, priorities: [] };
                save(next);
                onQualified(next);
              }}
            />
            <Choice
              label="Not yet"
              selected={brief.hasProduct === false}
              onClick={() => {
                const next = { ...brief, url, hasProduct: false, priorities: [] };
                save(next);
                onQualified(next);
              }}
            />
          </div>
        </>
      )}
      <p className="text-sm mt-4" style={{ color: MUTED }}>
        These three answers decide who is eligible. The five investors come after this.
      </p>
    </section>
  );
}

type FollowStep = 'revenue' | 'hire' | 'focus';

export function CampaignPriorities({
  url,
  onDone,
}: {
  url: string;
  onDone: (brief: CampaignBrief) => void;
}) {
  const [step, setStep] = useState<FollowStep>('revenue');
  const [priorities, setPriorities] = useState<CampaignPriority[]>([]);

  const finish = (nextPriorities: CampaignPriority[]) => {
    const unique = [...new Set(nextPriorities)];
    const next = { ...readCampaignBrief(url), url, priorities: unique };
    writeCampaignBrief(next);
    onDone(next);
  };

  return (
    <section className="mb-8 max-w-xl rounded-2xl px-5 py-5" style={{ background: 'oklch(0.13 0.014 264)', border: '1px solid oklch(0.3 0.015 264)' }}>
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: G }}>
        {step === 'revenue' ? '1' : step === 'hire' ? '2' : '3'} of 3 · after the five
      </p>
      {step === 'revenue' && (
        <>
          <h2 className="font-display font-semibold mb-4" style={{ color: TEXT, fontSize: '1.5rem', letterSpacing: '-0.03em' }}>
            Does this round need to reach revenue?
          </h2>
          <div className="space-y-2">
            <Choice label="Yes, reach revenue" selected={false} onClick={() => { setPriorities(['revenue']); setStep('hire'); }} />
            <Choice label="Not this round" selected={false} onClick={() => { setPriorities([]); setStep('hire'); }} />
          </div>
        </>
      )}
      {step === 'hire' && (
        <>
          <h2 className="font-display font-semibold mb-4" style={{ color: TEXT, fontSize: '1.5rem', letterSpacing: '-0.03em' }}>
            Do you need to hire?
          </h2>
          <div className="space-y-2">
            <Choice label="Yes, hire the team" selected={false} onClick={() => { setPriorities((current) => [...current, 'hire']); setStep('focus'); }} />
            <Choice label="Not this round" selected={false} onClick={() => setStep('focus')} />
          </div>
        </>
      )}
      {step === 'focus' && (
        <>
          <h2 className="font-display font-semibold mb-4" style={{ color: TEXT, fontSize: '1.5rem', letterSpacing: '-0.03em' }}>
            What else should this round do?
          </h2>
          <div className="space-y-2">
            <Choice label="Pick up customers" selected={false} onClick={() => finish([...priorities, 'customers'])} />
            <Choice label="Ship the next version" selected={false} onClick={() => finish([...priorities, 'product'])} />
            <Choice label="Customers and the next version" selected={false} onClick={() => finish([...priorities, 'customers', 'product'])} />
          </div>
        </>
      )}
    </section>
  );
}

export function CampaignPlan({
  names,
  brief,
  deckFocus,
  onSave,
}: {
  names: string[];
  brief: CampaignBrief;
  deckFocus?: { title: string; detail: string }[];
  onSave: () => void;
}) {
  const proceeds = PRIORITY_CHOICES.filter((choice) => brief.priorities.includes(choice.id));
  const round = brief.stage === 'series-a' ? 'Series A' : brief.stage === 'seed' ? 'seed' : 'pre-seed';
  return (
    <section className="mb-8">
      <p className="text-[13px] font-medium mb-2" style={{ color: G }}>
        Your campaign
      </p>
      <h2 className="font-display font-semibold mb-3" style={{ color: TEXT, fontSize: '1.5rem', letterSpacing: '-0.03em' }}>
        The {round} raise
      </h2>
      <p className="text-sm mb-2" style={{ color: TEXT }}>
        Raise from {names.filter(Boolean).slice(0, 5).join(', ') || 'the five investors above'}.
      </p>
      <p className="text-sm mb-4" style={{ color: MUTED }}>
        {brief.hasRevenue === true ? 'The company has revenue.' : brief.hasRevenue === false ? 'The company does not have revenue yet.' : ''}
        {brief.hasRevenue != null && brief.hasProduct != null ? ' ' : ''}
        {brief.hasProduct === true ? 'There is a working product.' : brief.hasProduct === false ? 'There is not a working product yet.' : ''}
        {proceeds.length ? ` This round is to ${proceeds.map((item) => item.label.toLowerCase()).join(', ')}.` : ''}
      </p>
      <FreeDeckFocus items={deckFocus} />
      <button
        type="button"
        onClick={onSave}
        className="inline-flex items-center px-4 py-2.5 rounded-lg text-sm font-semibold"
        style={{ backgroundColor: G, color: 'oklch(0.13 0.01 264)' }}
      >
        Save this campaign
      </button>
      <p className="text-sm mt-3" style={{ color: DIM }}>
        Saving keeps the URL, these answers, the five investors, and this plan on your account.
      </p>
    </section>
  );
}
