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
      className="w-full text-left px-4 py-3 rounded-lg text-sm font-semibold"
      style={{
        color: selected ? 'oklch(0.13 0.01 264)' : TEXT,
        backgroundColor: selected ? G : 'transparent',
        border: `1px solid ${selected ? G : 'oklch(0.28 0.01 264)'}`,
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
  const [brief, setBrief] = useState<CampaignBrief>(() => readCampaignBrief(url));

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
                const next = { ...brief, url, hasProduct: true };
                save(next);
                onQualified(next);
              }}
            />
            <Choice
              label="Not yet"
              selected={brief.hasProduct === false}
              onClick={() => {
                const next = { ...brief, url, hasProduct: false };
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

export function CampaignPriorities({
  url,
  onDone,
}: {
  url: string;
  onDone: (brief: CampaignBrief) => void;
}) {
  const [selected, setSelected] = useState<CampaignPriority[]>(() => readCampaignBrief(url).priorities);

  const toggle = (id: CampaignPriority) => {
    setSelected((current) => (
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    ));
  };

  return (
    <section className="mb-8 max-w-xl">
      <p className="text-[13px] font-medium mb-2" style={{ color: G }}>
        This round
      </p>
      <h2 className="font-display font-semibold mb-3" style={{ color: TEXT, fontSize: '1.5rem', letterSpacing: '-0.03em' }}>
        What does this raise need to do?
      </h2>
      <div className="space-y-2 mb-4">
        {PRIORITY_CHOICES.map((choice) => (
          <Choice
            key={choice.id}
            label={choice.label}
            selected={selected.includes(choice.id)}
            onClick={() => toggle(choice.id)}
          />
        ))}
      </div>
      <button
        type="button"
        disabled={!selected.length}
        onClick={() => {
          const next = { ...readCampaignBrief(url), url, priorities: selected };
          writeCampaignBrief(next);
          onDone(next);
        }}
        className="inline-flex items-center px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50"
        style={{ backgroundColor: G, color: 'oklch(0.13 0.01 264)' }}
      >
        Match again and build the plan
      </button>
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
        {brief.hasRevenue ? 'The company has revenue.' : 'The company does not have revenue yet.'}
        {' '}
        {brief.hasProduct ? 'There is a working product.' : 'There is not a working product yet.'}
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
