import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * SmartSearchBar
 * - Accepts startup URL (e.g., "stripe.com", "https://were.com", "www.openai.com")
 * - Normalizes to domain-only format
 * - Navigates to /discover on submit
 */

function normalizeStartupUrl(input: string): string {
  if (!input) return '';
  
  let url = input.trim().toLowerCase();
  
  // Remove protocol
  url = url.replace(/^https?:\/\//, '');
  
  // Remove www.
  url = url.replace(/^www\./, '');
  
  // Remove trailing slashes and paths
  url = url.split('/')[0];
  
  // Remove query strings
  url = url.split('?')[0];
  
  return url;
}

export default function SmartSearchBar() {
  const [rawInput, setRawInput] = useState('');
  const [touched, setTouched] = useState(false);
  const navigate = useNavigate();

  const normalizedValue = useMemo(() => normalizeStartupUrl(rawInput), [rawInput]);
  const isValid = normalizedValue.length > 0 && normalizedValue.includes('.');
  const showError = touched && !isValid;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    
    if (!isValid) return;
    
    navigate(`/signal-matches?url=${encodeURIComponent(normalizedValue)}`);
  };

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="relative">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="Enter startup URL (e.g., stripe.com)"
            className="flex-1 px-6 py-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur text-white placeholder-white/40 focus:border-white/30 focus:outline-none transition text-lg"
          />
          <button
            type="submit"
            className="px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-purple-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!isValid && touched}
          >
            Discover
          </button>
        </div>
      </form>
      
      {showError && (
        <p className="text-rose-400 text-sm">
          Please enter a valid URL (e.g., stripe.com, were.com)
        </p>
      )}
      
      <p className="text-white/50 text-sm text-center">
        No pitch deck · No warm intro · Just signals
      </p>
    </div>
  );
}
