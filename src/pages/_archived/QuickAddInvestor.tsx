import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function QuickAddInvestor() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'VC',
    tagline: '',
    check_size: '',
    geography: 'Global',
    sectors: '',
    stage: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.from('investors').insert([{
        name: formData.name,
        type: formData.type,
        tagline: formData.tagline,
        check_size: formData.check_size,
        geography: formData.geography,
        sectors: formData.sectors.split(',').map(s => s.trim()).filter(Boolean),
        stage: formData.stage.split(',').map(s => s.trim()).filter(Boolean),
        status: 'active',
      }]);

      if (error) throw error;

      alert('✅ Investor added successfully!');
      navigate('/admin/control');
    } catch (error) {
      console.error('Error adding investor:', error);
      alert('❌ Error adding investor: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0729] via-[#1a0f3a] to-[#2d1558] py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition text-white"
        >
          ← Back
        </button>

        <div className="bg-gradient-to-br from-gray-900/60 to-gray-800/60 backdrop-blur-xl rounded-xl p-8 border border-white/10">
          <h1 className="text-3xl font-bold text-white mb-6">Quick Add Investor</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-white mb-2">Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                placeholder="e.g., Sequoia Capital"
              />
            </div>

            <div>
              <label className="block text-white mb-2">Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
              >
                <option value="VC">VC</option>
                <option value="Angel">Angel</option>
                <option value="Family Office">Family Office</option>
                <option value="PE">Private Equity</option>
              </select>
            </div>

            <div>
              <label className="block text-white mb-2">Tagline</label>
              <input
                type="text"
                value={formData.tagline}
                onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                placeholder="e.g., Leading venture capital firm"
              />
            </div>

            <div>
              <label className="block text-white mb-2">Check Size</label>
              <input
                type="text"
                value={formData.check_size}
                onChange={(e) => setFormData({ ...formData, check_size: e.target.value })}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                placeholder="e.g., $1M - $10M"
              />
            </div>

            <div>
              <label className="block text-white mb-2">Geography</label>
              <input
                type="text"
                value={formData.geography}
                onChange={(e) => setFormData({ ...formData, geography: e.target.value })}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                placeholder="e.g., USA, Global"
              />
            </div>

            <div>
              <label className="block text-white mb-2">Sectors (comma-separated)</label>
              <input
                type="text"
                value={formData.sectors}
                onChange={(e) => setFormData({ ...formData, sectors: e.target.value })}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                placeholder="e.g., AI/ML, Fintech, Healthcare"
              />
            </div>

            <div>
              <label className="block text-white mb-2">Stages (comma-separated)</label>
              <input
                type="text"
                value={formData.stage}
                onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                placeholder="e.g., Seed, Series A, Series B"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-3 px-6 rounded-lg transition disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add Investor'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
