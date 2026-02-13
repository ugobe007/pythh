import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import InvestorCard from '../components/InvestorCard';
import LogoDropdownMenu from '../components/LogoDropdownMenu';
import { getAllInvestors, searchInvestors } from '../lib/investorService';
import { InvestorComponent } from '../types';

export default function InvestorsPage() {
  const navigate = useNavigate();
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [investors, setInvestors] = useState<InvestorComponent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInvestors();
  }, []);

  const loadInvestors = async () => {
    setLoading(true);
    const { data, error } = await getAllInvestors();
    
    // SSOT: Supabase is the single source of truth - no fallback to static data
    if (error) {
      console.error('❌ Error fetching investors:', error);
      console.error('💡 SSOT: All data must come from Supabase. Please check database connection.');
      setInvestors([]);
    } else if (!data || data.length === 0) {
      console.warn('⚠️ No investors found in database');
      console.warn('💡 SSOT: No fallback data. Please populate investors table in Supabase.');
      setInvestors([]);
    } else {
      // Data is already mapped by investorService using adaptInvestorForComponent
      setInvestors(data);
    }
    setLoading(false);
  };

  const handleSearch = async () => {
    setLoading(true);
    const { data, error } = await searchInvestors(searchQuery, filterType);
    if (!error && data) {
      // Data is already mapped by investorService using adaptInvestorForComponent
      setInvestors(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    // SSOT: Always use database
    const timer = setTimeout(() => {
      handleSearch();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, filterType]);

  const filteredInvestors = investors.filter((investor) => {
    const matchesType = filterType === 'all' || investor.investor_tier === filterType;
    const matchesSearch = investor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         investor.investment_thesis?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#160020] via-[#240032] to-[#330044] pb-20 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-64 h-64 bg-[#9400cd]/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-[#9400cd]/5 rounded-full blur-3xl animate-pulse"></div>
      </div>

      {/* Logo Dropdown Menu (includes fixed header) */}
      <LogoDropdownMenu />

      <div className="max-w-7xl mx-auto pt-20 relative z-10">
        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-purple-400 mb-4"></div>
              <div className="text-white text-2xl font-bold">Loading Investors...</div>
            </div>
          </div>
        )}

        {/* Main Content - Only show if not loading */}
        {!loading && (
          <>
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12">
          <div className="text-6xl sm:text-8xl mb-4">💼</div>
          <h1 className="text-4xl sm:text-6xl font-bold mb-2 sm:mb-4">
            <span className="bg-gradient-to-r from-purple-400 via-blue-400 to-violet-400 bg-clip-text text-transparent">
              Investor Network
            </span>
          </h1>
          <p className="text-lg sm:text-2xl text-purple-200">
            Connect with {investors.length}+ VCs, Accelerators & Angel Networks
          </p>
          <div className="mt-4 flex gap-4 justify-center items-center flex-wrap">
            <Link
              to="/bulkupload"
              className="inline-block px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold rounded-full text-sm hover:from-cyan-600 hover:to-blue-700 transition-all shadow-lg"
            >
              📤 Bulk Upload VCs
            </Link>
            <Link
              to="/admin/discovered-investors"
              className="inline-block px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-bold rounded-full text-sm hover:from-purple-600 hover:to-indigo-700 transition-all shadow-lg"
            >
              📋 Manage Investors
            </Link>
            <Link
              to="/invite-investor"
              className="inline-block px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-full text-sm hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg"
            >
              ➕ Know an investor? Add them!
            </Link>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-4 sm:p-6 mb-8 border-2 border-purple-500/30">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Search */}
            <div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="🔍 Search investors..."
                className="w-full px-4 py-3 rounded-xl bg-white/10 text-white placeholder-purple-300 border-2 border-purple-400/50 focus:border-purple-400 outline-none"
              />
            </div>

            {/* Type Filter */}
            <div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/10 text-white border-2 border-purple-400/50 focus:border-purple-400 outline-none appearance-none cursor-pointer"
              >
                <option value="all" className="bg-white">All Types</option>
                <option value="vc_firm" className="bg-white">💼 VC Firms</option>
                <option value="accelerator" className="bg-white">🚀 Accelerators</option>
                <option value="angel_network" className="bg-white">👼 Angel Networks</option>
                <option value="corporate_vc" className="bg-white">🏢 Corporate VCs</option>
              </select>
            </div>
          </div>

          {/* Results Count */}
          <p className="text-purple-200 text-sm mt-4">
            Showing {filteredInvestors.length} investor{filteredInvestors.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Stats Overview - [pyth] ai Orange Theme */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-cyan-500/20 to-blue-500/20 backdrop-blur-md rounded-2xl p-6 text-center border-2 border-cyan-400/50 hover:scale-105 transition-transform">
            <div className="text-4xl mb-2">💼</div>
            <div className="text-3xl font-bold text-cyan-300">{investors.filter(i => i.investor_tier === 'elite' || i.investor_tier === 'established').length}</div>
            <div className="text-cyan-100 text-sm font-semibold">Top VCs</div>
          </div>
          <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 backdrop-blur-md rounded-2xl p-6 text-center border-2 border-green-400/50 hover:scale-105 transition-transform">
            <div className="text-4xl mb-2">🚀</div>
            <div className="text-3xl font-bold text-green-300">{investors.filter(i => i.investor_tier === 'emerging').length}</div>
            <div className="text-green-100 text-sm font-semibold">Emerging VCs</div>
          </div>
          <div className="bg-gradient-to-br from-purple-500/20 to-violet-500/20 backdrop-blur-md rounded-2xl p-6 text-center border-2 border-purple-400/50 hover:scale-105 transition-transform">
            <div className="text-4xl mb-2">🦄</div>
            <div className="text-3xl font-bold text-purple-300">{investors.reduce((sum, i) => sum + (i.unicorns || 0), 0)}</div>
            <div className="text-purple-100 text-sm font-semibold">Unicorns Created</div>
          </div>
          <div className="bg-gradient-to-br from-cyan-500/20 to-blue-600/20 backdrop-blur-md rounded-2xl p-6 text-center border-2 border-cyan-400/50 hover:scale-105 transition-transform">
            <div className="text-4xl mb-2">💰</div>
            <div className="text-3xl font-bold text-cyan-300">{investors.reduce((sum, i) => sum + (i.portfolioCount || 0), 0)}+</div>
            <div className="text-cyan-100 text-sm font-semibold">Portfolio Cos</div>
          </div>
        </div>

        {/* Investor Grid */}
        {filteredInvestors.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredInvestors.map((investor) => (
              <InvestorCard
                key={investor.id}
                investor={investor}
                onContact={(id) => {
                  alert(`Contacting investor #${id}. Feature coming soon! 📧`);
                }}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white/5 backdrop-blur-lg rounded-3xl border-2 border-purple-500/30">
            <div className="text-8xl mb-6">🔍</div>
            <h2 className="text-4xl font-bold text-purple-300 mb-4">No investors found</h2>
            <p className="text-xl text-purple-200 mb-8">Try adjusting your search or filters</p>
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
}
