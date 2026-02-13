import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import startupData from '../data/startupData';

export default function SyncStartups() {
  const [syncing, setSyncing] = useState(false);
  const [supabaseStartups, setSupabaseStartups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadSupabaseStartups();
  }, []);

  const loadSupabaseStartups = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('startup_uploads')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading from Supabase:', error);
      setMessage(`❌ Error: ${error.message}`);
    } else {
      setSupabaseStartups(data || []);
      setMessage(`✅ Loaded ${data?.length || 0} startups from Supabase`);
    }
    setLoading(false);
  };

  const syncAllToSupabase = async () => {
    setSyncing(true);
    setMessage('🔄 Syncing all startups to Supabase...');

    let successCount = 0;
    let errorCount = 0;

    for (const startup of startupData) {
      try {
        // Check if startup already exists
        const { data: existing } = await supabase
          .from('startup_uploads')
          .select('id')
          .eq('name', startup.name)
          .single();

        if (existing) {
          // Update existing
          const { error } = await supabase
            .from('startup_uploads')
            .update({
              pitch: startup.pitch,
              tagline: startup.tagline,
              extracted_data: {
                fivePoints: startup.fivePoints,
                problem: startup.fivePoints?.[0] || '',
                solution: startup.fivePoints?.[2] || '',
                team: startup.fivePoints?.[3] || '',
                funding: startup.fivePoints?.[4] || '',
                market: startup.fivePoints?.[1] || '',
              },
              status: 'approved', // Auto-approve from startupData.ts
            })
            .eq('id', existing.id);

          if (error) {
            console.error(`Error updating ${startup.name}:`, error);
            errorCount++;
          } else {
            successCount++;
          }
        } else {
          // Insert new
          const { error } = await supabase
            .from('startup_uploads')
            .insert({
              name: startup.name,
              pitch: startup.pitch,
              tagline: startup.tagline,
              source_type: 'manual',
              extracted_data: {
                fivePoints: startup.fivePoints,
                problem: startup.fivePoints?.[0] || '',
                solution: startup.fivePoints?.[2] || '',
                team: startup.fivePoints?.[3] || '',
                funding: startup.fivePoints?.[4] || '',
                market: startup.fivePoints?.[1] || '',
              },
              status: 'approved',
            });

          if (error) {
            console.error(`Error inserting ${startup.name}:`, error);
            errorCount++;
          } else {
            successCount++;
          }
        }
      } catch (err) {
        console.error(`Error syncing ${startup.name}:`, err);
        errorCount++;
      }
    }

    setMessage(`✅ Sync complete! ${successCount} synced, ${errorCount} errors`);
    setSyncing(false);
    await loadSupabaseStartups();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-violet-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-5xl font-bold text-white">🔄 Sync Startups</h1>
          <Link
            to="/admin/edit-startups"
            className="px-6 py-3 bg-white/20 hover:bg-white/30 text-white font-bold rounded-xl transition-all"
          >
            ← Back to Editor
          </Link>
        </div>

        {message && (
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 mb-6 border border-white/20">
            <p className="text-white font-semibold">{message}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Local startupData.ts */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-4">📁 Local (startupData.ts)</h2>
            <div className="text-white mb-4">
              <p className="text-3xl font-bold text-cyan-400">{startupData.length}</p>
              <p className="text-sm text-white/70">startups in code</p>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {startupData.map((s, i) => (
                <div key={i} className="bg-black/20 rounded-lg p-3">
                  <p className="text-white font-semibold">{s.name}</p>
                  <p className="text-xs text-white/60">{s.fivePoints?.length || 0} points</p>
                </div>
              ))}
            </div>
          </div>

          {/* Supabase Database */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-4">🗄️ Supabase Database</h2>
            {loading ? (
              <p className="text-white">Loading...</p>
            ) : (
              <>
                <div className="text-white mb-4">
                  <p className="text-3xl font-bold text-green-400">{supabaseStartups.length}</p>
                  <p className="text-sm text-white/70">startups in database</p>
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {supabaseStartups.map((s) => (
                    <div key={s.id} className="bg-black/20 rounded-lg p-3">
                      <p className="text-white font-semibold">{s.name}</p>
                      <p className="text-xs text-white/60">
                        {s.status} • {s.extracted_data?.fivePoints?.length || 0} points
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Sync Button */}
        <div className="bg-gradient-to-r from-cyan-600 to-blue-600 rounded-2xl p-8 text-center">
          <h3 className="text-3xl font-bold text-white mb-4">
            Sync Local → Database
          </h3>
          <p className="text-white/90 mb-6">
            This will copy all {startupData.length} startups from startupData.ts to Supabase.
            Existing startups will be updated, new ones will be added.
          </p>
          <button
            onClick={syncAllToSupabase}
            disabled={syncing}
            className="px-12 py-4 bg-white hover:bg-gray-100 text-purple-900 font-bold text-xl rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-2xl"
          >
            {syncing ? '🔄 Syncing...' : '▶️ Sync Now'}
          </button>
        </div>
      </div>
    </div>
  );
}
