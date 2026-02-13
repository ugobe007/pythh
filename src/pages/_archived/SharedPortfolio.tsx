import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const INDUSTRIES = [
  { id: 'fintech', name: 'FinTech', emoji: '💰' },
  { id: 'ai', name: 'AI/ML', emoji: '🤖' },
  { id: 'saas', name: 'SaaS', emoji: '☁️' },
  { id: 'deeptech', name: 'Deep Tech', emoji: '🔬' },
  { id: 'robotics', name: 'Robotics', emoji: '🦾' },
  { id: 'healthtech', name: 'HealthTech', emoji: '🏥' },
  { id: 'edtech', name: 'EdTech', emoji: '📚' },
  { id: 'cleantech', name: 'CleanTech', emoji: '🌱' },
  { id: 'ecommerce', name: 'E-Commerce', emoji: '🛒' },
  { id: 'crypto', name: 'Crypto/Web3', emoji: '₿' },
  { id: 'consumer', name: 'Consumer', emoji: '🛍️' },
  { id: 'enterprise', name: 'Enterprise', emoji: '🏢' },
];

export default function SharedPortfolio() {
  const { shareId } = useParams();
  const navigate = useNavigate();
  const [shareData, setShareData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filteredStartups, setFilteredStartups] = useState<any[]>([]);

  useEffect(() => {
    // Load shared portfolio data
    const shares = localStorage.getItem('portfolioShares');
    if (shares && shareId) {
      const allShares = JSON.parse(shares);
      const data = allShares[shareId];
      
      if (data) {
        setShareData(data);
        
        // Filter startups by selected industries
        if (data.industries && data.industries.length > 0) {
          // In a real app, we'd fetch full startup data from backend
          // For now, filter what we have
          const filtered = data.startups; // Would filter by industries here
          setFilteredStartups(filtered);
        } else {
          setFilteredStartups(data.startups);
        }
      }
    }
    setLoading(false);
  }, [shareId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-green-400 to-purple-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">🔮</div>
          <p className="text-2xl text-white font-bold">Loading portfolio...</p>
        </div>
      </div>
    );
  }

  if (!shareData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-green-400 to-purple-950 flex items-center justify-center p-8">
        <div className="bg-white rounded-3xl p-12 text-center max-w-2xl">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-3xl font-bold text-gray-800 mb-4">Portfolio Not Found</h1>
          <p className="text-lg text-gray-600 mb-6">
            This share link may have expired or been removed.
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-8 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-2xl transition-all"
          >
            Go to pyth ai
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-green-400 to-purple-950 p-8 relative">
      {/* Radial green accent */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute w-96 h-96 bg-green-400 rounded-full blur-3xl opacity-40" style={{left: '20%', top: '40%'}}></div>
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="text-7xl mb-4">🔮</div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-500 bg-clip-text text-transparent mb-3">
            {shareData.investorName}'s Hot Picks
          </h1>
          <p className="text-xl text-purple-200 mb-2">
            Shared {filteredStartups.length} startup{filteredStartups.length !== 1 ? 's' : ''}
          </p>
          {shareData.industries && shareData.industries.length > 0 && (
            <div className="flex gap-2 justify-center flex-wrap mt-4">
              {shareData.industries.map((indId: string) => {
                const industry = INDUSTRIES.find(i => i.id === indId);
                return industry ? (
                  <span key={indId} className="bg-purple-500 text-white px-4 py-2 rounded-full text-sm font-semibold">
                    {industry.emoji} {industry.name}
                  </span>
                ) : null;
              })}
            </div>
          )}
        </div>

        {/* Startups Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {filteredStartups.map((startup, index) => (
            <div 
              key={index}
              className="bg-gradient-to-br from-cyan-300 via-blue-400 to-violet-500 rounded-2xl p-6 shadow-2xl"
            >
              <h3 className="text-2xl font-black text-gray-900 mb-2">
                {startup.name}
              </h3>
              {startup.tagline && (
                <p className="text-blue-700 font-bold text-sm mb-3">
                  {startup.tagline}
                </p>
              )}
              {startup.pitch && (
                <p className="text-gray-800 text-sm mb-4">
                  {startup.pitch}
                </p>
              )}
              <div className="flex items-center gap-2 text-sm">
                <span className="bg-green-500 text-white px-3 py-1 rounded-full font-bold">
                  ✓ {startup.stage ? `Stage ${startup.stage}` : 'Verified'}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* CTA Section */}
        <div className="bg-white rounded-3xl p-12 text-center shadow-2xl">
          <div className="text-5xl mb-4">🔥</div>
          <h2 className="text-4xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent mb-4">
            Want to Discover Hot Startups Too?
          </h2>
          <p className="text-xl text-gray-700 mb-6 max-w-2xl mx-auto">
            Join pyth ai to discover, vote on, and track the hottest startup deals. Build your own portfolio and share it with your network!
          </p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => navigate('/get-matched')}
              className="px-8 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-2xl shadow-lg transition-all text-lg"
            >
              🚀 Join pyth ai
            </button>
            <button
              onClick={() => navigate('/vote')}
              className="px-8 py-4 bg-white border-2 border-cyan-500 text-cyan-600 font-bold rounded-2xl shadow-lg hover:bg-slate-900 transition-all text-lg"
            >
              👀 See All Startups
            </button>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-6 mt-12">
            <div className="bg-slate-900 rounded-xl p-6">
              <div className="text-3xl mb-3">🎯</div>
              <h3 className="font-bold text-gray-800 mb-2">Filter by Industry</h3>
              <p className="text-sm text-gray-600">
                Only see startups in industries you care about
              </p>
            </div>
            <div className="bg-slate-900 rounded-xl p-6">
              <div className="text-3xl mb-3">📊</div>
              <h3 className="font-bold text-gray-800 mb-2">Track Your Picks</h3>
              <p className="text-sm text-gray-600">
                Build your own portfolio of hot startups
              </p>
            </div>
            <div className="bg-slate-900 rounded-xl p-6">
              <div className="text-3xl mb-3">📤</div>
              <h3 className="font-bold text-gray-800 mb-2">Share Selectively</h3>
              <p className="text-sm text-gray-600">
                Share specific categories with different people
              </p>
            </div>
          </div>
        </div>

        {/* Branding Footer */}
        <div className="text-center mt-8">
          <p className="text-purple-200 text-sm">
            Powered by <span className="font-bold text-yellow-300">pyth ai</span> 🔮
          </p>
        </div>
      </div>
    </div>
  );
}
