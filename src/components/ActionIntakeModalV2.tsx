/**
 * ActionIntakeModal v2
 * 
 * "Report an Action" modal for founders to submit actions.
 * Matches the canonical verification pipeline spec.
 * 
 * Features:
 * - Action type selection with icons
 * - Impact guess (low/medium/high)
 * - Structured fields based on action type
 * - Evidence attachment option
 * - Provisional lift preview
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { 
  X, 
  Calendar,
  DollarSign,
  Users,
  Rocket,
  Newspaper,
  Handshake,
  TrendingUp,
  MessageSquare,
  MoreHorizontal,
  Link2,
  Upload,
  Zap,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  Loader2
} from 'lucide-react';
import type { 
  ActionType, 
  ImpactGuess, 
  ActionFields,
  VerificationRequirement 
} from '@/types/verification';

// ============================================================================
// TYPES
// ============================================================================

interface ActionIntakeModalProps {
  startupId: string;
  startupName?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (action: any) => void;
}

interface ActionTypeConfig {
  type: ActionType;
  label: string;
  icon: React.ReactNode;
  description: string;
  fields: Array<keyof ActionFields>;
}

interface PreviewData {
  provisional: {
    deltaSignal: number;
    deltaGod: number;
    newSignal: number;
    newGod: number;
    tier: string;
    multiplier: number;
    cap: string;
  };
  potential: {
    deltaSignal: number;
    deltaGod: number;
    newSignal: number;
    newGod: number;
    tier: string;
    multiplier: number;
    unlockMessage: string;
  };
  verificationPlan: {
    requirements: Array<{kind: string; boostAmount?: number; provider?: string; doc?: string}>;
    totalRequirements: number;
    estimatedTimeToVerify: string;
  };
  feature: {
    id: string;
    label: string;
    weight: number;
    impactCategory: string;
  };
}

// ============================================================================
// CONSTANTS
// ============================================================================

const ACTION_TYPES: ActionTypeConfig[] = [
  {
    type: 'revenue_change',
    label: 'Revenue Change',
    icon: <DollarSign className="w-5 h-5" />,
    description: 'MRR/ARR increase or new customer',
    fields: ['mrrDeltaUsd', 'customerName']
  },
  {
    type: 'customer_closed',
    label: 'Customer Closed',
    icon: <CheckCircle className="w-5 h-5" />,
    description: 'New signed contract or deal',
    fields: ['customerName', 'amount', 'seats']
  },
  {
    type: 'product_release',
    label: 'Product Release',
    icon: <Rocket className="w-5 h-5" />,
    description: 'Launch, feature, or major update',
    fields: ['url', 'repo']
  },
  {
    type: 'hiring',
    label: 'Hiring',
    icon: <Users className="w-5 h-5" />,
    description: 'New team member joined',
    fields: ['seats', 'url']
  },
  {
    type: 'press',
    label: 'Press/Media',
    icon: <Newspaper className="w-5 h-5" />,
    description: 'Article, interview, or mention',
    fields: ['url']
  },
  {
    type: 'partnership',
    label: 'Partnership',
    icon: <Handshake className="w-5 h-5" />,
    description: 'Strategic partnership announced',
    fields: ['customerName', 'url']
  },
  {
    type: 'fundraising',
    label: 'Fundraising',
    icon: <TrendingUp className="w-5 h-5" />,
    description: 'Funding round or investment',
    fields: ['amount', 'currency']
  },
  {
    type: 'investor_meeting',
    label: 'Investor Meeting',
    icon: <MessageSquare className="w-5 h-5" />,
    description: 'VC meeting or pitch',
    fields: ['customerName']
  },
  {
    type: 'other',
    label: 'Other',
    icon: <MoreHorizontal className="w-5 h-5" />,
    description: 'Other notable milestone',
    fields: []
  }
];

const IMPACT_OPTIONS: { value: ImpactGuess; label: string; description: string; color: string }[] = [
  { value: 'low', label: 'Low', description: 'Minor update', color: 'gray' },
  { value: 'medium', label: 'Medium', description: 'Meaningful progress', color: 'blue' },
  { value: 'high', label: 'High', description: 'Major milestone', color: 'indigo' }
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ActionIntakeModalV2: React.FC<ActionIntakeModalProps> = ({
  startupId,
  startupName,
  isOpen,
  onClose,
  onSuccess
}) => {
  // Form state
  const [selectedType, setSelectedType] = useState<ActionType | null>(null);
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [occurredAt, setOccurredAt] = useState(new Date().toISOString().split('T')[0]);
  const [impactGuess, setImpactGuess] = useState<ImpactGuess>('medium');
  const [fields, setFields] = useState<ActionFields>({});
  
  // UI state
  const [step, setStep] = useState<'type' | 'details' | 'impact' | 'submitting' | 'success'>('type');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  
  // Preview state
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewAbort = useRef<AbortController | null>(null);
  const previewDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch preview from server (debounced)
  const fetchPreview = useCallback(async (type: ActionType, impact: ImpactGuess, flds: ActionFields) => {
    // Cancel any pending requests
    if (previewAbort.current) {
      previewAbort.current.abort();
    }
    if (previewDebounce.current) {
      clearTimeout(previewDebounce.current);
    }
    
    previewDebounce.current = setTimeout(async () => {
      setPreviewLoading(true);
      setPreviewError(null);
      
      previewAbort.current = new AbortController();
      
      try {
        const response = await fetch('/api/actions/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            startupId,
            type,
            impactGuess: impact,
            fields: Object.keys(flds).length > 0 ? flds : undefined
          }),
          signal: previewAbort.current.signal
        });
        
        const json = await response.json();
        
        if (json.ok && json.data) {
          setPreview(json.data);
        } else {
          setPreviewError('Preview unavailable');
        }
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setPreviewError('Preview unavailable');
        }
      } finally {
        setPreviewLoading(false);
      }
    }, 300); // 300ms debounce
  }, [startupId]);

  // Fetch preview when entering impact step or changing impactGuess
  useEffect(() => {
    if (step === 'impact' && selectedType) {
      fetchPreview(selectedType, impactGuess, fields);
    }
    return () => {
      if (previewDebounce.current) clearTimeout(previewDebounce.current);
      if (previewAbort.current) previewAbort.current.abort();
    };
  }, [step, impactGuess, selectedType, fields, fetchPreview]);

  const resetForm = useCallback(() => {
    setSelectedType(null);
    setTitle('');
    setDetails('');
    setOccurredAt(new Date().toISOString().split('T')[0]);
    setImpactGuess('medium');
    setFields({});
    setStep('type');
    setError(null);
    setResult(null);
    setPreview(null);
    setPreviewLoading(false);
    setPreviewError(null);
  }, []);

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleTypeSelect = (type: ActionType) => {
    setSelectedType(type);
    setStep('details');
  };

  const handleBack = () => {
    if (step === 'details') setStep('type');
    else if (step === 'impact') setStep('details');
  };

  const handleNext = () => {
    if (step === 'details') {
      if (!title.trim()) {
        setError('Please enter a title');
        return;
      }
      setError(null);
      setStep('impact');
    }
  };

  const handleSubmit = async () => {
    if (!selectedType) return;
    
    setStep('submitting');
    setError(null);

    try {
      // Use canonical endpoint
      const response = await fetch('/api/actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          startupId,
          type: selectedType,
          title,
          details: details || undefined,
          occurredAt: new Date(occurredAt).toISOString(),
          impactGuess,
          fields: Object.keys(fields).length > 0 ? fields : undefined
        })
      });

      const json = await response.json();

      if (!response.ok || !json.ok) {
        throw new Error(json.error?.message || 'Failed to submit action');
      }

      setResult(json.data);
      setStep('success');
      onSuccess?.(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStep('impact');
    }
  };

  const updateField = (key: keyof ActionFields, value: any) => {
    setFields(prev => ({ ...prev, [key]: value }));
  };

  if (!isOpen) return null;

  const selectedTypeConfig = ACTION_TYPES.find(t => t.type === selectedType);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-white dark:bg-gray-900 rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Report an Action
          </h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Step: Type Selection */}
          {step === 'type' && (
            <div>
              <p className="text-sm text-gray-500 mb-4">
                What kind of action are you reporting?
              </p>
              <div className="grid grid-cols-3 gap-2">
                {ACTION_TYPES.map(config => (
                  <button
                    key={config.type}
                    onClick={() => handleTypeSelect(config.type)}
                    className="flex flex-col items-center gap-2 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-all text-center"
                  >
                    <div className="text-indigo-600 dark:text-indigo-400">
                      {config.icon}
                    </div>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      {config.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step: Details */}
          {step === 'details' && selectedTypeConfig && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                <div className="p-1.5 rounded-md bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400">
                  {selectedTypeConfig.icon}
                </div>
                <span>{selectedTypeConfig.label}</span>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder={`e.g., ${selectedType === 'revenue_change' ? 'MRR +$12k from ACME' : 'Describe your action...'}`}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* When */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  When did this happen?
                </label>
                <input
                  type="date"
                  value={occurredAt}
                  onChange={e => setOccurredAt(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* Type-specific fields */}
              {selectedTypeConfig.fields.includes('mrrDeltaUsd') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    MRR Change ($)
                  </label>
                  <input
                    type="number"
                    value={fields.mrrDeltaUsd || ''}
                    onChange={e => updateField('mrrDeltaUsd', parseInt(e.target.value) || undefined)}
                    placeholder="e.g., 12000"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              )}

              {selectedTypeConfig.fields.includes('customerName') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Customer/Partner Name
                  </label>
                  <input
                    type="text"
                    value={fields.customerName || ''}
                    onChange={e => updateField('customerName', e.target.value || undefined)}
                    placeholder="e.g., ACME Corp"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              )}

              {selectedTypeConfig.fields.includes('amount') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Amount ($)
                  </label>
                  <input
                    type="number"
                    value={fields.amount || ''}
                    onChange={e => updateField('amount', parseInt(e.target.value) || undefined)}
                    placeholder="e.g., 500000"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              )}

              {selectedTypeConfig.fields.includes('url') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    URL
                  </label>
                  <input
                    type="url"
                    value={fields.url || ''}
                    onChange={e => updateField('url', e.target.value || undefined)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              )}

              {selectedTypeConfig.fields.includes('seats') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {selectedType === 'hiring' ? 'Number of hires' : 'Seats/Units'}
                  </label>
                  <input
                    type="number"
                    value={fields.seats || ''}
                    onChange={e => updateField('seats', parseInt(e.target.value) || undefined)}
                    placeholder="e.g., 3"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              )}

              {/* Details */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Details (optional)
                </label>
                <textarea
                  value={details}
                  onChange={e => setDetails(e.target.value)}
                  placeholder="Any additional context..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-600 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Step: Impact */}
          {step === 'impact' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                How significant is this action?
              </p>

              <div className="space-y-2">
                {IMPACT_OPTIONS.map(option => (
                  <button
                    key={option.value}
                    onClick={() => setImpactGuess(option.value)}
                    className={`w-full flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
                      impactGuess === option.value
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/50'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        option.value === 'low' 
                          ? 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                          : option.value === 'medium'
                          ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                          : 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400'
                      }`}>
                        {option.value[0].toUpperCase()}
                      </div>
                      <div className="text-left">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {option.label}
                        </div>
                        <div className="text-xs text-gray-500">
                          {option.description}
                        </div>
                      </div>
                    </div>
                    {impactGuess === option.value && (
                      <CheckCircle className="w-5 h-5 text-indigo-500" />
                    )}
                  </button>
                ))}
              </div>

              {/* Provisional lift preview - from server */}
              <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                  <Zap className="w-4 h-4" />
                  <span className="text-sm font-medium">Provisional lift</span>
                  {previewLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                </div>
                
                {previewError ? (
                  <p className="text-xs text-gray-500 mt-1">
                    Preview unavailable – submit to see actual impact
                  </p>
                ) : preview ? (
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-emerald-600 dark:text-emerald-400">Signal:</span>
                      <span className="text-sm font-mono text-emerald-700 dark:text-emerald-300">
                        +{preview.provisional.deltaSignal.toFixed(2)} → {preview.provisional.newSignal.toFixed(1)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-emerald-600 dark:text-emerald-400">GOD:</span>
                      <span className="text-sm font-mono text-emerald-700 dark:text-emerald-300">
                        +{preview.provisional.deltaGod.toFixed(2)} → {preview.provisional.newGod.toFixed(1)}
                      </span>
                    </div>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                      {preview.provisional.cap}
                    </p>
                    {preview.potential && (
                      <p className="text-xs text-blue-600 dark:text-blue-400 pt-1 border-t border-emerald-200 dark:border-emerald-700">
                        Full potential: +{preview.potential.deltaSignal.toFixed(2)} Signal with evidence
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                    This action will apply a small provisional lift immediately. 
                    Verify it with evidence to unlock the full impact.
                  </p>
                )}
              </div>

              {/* Evidence CTA - show requirements from preview */}
              <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-700 dark:text-gray-300 font-medium mb-2">
                  {preview?.verificationPlan ? 'Required evidence' : 'Evidence (recommended)'}
                </p>
                {preview?.verificationPlan?.requirements?.length ? (
                  <div className="space-y-2">
                    {preview.verificationPlan.requirements.map((req, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                        {req.kind === 'connect' && (
                          <>
                            <Link2 className="w-3 h-3 text-indigo-500" />
                            <span>Connect {req.provider || 'data source'}</span>
                            {req.boostAmount && (
                              <span className="text-emerald-600 ml-auto">+{(req.boostAmount * 100).toFixed(0)}%</span>
                            )}
                          </>
                        )}
                        {req.kind === 'upload' && (
                          <>
                            <Upload className="w-3 h-3 text-indigo-500" />
                            <span>Upload {req.doc || 'document'}</span>
                            {req.boostAmount && (
                              <span className="text-emerald-600 ml-auto">+{(req.boostAmount * 100).toFixed(0)}%</span>
                            )}
                          </>
                        )}
                        {req.kind === 'review' && (
                          <>
                            <CheckCircle className="w-3 h-3 text-indigo-500" />
                            <span>Admin review</span>
                            {req.boostAmount && (
                              <span className="text-emerald-600 ml-auto">+{(req.boostAmount * 100).toFixed(0)}%</span>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                    {preview.verificationPlan.estimatedTimeToVerify && (
                      <p className="text-xs text-gray-500 pt-1 border-t border-gray-200 dark:border-gray-700">
                        Est. time: {preview.verificationPlan.estimatedTimeToVerify}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex gap-2 flex-wrap">
                    <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                      <Link2 className="w-3 h-3" />
                      Connect Stripe
                    </button>
                    <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                      <Upload className="w-3 h-3" />
                      Upload Invoice
                    </button>
                    <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                      <Link2 className="w-3 h-3" />
                      Add Link
                    </button>
                  </div>
                )}
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-600 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Step: Submitting */}
          {step === 'submitting' && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Submitting action...</p>
            </div>
          )}

          {/* Step: Success */}
          {step === 'success' && result && (
            <div className="space-y-4">
              <div className="flex flex-col items-center py-4">
                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center mb-4">
                  <CheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Action Submitted
                </h3>
                {result.delta && (
                  <div className="mt-2 text-center">
                    <p className="text-sm text-gray-500">Provisional delta:</p>
                    <p className="text-lg font-mono text-emerald-600">
                      Signal +{result.delta.deltaSignal?.toFixed(2) || '0.00'} · GOD +{result.delta.deltaGod?.toFixed(2) || '0.00'}
                    </p>
                  </div>
                )}
              </div>

              {/* Next steps */}
              <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                  Next: Verify this action
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  {result.nextSteps?.message || 'Connect a data source or upload proof to unlock the full scoring impact.'}
                </p>
                {result.nextSteps?.requirements?.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {result.nextSteps.requirements.slice(0, 3).map((req: VerificationRequirement, i: number) => (
                      <li key={i} className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                        <ArrowRight className="w-3 h-3" />
                        {req.kind === 'connect' && `Connect ${req.provider}`}
                        {req.kind === 'upload' && `Upload ${req.doc}`}
                        {req.kind === 'link' && `Add ${req.urlType} link`}
                        {req.kind === 'review' && `Admin review required`}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700">
          {step === 'type' && (
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              Cancel
            </button>
          )}

          {step === 'details' && (
            <>
              <button
                onClick={handleBack}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                Back
              </button>
              <button
                onClick={handleNext}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Next
              </button>
            </>
          )}

          {step === 'impact' && (
            <>
              <button
                onClick={handleBack}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                Submit Action
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}

          {step === 'success' && (
            <>
              <div />
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActionIntakeModalV2;
