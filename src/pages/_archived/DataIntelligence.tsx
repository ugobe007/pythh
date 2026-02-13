import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CrawlerOrchestrator } from '../lib/crawlers/orchestrator';
import { DailyReport, CrawlerResult } from '../lib/crawlers/types';

export default function DataIntelligence() {
  const [orchestrator] = useState(() => new CrawlerOrchestrator());
  const [latestReport, setLatestReport] = useState<DailyReport | null>(null);
  const [isCrawling, setIsCrawling] = useState(false);
  const [crawlerResults, setCrawlerResults] = useState<CrawlerResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLatestReport();
  }, []);

  const loadLatestReport = async () => {
    setLoading(true);
    try {
      const report = await orchestrator.getLatestReport();
      setLatestReport(report);
    } catch (error) {
      console.error('Failed to load report:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRunCrawlers = async () => {
    setIsCrawling(true);
    try {
      const result = await orchestrator.runAllCrawlers();
      setCrawlerResults(result.results);
      alert(`✅ Crawlers completed! Found ${result.results.reduce((sum, r) => sum + r.itemsFound, 0)} items`);
      
      // Generate new report
      await handleGenerateReport();
    } catch (error) {
      console.error('Crawler error:', error);
      alert('❌ Crawler failed. Check console for details.');
    } finally {
      setIsCrawling(false);
    }
  };

  const handleGenerateReport = async () => {
    try {
      const report = await orchestrator.generateDailyReport();
      setLatestReport(report);
      alert('📊 Daily report generated!');
    } catch (error) {
      console.error('Report generation error:', error);
      alert('❌ Failed to generate report');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900">
      {/* Navigation */}
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
        <div className="flex gap-2 items-center">
          <Link to="/" className="text-5xl hover:scale-110 transition-transform">🍯</Link>
          <Link to="/admin/dashboard" className="px-4 py-2 bg-cyan-600 text-white rounded-full font-bold hover:bg-cyan-700">
            Admin Dashboard
          </Link>
          <Link to="/data-intelligence" className="px-4 py-2 bg-purple-600 text-white rounded-full font-bold">
            📊 Data Intelligence
          </Link>
        </div>
      </div>

      <div className="pt-24 px-8 pb-16">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-5xl font-black text-white mb-4">
              🕷️ Data Intelligence Hub
            </h1>
            <p className="text-xl text-purple-200">
              Automated data crawlers tracking funding, startups, investors, and hot deals
            </p>
          </div>

          {/* Control Panel */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-8 border-2 border-white/20">
            <h2 className="text-2xl font-black text-white mb-4">🎮 Control Panel</h2>
            <div className="flex gap-4 flex-wrap">
              <button
                onClick={handleRunCrawlers}
                disabled={isCrawling}
                className="px-6 py-3 bg-gradient-to-r from-green-500 to-blue-500 text-white font-black rounded-xl hover:from-green-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              >
                {isCrawling ? '⏳ Running Crawlers...' : '🚀 Run All Crawlers'}
              </button>
              <button
                onClick={handleGenerateReport}
                className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-black rounded-xl hover:from-purple-600 hover:to-pink-600 shadow-lg"
              >
                📊 Generate Report
              </button>
              <button
                onClick={loadLatestReport}
                className="px-6 py-3 bg-gray-600 text-white font-black rounded-xl hover:bg-gray-700 shadow-lg"
              >
                🔄 Refresh
              </button>
            </div>
          </div>

          {/* Crawler Results */}
          {crawlerResults.length > 0 && (
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-8 border-2 border-white/20">
              <h2 className="text-2xl font-black text-white mb-4">🕸️ Latest Crawler Run</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {crawlerResults.map((result, idx) => (
                  <div key={idx} className="bg-white/10 rounded-xl p-4 border border-white/20">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-2xl ${result.success ? '✅' : '❌'}`}>
                        {result.success ? '✅' : '❌'}
                      </span>
                      <span className="text-white font-bold">{result.dataType}</span>
                    </div>
                    <p className="text-purple-200 text-sm">
                      Found: <span className="font-bold text-yellow-300">{result.itemsFound}</span> items
                    </p>
                    {result.error && (
                      <p className="text-red-300 text-xs mt-2">{result.error}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Daily Report */}
          {latestReport ? (
            <div className="space-y-8">
              {/* Report Header */}
              <div className="bg-gradient-to-br from-cyan-400 via-blue-500 to-violet-500 rounded-2xl p-8 shadow-2xl">
                <h2 className="text-3xl font-black text-white mb-2">
                  📅 Daily Report - {new Date(latestReport.date).toLocaleDateString()}
                </h2>
                <p className="text-white/90 text-sm">
                  Generated at {new Date(latestReport.generatedAt).toLocaleString()}
                </p>
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <MetricCard
                  icon="💰"
                  label="Total Funding"
                  value={latestReport.totalFundingAmount}
                  color="from-green-500 to-emerald-600"
                />
                <MetricCard
                  icon="📢"
                  label="Funding Deals"
                  value={latestReport.totalFundingAnnouncements.toString()}
                  color="from-blue-500 to-cyan-600"
                />
                <MetricCard
                  icon="🚀"
                  label="New Startups"
                  value={latestReport.newStartupsDiscovered.toString()}
                  color="from-purple-500 to-pink-600"
                />
                <MetricCard
                  icon="💼"
                  label="Active Investors"
                  value={latestReport.activeInvestors.toString()}
                  color="from-cyan-500 to-blue-600"
                />
                <MetricCard
                  icon="🔥"
                  label="Hot Deals"
                  value={latestReport.hotDealsCount.toString()}
                  color="from-red-500 to-rose-600"
                />
              </div>

              {/* Insights */}
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border-2 border-white/20">
                <h3 className="text-2xl font-black text-white mb-4">💡 Key Insights</h3>
                <div className="space-y-3">
                  {latestReport.insights.map((insight, idx) => (
                    <div key={idx} className="bg-white/5 rounded-lg p-4 border border-white/10">
                      <p className="text-purple-100">{insight}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Trending Industries */}
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border-2 border-white/20">
                <h3 className="text-2xl font-black text-white mb-4">📈 Trending Industries</h3>
                <div className="space-y-2">
                  {latestReport.trendingIndustries.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                      <span className="text-purple-100 font-bold">{item.industry}</span>
                      <span className="text-yellow-300 font-black">{item.count} mentions</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Investors */}
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border-2 border-white/20">
                <h3 className="text-2xl font-black text-white mb-4">🏆 Most Active Investors</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {latestReport.trendingInvestors.map((investor, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                      <span className="text-purple-100 font-bold">
                        {idx + 1}. {investor.name}
                      </span>
                      <span className="text-green-300 font-black">{investor.dealCount} deals</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Average Round Sizes */}
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border-2 border-white/20">
                <h3 className="text-2xl font-black text-white mb-4">💵 Average Round Sizes</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(latestReport.averageRoundSize).map(([round, size]) => (
                    <div key={round} className="bg-white/5 rounded-lg p-4 text-center">
                      <p className="text-purple-200 text-sm mb-1">{round}</p>
                      <p className="text-yellow-300 font-black text-xl">{size}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Fundings */}
              {latestReport.topFundings.length > 0 && (
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border-2 border-white/20">
                  <h3 className="text-2xl font-black text-white mb-4">🚀 Top Funding Rounds</h3>
                  <div className="space-y-3">
                    {latestReport.topFundings.map((funding, idx) => (
                      <div key={idx} className="bg-white/5 rounded-lg p-4 border border-white/10">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="text-xl font-black text-yellow-300">{funding.companyName}</h4>
                          <span className="text-green-400 font-black">{funding.amount}</span>
                        </div>
                        <p className="text-purple-200 text-sm mb-2">{funding.description}</p>
                        <div className="flex flex-wrap gap-2">
                          <span className="px-2 py-1 bg-blue-500/30 text-blue-200 rounded-full text-xs font-bold">
                            {funding.roundType}
                          </span>
                          {funding.investors.map((investor, i) => (
                            <span key={i} className="px-2 py-1 bg-purple-500/30 text-purple-200 rounded-full text-xs">
                              {investor}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Hot Deals */}
              {latestReport.hotDeals.length > 0 && (
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border-2 border-white/20">
                  <h3 className="text-2xl font-black text-white mb-4">🔥 Hot Deals</h3>
                  <div className="space-y-3">
                    {latestReport.hotDeals.map((deal: any, idx: number) => (
                      <div key={idx} className="bg-white/5 rounded-lg p-4 border border-white/10">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="text-xl font-black text-cyan-300">{deal.companyName}</h4>
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                            deal.significance === 'high' ? 'bg-red-500/30 text-red-200' :
                            deal.significance === 'medium' ? 'bg-yellow-500/30 text-yellow-200' :
                            'bg-gray-500/30 text-gray-200'
                          }`}>
                            {deal.significance}
                          </span>
                        </div>
                        <p className="text-white font-bold mb-2">{deal.headline}</p>
                        <p className="text-purple-200 text-sm">{deal.summary}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-12 text-center border-2 border-white/20">
              <p className="text-2xl text-white font-bold mb-4">📊 No reports available yet</p>
              <p className="text-purple-200 mb-6">Run the crawlers to generate your first daily report</p>
              <button
                onClick={handleRunCrawlers}
                disabled={isCrawling}
                className="px-8 py-3 bg-gradient-to-r from-green-500 to-blue-500 text-white font-black rounded-xl hover:from-green-600 hover:to-blue-600 shadow-lg"
              >
                🚀 Start Crawling
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface MetricCardProps {
  icon: string;
  label: string;
  value: string;
  color: string;
}

function MetricCard({ icon, label, value, color }: MetricCardProps) {
  return (
    <div className={`bg-gradient-to-br ${color} rounded-2xl p-6 shadow-xl`}>
      <div className="text-4xl mb-2">{icon}</div>
      <p className="text-white/90 text-sm mb-1">{label}</p>
      <p className="text-3xl font-black text-white">{value}</p>
    </div>
  );
}
