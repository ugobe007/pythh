// ============================================================================
// Oracle Scribe - Journaling Interface
// ============================================================================
// AI-powered journaling system where Oracle analyzes entries and provides
// actionable guidance, insights, and schedules.
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Plus,
  Edit2,
  Trash2,
  Sparkles,
  TrendingUp,
  Calendar,
  Tag,
  Smile,
  Meh,
  Frown,
  Battery,
  Clock,
  Zap,
  Target,
  Loader2,
  Pin,
  Lock,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ScribeEntry {
  id: string;
  title: string;
  content: string;
  entry_type: string;
  tags: string[] | null;
  category: string | null;
  mood: string | null;
  energy_level: number | null;
  is_analyzed: boolean;
  analyzed_at: string | null;
  analysis_summary: string | null;
  word_count: number;
  reading_time_minutes: number;
  is_private: boolean;
  is_pinned: boolean;
  entry_date: string;
  created_at: string;
  updated_at: string;
}

interface ScribeInsight {
  id: string;
  insight_type: string;
  title: string;
  description: string;
  priority: string;
  estimated_impact: number;
  is_actionable: boolean;
  action_created: boolean;
  is_acknowledged: boolean;
}

interface ScribeStats {
  current_streak_days: number;
  longest_streak_days: number;
  total_entries: number;
  total_words: number;
  total_insights_generated: number;
  total_actions_created: number;
  avg_words_per_entry: number;
}

export const OracleScribe: React.FC<{ startupId?: string }> = ({ startupId }) => {
  const [entries, setEntries] = useState<ScribeEntry[]>([]);
  const [stats, setStats] = useState<ScribeStats | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<ScribeEntry | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<ScribeInsight[]>([]);

  // Form state
  const [form, setForm] = useState({
    title: '',
    content: '',
    entry_type: 'general',
    tags: [] as string[],
    category: '',
    mood: '',
    energy_level: 3,
    is_private: false,
  });

  useEffect(() => {
    fetchEntries();
    fetchStats();
  }, [startupId]);

  const fetchEntries = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const params = new URLSearchParams();
      if (startupId) params.append('startup_id', startupId);

      const response = await fetch(`/api/oracle/scribe/entries?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setEntries(data.entries || []);
      }
    } catch (err) {
      console.error('Failed to fetch entries:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/oracle/scribe/stats', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const handleCreateEntry = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/oracle/scribe/entries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          ...form,
          startup_id: startupId,
          tags: form.tags.length > 0 ? form.tags : null,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setEntries([data.entry, ...entries]);
        setSelectedEntry(data.entry);
        resetForm();
        setIsCreating(false);
        fetchStats();
      }
    } catch (err) {
      console.error('Failed to create entry:', err);
    }
  };

  const handleUpdateEntry = async () => {
    if (!selectedEntry) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/oracle/scribe/entries/${selectedEntry.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(form),
      });

      if (response.ok) {
        const data = await response.json();
        setEntries(entries.map(e => e.id === data.entry.id ? data.entry : e));
        setSelectedEntry(data.entry);
        setIsEditing(false);
      }
    } catch (err) {
      console.error('Failed to update entry:', err);
    }
  };

  const handleDeleteEntry = async (id: string) => {
    if (!confirm('Delete this journal entry?')) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/oracle/scribe/entries/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        setEntries(entries.filter(e => e.id !== id));
        if (selectedEntry?.id === id) {
          setSelectedEntry(null);
        }
        fetchStats();
      }
    } catch (err) {
      console.error('Failed to delete entry:', err);
    }
  };

  const handleAnalyzeEntry = async (id: string) => {
    setAnalyzing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/oracle/scribe/entries/${id}/analyze`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setInsights(data.insights || []);
        
        // Update entry
        const updatedEntry = entries.find(e => e.id === id);
        if (updatedEntry) {
          updatedEntry.is_analyzed = true;
          updatedEntry.analysis_summary = data.summary;
          setEntries([...entries]);
          setSelectedEntry(updatedEntry);
        }

        alert(`Oracle analyzed your entry:\n\n${data.summary}\n\nGenerated ${data.insights.length} insights and ${data.actions.length} actions!`);
      }
    } catch (err) {
      console.error('Failed to analyze entry:', err);
    } finally {
      setAnalyzing(false);
    }
  };

  const resetForm = () => {
    setForm({
      title: '',
      content: '',
      entry_type: 'general',
      tags: [],
      category: '',
      mood: '',
      energy_level: 3,
      is_private: false,
    });
  };

  const startEdit = (entry: ScribeEntry) => {
    setForm({
      title: entry.title,
      content: entry.content,
      entry_type: entry.entry_type,
      tags: entry.tags || [],
      category: entry.category || '',
      mood: entry.mood || '',
      energy_level: entry.energy_level || 3,
      is_private: entry.is_private,
    });
    setIsEditing(true);
  };

  const getMoodIcon = (mood: string | null) => {
    switch (mood) {
      case 'excited': return '🤩';
      case 'optimistic': return '😊';
      case 'neutral': return '😐';
      case 'concerned': return '😟';
      case 'frustrated': return '😤';
      case 'stressed': return '😰';
      default: return '📝';
    }
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      general: 'bg-gray-500/10 text-gray-400',
      progress: 'bg-green-500/10 text-green-400',
      challenge: 'bg-orange-500/10 text-orange-400',
      idea: 'bg-purple-500/10 text-purple-400',
      learning: 'bg-blue-500/10 text-blue-400',
      meeting: 'bg-indigo-500/10 text-indigo-400',
      milestone: 'bg-amber-500/10 text-amber-400',
      reflection: 'bg-pink-500/10 text-pink-400',
    };
    return colors[type] || colors.general;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-purple-400" />
            Oracle Scribe
          </h2>
          <p className="text-white/60 text-sm mt-1">
            Journal your journey, receive Oracle guidance
          </p>
        </div>

        <button
          onClick={() => {
            resetForm();
            setIsCreating(true);
            setSelectedEntry(null);
          }}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-xl transition"
        >
          <Plus className="w-4 h-4" />
          New Entry
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 text-white/60 text-xs mb-1">
              <Zap className="w-3 h-3" />
              Current Streak
            </div>
            <div className="text-2xl font-bold text-purple-400">
              {stats.current_streak_days}
              <span className="text-sm text-white/40 ml-1">days</span>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 text-white/60 text-xs mb-1">
              <BookOpen className="w-3 h-3" />
              Total Entries
            </div>
            <div className="text-2xl font-bold text-white">
              {stats.total_entries}
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 text-white/60 text-xs mb-1">
              <Lightbulb className="w-3 h-3" />
              Insights
            </div>
            <div className="text-2xl font-bold text-amber-400">
              {stats.total_insights_generated}
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 text-white/60 text-xs mb-1">
              <Target className="w-3 h-3" />
              Actions
            </div>
            <div className="text-2xl font-bold text-emerald-400">
              {stats.total_actions_created}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Entry List (Left Column) */}
        <div className="lg:col-span-1 space-y-3">
          <h3 className="text-white font-semibold text-sm">Recent Entries</h3>
          
          {entries.length === 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
              <BookOpen className="w-12 h-12 text-white/20 mx-auto mb-3" />
              <p className="text-white/60 text-sm">
                Start journaling to receive Oracle guidance
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {entries.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => setSelectedEntry(entry)}
                  className={`w-full text-left p-4 rounded-xl transition ${
                    selectedEntry?.id === entry.id
                      ? 'bg-purple-500/20 border border-purple-500/30'
                      : 'bg-white/5 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getMoodIcon(entry.mood)}</span>
                      {entry.is_pinned && <Pin className="w-3 h-3 text-amber-400" />}
                      {entry.is_private && <Lock className="w-3 h-3 text-white/40" />}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded ${getTypeColor(entry.entry_type)}`}>
                      {entry.entry_type}
                    </span>
                  </div>
                  
                  <h4 className="text-white font-semibold text-sm mb-1 line-clamp-1">
                    {entry.title}
                  </h4>
                  
                  <p className="text-white/60 text-xs line-clamp-2 mb-2">
                    {entry.content}
                  </p>
                  
                  <div className="flex items-center gap-3 text-xs text-white/40">
                    <span>{new Date(entry.entry_date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}</span>
                    <span>•</span>
                    <span>{entry.word_count} words</span>
                    {entry.is_analyzed && (
                      <>
                        <span>•</span>
                        <CheckCircle2 className="w-3 h-3 text-purple-400" />
                      </>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Entry Detail / Create Form (Right Columns) */}
        <div className="lg:col-span-2">
          {isCreating || isEditing ? (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-semibold">
                  {isEditing ? 'Edit Entry' : 'New Journal Entry'}
                </h3>
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setIsEditing(false);
                    resetForm();
                  }}
                  className="text-white/40 hover:text-white transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Title */}
              <input
                type="text"
                placeholder="Entry title..."
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-purple-500/50"
              />

              {/* Content */}
              <textarea
                placeholder="What's on your mind? Share your thoughts, challenges, ideas, or progress..."
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                rows={12}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-purple-500/50 resize-none"
              />

              {/* Metadata Row */}
              <div className="grid grid-cols-2 gap-4">
                {/* Type */}
                <select
                  value={form.entry_type}
                  onChange={(e) => setForm({ ...form, entry_type: e.target.value })}
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-purple-500/50"
                >
                  <option value="general">General</option>
                  <option value="progress">Progress</option>
                  <option value="challenge">Challenge</option>
                  <option value="idea">Idea</option>
                  <option value="learning">Learning</option>
                  <option value="meeting">Meeting</option>
                  <option value="milestone">Milestone</option>
                  <option value="reflection">Reflection</option>
                </select>

                {/* Mood */}
                <select
                  value={form.mood}
                  onChange={(e) => setForm({ ...form, mood: e.target.value })}
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-purple-500/50"
                >
                  <option value="">Mood...</option>
                  <option value="excited">🤩 Excited</option>
                  <option value="optimistic">😊 Optimistic</option>
                  <option value="neutral">😐 Neutral</option>
                  <option value="concerned">😟 Concerned</option>
                  <option value="frustrated">😤 Frustrated</option>
                  <option value="stressed">😰 Stressed</option>
                </select>
              </div>

              {/* Energy Level */}
              <div>
                <label className="text-white/60 text-sm mb-2 block">
                  Energy Level: {form.energy_level}/5
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={form.energy_level}
                  onChange={(e) => setForm({ ...form, energy_level: parseInt(e.target.value) })}
                  className="w-full"
                />
              </div>

              {/* Tags */}
              <input
                type="text"
                placeholder="Tags (comma-separated: product, fundraising, team)"
                value={form.tags.join(', ')}
                onChange={(e) => setForm({ ...form, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white placeholder-white/40 text-sm focus:outline-none focus:border-purple-500/50"
              />

              {/* Private Toggle */}
              <label className="flex items-center gap-2 text-white/60 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_private}
                  onChange={(e) => setForm({ ...form, is_private: e.target.checked })}
                  className="rounded"
                />
                <Lock className="w-4 h-4" />
                Private entry (visible only to you)
              </label>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={isEditing ? handleUpdateEntry : handleCreateEntry}
                  disabled={!form.title || !form.content}
                  className="flex-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-xl transition font-semibold"
                >
                  {isEditing ? 'Update Entry' : 'Save Entry'}
                </button>
                
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setIsEditing(false);
                    resetForm();
                  }}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/60 rounded-xl transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : selectedEntry ? (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
              {/* Entry Header */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{getMoodIcon(selectedEntry.mood)}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${getTypeColor(selectedEntry.entry_type)}`}>
                      {selectedEntry.entry_type}
                    </span>
                    {selectedEntry.is_private && (
                      <span className="flex items-center gap-1 text-xs text-white/40">
                        <Lock className="w-3 h-3" />
                        Private
                      </span>
                    )}
                  </div>
                  
                  <h3 className="text-xl font-bold text-white mb-2">
                    {selectedEntry.title}
                  </h3>
                  
                  <div className="flex items-center gap-3 text-xs text-white/40">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(selectedEntry.entry_date).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                    <span>•</span>
                    <span>{selectedEntry.word_count} words</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {selectedEntry.reading_time_minutes} min read
                    </span>
                    {selectedEntry.energy_level && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Battery className="w-3 h-3" />
                          {selectedEntry.energy_level}/5
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => startEdit(selectedEntry)}
                    className="p-2 hover:bg-white/10 rounded-lg transition"
                  >
                    <Edit2 className="w-4 h-4 text-white/60" />
                  </button>
                  <button
                    onClick={() => handleDeleteEntry(selectedEntry.id)}
                    className="p-2 hover:bg-red-500/20 rounded-lg transition"
                  >
                    <Trash2 className="w-4 h-4 text-red-400/60" />
                  </button>
                </div>
              </div>

              {/* Tags */}
              {selectedEntry.tags && selectedEntry.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedEntry.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="flex items-center gap-1 bg-purple-500/10 text-purple-300 text-xs px-2 py-1 rounded"
                    >
                      <Tag className="w-3 h-3" />
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Content */}
              <div className="prose prose-invert max-w-none">
                <p className="text-white/80 whitespace-pre-wrap leading-relaxed">
                  {selectedEntry.content}
                </p>
              </div>

              {/* Analysis Section */}
              {selectedEntry.is_analyzed ? (
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-purple-300 font-semibold mb-2">
                    <Sparkles className="w-4 h-4" />
                    Oracle Analysis
                  </div>
                  <p className="text-purple-200/80 text-sm">
                    {selectedEntry.analysis_summary}
                  </p>
                </div>
              ) : (
                <button
                  onClick={() => handleAnalyzeEntry(selectedEntry.id)}
                  disabled={analyzing}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 disabled:opacity-50 text-white px-4 py-3 rounded-xl transition font-semibold"
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Oracle is analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Ask Oracle for Guidance
                    </>
                  )}
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
              <BookOpen className="w-16 h-16 text-white/20 mx-auto mb-4" />
              <h3 className="text-white font-semibold mb-2">Select an entry</h3>
              <p className="text-white/60 text-sm">
                Choose an entry from the list or create a new one to get started
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
