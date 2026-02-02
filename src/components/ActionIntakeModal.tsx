/**
 * ActionIntakeModal Component
 * 
 * Founder "Report an Action" intake form.
 * Fast lane for submitting actions that create provisional score changes.
 * 
 * Features:
 * - Action type selection (Revenue, Product, Hiring, etc.)
 * - Impact self-assessment (Low/Medium/High)
 * - Evidence upload/connection options
 * - Clear feedback about provisional vs verified impact
 */

import React, { useState } from 'react';
import {
  X,
  DollarSign,
  Code,
  Users,
  Briefcase,
  Handshake,
  Newspaper,
  Trophy,
  CircleDot,
  Upload,
  Link2,
  Mail,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

type ActionCategory = 'revenue' | 'product' | 'hiring' | 'funding' | 'partnership' | 'press' | 'milestone' | 'other';
type ImpactLevel = 'low' | 'medium' | 'high';

interface ActionFormData {
  category: ActionCategory;
  title: string;
  description: string;
  actionDate: string;
  impactGuess: ImpactLevel;
}

interface ActionSubmitResult {
  actionEvent: {
    id: string;
    provisionalDelta: number;
    verificationDeadline: string;
    affectedFeatures: string[];
  };
  snapshot: {
    signalScore: number;
    deltaTotal: number;
  };
  nextSteps: {
    message: string;
    verifyPath: string;
    connectPath: string;
  };
}

interface ActionIntakeModalProps {
  startupId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: ActionSubmitResult) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const CATEGORIES: { id: ActionCategory; label: string; icon: React.ReactNode; description: string }[] = [
  { id: 'revenue', label: 'Revenue', icon: <DollarSign className="w-5 h-5" />, description: 'New customer, MRR increase, contract signed' },
  { id: 'product', label: 'Product', icon: <Code className="w-5 h-5" />, description: 'Feature shipped, v2 launched, major update' },
  { id: 'hiring', label: 'Hiring', icon: <Users className="w-5 h-5" />, description: 'New hire, key executive, team growth' },
  { id: 'funding', label: 'Funding', icon: <Briefcase className="w-5 h-5" />, description: 'Investor meeting, term sheet, round closed' },
  { id: 'partnership', label: 'Partnership', icon: <Handshake className="w-5 h-5" />, description: 'Strategic partner, integration, distribution deal' },
  { id: 'press', label: 'Press', icon: <Newspaper className="w-5 h-5" />, description: 'Media coverage, PR mention, award' },
  { id: 'milestone', label: 'Milestone', icon: <Trophy className="w-5 h-5" />, description: 'User milestone, revenue target, product launch' },
  { id: 'other', label: 'Other', icon: <CircleDot className="w-5 h-5" />, description: 'Other significant event' }
];

const IMPACT_LEVELS: { id: ImpactLevel; label: string; description: string; color: string }[] = [
  { id: 'low', label: 'Low', description: 'Minor update, internal progress', color: 'bg-gray-100 border-gray-300 text-gray-700' },
  { id: 'medium', label: 'Medium', description: 'Notable milestone, external visibility', color: 'bg-blue-50 border-blue-300 text-blue-700' },
  { id: 'high', label: 'High', description: 'Major breakthrough, significant impact', color: 'bg-indigo-50 border-indigo-300 text-indigo-700' }
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ActionIntakeModal: React.FC<ActionIntakeModalProps> = ({
  startupId,
  isOpen,
  onClose,
  onSuccess
}) => {
  const [step, setStep] = useState<'form' | 'verify' | 'success'>('form');
  const [formData, setFormData] = useState<ActionFormData>({
    category: 'product',
    title: '',
    description: '',
    actionDate: new Date().toISOString().split('T')[0],
    impactGuess: 'medium'
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ActionSubmitResult | null>(null);
  
  if (!isOpen) return null;
  
  const handleCategorySelect = (category: ActionCategory) => {
    setFormData(prev => ({ ...prev, category }));
  };
  
  const handleImpactSelect = (impact: ImpactLevel) => {
    setFormData(prev => ({ ...prev, impactGuess: impact }));
  };
  
  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      setError('Please provide a title for this action');
      return;
    }
    
    setSubmitting(true);
    setError(null);
    
    try {
      const response = await fetch('/api/v1/actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Pythh-Key': localStorage.getItem('pythh_api_key') || ''
        },
        body: JSON.stringify({
          startupId,
          category: formData.category,
          title: formData.title,
          description: formData.description,
          actionDate: formData.actionDate,
          impactGuess: formData.impactGuess
        })
      });
      
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error?.message || 'Failed to submit action');
      }
      
      const data = await response.json();
      setResult(data.data);
      setStep('verify');
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };
  
  const handleVerifyLater = () => {
    setStep('success');
    onSuccess?.(result!);
  };
  
  const handleClose = () => {
    setStep('form');
    setFormData({
      category: 'product',
      title: '',
      description: '',
      actionDate: new Date().toISOString().split('T')[0],
      impactGuess: 'medium'
    });
    setError(null);
    setResult(null);
    onClose();
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {step === 'form' && 'Report an Action'}
            {step === 'verify' && 'Verify Your Action'}
            {step === 'success' && 'Action Recorded'}
          </h2>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-4">
          {step === 'form' && (
            <div className="space-y-6">
              {/* Category Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Action Type
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => handleCategorySelect(cat.id)}
                      className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1 transition-all ${
                        formData.category === cat.id
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                      }`}
                      title={cat.description}
                    >
                      <span className={formData.category === cat.id ? 'text-indigo-600' : 'text-gray-500'}>
                        {cat.icon}
                      </span>
                      <span className={`text-xs font-medium ${
                        formData.category === cat.id ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-600 dark:text-gray-400'
                      }`}>
                        {cat.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder={CATEGORIES.find(c => c.id === formData.category)?.description || 'What happened?'}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              
              {/* Details */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Details <span className="text-gray-400">(optional)</span>
                </label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Add more context..."
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                />
              </div>
              
              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  When
                </label>
                <input
                  type="date"
                  value={formData.actionDate}
                  onChange={e => setFormData(prev => ({ ...prev, actionDate: e.target.value }))}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              
              {/* Impact Guess */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Estimated Impact
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {IMPACT_LEVELS.map(level => (
                    <button
                      key={level.id}
                      onClick={() => handleImpactSelect(level.id)}
                      className={`p-3 rounded-lg border-2 text-center transition-all ${
                        formData.impactGuess === level.id
                          ? level.color + ' border-current'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-sm font-medium">{level.label}</span>
                      <p className="text-xs mt-1 text-gray-500">{level.description}</p>
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Error */}
              {error && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 flex items-center gap-2 text-red-700 dark:text-red-300">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">{error}</span>
                </div>
              )}
              
              {/* Info box */}
              <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800">
                <p className="text-sm text-indigo-700 dark:text-indigo-300">
                  This will apply a <strong>provisional score change</strong> now.
                  Verifying with evidence upgrades the impact automatically.
                </p>
              </div>
            </div>
          )}
          
          {step === 'verify' && result && (
            <div className="space-y-6">
              {/* Success indicator */}
              <div className="text-center py-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center mb-4">
                  <CheckCircle className="w-8 h-8 text-emerald-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Action Recorded!
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Provisional +{result.actionEvent.provisionalDelta.toFixed(1)} applied
                </p>
              </div>
              
              {/* Verify options */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Verify for Full Impact
                </h4>
                <div className="space-y-2">
                  <button
                    className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-3 transition-colors"
                    onClick={() => window.location.href = result.nextSteps.connectPath}
                  >
                    <Link2 className="w-5 h-5 text-indigo-600" />
                    <div className="text-left">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">Connect Integration</p>
                      <p className="text-xs text-gray-500">Stripe, GitHub, GA4, etc. (best verification)</p>
                    </div>
                  </button>
                  <button
                    className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-3 transition-colors"
                    onClick={() => window.location.href = result.nextSteps.verifyPath}
                  >
                    <Upload className="w-5 h-5 text-indigo-600" />
                    <div className="text-left">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">Upload Document</p>
                      <p className="text-xs text-gray-500">Invoice, contract, screenshot (PDF)</p>
                    </div>
                  </button>
                  <button
                    className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-3 transition-colors"
                  >
                    <Mail className="w-5 h-5 text-indigo-600" />
                    <div className="text-left">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">Add Reference</p>
                      <p className="text-xs text-gray-500">Customer email, investor intro, etc.</p>
                    </div>
                  </button>
                </div>
              </div>
              
              {/* Deadline notice */}
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Verify by <strong>{new Date(result.actionEvent.verificationDeadline).toLocaleDateString()}</strong> to keep the full lift.
                  Unverified actions have capped influence.
                </p>
              </div>
            </div>
          )}
          
          {step === 'success' && result && (
            <div className="text-center py-8">
              <div className="w-20 h-20 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center mb-4">
                <CheckCircle className="w-10 h-10 text-emerald-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                All Set!
              </h3>
              <p className="text-gray-500">
                Your action has been recorded with a provisional +{result.actionEvent.provisionalDelta.toFixed(1)} impact.
              </p>
              <p className="text-sm text-gray-400 mt-2">
                New Signal Score: <strong className="text-indigo-600">{result.snapshot.signalScore.toFixed(1)}</strong>
              </p>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
          {step === 'form' && (
            <>
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !formData.title.trim()}
                className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium flex items-center gap-2 transition-colors"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Submit
              </button>
            </>
          )}
          
          {step === 'verify' && (
            <button
              onClick={handleVerifyLater}
              className="px-6 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium transition-colors"
            >
              Verify Later
            </button>
          )}
          
          {step === 'success' && (
            <button
              onClick={handleClose}
              className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActionIntakeModal;
