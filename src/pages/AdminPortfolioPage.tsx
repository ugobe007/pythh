/**
 * Admin — Virtual Portfolio Management
 * Route: /admin/portfolio
 *
 * - View all portfolio entries with status, MOIC, holding days
 * - Seed portfolio from GOD ≥70 approved startups
 * - Log funding rounds, acquisitions, IPOs
 * - Mark exits
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw, Plus, DollarSign, TrendingUp, Award, ExternalLink,
  CheckCircle, AlertTriangle, Loader2, ArrowLeft, X
} from 'lucide-react';
import { apiUrl } from '../lib/apiConfig';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface PortfolioEntry {
  id: string;
  startup_id: string;
  startup_name: string;
  entry_date: string;
  entry_god_score: number;
  entry_valuation_usd?: number;
  current_valuation_usd?: number;
  virtual_check_usd: number;
  status: string;
  moic?: number;
  irr_annualized?: number;
  holding_days?: number;
  exit_type?: string;
  exit_acquirer?: string;
  added_by?: string;
}

interface EventFormState {
  open: boolean;
  startupId: string;
  startupName: string;
}

interface ExitFormState {
  open: boolean;
  portfolioId: string;
  startupId: string;
  startupName: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fmt(n?: number | null) {
  if (!n) return '—';
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

function fmtDate(s?: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function statusColor(s: string) {
  const m: Record<string, string> = {
    active: '#00e5a0', acquired: '#ffd700', ipo: '#a78bfa',
    exited: '#60a5fa', written_off: '#ef4444',
  };
  return m[s] ?? '#888';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function AdminPortfolioPage() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<PortfolioEntry[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [eventForm, setEventForm] = useState<EventFormState>({ open: false, startupId: '', startupName: '' });
  const [exitForm, setExitForm] = useState<ExitFormState>({ open: false, portfolioId: '', startupId: '', startupName: '' });
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => { loadData(); }, []);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  async function loadData() {
    setLoading(true);
    try {
      const [listRes, metricsRes] = await Promise.all([
        fetch(apiUrl('/api/portfolio?limit=500')),
        fetch(apiUrl('/api/portfolio/metrics')),
      ]);
      const listData = await listRes.json();
      const metricsData = await metricsRes.json();
      setEntries(listData.entries ?? []);
      setMetrics(metricsData.metrics ?? {});
    } catch (err: any) {
      showToast(err.message, false);
    } finally {
      setLoading(false);
    }
  }

  async function handleSeed() {
    setSeeding(true);
    setSeedResult(null);
    try {
      const res = await fetch(apiUrl('/api/admin/portfolio/seed'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threshold: 70 }),
      });
      const data = await res.json();
      setSeedResult(`Added ${data.added}, skipped ${data.skipped}${data.errors?.length ? `, ${data.errors.length} errors` : ''}`);
      showToast(`Seeded: +${data.added} startups`);
      loadData();
    } catch (err: any) {
      showToast(err.message, false);
    } finally {
      setSeeding(false);
    }
  }

  const filtered = entries.filter(e =>
    statusFilter === 'all' ? true : e.status === statusFilter
  );

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', fontFamily: 'Inter, sans-serif' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          padding: '12px 20px', borderRadius: 10,
          background: toast.ok ? '#0a2a0a' : '#2a0a0a',
          border: `1px solid ${toast.ok ? '#00e5a0' : '#ef4444'}`,
          color: toast.ok ? '#00e5a0' : '#ef4444',
          fontSize: 14, fontWeight: 600,
        }}>{toast.msg}</div>
      )}

      {/* Header */}
      <div style={{ borderBottom: '1px solid #1a1a1a', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={() => navigate('/admin')}
            style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}
          >
            <ArrowLeft size={16} /> Admin
          </button>
          <span style={{ color: '#333' }}>›</span>
          <span style={{ fontWeight: 700, fontSize: 16 }}>Virtual Portfolio</span>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={handleSeed}
            disabled={seeding}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 16px', borderRadius: 8,
              background: '#ff660022', border: '1px solid #ff660066',
              color: '#ff6600', cursor: seeding ? 'not-allowed' : 'pointer',
              fontSize: 13, fontWeight: 600, opacity: seeding ? 0.7 : 1,
            }}
          >
            {seeding ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={14} />}
            Seed GOD ≥70
          </button>

          <button
            onClick={loadData}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 16px', borderRadius: 8,
              background: '#111', border: '1px solid #2a2a2a',
              color: '#aaa', cursor: 'pointer', fontSize: 13,
            }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>

        {/* Metrics */}
        {metrics && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 32 }}>
            {[
              { label: 'Total Picks', value: metrics.total_picks ?? 0 },
              { label: 'Active', value: metrics.active_picks ?? 0 },
              { label: 'Exits', value: metrics.successful_exits ?? 0 },
              { label: 'Win Rate', value: metrics.win_rate_pct ? `${metrics.win_rate_pct}%` : '—' },
              { label: 'Avg MOIC', value: metrics.avg_moic ? `${metrics.avg_moic}×` : '—' },
              { label: 'Deployed', value: fmt(metrics.total_virtual_deployed_usd) },
            ].map(m => (
              <div key={m.label} style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 10, padding: '16px 20px' }}>
                <div style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{m.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{m.value}</div>
              </div>
            ))}
          </div>
        )}

        {seedResult && (
          <div style={{ marginBottom: 20, padding: '12px 16px', background: '#0a2a0a', border: '1px solid #00e5a044', borderRadius: 8, fontSize: 14, color: '#00e5a0' }}>
            <CheckCircle size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Last seed: {seedResult}
          </div>
        )}

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {['all', 'active', 'acquired', 'ipo', 'exited', 'written_off'].map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              style={{
                padding: '5px 14px', borderRadius: 20, fontSize: 12,
                border: statusFilter === f ? `1px solid ${statusColor(f === 'all' ? 'active' : f)}` : '1px solid #2a2a2a',
                background: statusFilter === f ? `${statusColor(f === 'all' ? 'active' : f)}18` : 'transparent',
                color: statusFilter === f ? statusColor(f === 'all' ? 'active' : f) : '#555',
                cursor: 'pointer', fontWeight: 600, textTransform: 'capitalize',
              }}
            >
              {f} ({f === 'all' ? entries.length : entries.filter(e => e.status === f).length})
            </button>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#444' }}>Loading…</div>
        ) : (
          <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1e1e1e', background: '#0d0d0d' }}>
                  {['Startup', 'Status', 'GOD', 'Entry Date', 'Entry Val', 'Current Val', 'MOIC', 'Days', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: '#555', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((e, i) => (
                  <tr key={e.id} style={{ borderBottom: '1px solid #161616', background: i % 2 === 0 ? '#111' : '#0e0e0e' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{e.startup_name}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20, color: statusColor(e.status), background: `${statusColor(e.status)}18`, border: `1px solid ${statusColor(e.status)}33` }}>
                        {e.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#ff6600', fontWeight: 700 }}>{e.entry_god_score}</td>
                    <td style={{ padding: '12px 16px', color: '#666' }}>{fmtDate(e.entry_date)}</td>
                    <td style={{ padding: '12px 16px', color: '#666' }}>{fmt(e.entry_valuation_usd)}</td>
                    <td style={{ padding: '12px 16px', color: '#aaa' }}>{fmt(e.current_valuation_usd)}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 800, color: (e.moic ?? 1) > 1 ? '#00e5a0' : '#fff' }}>
                      {e.moic ? `${e.moic.toFixed(2)}×` : '1.00×'}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#666' }}>{e.holding_days ?? '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {e.status === 'active' && (
                          <>
                            <button
                              onClick={() => setEventForm({ open: true, startupId: e.startup_id, startupName: e.startup_name })}
                              style={{ padding: '4px 10px', borderRadius: 6, background: '#0a1a2a', border: '1px solid #1e3a52', color: '#60a5fa', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
                            >+ Event</button>
                            <button
                              onClick={() => setExitForm({ open: true, portfolioId: e.id, startupId: e.startup_id, startupName: e.startup_name })}
                              style={{ padding: '4px 10px', borderRadius: 6, background: '#1a0a00', border: '1px solid #52200a', color: '#ff6600', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
                            >Exit</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div style={{ padding: 40, textAlign: 'center', color: '#444' }}>No entries for this filter.</div>
            )}
          </div>
        )}
      </div>

      {/* Log Event Modal */}
      {eventForm.open && (
        <EventModal
          startupId={eventForm.startupId}
          startupName={eventForm.startupName}
          onClose={() => setEventForm({ open: false, startupId: '', startupName: '' })}
          onSaved={() => { loadData(); setEventForm({ open: false, startupId: '', startupName: '' }); showToast('Event logged'); }}
        />
      )}

      {/* Exit Modal */}
      {exitForm.open && (
        <ExitModal
          portfolioId={exitForm.portfolioId}
          startupId={exitForm.startupId}
          startupName={exitForm.startupName}
          onClose={() => setExitForm({ open: false, portfolioId: '', startupId: '', startupName: '' })}
          onSaved={() => { loadData(); setExitForm({ open: false, portfolioId: '', startupId: '', startupName: '' }); showToast('Exit recorded'); }}
        />
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Event Modal
// ---------------------------------------------------------------------------
function EventModal({ startupId, startupName, onClose, onSaved }: {
  startupId: string; startupName: string;
  onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    eventType: 'funding_round',
    eventDate: new Date().toISOString().split('T')[0],
    roundType: '',
    amountUsd: '',
    preMoney: '',
    postMoney: '',
    leadInvestor: '',
    headline: '',
    sourceUrl: '',
    verified: false,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function submit() {
    setSaving(true);
    setErr('');
    try {
      const res = await fetch(apiUrl('/api/admin/portfolio/events'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startupId,
          eventType: form.eventType,
          eventDate: form.eventDate,
          roundType: form.roundType || undefined,
          amountUsd: form.amountUsd ? Number(form.amountUsd) : undefined,
          preMoney: form.preMoney ? Number(form.preMoney) : undefined,
          postMoney: form.postMoney ? Number(form.postMoney) : undefined,
          leadInvestor: form.leadInvestor || undefined,
          headline: form.headline || undefined,
          sourceUrl: form.sourceUrl || undefined,
          verified: form.verified,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
      onSaved();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return <Modal title={`Log event — ${startupName}`} onClose={onClose}>
    <FieldRow label="Event type">
      <select value={form.eventType} onChange={e => setForm(f => ({ ...f, eventType: e.target.value }))} style={selectStyle}>
        {['funding_round','acquisition','ipo','revenue_milestone','product_launch','prediction_hit'].map(t => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
    </FieldRow>
    <FieldRow label="Date"><input type="date" value={form.eventDate} onChange={e => setForm(f => ({ ...f, eventDate: e.target.value }))} style={inputStyle} /></FieldRow>
    <FieldRow label="Round type"><input placeholder="Seed / Series A…" value={form.roundType} onChange={e => setForm(f => ({ ...f, roundType: e.target.value }))} style={inputStyle} /></FieldRow>
    <FieldRow label="Amount raised ($)"><input type="number" placeholder="5000000" value={form.amountUsd} onChange={e => setForm(f => ({ ...f, amountUsd: e.target.value }))} style={inputStyle} /></FieldRow>
    <FieldRow label="Pre-money ($)"><input type="number" placeholder="15000000" value={form.preMoney} onChange={e => setForm(f => ({ ...f, preMoney: e.target.value }))} style={inputStyle} /></FieldRow>
    <FieldRow label="Post-money ($)"><input type="number" placeholder="20000000" value={form.postMoney} onChange={e => setForm(f => ({ ...f, postMoney: e.target.value }))} style={inputStyle} /></FieldRow>
    <FieldRow label="Lead investor"><input placeholder="Sequoia / a16z…" value={form.leadInvestor} onChange={e => setForm(f => ({ ...f, leadInvestor: e.target.value }))} style={inputStyle} /></FieldRow>
    <FieldRow label="Headline"><input placeholder="Acme raises $10M Series A" value={form.headline} onChange={e => setForm(f => ({ ...f, headline: e.target.value }))} style={inputStyle} /></FieldRow>
    <FieldRow label="Source URL"><input placeholder="https://techcrunch.com/…" value={form.sourceUrl} onChange={e => setForm(f => ({ ...f, sourceUrl: e.target.value }))} style={inputStyle} /></FieldRow>
    <FieldRow label="Verified">
      <input type="checkbox" checked={form.verified} onChange={e => setForm(f => ({ ...f, verified: e.target.checked }))} />
      <span style={{ fontSize: 12, color: '#666', marginLeft: 6 }}>Mark as verified</span>
    </FieldRow>
    {err && <div style={{ color: '#ef4444', fontSize: 13, marginTop: 8 }}>{err}</div>}
    <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
      <button onClick={onClose} style={cancelBtnStyle}>Cancel</button>
      <button onClick={submit} disabled={saving} style={saveBtnStyle}>{saving ? 'Saving…' : 'Save Event'}</button>
    </div>
  </Modal>;
}

// ---------------------------------------------------------------------------
// Exit Modal
// ---------------------------------------------------------------------------
function ExitModal({ portfolioId, startupId, startupName, onClose, onSaved }: {
  portfolioId: string; startupId: string; startupName: string;
  onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({ exitType: 'acquisition', exitDate: new Date().toISOString().split('T')[0], exitValuation: '', acquirer: '', sourceUrl: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function submit() {
    setSaving(true);
    setErr('');
    try {
      const res = await fetch(apiUrl('/api/admin/portfolio/exit'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startupId,
          exitType: form.exitType,
          exitDate: form.exitDate,
          exitValuationUsd: form.exitValuation ? Number(form.exitValuation) : undefined,
          acquirer: form.acquirer || undefined,
          exitSourceUrl: form.sourceUrl || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
      onSaved();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return <Modal title={`Record exit — ${startupName}`} onClose={onClose}>
    <FieldRow label="Exit type">
      <select value={form.exitType} onChange={e => setForm(f => ({ ...f, exitType: e.target.value }))} style={selectStyle}>
        {['acquisition','ipo','secondary','unknown'].map(t => <option key={t} value={t}>{t}</option>)}
      </select>
    </FieldRow>
    <FieldRow label="Exit date"><input type="date" value={form.exitDate} onChange={e => setForm(f => ({ ...f, exitDate: e.target.value }))} style={inputStyle} /></FieldRow>
    <FieldRow label="Exit valuation ($)"><input type="number" placeholder="100000000" value={form.exitValuation} onChange={e => setForm(f => ({ ...f, exitValuation: e.target.value }))} style={inputStyle} /></FieldRow>
    <FieldRow label="Acquirer / Exchange"><input placeholder="Google / NASDAQ" value={form.acquirer} onChange={e => setForm(f => ({ ...f, acquirer: e.target.value }))} style={inputStyle} /></FieldRow>
    <FieldRow label="Source URL"><input placeholder="https://…" value={form.sourceUrl} onChange={e => setForm(f => ({ ...f, sourceUrl: e.target.value }))} style={inputStyle} /></FieldRow>
    {err && <div style={{ color: '#ef4444', fontSize: 13, marginTop: 8 }}>{err}</div>}
    <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
      <button onClick={onClose} style={cancelBtnStyle}>Cancel</button>
      <button onClick={submit} disabled={saving} style={saveBtnStyle}>{saving ? 'Saving…' : 'Record Exit'}</button>
    </div>
  </Modal>;
}

// ---------------------------------------------------------------------------
// Shared modal/form primitives
// ---------------------------------------------------------------------------
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000a', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: 14, width: '100%', maxWidth: 520, padding: '28px 32px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h3 style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 12, alignItems: 'center', marginBottom: 12 }}>
      <label style={{ fontSize: 13, color: '#888', fontWeight: 500 }}>{label}</label>
      <div>{children}</div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 12px', background: '#0a0a0a',
  border: '1px solid #2a2a2a', borderRadius: 7, color: '#fff', fontSize: 13,
  boxSizing: 'border-box',
};

const selectStyle: React.CSSProperties = { ...inputStyle };

const saveBtnStyle: React.CSSProperties = {
  padding: '9px 20px', borderRadius: 8, background: '#ff6600',
  border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13,
};

const cancelBtnStyle: React.CSSProperties = {
  padding: '9px 20px', borderRadius: 8, background: 'transparent',
  border: '1px solid #2a2a2a', color: '#888', cursor: 'pointer', fontSize: 13,
};
