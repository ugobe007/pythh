/**
 * ACKNOWLEDGE MODAL
 * Founder sets a deadline for the task they're committing to.
 * Overlay modal with deadline picker and confirm CTA.
 */

import { useState } from 'react';
import { Calendar, CheckCircle, X } from 'lucide-react';

interface AcknowledgeModalProps {
  taskTitle: string;
  onConfirm: (deadline: string) => void;
  onCancel: () => void;
}

const PRESET_DEADLINES = [
  { label: '1 week',   days: 7 },
  { label: '2 weeks',  days: 14 },
  { label: '1 month',  days: 30 },
  { label: '3 months', days: 90 },
];

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function formatDate(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
}

export default function AcknowledgeModal({ taskTitle, onConfirm, onCancel }: AcknowledgeModalProps) {
  const [selectedPreset, setSelectedPreset] = useState<number>(14);
  const [customDate, setCustomDate] = useState<string>('');

  const effectiveDate = customDate || addDays(selectedPreset);
  const displayDate = formatDate(effectiveDate);

  const handleConfirm = () => {
    onConfirm(new Date(effectiveDate + 'T23:59:59').toISOString());
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 relative"
        style={{
          background: '#111',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        }}
      >
        {/* Close */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-zinc-600 hover:text-zinc-400 transition"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="mb-5">
          <div
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold mb-3"
            style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }}
          >
            <CheckCircle className="w-3 h-3" /> Commitment
          </div>
          <h3
            className="text-lg font-bold text-white leading-tight"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            {taskTitle}
          </h3>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Set a deadline and we'll track this for you.
          </p>
        </div>

        {/* Preset buttons */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {PRESET_DEADLINES.map(p => (
            <button
              key={p.days}
              onClick={() => { setSelectedPreset(p.days); setCustomDate(''); }}
              className="py-2 rounded-lg text-xs font-medium transition-all duration-150"
              style={{
                background: selectedPreset === p.days && !customDate
                  ? 'rgba(52,211,153,0.15)'
                  : 'rgba(255,255,255,0.04)',
                border: selectedPreset === p.days && !customDate
                  ? '1px solid rgba(52,211,153,0.4)'
                  : '1px solid rgba(255,255,255,0.07)',
                color: selectedPreset === p.days && !customDate
                  ? '#34d399'
                  : 'rgba(255,255,255,0.5)',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom date picker */}
        <div className="mb-5">
          <label className="flex items-center gap-2 text-xs mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
            <Calendar className="w-3 h-3" /> Or pick a specific date
          </label>
          <input
            type="date"
            value={customDate}
            min={addDays(1)}
            onChange={e => setCustomDate(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm bg-transparent outline-none"
            style={{
              border: customDate
                ? '1px solid rgba(52,211,153,0.4)'
                : '1px solid rgba(255,255,255,0.1)',
              color: customDate ? '#34d399' : 'rgba(255,255,255,0.6)',
              colorScheme: 'dark',
            }}
          />
        </div>

        {/* Deadline display */}
        <div
          className="rounded-xl px-4 py-3 mb-5 text-center"
          style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)' }}
        >
          <p className="text-xs mb-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>I commit to completing this by</p>
          <p className="text-sm font-semibold" style={{ color: '#34d399' }}>{displayDate}</p>
        </div>

        {/* Confirm */}
        <button
          onClick={handleConfirm}
          className="w-full py-3.5 rounded-xl font-semibold text-sm text-black transition-all duration-200 active:scale-95"
          style={{ background: '#34d399' }}
        >
          Acknowledge — I commit to this
        </button>

        <p className="text-center text-[11px] mt-3" style={{ color: 'rgba(255,255,255,0.2)' }}>
          This timestamp is recorded in your commitment doc
        </p>
      </div>
    </div>
  );
}
