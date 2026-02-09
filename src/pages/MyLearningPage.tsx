/**
 * MY LEARNING PAGE — Sprint 3
 * ============================
 * 
 * "A private learning journal of how the market responds to me."
 * 
 * Route: /my-learning
 * Nav label: "Your alignment learning"
 * 
 * Three sections:
 * 1. Saved Patterns — Stories explicitly saved
 * 2. Stories Like You — Auto-matched by profile
 * 3. Stories For Your Investors — Investor-linked playbooks
 * 
 * Plus: Pattern Feed and Personal Journal
 */

import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { 
  BookOpen, 
  Bookmark, 
  Users, 
  Target, 
  Sparkles,
  Bell,
  FileText,
  ChevronRight,
  RefreshCw,
  X,
  Pin,
  Clock,
  TrendingUp,
  Eye
} from 'lucide-react';

// Services
import { 
  getPersonalLibrary,
  type PersonalLibrary,
  type SavedStory,
  type SimilarStory,
  type InvestorLinkedStory
} from '../services/personalLibraryService';
import { 
  getPatternFeed, 
  markFeedItemRead,
  dismissFeedItem
} from '../services/patternFeedService';
import { 
  getJournalNotes,
  getPinnedNotes
} from '../services/alignmentJournalService';

// Types
import type { 
  PatternFeedItem,
  AlignmentJournalEntry 
} from '../lib/database.types';

// Session
import { getSession } from '../lib/routeGuards';

// =============================================================================
// TYPES
// =============================================================================

type TabId = 'saved' | 'similar' | 'investors' | 'feed' | 'journal';

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function MyLearningPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as TabId) || 'saved';
  
  // Get startup URL from session (most recent scan)
  const session = getSession();
  const startupUrl = session.scannedUrls?.[session.scannedUrls.length - 1] || '';
  
  // State
  const [library, setLibrary] = useState<PersonalLibrary | null>(null);
  const [feed, setFeed] = useState<PatternFeedItem[]>([]);
  const [journal, setJournal] = useState<AlignmentJournalEntry[]>([]);
  const [pinnedNotes, setPinnedNotes] = useState<AlignmentJournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unreadFeedCount, setUnreadFeedCount] = useState(0);
  
  // Fetch data
  useEffect(() => {
    if (!startupUrl) {
      setIsLoading(false);
      return;
    }
    
    async function loadData() {
      setIsLoading(true);
      
      try {
        const [libraryData, feedData, journalData, pinnedData] = await Promise.all([
          getPersonalLibrary(startupUrl),
          getPatternFeed(startupUrl, { limit: 20, includeRead: true }),
          getJournalNotes(startupUrl, { limit: 20 }),
          getPinnedNotes(startupUrl)
        ]);
        
        setLibrary(libraryData);
        setFeed(feedData);
        setJournal(journalData);
        setPinnedNotes(pinnedData);
        setUnreadFeedCount(feedData.filter(f => !f.is_read).length);
      } catch (err) {
        console.error('[MyLearning] Load error:', err);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadData();
  }, [startupUrl]);
  
  // Tab change handler
  const setActiveTab = (tab: TabId) => {
    setSearchParams({ tab });
  };
  
  // Handle feed item read
  const handleFeedItemRead = async (itemId: string) => {
    await markFeedItemRead(itemId);
    setFeed(prev => prev.map(f => 
      f.id === itemId ? { ...f, is_read: true } : f
    ));
    setUnreadFeedCount(prev => Math.max(0, prev - 1));
  };
  
  // Handle feed item dismiss
  const handleFeedItemDismiss = async (itemId: string) => {
    await dismissFeedItem(itemId);
    setFeed(prev => prev.filter(f => f.id !== itemId));
  };
  
  // No startup URL
  if (!startupUrl) {
    return (
      <div className="min-h-screen bg-gray-950 text-white p-8">
        <div className="max-w-4xl mx-auto text-center py-20">
          <BookOpen className="w-16 h-16 text-gray-600 mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-white mb-4">Your Alignment Learning</h1>
          <p className="text-gray-400 mb-8">
            Submit your startup URL first to start building your personal learning library.
          </p>
          <Link 
            to="/discovery"
            className="px-6 py-3 bg-amber-500 text-black font-semibold rounded-lg hover:bg-amber-400 transition-colors"
          >
            Go to Discovery
          </Link>
        </div>
      </div>
    );
  }
  
  // Loading
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white p-8">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-8">
            <div className="h-10 bg-gray-800 rounded w-1/3" />
            <div className="h-12 bg-gray-800 rounded" />
            <div className="grid grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-48 bg-gray-800 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-4 sm:px-8 py-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                <BookOpen className="w-7 h-7 text-amber-400" />
                Your Alignment Learning
              </h1>
              <p className="text-gray-500 mt-1">
                A private learning journal of how the market responds to you.
              </p>
            </div>
            
            {/* Stats */}
            {library?.profile && (
              <div className="flex items-center gap-6 text-sm">
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">
                    {library.profile.stories_saved}
                  </div>
                  <div className="text-gray-500">Saved</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">
                    {library.profile.stories_viewed}
                  </div>
                  <div className="text-gray-500">Viewed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">
                    {library.profile.patterns_discovered}
                  </div>
                  <div className="text-gray-500">Patterns</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>
      
      {/* Tabs */}
      <nav className="border-b border-gray-800 px-4 sm:px-8">
        <div className="max-w-6xl mx-auto flex gap-1">
          <TabButton 
            id="saved" 
            label="Saved Patterns" 
            icon={<Bookmark className="w-4 h-4" />}
            count={library?.savedPatterns.length}
            isActive={activeTab === 'saved'}
            onClick={() => setActiveTab('saved')}
          />
          <TabButton 
            id="similar" 
            label="Stories Like You" 
            icon={<Users className="w-4 h-4" />}
            count={library?.storiesLikeYou.length}
            isActive={activeTab === 'similar'}
            onClick={() => setActiveTab('similar')}
          />
          <TabButton 
            id="investors" 
            label="For Your Investors" 
            icon={<Target className="w-4 h-4" />}
            count={library?.storiesForInvestors.length}
            isActive={activeTab === 'investors'}
            onClick={() => setActiveTab('investors')}
          />
          <TabButton 
            id="feed" 
            label="Pattern Feed" 
            icon={<Sparkles className="w-4 h-4" />}
            count={unreadFeedCount}
            isActive={activeTab === 'feed'}
            onClick={() => setActiveTab('feed')}
            highlight={unreadFeedCount > 0}
          />
          <TabButton 
            id="journal" 
            label="My Notes" 
            icon={<FileText className="w-4 h-4" />}
            count={journal.length}
            isActive={activeTab === 'journal'}
            onClick={() => setActiveTab('journal')}
          />
        </div>
      </nav>
      
      {/* Content */}
      <main className="px-4 sm:px-8 py-8">
        <div className="max-w-6xl mx-auto">
          {activeTab === 'saved' && (
            <SavedPatternsTab stories={library?.savedPatterns || []} />
          )}
          {activeTab === 'similar' && (
            <StoriesLikeYouTab stories={library?.storiesLikeYou || []} />
          )}
          {activeTab === 'investors' && (
            <InvestorStoriesTab 
              stories={library?.storiesForInvestors || []}
              trackedInvestors={library?.trackedInvestors || []}
            />
          )}
          {activeTab === 'feed' && (
            <PatternFeedTab 
              items={feed}
              onRead={handleFeedItemRead}
              onDismiss={handleFeedItemDismiss}
            />
          )}
          {activeTab === 'journal' && (
            <JournalTab 
              notes={journal}
              pinnedNotes={pinnedNotes}
              startupUrl={startupUrl}
            />
          )}
        </div>
      </main>
    </div>
  );
}

// =============================================================================
// TAB BUTTON
// =============================================================================

interface TabButtonProps {
  id: string;
  label: string;
  icon: React.ReactNode;
  count?: number;
  isActive: boolean;
  onClick: () => void;
  highlight?: boolean;
}

function TabButton({ label, icon, count, isActive, onClick, highlight }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
        isActive 
          ? 'border-amber-400 text-amber-400' 
          : 'border-transparent text-gray-400 hover:text-gray-300'
      }`}
    >
      {icon}
      <span>{label}</span>
      {count !== undefined && count > 0 && (
        <span className={`px-2 py-0.5 text-xs rounded-full ${
          highlight 
            ? 'bg-amber-500 text-black' 
            : 'bg-gray-700 text-gray-400'
        }`}>
          {count}
        </span>
      )}
    </button>
  );
}

// =============================================================================
// SAVED PATTERNS TAB
// =============================================================================

function SavedPatternsTab({ stories }: { stories: SavedStory[] }) {
  if (stories.length === 0) {
    return (
      <EmptyState
        icon={<Bookmark className="w-12 h-12" />}
        title="No saved patterns yet"
        description="Save alignment stories from the Discovery Gallery to build your personal library."
        actionLabel="Browse Gallery"
        actionLink="/discovery/gallery"
      />
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Studying section */}
      {stories.filter(s => s.isStudying).length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-medium text-amber-400 mb-4 flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Currently Studying
          </h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {stories.filter(s => s.isStudying).map(saved => (
              <SavedStoryCard key={saved.story.id} saved={saved} />
            ))}
          </div>
        </div>
      )}
      
      {/* All saved */}
      <div>
        <h3 className="text-sm font-medium text-gray-400 mb-4">
          All Saved Patterns ({stories.length})
        </h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {stories.filter(s => !s.isStudying).map(saved => (
            <SavedStoryCard key={saved.story.id} saved={saved} />
          ))}
        </div>
      </div>
    </div>
  );
}

function SavedStoryCard({ saved }: { saved: SavedStory }) {
  const { story, savedAt, saveReason, isStudying } = saved;
  
  return (
    <Link
      to={`/discovery/gallery?story=${story.id}`}
      className={`block p-4 rounded-xl border transition-all hover:border-gray-600 ${
        isStudying 
          ? 'bg-amber-500/5 border-amber-500/30' 
          : 'bg-gray-800/50 border-gray-700/50'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <span className={`text-xs px-2 py-1 rounded-full ${
          story.alignment_state_after === 'strong' ? 'bg-emerald-500/20 text-emerald-400' :
          story.alignment_state_after === 'active' ? 'bg-amber-500/20 text-amber-400' :
          'bg-gray-700 text-gray-400'
        }`}>
          {story.archetype || story.stage}
        </span>
        {isStudying && (
          <Eye className="w-4 h-4 text-amber-400" />
        )}
      </div>
      
      <h4 className="text-white font-medium mb-2 line-clamp-2">
        {story.startup_type_label}
      </h4>
      
      <p className="text-sm text-gray-400 line-clamp-2 mb-3">
        {story.what_changed_text}
      </p>
      
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{story.stage} • {story.industry}</span>
        <span>{new Date(savedAt).toLocaleDateString()}</span>
      </div>
      
      {saveReason && (
        <p className="mt-2 text-xs text-gray-600 italic">
          "{saveReason}"
        </p>
      )}
    </Link>
  );
}

// =============================================================================
// STORIES LIKE YOU TAB
// =============================================================================

function StoriesLikeYouTab({ stories }: { stories: SimilarStory[] }) {
  if (stories.length === 0) {
    return (
      <EmptyState
        icon={<Users className="w-12 h-12" />}
        title="Building your profile..."
        description="View more stories and save patterns to improve personalized recommendations."
        actionLabel="Browse Gallery"
        actionLink="/discovery/gallery"
      />
    );
  }
  
  return (
    <div className="space-y-6">
      <p className="text-gray-400 text-sm">
        Stories from founders at similar stages, industries, and signal patterns.
      </p>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stories.map(({ story, relevanceScore, matchReasons }) => (
          <Link
            key={story.id}
            to={`/discovery/gallery?story=${story.id}`}
            className="block p-4 bg-gray-800/50 rounded-xl border border-gray-700/50 hover:border-gray-600 transition-all"
          >
            <div className="flex items-start justify-between mb-3">
              <span className="text-xs px-2 py-1 rounded-full bg-gray-700 text-gray-400">
                {story.archetype || story.stage}
              </span>
              <span className="text-xs text-amber-400">
                {Math.round(relevanceScore * 100)}% match
              </span>
            </div>
            
            <h4 className="text-white font-medium mb-2 line-clamp-2">
              {story.startup_type_label}
            </h4>
            
            <p className="text-sm text-gray-400 line-clamp-2 mb-3">
              {story.what_changed_text}
            </p>
            
            <div className="flex flex-wrap gap-1">
              {matchReasons.slice(0, 2).map((reason, i) => (
                <span key={i} className="text-xs text-gray-500 bg-gray-700/50 px-2 py-0.5 rounded">
                  {reason}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// INVESTOR STORIES TAB
// =============================================================================

function InvestorStoriesTab({ 
  stories, 
  trackedInvestors 
}: { 
  stories: InvestorLinkedStory[];
  trackedInvestors: any[];
}) {
  if (trackedInvestors.length === 0) {
    return (
      <EmptyState
        icon={<Target className="w-12 h-12" />}
        title="No investors tracked yet"
        description="Start tracking investors from Prep Mode to see stories relevant to them."
        actionLabel="Go to Discovery"
        actionLink="/discovery"
      />
    );
  }
  
  if (stories.length === 0) {
    return (
      <div className="text-center py-12">
        <Target className="w-12 h-12 text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">
          No linked stories found yet
        </h3>
        <p className="text-gray-500 max-w-md mx-auto">
          As you track more investors, we'll surface alignment stories relevant to how they invest.
        </p>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <p className="text-gray-400 text-sm">
        Stories linked to investors you're tracking. Learn how founders reached them.
      </p>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stories.map(({ story, investorName, relevanceReason }) => (
          <Link
            key={story.id}
            to={`/discovery/gallery?story=${story.id}`}
            className="block p-4 bg-gray-800/50 rounded-xl border border-gray-700/50 hover:border-gray-600 transition-all"
          >
            {investorName && (
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-amber-400" />
                <span className="text-sm text-amber-400 font-medium">
                  {investorName}
                </span>
              </div>
            )}
            
            <h4 className="text-white font-medium mb-2 line-clamp-2">
              {story.startup_type_label}
            </h4>
            
            <p className="text-sm text-gray-400 line-clamp-2 mb-3">
              {story.result_text || story.what_changed_text}
            </p>
            
            <p className="text-xs text-gray-500 italic">
              {relevanceReason}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// PATTERN FEED TAB
// =============================================================================

function PatternFeedTab({ 
  items, 
  onRead, 
  onDismiss 
}: { 
  items: PatternFeedItem[];
  onRead: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Sparkles className="w-12 h-12" />}
        title="Your feed is quiet"
        description="New patterns relevant to your profile will appear here. Save more stories to train your feed."
        actionLabel="Browse Gallery"
        actionLink="/discovery/gallery"
      />
    );
  }
  
  return (
    <div className="space-y-4">
      <p className="text-gray-400 text-sm mb-6">
        New patterns and updates relevant to your capital journey.
      </p>
      
      {items.map(item => (
        <FeedItemCard 
          key={item.id} 
          item={item}
          onRead={() => onRead(item.id)}
          onDismiss={() => onDismiss(item.id)}
        />
      ))}
    </div>
  );
}

function FeedItemCard({ 
  item, 
  onRead, 
  onDismiss 
}: { 
  item: PatternFeedItem;
  onRead: () => void;
  onDismiss: () => void;
}) {
  const feedTypeIcons: Record<string, React.ReactNode> = {
    new_pattern: <Sparkles className="w-4 h-4 text-amber-400" />,
    story_evolution: <RefreshCw className="w-4 h-4 text-blue-400" />,
    archetype_update: <TrendingUp className="w-4 h-4 text-emerald-400" />,
    investor_linked: <Target className="w-4 h-4 text-purple-400" />,
    similar_journey: <Users className="w-4 h-4 text-cyan-400" />,
    path_durability_shift: <Clock className="w-4 h-4 text-orange-400" />
  };
  
  return (
    <div className={`p-4 rounded-xl border transition-all ${
      item.is_read 
        ? 'bg-gray-800/30 border-gray-800' 
        : 'bg-gray-800/50 border-amber-500/30'
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          <div className="p-2 bg-gray-700/50 rounded-lg">
            {feedTypeIcons[item.feed_type] || <Bell className="w-4 h-4" />}
          </div>
          
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className={`font-medium ${item.is_read ? 'text-gray-400' : 'text-white'}`}>
                {item.headline}
              </h4>
              {!item.is_read && (
                <span className="w-2 h-2 bg-amber-400 rounded-full" />
              )}
            </div>
            
            {item.subheadline && (
              <p className="text-sm text-gray-500 mb-1">{item.subheadline}</p>
            )}
            
            {item.detail_text && (
              <p className="text-sm text-gray-400 line-clamp-2">{item.detail_text}</p>
            )}
            
            {item.relevance_reason && (
              <p className="text-xs text-gray-600 mt-2 italic">
                {item.relevance_reason}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2 ml-4">
          {item.story_id && !item.is_read && (
            <Link
              to={`/discovery/gallery?story=${item.story_id}`}
              onClick={onRead}
              className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
            >
              View <ChevronRight className="w-3 h-3" />
            </Link>
          )}
          <button
            onClick={onDismiss}
            className="p-1 text-gray-600 hover:text-gray-400"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-700/50 text-xs text-gray-600">
        <span>{new Date(item.created_at).toLocaleDateString()}</span>
        {item.relevance_score && (
          <span>{Math.round(item.relevance_score * 100)}% relevant</span>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// JOURNAL TAB
// =============================================================================

function JournalTab({ 
  notes, 
  pinnedNotes,
  startupUrl 
}: { 
  notes: AlignmentJournalEntry[];
  pinnedNotes: AlignmentJournalEntry[];
  startupUrl: string;
}) {
  const allNotes = notes.length === 0 && pinnedNotes.length === 0;
  
  if (allNotes) {
    return (
      <EmptyState
        icon={<FileText className="w-12 h-12" />}
        title="Your journal is empty"
        description="Add notes on stories, investors, and timeline events to build your private learning journal."
        actionLabel="Browse Discovery"
        actionLink="/discovery"
      />
    );
  }
  
  return (
    <div className="space-y-8">
      {/* Pinned notes */}
      {pinnedNotes.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-amber-400 mb-4 flex items-center gap-2">
            <Pin className="w-4 h-4" />
            Pinned Notes
          </h3>
          <div className="space-y-3">
            {pinnedNotes.map(note => (
              <JournalNoteCard key={note.id} note={note} />
            ))}
          </div>
        </div>
      )}
      
      {/* Recent notes */}
      <div>
        <h3 className="text-sm font-medium text-gray-400 mb-4">
          Recent Notes ({notes.length})
        </h3>
        <div className="space-y-3">
          {notes.filter(n => !n.is_pinned).map(note => (
            <JournalNoteCard key={note.id} note={note} />
          ))}
        </div>
      </div>
    </div>
  );
}

function JournalNoteCard({ note }: { note: AlignmentJournalEntry }) {
  const typeLabels: Record<string, string> = {
    story: 'Story Note',
    investor: 'Investor Note',
    timeline: 'Timeline Note',
    pattern: 'Pattern Note',
    general: 'General Note'
  };
  
  const typeColors: Record<string, string> = {
    story: 'text-blue-400 bg-blue-500/10',
    investor: 'text-purple-400 bg-purple-500/10',
    timeline: 'text-emerald-400 bg-emerald-500/10',
    pattern: 'text-amber-400 bg-amber-500/10',
    general: 'text-gray-400 bg-gray-500/10'
  };
  
  return (
    <div className={`p-4 rounded-xl border ${
      note.is_pinned 
        ? 'bg-amber-500/5 border-amber-500/30' 
        : 'bg-gray-800/50 border-gray-700/50'
    }`}>
      <div className="flex items-start justify-between mb-2">
        <span className={`text-xs px-2 py-1 rounded-full ${typeColors[note.note_type]}`}>
          {typeLabels[note.note_type]}
        </span>
        <div className="flex items-center gap-2">
          {note.is_pinned && (
            <Pin className="w-3 h-3 text-amber-400" />
          )}
          <span className="text-xs text-gray-600">
            {new Date(note.created_at).toLocaleDateString()}
          </span>
        </div>
      </div>
      
      <p className="text-gray-300 whitespace-pre-wrap">{note.note_text}</p>
      
      {note.note_tags && note.note_tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {note.note_tags.map((tag: string, i: number) => (
            <span key={i} className="text-xs text-gray-500 bg-gray-700/50 px-2 py-0.5 rounded">
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// EMPTY STATE
// =============================================================================

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  actionLink: string;
}

function EmptyState({ icon, title, description, actionLabel, actionLink }: EmptyStateProps) {
  return (
    <div className="text-center py-16">
      <div className="text-gray-600 mb-4 flex justify-center">{icon}</div>
      <h3 className="text-lg font-medium text-white mb-2">{title}</h3>
      <p className="text-gray-500 max-w-md mx-auto mb-6">{description}</p>
      <Link
        to={actionLink}
        className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400 transition-colors"
      >
        {actionLabel}
        <ChevronRight className="w-4 h-4" />
      </Link>
    </div>
  );
}
