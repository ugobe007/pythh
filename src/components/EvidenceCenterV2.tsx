/**
 * EvidenceCenter v2
 * 
 * Canonical Evidence Center panel for verification pipeline.
 * Shows connected sources, pending evidence, and conflicts.
 * 
 * Features:
 * - Connected sources with status (Stripe ✅, GA4 ⚠, GitHub ✅, Plaid ❌)
 * - Pending evidence that needs attention
 * - Conflict resolution for inconsistencies
 * - Manual evidence upload/link
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Link2,
  Upload,
  Check,
  X,
  AlertTriangle,
  Clock,
  RefreshCw,
  ChevronRight,
  ExternalLink,
  File,
  Image,
  FileText,
  DollarSign,
  BarChart2,
  GitBranch,
  Wallet,
  Users,
  List,
  FileCode,
  Loader2,
  Plus,
  AlertCircle,
  CheckCircle,
  XCircle,
  ArrowRight,
  Globe
} from 'lucide-react';
import type {
  ConnectorProvider,
  ConnectorStatus,
  EvidenceType,
  VerificationTier
} from '@/types/verification';

// ============================================================================
// TYPES
// ============================================================================

interface EvidenceCenterProps {
  startupId: string;
  onConnect?: (provider: ConnectorProvider) => void;
  onUpload?: () => void;
}

interface ConnectedSource {
  provider: ConnectorProvider;
  status: ConnectorStatus;
  lastSync: string | null;
  error: string | null;
}

interface PendingEvidence {
  actionId: string;
  actionTitle: string;
  actionType: string;
  requirements: Array<{
    kind: string;
    provider?: string;
    doc?: string;
    urlType?: string;
    satisfied: boolean;
  }>;
}

interface Conflict {
  id: string;
  actionId: string;
  actionTitle: string;
  issue: string;
  severity: 'hard' | 'soft';
  options: string[];
}

interface EvidenceCenterData {
  connectedSources: ConnectedSource[];
  pendingEvidence: PendingEvidence[];
  conflicts: Conflict[];
  stats: {
    totalEvidence: number;
    verifiedActions: number;
    pendingActions: number;
    activeConflicts: number;
  };
}

// ============================================================================
// CONSTANTS
// ============================================================================

const PROVIDER_CONFIG: Record<ConnectorProvider, { icon: React.ReactNode; label: string; description: string }> = {
  stripe: {
    icon: <DollarSign className="w-5 h-5" />,
    label: 'Stripe',
    description: 'Revenue & payment verification'
  },
  ga4: {
    icon: <BarChart2 className="w-5 h-5" />,
    label: 'Google Analytics',
    description: 'Traffic & engagement data'
  },
  github: {
    icon: <GitBranch className="w-5 h-5" />,
    label: 'GitHub',
    description: 'Code activity & releases'
  },
  plaid: {
    icon: <Wallet className="w-5 h-5" />,
    label: 'Plaid',
    description: 'Bank account verification'
  },
  hubspot: {
    icon: <Users className="w-5 h-5" />,
    label: 'HubSpot',
    description: 'CRM & customer data'
  },
  linear: {
    icon: <List className="w-5 h-5" />,
    label: 'Linear',
    description: 'Project management'
  },
  notion: {
    icon: <FileCode className="w-5 h-5" />,
    label: 'Notion',
    description: 'Documentation'
  }
};

const STATUS_CONFIG: Record<ConnectorStatus, { color: string; icon: React.ReactNode; label: string }> = {
  connected: {
    color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/50',
    icon: <Check className="w-4 h-4" />,
    label: 'Connected'
  },
  pending: {
    color: 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50',
    icon: <Clock className="w-4 h-4" />,
    label: 'Pending'
  },
  error: {
    color: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/50',
    icon: <AlertTriangle className="w-4 h-4" />,
    label: 'Error'
  },
  expired: {
    color: 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50',
    icon: <Clock className="w-4 h-4" />,
    label: 'Expired'
  },
  not_connected: {
    color: 'text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800',
    icon: <X className="w-4 h-4" />,
    label: 'Not connected'
  }
};

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

const SourceCard: React.FC<{
  source: ConnectedSource;
  startupId: string;
  onConnect?: () => void;
  onRefresh?: () => void;
}> = ({ source, startupId, onConnect, onRefresh }) => {
  const [connecting, setConnecting] = useState(false);
  const config = PROVIDER_CONFIG[source.provider];
  const statusConfig = STATUS_CONFIG[source.status];

  const handleConnect = async () => {
    // Only supported providers for OAuth
    const oauthProviders = ['stripe', 'github', 'ga4'];
    
    if (oauthProviders.includes(source.provider)) {
      setConnecting(true);
      try {
        const response = await fetch(`/api/connectors/${startupId}/init/${source.provider}`);
        const json = await response.json();
        
        if (json.ok && json.data.authUrl) {
          // Redirect to OAuth provider
          window.location.href = json.data.authUrl;
        } else if (json.error?.code === 'NOT_CONFIGURED') {
          // OAuth not configured - show message
          alert(`${config.label} OAuth is not configured. Contact support to enable.`);
        } else {
          console.error('OAuth init failed:', json);
          alert(`Failed to connect ${config.label}`);
        }
      } catch (err) {
        console.error('OAuth init error:', err);
        alert(`Failed to connect ${config.label}`);
      } finally {
        setConnecting(false);
      }
    } else {
      // For non-OAuth providers, call parent handler
      onConnect?.();
    }
  };

  return (
    <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${statusConfig.color}`}>
          {config.icon}
        </div>
        <div>
          <div className="font-medium text-gray-900 dark:text-white text-sm">
            {config.label}
          </div>
          <div className="text-xs text-gray-500">
            {source.status === 'connected' && source.lastSync
              ? `Last sync: ${new Date(source.lastSync).toLocaleDateString()}`
              : config.description}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {source.status === 'connected' && (
          <>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              ✓ Connected
            </span>
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </>
        )}
        {source.status === 'pending' && (
          <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
            ⏳ Pending
          </span>
        )}
        {source.status === 'error' && (
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="text-xs text-red-600 dark:text-red-400 font-medium hover:underline disabled:opacity-50"
          >
            {connecting ? 'Connecting...' : 'Reconnect'}
          </button>
        )}
        {source.status === 'not_connected' && (
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="px-3 py-1.5 text-xs font-medium bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            {connecting ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Connecting...
              </>
            ) : (
              'Connect'
            )}
          </button>
        )}
      </div>
    </div>
  );
};

const PendingEvidenceCard: React.FC<{
  item: PendingEvidence;
  onAddEvidence?: (actionId: string) => void;
}> = ({ item, onAddEvidence }) => {
  const unsatisfied = item.requirements.filter(r => !r.satisfied);
  const satisfied = item.requirements.filter(r => r.satisfied);

  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-amber-200 dark:border-amber-800">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="font-medium text-gray-900 dark:text-white text-sm">
            {item.actionTitle}
          </div>
          <div className="text-xs text-gray-500">
            {item.actionType.replace(/_/g, ' ')}
          </div>
        </div>
        <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 text-xs">
          <AlertTriangle className="w-3 h-3" />
          {unsatisfied.length} needed
        </div>
      </div>

      <div className="space-y-1 mt-3">
        {item.requirements.map((req, i) => (
          <div
            key={i}
            className={`flex items-center gap-2 text-xs ${
              req.satisfied
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            {req.satisfied ? (
              <CheckCircle className="w-3 h-3" />
            ) : (
              <div className="w-3 h-3 rounded-full border border-current" />
            )}
            {req.kind === 'connect' && `Connect ${req.provider}`}
            {req.kind === 'upload' && `Upload ${req.doc}`}
            {req.kind === 'link' && `Add ${req.urlType} link`}
            {req.kind === 'review' && 'Manual review'}
          </div>
        ))}
      </div>

      {onAddEvidence && unsatisfied.length > 0 && (
        <button
          onClick={() => onAddEvidence(item.actionId)}
          className="mt-3 w-full flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors"
        >
          <Plus className="w-3 h-3" />
          Add Evidence
        </button>
      )}
    </div>
  );
};

const ConflictCard: React.FC<{
  conflict: Conflict;
  onResolve?: (conflictId: string, choice: string) => void;
}> = ({ conflict, onResolve }) => {
  const [resolving, setResolving] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const handleResolve = async (option: string) => {
    if (!onResolve) return;
    setResolving(true);
    setSelectedOption(option);
    try {
      await onResolve(conflict.id, option);
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className={`p-4 bg-white dark:bg-gray-800 rounded-lg border ${
      conflict.severity === 'hard'
        ? 'border-red-300 dark:border-red-700'
        : 'border-amber-200 dark:border-amber-800'
    }`}>
      <div className="flex items-start gap-3">
        <div className={`p-1.5 rounded ${
          conflict.severity === 'hard'
            ? 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400'
            : 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400'
        }`}>
          <AlertCircle className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <div className="font-medium text-gray-900 dark:text-white text-sm">
            {conflict.actionTitle}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {conflict.issue}
          </div>

          {conflict.options.length > 0 && onResolve && (
            <div className="mt-3 flex flex-wrap gap-2">
              {conflict.options.map(option => (
                <button
                  key={option}
                  onClick={() => handleResolve(option)}
                  disabled={resolving}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    resolving && selectedOption === option
                      ? 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {resolving && selectedOption === option ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    option
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const StatsBar: React.FC<{ stats: EvidenceCenterData['stats'] }> = ({ stats }) => {
  return (
    <div className="grid grid-cols-4 gap-3">
      <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="text-2xl font-bold text-gray-900 dark:text-white">
          {stats.totalEvidence}
        </div>
        <div className="text-xs text-gray-500">Evidence</div>
      </div>
      <div className="text-center p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg">
        <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
          {stats.verifiedActions}
        </div>
        <div className="text-xs text-emerald-600 dark:text-emerald-400">Verified</div>
      </div>
      <div className="text-center p-3 bg-amber-50 dark:bg-amber-900/30 rounded-lg">
        <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
          {stats.pendingActions}
        </div>
        <div className="text-xs text-amber-600 dark:text-amber-400">Pending</div>
      </div>
      <div className="text-center p-3 bg-red-50 dark:bg-red-900/30 rounded-lg">
        <div className="text-2xl font-bold text-red-600 dark:text-red-400">
          {stats.activeConflicts}
        </div>
        <div className="text-xs text-red-600 dark:text-red-400">Conflicts</div>
      </div>
    </div>
  );
};

// ============================================================================
// EVIDENCE UPLOAD MODAL
// ============================================================================

interface EvidenceUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  startupId: string;
  actionId?: string;
  actionTitle?: string;
  onSuccess: () => void;
  initialMode?: 'upload' | 'link';
}

const EvidenceUploadModal: React.FC<EvidenceUploadModalProps> = ({
  isOpen,
  onClose,
  startupId,
  actionId,
  actionTitle,
  onSuccess,
  initialMode = 'upload'
}) => {
  const [mode, setMode] = useState<'upload' | 'link'>(initialMode);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // Upload mode state
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<string>('invoice');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Link mode state
  const [url, setUrl] = useState('');
  const [urlType, setUrlType] = useState<string>('press');
  
  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setFile(null);
      setUrl('');
      setError(null);
      setSuccess(false);
    }
  }, [isOpen, initialMode]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file size (max 10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB');
        return;
      }
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    
    try {
      let ref: Record<string, unknown>;
      let evidenceType: string;
      
      if (mode === 'upload') {
        if (!file) {
          setError('Please select a file');
          setSubmitting(false);
          return;
        }
        
        // For now, we'll store file info in ref (in a real app, upload to S3 first)
        // The endpoint expects { url, filename, size }
        const fakeUrl = `file://${file.name}`; // Placeholder - real impl would upload to S3
        
        ref = {
          url: fakeUrl,
          filename: file.name,
          size: file.size,
          mimeType: file.type,
          docType
        };
        evidenceType = 'document_upload';
      } else {
        if (!url.trim()) {
          setError('Please enter a URL');
          setSubmitting(false);
          return;
        }
        
        // Validate URL
        try {
          new URL(url);
        } catch {
          setError('Please enter a valid URL');
          setSubmitting(false);
          return;
        }
        
        ref = {
          url: url.trim(),
          urlType
        };
        evidenceType = 'public_link';
      }
      
      const response = await fetch('/api/evidence/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startupId,
          actionId: actionId || undefined,
          type: evidenceType,
          ref
        })
      });
      
      const json = await response.json();
      
      if (!response.ok || !json.ok) {
        throw new Error(json.error?.message || 'Failed to add evidence');
      }
      
      setSuccess(true);
      
      // Show success briefly, then close
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Add Evidence
            {actionTitle && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                for "{actionTitle}"
              </span>
            )}
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setMode('upload')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              mode === 'upload'
                ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Upload className="w-4 h-4" />
            Upload Document
          </button>
          <button
            onClick={() => setMode('link')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              mode === 'link'
                ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Globe className="w-4 h-4" />
            Add Link
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {success ? (
            <div className="flex flex-col items-center py-8">
              <CheckCircle className="w-12 h-12 text-emerald-500 mb-3" />
              <p className="text-lg font-medium text-gray-900 dark:text-white">
                Evidence Added!
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Verification updated
              </p>
            </div>
          ) : (
            <>
              {mode === 'upload' ? (
                <>
                  {/* File upload */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleFileChange}
                      accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.csv"
                      className="hidden"
                    />
                    {file ? (
                      <div className="flex flex-col items-center">
                        <FileText className="w-10 h-10 text-indigo-500 mb-2" />
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {file.name}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {(file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Click to upload or drag and drop
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          PDF, PNG, JPG, DOC, XLS (max 10MB)
                        </p>
                      </>
                    )}
                  </div>

                  {/* Document type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Document Type
                    </label>
                    <select
                      value={docType}
                      onChange={(e) => setDocType(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="invoice">Invoice</option>
                      <option value="contract">Contract</option>
                      <option value="screenshot">Screenshot</option>
                      <option value="report">Report</option>
                      <option value="analytics">Analytics Export</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </>
              ) : (
                <>
                  {/* URL input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      URL
                    </label>
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* URL type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Link Type
                    </label>
                    <select
                      value={urlType}
                      onChange={(e) => setUrlType(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="press">Press/Article</option>
                      <option value="social">Social Media</option>
                      <option value="product">Product Page</option>
                      <option value="demo">Demo/Video</option>
                      <option value="github">GitHub Repo</option>
                      <option value="linkedin">LinkedIn Profile</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </>
              )}

              {/* Error message */}
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/30 rounded-lg text-red-600 dark:text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!success && (
          <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || (mode === 'upload' && !file) || (mode === 'link' && !url.trim())}
              className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Add Evidence
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const EvidenceCenterV2: React.FC<EvidenceCenterProps> = ({
  startupId,
  onConnect,
  onUpload
}) => {
  const [data, setData] = useState<EvidenceCenterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'sources' | 'pending' | 'conflicts'>('sources');
  
  // Evidence upload modal state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadModalActionId, setUploadModalActionId] = useState<string | undefined>();
  const [uploadModalActionTitle, setUploadModalActionTitle] = useState<string | undefined>();
  const [uploadModalMode, setUploadModalMode] = useState<'upload' | 'link'>('upload');
  
  // Connection success toast
  const [connectionToast, setConnectionToast] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Use canonical endpoint
      const response = await fetch(`/api/evidence-center/${startupId}`);

      const json = await response.json();

      if (!response.ok || !json.ok) {
        throw new Error(json.error?.message || 'Failed to load evidence center');
      }

      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [startupId]);

  useEffect(() => {
    fetchData();
    
    // Check for OAuth callback params
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('connected');
    const oauthError = params.get('error');
    
    if (connected) {
      setConnectionToast(`${connected.charAt(0).toUpperCase() + connected.slice(1)} connected successfully!`);
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
      // Auto-hide toast after 5s
      setTimeout(() => setConnectionToast(null), 5000);
    } else if (oauthError) {
      setConnectionToast(`Connection failed: ${oauthError}`);
      window.history.replaceState({}, '', window.location.pathname);
      setTimeout(() => setConnectionToast(null), 5000);
    }
  }, [fetchData]);

  const handleResolveConflict = async (conflictId: string, choice: string) => {
    try {
      const conflict = data?.conflicts.find(c => c.id === conflictId);
      if (!conflict) return;

      // Use canonical endpoint
      const response = await fetch(`/api/actions/${conflict.actionId}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          choice,
          note: `Resolved via Evidence Center: ${choice}`
        })
      });

      if (response.ok) {
        await fetchData(); // Refresh data
      }
    } catch (err) {
      console.error('Failed to resolve conflict:', err);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
        </div>
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-6">
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {error || 'Failed to load evidence center'}
          </p>
          <button
            onClick={fetchData}
            className="mt-3 text-sm text-indigo-600 hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'sources' as const, label: 'Sources', count: data.connectedSources.length },
    { id: 'pending' as const, label: 'Pending', count: data.stats.pendingActions },
    { id: 'conflicts' as const, label: 'Conflicts', count: data.stats.activeConflicts }
  ];

  return (
    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl relative">
      {/* Connection Toast */}
      {connectionToast && (
        <div className={`absolute top-2 left-2 right-2 z-10 flex items-center gap-2 p-3 rounded-lg text-sm font-medium ${
          connectionToast.includes('failed') || connectionToast.includes('error')
            ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
            : 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300'
        }`}>
          {connectionToast.includes('failed') || connectionToast.includes('error') ? (
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
          ) : (
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
          )}
          {connectionToast}
          <button
            onClick={() => setConnectionToast(null)}
            className="ml-auto hover:opacity-70"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Evidence Center
        </h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Connect sources and verify your actions
        </p>
      </div>

      {/* Stats */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <StatsBar stats={data.stats} />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors relative ${
              activeTab === tab.id
                ? 'text-indigo-600 dark:text-indigo-400'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${
                tab.id === 'conflicts' && tab.count > 0
                  ? 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400'
                  : tab.id === 'pending' && tab.count > 0
                  ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}>
                {tab.count}
              </span>
            )}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Sources Tab */}
        {activeTab === 'sources' && (
          <>
            {data.connectedSources.map(source => (
              <SourceCard
                key={source.provider}
                source={source}
                startupId={startupId}
                onConnect={() => onConnect?.(source.provider)}
              />
            ))}

            {/* Quick actions */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  setUploadModalActionId(undefined);
                  setUploadModalActionTitle(undefined);
                  setUploadModalMode('upload');
                  setUploadModalOpen(true);
                }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <Upload className="w-4 h-4" />
                Upload Document
              </button>
              <button
                onClick={() => {
                  setUploadModalActionId(undefined);
                  setUploadModalActionTitle(undefined);
                  setUploadModalMode('link');
                  setUploadModalOpen(true);
                }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <Link2 className="w-4 h-4" />
                Add Link
              </button>
            </div>
          </>
        )}

        {/* Pending Tab */}
        {activeTab === 'pending' && (
          <>
            {data.pendingEvidence.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  All actions have sufficient evidence
                </p>
              </div>
            ) : (
              data.pendingEvidence.map(item => (
                <PendingEvidenceCard
                  key={item.actionId}
                  item={item}
                  onAddEvidence={(actionId) => {
                    setUploadModalActionId(actionId);
                    setUploadModalActionTitle(item.actionTitle);
                    setUploadModalMode('upload');
                    setUploadModalOpen(true);
                  }}
                />
              ))
            )}
          </>
        )}

        {/* Conflicts Tab */}
        {activeTab === 'conflicts' && (
          <>
            {data.conflicts.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  No conflicts detected
                </p>
              </div>
            ) : (
              data.conflicts.map(conflict => (
                <ConflictCard
                  key={conflict.id}
                  conflict={conflict}
                  onResolve={handleResolveConflict}
                />
              ))
            )}
          </>
        )}
      </div>

      {/* Evidence Upload Modal */}
      <EvidenceUploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        startupId={startupId}
        actionId={uploadModalActionId}
        actionTitle={uploadModalActionTitle}
        initialMode={uploadModalMode}
        onSuccess={() => {
          fetchData(); // Refresh evidence center
          onUpload?.(); // Notify parent (e.g., to refresh scorecard)
        }}
      />
    </div>
  );
};

export default EvidenceCenterV2;
