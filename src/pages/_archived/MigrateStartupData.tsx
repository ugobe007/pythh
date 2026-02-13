import { useState } from 'react';
import { supabase } from '../lib/supabase';
import startupData from '../data/startupData';
import { Link } from 'react-router-dom';

export default function MigrateStartupData() {
  const [migrating, setMigrating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const migrateData = async () => {
    setMigrating(true);
    setError(null);
    setResult(null);

    try {
      console.log('🚀 Starting migration of', startupData.length, 'startups...');

      const migrationResults = [];

      for (const startup of startupData) {
        console.log('📦 Migrating:', startup.name);

        // Check if startup already exists (by name)
        const { data: existing, error: checkError } = await supabase
          .from('startup_uploads')
          .select('id')
          .eq('name', startup.name)
          .single();

        if (checkError && checkError.code !== 'PGRST116') {
          console.error('Error checking existing:', checkError);
          migrationResults.push({ name: startup.name, status: 'error', message: checkError.message });
          continue;
        }

        if (existing) {
          console.log('⏭️  Skipping (already exists):', startup.name);
          migrationResults.push({ name: startup.name, status: 'skipped', message: 'Already exists' });
          continue;
        }

        // Insert into startup_uploads table with approved status
        const { data, error: insertError } = await supabase
          .from('startup_uploads')
          .insert({
            name: startup.name,
            website: '', // startupData doesn't have website field
            description: startup.pitch || startup.tagline || startup.description || '',
            tagline: startup.tagline || '',
            pitch: startup.pitch || startup.description || '',
            raise_amount: startup.raise || '',
            raise_type: startup.raise?.includes('Seed') ? 'Seed' : startup.raise?.includes('Series') ? startup.raise.split(' ')[0] + ' ' + startup.raise.split(' ')[1] : '',
            stage: startup.stage || 1,
            source_type: 'manual',
            status: 'approved', // Already approved since these are production cards
            extracted_data: {
              fivePoints: startup.fivePoints || [],
              marketSize: startup.marketSize || '',
              unique: startup.unique || '',
              raise: startup.raise || '',
              industries: startup.industries || [],
            },
            submitted_by: null,
            submitted_email: 'admin@hotmoneyhoney.com',
          })
          .select();

        if (insertError) {
          console.error('❌ Error inserting:', insertError);
          migrationResults.push({ name: startup.name, status: 'error', message: insertError.message });
        } else {
          console.log('✅ Migrated:', startup.name);
          migrationResults.push({ name: startup.name, status: 'success', data });
        }
      }

      const summary = {
        total: startupData.length,
        success: migrationResults.filter(r => r.status === 'success').length,
        skipped: migrationResults.filter(r => r.status === 'skipped').length,
        errors: migrationResults.filter(r => r.status === 'error').length,
        details: migrationResults,
      };

      console.log('📊 Migration Summary:', summary);
      setResult(summary);
    } catch (err: any) {
      console.error('💥 Migration failed:', err);
      setError(err.message);
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-800 to-indigo-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-5xl font-bold text-white">🔄 Migrate Startup Data</h1>
          <Link
            to="/admin/edit-startups"
            className="px-6 py-3 bg-white/20 hover:bg-white/30 text-white font-bold rounded-xl transition-all"
          >
            ← Back to Editor
          </Link>
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 border border-white/20 mb-6">
          <h2 className="text-2xl font-bold text-white mb-4">📋 What This Does</h2>
          <div className="text-white/90 space-y-2 mb-6">
            <p>• Copies all {startupData.length} startups from <code className="bg-black/30 px-2 py-1 rounded">startupData.ts</code> to Supabase</p>
            <p>• Sets their status to "approved" so they appear on the Vote page</p>
            <p>• Skips startups that already exist (checks by name)</p>
            <p>• After migration, all pages will use Supabase as the single source</p>
          </div>

          <div className="bg-yellow-500/20 border border-yellow-500 rounded-lg p-4 mb-6">
            <p className="text-yellow-200 font-semibold">⚠️ This will make startupData.ts obsolete</p>
            <p className="text-yellow-200 text-sm mt-1">After migration, all StartupCards will be managed through the Edit Startups page</p>
          </div>

          <button
            onClick={migrateData}
            disabled={migrating}
            className={`w-full py-4 rounded-xl font-bold text-xl transition-all ${
              migrating
                ? 'bg-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white shadow-lg'
            }`}
          >
            {migrating ? '⏳ Migrating...' : '🚀 Start Migration'}
          </button>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500 rounded-xl p-6 mb-6">
            <h3 className="text-xl font-bold text-red-200 mb-2">❌ Error</h3>
            <p className="text-red-200">{error}</p>
          </div>
        )}

        {result && (
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 border border-white/20">
            <h3 className="text-2xl font-bold text-white mb-4">📊 Migration Results</h3>
            
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-white/10 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-white">{result.total}</div>
                <div className="text-white/70 text-sm">Total</div>
              </div>
              <div className="bg-green-500/20 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-green-300">{result.success}</div>
                <div className="text-green-300 text-sm">Success</div>
              </div>
              <div className="bg-yellow-500/20 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-yellow-300">{result.skipped}</div>
                <div className="text-yellow-300 text-sm">Skipped</div>
              </div>
              <div className="bg-red-500/20 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-red-300">{result.errors}</div>
                <div className="text-red-300 text-sm">Errors</div>
              </div>
            </div>

            <div className="space-y-2">
              {result.details.map((item: any, idx: number) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg ${
                    item.status === 'success'
                      ? 'bg-green-500/20 border border-green-500/50'
                      : item.status === 'skipped'
                      ? 'bg-yellow-500/20 border border-yellow-500/50'
                      : 'bg-red-500/20 border border-red-500/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">{item.name}</span>
                    <span className={`text-sm ${
                      item.status === 'success' ? 'text-green-300' :
                      item.status === 'skipped' ? 'text-yellow-300' : 'text-red-300'
                    }`}>
                      {item.status === 'success' ? '✅ Migrated' :
                       item.status === 'skipped' ? '⏭️  Skipped' : '❌ Error'}
                    </span>
                  </div>
                  {item.message && item.status === 'error' && (
                    <div className="mt-2 text-xs text-red-200 bg-red-900/30 p-2 rounded">
                      {item.message}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {result.success > 0 && (
              <div className="mt-6 p-4 bg-green-500/20 border border-green-500 rounded-lg">
                <p className="text-green-200 font-semibold text-lg mb-2">✅ Migration Complete!</p>
                <p className="text-green-200 mb-4">
                  {result.success} startup{result.success !== 1 ? 's' : ''} successfully migrated to Supabase!
                </p>
                <div className="space-y-2">
                  <p className="text-green-200 font-semibold">📋 Next Steps:</p>
                  <ol className="text-green-200 text-sm space-y-1 ml-4">
                    <li>1. Go to <a href="/admin/edit-startups" className="underline font-bold">Edit Startups</a> to see all your cards</li>
                    <li>2. Click "Edit" on any card to update the 5 points</li>
                    <li>3. All changes will appear immediately on Vote, Dashboard, and Portfolio pages</li>
                  </ol>
                </div>
              </div>
            )}

            {result.errors > 0 && (
              <div className="mt-6 space-y-4">
                <div className="p-4 bg-red-500/20 border border-red-500 rounded-lg">
                  <p className="text-red-200 font-semibold text-lg mb-2">❌ Some Migrations Failed</p>
                  <p className="text-red-200 text-sm mb-2">
                    {result.errors} error{result.errors !== 1 ? 's' : ''} occurred. Check the details below:
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setResult(null);
                      setError(null);
                    }}
                    className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl transition-all"
                  >
                    🔄 Clear & Try Again
                  </button>
                  <Link
                    to="/admin/edit-startups"
                    className="flex-1 py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl transition-all text-center"
                  >
                    ✏️ Go to Edit Startups
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
