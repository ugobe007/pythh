/**
 * /investor/profile — edit investor thesis for signed-in users.
 */

import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowLeft, Check } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import SharedNavbar from '@/components/SharedNavbar';
import { apiUrl } from '@/lib/apiConfig';
import { INVESTOR_SIGNUP_SECTORS } from '@/lib/investorSignupSectors';
import { clearInvestorSessionToken, investorAuthHeaders } from '@/lib/investorSession';

type InvestorProfile = {
  id: string;
  name: string;
  email: string;
  firm: string | null;
  title: string | null;
  type: string | null;
  sectors: string[] | null;
  stage: string[] | null;
  check_size_min: number | null;
  check_size_max: number | null;
  geography_focus: string[] | string | null;
  investment_thesis: string | null;
  status: string | null;
};

function parseGeography(raw: string[] | string | null): string[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string' && raw.trim()) return raw.split(',').map((s) => s.trim());
  return [];
}

export default function InvestorProfile() {
  const [, navigate] = useLocation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    firm: '',
    title: '',
    investorType: '' as 'VC' | 'Angel' | 'Family Office' | 'Corporate VC' | 'Accelerator' | '',
    checkSizeMin: '',
    checkSizeMax: '',
    sectors: [] as string[],
    stages: [] as string[],
    geography: [] as string[],
    investmentThesis: '',
  });

  const sectors = [...INVESTOR_SIGNUP_SECTORS];
  const stages = ['Pre-Seed', 'Seed', 'Series A', 'Series B', 'Series C+'];
  const geographies = ['US West', 'US East', 'Europe', 'Asia', 'Global'];

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(apiUrl('/api/investors/me'), {
          headers: { ...investorAuthHeaders() },
        });
        if (res.status === 401) {
          navigate('/investor/login');
          return;
        }
        const json = (await res.json()) as { investor?: InvestorProfile; error?: string };
        if (!res.ok || !json.investor) throw new Error(json.error || 'Failed to load profile');

        const inv = json.investor;
        setFormData({
          name: inv.name || '',
          email: inv.email || '',
          firm: inv.firm || '',
          title: inv.title || '',
          investorType: (inv.type as typeof formData.investorType) || '',
          checkSizeMin: inv.check_size_min ? String(Math.round(inv.check_size_min / 1000)) : '',
          checkSizeMax: inv.check_size_max ? String(Math.round(inv.check_size_max / 1000)) : '',
          sectors: Array.isArray(inv.sectors) ? inv.sectors : [],
          stages: Array.isArray(inv.stage) ? inv.stage : [],
          geography: parseGeography(inv.geography_focus),
          investmentThesis: inv.investment_thesis || '',
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  const handleToggle = (field: 'sectors' | 'stages' | 'geography', value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter((v) => v !== value)
        : [...prev[field], value],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const res = await fetch(apiUrl('/api/investors/profile'), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...investorAuthHeaders(),
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          firm: formData.firm || null,
          title: formData.title || null,
          type: formData.investorType || 'VC',
          check_size_min: formData.checkSizeMin ? parseInt(formData.checkSizeMin, 10) * 1000 : null,
          check_size_max: formData.checkSizeMax ? parseInt(formData.checkSizeMax, 10) * 1000 : null,
          sectors: formData.sectors,
          stage: formData.stages,
          geography: formData.geography,
          investment_thesis: formData.investmentThesis || null,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || 'Failed to save');
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const signOut = () => {
    clearInvestorSessionToken();
    navigate('/investor/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#090909] flex items-center justify-center text-zinc-500 text-sm">
        Loading profile…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090909]">
      <Helmet>
        <title>Investor profile — Pythh.ai</title>
      </Helmet>
      <SharedNavbar />

      <div className="max-w-lg mx-auto px-6 pt-24 pb-16">
        <div className="flex items-center justify-between mb-6">
          <Link href="/explore">
            <a className="inline-flex items-center gap-1.5 text-zinc-600 hover:text-zinc-400 text-xs">
              <ArrowLeft className="w-3.5 h-3.5" />
              Explore dealflow
            </a>
          </Link>
          <button type="button" onClick={signOut} className="text-xs text-zinc-500 hover:text-zinc-300">
            Sign out
          </button>
        </div>

        <h1 className="text-xl font-semibold text-white mb-1">Your investor profile</h1>
        <p className="text-sm text-zinc-500 mb-6">{formData.email}</p>

        {error && (
          <div className="mb-4 px-3 py-2 border-l-2 border-red-500/60 bg-red-500/5 text-red-400/80 text-xs">{error}</div>
        )}
        {saved && (
          <div className="mb-4 px-3 py-2 border-l-2 border-emerald-500/60 bg-emerald-500/5 text-emerald-400/80 text-xs">
            Profile saved.
          </div>
        )}

        <div className="space-y-4">
          <Field label="Full name *" value={formData.name} onChange={(v) => setFormData({ ...formData, name: v })} />
          <Field label="Firm" value={formData.firm} onChange={(v) => setFormData({ ...formData, firm: v })} />
          <Field label="Title" value={formData.title} onChange={(v) => setFormData({ ...formData, title: v })} />

          <div>
            <label className="block text-zinc-500 text-xs mb-2">Investor type</label>
            <div className="grid grid-cols-2 gap-2">
              {['VC', 'Angel', 'Family Office', 'Corporate VC', 'Accelerator'].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFormData({ ...formData, investorType: type as typeof formData.investorType })}
                  className={`px-3 py-2 rounded-md border text-sm ${
                    formData.investorType === type
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-white'
                      : 'border-zinc-800 text-zinc-500'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Min check ($K)" value={formData.checkSizeMin} onChange={(v) => setFormData({ ...formData, checkSizeMin: v })} type="number" />
            <Field label="Max check ($K)" value={formData.checkSizeMax} onChange={(v) => setFormData({ ...formData, checkSizeMax: v })} type="number" />
          </div>

          <ChipGroup label="Sectors" options={sectors} selected={formData.sectors} onToggle={(v) => handleToggle('sectors', v)} />
          <ChipGroup label="Stages" options={stages} selected={formData.stages} onToggle={(v) => handleToggle('stages', v)} />
          <ChipGroup label="Geography" options={geographies} selected={formData.geography} onToggle={(v) => handleToggle('geography', v)} />

          <div>
            <label className="block text-zinc-500 text-xs mb-1.5">Investment thesis</label>
            <textarea
              value={formData.investmentThesis}
              onChange={(e) => setFormData({ ...formData, investmentThesis: e.target.value })}
              rows={4}
              className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-zinc-800 rounded-md text-white text-sm resize-none"
            />
          </div>

          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !formData.name}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-md disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="block text-zinc-500 text-xs mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-zinc-800 rounded-md text-white text-sm"
      />
    </div>
  );
}

function ChipGroup({ label, options, selected, onToggle }: { label: string; options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div>
      <label className="block text-zinc-500 text-xs mb-2">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onToggle(option)}
            className={`px-2.5 py-1 rounded text-xs border ${
              selected.includes(option)
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'bg-zinc-900 text-zinc-500 border-zinc-800'
            }`}
          >
            {selected.includes(option) && <Check className="w-3 h-3 inline mr-1" />}
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
