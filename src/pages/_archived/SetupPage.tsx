import { useState } from 'react';
import { Link } from 'react-router-dom';
import LogoDropdownMenu from '../components/LogoDropdownMenu';
import { seedInitialInvestors, findDuplicateInvestors, removeDuplicateInvestors } from '../lib/investorService';

export default function SetupPage() {
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [duplicates, setDuplicates] = useState<any>(null);
  const [checkingDupes, setCheckingDupes] = useState(false);
  const [removingDupes, setRemovingDupes] = useState(false);

  const runSetup = async () => {
    setLoading(true);
    setStatus('🚀 Starting setup...\n');

    try {
      setStatus(prev => prev + '\n⚠️  Make sure you ran all 5 SQL files first!');
      setStatus(prev => prev + '\n\n🌱 Seeding investor data...');
      
      const results = await seedInitialInvestors();
      
      const successCount = results.filter(r => !r.error).length;
      const errorCount = results.filter(r => r.error).length;

      if (successCount > 0) {
        setStatus(prev => prev + `\n✅ Successfully seeded ${successCount} investors!`);
      }
      
      if (errorCount > 0) {
        setStatus(prev => prev + `\n\n⚠️  ${errorCount} errors occurred:`);
        results.forEach((result, i) => {
          if (result.error) {
            setStatus(prev => prev + `\n   - Investor ${i + 1}: ${result.error.message}`);
          }
        });
        setStatus(prev => prev + '\n\n💡 Common errors:');
        setStatus(prev => prev + '\n   - "relation does not exist" → Run the SQL migrations first');
        setStatus(prev => prev + '\n   - "duplicate key" → Data already seeded (this is OK)');
        setStatus(prev => prev + '\n   - "permission denied" → Check your Supabase anon key');
      }

      if (successCount > 0) {
        setStatus(prev => prev + '\n\n✨ Setup complete! Visit /investors to see your data.');
      }

    } catch (error: any) {
      setStatus(prev => prev + `\n\n❌ Error: ${error.message || error}`);
      setStatus(prev => prev + '\n\n🔍 Troubleshooting:');
      setStatus(prev => prev + '\n   1. Check your .env file has VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
      setStatus(prev => prev + '\n   2. Verify you ran all SQL migration files in order');
      setStatus(prev => prev + '\n   3. Check Supabase dashboard for any errors');
    } finally {
      setLoading(false);
    }
  };

  const checkDuplicates = async () => {
    setCheckingDupes(true);
    try {
      const { data, error } = await findDuplicateInvestors();
      if (error) {
        alert(`Error: ${error.message}`);
      } else {
        setDuplicates(data);
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setCheckingDupes(false);
    }
  };

  const removeDuplicates = async () => {
    if (!confirm('Are you sure you want to remove duplicate entries? This will keep only the oldest entry for each investor name.')) {
      return;
    }

    setRemovingDupes(true);
    try {
      const { data, error } = await removeDuplicateInvestors();
      if (error) {
        alert(`Error: ${error.message}`);
        setRemovingDupes(false);
      } else {
        alert(data?.message || 'Done!');
        // Clear the list and re-check
        setDuplicates(null);
        setRemovingDupes(false);
        // Re-check for any remaining duplicates
        setCheckingDupes(true);
        const recheckResult = await findDuplicateInvestors();
        if (!recheckResult.error) {
          setDuplicates(recheckResult.data);
        }
        setCheckingDupes(false);
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
      setRemovingDupes(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 p-8">
      {/* Home Button */}
      <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-40">
        <button
          onClick={() => window.location.href = '/'}
          className="px-4 py-2 rounded-full bg-gradient-to-b from-slate-300 via-slate-200 to-slate-400 text-slate-800 font-medium text-sm flex items-center gap-2 shadow-lg hover:from-slate-400 hover:via-slate-300 hover:to-slate-500 transition-all cursor-pointer"
          style={{
            boxShadow: '0 4px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.8), inset 0 -1px 0 rgba(0,0,0,0.2)',
            textShadow: '0 1px 1px rgba(255,255,255,0.8)'
          }}>
          <span>🏠</span>
          <span>Home</span>
        </button>
      </div>
      
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <div className="text-8xl mb-4">🔧</div>
          <h1 className="text-6xl font-bold text-white mb-4">
            Database Setup
          </h1>
          <p className="text-2xl text-purple-200">
            Seed investor data
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 mb-8 border-2 border-purple-400/50">
          <div className="text-center">
            <p className="text-xl text-purple-100 mb-6">
              Click the button below to add initial investor data to your database:
            </p>
            
            <button
              onClick={runSetup}
              disabled={loading}
              className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold text-xl rounded-xl shadow-xl hover:from-cyan-600 hover:to-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed mb-6"
            >
              {loading ? '⏳ Seeding Data...' : '🚀 Seed Investor Data'}
            </button>

            {status && (
              <div className="bg-black/50 p-4 rounded-xl text-left">
                <h3 className="text-xl font-bold mb-2 text-white">Status:</h3>
                <pre className="text-sm text-green-300 whitespace-pre-wrap font-mono">
                  {status}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Duplicate Management Section */}
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 mb-8 border-2 border-red-400/50">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-white mb-4">🔍 Manage Duplicates</h2>
            <p className="text-xl text-purple-100 mb-6">
              Check for and remove duplicate investor entries
            </p>
            
            <button
              onClick={checkDuplicates}
              disabled={checkingDupes}
              className="px-8 py-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold text-xl rounded-xl shadow-xl hover:from-blue-600 hover:to-cyan-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed mr-4"
            >
              {checkingDupes ? '🔍 Checking...' : '🔍 Check for Duplicates'}
            </button>

            {duplicates && duplicates.length > 0 && (
              <button
                onClick={removeDuplicates}
                disabled={removingDupes}
                className="px-8 py-4 bg-gradient-to-r from-blue-500 to-violet-500 text-white font-bold text-xl rounded-xl shadow-xl hover:from-cyan-600 hover:to-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {removingDupes ? '🗑️ Removing...' : '🗑️ Remove Duplicates'}
              </button>
            )}

            {duplicates !== null && (
              <div className="mt-6 bg-black/50 p-4 rounded-xl text-left">
                <h3 className="text-xl font-bold mb-2 text-white">
                  {duplicates.length === 0 ? '✅ No Duplicates Found' : `⚠️ Found ${duplicates.length} Duplicate Name(s)`}
                </h3>
                {duplicates.length > 0 && (
                  <div className="space-y-4 mt-4">
                    {duplicates.map((dup: any, idx: number) => (
                      <div key={idx} className="bg-white/10 p-3 rounded-lg">
                        <p className="text-white font-bold mb-2">
                          {dup.name} ({dup.count} entries)
                        </p>
                        <div className="text-sm text-purple-200 space-y-1">
                          {dup.investors.map((inv: any, invIdx: number) => (
                            <div key={inv.id}>
                              {invIdx === 0 ? '✅ Keep: ' : '❌ Remove: '}
                              ID: {inv.id.substring(0, 8)}... (Created: {new Date(inv.created_at).toLocaleDateString()})
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    <p className="text-yellow-300 text-sm mt-4">
                      💡 Tip: The oldest entry for each duplicate will be kept, newer ones will be removed.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="text-center space-x-4">
          <Link
            to="/invite-investor"
            className="inline-block px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold text-xl rounded-xl shadow-xl hover:from-green-600 hover:to-emerald-600 transition-all"
          >
            ✚ Add New Investor
          </Link>
          <Link
            to="/investors"
            className="inline-block px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold text-xl rounded-xl shadow-xl hover:from-cyan-600 hover:to-blue-600 transition-all"
          >
            💼 View Investors
          </Link>
        </div>
      </div>
      
      {/* Navigation */}
      <LogoDropdownMenu />
    </div>
  );
}
