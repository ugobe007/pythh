/**
 * VC Quote Card Component
 * 
 * Displays wisdom from top VCs to educate founders.
 * Used in Signal Card sidebar, empty states, and as inspiration.
 */

import React, { useState, useEffect } from 'react';
import { Quote, RefreshCw, ExternalLink } from 'lucide-react';
import { getRandomQuote, getQuoteForLens, type VCQuote, type VCTopic } from '../data/vcWisdom';

interface VCQuoteCardProps {
  // Optional: Filter by topic or lens
  topic?: VCTopic;
  lensId?: string;
  
  // Allow refreshing
  allowRefresh?: boolean;
  
  // Styling
  variant?: 'default' | 'compact' | 'featured';
  className?: string;
}

// Firm logo/color mapping
const firmColors: Record<string, string> = {
  'a16z': '#FF6B6B',
  'Sequoia Capital': '#FF4500',
  'Y Combinator': '#F26522',
  'Benchmark': '#1E90FF',
  'First Round Capital': '#00CED1',
  'Founders Fund': '#9B59B6',
  'General Catalyst': '#2ECC71',
  'Lightspeed': '#3498DB',
  'Index Ventures': '#E74C3C',
  'Kleiner Perkins': '#27AE60',
  'PYTHH': '#8B5CF6',
};

export default function VCQuoteCard({
  topic,
  lensId,
  allowRefresh = true,
  variant = 'default',
  className = '',
}: VCQuoteCardProps) {
  const [quote, setQuote] = useState<VCQuote | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadQuote();
  }, [topic, lensId]);

  const loadQuote = () => {
    if (lensId) {
      setQuote(getQuoteForLens(lensId));
    } else {
      setQuote(getRandomQuote(topic));
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadQuote();
    setTimeout(() => setIsRefreshing(false), 300);
  };

  if (!quote) return null;

  const firmColor = firmColors[quote.firm] || '#6B7280';

  if (variant === 'compact') {
    return (
      <div className={`group ${className}`}>
        <div className="flex items-start gap-2 text-sm">
          <Quote className="w-3 h-3 text-zinc-600 mt-1 flex-shrink-0" />
          <div>
            <p className="text-zinc-400 italic leading-relaxed">{quote.quote}</p>
            <p className="text-zinc-600 text-xs mt-1">
              — {quote.author}, {quote.firm}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'featured') {
    return (
      <div className={`relative overflow-hidden rounded-xl border border-zinc-800/60 bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 p-6 ${className}`}>
        {/* Background glow */}
        <div 
          className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20"
          style={{ backgroundColor: firmColor }}
        />
        
        {/* Quote mark */}
        <div className="absolute top-4 left-4 opacity-10">
          <Quote className="w-12 h-12" style={{ color: firmColor }} />
        </div>

        <div className="relative z-10">
          <blockquote className="text-lg text-white leading-relaxed mb-4 pl-6">
            "{quote.quote}"
          </blockquote>
          
          <div className="flex items-center justify-between pl-6">
            <div className="flex items-center gap-3">
              {/* Firm badge */}
              <div 
                className="w-2 h-8 rounded-full"
                style={{ backgroundColor: firmColor }}
              />
              <div>
                <p className="text-white font-medium">{quote.author}</p>
                <p className="text-zinc-500 text-sm">
                  {quote.role ? `${quote.role}, ` : ''}{quote.firm}
                </p>
              </div>
            </div>

            {allowRefresh && (
              <button
                onClick={handleRefresh}
                className="p-2 text-zinc-500 hover:text-zinc-300 transition-colors"
                title="New quote"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>

          {quote.source && (
            <p className="text-zinc-600 text-xs mt-4 pl-6">
              Source: {quote.source}
              {quote.sourceUrl && (
                <a 
                  href={quote.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 ml-1 text-zinc-500 hover:text-zinc-400"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Default variant
  return (
    <div className={`group bg-zinc-900/30 rounded-lg border border-zinc-800/40 p-4 ${className}`}>
      <div className="flex items-start gap-3">
        {/* Quote icon with firm color */}
        <div 
          className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${firmColor}20` }}
        >
          <Quote className="w-4 h-4" style={{ color: firmColor }} />
        </div>

        <div className="flex-1 min-w-0">
          <blockquote className="text-zinc-300 text-sm leading-relaxed mb-2">
            "{quote.quote}"
          </blockquote>
          
          <div className="flex items-center justify-between">
            <p className="text-zinc-500 text-xs">
              — {quote.author}, <span style={{ color: firmColor }}>{quote.firm}</span>
            </p>

            {allowRefresh && (
              <button
                onClick={handleRefresh}
                className="opacity-0 group-hover:opacity-100 p-1 text-zinc-600 hover:text-zinc-400 transition-all"
                title="New quote"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Inline quote for use within other components
 */
export function InlineVCQuote({ 
  topic, 
  className = '' 
}: { 
  topic?: VCTopic; 
  className?: string;
}) {
  const [quote] = useState(() => getRandomQuote(topic));
  
  if (!quote) return null;

  return (
    <div className={`text-zinc-500 text-xs italic ${className}`}>
      "{quote.quote}" — {quote.author}
    </div>
  );
}
