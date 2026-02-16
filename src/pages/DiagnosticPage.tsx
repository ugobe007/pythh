import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function DiagnosticPage() {
  const navigate = useNavigate();
  const [supabaseData, setSupabaseData] = useState<any>(null);
  const [localStorageData, setLocalStorageData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);

    // Check Supabase
    const { data: allStartups, error } = await supabase
      .from('startup_uploads')
      .select('*')
      .order('created_at', { ascending: false });

    const { data: approvedStartups } = await supabase
      .from('startup_uploads')
      .select('*')
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    const { data: pendingStartups } = await supabase
      .from('startup_uploads')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    setSupabaseData({
      all: allStartups || [],
      approved: approvedStartups || [],
      pending: pendingStartups || [],
      error: error?.message || null,
    });

    // Check localStorage
    const uploaded = localStorage.getItem('uploadedStartups');
    const myVotes = localStorage.getItem('myYesVotes');
    const votedStartups = localStorage.getItem('votedStartups');

    setLocalStorageData({
      uploadedStartups: uploaded ? JSON.parse(uploaded) : [],
      myYesVotes: myVotes ? JSON.parse(myVotes) : [],
      votedStartups: votedStartups ? JSON.parse(votedStartups) : [],
    });

    setLoading(false);
  };

  const clearLocalStorage = () => {
    if (confirm('Clear all localStorage data?')) {
      localStorage.removeItem('uploadedStartups');
      localStorage.removeItem('myYesVotes');
      localStorage.removeItem('votedStartups');
      alert('✅ localStorage cleared!');
      loadData();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 flex items-center justify-center">
        <div className="text-cyan-600 text-2xl font-bold">Loading diagnostic data...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0a1a] via-[#1a0f2e] to-[#0f0a1a] p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-cyan-500 via-blue-400 to-cyan-500 bg-clip-text text-transparent mb-2">
              🔍 System Diagnostic
            </h1>
            <p className="text-slate-400 text-lg">Database health check and system monitoring</p>
          </div>
          <button
            onClick={() => navigate('/admin/control')}
            className="px-6 py-3 bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-cyan-500/20"
          >
            ← Back to Control Center
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-4 mb-8 flex-wrap">
          <button
            onClick={loadData}
            className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-green-500/30"
          >
            🔄 Refresh Data
          </button>
          <button
            onClick={clearLocalStorage}
            className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-red-500/30"
          >
            🗑️ Clear localStorage
          </button>
          <button
            onClick={() => navigate('/admin/migrate')}
            className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-cyan-500/30"
          >
            🔄 Migrate localStorage → Supabase
          </button>
        </div>

        <div className="grid gap-6">
          
          {/* Supabase Data */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 border-2 border-cyan-500/30 shadow-xl">
            <h2 className="text-3xl font-bold text-cyan-400 mb-4">🗄️ Supabase Database</h2>
            
            {supabaseData?.error && (
              <div className="bg-red-900/30 border-2 border-red-500 rounded-xl p-4 mb-4">
                <p className="text-red-400 font-bold">❌ Error: {supabaseData.error}</p>
              </div>
            )}

            <div className="grid gap-4">
              <div className="bg-blue-900/20 border-2 border-blue-500/40 rounded-xl p-4">
                <h3 className="text-blue-300 font-bold text-xl mb-2">
                  📊 Total Startups: {supabaseData?.all.length || 0}
                </h3>
                {supabaseData?.all.length > 0 && (
                  <ul className="text-slate-300 text-sm space-y-1 mt-3">
                    {supabaseData.all.map((s: any, i: number) => (
                      <li key={i}>
                        • <span className="text-cyan-400 font-semibold">{s.name}</span> - 
                        <span className={`ml-2 font-bold ${
                          s.status === 'approved' ? 'text-green-400' :
                          s.status === 'pending' ? 'text-blue-400' :
                          'text-red-400'
                        }`}>{s.status}</span>
                        <span className="text-slate-500 ml-2 text-xs">
                          {new Date(s.created_at).toLocaleString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="bg-green-900/20 border-2 border-green-500/40 rounded-xl p-4">
                <h3 className="text-green-300 font-bold text-xl mb-2">
                  ✅ Approved (Visible in Voting): {supabaseData?.approved.length || 0}
                </h3>
                {supabaseData?.approved.length > 0 && (
                  <ul className="text-slate-300 text-sm space-y-1 mt-3">
                    {supabaseData.approved.map((s: any, i: number) => (
                      <li key={i}>• {s.name}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="bg-slate-800/40 border-2 border-cyan-500/40 rounded-xl p-4">
                <h3 className="text-cyan-300 font-bold text-xl mb-2">
                  ⏳ Pending Review: {supabaseData?.pending.length || 0}
                </h3>
                {supabaseData?.pending.length > 0 && (
                  <ul className="text-slate-300 text-sm space-y-1 mt-3">
                    {supabaseData.pending.map((s: any, i: number) => (
                      <li key={i}>• {s.name}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* localStorage Data */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 border-2 border-cyan-500/30 shadow-xl">
            <h2 className="text-3xl font-bold text-cyan-400 mb-4">💾 localStorage (Legacy)</h2>
            
            <div className="grid gap-4">
              <div className="bg-slate-800/40 border-2 border-cyan-500/40 rounded-xl p-4">
                <h3 className="text-cyan-300 font-bold text-xl mb-2">
                  📦 Uploaded Startups: {localStorageData?.uploadedStartups.length || 0}
                </h3>
                {localStorageData?.uploadedStartups.length > 0 ? (
                  <>
                    <p className="text-cyan-400 text-sm mb-2">
                      ⚠️ These should be migrated to Supabase!
                    </p>
                    <ul className="text-slate-300 text-sm space-y-1 mt-3">
                      {localStorageData.uploadedStartups.map((s: any, i: number) => (
                        <li key={i}>• {s.name || 'Unnamed'}</li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="text-green-400 text-sm">✅ No legacy data (good!)</p>
                )}
              </div>

              <div className="bg-red-900/20 border-2 border-red-500/40 rounded-xl p-4">
                <h3 className="text-red-300 font-bold text-xl mb-2">
                  ❤️ Your YES Votes: {localStorageData?.myYesVotes.length || 0}
                </h3>
              </div>

              <div className="bg-blue-900/20 border-2 border-blue-500/40 rounded-xl p-4">
                <h3 className="text-blue-300 font-bold text-xl mb-2">
                  🗳️ Voted Startups: {localStorageData?.votedStartups.length || 0}
                </h3>
              </div>
            </div>
          </div>

          {/* System Status */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 border-2 border-cyan-500/30 shadow-xl">
            <h2 className="text-3xl font-bold text-cyan-400 mb-4">📋 System Status</h2>
            
            <div className="space-y-3 text-slate-300">
              <p>
                <strong className="text-green-600">✅ Supabase Connection:</strong> {supabaseData?.error ? 'Failed' : 'Working'}
              </p>
              <p>
                <strong className="text-blue-600">📊 Data Storage:</strong> {
                  localStorageData?.uploadedStartups.length > 0 
                    ? '⚠️ Mixed (Supabase + localStorage)' 
                    : '✅ Supabase Only'
                }
              </p>
              <p>
                <strong className="text-cyan-400">🚀 Total Approved for Voting:</strong> {supabaseData?.approved.length || 0}
              </p>
              <p>
                <strong className="text-cyan-600">⏳ Awaiting Review:</strong> {supabaseData?.pending.length || 0}
              </p>
            </div>

            {localStorageData?.uploadedStartups.length > 0 && (
              <div className="mt-4 pt-4 border-t-2 border-cyan-500/30">
                <p className="text-cyan-400 font-bold mb-2">
                  ⚠️ Action Required:
                </p>
                <p className="text-slate-400 text-sm">
                  You have {localStorageData.uploadedStartups.length} startups in localStorage.
                  Click "Migrate localStorage → Supabase" above to move them to the database.
                </p>
              </div>
            )}
          </div>

          {/* Quick Links */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 border-2 border-cyan-500/30 shadow-xl">
            <h2 className="text-3xl font-bold text-cyan-400 mb-4">🔗 Admin Tools</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button
                onClick={() => navigate('/admin/control')}
                className="py-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-purple-500/30"
              >
                🎛️ Control Center
              </button>
              <button
                onClick={() => navigate('/admin/control')}
                className="py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-blue-500/30"
              >
                📊 Dashboard
              </button>
              <button
                onClick={() => navigate('/admin/control')}
                className="py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-green-500/30"
              >
                ⚙️ Operations
              </button>
              <button
                onClick={() => navigate('/admin/ai-intelligence')}
                className="py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-cyan-500/30"
              >
                🤖 ML Dashboard
              </button>
              <button
                onClick={() => navigate('/admin/god-scores')}
                className="py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-cyan-500/30"
              >
                ⭐ GOD Scores
              </button>
              <button
                onClick={() => navigate('/admin/rss-manager')}
                className="py-3 bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-500 hover:to-cyan-600 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-cyan-500/30"
              >
                📡 RSS Manager
              </button>
              <button
                onClick={() => navigate('/admin/edit-startups')}
                className="py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-indigo-500/30"
              >
                ✏️ Edit Startups
              </button>
              <button
                onClick={() => navigate('/admin/bulk-import')}
                className="py-3 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-500 hover:to-teal-600 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-teal-500/30"
              >
                🚀 Bulk Import
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
