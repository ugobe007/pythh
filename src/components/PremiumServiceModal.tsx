/**
 * PremiumServiceModal
 * ════════════════════
 * Replaces all mailto: links in the Premium Services section.
 * Captures: name, company, email, service type, brief, and submits to server.
 */

import { useState } from 'react';
import { X, Send, CheckCircle, Loader2 } from 'lucide-react';
import { apiUrl } from '../lib/apiConfig';

export type ServiceType =
  | 'pitch_deck'
  | 'research_report'
  | 'advisor_recruitment'
  | 'investor_outreach'
  | 'term_sheet'
  | 'fund_tier'
  | 'other';

const SERVICE_LABELS: Record<ServiceType, string> = {
  pitch_deck: 'Pitch Deck Design',
  research_report: 'Research Report',
  advisor_recruitment: 'Advisor / Board Recruitment',
  investor_outreach: 'Investor Outreach Campaign',
  term_sheet: 'Term Sheet Support',
  fund_tier: 'Fund Tier Inquiry',
  other: 'Other',
};

interface PremiumServiceModalProps {
  service: ServiceType;
  onClose: () => void;
}

type ModalStep = 'form' | 'submitting' | 'done' | 'error';

export default function PremiumServiceModal({ service, onClose }: PremiumServiceModalProps) {
  const [step, setStep] = useState<ModalStep>('form');
  const [errorMsg, setErrorMsg] = useState('');
  const [form, setForm] = useState({
    name: '',
    company: '',
    email: '',
    brief: '',
  });

  const update = (field: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email) return;

    setStep('submitting');
    setErrorMsg('');

    try {
      const res = await fetch(apiUrl('/api/premium-service-inquiry'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, service, service_label: SERVICE_LABELS[service] }),
      });

      if (!res.ok) throw new Error('Server error');
      setStep('done');
    } catch (err) {
      setErrorMsg('Failed to send. Please email team@pythh.ai directly.');
      setStep('error');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-500 hover:text-white transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Done state */}
        {step === 'done' && (
          <div className="p-8 text-center">
            <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Request Sent!</h2>
            <p className="text-zinc-400 text-sm mb-6">
              We'll be in touch within 24 hours to discuss <strong className="text-white">{SERVICE_LABELS[service]}</strong> for {form.company || form.name}.
            </p>
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm transition"
            >
              Close
            </button>
          </div>
        )}

        {/* Form state */}
        {(step === 'form' || step === 'submitting' || step === 'error') && (
          <form onSubmit={handleSubmit} className="p-6 sm:p-8">
            <div className="mb-6">
              <div className="text-xs uppercase tracking-widest text-zinc-500 mb-1">Premium Service</div>
              <h2 className="text-xl font-bold text-white">{SERVICE_LABELS[service]}</h2>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Your Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={update('name')}
                  required
                  placeholder="Jane Smith"
                  className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-orange-500 transition"
                />
              </div>

              {/* Company */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Company</label>
                <input
                  type="text"
                  value={form.company}
                  onChange={update('company')}
                  placeholder="Acme Inc."
                  className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-orange-500 transition"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Email *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={update('email')}
                  required
                  placeholder="jane@company.com"
                  className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-orange-500 transition"
                />
              </div>

              {/* Brief */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Brief (optional)
                </label>
                <textarea
                  value={form.brief}
                  onChange={update('brief')}
                  rows={3}
                  placeholder="Tell us a bit about what you need…"
                  className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-orange-500 transition resize-none"
                />
              </div>
            </div>

            {step === 'error' && (
              <p className="mt-3 text-red-400 text-sm">{errorMsg}</p>
            )}

            <button
              type="submit"
              disabled={step === 'submitting' || !form.name || !form.email}
              className="mt-5 w-full flex items-center justify-center gap-2 py-3 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition"
            >
              {step === 'submitting' ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
              ) : (
                <><Send className="w-4 h-4" /> Send Request</>
              )}
            </button>

            <p className="mt-3 text-zinc-600 text-xs text-center">
              Or email directly: team@pythh.ai
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
