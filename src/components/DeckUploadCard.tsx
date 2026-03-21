/**
 * DeckUploadCard — Pitch deck upload for founder profile
 * Upload PDF → scored and saved to startup profile
 */

import { useState, useRef } from 'react';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { apiUrl } from '@/lib/apiConfig';

interface DeckUploadCardProps {
  startupId: string;
  deckFilename?: string | null;
  onSuccess?: () => void;
}

export default function DeckUploadCard({ startupId, deckFilename, onSuccess }: DeckUploadCardProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastScore, setLastScore] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File must be under 10MB.');
      return;
    }

    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append('deck', file);
      form.append('startup_id', startupId);
      const base = apiUrl('/api/deck/upload');
      const res = await fetch(base, {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.detail || `Upload failed (${res.status})`);
      }
      setLastScore(data.total_god_score ?? null);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const hasDeck = !!deckFilename || !!lastScore;

  return (
    <div className="border border-zinc-800/50 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-zinc-800/80 flex items-center justify-center shrink-0">
          <FileText className="w-5 h-5 text-zinc-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-zinc-300">Pitch deck</h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Upload your deck to improve your GOD score and profile data.
          </p>
          {hasDeck && (
            <p className="text-xs text-emerald-400/90 mt-2">
              {deckFilename ? `Saved: ${deckFilename}` : 'Deck scored successfully'}
              {lastScore != null && ` · GOD score: ${lastScore}`}
            </p>
          )}
          {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
          <div className="mt-3">
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 disabled:opacity-50 transition-colors"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Scoring…
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  {hasDeck ? 'Replace deck' : 'Upload deck'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
