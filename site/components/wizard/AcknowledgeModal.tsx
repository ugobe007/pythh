/**
 * ACKNOWLEDGE MODAL — Act 2 unlock commitment
 * Founder locks in an unlock with a deadline (identity-safe commitment contract).
 */

import { useState } from 'react';
import { Calendar, Unlock, X } from 'lucide-react';

interface AcknowledgeModalProps {
  taskTitle: string;
  impactPoints?: number;
  investorsUnlocked?: number;
  objectionRemoved?: string;
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

export default function AcknowledgeModal({
  taskTitle,
  impactPoints,
  investorsUnlocked,
  objectionRemoved,
  onConfirm,
  onCancel,
}: AcknowledgeModalProps) {
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
          background: 'oklch(0.14 0.01 264)',
          border: '1px solid oklch(0.22 0.01 264)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        }}
      >
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-4 right-4 transition"
          style={{ color: 'oklch(0.4 0.01 264)' }}
        >
          <X className="w-4 h-4" />
        </button>

        <div className="mb-5">
          <div
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold mb-3"
            style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)' }}
          >
            <Unlock className="w-3 h-3" /> Unlock commitment
          </div>
          <h3 className="text-lg font-bold leading-tight" style={{ color: 'oklch(0.94 0.005 264)' }}>
            {taskTitle}
          </h3>
          <p className="text-sm mt-2" style={{ color: 'oklch(0.5 0.01 264)' }}>
            Step 1 of 2: pick a deadline for this readiness goal. Step 2 (later, in your Unlocks tab): submit proof using the field described on the card.
          </p>
          {(impactPoints || investorsUnlocked) && (
            <p className="text-xs font-mono mt-2" style={{ color: 'oklch(0.45 0.01 264)' }}>
              {impactPoints ? `+${impactPoints} GOD pts` : ''}
              {impactPoints && investorsUnlocked ? ' · ' : ''}
              {investorsUnlocked ? `~${investorsUnlocked} investors unlocked` : ''}
            </p>
          )}
        </div>

        {objectionRemoved && (
          <div
            className="rounded-lg px-3 py-2 mb-4 text-xs"
            style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', color: 'oklch(0.55 0.01 264)' }}
          >
            <span style={{ color: '#22c55e' }}>Partner shift: </span>{objectionRemoved}
          </div>
        )}

        <div className="grid grid-cols-4 gap-2 mb-4">
          {PRESET_DEADLINES.map(p => (
            <button
              key={p.days}
              type="button"
              onClick={() => { setSelectedPreset(p.days); setCustomDate(''); }}
              className="py-2 rounded-lg text-xs font-medium transition-all duration-150"
              style={{
                background: selectedPreset === p.days && !customDate ? 'rgba(34,197,94,0.12)' : 'oklch(0.12 0.01 264)',
                border: selectedPreset === p.days && !customDate ? '1px solid rgba(34,197,94,0.35)' : '1px solid oklch(0.2 0.01 264)',
                color: selectedPreset === p.days && !customDate ? '#22c55e' : 'oklch(0.5 0.01 264)',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="mb-5">
          <label className="flex items-center gap-2 text-xs mb-1.5" style={{ color: 'oklch(0.45 0.01 264)' }}>
            <Calendar className="w-3 h-3" /> Or pick a specific date
          </label>
          <input
            type="date"
            value={customDate}
            min={addDays(1)}
            onChange={e => setCustomDate(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm bg-transparent outline-none"
            style={{
              border: customDate ? '1px solid rgba(34,197,94,0.4)' : '1px solid oklch(0.22 0.01 264)',
              color: customDate ? '#22c55e' : 'oklch(0.6 0.01 264)',
              colorScheme: 'dark',
            }}
          />
        </div>

        <div
          className="rounded-xl px-4 py-3 mb-5 text-center"
          style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)' }}
        >
          <p className="text-xs mb-0.5" style={{ color: 'oklch(0.42 0.01 264)' }}>I commit to unlocking this by</p>
          <p className="text-sm font-semibold" style={{ color: '#22c55e' }}>{displayDate}</p>
        </div>

        <button
          type="button"
          onClick={handleConfirm}
          className="w-full py-3.5 rounded-xl font-semibold text-sm text-black transition-all duration-200 active:scale-[0.98]"
          style={{ background: '#22c55e' }}
        >
          Lock in deadline
        </button>

        <p className="text-center text-[11px] mt-3" style={{ color: 'oklch(0.35 0.01 264)' }}>
          Timestamped in your provisional readiness doc
        </p>
      </div>
    </div>
  );
}
