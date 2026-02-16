import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Building2, ExternalLink, Download, CheckCircle2, RefreshCw, Plus, Upload, Home, Settings, BarChart3 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface DiscoveredInvestor {
  id: string;
  name: string;
  type?: string | null;
  website?: string | null;
  description?: string | null;
  check_size?: string | null;
  sectors?: string[] | null;
  stage?: string[] | null;
  geography?: string | null;
  notable_investments?: string[] | null;
  created_at?: string | null;
}

export default function DiscoveredInvestors() {
  const navigate = useNavigate();
  const [investors, setInvestors] = useState<DiscoveredInvestor[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'vc' | 'angel' | 'accelerator'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadInvestors();
  }, [filter]);

  const loadInvestors = async () => {
    try {
      setLoading(true);
      
      // Load all investors (up to 1000 to handle 800+)
      let query = supabase
        .from('investors')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000); // Increased from 100 to show all 800+ investors

      if (filter !== 'all') {
        query = query.ilike('type', `%${filter}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading investors:', error);
        return;
      }

      setInvestors((data || []) as DiscoveredInvestor[]);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    if (selectedIds.size === investors.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(investors.map(i => i.id)));
    }
  };

  const exportToCSV = () => {
    const selected = investors.filter(i => selectedIds.has(i.id));
    
    const csv = [
      ['Name', 'Type', 'Website', 'Check Size', 'Sectors', 'Stage', 'Geography', 'Notable Investments'],
      ...selected.map(i => [
        i.name,
        i.type || '',
        i.website || '',
        i.check_size || '',
        (i.sectors || []).join('; '),
        (i.stage || []).join('; '),
        i.geography || '',
        (i.notable_investments || []).join('; ')
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `investors-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const filteredInvestors = investors.filter(i => 
    i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (i.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1140] via-[#2d1b69] to-[#4a2a8f] relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>
      
      <div className="relative z-10 container mx-auto px-8 py-12">
        {/* Navigation Bar */}
        <div className="mb-8 p-4 bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10">
          <div className="flex items-center justify-center gap-2 text-sm flex-wrap">
            <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white transition-all">← Back</button>
            <span className="text-gray-600">|</span>
            <Link to="/" className="text-gray-400 hover:text-white transition-all">🏠 Home</Link>
            <span className="text-gray-600">|</span>
            <Link to="/admin/control" className="text-gray-400 hover:text-white transition-all">⚙️ Control Center</Link>
            <span className="text-gray-600">|</span>
            <Link to="/admin/bulk-upload" className="text-gray-400 hover:text-white transition-all">📤 Bulk Upload</Link>
            <span className="text-gray-600">|</span>
            <Link to="/admin/discovered-startups" className="text-gray-400 hover:text-white transition-all">🚀 Startups</Link>
            <span className="text-gray-600">|</span>
            <Link to="/matches" className="text-cyan-400 hover:text-cyan-300 transition-all font-bold">⚡ Match</Link>
          </div>
        </div>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-5xl font-bold text-white mb-3">
                Discovered <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">Investors</span>
              </h1>
              <p className="text-gray-300 text-lg">Browse and manage discovered investors from all sources</p>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={loadInvestors}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-lg transition-all"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
            <div className="text-3xl font-bold text-white">{investors.length}</div>
            <div className="text-gray-400 text-sm">Total Investors</div>
          </div>
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
            <div className="text-3xl font-bold text-cyan-400">{investors.filter(i => i.type?.toLowerCase().includes('vc')).length}</div>
            <div className="text-gray-400 text-sm">VC Firms</div>
          </div>
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
            <div className="text-3xl font-bold text-blue-400">{investors.filter(i => i.type?.toLowerCase().includes('angel')).length}</div>
            <div className="text-gray-400 text-sm">Angel Investors</div>
          </div>
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
            <div className="text-3xl font-bold text-green-400">{selectedIds.size}</div>
            <div className="text-gray-400 text-sm">Selected</div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-8 border border-white/20">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="Search investors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 bg-gray-900/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* Filter */}
            <div className="flex gap-2">
              {(['all', 'vc', 'angel', 'accelerator'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    filter === f
                      ? 'bg-cyan-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-all"
              >
                {selectedIds.size === investors.length ? 'Deselect All' : 'Select All'}
              </button>
              <button
                onClick={exportToCSV}
                disabled={selectedIds.size === 0}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg font-medium transition-all"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>
          </div>
        </div>

        {/* Investor List */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <RefreshCw className="w-12 h-12 text-cyan-400 animate-spin mx-auto mb-4" />
              <p className="text-gray-300">Loading investors...</p>
            </div>
          ) : filteredInvestors.length === 0 ? (
            <div className="p-12 text-center">
              <Building2 className="w-12 h-12 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400">No investors found</p>
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {filteredInvestors.map((investor) => (
                <div 
                  key={investor.id}
                  className={`p-4 hover:bg-white/5 transition-all cursor-pointer ${
                    selectedIds.has(investor.id) ? 'bg-cyan-600/10' : ''
                  }`}
                  onClick={() => toggleSelect(investor.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(investor.id)}
                        onChange={() => toggleSelect(investor.id)}
                        className="w-5 h-5 rounded border-gray-600 text-cyan-500 focus:ring-cyan-500"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="text-white font-bold text-lg">{investor.name}</h3>
                          {investor.type && (
                            <span className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded-full">
                              {investor.type}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
                          {investor.check_size && <span>💰 {investor.check_size}</span>}
                          {investor.geography && <span>🌍 {investor.geography}</span>}
                          {investor.sectors && investor.sectors.length > 0 && (
                            <span>📊 {investor.sectors.slice(0, 3).join(', ')}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {investor.website && (
                        <a
                          href={investor.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm"
                        >
                          <ExternalLink className="w-3 h-3" /> Website
                        </a>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/investor/${investor.id}`);
                        }}
                        className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium text-sm"
                      >
                        View Profile →
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Links Footer */}
        <div className="mt-8 p-6 bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10">
          <h3 className="text-white font-bold mb-4">🔗 Quick Links</h3>
          <div className="grid grid-cols-4 gap-4">
            <Link to="/admin/bulk-upload" className="p-4 bg-cyan-600/20 hover:bg-cyan-600/30 rounded-xl text-center transition-all">
              <Upload className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
              <div className="text-white font-medium">Bulk Upload</div>
              <div className="text-gray-400 text-sm">Import Startups</div>
            </Link>
            <Link to="/admin/discovered-startups" className="p-4 bg-purple-500/20 hover:bg-purple-500/30 rounded-xl text-center transition-all">
              <Building2 className="w-8 h-8 text-purple-400 mx-auto mb-2" />
              <div className="text-white font-medium">Discovered Startups</div>
              <div className="text-gray-400 text-sm">RSS Discoveries</div>
            </Link>
            <Link to="/admin/rss-manager" className="p-4 bg-cyan-500/20 hover:bg-cyan-500/30 rounded-xl text-center transition-all">
              <RefreshCw className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
              <div className="text-white font-medium">RSS Manager</div>
              <div className="text-gray-400 text-sm">Configure Feeds</div>
            </Link>
            <Link to="/matches" className="p-4 bg-green-500/20 hover:bg-green-500/30 rounded-xl text-center transition-all">
              <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
              <div className="text-white font-medium">Matching</div>
              <div className="text-gray-400 text-sm">Vote on Matches</div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
