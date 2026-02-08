import React, { useState } from 'react';
import { 
  Link2, 
  Rocket, 
  Briefcase, 
  ArrowRight, 
  Loader2,
  Sparkles,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

type SubmissionMode = 'startup' | 'investor';

interface UrlSubmissionProps {
  className?: string;
}

export default function UrlSubmission({ className = '' }: UrlSubmissionProps) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<SubmissionMode>('startup');
  const [url, setUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const validateUrl = (input: string): boolean => {
    try {
      // Add https if missing
      let urlToTest = input.trim();
      if (!urlToTest.startsWith('http://') && !urlToTest.startsWith('https://')) {
        urlToTest = 'https://' + urlToTest;
      }
      new URL(urlToTest);
      return true;
    } catch {
      return false;
    }
  };

  const normalizeUrl = (input: string): string => {
    let normalized = input.trim().toLowerCase();
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
      normalized = 'https://' + normalized;
    }
    // Remove trailing slash
    normalized = normalized.replace(/\/$/, '');
    return normalized;
  };

  const extractDomain = (urlString: string): string => {
    try {
      const url = new URL(normalizeUrl(urlString));
      return url.hostname.replace('www.', '');
    } catch {
      return urlString;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    if (!validateUrl(url)) {
      setError('Please enter a valid URL (e.g., company.com or https://company.com)');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const normalizedUrl = normalizeUrl(url);
    const domain = extractDomain(url);

    try {
      if (mode === 'startup') {
        // Check if startup already exists by website domain
        // Use ilike for case-insensitive matching
        const { data: existingStartups, error: queryError } = await supabase
          .from('startup_uploads')
          .select('id, name')
          .ilike('website', `%${domain}%`)
          .limit(1);

        if (queryError) {
          console.error('Query error:', queryError);
        }

        const existingStartup = existingStartups && existingStartups.length > 0 
          ? existingStartups[0] 
          : null;

        if (existingStartup) {
          // Startup exists - go to their match page
          setSuccess(true);
          setTimeout(() => {
            navigate(`/signal-matches?startup=${existingStartup.id}`);
          }, 1000);
        } else {
          // New startup - create a pending entry and go to enrichment/signup
          const companyName = domain.split('.')[0];
          const capitalizedName = companyName.charAt(0).toUpperCase() + companyName.slice(1);
          
          const { data: newStartup, error: insertError } = await supabase
            .from('startup_uploads')
            .insert({
              website: normalizedUrl,
              name: capitalizedName,
              status: 'pending',
              source_type: 'url',
              source_url: normalizedUrl,
            })
            .select('id')
            .single();

          if (insertError) {
            console.error('Insert error:', insertError);
            throw new Error('Failed to create startup profile. Please try again.');
          }

          setSuccess(true);
          setTimeout(() => {
            // Navigate to signal-matches page with startup ID
            navigate(`/signal-matches?startup=${newStartup.id}`);
          }, 1000);
        }
      } else {
        // Investor mode
        // Check if investor already exists by LinkedIn or blog URL
        const { data: existingInvestors, error: queryError } = await supabase
          .from('investors')
          .select('id, name')
          .or(`linkedin_url.ilike.%${domain}%,blog_url.ilike.%${domain}%,url.ilike.%${domain}%`)
          .limit(1);

        if (queryError) {
          console.error('Query error:', queryError);
        }

        const existingInvestor = existingInvestors && existingInvestors.length > 0 
          ? existingInvestors[0] 
          : null;

        if (existingInvestor) {
          // Investor exists - go to their match page
          setSuccess(true);
          setTimeout(() => {
            navigate(`/match?investor_id=${existingInvestor.id}`);
          }, 1000);
        } else {
          // New investor - redirect to investor signup with URL pre-filled
          setSuccess(true);
          setTimeout(() => {
            navigate(`/investor/signup?url=${encodeURIComponent(normalizedUrl)}`);
          }, 1000);
        }
      }
    } catch (err) {
      console.error('Submission error:', err);
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`w-full max-w-xl mx-auto ${className}`}>
      {/* Header */}
      <div className="text-center mb-4">
        <p className="text-gray-400 text-sm">
          — or —
        </p>
      </div>

      {/* Mode Toggle Pills */}
      <div className="flex justify-center gap-2 mb-4">
        <button
          onClick={() => { setMode('startup'); setError(null); setUrl(''); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
            mode === 'startup'
              ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-lg shadow-emerald-500/30'
              : 'bg-slate-800 text-gray-400 hover:text-white hover:bg-slate-700'
          }`}
        >
          <Rocket className="w-4 h-4" />
          I'm a Startup
        </button>
        <button
          onClick={() => { setMode('investor'); setError(null); setUrl(''); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
            mode === 'investor'
              ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/30'
              : 'bg-slate-800 text-gray-400 hover:text-white hover:bg-slate-700'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          I'm an Investor
        </button>
      </div>

      {/* URL Input Form */}
      <form onSubmit={handleSubmit} className="relative">
        <div className={`flex items-center bg-slate-800/80 border rounded-xl overflow-hidden transition-all ${
          error 
            ? 'border-red-500/50' 
            : success 
              ? 'border-green-500/50' 
              : 'border-white/10 focus-within:border-cyan-500/50'
        }`}>
          {/* Icon */}
          <div className={`pl-4 ${mode === 'startup' ? 'text-emerald-400' : 'text-blue-400'}`}>
            <Link2 className="w-5 h-5" />
          </div>
          
          {/* Input */}
          <input
            type="text"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setError(null); }}
            placeholder={mode === 'startup' 
              ? 'Enter your startup website (e.g., mycompany.com)' 
              : 'Enter your LinkedIn or firm website'
            }
            className="flex-1 px-4 py-3.5 bg-transparent text-white placeholder-gray-500 outline-none text-sm"
            disabled={isSubmitting || success}
          />
          
          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || success || !url.trim()}
            className={`flex items-center gap-2 px-5 py-3.5 font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              mode === 'startup'
                ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white hover:from-emerald-600 hover:to-green-600'
                : 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-600 hover:to-blue-600'
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Finding...</span>
              </>
            ) : success ? (
              <>
                <CheckCircle className="w-4 h-4" />
                <span>Found!</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Get Matched</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-2 mt-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="flex items-center justify-center gap-2 mt-3 text-green-400 text-sm animate-pulse">
            <CheckCircle className="w-4 h-4" />
            <span>Redirecting to your matches...</span>
          </div>
        )}
      </form>

      {/* Helper Text */}
      <p className="text-center text-gray-500 text-xs mt-3">
        {mode === 'startup' 
          ? "We'll analyze your startup and find matching investors instantly"
          : "We'll find startups that match your investment criteria"
        }
      </p>
    </div>
  );
}


