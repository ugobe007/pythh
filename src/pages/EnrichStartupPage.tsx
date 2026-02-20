import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, AlertCircle, TrendingUp, Loader2 } from 'lucide-react';
import axios from 'axios';

interface StartupEnrichmentData {
  id: string;
  name: string;
  website?: string;
  description?: string;
  pitch?: string;
  problem?: string;
  solution?: string;
  team?: string;
  value_proposition?: string;
  investment?: string;
  founders?: string;
  mrr?: number;
  arr?: number;
  customer_count?: number;
  growth_rate_monthly?: number;
  team_size?: number;
  has_demo?: boolean;
  is_launched?: boolean;
  has_technical_cofounder?: boolean;
  data_completeness?: number;
  total_god_score?: number;
  missing_fields?: Array<{ field: string; label: string; weight: number }>;
}

/**
 * Founder Self-Service Enrichment Page
 * 
 * Flow:
 * 1. Founder receives link: /enrich/:token
 * 2. This page fetches startup data + missing fields
 * 3. Shows form with pre-filled known data
 * 4. Founder fills missing fields
 * 5. Submit → Score recalculates → Redirect to results
 */
export default function EnrichStartupPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [startup, setStartup] = useState<StartupEnrichmentData | null>(null);
  const [email, setEmail] = useState('');
  const [formData, setFormData] = useState<Record<string, any>>({});

  // Fetch startup data
  useEffect(() => {
    if (!token) {
      setError('Invalid enrichment link');
      setLoading(false);
      return;
    }

    axios.get(`/api/enrich/${token}`)
      .then(res => {
        setStartup(res.data.startup);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load startup:', err);
        setError(err.response?.data?.error || 'Failed to load startup data');
        setLoading(false);
      });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    if (Object.keys(formData).length === 0) {
      setError('Please fill in at least one field');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await axios.post(`/api/enrich/${token}`, {
        email,
        enrichedData: formData
      });

      setSuccess(true);
      
      // Show success message
      setTimeout(() => {
        navigate('/');
      }, 3000);
    } catch (err: any) {
      console.error('Enrichment failed:', err);
      setError(err.response?.data?.error || 'Failed to submit enrichment');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex items-center gap-3 text-zinc-400">
          <Loader2 className="animate-spin" size={20} />
          <span>Loading startup data...</span>
        </div>
      </div>
    );
  }

  if (error && !startup) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-lg p-6 text-center">
          <AlertCircle className="mx-auto mb-4 text-rose-400" size={48} />
          <h1 className="text-xl font-bold text-white mb-2">Error</h1>
          <p className="text-zinc-400">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="mt-6 px-4 py-2 bg-zinc-800 text-zinc-300 rounded hover:bg-zinc-700 transition-colors"
          >
            Go to Homepage
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-lg p-6 text-center">
          <CheckCircle className="mx-auto mb-4 text-emerald-400" size={48} />
          <h1 className="text-xl font-bold text-white mb-2">Success!</h1>
          <p className="text-zinc-400 mb-4">
            Your startup profile has been updated. Your GOD score is being recalculated.
          </p>
          <p className="text-sm text-zinc-500">
            Redirecting to homepage...
          </p>
        </div>
      </div>
    );
  }

  if (!startup) return null;

  const projectedScoreIncrease = startup.missing_fields
    ?.slice(0, 5)
    .reduce((sum, field) => sum + (field.weight * 0.15), 0) || 0;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <TrendingUp className="mx-auto mb-4 text-cyan-400" size={48} />
          <h1 className="text-3xl font-bold mb-2">Improve Your GOD Score</h1>
          <p className="text-zinc-400 max-w-xl mx-auto">
            Complete your profile to increase your score and get better investor matches
          </p>
        </div>

        {/* Current Status */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">{startup.name}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-zinc-500 mb-1">Current GOD Score</div>
              <div className="text-2xl font-bold text-cyan-400">{startup.total_god_score || 0}</div>
            </div>
            <div>
              <div className="text-xs text-zinc-500 mb-1">Data Completeness</div>
              <div className="text-2xl font-bold text-amber-400">{startup.data_completeness || 0}%</div>
            </div>
          </div>

          {projectedScoreIncrease > 0 && (
            <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded">
              <div className="text-sm text-emerald-400">
                💡 Complete the form below to potentially increase your score by{' '}
                <span className="font-bold">+{projectedScoreIncrease.toFixed(0)}</span> points
              </div>
            </div>
          )}
        </div>

        {/* Enrichment Form */}
        <form onSubmit={handleSubmit} className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Complete Your Profile</h3>

          {/* Email */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Your Email <span className="text-rose-400">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="founder@startup.com"
              required
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
            />
            <p className="text-xs text-zinc-500 mt-1">We'll send confirmation to this email</p>
          </div>

          {/* Missing Fields (High Priority) */}
          {startup.missing_fields && startup.missing_fields.length > 0 && (
            <div className="space-y-4 mb-6">
              <h4 className="text-sm font-semibold text-zinc-400">High-Impact Fields</h4>
              {startup.missing_fields.slice(0, 5).map(field => (
                <div key={field.field}>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    {field.label}
                    <span className="ml-2 text-xs text-emerald-400">+{field.weight} pts</span>
                  </label>
                  {field.field.includes('description') || field.field.includes('problem') || field.field.includes('solution') ? (
                    <textarea
                      value={formData[field.field] || ''}
                      onChange={(e) => setFormData({ ...formData, [field.field]: e.target.value })}
                      placeholder={`Enter ${field.label.toLowerCase()}...`}
                      rows={3}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
                    />
                  ) : (
                    <input
                      type="text"
                      value={formData[field.field] || ''}
                      onChange={(e) => setFormData({ ...formData, [field.field]: e.target.value })}
                      placeholder={`Enter ${field.label.toLowerCase()}...`}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded text-rose-400 text-sm">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-cyan-500 text-black font-semibold rounded hover:bg-cyan-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                <span>Updating Profile...</span>
              </>
            ) : (
              <span>Submit & Improve Score</span>
            )}
          </button>

          <p className="text-xs text-zinc-500 text-center mt-3">
            Your updates will be reviewed and your score will be recalculated automatically
          </p>
        </form>
      </div>
    </div>
  );
}
