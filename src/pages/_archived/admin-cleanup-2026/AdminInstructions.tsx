import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Home, ArrowLeft, Database, Brain, Zap, Target, Rss, Trophy } from 'lucide-react';
import LogoDropdownMenu from '../components/LogoDropdownMenu';

export default function AdminInstructions() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      {/* Navigation */}
      <LogoDropdownMenu />

      <div className="p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-blue-500 bg-clip-text text-transparent mb-2">
            📚 Admin Instructions
          </h1>
          <p className="text-gray-400">Complete guide to using pyth ai admin tools</p>
        </div>

        {/* Quick Navigation */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <button
            onClick={() => navigate('/admin/discovered-startups')}
            className="p-4 bg-purple-500/20 backdrop-blur-sm rounded-xl hover:bg-purple-500/30 transition-all text-left"
          >
            <Rss className="w-8 h-8 text-purple-400 mb-2" />
            <h3 className="font-semibold">RSS Discoveries</h3>
            <p className="text-sm text-gray-400">Review scraped startups</p>
          </button>
          <button
            onClick={() => navigate('/admin/edit-startups')}
            className="p-4 bg-cyan-600/20 backdrop-blur-sm rounded-xl hover:bg-cyan-600/30 transition-all text-left"
          >
            <Database className="w-8 h-8 text-cyan-400 mb-2" />
            <h3 className="font-semibold">Review Queue</h3>
            <p className="text-sm text-gray-400">Approve/reject submissions</p>
          </button>
          <button
            onClick={() => navigate('/admin/ai-intelligence')}
            className="p-4 bg-cyan-500/20 backdrop-blur-sm rounded-xl hover:bg-cyan-500/30 transition-all text-left"
          >
            <Brain className="w-8 h-8 text-cyan-400 mb-2" />
            <h3 className="font-semibold">AI Intelligence</h3>
            <p className="text-sm text-gray-400">ML model performance</p>
          </button>
        </div>

        {/* Main Content */}
        <div className="space-y-8">
          {/* Workflow Overview */}
          <section className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Target className="w-6 h-6 text-green-400" />
              Complete Workflow
            </h2>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center font-bold">1</div>
                <div>
                  <h3 className="font-semibold text-purple-400">Automatic Scraping</h3>
                  <p className="text-gray-400">Continuous scraper runs 24/7 discovering startups from RSS feeds</p>
                  <p className="text-sm text-gray-500 mt-1">
                    • RSS feeds every 30 minutes<br/>
                    • Startup discovery every 1 hour<br/>
                    • VC enrichment every 2 hours
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-cyan-600 rounded-full flex items-center justify-center font-bold">2</div>
                <div>
                  <h3 className="font-semibold text-cyan-400">Review RSS Discoveries</h3>
                  <p className="text-gray-400">Go to RSS Discoveries page to see what the scraper found</p>
                  <p className="text-sm text-gray-500 mt-1">Location: Admin → Live System Monitor → 📡 RSS Feed</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-cyan-500 rounded-full flex items-center justify-center font-bold">3</div>
                <div>
                  <h3 className="font-semibold text-cyan-400">Select & Import</h3>
                  <p className="text-gray-400">Select startups you want, click "Import Selected" - AI enriches them automatically</p>
                  <p className="text-sm text-gray-500 mt-1">AI adds: value proposition, problem, solution, team, investment details</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center font-bold">4</div>
                <div>
                  <h3 className="font-semibold text-green-400">Review & Approve</h3>
                  <p className="text-gray-400">Check imported startups in Review Queue, approve or reject</p>
                  <p className="text-sm text-gray-500 mt-1">Location: Admin → Review Queue (or success banner link)</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-cyan-600 rounded-full flex items-center justify-center font-bold">5</div>
                <div>
                  <h3 className="font-semibold text-cyan-400">Goes Live</h3>
                  <p className="text-gray-400">Approved startups appear on main site for users to vote</p>
                  <p className="text-sm text-gray-500 mt-1">Published status = visible to public</p>
                </div>
              </div>
            </div>
          </section>

          {/* Page Guide */}
          <section className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
            <h2 className="text-2xl font-bold mb-4">📍 Where to Find Things</h2>
            
            <div className="space-y-6">
              {/* RSS Discoveries */}
              <div className="border-l-4 border-purple-500 pl-4">
                <h3 className="text-xl font-semibold text-purple-400 mb-2 flex items-center gap-2">
                  <Rss className="w-5 h-5" />
                  RSS Discoveries
                </h3>
                <p className="text-gray-300 mb-2"><strong>What:</strong> Startups found by the automatic scraper</p>
                <p className="text-gray-300 mb-2"><strong>Where:</strong> Admin Dashboard → Live System Monitor → Click "📡 RSS Feed" card</p>
                <p className="text-gray-300 mb-2"><strong>Or:</strong> <code className="bg-black/30 px-2 py-1 rounded">/admin/discovered-startups</code></p>
                <p className="text-gray-300 mb-2"><strong>What you can do:</strong></p>
                <ul className="list-disc list-inside text-gray-400 space-y-1 ml-4">
                  <li>See all startups discovered from RSS feeds</li>
                  <li>Select multiple startups with checkboxes</li>
                  <li>Click "Import Selected" to add to database with AI enrichment</li>
                  <li>Search/filter by name or source</li>
                  <li>Mark as imported to hide from list</li>
                </ul>
              </div>

              {/* Review Queue */}
              <div className="border-l-4 border-cyan-500 pl-4">
                <h3 className="text-xl font-semibold text-cyan-400 mb-2 flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  Review Queue (Manual Uploads)
                </h3>
                <p className="text-gray-300 mb-2"><strong>What:</strong> Startups uploaded via CSV or manual form (NOT RSS imports)</p>
                <p className="text-gray-300 mb-2"><strong>Where:</strong> Direct link: <code className="bg-black/30 px-2 py-1 rounded">/admin/edit-startups</code></p>
                <p className="text-gray-300 mb-2"><strong>What you can do:</strong></p>
                <ul className="list-disc list-inside text-gray-400 space-y-1 ml-4">
                  <li>Review manually uploaded startups (pending status)</li>
                  <li>Click "Approve" to publish to main site</li>
                  <li>Click "Reject" to remove from queue</li>
                  <li>Edit startup details before approval</li>
                </ul>
                <p className="text-yellow-400 text-sm mt-2">⚠️ Note: RSS imports go directly to startups table (not here)</p>
              </div>

              {/* AI Intelligence */}
              <div className="border-l-4 border-cyan-500 pl-4">
                <h3 className="text-xl font-semibold text-cyan-400 mb-2 flex items-center gap-2">
                  <Brain className="w-5 h-5" />
                  AI Intelligence
                </h3>
                <p className="text-gray-300 mb-2"><strong>What:</strong> Machine learning model performance and RSS data analysis</p>
                <p className="text-gray-300 mb-2"><strong>Where:</strong> Admin Dashboard → Live System Monitor → Click "🧠 ML Engine" card</p>
                <p className="text-gray-300 mb-2"><strong>Or:</strong> <code className="bg-black/30 px-2 py-1 rounded">/admin/ai-intelligence</code></p>
                <p className="text-gray-300 mb-2"><strong>What you see:</strong></p>
                <ul className="list-disc list-inside text-gray-400 space-y-1 ml-4">
                  <li>RSS articles scraped count and trends</li>
                  <li>ML model accuracy (how good AI predictions are)</li>
                  <li>Hot sectors detected from news</li>
                  <li>Matches optimized by AI</li>
                </ul>
              </div>

              {/* AI Optimization / Matching / GOD */}
              <div className="border-l-4 border-green-500 pl-4">
                <h3 className="text-xl font-semibold text-green-400 mb-2 flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  AI Optimization / Matching Engine / GOD Scoring
                </h3>
                <p className="text-gray-300 mb-2"><strong>What:</strong> Advanced startup scoring and matching algorithms</p>
                <p className="text-gray-300 mb-2"><strong>Where:</strong> Admin Dashboard → Live System Monitor → Click any of these cards:</p>
                <ul className="list-disc list-inside text-gray-400 space-y-1 ml-4">
                  <li>⚡ AI Optimization</li>
                  <li>🎯 Matching Engine</li>
                  <li>🏆 GOD Scoring</li>
                </ul>
                <p className="text-gray-300 mb-2"><strong>All go to:</strong> <code className="bg-black/30 px-2 py-1 rounded">/admin/edit-startups</code></p>
                <p className="text-gray-300 mb-2"><strong>Why:</strong> These features analyze startups in the review queue</p>
              </div>

              {/* Bulk Import */}
              <div className="border-l-4 border-cyan-500 pl-4">
                <h3 className="text-xl font-semibold text-cyan-400 mb-2">📤 Bulk Import</h3>
                <p className="text-gray-300 mb-2"><strong>What:</strong> Upload many startups at once via CSV file</p>
                <p className="text-gray-300 mb-2"><strong>Where:</strong> <code className="bg-black/30 px-2 py-1 rounded">/admin/bulk-import</code></p>
                <p className="text-gray-300 mb-2"><strong>What you can do:</strong></p>
                <ul className="list-disc list-inside text-gray-400 space-y-1 ml-4">
                  <li>Download CSV template</li>
                  <li>Fill in startup data</li>
                  <li>Upload CSV to import hundreds at once</li>
                  <li>All imports go to Review Queue for approval</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Navigation Tips */}
          <section className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
            <h2 className="text-2xl font-bold mb-4">🧭 Navigation Tips</h2>
            <div className="space-y-3 text-gray-300">
              <p><strong>Fixed Navigation Bar:</strong> Top-right of every admin page has quick links</p>
              <p><strong>System Monitor Cards:</strong> Click any card on admin dashboard to jump to that feature</p>
              <p><strong>Success Banners:</strong> After importing, click "View in Review Queue" to jump there</p>
              <p><strong>Help Button:</strong> Click "📚 Instructions" on any admin page to return here</p>
              <p><strong>Breadcrumbs:</strong> Look for back arrows to navigate up</p>
            </div>
          </section>

          {/* Common Tasks */}
          <section className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
            <h2 className="text-2xl font-bold mb-4">✅ Common Tasks</h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-purple-400 mb-2">How do I see what the scraper found?</h3>
                <p className="text-gray-300">Admin → Live System Monitor → Click "📡 RSS Feed" card → RSS Discoveries page</p>
              </div>

              <div>
                <h3 className="font-semibold text-cyan-400 mb-2">How do I approve a startup?</h3>
                <p className="text-gray-300">Go to Review Queue (/admin/edit-startups) → Find startup → Click "Approve"</p>
              </div>

              <div>
                <h3 className="font-semibold text-cyan-400 mb-2">How do I import RSS discoveries?</h3>
                <p className="text-gray-300">RSS Discoveries page → Check boxes → Click "Import Selected" → AI enriches automatically</p>
              </div>

              <div>
                <h3 className="font-semibold text-green-400 mb-2">Where do imported startups go?</h3>
                <p className="text-gray-300">Directly to main startups table with "pending" status (NOT to Review Queue)</p>
              </div>

              <div>
                <h3 className="font-semibold text-cyan-400 mb-2">How do I upload multiple startups?</h3>
                <p className="text-gray-300">Bulk Import (/admin/bulk-import) → Download template → Fill CSV → Upload</p>
              </div>

              <div>
                <h3 className="font-semibold text-yellow-400 mb-2">Is the scraper running?</h3>
                <p className="text-gray-300">Check terminal: <code className="bg-black/30 px-2 py-1 rounded">ps aux | grep continuous-scraper</code></p>
                <p className="text-gray-300 text-sm mt-1">Start it: <code className="bg-black/30 px-2 py-1 rounded">npm run scrape:bg</code></p>
              </div>
            </div>
          </section>

          {/* Troubleshooting */}
          <section className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
            <h2 className="text-2xl font-bold mb-4">🔧 Troubleshooting</h2>
            <div className="space-y-3">
              <div>
                <h3 className="font-semibold text-red-400 mb-1">No startups showing in RSS Discoveries?</h3>
                <ul className="list-disc list-inside text-gray-300 ml-4 space-y-1">
                  <li>Check if scraper is running: <code className="bg-black/30 px-1 rounded text-sm">npm run scrape:bg</code></li>
                  <li>View logs: <code className="bg-black/30 px-1 rounded text-sm">tail -f scraper.log</code></li>
                  <li>Run discovery manually: <code className="bg-black/30 px-1 rounded text-sm">npm run discover</code></li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-red-400 mb-1">Import button not working?</h3>
                <ul className="list-disc list-inside text-gray-300 ml-4 space-y-1">
                  <li>Check browser console for errors (F12)</li>
                  <li>Verify OpenAI API key is set: <code className="bg-black/30 px-1 rounded text-sm">VITE_OPENAI_API_KEY</code></li>
                  <li>Check Supabase connection</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-red-400 mb-1">Page not loading?</h3>
                <ul className="list-disc list-inside text-gray-300 ml-4 space-y-1">
                  <li>Make sure dev server is running: <code className="bg-black/30 px-1 rounded text-sm">npm run dev</code></li>
                  <li>Check backend server: <code className="bg-black/30 px-1 rounded text-sm">cd server && npm start</code></li>
                  <li>Clear browser cache and refresh</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Documentation Links */}
          <section className="bg-gradient-to-r from-purple-500/20 to-violet-500/20 backdrop-blur-sm rounded-xl p-6 border border-purple-500/30">
            <h2 className="text-2xl font-bold mb-4">📖 More Documentation</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-black/30 p-3 rounded-lg">
                <h3 className="font-semibold mb-1">Continuous Scraper</h3>
                <p className="text-sm text-gray-400">CONTINUOUS_SCRAPER_GUIDE.md</p>
              </div>
              <div className="bg-black/30 p-3 rounded-lg">
                <h3 className="font-semibold mb-1">Startup Discovery</h3>
                <p className="text-sm text-gray-400">STARTUP_DISCOVERY_GUIDE.md</p>
              </div>
              <div className="bg-black/30 p-3 rounded-lg">
                <h3 className="font-semibold mb-1">Bulk Import</h3>
                <p className="text-sm text-gray-400">BULK_UPLOAD_README.md</p>
              </div>
              <div className="bg-black/30 p-3 rounded-lg">
                <h3 className="font-semibold mb-1">Admin Guide</h3>
                <p className="text-sm text-gray-400">ADMIN_GUIDE.md</p>
              </div>
            </div>
          </section>
        </div>
      </div>
      </div>
    </div>
  );
}
