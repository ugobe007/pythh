/**
 * /lookup — INVESTOR LOOKUP
 *
 * Search PYTHH startups by sector, stage, score; add results to curated lists.
 * Session stored in localStorage so lists persist per browser.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import PythhUnifiedNav from '../components/PythhUnifiedNav';
import { apiUrl } from '../lib/apiConfig';

const SESSION_KEY = 'pythh_investor_session';
const SECTORS = [
  'AI/ML', 'SaaS', 'Fintech', 'HealthTech', 'CleanTech',
  'Cybersecurity', 'EdTech', 'Developer Tools', 'Consumer', 'Marketplace',
];
const STAGE_OPTIONS: { value: string; label: string }[] = [
  { value: 'pre-seed', label: 'Pre-Seed' },
  { value: 'seed', label: 'Seed' },
  { value: 'series-a', label: 'Series A' },
  { value: 'series-b', label: 'Series B' },
  { value: 'series-c', label: 'Series C+' },
];

type StartupRow = {
  id: string;
  name: string;
  tagline: string | null;
  website: string | null;
  sectors: string[];
  stage_estimate: string | null;
  total_god_score: number | null;
};
type ListMeta = { id: string; name: string; created_at: string };

function getSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

function getHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'X-Investor-Session': getSessionId(),
  };
}

export default function InvestorLookupPage() {
  const [q, setQ] = useState('');
  const [sectors, setSectors] = useState<string[]>([]);
  const [stage, setStage] = useState('');
  const [minScore, setMinScore] = useState<string>('');
  const [maxScore, setMaxScore] = useState<string>('');
  const [results, setResults] = useState<StartupRow[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lists, setLists] = useState<ListMeta[]>([]);
  const [listsLoading, setListsLoading] = useState(false);
  const [addDropdown, setAddDropdown] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const addDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!addDropdown) return;
    const handler = (e: MouseEvent) => {
      if (addDropdownRef.current && !addDropdownRef.current.contains(e.target as Node)) {
        setAddDropdown(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [addDropdown]);

  const runSearch = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (sectors.length) params.set('sectors', sectors.join(','));
      if (stage) params.set('stage', stage);
      if (minScore.trim()) params.set('minScore', minScore.trim());
      if (maxScore.trim()) params.set('maxScore', maxScore.trim());
      params.set('limit', '50');
      const res = await fetch(apiUrl(`/api/investor-lookup/search?${params}`));
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Search failed');
      setResults(json.data || []);
      setTotal(json.meta?.total ?? 0);
      setHasMore(json.meta?.hasMore ?? false);
    } catch (e) {
      setResults([]);
      setTotal(0);
      setHasMore(false);
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [q, sectors, stage, minScore, maxScore]);

  const fetchLists = useCallback(async () => {
    setListsLoading(true);
    try {
      const res = await fetch(apiUrl('/api/investor-lookup/lists'), { headers: getHeaders() });
      const json = await res.json();
      if (res.ok && Array.isArray(json.data)) setLists(json.data);
    } catch (e) {
      console.error(e);
    } finally {
      setListsLoading(false);
    }
  }, []);

  useEffect(() => {
    runSearch();
  }, []);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  const toggleSector = (s: string) => {
    setSectors(prev => (prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]));
  };
  const clearFilters = () => {
    setQ('');
    setSectors([]);
    setStage('');
    setMinScore('');
    setMaxScore('');
  };

  const addToList = async (startupId: string, listId: string | null, newListName?: string) => {
    setAddError(null);
    let targetListId = listId;
    if (!targetListId && newListName?.trim()) {
      const createRes = await fetch(apiUrl('/api/investor-lookup/lists'), {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ name: newListName.trim() }),
      });
      const createJson = await createRes.json();
      if (!createRes.ok) {
        setAddError(createJson.error || 'Failed to create list');
        return;
      }
      targetListId = createJson.data?.id;
      if (targetListId) setLists(prev => [{ id: targetListId!, name: newListName.trim(), created_at: createJson.data?.created_at || '' }, ...prev]);
    }
    if (!targetListId) {
      setAddError('Select a list or enter a new list name');
      return;
    }
    const res = await fetch(apiUrl(`/api/investor-lookup/lists/${targetListId}/items`), {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ startup_id: startupId }),
    });
    const json = await res.json();
    if (!res.ok) {
      setAddError(json.error || 'Failed to add');
      return;
    }
    setAddDropdown(null);
  };

  const openAddDropdown = (startupId: string) => {
    setAddDropdown(prev => (prev === startupId ? null : startupId));
    setAddError(null);
  };

  return (
    <div
      className="min-h-screen"
      style={{
        background: 'linear-gradient(180deg, #0a0e13 0%, #0d1117 50%, #0a0e13 100%)',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <PythhUnifiedNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-6">
          <div className="text-[11px] uppercase tracking-[1.5px] text-zinc-500 mb-2 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            investor lookup
          </div>
          <h1 className="text-[32px] font-semibold leading-tight mb-2">
            <span className="text-white">Build your portfolio. </span>
            <span className="text-amber-400" style={{ textShadow: '0 0 30px rgba(251,191,36,0.3)' }}>Start searching.</span>
          </h1>
          <p className="text-sm text-zinc-500 max-w-xl">
            Filter by sector, stage, and score — add companies to your lists.
          </p>
        </div>

        {/* Search input */}
        <div className="mb-4">
          <input
            type="text"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search by name, tagline..."
            autoComplete="off"
            className="w-full max-w-xl px-4 py-3 bg-[#0a0a0a] border border-zinc-800 rounded-lg text-white text-sm placeholder-zinc-600 focus:border-amber-800/60 focus:outline-none transition-colors"
          />
        </div>

        {/* Sector chips */}
        <div className="mb-3">
          <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-2">Sector</div>
          <div className="flex flex-wrap gap-1.5">
            {SECTORS.map(s => (
              <button
                key={s}
                onClick={() => toggleSector(s)}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  sectors.includes(s)
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                    : 'bg-zinc-900 text-zinc-500 border border-zinc-800 hover:border-zinc-700'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Stage + score */}
        <div className="mb-5 flex flex-wrap items-center gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-2">Stage</div>
            <div className="flex flex-wrap gap-1.5">
              {STAGE_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setStage(s => (s === value ? '' : value))}
                  className={`px-2.5 py-1 rounded text-xs transition-colors ${
                    stage === value ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' : 'bg-zinc-900 text-zinc-500 border border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-end gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-zinc-600 block mb-1">Min score</label>
              <input
                type="number"
                min={0}
                max={100}
                value={minScore}
                onChange={e => setMinScore(e.target.value)}
                placeholder="40"
                className="w-20 px-2 py-1.5 bg-[#0a0a0a] border border-zinc-800 rounded text-white text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-zinc-600 block mb-1">Max score</label>
              <input
                type="number"
                min={0}
                max={100}
                value={maxScore}
                onChange={e => setMaxScore(e.target.value)}
                placeholder="100"
                className="w-20 px-2 py-1.5 bg-[#0a0a0a] border border-zinc-800 rounded text-white text-sm"
              />
            </div>
            <button
              onClick={() => runSearch()}
              className="px-4 py-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30 transition-colors text-sm font-medium"
            >
              Search
            </button>
            <button
              onClick={clearFilters}
              className="px-3 py-2 text-xs text-zinc-500 hover:text-zinc-400 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>

        {addError && (
          <div className="mb-4 px-4 py-2 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm">
            {addError}
          </div>
        )}

        {/* Results bar */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs text-zinc-500">
            {loading ? 'Searching...' : `${total} startup${total !== 1 ? 's' : ''}`}
          </span>
        </div>

        {/* Results table */}
        <div
          className="bg-zinc-900/30 rounded-lg border border-amber-800/20 overflow-hidden"
          style={{ boxShadow: '0 0 15px rgba(251,191,36,0.05)' }}
        >
          <div className="grid grid-cols-[40px_1fr_120px_80px_80px_140px] gap-3 px-4 py-3 border-b border-zinc-800/60 text-[10px] font-medium uppercase tracking-wider text-white/40">
            <div>#</div>
            <div>Startup</div>
            <div>Sector</div>
            <div>Stage</div>
            <div className="text-amber-400">GOD</div>
            <div className="text-right">List</div>
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-20 text-zinc-500 text-sm">Searching...</div>
            ) : results.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-2 text-zinc-500 text-sm">
                No startups match. Try different filters or run a search.
              </div>
            ) : (
              results.map((row, idx) => (
                <div
                  key={row.id}
                  className="grid grid-cols-[40px_1fr_120px_80px_80px_140px] gap-3 px-4 py-3 border-b border-zinc-800/30 hover:bg-zinc-800/20 items-center"
                >
                  <div className="text-sm text-zinc-600">{idx + 1}</div>
                  <div className="min-w-0">
                    <div className="text-sm text-white truncate">{row.name || '—'}</div>
                    {row.tagline && <div className="text-[11px] text-zinc-600 truncate">{row.tagline}</div>}
                    {row.website && (
                      <a
                        href={row.website.startsWith('http') ? row.website : `https://${row.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-amber-400/80 hover:text-amber-400 truncate block"
                      >
                        {row.website.replace(/^https?:\/\//, '')}
                      </a>
                    )}
                  </div>
                  <div className="text-xs text-zinc-500 truncate">
                    {(row.sectors || []).slice(0, 2).join(', ') || '—'}
                  </div>
                  <div className="text-xs text-zinc-500">{row.stage_estimate || '—'}</div>
                  <div>
                    <span
                      className="text-sm font-semibold tabular-nums"
                      style={{
                        color: (row.total_god_score ?? 0) >= 70 ? '#22d3ee' : (row.total_god_score ?? 0) >= 50 ? '#a1a1aa' : '#52525b',
                      }}
                    >
                      {row.total_god_score ?? '—'}
                    </span>
                  </div>
                  <div className="relative flex justify-end" ref={addDropdown === row.id ? addDropdownRef : null}>
                    <button
                      onClick={() => openAddDropdown(row.id)}
                      className="px-2 py-1 rounded text-xs bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25"
                    >
                      Add to list
                    </button>
                    {addDropdown === row.id && (
                      <AddToListDropdown
                        lists={lists}
                        listsLoading={listsLoading}
                        onSelectList={listId => addToList(row.id, listId)}
                        onCreateList={name => addToList(row.id, null, name)}
                        onClose={() => setAddDropdown(null)}
                      />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {!loading && results.length > 0 && hasMore && (
          <div className="text-center py-4">
            <span className="text-xs text-zinc-600">Showing first {results.length} of {total}. Refine filters to narrow.</span>
          </div>
        )}
      </main>

      <footer className="max-w-7xl mx-auto px-4 sm:px-6 py-4 border-t border-zinc-800/30 mt-8">
        <div className="flex items-center justify-between text-xs text-zinc-600">
          <span>pythh.ai — investor lookup</span>
        </div>
      </footer>
    </div>
  );
}

function AddToListDropdown({
  lists,
  listsLoading,
  onSelectList,
  onCreateList,
  onClose,
}: {
  lists: ListMeta[];
  listsLoading: boolean;
  onSelectList: (listId: string) => void;
  onCreateList: (name: string) => void;
  onClose: () => void;
}) {
  const [newName, setNewName] = useState('');
  const [showNew, setShowNew] = useState(false);

  return (
    <div
      className="absolute right-0 top-full z-20 mt-1 w-56 py-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl"
      onClick={e => e.stopPropagation()}
    >
      <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-zinc-500">Add to list</div>
      {listsLoading ? (
        <div className="px-3 py-2 text-xs text-zinc-500">Loading lists...</div>
      ) : (
        <>
          {lists.map(l => (
            <button
              key={l.id}
              onClick={() => onSelectList(l.id)}
              className="w-full text-left px-3 py-2 text-sm text-white hover:bg-zinc-800"
            >
              {l.name}
            </button>
          ))}
          {showNew ? (
            <div className="px-3 py-2 border-t border-zinc-800">
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="New list name"
                className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-white text-sm mb-2"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (newName.trim()) onCreateList(newName.trim());
                    setShowNew(false);
                    setNewName('');
                  }}
                  className="px-2 py-1 rounded text-xs bg-amber-500/20 text-amber-400"
                >
                  Create & add
                </button>
                <button onClick={() => { setShowNew(false); setNewName(''); }} className="px-2 py-1 text-xs text-zinc-500">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowNew(true)}
              className="w-full text-left px-3 py-2 text-sm text-amber-400 hover:bg-zinc-800 border-t border-zinc-800"
            >
              + Create new list
            </button>
          )}
        </>
      )}
      <button onClick={onClose} className="w-full text-left px-3 py-1.5 text-xs text-zinc-500 hover:bg-zinc-800">
        Close
      </button>
    </div>
  );
}
