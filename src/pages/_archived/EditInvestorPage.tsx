import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import LogoDropdownMenu from '../components/LogoDropdownMenu';
import { getInvestorById } from '../lib/investorService';
import { supabase } from '../lib/supabase';
import { researchInvestor } from '../lib/aiResearch';

export default function EditInvestorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [researching, setResearching] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'vc_firm' as 'vc_firm' | 'accelerator' | 'angel_network' | 'corporate_vc',
    tagline: '',
    description: '',
    website: '',
    linkedin: '',
    twitter: '',
    contact_email: '',
    aum: '',
    fund_size: '',
    check_size_min: 0,
    check_size_max: 0,
    stage: [] as string[],
    sectors: [] as string[],
    geography: '',
    portfolio_count: 0,
    exits: 0,
    unicorns: 0,
    notable_investments: [] as string[],
  });

  useEffect(() => {
    loadInvestor();
  }, [id]);

  const loadInvestor = async () => {
    if (!id) return;
    
    setLoading(true);
    const { data, error } = await getInvestorById(id);
    
    if (error || !data) {
      alert('Error loading investor');
      navigate('/investors');
      return;
    }

    setFormData({
      name: data.name || '',
      type: data.type || 'vc_firm',
      tagline: data.tagline || '',
      description: data.description || '',
      website: data.website || '',
      linkedin: data.linkedin || '',
      twitter: data.twitter || '',
      contact_email: data.contact_email || '',
      aum: data.aum || '',
      fund_size: data.fund_size || '',
      check_size_min: data.checkSizeMin || data.check_size_min || 0,
      check_size_max: data.checkSizeMax || data.check_size_max || 0,
      stage: data.stage || [],
      sectors: data.sectors || [],
      geography: data.geography || '',
      portfolio_count: data.total_investments || data.portfolioCount || 0, // SSOT: Map from total_investments
      exits: data.exits || 0,
      unicorns: data.unicorns || 0,
      notable_investments: data.notable_investments || [],
    });
    
    setLoading(false);
  };

  const handleResearch = async () => {
    if (!formData.website) {
      alert('❌ Please enter a website URL first');
      return;
    }

    setResearching(true);
    try {
      const researchedData = await researchInvestor(
        formData.website,
        formData.linkedin,
        formData.name
      );

      // Merge researched data with existing form data (don't overwrite if form has data)
      setFormData(prev => ({
        name: researchedData.name || prev.name,
        type: researchedData.type || prev.type,
        tagline: researchedData.tagline || prev.tagline,
        description: researchedData.description || prev.description,
        website: researchedData.website || prev.website,
        linkedin: researchedData.linkedin || prev.linkedin,
        twitter: researchedData.twitter || prev.twitter,
        contact_email: researchedData.contactEmail || prev.contact_email,
        aum: researchedData.aum || prev.aum,
        fund_size: researchedData.fundSize || prev.fund_size,
        check_size_min: researchedData.checkSizeMin || prev.check_size_min,
        check_size_max: researchedData.checkSizeMax || prev.check_size_max,
        stage: researchedData.stage && researchedData.stage.length > 0 ? researchedData.stage : prev.stage,
        sectors: researchedData.sectors && researchedData.sectors.length > 0 ? researchedData.sectors : prev.sectors,
        geography: researchedData.geography || prev.geography,
        portfolio_count: researchedData.portfolioCount || prev.portfolio_count,
        exits: researchedData.exits || prev.exits,
        unicorns: researchedData.unicorns || prev.unicorns,
        notable_investments: researchedData.notableInvestments && researchedData.notableInvestments.length > 0 ? researchedData.notableInvestments : prev.notable_investments,
      }));

      alert('✅ Research complete! Missing data has been filled in. Review and save.');
    } catch (error: any) {
      alert(`❌ Error: ${error.message}`);
    } finally {
      setResearching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!id) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('investors')
        .update({
          name: formData.name,
          type: formData.type,
          tagline: formData.tagline || null,
          description: formData.description || null,
          website: formData.website || null,
          linkedin: formData.linkedin || null,
          twitter: formData.twitter || null,
          contact_email: formData.contact_email || null,
          aum: formData.aum || null,
          fund_size: formData.fund_size || null,
          check_size_min: formData.check_size_min || null, // SSOT: Use check_size_min/max, not check_size
          check_size_max: formData.check_size_max || null,
          stage: formData.stage.length > 0 ? formData.stage : null,
          sectors: formData.sectors.length > 0 ? formData.sectors : null,
          geography: formData.geography || null,
          total_investments: formData.portfolio_count || null, // SSOT: Database uses total_investments, not portfolio_count
          successful_exits: formData.exits || null, // SSOT: Database uses successful_exits, not exits
          unicorns: formData.unicorns || null,
          notable_investments: formData.notable_investments.length > 0 ? formData.notable_investments : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      alert('✅ Investor updated successfully!');
      navigate('/investors');
    } catch (error: any) {
      alert(`❌ Error: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-2xl">⏳ Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">✏️</div>
          <h1 className="text-5xl font-bold text-white mb-2">
            Edit Investor
          </h1>
          <p className="text-xl text-purple-200">
            Update investor profile and use AI to fill missing data
          </p>
        </div>

        {/* AI Research Section */}
        <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 backdrop-blur-lg rounded-3xl p-6 mb-6 border-2 border-blue-400/50">
          <div className="text-center">
            <h3 className="text-2xl font-bold text-white mb-2">🤖 AI Research Assistant</h3>
            <p className="text-purple-200 mb-4">
              Let AI automatically research and fill in missing profile data
            </p>
            <button
              type="button"
              onClick={handleResearch}
              disabled={!formData.website || researching}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-xl shadow-xl hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {researching ? '🔍 Researching...' : '✨ Fill Missing Data with AI'}
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border-2 border-purple-400/50 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-white font-bold mb-2">Investor Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full px-4 py-3 rounded-xl bg-white/20 text-white border-2 border-purple-300/50 focus:border-yellow-400 focus:outline-none"
                placeholder="e.g., Benchmark"
              />
            </div>

            <div>
              <label className="block text-white font-bold mb-2">Type *</label>
              <select
                required
                value={formData.type}
                onChange={(e) => setFormData({...formData, type: e.target.value as any})}
                className="w-full px-4 py-3 rounded-xl bg-white/20 text-white border-2 border-purple-300/50 focus:border-yellow-400 focus:outline-none"
              >
                <option value="vc_firm">💼 VC Firm</option>
                <option value="accelerator">🚀 Accelerator</option>
                <option value="angel_network">👼 Angel Network</option>
                <option value="corporate_vc">🏢 Corporate VC</option>
              </select>
            </div>
          </div>

          {/* Tagline */}
          <div>
            <label className="block text-white font-bold mb-2">Tagline</label>
            <input
              type="text"
              value={formData.tagline}
              onChange={(e) => setFormData({...formData, tagline: e.target.value})}
              className="w-full px-4 py-3 rounded-xl bg-white/20 text-white border-2 border-purple-300/50 focus:border-yellow-400 focus:outline-none"
              placeholder="e.g., Benchmark your success"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-white font-bold mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              rows={4}
              className="w-full px-4 py-3 rounded-xl bg-white/20 text-white border-2 border-purple-300/50 focus:border-yellow-400 focus:outline-none"
              placeholder="Investment philosophy, focus areas, etc."
            />
          </div>

          {/* URLs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-white font-bold mb-2">Website</label>
              <input
                type="url"
                value={formData.website}
                onChange={(e) => setFormData({...formData, website: e.target.value})}
                className="w-full px-4 py-3 rounded-xl bg-white/20 text-white border-2 border-purple-300/50 focus:border-yellow-400 focus:outline-none"
                placeholder="https://..."
              />
            </div>

            <div>
              <label className="block text-white font-bold mb-2">LinkedIn</label>
              <input
                type="url"
                value={formData.linkedin}
                onChange={(e) => setFormData({...formData, linkedin: e.target.value})}
                className="w-full px-4 py-3 rounded-xl bg-white/20 text-white border-2 border-purple-300/50 focus:border-yellow-400 focus:outline-none"
                placeholder="https://linkedin.com/company/..."
              />
            </div>

            <div>
              <label className="block text-white font-bold mb-2">Twitter</label>
              <input
                type="text"
                value={formData.twitter}
                onChange={(e) => setFormData({...formData, twitter: e.target.value})}
                className="w-full px-4 py-3 rounded-xl bg-white/20 text-white border-2 border-purple-300/50 focus:border-yellow-400 focus:outline-none"
                placeholder="@username"
              />
            </div>
          </div>

          {/* Contact Email */}
          <div>
            <label className="block text-white font-bold mb-2">Contact Email</label>
            <input
              type="email"
              value={formData.contact_email}
              onChange={(e) => setFormData({...formData, contact_email: e.target.value})}
              className="w-full px-4 py-3 rounded-xl bg-white/20 text-white border-2 border-purple-300/50 focus:border-yellow-400 focus:outline-none"
              placeholder="contact@firm.com"
            />
          </div>

          {/* Financial Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-white font-bold mb-2">AUM</label>
              <input
                type="text"
                value={formData.aum}
                onChange={(e) => setFormData({...formData, aum: e.target.value})}
                className="w-full px-4 py-3 rounded-xl bg-white/20 text-white border-2 border-purple-300/50 focus:border-yellow-400 focus:outline-none"
                placeholder="e.g., $10B"
              />
            </div>

            <div>
              <label className="block text-white font-bold mb-2">Fund Size</label>
              <input
                type="text"
                value={formData.fund_size}
                onChange={(e) => setFormData({...formData, fund_size: e.target.value})}
                className="w-full px-4 py-3 rounded-xl bg-white/20 text-white border-2 border-purple-300/50 focus:border-yellow-400 focus:outline-none"
                placeholder="e.g., $500M"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-white font-bold mb-2">Check Size Min ($)</label>
                <input
                  type="number"
                  value={formData.check_size_min || ''}
                  onChange={(e) => setFormData({...formData, check_size_min: parseInt(e.target.value) || 0})}
                  className="w-full px-4 py-3 rounded-xl bg-white/20 text-white border-2 border-purple-300/50 focus:border-yellow-400 focus:outline-none"
                  placeholder="e.g., 1000000"
                />
              </div>
              <div>
                <label className="block text-white font-bold mb-2">Check Size Max ($)</label>
                <input
                  type="number"
                  value={formData.check_size_max || ''}
                  onChange={(e) => setFormData({...formData, check_size_max: parseInt(e.target.value) || 0})}
                  className="w-full px-4 py-3 rounded-xl bg-white/20 text-white border-2 border-purple-300/50 focus:border-yellow-400 focus:outline-none"
                  placeholder="e.g., 10000000"
                />
              </div>
            </div>
          </div>

          {/* Geography */}
          <div>
            <label className="block text-white font-bold mb-2">Geography</label>
            <input
              type="text"
              value={formData.geography}
              onChange={(e) => setFormData({...formData, geography: e.target.value})}
              className="w-full px-4 py-3 rounded-xl bg-white/20 text-white border-2 border-purple-300/50 focus:border-yellow-400 focus:outline-none"
              placeholder="e.g., Global, US, Europe"
            />
          </div>

          {/* Stages */}
          <div>
            <label className="block text-white font-bold mb-2">Investment Stages (comma-separated)</label>
            <input
              type="text"
              value={formData.stage.join(', ')}
              onChange={(e) => setFormData({...formData, stage: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})}
              className="w-full px-4 py-3 rounded-xl bg-white/20 text-white border-2 border-purple-300/50 focus:border-yellow-400 focus:outline-none"
              placeholder="e.g., seed, series_a, series_b"
            />
          </div>

          {/* Sectors */}
          <div>
            <label className="block text-white font-bold mb-2">Sectors (comma-separated)</label>
            <input
              type="text"
              value={formData.sectors.join(', ')}
              onChange={(e) => setFormData({...formData, sectors: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})}
              className="w-full px-4 py-3 rounded-xl bg-white/20 text-white border-2 border-purple-300/50 focus:border-yellow-400 focus:outline-none"
              placeholder="e.g., AI/ML, Fintech, Healthcare"
            />
          </div>

          {/* Portfolio Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-white font-bold mb-2">Portfolio Count</label>
              <input
                type="number"
                value={formData.portfolio_count || ''}
                onChange={(e) => setFormData({...formData, portfolio_count: parseInt(e.target.value) || 0})}
                className="w-full px-4 py-3 rounded-xl bg-white/20 text-white border-2 border-purple-300/50 focus:border-yellow-400 focus:outline-none"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-white font-bold mb-2">Exits</label>
              <input
                type="number"
                value={formData.exits || ''}
                onChange={(e) => setFormData({...formData, exits: parseInt(e.target.value) || 0})}
                className="w-full px-4 py-3 rounded-xl bg-white/20 text-white border-2 border-purple-300/50 focus:border-yellow-400 focus:outline-none"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-white font-bold mb-2">Unicorns</label>
              <input
                type="number"
                value={formData.unicorns || ''}
                onChange={(e) => setFormData({...formData, unicorns: parseInt(e.target.value) || 0})}
                className="w-full px-4 py-3 rounded-xl bg-white/20 text-white border-2 border-purple-300/50 focus:border-yellow-400 focus:outline-none"
                placeholder="0"
              />
            </div>
          </div>

          {/* Notable Investments */}
          <div>
            <label className="block text-white font-bold mb-2">Notable Investments (comma-separated)</label>
            <input
              type="text"
              value={formData.notable_investments.join(', ')}
              onChange={(e) => setFormData({...formData, notable_investments: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})}
              className="w-full px-4 py-3 rounded-xl bg-white/20 text-white border-2 border-purple-300/50 focus:border-yellow-400 focus:outline-none"
              placeholder="e.g., Uber, Airbnb, Dropbox"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold text-xl rounded-xl shadow-xl hover:from-green-600 hover:to-emerald-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? '💾 Saving...' : '💾 Save Changes'}
            </button>

            <Link
              to="/investors"
              className="flex-1 px-8 py-4 bg-gradient-to-r from-gray-500 to-gray-600 text-white font-bold text-xl rounded-xl shadow-xl hover:from-gray-600 hover:to-gray-700 transition-all text-center"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>

      <LogoDropdownMenu />
    </div>
  );
}
