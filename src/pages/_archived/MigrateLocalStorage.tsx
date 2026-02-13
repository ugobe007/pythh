import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

export default function MigrateLocalStorage() {
  const [migrating, setMigrating] = useState(false);
  const [results, setResults] = useState<any>(null);
  const navigate = useNavigate();

  const checkLocalStorage = () => {
    const uploadedStartups = localStorage.getItem('uploadedStartups');
    if (!uploadedStartups) return null;
    
    try {
      const startups = JSON.parse(uploadedStartups);
      return Array.isArray(startups) ? startups : null;
    } catch (e) {
      console.error('Error parsing localStorage:', e);
      return null;
    }
  };

  const migrateToSupabase = async () => {
    const localStartups = checkLocalStorage();
    
    if (!localStartups || localStartups.length === 0) {
      alert('No startups found in localStorage to migrate');
      return;
    }

    if (!confirm(`Migrate ${localStartups.length} startups from localStorage to Supabase?`)) {
      return;
    }

    setMigrating(true);
    const migratedCount = { success: 0, failed: 0, errors: [] as string[] };

    for (const startup of localStartups) {
      try {
        const { error } = await supabase
          .from('startup_uploads')
          .insert([{
            name: startup.name,
            pitch: startup.pitch || startup.tagline,
            tagline: startup.tagline,
            status: 'approved', // Auto-approve migrated startups
            extracted_data: {
              fivePoints: startup.fivePoints || [],
              problem: startup.problem || '',
              solution: startup.solution || '',
              team: startup.team || '',
              funding: startup.funding || startup.raise || '',
              industry: startup.industries?.[0] || 'Technology',
              website: startup.website,
              founderName: startup.founderName,
              founderEmail: startup.founderEmail,
              presentationUrl: startup.presentationUrl,
              videoUrl: startup.videoUrl,
            }
          }]);

        if (error) {
          console.error(`Failed to migrate ${startup.name}:`, error);
          migratedCount.failed++;
          migratedCount.errors.push(`${startup.name}: ${error.message}`);
        } else {
          console.log(`✅ Migrated: ${startup.name}`);
          migratedCount.success++;
        }
      } catch (err: any) {
        console.error(`Exception migrating ${startup.name}:`, err);
        migratedCount.failed++;
        migratedCount.errors.push(`${startup.name}: ${err.message}`);
      }
    }

    setResults(migratedCount);
    setMigrating(false);
  };

  const clearLocalStorage = () => {
    if (!confirm('⚠️ Clear all localStorage startups? This cannot be undone!')) {
      return;
    }
    localStorage.removeItem('uploadedStartups');
    alert('✅ localStorage cleared!');
    window.location.reload();
  };

  const localStartups = checkLocalStorage();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white mb-4">
            🔄 Migrate to Supabase
          </h1>
          <p className="text-xl text-purple-200">
            Move your startups from localStorage to the database
          </p>
        </div>

        {/* Back Button */}
        <button
          onClick={() => navigate('/admin/edit-startups')}
          className="mb-6 px-6 py-3 bg-white/20 hover:bg-white/30 text-white font-bold rounded-xl transition-all"
        >
          ← Back to Edit Startups
        </button>

        {/* Status Card */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 mb-6 border border-white/20">
          <h2 className="text-2xl font-bold text-white mb-4">📊 Current Status</h2>
          
          {localStartups && localStartups.length > 0 ? (
            <div className="space-y-4">
              <div className="bg-cyan-600/20 border border-cyan-400 rounded-xl p-4">
                <p className="text-white text-lg">
                  <strong className="text-cyan-300">💾 Found in localStorage:</strong> {localStartups.length} startups
                </p>
                <ul className="mt-3 space-y-1 text-white/80 text-sm">
                  {localStartups.slice(0, 10).map((s: any, i: number) => (
                    <li key={i}>• {s.name}</li>
                  ))}
                  {localStartups.length > 10 && (
                    <li className="text-cyan-300">... and {localStartups.length - 10} more</li>
                  )}
                </ul>
              </div>

              <button
                onClick={migrateToSupabase}
                disabled={migrating}
                className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold rounded-xl transition-all disabled:opacity-50 text-lg shadow-lg"
              >
                {migrating ? '⏳ Migrating...' : `🚀 Migrate All ${localStartups.length} Startups to Supabase`}
              </button>

              <button
                onClick={clearLocalStorage}
                disabled={migrating}
                className="w-full py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-all disabled:opacity-50"
              >
                🗑️ Clear localStorage (without migrating)
              </button>
            </div>
          ) : (
            <div className="bg-green-500/20 border border-green-400 rounded-xl p-6 text-center">
              <p className="text-white text-lg">
                ✅ <strong>No startups in localStorage!</strong>
              </p>
              <p className="text-white/80 mt-2">
                All your startups are already in Supabase 🎉
              </p>
            </div>
          )}
        </div>

        {/* Results */}
        {results && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-4">📋 Migration Results</h2>
            
            <div className="space-y-3">
              <div className="bg-green-500/20 border border-green-400 rounded-lg p-4">
                <p className="text-white text-lg">
                  <strong className="text-green-300">✅ Successfully migrated:</strong> {results.success} startups
                </p>
              </div>

              {results.failed > 0 && (
                <div className="bg-red-500/20 border border-red-400 rounded-lg p-4">
                  <p className="text-white text-lg mb-2">
                    <strong className="text-red-300">❌ Failed:</strong> {results.failed} startups
                  </p>
                  <ul className="text-white/80 text-sm space-y-1 max-h-60 overflow-y-auto">
                    {results.errors.map((error: string, i: number) => (
                      <li key={i} className="font-mono">• {error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {results.success > 0 && (
                <div className="mt-6 pt-6 border-t border-white/20">
                  <button
                    onClick={clearLocalStorage}
                    className="w-full py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-xl transition-all"
                  >
                    ✨ Clear localStorage Now (Recommended)
                  </button>
                  <p className="text-white/60 text-sm text-center mt-2">
                    Your startups are now safely in Supabase!
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Help Text */}
        <div className="mt-6 bg-blue-500/20 border border-blue-400 rounded-xl p-6">
          <h3 className="text-white font-bold mb-2">ℹ️ What does this do?</h3>
          <ul className="text-white/80 text-sm space-y-2">
            <li>• Reads all startups from localStorage</li>
            <li>• Uploads each one to Supabase database</li>
            <li>• Sets status to 'approved' automatically</li>
            <li>• Preserves all fields: name, pitch, 5 points, team, funding, etc.</li>
            <li>• After migration, you can safely clear localStorage</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
