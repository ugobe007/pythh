/**
 * PROOF SUBMIT CARD
 * Per-task proof capture — adapts UI based on proof_type:
 *   text       → textarea
 *   names_list → add-item list (names + notes)
 *   count      → number input
 *   url        → URL input with validation
 */

import { useState } from 'react';
import { CheckCircle, Link, Plus, X } from 'lucide-react';

export interface ProofData {
  names?: string[];
  count?: number;
  url?: string;
  notes?: string;
  text?: string;
}

interface ProofSubmitCardProps {
  taskId: string;
  taskTitle: string;
  proofType: 'text' | 'names_list' | 'count' | 'url';
  proofLabel: string;
  onSubmit: (taskId: string, proof: ProofData) => Promise<void>;
  onCancel: () => void;
}

export default function ProofSubmitCard({
  taskId,
  taskTitle,
  proofType,
  proofLabel,
  onSubmit,
  onCancel,
}: ProofSubmitCardProps) {
  const [names, setNames] = useState<string[]>(['']);
  const [count, setCount] = useState<string>('');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isValid = () => {
    if (proofType === 'names_list') return names.some(n => n.trim().length > 0);
    if (proofType === 'count') return parseInt(count, 10) > 0;
    if (proofType === 'url') return url.trim().length > 5;
    if (proofType === 'text') return text.trim().length > 10;
    return false;
  };

  const buildProof = (): ProofData => {
    const proof: ProofData = { notes: notes.trim() || undefined };
    if (proofType === 'names_list') proof.names = names.filter(n => n.trim());
    if (proofType === 'count') proof.count = parseInt(count, 10);
    if (proofType === 'url') proof.url = url.trim();
    if (proofType === 'text') proof.text = text.trim();
    return proof;
  };

  const handleSubmit = async () => {
    if (!isValid()) { setError('Please fill in the required field.'); return; }
    setLoading(true);
    setError('');
    try {
      await onSubmit(taskId, buildProof());
    } catch (e) {
      setError('Failed to submit proof. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const addName = () => setNames(prev => [...prev, '']);
  const updateName = (i: number, val: string) =>
    setNames(prev => prev.map((n, idx) => (idx === i ? val : n)));
  const removeName = (i: number) =>
    setNames(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev);

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.1)',
      }}
    >
      <div className="mb-4">
        <p className="text-[10px] font-semibold tracking-widest mb-1" style={{ color: '#22c55e' }}>PROVE YOUR UNLOCK</p>
        <h3 className="text-sm font-semibold text-white mb-0.5">{taskTitle}</h3>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{proofLabel}</p>
      </div>

      {/* Names list */}
      {proofType === 'names_list' && (
        <div className="space-y-2 mb-3">
          {names.map((name, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={name}
                onChange={e => updateName(i, e.target.value)}
                placeholder={`Name ${i + 1}`}
                className="flex-1 px-3 py-2 rounded-lg text-sm bg-transparent outline-none"
                style={{
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#e2e8f0',
                  '::placeholder': { color: 'rgba(255,255,255,0.2)' },
                } as React.CSSProperties}
              />
              {names.length > 1 && (
                <button onClick={() => removeName(i)} className="text-zinc-600 hover:text-zinc-400 transition">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={addName}
            className="flex items-center gap-1.5 text-xs transition"
            style={{ color: 'rgba(255,255,255,0.3)' }}
          >
            <Plus className="w-3 h-3" /> Add another
          </button>
        </div>
      )}

      {/* Count */}
      {proofType === 'count' && (
        <input
          type="number"
          value={count}
          min={0}
          onChange={e => setCount(e.target.value)}
          placeholder="0"
          className="w-full px-3 py-2 rounded-lg text-sm bg-transparent outline-none mb-3"
          style={{
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#e2e8f0',
          }}
        />
      )}

      {/* URL */}
      {proofType === 'url' && (
        <div className="flex items-center gap-2 mb-3">
          <Link className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }} />
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://"
            className="flex-1 px-3 py-2 rounded-lg text-sm bg-transparent outline-none"
            style={{
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#e2e8f0',
            }}
          />
        </div>
      )}

      {/* Text */}
      {proofType === 'text' && (
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={4}
          placeholder="Describe what you've completed..."
          className="w-full px-3 py-2.5 rounded-lg text-sm bg-transparent outline-none resize-none mb-3"
          style={{
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#e2e8f0',
          }}
        />
      )}

      {/* Optional notes */}
      {proofType !== 'text' && (
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          placeholder="Additional notes (optional)"
          className="w-full px-3 py-2 rounded-lg text-sm bg-transparent outline-none resize-none mb-3"
          style={{
            border: '1px solid rgba(255,255,255,0.06)',
            color: 'rgba(255,255,255,0.5)',
          }}
        />
      )}

      {error && (
        <p className="text-xs text-red-400 mb-3">{error}</p>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={loading || !isValid()}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-black transition-all duration-150 disabled:opacity-40"
          style={{ background: '#34d399' }}
        >
          {loading ? (
            <span className="animate-spin w-3.5 h-3.5 border-2 border-black/20 border-t-black rounded-full inline-block" />
          ) : (
            <CheckCircle className="w-3.5 h-3.5" />
          )}
          {loading ? 'Saving...' : 'Submit proof — unlock verified'}
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-2.5 rounded-lg text-xs transition"
          style={{ color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
