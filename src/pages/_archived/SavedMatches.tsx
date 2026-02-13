/**
 * SAVED MATCHES PAGE
 * ==================
 * View and manage saved investor matches
 * Color scheme: Light blue to violet
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Bookmark, 
  Trash2, 
  ExternalLink,
  Filter,
  ChevronDown,
  Search,
  MessageCircle,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  StickyNote,
  Building2
} from 'lucide-react';
import { 
  getSavedMatches, 
  unsaveMatch, 
  updateMatchStatus,
  addMatchNotes,
  SavedMatch 
} from '../lib/savedMatchesService';

type StatusFilter = 'all' | 'saved' | 'contacted' | 'meeting_scheduled' | 'passed';

export default function SavedMatches() {
  const navigate = useNavigate();
  const [matches, setMatches] = useState<SavedMatch[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  useEffect(() => {
    loadMatches();
  }, []);

  const loadMatches = () => {
    const saved = getSavedMatches();
    setMatches(saved);
  };

  const handleDelete = (startupId: string, investorId: string) => {
    unsaveMatch(startupId, investorId);
    loadMatches();
  };

  const handleStatusChange = (startupId: string, investorId: string, status: SavedMatch['status']) => {
    updateMatchStatus(startupId, investorId, status);
    loadMatches();
  };

  const handleSaveNotes = (startupId: string, investorId: string) => {
    addMatchNotes(startupId, investorId, noteText);
    setEditingNotes(null);
    setNoteText('');
    loadMatches();
  };

  const filteredMatches = statusFilter === 'all' 
    ? matches 
    : matches.filter(m => m.status === statusFilter);

  const getStatusIcon = (status: SavedMatch['status']) => {
    switch (status) {
      case 'contacted': return <MessageCircle className="w-4 h-4" />;
      case 'meeting_scheduled': return <Calendar className="w-4 h-4" />;
      case 'passed': return <XCircle className="w-4 h-4" />;
      default: return <Bookmark className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: SavedMatch['status']) => {
    switch (status) {
      case 'contacted': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'meeting_scheduled': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'passed': return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
      default: return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
    }
  };

  const statusCounts = {
    all: matches.length,
    saved: matches.filter(m => m.status === 'saved').length,
    contacted: matches.filter(m => m.status === 'contacted').length,
    meeting_scheduled: matches.filter(m => m.status === 'meeting_scheduled').length,
    passed: matches.filter(m => m.status === 'passed').length
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="bg-slate-900/80 backdrop-blur-sm border-b border-slate-800 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5 text-slate-400" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  <Bookmark className="w-5 h-5 text-cyan-400" />
                  Saved Matches
                </h1>
                <p className="text-sm text-slate-400">{matches.length} saved investors</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Status Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {(['all', 'saved', 'contacted', 'meeting_scheduled', 'passed'] as StatusFilter[]).map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${
                statusFilter === status
                  ? 'bg-cyan-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {status === 'all' ? 'All' : status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              <span className="ml-2 px-2 py-0.5 bg-black/20 rounded-full text-xs">
                {statusCounts[status]}
              </span>
            </button>
          ))}
        </div>

        {/* Matches List */}
        {filteredMatches.length > 0 ? (
          <div className="space-y-4">
            {filteredMatches.map(match => (
              <div 
                key={match.id}
                className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 hover:border-slate-600 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Match Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">{match.investorName}</h3>
                        <p className="text-sm text-slate-400">
                          Match for: {match.startupName}
                        </p>
                      </div>
                    </div>

                    {/* Match Score & Status */}
                    <div className="flex items-center gap-3 mb-3">
                      <span className="px-3 py-1 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-full text-sm font-bold">
                        {match.matchScore}% match
                      </span>
                      <span className={`px-3 py-1 rounded-full text-sm border ${getStatusColor(match.status)}`}>
                        {getStatusIcon(match.status)}
                        <span className="ml-1">
                          {match.status?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Saved'}
                        </span>
                      </span>
                      <span className="text-xs text-slate-500">
                        Saved {new Date(match.savedAt).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Notes */}
                    {editingNotes === match.id ? (
                      <div className="mb-3">
                        <textarea
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          placeholder="Add notes about this investor..."
                          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
                          rows={2}
                        />
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => handleSaveNotes(match.startupId, match.investorId)}
                            className="px-3 py-1 bg-cyan-600 text-white rounded text-sm hover:bg-cyan-500"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => { setEditingNotes(null); setNoteText(''); }}
                            className="px-3 py-1 bg-slate-700 text-slate-300 rounded text-sm hover:bg-slate-600"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : match.notes ? (
                      <div 
                        className="bg-slate-900/50 rounded-lg p-2 mb-3 text-sm text-slate-300 cursor-pointer hover:bg-slate-900/70"
                        onClick={() => { setEditingNotes(match.id); setNoteText(match.notes || ''); }}
                      >
                        <StickyNote className="w-3 h-3 inline mr-1 text-slate-500" />
                        {match.notes}
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingNotes(match.id)}
                        className="text-sm text-slate-500 hover:text-slate-400 mb-3"
                      >
                        <StickyNote className="w-3 h-3 inline mr-1" />
                        Add notes
                      </button>
                    )}

                    {/* Status Actions */}
                    <div className="flex flex-wrap gap-2">
                      {match.status !== 'contacted' && (
                        <button
                          onClick={() => handleStatusChange(match.startupId, match.investorId, 'contacted')}
                          className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-lg text-xs hover:bg-blue-500/30"
                        >
                          <MessageCircle className="w-3 h-3 inline mr-1" />
                          Mark Contacted
                        </button>
                      )}
                      {match.status !== 'meeting_scheduled' && (
                        <button
                          onClick={() => handleStatusChange(match.startupId, match.investorId, 'meeting_scheduled')}
                          className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg text-xs hover:bg-emerald-500/30"
                        >
                          <Calendar className="w-3 h-3 inline mr-1" />
                          Meeting Scheduled
                        </button>
                      )}
                      {match.status !== 'passed' && (
                        <button
                          onClick={() => handleStatusChange(match.startupId, match.investorId, 'passed')}
                          className="px-3 py-1 bg-slate-500/20 text-slate-400 rounded-lg text-xs hover:bg-slate-500/30"
                        >
                          <XCircle className="w-3 h-3 inline mr-1" />
                          Pass
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    <Link
                      to={`/investor/${match.investorId}`}
                      className="p-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
                      title="View investor"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                    <button
                      onClick={() => handleDelete(match.startupId, match.investorId)}
                      className="p-2 bg-slate-700 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <Bookmark className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">
              {statusFilter === 'all' ? 'No saved matches yet' : `No ${statusFilter.replace('_', ' ')} matches`}
            </h3>
            <p className="text-slate-400 mb-6">
              {statusFilter === 'all' 
                ? 'Start matching to find investors and save your favorites!'
                : 'Update your match statuses to see them here.'}
            </p>
            <Link
              to="/"
              className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg font-semibold hover:from-cyan-500 hover:to-blue-500 transition-all inline-block"
            >
              Find Matches
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
