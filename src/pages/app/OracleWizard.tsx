// ============================================================================
// Pythh Oracle — Wizard Page
// ============================================================================
// The 6-step wizard that walks founders through signal fine-tuning.
// Each step collects structured input and generates actionable recommendations.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Circle,
  Sparkles,
  Loader2,
  ArrowRight,
  Zap,
} from 'lucide-react';
import {
  ORACLE_STEPS,
  startOracleSession,
  completeStep,
  getSessionSteps,
  generateSignalActions,
  type OracleSession,
  type OracleStepData,
  type StepDefinition,
  type StepPrompt,
} from '../../services/oracleService';
import { useOracleStartupId } from '../../hooks/useOracleStartupId';

// ---------------------------------------------------------------------------
// Main Wizard Component
// ---------------------------------------------------------------------------

export default function OracleWizard() {
  const navigate = useNavigate();
  const startupId = useOracleStartupId();

  const [session, setSession] = useState<OracleSession | null>(null);
  const [steps, setSteps] = useState<OracleStepData[]>([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [responses, setResponses] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [explorationMode, setExplorationMode] = useState(false);

  // Initialize session
  useEffect(() => {
    if (!startupId) {
      // Exploration mode — let them browse the wizard steps without saving to DB
      setExplorationMode(true);
      setLoading(false);
      return;
    }

    const init = async () => {
      try {
        const sess = await startOracleSession(startupId);
        setSession(sess);
        setCurrentStep(sess.current_step);

        const stepsData = await getSessionSteps(sess.session_id);
        setSteps(stepsData);

        // Load existing responses for current step
        const currentStepData = stepsData.find((s) => s.step_number === sess.current_step);
        if (currentStepData?.responses) {
          setResponses(currentStepData.responses);
        }
      } catch (e: any) {
        // Fall back to exploration mode on error
        console.warn('Oracle session init failed, entering exploration mode:', e.message);
        setExplorationMode(true);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [startupId]);

  const stepDef = ORACLE_STEPS[currentStep - 1];
  const stepData = steps.find((s) => s.step_number === currentStep);
  const isComplete = stepData?.status === 'completed';
  const totalSteps = ORACLE_STEPS.length;
  const isLastStep = currentStep === totalSteps;

  // Handle response changes
  const handleResponse = useCallback((promptId: string, value: unknown) => {
    setResponses((prev) => ({ ...prev, [promptId]: value }));
  }, []);

  // Handle multi-select toggles
  const toggleMultiSelect = useCallback((promptId: string, option: string) => {
    setResponses((prev) => {
      const current = (prev[promptId] as string[]) || [];
      const updated = current.includes(option)
        ? current.filter((o) => o !== option)
        : [...current, option];
      return { ...prev, [promptId]: updated };
    });
  }, []);

  // Handle checklist toggles (same as multi-select)
  const toggleChecklist = toggleMultiSelect;

  // Save current step and advance
  const handleNext = async () => {
    if (explorationMode) {
      // In exploration mode, just navigate between steps locally
      if (isLastStep) {
        navigate('/app/oracle');
      } else {
        const next = currentStep + 1;
        setCurrentStep(next);
        setResponses({});
      }
      return;
    }

    if (!session || !startupId) return;
    setSaving(true);
    try {
      // Save step
      await completeStep(session.session_id, currentStep, responses);

      // Generate signal actions from this step
      await generateSignalActions(startupId, session.session_id, stepDef.key, responses);

      // Refresh steps
      const updated = await getSessionSteps(session.session_id);
      setSteps(updated);

      if (isLastStep) {
        // Wizard complete → go to dashboard
        navigate('/app/oracle');
      } else {
        // Move to next step
        const next = currentStep + 1;
        setCurrentStep(next);
        const nextData = updated.find((s) => s.step_number === next);
        setResponses(nextData?.responses || {});
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // Go to previous step
  const handleBack = () => {
    if (currentStep > 1) {
      const prev = currentStep - 1;
      setCurrentStep(prev);
      const prevData = steps.find((s) => s.step_number === prev);
      setResponses(prevData?.responses || {});
    }
  };

  // Check if required fields are filled
  const canProceed = explorationMode ? true : stepDef?.prompts
    .filter((p) => p.required)
    .every((p) => {
      const val = responses[p.id];
      if (Array.isArray(val)) return val.length > 0;
      return val && String(val).trim().length > 0;
    });

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="bg-white/5 border border-red-500/30 rounded-2xl p-8 max-w-md text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="text-white/60 hover:text-white underline text-sm"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/80 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <span className="text-sm font-semibold tracking-wide text-white/90">
              Pythh Oracle
            </span>
            <span className="text-xs text-white/40">— Signal Wizard</span>
          </div>
          <button
            onClick={() => navigate('/app/oracle')}
            className="text-xs text-white/40 hover:text-white/70 transition"
          >
            Exit to Dashboard
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="max-w-4xl mx-auto px-4 pt-8">
        {explorationMode && (
          <div className="mb-4 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 flex items-center justify-between">
            <p className="text-xs text-amber-300/80">
              Exploration mode — browse the steps to see what the Oracle covers. Submit your startup on the homepage to save progress.
            </p>
            <button
              onClick={() => navigate('/')}
              className="text-xs text-amber-400 hover:text-amber-300 underline ml-4 whitespace-nowrap"
            >
              Submit startup
            </button>
          </div>
        )}
        <StepProgress steps={ORACLE_STEPS} currentStep={currentStep} completedSteps={steps} />
      </div>

      {/* Step Content */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        {stepDef && (
          <div className="space-y-8">
            {/* Step Header */}
            <div className="text-center space-y-2">
              <span className="text-4xl">{stepDef.icon}</span>
              <h1 className="text-2xl font-bold text-white">
                {stepDef.title}
              </h1>
              <p className="text-white/50 text-sm">{stepDef.subtitle}</p>
              <p className="text-xs text-amber-400/60">
                Step {currentStep} of {totalSteps}
              </p>
            </div>

            {/* Prompts */}
            <div className="space-y-6">
              {stepDef.prompts.map((prompt) => (
                <PromptField
                  key={prompt.id}
                  prompt={prompt}
                  value={responses[prompt.id]}
                  onChange={(v) => handleResponse(prompt.id, v)}
                  onToggle={(option) =>
                    prompt.type === 'checklist'
                      ? toggleChecklist(prompt.id, option)
                      : toggleMultiSelect(prompt.id, option)
                  }
                />
              ))}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between pt-4 border-t border-white/10">
              <button
                onClick={handleBack}
                disabled={currentStep === 1}
                className="flex items-center gap-2 text-white/50 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition text-sm"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>

              <button
                onClick={handleNext}
                disabled={!canProceed || saving}
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:bg-white/10 disabled:text-white/30 text-black font-semibold px-6 py-3 rounded-xl transition text-sm"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isLastStep ? (
                  <>
                    Complete Wizard
                    <Zap className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    Next Step
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step Progress Indicator
// ---------------------------------------------------------------------------

function StepProgress({
  steps,
  currentStep,
  completedSteps,
}: {
  steps: StepDefinition[];
  currentStep: number;
  completedSteps: OracleStepData[];
}) {
  return (
    <div className="flex items-center justify-between gap-1">
      {steps.map((step, i) => {
        const stepData = completedSteps.find((s) => s.step_number === step.number);
        const isCompleted = stepData?.status === 'completed';
        const isCurrent = step.number === currentStep;

        return (
          <React.Fragment key={step.number}>
            <div className="flex flex-col items-center gap-1 flex-1">
              <div
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all
                  ${isCompleted ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30' : ''}
                  ${isCurrent ? 'bg-amber-500/20 text-amber-400 ring-2 ring-amber-500/50 scale-110' : ''}
                  ${!isCompleted && !isCurrent ? 'bg-white/5 text-white/30 ring-1 ring-white/10' : ''}
                `}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  step.number
                )}
              </div>
              <span
                className={`text-[10px] text-center leading-tight ${
                  isCurrent ? 'text-amber-400' : isCompleted ? 'text-emerald-400/70' : 'text-white/30'
                }`}
              >
                {step.title}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`h-px flex-1 mt-[-14px] ${
                  isCompleted ? 'bg-emerald-500/30' : 'bg-white/10'
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Prompt Field Renderer
// ---------------------------------------------------------------------------

function PromptField({
  prompt,
  value,
  onChange,
  onToggle,
}: {
  prompt: StepPrompt;
  value: unknown;
  onChange: (v: unknown) => void;
  onToggle: (option: string) => void;
}) {
  const selectedArray = Array.isArray(value) ? value : [];

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-white/90">
        {prompt.label}
        {prompt.required && <span className="text-amber-400 ml-1">*</span>}
      </label>
      <p className="text-xs text-white/40">{prompt.hint}</p>

      {prompt.type === 'textarea' && (
        <textarea
          value={String(value || '')}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/30 transition resize-none"
          placeholder={prompt.hint}
        />
      )}

      {prompt.type === 'select' && (
        <div className="flex flex-wrap gap-2">
          {prompt.options?.map((option) => (
            <button
              key={option}
              onClick={() => onChange(option)}
              className={`
                px-4 py-2 rounded-xl text-sm transition border
                ${value === option
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white/80'}
              `}
            >
              {option}
            </button>
          ))}
        </div>
      )}

      {prompt.type === 'multi-select' && (
        <div className="flex flex-wrap gap-2">
          {prompt.options?.map((option) => (
            <button
              key={option}
              onClick={() => onToggle(option)}
              className={`
                px-4 py-2 rounded-xl text-sm transition border
                ${selectedArray.includes(option)
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white/80'}
              `}
            >
              {selectedArray.includes(option) ? '✓ ' : ''}{option}
            </button>
          ))}
        </div>
      )}

      {prompt.type === 'checklist' && (
        <div className="space-y-2">
          {prompt.options?.map((option) => {
            const checked = selectedArray.includes(option);
            return (
              <button
                key={option}
                onClick={() => onToggle(option)}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition border text-left
                  ${checked
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'}
                `}
              >
                {checked ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-white/30 flex-shrink-0" />
                )}
                {option}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
