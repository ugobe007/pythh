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
  getOrCreateActiveSession,
  saveWizardStep,
  completeWizard,
  generateAIInsights,
  type OracleSession,
} from '../../services/oracleApiService';
import { useOracleStartupId } from '../../hooks/useOracleStartupId';

// ---------------------------------------------------------------------------
// Step Definitions with Form Fields
// ---------------------------------------------------------------------------

interface FormField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'multi-select' | 'number' | 'url';
  required: boolean;
  placeholder?: string;
  hint?: string;
  options?: string[];
}

interface StepDefinition {
  number: number;
  key: string;
  title: string;
  subtitle: string;
  icon: string;
  fields: FormField[];
}

const WIZARD_STEPS: StepDefinition[] = [
  {
    number: 1,
    key: 'stage',
    title: 'Stage & Raise',
    subtitle: 'Tell us about your funding stage and goals',
    icon: '🎯',
    fields: [
      {
        id: 'current_stage',
        label: 'Current funding stage',
        type: 'select',
        required: true,
        options: ['Pre-seed', 'Seed', 'Series A', 'Series B', 'Series B+', 'Not raising'],
      },
      {
        id: 'raise_amount',
        label: 'Target raise amount (USD)',
        type: 'number',
        required: true,
        placeholder: '500000',
        hint: 'How much are you looking to raise?',
      },
      {
        id: 'timeline',
        label: 'Fundraising timeline',
        type: 'select',
        required: true,
        options: ['Immediate (< 1 month)', 'Short-term (1-3 months)', 'Mid-term (3-6 months)', 'Long-term (6+ months)', 'Not actively raising'],
      },
      {
        id: 'use_of_funds',
        label: 'Primary use of funds',
        type: 'multi-select',
        required: true,
        options: ['Product development', 'Team expansion', 'Marketing & sales', 'Operations', 'Market expansion', 'R&D'],
        hint: 'Select all that apply',
      },
    ],
  },
  {
    number: 2,
    key: 'problem',
    title: 'Problem',
    subtitle: 'Define the problem you\'re solving',
    icon: '🎭',
    fields: [
      {
        id: 'problem_statement',
        label: 'Problem statement',
        type: 'textarea',
        required: true,
        placeholder: 'Describe the core problem...',
        hint: 'What pain point are you addressing? Be specific and concise.',
      },
      {
        id: 'target_audience',
        label: 'Who experiences this problem?',
        type: 'textarea',
        required: true,
        placeholder: 'B2B SaaS companies, SMBs in healthcare...',
        hint: 'Define your target audience clearly',
      },
      {
        id: 'problem_frequency',
        label: 'How often does this problem occur?',
        type: 'select',
        required: true,
        options: ['Daily', 'Weekly', 'Monthly', 'Occasionally', 'One-time'],
      },
      {
        id: 'current_alternatives',
        label: 'Current alternatives or workarounds',
        type: 'textarea',
        required: false,
        placeholder: 'Manual processes, spreadsheets, competitor products...',
        hint: 'What do people do today to solve this?',
      },
    ],
  },
  {
    number: 3,
    key: 'solution',
    title: 'Solution',
    subtitle: 'Explain your unique solution',
    icon: '💡',
    fields: [
      {
        id: 'solution_description',
        label: 'Solution description',
        type: 'textarea',
        required: true,
        placeholder: 'Our platform automates...',
        hint: 'How does your product solve the problem?',
      },
      {
        id: 'key_features',
        label: 'Key features',
        type: 'multi-select',
        required: true,
        options: ['AI/ML capabilities', 'Automation', 'Analytics/Insights', 'Integration ecosystem', 'Mobile-first', 'Real-time processing', 'Collaboration tools', 'Security/Compliance'],
        hint: 'Select your top features',
      },
      {
        id: 'unique_value',
        label: 'What makes your solution unique?',
        type: 'textarea',
        required: true,
        placeholder: 'Unlike competitors, we...',
        hint: 'Your unfair advantage or differentiation',
      },
      {
        id: 'tech_stack',
        label: 'Technology foundation',
        type: 'text',
        required: false,
        placeholder: 'React, Node.js, PostgreSQL...',
        hint: 'Core technologies powering your solution',
      },
    ],
  },
  {
    number: 4,
    key: 'traction',
    title: 'Traction',
    subtitle: 'Show your progress and metrics',
    icon: '📈',
    fields: [
      {
        id: 'total_users',
        label: 'Total users/customers',
        type: 'number',
        required: true,
        placeholder: '100',
        hint: 'Current user or customer count',
      },
      {
        id: 'mrr_arr',
        label: 'Monthly/Annual Recurring Revenue (USD)',
        type: 'number',
        required: false,
        placeholder: '10000',
        hint: 'Leave blank if pre-revenue',
      },
      {
        id: 'growth_rate',
        label: 'Monthly growth rate (%)',
        type: 'number',
        required: false,
        placeholder: '15',
        hint: 'User or revenue growth rate',
      },
      {
        id: 'key_milestones',
        label: 'Key milestones achieved',
        type: 'textarea',
        required: true,
        placeholder: '• Launched MVP in Q2 2025\n• Acquired first 100 users\n• Partnered with XYZ Corp',
        hint: 'Major achievements to date',
      },
      {
        id: 'metrics_tracking',
        label: 'What metrics do you track?',
        type: 'multi-select',
        required: false,
        options: ['Revenue/MRR', 'User growth', 'Engagement/DAU', 'Churn rate', 'CAC/LTV', 'Conversion rates', 'NPS/CSAT'],
        hint: 'Select all that you actively monitor',
      },
    ],
  },
  {
    number: 5,
    key: 'team',
    title: 'Team',
    subtitle: 'Introduce your founding team',
    icon: '👥',
    fields: [
      {
        id: 'team_size',
        label: 'Current team size',
        type: 'number',
        required: true,
        placeholder: '3',
        hint: 'Total number of team members',
      },
      {
        id: 'founders',
        label: 'Founder backgrounds',
        type: 'textarea',
        required: true,
        placeholder: 'CEO: 10 years in fintech, ex-Goldman Sachs\nCTO: Senior engineer from Google...',
        hint: 'Brief background for each founder',
      },
      {
        id: 'domain_expertise',
        label: 'Team expertise areas',
        type: 'multi-select',
        required: true,
        options: ['Engineering/Tech', 'Product/Design', 'Sales/Marketing', 'Finance/Operations', 'Industry domain', 'Previous startup experience'],
        hint: 'Key areas of expertise on your team',
      },
      {
        id: 'advisors',
        label: 'Notable advisors or backers',
        type: 'textarea',
        required: false,
        placeholder: 'John Smith (ex-VP at Stripe), Jane Doe (Partner at XYZ Capital)',
        hint: 'Advisors, angels, or early backers',
      },
      {
        id: 'hiring_needs',
        label: 'Key hiring priorities',
        type: 'text',
        required: false,
        placeholder: 'Senior Backend Engineer, Head of Sales...',
        hint: 'Roles you\'re actively recruiting for',
      },
    ],
  },
  {
    number: 6,
    key: 'pitch',
    title: 'Pitch',
    subtitle: 'Share your pitch materials',
    icon: '🎤',
    fields: [
      {
        id: 'elevator_pitch',
        label: 'Elevator pitch (30 seconds)',
        type: 'textarea',
        required: true,
        placeholder: 'We help [target] solve [problem] through [solution]. Unlike [alternatives], we [unique value].',
        hint: 'Your concise pitch in 2-3 sentences',
      },
      {
        id: 'deck_url',
        label: 'Pitch deck URL',
        type: 'url',
        required: false,
        placeholder: 'https://docsend.com/view/...',
        hint: 'Link to your pitch deck (Docsend, Google Drive, etc.)',
      },
      {
        id: 'demo_url',
        label: 'Product demo URL',
        type: 'url',
        required: false,
        placeholder: 'https://app.yourcompany.com or https://loom.com/...',
        hint: 'Link to live product or demo video',
      },
      {
        id: 'pitch_strength',
        label: 'What\'s strongest in your pitch?',
        type: 'multi-select',
        required: true,
        options: ['Team credentials', 'Traction/metrics', 'Market size', 'Technology/IP', 'Customer testimonials', 'Vision/opportunity'],
        hint: 'Your pitch\'s strongest elements',
      },
    ],
  },
  {
    number: 7,
    key: 'vision',
    title: 'Vision',
    subtitle: 'Paint the long-term vision',
    icon: '🔮',
    fields: [
      {
        id: 'long_term_vision',
        label: '5-year vision',
        type: 'textarea',
        required: true,
        placeholder: 'In 5 years, we will be...',
        hint: 'Where do you see the company in 5 years?',
      },
      {
        id: 'impact_statement',
        label: 'Impact statement',
        type: 'textarea',
        required: true,
        placeholder: 'We will change how...',
        hint: 'What impact will you have on the world/industry?',
      },
      {
        id: 'expansion_plans',
        label: 'Growth & expansion strategy',
        type: 'textarea',
        required: false,
        placeholder: 'Start with SMBs, expand to enterprise; launch in US, then Europe...',
        hint: 'How will you scale and expand?',
      },
      {
        id: 'future_products',
        label: 'Product roadmap highlights',
        type: 'text',
        required: false,
        placeholder: 'Mobile app Q2, API platform Q3, AI features Q4...',
        hint: 'Key future product initiatives',
      },
    ],
  },
  {
    number: 8,
    key: 'market',
    title: 'Market',
    subtitle: 'Define your market opportunity',
    icon: '🌍',
    fields: [
      {
        id: 'tam',
        label: 'TAM - Total Addressable Market (USD)',
        type: 'number',
        required: true,
        placeholder: '50000000000',
        hint: 'Total market size if you had 100% share',
      },
      {
        id: 'sam',
        label: 'SAM - Serviceable Available Market (USD)',
        type: 'number',
        required: true,
        placeholder: '5000000000',
        hint: 'Market you can actually reach',
      },
      {
        id: 'som',
        label: 'SOM - Serviceable Obtainable Market (USD)',
        type: 'number',
        required: true,
        placeholder: '500000000',
        hint: 'Market you can realistically capture short-term',
      },
      {
        id: 'market_trends',
        label: 'Key market trends',
        type: 'textarea',
        required: true,
        placeholder: 'AI adoption accelerating, regulatory changes, shift to remote work...',
        hint: 'Favorable trends supporting your business',
      },
      {
        id: 'competitors',
        label: 'Main competitors',
        type: 'textarea',
        required: true,
        placeholder: 'Direct: CompanyA, CompanyB\nIndirect: Legacy tools, manual processes',
        hint: 'Who are you competing against?',
      },
      {
        id: 'competitive_moat',
        label: 'Your competitive advantage',
        type: 'textarea',
        required: true,
        placeholder: 'Proprietary technology, network effects, strategic partnerships...',
        hint: 'What makes you defensible?',
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Main Wizard Component
// ---------------------------------------------------------------------------

export default function OracleWizard() {
  const navigate = useNavigate();
  const startupId = useOracleStartupId();

  const [session, setSession] = useState<OracleSession | null>(null);
  const [currentStepNum, setCurrentStepNum] = useState(1);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [explorationMode, setExplorationMode] = useState(false);
  const [generatingInsights, setGeneratingInsights] = useState(false);

  const stepDef = WIZARD_STEPS[currentStepNum - 1];
  const totalSteps = WIZARD_STEPS.length;
  const isLastStep = currentStepNum === totalSteps;

  // Initialize session
  useEffect(() => {
    if (!startupId) {
      setExplorationMode(true);
      setLoading(false);
      return;
    }

    const init = async () => {
      try {
        const sess = await getOrCreateActiveSession(startupId);
        setSession(sess);
        setCurrentStepNum(sess.current_step);
        
        // Load existing wizard data if available
        if (sess.wizard_data) {
          setFormData(sess.wizard_data);
        }
      } catch (e: any) {
        console.warn('Oracle session init failed, entering exploration mode:', e.message);
        setExplorationMode(true);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [startupId]);

  // Handle field changes
  const handleFieldChange = (fieldId: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldId]: value,
    }));
  };

  // Toggle multi-select option
  const toggleMultiSelect = (fieldId: string, option: string) => {
    setFormData(prev => {
      const current = (prev[fieldId] as string[]) || [];
      const updated = current.includes(option)
        ? current.filter(o => o !== option)
        : [...current, option];
      return { ...prev, [fieldId]: updated };
    });
  };

  // Validate current step
  const validateStep = (): boolean => {
    const requiredFields = stepDef.fields.filter(f => f.required);
    
    for (const field of requiredFields) {
      const value = formData[field.id];
      
      if (value === undefined || value === null || value === '') {
        return false;
      }
      
      if (Array.isArray(value) && value.length === 0) {
        return false;
      }
      
      if (typeof value === 'string' && value.trim() === '') {
        return false;
      }
    }
    
    return true;
  };

  // Save step and proceed
  const handleNext = async () => {
    if (explorationMode) {
      // Just navigate in exploration mode
      if (isLastStep) {
        navigate('/app/oracle');
      } else {
        setCurrentStepNum(prev => prev + 1);
      }
      return;
    }

    if (!session || !startupId) return;

    const canProceed = validateStep();
    if (!canProceed) {
      setError('Please fill in all required fields');
      setTimeout(() => setError(null), 3000);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Save current step data
      await saveWizardStep(session.id, currentStepNum, formData);

      // Generate AI insights after key steps (4, 6, 8)
      if ([4, 6, 8].includes(currentStepNum)) {
        setGeneratingInsights(true);
        try {
          await generateAIInsights(session.id, startupId, `After completing step ${currentStepNum}: ${stepDef.title}`);
          console.log('✅ Generated AI insights for step', currentStepNum);
        } catch (aiError: any) {
          console.warn('AI insight generation failed:', aiError.message);
          // Don't block progression on AI failure
        } finally {
          setGeneratingInsights(false);
        }
      }

      if (isLastStep) {
        // Complete wizard
        await completeWizard(session.id, formData);
        navigate('/app/oracle');
      } else {
        // Move to next step
        setCurrentStepNum(prev => prev + 1);
      }
    } catch (e: any) {
      setError(e.message);
      console.error('Failed to save step:', e);
    } finally {
      setSaving(false);
    }
  };

  // Go back
  const handleBack = () => {
    if (currentStepNum > 1) {
      setCurrentStepNum(prev => prev - 1);
    }
  };

  // Skip to specific step (only if already completed)
  const jumpToStep = (stepNum: number) => {
    if (explorationMode) {
      setCurrentStepNum(stepNum);
    } else if (session && stepNum <= session.current_step) {
      setCurrentStepNum(stepNum);
    }
  };

  const canProceed = validateStep();

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
        
        <StepProgress
          steps={WIZARD_STEPS}
          currentStep={currentStepNum}
          completedStep={session?.current_step || 0}
          onJumpToStep={jumpToStep}
        />
      </div>

      {/* Step Content */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Step Header */}
          <div className="text-center space-y-2">
            <span className="text-4xl">{stepDef.icon}</span>
            <h1 className="text-2xl font-bold text-white">
              {stepDef.title}
            </h1>
            <p className="text-white/50 text-sm">{stepDef.subtitle}</p>
            <p className="text-xs text-amber-400/60">
              Step {currentStepNum} of {totalSteps}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Form Fields */}
          <div className="space-y-6">
            {stepDef.fields.map((field) => (
              <FormField
                key={field.id}
                field={field}
                value={formData[field.id]}
                onChange={(value) => handleFieldChange(field.id, value)}
                onToggle={(option) => toggleMultiSelect(field.id, option)}
              />
            ))}
          </div>

          {/* AI Generation Notice */}
          {[4, 6, 8].includes(currentStepNum) && !explorationMode && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 flex items-start gap-3">
              <Brain className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-300/80">
                <strong>AI Insights:</strong> After completing this step, the Oracle will analyze your data and generate personalized insights.
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-4 border-t border-white/10">
            <button
              onClick={handleBack}
              disabled={currentStepNum === 1}
              className="flex items-center gap-2 text-white/50 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition text-sm"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>

            <button
              onClick={handleNext}
              disabled={!canProceed || saving || generatingInsights}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:bg-white/10 disabled:text-white/30 text-black font-semibold px-6 py-3 rounded-xl transition text-sm"
            >
              {saving || generatingInsights ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {generatingInsights ? 'Generating insights...' : 'Saving...'}
                </>
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
  completedStep,
  onJumpToStep,
}: {
  steps: StepDefinition[];
  currentStep: number;
  completedStep: number;
  onJumpToStep: (stepNum: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-1">
      {steps.map((step, i) => {
        const isCompleted = step.number < currentStep || step.number <= completedStep;
        const isCurrent = step.number === currentStep;
        const canClick = step.number <= completedStep + 1;

        return (
          <React.Fragment key={step.number}>
            <button
              onClick={() => canClick && onJumpToStep(step.number)}
              disabled={!canClick}
              className="flex flex-col items-center gap-1 flex-1 group disabled:cursor-not-allowed"
            >
              <div
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all
                  ${isCompleted ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30' : ''}
                  ${isCurrent ? 'bg-amber-500/20 text-amber-400 ring-2 ring-amber-500/50 scale-110' : ''}
                  ${!isCompleted && !isCurrent ? 'bg-white/5 text-white/30 ring-1 ring-white/10' : ''}
                  ${canClick ? 'group-hover:scale-105 cursor-pointer' : ''}
                `}
              >
                {isCompleted && !isCurrent ? (
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
            </button>
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
// Form Field Renderer
// ---------------------------------------------------------------------------

function FormField({
  field,
  value,
  onChange,
  onToggle,
}: {
  field: FormField;
  value: any;
  onChange: (value: any) => void;
  onToggle: (option: string) => void;
}) {
  const selectedArray = Array.isArray(value) ? value : [];

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-white/90">
        {field.label}
        {field.required && <span className="text-amber-400 ml-1">*</span>}
      </label>
      {field.hint && (
        <p className="text-xs text-white/40">{field.hint}</p>
      )}

      {/* Text Input */}
      {field.type === 'text' && (
        <input
          type="text"
          value={String(value || '')}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/30 transition"
        />
      )}

      {/* Number Input */}
      {field.type === 'number' && (
        <input
          type="number"
          value={value || ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : '')}
          placeholder={field.placeholder}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/30 transition"
        />
      )}

      {/* URL Input */}
      {field.type === 'url' && (
        <input
          type="url"
          value={String(value || '')}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/30 transition"
        />
      )}

      {/* Textarea */}
      {field.type === 'textarea' && (
        <textarea
          value={String(value || '')}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          placeholder={field.placeholder}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/30 transition resize-none"
        />
      )}

      {/* Select (Single Choice) */}
      {field.type === 'select' && (
        <div className="flex flex-wrap gap-2">
          {field.options?.map((option) => (
            <button
              key={option}
              onClick={() => onChange(option)}
              className={`
                px-4 py-2 rounded-xl text-sm transition border
                ${value === option
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 font-medium'
                  : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white/80'}
              `}
            >
              {option}
            </button>
          ))}
        </div>
      )}

      {/* Multi-Select */}
      {field.type === 'multi-select' && (
        <div className="flex flex-wrap gap-2">
          {field.options?.map((option) => (
            <button
              key={option}
              onClick={() => onToggle(option)}
              className={`
                px-4 py-2 rounded-xl text-sm transition border
                ${selectedArray.includes(option)
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 font-medium'
                  : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white/80'}
              `}
            >
              {selectedArray.includes(option) && <span className="mr-1">✓</span>}
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
