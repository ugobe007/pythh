/**
 * ALIGNMENT TIMELINE — The Personal Capital Diary
 * ================================================
 * Shows the founder's alignment journey over time.
 * 
 * This is what makes Pythh sticky:
 * - Visual history of alignment changes
 * - Personal capital diary
 * - "I am one of the stories" feeling
 */

import { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Eye, 
  EyeOff, 
  Sparkles, 
  Users,
  AlertCircle,
  CheckCircle,
  Clock,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { AlignmentEvent } from '../../lib/database.types';

// ============================================
// TYPES
// ============================================
export interface TimelineEvent {
  id: string;
  date: string;
  type: string;
  title: string;
  description?: string;
  impact: 'positive' | 'negative' | 'neutral';
  importance: 'high' | 'medium' | 'low';
}

interface AlignmentTimelineProps {
  startupId?: string;
  startupUrl?: string;
  events?: TimelineEvent[];
  maxEvents?: number;
  showExpanded?: boolean;
}

// ============================================
// EVENT STYLING
// ============================================
const EVENT_ICONS: Record<string, typeof TrendingUp> = {
  'alignment_improved': TrendingUp,
  'alignment_declined': TrendingDown,
  'signal_detected': Sparkles,
  'signal_lost': EyeOff,
  'investor_appeared': Eye,
  'investor_dropped': EyeOff,
  'investor_upgraded': TrendingUp,
  'investor_downgraded': TrendingDown,
  'milestone_reached': CheckCircle,
  'attention_increased': Users,
  'attention_decreased': AlertCircle,
};

const IMPACT_COLORS = {
  positive: {
    dot: 'bg-emerald-400',
    text: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30'
  },
  negative: {
    dot: 'bg-red-400',
    text: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30'
  },
  neutral: {
    dot: 'bg-slate-400',
    text: 'text-slate-400',
    bg: 'bg-slate-500/10',
    border: 'border-slate-500/30'
  }
};

// ============================================
// MOCK EVENTS (for demo before real data exists)
// ============================================
function generateMockEvents(startupUrl?: string): TimelineEvent[] {
  const now = new Date();
  
  // Generate realistic demo events
  return [
    {
      id: '1',
      date: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      type: 'signal_detected',
      title: 'Design partner signal detected',
      description: 'Enterprise partnership indicators identified',
      impact: 'positive',
      importance: 'high'
    },
    {
      id: '2',
      date: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      type: 'investor_appeared',
      title: 'Entered monitoring by 3 investors',
      description: 'Seed-stage fintech specialists',
      impact: 'positive',
      importance: 'medium'
    },
    {
      id: '3',
      date: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000).toISOString(),
      type: 'alignment_improved',
      title: 'Alignment improved to Forming',
      description: 'Signal density increased',
      impact: 'positive',
      importance: 'high'
    },
    {
      id: '4',
      date: new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000).toISOString(),
      type: 'signal_detected',
      title: 'Technical credibility signal strengthened',
      description: 'Open-source activity detected',
      impact: 'positive',
      importance: 'medium'
    }
  ];
}

// ============================================
// MAIN COMPONENT
// ============================================
export default function AlignmentTimeline({
  startupId,
  startupUrl,
  events: propEvents,
  maxEvents = 5,
  showExpanded = false
}: AlignmentTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(showExpanded);
  
  // Fetch events from database
  useEffect(() => {
    async function fetchEvents() {
      setIsLoading(true);
      
      // If events provided as props, use those
      if (propEvents && propEvents.length > 0) {
        setEvents(propEvents);
        setIsLoading(false);
        return;
      }
      
      // Try to fetch from database
      try {
        let query = supabase
          .from('alignment_events')
          .select('*')
          .order('event_date', { ascending: false })
          .limit(20);
        
        if (startupId) {
          query = query.eq('startup_id', startupId);
        } else if (startupUrl) {
          query = query.eq('startup_url', startupUrl);
        }
        
        const { data, error } = await query;
        
        if (error) {
          console.error('Error fetching timeline events:', error);
          // Fall back to mock events for demo
          setEvents(generateMockEvents(startupUrl));
        } else if (data && data.length > 0) {
          // Transform DB events to component format
          setEvents(data.map((e: AlignmentEvent) => ({
            id: e.id,
            date: e.event_date,
            type: e.event_type,
            title: e.event_title,
            description: e.event_description || undefined,
            impact: (e.impact as 'positive' | 'negative' | 'neutral') || 'neutral',
            importance: (e.importance as 'high' | 'medium' | 'low') || 'medium'
          })));
        } else {
          // No events yet, show mock for demo
          setEvents(generateMockEvents(startupUrl));
        }
      } catch (err) {
        console.error('Error:', err);
        setEvents(generateMockEvents(startupUrl));
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchEvents();
  }, [startupId, startupUrl, propEvents]);
  
  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  };
  
  // Get visible events
  const visibleEvents = isExpanded ? events : events.slice(0, maxEvents);
  const hasMore = events.length > maxEvents;
  
  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center gap-3 py-8 text-gray-500">
        <Clock className="w-4 h-4 animate-pulse" />
        <span className="text-sm">Loading timeline...</span>
      </div>
    );
  }
  
  // Empty state
  if (events.length === 0) {
    return (
      <div className="text-center py-8">
        <Clock className="w-8 h-8 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">
          Your alignment timeline will appear here as signals are detected.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-3 top-3 bottom-3 w-px bg-gray-800" />
        
        {/* Events */}
        <div className="space-y-4">
          {visibleEvents.map((event, index) => {
            const Icon = EVENT_ICONS[event.type] || Clock;
            const colors = IMPACT_COLORS[event.impact];
            
            return (
              <div 
                key={event.id}
                className="relative pl-10 group"
              >
                {/* Timeline dot */}
                <div 
                  className={`absolute left-0 top-1 w-6 h-6 rounded-full ${colors.bg} border ${colors.border} flex items-center justify-center`}
                >
                  <Icon className={`w-3 h-3 ${colors.text}`} />
                </div>
                
                {/* Content */}
                <div className="pb-1">
                  {/* Date */}
                  <p className="text-xs text-gray-500 mb-1">
                    {formatDate(event.date)}
                  </p>
                  
                  {/* Title */}
                  <p className={`text-sm font-medium ${colors.text}`}>
                    {event.title}
                  </p>
                  
                  {/* Description (if important) */}
                  {event.description && event.importance !== 'low' && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {event.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Expand/Collapse button */}
      {hasMore && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 transition-colors mt-4 ml-10"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-4 h-4" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              Show {events.length - maxEvents} more events
            </>
          )}
        </button>
      )}
    </div>
  );
}
