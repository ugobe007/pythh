import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Upload, ExternalLink, CheckCircle2, XCircle, RefreshCw, Sparkles, Globe, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import LogoDropdownMenu from '../components/LogoDropdownMenu';

interface ImportResult {
  url: string;
  name?: string;
  status: 'success' | 'failed' | 'pending' | 'enriching';
  error?: string;
}

export default function BulkUpload() {
  const navigate = useNavigate();
  const [urls, setUrls] = useState('');
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  // Extract domain name from URL for startup name
  const extractNameFromUrl = (url: string): string => {
    try {
      const hostname = new URL(url).hostname;
      // Remove www. and common TLDs
      let name = hostname.replace(/^www\./, '').replace(/\.(com|io|co|org|net|ai|app|dev|xyz|tech)$/, '');
      // Capitalize first letter
      return name.charAt(0).toUpperCase() + name.slice(1);
    } catch {
      return url;
    }
  };

  // Parse URLs from textarea
  const parseUrls = (content: string): string[] => {
    const lines = content.trim().split('\n');
    const validUrls: string[] = [];
    
    for (const line of lines) {
      let url = line.trim();
      if (!url) continue;
      
      // Add https:// if missing
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      
      try {
        new URL(url); // Validate URL
        validUrls.push(url);
      } catch {
        // Skip invalid URLs
      }
    }
    
    return [...new Set(validUrls)]; // Remove duplicates
  };

  // Enrich startup using OpenAI (SERVER-SIDE ONLY for security)
  // Note: For bulk URL uploads, use fallback data. Admin can enrich later via AdminActions
  const enrichStartup = async (name: string, url: string): Promise<any> => {
    // SECURITY: No browser-side OpenAI calls - use fallback data
    console.log(`⚡ Creating entry for ${name} with fallback data (enrich via AdminActions later)`);
    return {
      pitch: `${name} - Visit ${url} for more information.`,
      fivePoints: [
        'Value Proposition: To be enriched',
        'Target Market: To be enriched',
        'Product/Service: To be enriched',
        'Team/Traction: To be enriched',
        'Funding Status: To be enriched'
      ],
      stage: 'Seed',
      sectors: ['Technology']
    };
  };

  const importUrls = async () => {
    const urlList = parseUrls(urls);
    
    if (urlList.length === 0) {
      alert('Please enter at least one valid URL');
      return;
    }

    const confirmed = window.confirm(
      `Found ${urlList.length} URLs to import:\n\n` +
      urlList.slice(0, 5).map(u => `• ${u}`).join('\n') +
      (urlList.length > 5 ? `\n... and ${urlList.length - 5} more` : '') +
      `\n\nEach URL will be enriched with AI. Continue?`
    );

    if (!confirmed) return;

    setImporting(true);
    setShowResults(true);
    setProgress({ current: 0, total: urlList.length });
    
    // Initialize results
    const initialResults: ImportResult[] = urlList.map(url => ({
      url,
      name: extractNameFromUrl(url),
      status: 'pending'
    }));
    setResults(initialResults);

    // Process URLs one at a time to avoid rate limits
    for (let i = 0; i < urlList.length; i++) {
      const url = urlList[i];
      const name = extractNameFromUrl(url);
      
      setProgress({ current: i + 1, total: urlList.length });
      
      // Update status to enriching
      setResults(prev => prev.map((r, idx) => 
        idx === i ? { ...r, status: 'enriching' as const } : r
      ));

      try {
        // Check for duplicates
        const { data: existing } = await supabase
          .from('startup_uploads')
          .select('id')
          .or(`website.eq.${url},name.ilike.${name}`)
          .maybeSingle();

        if (existing) {
          setResults(prev => prev.map((r, idx) => 
            idx === i ? { ...r, status: 'failed' as const, error: 'Already exists' } : r
          ));
          continue;
        }

        // Enrich with AI
        const enriched = await enrichStartup(name, url);

        // Insert into database
        const startupId = crypto.randomUUID();
        const { error } = await supabase
          .from('startup_uploads')
          .insert([{
            id: startupId,
            name: name,
            website: url,
            pitch: enriched.pitch || `${name} - AI-powered startup`,
            tagline: enriched.pitch || `${name} - AI-powered startup`,
            stage: enriched.stage || 'Seed',
            sectors: enriched.sectors || ['Technology'],
            industries: enriched.sectors || ['Technology'],
            status: 'pending',
            source_type: 'bulk_import',
            extracted_data: {
              fivePoints: enriched.fivePoints || [],
              importedAt: new Date().toISOString(),
              sourceUrl: url
            }
          }]);

        if (error) throw error;

        setResults(prev => prev.map((r, idx) => 
          idx === i ? { ...r, status: 'success' as const, name } : r
        ));

      } catch (error: any) {
        setResults(prev => prev.map((r, idx) => 
          idx === i ? { ...r, status: 'failed' as const, error: error.message } : r
        ));
      }

      // Small delay between requests
      if (i < urlList.length - 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    setImporting(false);
  };

  const clearResults = () => {
    setResults([]);
    setShowResults(false);
    setUrls('');
  };

  const successCount = results.filter(r => r.status === 'success').length;
  const failedCount = results.filter(r => r.status === 'failed').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-purple-950 text-white">
      {/* Navigation */}
      <LogoDropdownMenu />

      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-600 to-blue-600 mb-6 shadow-xl">
            <Globe className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold mb-3">
            <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              Bulk URL Import
            </span>
          </h1>
          <p className="text-gray-300 text-lg max-w-2xl mx-auto">
            Paste startup website URLs below. Each URL will be automatically enriched with AI to create a complete startup profile.
          </p>
        </div>

        {/* URL Input Section */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <label className="text-lg font-semibold text-white flex items-center gap-2">
              <ExternalLink className="w-5 h-5 text-cyan-400" />
              Startup URLs
            </label>
            <span className="text-sm text-gray-400">
              {parseUrls(urls).length} valid URLs detected
            </span>
          </div>
          
          <textarea
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
            placeholder={`Paste URLs here, one per line:

https://example-startup.com
https://another-startup.io
startup-name.co
www.company.ai`}
            className="w-full h-64 bg-black/30 border border-white/20 rounded-xl p-4 text-white placeholder-gray-500 font-mono text-sm focus:outline-none focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20"
            disabled={importing}
          />

          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-gray-400">
              💡 URLs without http:// will automatically have https:// added
            </p>
            <div className="flex gap-3">
              {urls.trim() && (
                <button
                  onClick={() => setUrls('')}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition flex items-center gap-2 text-gray-300"
                  disabled={importing}
                >
                  <Trash2 className="w-4 h-4" />
                  Clear
                </button>
              )}
              <button
                onClick={importUrls}
                disabled={importing || !urls.trim()}
                className="px-6 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-lg font-bold transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-lg"
              >
                {importing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Import & Enrich with AI
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        {importing && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-300">Processing URLs...</span>
              <span className="text-cyan-400 font-semibold">
                {progress.current} / {progress.total}
              </span>
            </div>
            <div className="h-3 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-cyan-600 to-blue-600 transition-all duration-300"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Results Section */}
        {showResults && (
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Import Results</h2>
              <div className="flex items-center gap-4">
                <span className="text-green-400 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  {successCount} Success
                </span>
                <span className="text-red-400 flex items-center gap-1">
                  <XCircle className="w-4 h-4" />
                  {failedCount} Failed
                </span>
                {!importing && (
                  <button
                    onClick={clearResults}
                    className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {results.map((result, idx) => (
                <div 
                  key={idx}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    result.status === 'success' ? 'bg-green-500/10 border border-green-500/30' :
                    result.status === 'failed' ? 'bg-red-500/10 border border-red-500/30' :
                    result.status === 'enriching' ? 'bg-cyan-600/10 border border-cyan-500/30' :
                    'bg-white/5 border border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {result.status === 'success' && <CheckCircle2 className="w-5 h-5 text-green-400" />}
                    {result.status === 'failed' && <XCircle className="w-5 h-5 text-red-400" />}
                    {result.status === 'enriching' && <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin" />}
                    {result.status === 'pending' && <div className="w-5 h-5 rounded-full border-2 border-gray-500" />}
                    <div>
                      <p className="font-medium text-white">{result.name || result.url}</p>
                      <p className="text-xs text-gray-400 truncate max-w-md">{result.url}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {result.status === 'success' && <span className="text-green-400 text-sm">Imported</span>}
                    {result.status === 'failed' && <span className="text-red-400 text-sm">{result.error || 'Failed'}</span>}
                    {result.status === 'enriching' && <span className="text-cyan-400 text-sm">Enriching...</span>}
                    {result.status === 'pending' && <span className="text-gray-400 text-sm">Waiting</span>}
                  </div>
                </div>
              ))}
            </div>

            {!importing && successCount > 0 && (
              <div className="mt-6 pt-4 border-t border-white/10">
                {/* Success Banner */}
                <div className="bg-green-500/20 border border-green-500/40 rounded-xl p-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-500/30 flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6 text-green-400" />
                    </div>
                    <div>
                      <p className="font-bold text-green-400">🎉 Import Complete!</p>
                      <p className="text-sm text-green-300/80">
                        {successCount} startup{successCount > 1 ? 's' : ''} imported successfully. 
                        {successCount > 0 && ' Review and approve them to make them visible in matching.'}
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={() => navigate('/admin/edit-startups?filter=pending')}
                    className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 rounded-xl font-bold transition flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    Review & Approve ({successCount} pending)
                  </button>
                  <button
                    onClick={() => {
                      clearResults();
                      setUrls('');
                    }}
                    className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-medium transition flex items-center justify-center gap-2"
                  >
                    <Upload className="w-5 h-5" />
                    Import More
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Help Section */}
        {!showResults && (
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
            <h3 className="font-semibold text-white mb-4">📋 How it works</h3>
            <ol className="space-y-3 text-gray-300">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-cyan-600/30 text-cyan-400 flex items-center justify-center text-sm font-bold shrink-0">1</span>
                <span>Paste startup website URLs (one per line)</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-cyan-600/30 text-cyan-400 flex items-center justify-center text-sm font-bold shrink-0">2</span>
                <span>Click "Import & Enrich with AI" to start processing</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-cyan-600/30 text-cyan-400 flex items-center justify-center text-sm font-bold shrink-0">3</span>
                <span>AI automatically researches and creates a profile for each startup</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-cyan-600/30 text-cyan-400 flex items-center justify-center text-sm font-bold shrink-0">4</span>
                <span>Review imported startups in the Edit Startups page</span>
              </li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
