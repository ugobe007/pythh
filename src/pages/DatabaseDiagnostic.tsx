import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

interface DiagnosticResult {
  totalStartups: number;
  recentStartups: any[];
  missingPitch: number;
  missingRaise: number;
  missingStage: number;
  missingExtracted: number;
  invalidFivePoints: number;
  totalVotes: number;
  errors: string[];
}

export default function DatabaseDiagnostic() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<DiagnosticResult | null>(null);

  useEffect(() => {
    checkDatabase();
  }, []);

  const checkDatabase = async () => {
    setLoading(true);
    const errors: string[] = [];
    
    try {
      console.log('🔍 Starting database diagnostic...');

      // 1. Fetch recent startups
      const { data: startups, error: startupsError } = await supabase
        .from('startup_uploads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (startupsError) {
        errors.push(`Startups fetch error: ${startupsError.message}`);
        console.error('❌ Startups error:', startupsError);
      }

      // 2. Count votes (from localStorage, Supabase votes table not available)
      const localVotes = localStorage.getItem('user_votes');
      const votesCount = localVotes ? JSON.parse(localVotes).length : 0;

      // 3. Analyze data quality
      const missingPitch = startups?.filter(s => !s.pitch || s.pitch.trim() === '').length || 0;
      const missingRaise = startups?.filter(s => !s.raise_amount).length || 0;
      const missingStage = startups?.filter(s => !s.stage).length || 0;
      const missingExtracted = startups?.filter(s => !s.extracted_data).length || 0;
      const invalidFivePoints = startups?.filter(s => {
        const data = s.extracted_data as any;
        return !data?.fivePoints || !Array.isArray(data.fivePoints) || data.fivePoints.length !== 5;
      }).length || 0;

      setResults({
        totalStartups: startups?.length || 0,
        recentStartups: startups || [],
        missingPitch,
        missingRaise,
        missingStage,
        missingExtracted,
        invalidFivePoints,
        totalVotes: votesCount || 0,
        errors
      });

      console.log('✅ Database diagnostic complete');
      console.log('Results:', {
        totalStartups: startups?.length,
        missingPitch,
        missingRaise,
        missingStage,
        missingExtracted,
        invalidFivePoints,
        totalVotes: votesCount
      });
      
    } catch (error: any) {
      errors.push(`Unexpected error: ${error.message}`);
      console.error('❌ Error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h1 className="text-3xl font-bold text-cyan-600 mb-4">Checking Database...</h1>
          <div className="animate-pulse text-cyan-500">Please wait...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <button
            onClick={() => navigate('/')}
            className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-3 px-6 rounded-2xl shadow-lg transition-all"
          >
            ← Home
          </button>
          <button
            onClick={() => checkDatabase()}
            className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-3 px-6 rounded-2xl shadow-lg transition-all"
          >
            🔄 Refresh Check
          </button>
        </div>

        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🔍</div>
          <h1 className="text-5xl font-bold text-cyan-600 mb-4">Database Diagnostic</h1>
          <p className="text-xl text-cyan-400">Checking data integrity and parsing issues</p>
        </div>

        {/* Errors */}
        {results?.errors && results.errors.length > 0 && (
          <div className="bg-red-50 border-2 border-red-400 rounded-2xl p-6 mb-6">
            <h2 className="text-2xl font-bold text-red-600 mb-4">❌ Errors</h2>
            {results.errors.map((error, idx) => (
              <div key={idx} className="text-red-700 mb-2">• {error}</div>
            ))}
          </div>
        )}

        {/* Summary Stats */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-6 border-2 border-slate-600 shadow-lg">
            <div className="text-4xl mb-2">📊</div>
            <div className="text-3xl font-bold text-cyan-600">{results?.totalStartups}</div>
            <div className="text-gray-600">Total Startups</div>
          </div>
          
          <div className="bg-white rounded-2xl p-6 border-2 border-slate-600 shadow-lg">
            <div className="text-4xl mb-2">🗳️</div>
            <div className="text-3xl font-bold text-cyan-600">{results?.totalVotes}</div>
            <div className="text-gray-600">Total Votes</div>
          </div>

          <div className={`bg-white rounded-2xl p-6 border-2 shadow-lg ${results?.invalidFivePoints ? results.invalidFivePoints > 0 ? 'border-red-400' : 'border-green-400' : 'border-slate-600'}`}>
            <div className="text-4xl mb-2">{results?.invalidFivePoints ? results.invalidFivePoints > 0 ? '⚠️' : '✅' : '⏳'}</div>
            <div className={`text-3xl font-bold ${results?.invalidFivePoints ? results.invalidFivePoints > 0 ? 'text-red-600' : 'text-green-600' : 'text-cyan-600'}`}>
              {results?.invalidFivePoints}
            </div>
            <div className="text-gray-600">Invalid Five Points</div>
          </div>

          <div className={`bg-white rounded-2xl p-6 border-2 shadow-lg ${results?.missingExtracted ? results.missingExtracted > 0 ? 'border-red-400' : 'border-green-400' : 'border-slate-600'}`}>
            <div className="text-4xl mb-2">{results?.missingExtracted ? results.missingExtracted > 0 ? '⚠️' : '✅' : '⏳'}</div>
            <div className={`text-3xl font-bold ${results?.missingExtracted ? results.missingExtracted > 0 ? 'text-red-600' : 'text-green-600' : 'text-cyan-600'}`}>
              {results?.missingExtracted}
            </div>
            <div className="text-gray-600">Missing Data</div>
          </div>
        </div>

        {/* Data Quality Issues */}
        <div className="bg-white rounded-2xl p-6 border-2 border-slate-600 shadow-lg mb-8">
          <h2 className="text-2xl font-bold text-cyan-600 mb-4">📋 Data Quality Report</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span>Missing Pitch</span>
              <span className={`font-bold ${results?.missingPitch === 0 ? 'text-green-600' : 'text-cyan-600'}`}>
                {results?.missingPitch} / {results?.totalStartups}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span>Missing Raise Amount</span>
              <span className={`font-bold ${results?.missingRaise === 0 ? 'text-green-600' : 'text-cyan-600'}`}>
                {results?.missingRaise} / {results?.totalStartups}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span>Missing Stage</span>
              <span className={`font-bold ${results?.missingStage === 0 ? 'text-green-600' : 'text-cyan-600'}`}>
                {results?.missingStage} / {results?.totalStartups}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span>Missing Extracted Data</span>
              <span className={`font-bold ${results?.missingExtracted === 0 ? 'text-green-600' : 'text-cyan-600'}`}>
                {results?.missingExtracted} / {results?.totalStartups}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span>Invalid Five Points (not 5 items)</span>
              <span className={`font-bold ${results?.invalidFivePoints === 0 ? 'text-green-600' : 'text-red-600'}`}>
                {results?.invalidFivePoints} / {results?.totalStartups}
              </span>
            </div>
          </div>
        </div>

        {/* Sample Data */}
        <div className="bg-white rounded-2xl p-6 border-2 border-slate-600 shadow-lg">
          <h2 className="text-2xl font-bold text-cyan-600 mb-4">📊 Recent Startups (First 5)</h2>
          <div className="space-y-6">
            {results?.recentStartups.slice(0, 5).map((startup, idx) => {
              const data = startup.extracted_data as any;
              const fivePointsValid = data?.fivePoints && Array.isArray(data.fivePoints) && data.fivePoints.length === 5;
              
              return (
                <div key={startup.id} className={`p-4 rounded-lg border-2 ${fivePointsValid ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-xl font-bold text-gray-800">{idx + 1}. {startup.name}</h3>
                      <div className="text-sm text-gray-500">ID: {startup.id}</div>
                    </div>
                    <div className={`text-2xl ${fivePointsValid ? '✅' : '❌'}`}>
                      {fivePointsValid ? '✅' : '❌'}
                    </div>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-3 text-sm mb-3">
                    <div><strong>Stage:</strong> {startup.stage || '❌ MISSING'}</div>
                    <div><strong>Raise:</strong> {startup.raise_amount || '❌ MISSING'}</div>
                    <div><strong>Status:</strong> {startup.status}</div>
                    <div><strong>Source:</strong> {startup.source_type}</div>
                  </div>

                  <div className="mb-3">
                    <strong>Pitch:</strong> {startup.pitch ? `${startup.pitch.substring(0, 100)}...` : '❌ MISSING'}
                  </div>

                  {data ? (
                    <div className="bg-white p-3 rounded border border-gray-200">
                      <strong className="block mb-2">Extracted Data:</strong>
                      <div className="text-sm space-y-1">
                        <div><strong>Problem:</strong> {data.problem?.substring(0, 80) || 'N/A'}...</div>
                        <div><strong>Solution:</strong> {data.solution?.substring(0, 80) || 'N/A'}...</div>
                        <div><strong>Team:</strong> {data.team?.substring(0, 80) || 'N/A'}...</div>
                        <div><strong>Industry:</strong> {data.industry || 'N/A'}</div>
                        <div className="mt-2">
                          <strong>Five Points ({data.fivePoints?.length || 0}/5):</strong>
                          {data.fivePoints && data.fivePoints.length > 0 ? (
                            <ol className="list-decimal list-inside pl-2 mt-1 space-y-1">
                              {data.fivePoints.map((point: string, i: number) => (
                                <li key={i} className="text-xs">{point.substring(0, 80)}...</li>
                              ))}
                            </ol>
                          ) : (
                            <div className="text-red-600 ml-2">❌ No five points data</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-red-50 p-3 rounded border border-red-300 text-red-700">
                      ❌ No extracted_data field
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
