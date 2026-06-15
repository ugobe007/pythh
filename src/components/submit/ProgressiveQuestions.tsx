/**
 * PROGRESSIVE QUESTIONS — two-stage refinement flow
 *
 * Stage 1 (qualify): 3 foundational questions shown one at a time.
 *   Q1: Revenue stage  Q2: Team size  Q3: Capital raised
 *
 * Stage 2 (refine): 3 strategic questions shown after first match results.
 *   Q4: Fundraising timing  Q5: Primary focus  Q6: Business type
 *
 * Each question is a full-viewport slide with animated entrance.
 * Answers are returned via onComplete callback for the parent to save + reload the report.
 */

import { useState, useEffect } from 'react';
import { ArrowRight, ChevronLeft } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Stage1Answers {
  revenue_stage: 'pre_revenue' | 'revenue' | 'scaling' | null;
  team_size: 'solo' | 'small' | 'larger' | null;
  raised: 'none' | 'angel_preseed' | 'seed_plus' | null;
}

export interface Stage2Answers {
  fundraising_timing: 'exploring' | 'raising_now' | 'raising_soon' | null;
  primary_focus: 'product' | 'customers' | 'market' | null;
  business_type: 'software' | 'ai' | 'robotics' | 'energy' | 'marketplace' | 'other' | null;
}

interface Option {
  value: string;
  label: string;
  sublabel?: string;
}

interface Question {
  id: string;
  question: string;
  hint?: string;
  options: Option[];
}

// ─── Question definitions ─────────────────────────────────────────────────────

const STAGE1_QUESTIONS: Question[] = [
  {
    id: 'revenue_stage',
    question: 'Where are you on revenue?',
    hint: 'This determines which investor stage is right for you.',
    options: [
      { value: 'pre_revenue', label: 'Pre-Revenue', sublabel: 'Building toward first customers' },
      { value: 'revenue',     label: 'Revenue',     sublabel: 'Paying customers, growing MRR' },
      { value: 'scaling',     label: 'Scaling Revenue', sublabel: 'Proven model, accelerating' },
    ],
  },
  {
    id: 'team_size',
    question: 'What does the founding team look like?',
    hint: 'Investors weight team composition heavily at early stages.',
    options: [
      { value: 'solo',   label: 'Solo Founder',    sublabel: 'Just me right now' },
      { value: 'small',  label: '2–5 People',      sublabel: 'Small, focused team' },
      { value: 'larger', label: '6+ People',        sublabel: 'Scaling the org' },
    ],
  },
  {
    id: 'raised',
    question: 'Have you raised investment?',
    hint: 'Helps us weight your matches toward the right check sizes.',
    options: [
      { value: 'none',          label: 'Nothing yet',       sublabel: 'Bootstrapped / friends & family' },
      { value: 'angel_preseed', label: 'Angel / Pre-Seed',  sublabel: 'Early capital raised' },
      { value: 'seed_plus',     label: 'Seed or beyond',    sublabel: '$500K+ raised' },
    ],
  },
];

const STAGE2_QUESTIONS: Question[] = [
  {
    id: 'fundraising_timing',
    question: 'When are you planning to raise?',
    hint: 'Timing signals which investors are worth engaging now vs. later.',
    options: [
      { value: 'exploring',     label: 'Just Exploring',       sublabel: 'Not actively raising yet' },
      { value: 'raising_soon',  label: 'Within 6 Months',      sublabel: 'Getting ready to raise' },
      { value: 'raising_now',   label: 'Raising Now',          sublabel: 'Actively in conversations' },
    ],
  },
  {
    id: 'primary_focus',
    question: "What's your primary focus right now?",
    hint: 'Investors specialize. This narrows to those who add real value at your stage.',
    options: [
      { value: 'product',    label: 'Product Development', sublabel: 'Building the core product' },
      { value: 'customers',  label: 'Customer Growth',     sublabel: 'Acquiring and retaining users' },
      { value: 'market',     label: 'Market Expansion',    sublabel: 'Growing into new segments' },
    ],
  },
  {
    id: 'business_type',
    question: 'How would you categorize your business?',
    hint: 'Sector-specific investors produce dramatically better match quality.',
    options: [
      { value: 'software',    label: 'Software / SaaS' },
      { value: 'ai',          label: 'AI / ML' },
      { value: 'robotics',    label: 'Robotics / Hardware' },
      { value: 'energy',      label: 'Energy / Climate' },
      { value: 'marketplace', label: 'Marketplace' },
      { value: 'other',       label: 'Other' },
    ],
  },
];

// ─── Single question slide ────────────────────────────────────────────────────

function QuestionSlide({
  question,
  stepIndex,
  totalSteps,
  stageLabel,
  selectedValue,
  onSelect,
  onBack,
  isLastQuestion,
}: {
  question: Question;
  stepIndex: number;
  totalSteps: number;
  stageLabel: string;
  selectedValue: string | null;
  onSelect: (value: string) => void;
  onBack: () => void;
  isLastQuestion: boolean;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  const isGrid = question.options.length > 3;

  return (
    <div
      className="min-h-screen bg-[#080808] flex flex-col items-center justify-center px-4"
      style={{
        backgroundImage: 'radial-gradient(ellipse 70% 40% at 50% 0%, rgba(62,207,142,0.06) 0%, transparent 55%)',
        transition: 'opacity 0.35s ease, transform 0.35s ease',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(12px)',
      }}
    >
      <div className="w-full max-w-md">
        {/* Stage + progress */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            {stepIndex === 0 ? 'Back' : 'Previous'}
          </button>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest">{stageLabel}</span>
            <div className="flex gap-1">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className="h-1 rounded-full transition-all duration-400"
                  style={{
                    width: i === stepIndex ? 20 : 8,
                    background: i < stepIndex ? '#10b981' : i === stepIndex ? '#34d399' : '#27272a',
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Question */}
        <h2 className="text-2xl font-bold text-white mb-1 leading-snug tracking-tight">
          {question.question}
        </h2>
        {question.hint && (
          <p className="text-sm text-zinc-500 mb-7">{question.hint}</p>
        )}

        {/* Options */}
        <div className={isGrid ? 'grid grid-cols-2 gap-2.5' : 'flex flex-col gap-2.5'}>
          {question.options.map((opt) => {
            const selected = selectedValue === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => onSelect(opt.value)}
                className="w-full text-left px-4 py-3.5 rounded-xl border transition-all duration-200 group"
                style={{
                  borderColor: selected ? 'rgba(52,211,153,0.6)' : 'rgba(255,255,255,0.07)',
                  background: selected ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.02)',
                  boxShadow: selected ? '0 0 0 1px rgba(52,211,153,0.3)' : 'none',
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm font-semibold transition-colors ${selected ? 'text-emerald-300' : 'text-zinc-200 group-hover:text-white'}`}>
                      {opt.label}
                    </p>
                    {opt.sublabel && (
                      <p className="text-xs text-zinc-500 mt-0.5">{opt.sublabel}</p>
                    )}
                  </div>
                  {selected && (
                    <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0 ml-3">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                        <path d="M2 6l2.5 2.5L10 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Continue — only shows after selection */}
        {selectedValue && (
          <div className="mt-5 flex justify-end">
            <button
              onClick={() => onSelect(selectedValue)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-black bg-emerald-400 hover:bg-emerald-300 transition-all duration-200"
            >
              {isLastQuestion ? 'See My Matches' : 'Next'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Stage 1 orchestrator ─────────────────────────────────────────────────────

export function Stage1Questions({ onComplete, onBack }: {
  onComplete: (answers: Stage1Answers) => void;
  onBack: () => void;
}) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Stage1Answers>({
    revenue_stage: null,
    team_size: null,
    raised: null,
  });
  const [key, setKey] = useState(0); // forces remount for enter animation

  const question = STAGE1_QUESTIONS[step];
  const keys = ['revenue_stage', 'team_size', 'raised'] as const;
  const currentKey = keys[step];
  const currentValue = answers[currentKey] as string | null;

  function handleSelect(value: string) {
    const next = { ...answers, [currentKey]: value } as Stage1Answers;
    setAnswers(next);
    if (step < 2) {
      setTimeout(() => {
        setStep(s => s + 1);
        setKey(k => k + 1);
      }, 180);
    } else {
      onComplete(next);
    }
  }

  function handleBack() {
    if (step === 0) {
      onBack();
    } else {
      setStep(s => s - 1);
      setKey(k => k + 1);
    }
  }

  return (
    <QuestionSlide
      key={key}
      question={question}
      stepIndex={step}
      totalSteps={3}
      stageLabel="Step 1 of 2"
      selectedValue={currentValue}
      onSelect={handleSelect}
      onBack={handleBack}
      isLastQuestion={step === 2}
    />
  );
}

// ─── Stage 2 orchestrator ─────────────────────────────────────────────────────

export function Stage2Questions({ onComplete, onBack }: {
  onComplete: (answers: Stage2Answers) => void;
  onBack: () => void;
}) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Stage2Answers>({
    fundraising_timing: null,
    primary_focus: null,
    business_type: null,
  });
  const [key, setKey] = useState(0);

  const question = STAGE2_QUESTIONS[step];
  const keys = ['fundraising_timing', 'primary_focus', 'business_type'] as const;
  const currentKey = keys[step];
  const currentValue = answers[currentKey] as string | null;

  function handleSelect(value: string) {
    const next = { ...answers, [currentKey]: value } as Stage2Answers;
    setAnswers(next);
    if (step < 2) {
      setTimeout(() => {
        setStep(s => s + 1);
        setKey(k => k + 1);
      }, 180);
    } else {
      onComplete(next);
    }
  }

  function handleBack() {
    if (step === 0) {
      onBack();
    } else {
      setStep(s => s - 1);
      setKey(k => k + 1);
    }
  }

  return (
    <QuestionSlide
      key={key}
      question={question}
      stepIndex={step}
      totalSteps={3}
      stageLabel="Step 2 of 2"
      selectedValue={currentValue}
      onSelect={handleSelect}
      onBack={handleBack}
      isLastQuestion={step === 2}
    />
  );
}
