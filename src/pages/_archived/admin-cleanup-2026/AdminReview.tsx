import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { OpenAIDataService } from '../lib/openaiDataService';

interface PendingStartup {
  id: string;
  name: string;
  website: string;
  logo?: string;
  tagline?: string;
  pitch?: string;
  five_points?: string[];
  stage?: string;
  funding?: string;
  industry?: string;
  scraped_by?: string;
  scraped_at?: string;
  total_god_score?: number;
}

export default function AdminReview() {
  const navigate = useNavigate();
  const [pending, setPending] = useState<PendingStartup[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadPending();
  }, []);

  const loadPending = async () => {
    setLoading(true);
    const { success, startups } = await OpenAIDataService.getPendingStartups();
    if (success && startups) {
      setPending(startups);
    }
    setLoading(false);
  };

  const handleApprove = async (id: string) => {
    setProcessingId(id);
    try {
      const result = await OpenAIDataService.approveAndPublish(id, 'admin');
      if (result.success) {
        await loadPending();
      } else {
        alert(`❌ Failed to approve: ${result.error}`);
      }
    } catch (error) {
      console.error('Error approving startup:', error);
      alert('Failed to approve startup');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!confirm('Are you sure you want to reject this startup?')) return;
    
    setProcessingId(id);
    try {
      const result = await OpenAIDataService.rejectStartup(id, 'admin');
      if (result.success) {
        await loadPending();
      } else {
        alert(`❌ Failed to reject: ${result.error}`);
      }
    } catch (error) {
      console.error('Error rejecting startup:', error);
      alert('Failed to reject startup');
    } finally {
      setProcessingId(null);
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Approve ${selectedIds.size} startups?`)) return;

    setProcessingId('bulk');
    let successCount = 0;

    for (const id of selectedIds) {
      try {
        const result = await OpenAIDataService.approveAndPublish(id, 'admin');
        if (result.success) successCount++;
      } catch (error) {
        console.error('Error approving:', error);
      }
    }

    alert(`✅ Approved ${successCount} of ${selectedIds.size} startups`);
    setSelectedIds(new Set());
    setProcessingId(null);
    await loadPending();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0f0729] via-[#1a0f3a] to-[#2d1558] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-6xl mb-4">⚡</div>
          <div className="text-white text-2xl font-medium">Loading pending startups...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0729] via-[#1a0f3a] to-[#2d1558]">
      <div className="py-8 px-4">
      {/* Animated background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1.5s'}}></div>
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Back Button */}
        <button
          onClick={() => navigate('/admin/control')}
          className="group mb-6 px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-400/50 transition-all flex items-center gap-2 text-gray-300 hover:text-white"
        >
          <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="font-medium">Back to Dashboard</span>
        </button>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-5xl font-extrabold bg-gradient-to-r from-cyan-400 via-purple-400 to-blue-400 bg-clip-text text-transparent mb-3">
            🔍 AI Review Queue
          </h1>
          <p className="text-xl text-gray-300">
            {pending.length} startup{pending.length !== 1 ? 's' : ''} pending approval • Scraped by AI, optimized by ML
          </p>
          {pending.length > 0 && (
            <button
              onClick={() => {
                if (selectedIds.size === pending.length) {
                  setSelectedIds(new Set());
                } else {
                  setSelectedIds(new Set(pending.map(s => s.id)));
                }
              }}
              className="mt-4 px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold rounded-xl transition-all"
            >
              {selectedIds.size === pending.length ? '☐ Deselect All' : '☑ Select All'} ({pending.length})
            </button>
          )}
        </div>

        {/* Bulk Actions Bar */}
        {selectedIds.size > 0 && (
          <div className="mb-6 bg-gradient-to-r from-purple-600/40 to-blue-600/40 backdrop-blur-xl rounded-2xl p-4 border-2 border-purple-400/50 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="text-white font-semibold">
                {selectedIds.size} startup{selectedIds.size > 1 ? 's' : ''} selected
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleBulkApprove}
                  disabled={processingId === 'bulk'}
                  className="px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold rounded-lg transition disabled:opacity-50"
                >
                  {processingId === 'bulk' ? '⏳ Processing...' : '✅ Bulk Approve'}
                </button>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white font-medium rounded-lg transition"
                >
                  Clear Selection
                </button>
              </div>
            </div>
          </div>
        )}

        {pending.length === 0 ? (
          <div className="bg-gradient-to-br from-purple-900/40 to-blue-900/40 backdrop-blur-xl rounded-3xl p-16 border-2 border-purple-500/50 shadow-2xl text-center">
            <div className="text-7xl mb-6">✅</div>
            <h2 className="text-3xl font-bold text-white mb-3">All Clear!</h2>
            <p className="text-xl text-gray-300 mb-6">No pending startups. The AI scraper is on standby.</p>
            <button
              onClick={() => navigate('/admin/bulk-import')}
              className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold rounded-xl transition-all shadow-lg"
            >
              🚀 Import New Startups
            </button>
          </div>
        ) : (
          <div className="space-y-6 relative z-10">
            {pending.map((startup) => {
              const isSelected = selectedIds.has(startup.id);
              const godScore = startup.total_god_score || 0;
              
              return (
                <div
                  key={startup.id}
                  className={`bg-gradient-to-br from-white/5 to-white/10 backdrop-blur-sm rounded-2xl p-6 border-2 transition-all ${
                    isSelected 
                      ? 'border-purple-400 shadow-xl shadow-purple-500/30' 
                      : 'border-white/10 hover:border-purple-400/50'
                  }`}
                >
                  <div className="flex items-start gap-4 mb-4">
                    {/* Selection Checkbox */}
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(startup.id)}
                      className="mt-2 w-5 h-5 rounded border-2 border-purple-400 bg-white/10 checked:bg-purple-600 cursor-pointer"
                    />

                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h2 className="text-2xl font-bold text-white mb-2">{startup.name}</h2>
                          {startup.website && (
                            <a
                              href={startup.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-cyan-400 hover:text-cyan-300 text-sm font-medium inline-flex items-center gap-1"
                            >
                              {startup.website} <span>↗</span>
                            </a>
                          )}
                          {startup.tagline && (
                            <p className="text-purple-200 mt-2 text-lg font-medium">{startup.tagline}</p>
                          )}
                        </div>
                        {startup.logo && (
                          <img
                            src={startup.logo}
                            alt={startup.name}
                            className="w-20 h-20 rounded-xl object-cover ml-4 border-2 border-white/20"
                          />
                        )}
                      </div>

                      {/* GOD Score Badge */}
                      {godScore > 0 && (
                        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-400/50 px-4 py-2 rounded-lg mb-3">
                          <span className="text-2xl">⚡</span>
                          <div>
                            <div className="text-xs text-yellow-300 font-semibold uppercase">GOD Score</div>
                            <div className="text-xl font-bold text-white">{godScore}</div>
                          </div>
                        </div>
                      )}

                      {startup.pitch && (
                        <p className="text-gray-300 mb-4 leading-relaxed">{startup.pitch}</p>
                      )}

                      {startup.five_points && startup.five_points.length > 0 && (
                        <div className="bg-white/5 rounded-xl p-4 mb-4 border border-white/10">
                          <h3 className="text-cyan-300 font-bold mb-3 flex items-center gap-2">
                            <span>🎯</span>
                            AI-Extracted Key Points:
                          </h3>
                          <ol className="space-y-2">
                            {startup.five_points.map((point, i) => (
                              <li key={i} className="text-gray-300 flex gap-3">
                                <span className="text-purple-400 font-bold">{i + 1}.</span>
                                <span>{point}</span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 mb-4">
                        {startup.stage && (
                          <span className="bg-purple-500/30 border border-purple-400/50 text-purple-200 px-4 py-2 rounded-lg text-sm font-semibold">
                            📊 {startup.stage}
                          </span>
                        )}
                        {startup.funding && (
                          <span className="bg-cyan-500/30 border border-cyan-400/50 text-cyan-200 px-4 py-2 rounded-lg text-sm font-semibold">
                            💰 {startup.funding}
                          </span>
                        )}
                        {startup.industry && (
                          <span className="bg-cyan-600/30 border border-cyan-400/50 text-cyan-200 px-4 py-2 rounded-lg text-sm font-semibold">
                            🏢 {startup.industry}
                          </span>
                        )}
                      </div>

                      {startup.scraped_by && (
                        <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
                          <span className="bg-white/5 px-3 py-1 rounded-full">
                            🤖 Scraped via: {startup.scraped_by}
                          </span>
                          {startup.scraped_at && (
                            <span className="bg-white/5 px-3 py-1 rounded-full">
                              📅 {new Date(startup.scraped_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => handleApprove(startup.id)}
                      disabled={processingId === startup.id}
                      className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
                    >
                      {processingId === startup.id ? (
                        <>
                          <span className="animate-spin">⏳</span>
                          Processing...
                        </>
                      ) : (
                        <>
                          <span>✅</span>
                          Approve & Publish
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleReject(startup.id)}
                      disabled={processingId === startup.id}
                      className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
                    >
                      {processingId === startup.id ? (
                        <>
                          <span className="animate-spin">⏳</span>
                          Processing...
                        </>
                      ) : (
                        <>
                          <span>❌</span>
                          Reject
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
