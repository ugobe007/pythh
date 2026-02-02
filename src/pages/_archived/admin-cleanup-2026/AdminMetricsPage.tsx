/**
 * AdminMetricsPage - Conversion funnel + retention loop dashboard
 * 
 * Tables only (no charts) showing:
 * - KPI funnel table (pricing → upgrade)
 * - Loop health table (alerts, emails, shares, matches)
 * - Sources table (what drives upgrades)
 * - Daily breakdown table
 */

import React, { useState } from 'react';
import { useAdminMetrics, SourceData, DailyRow } from '../hooks/useAdminMetrics';
import { ArrowUpRight, ArrowDownRight, RefreshCw, TrendingUp, Mail, Share2, Users, DollarSign, Calendar, Activity } from 'lucide-react';

// Range options
const RANGE_OPTIONS = [
  { label: '7d', value: 7 },
  { label: '30d', value: 30 }
];

// Sortable column type
type SortColumn = 'source' | 'pricing_views' | 'cta_clicked' | 'upgrades_started' | 'upgrades_completed' | 'revenue_estimate' | 'cvr_view_to_complete';
type SortDirection = 'asc' | 'desc';

function AdminMetricsPage() {
  const [rangeDays, setRangeDays] = useState(7);
  const [sortColumn, setSortColumn] = useState<SortColumn>('upgrades_completed');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  const { overview, sources, daily, loading, error, refresh, isAdmin } = useAdminMetrics(rangeDays);

  // Handle sort
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  // Sort sources
  const sortedSources = React.useMemo(() => {
    if (!sources?.sources) return [];
    
    return [...sources.sources].sort((a, b) => {
      let aVal: number | string = a[sortColumn];
      let bVal: number | string = b[sortColumn];
      
      // Handle revenue_estimate and cvr strings
      if (sortColumn === 'revenue_estimate') {
        aVal = parseInt(a.revenue_estimate.replace('$', '')) || 0;
        bVal = parseInt(b.revenue_estimate.replace('$', '')) || 0;
      } else if (sortColumn === 'cvr_view_to_complete') {
        aVal = parseFloat(a.cvr_view_to_complete.replace('%', '')) || 0;
        bVal = parseFloat(b.cvr_view_to_complete.replace('%', '')) || 0;
      }
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      
      return sortDirection === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [sources?.sources, sortColumn, sortDirection]);

  if (!isAdmin) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-400">Admin access required</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8 text-center">
        <RefreshCw className="w-8 h-8 animate-spin text-amber-400 mx-auto" />
        <p className="text-zinc-400 mt-2">Loading metrics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-400">{error}</p>
        <button onClick={refresh} className="mt-4 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Metrics Dashboard</h1>
          <p className="text-zinc-400 text-sm mt-1">Conversion funnel + retention loop health</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Range selector */}
          <div className="flex bg-zinc-800 rounded-lg p-1">
            {RANGE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setRangeDays(opt.value)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  rangeDays === opt.value 
                    ? 'bg-amber-500 text-black' 
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          
          {/* Refresh button */}
          <button 
            onClick={refresh}
            className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4 text-zinc-400" />
          </button>
        </div>
      </div>

      {/* Section 1: Funnel KPIs */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-amber-400" />
          <h2 className="text-lg font-semibold text-white">Conversion Funnel</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left py-3 px-4 text-zinc-400 font-medium text-sm">Metric</th>
                <th className="text-right py-3 px-4 text-zinc-400 font-medium text-sm">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              <tr>
                <td className="py-3 px-4 text-zinc-300">Pricing Viewed</td>
                <td className="py-3 px-4 text-right text-white font-mono">{overview?.funnel.pricing_viewed ?? 0}</td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-zinc-300">CTA Clicked</td>
                <td className="py-3 px-4 text-right text-white font-mono">{overview?.funnel.upgrade_cta_clicked ?? 0}</td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-zinc-300">Upgrade Started</td>
                <td className="py-3 px-4 text-right text-white font-mono">{overview?.funnel.upgrade_started ?? 0}</td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-zinc-300">Upgrade Completed</td>
                <td className="py-3 px-4 text-right text-emerald-400 font-mono font-semibold">{overview?.funnel.upgrade_completed ?? 0}</td>
              </tr>
              <tr className="bg-zinc-800/30">
                <td className="py-3 px-4 text-zinc-300">CVR (View → Complete)</td>
                <td className="py-3 px-4 text-right text-amber-400 font-mono">{overview?.funnel.cvr_view_to_complete ?? '0%'}</td>
              </tr>
              <tr className="bg-zinc-800/30">
                <td className="py-3 px-4 text-zinc-300">CVR (CTA → Complete)</td>
                <td className="py-3 px-4 text-right text-amber-400 font-mono">{overview?.funnel.cvr_cta_to_complete ?? '0%'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2: Loop Health */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-cyan-400" />
          <h2 className="text-lg font-semibold text-white">Retention Loop Health</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left py-3 px-4 text-zinc-400 font-medium text-sm">Metric</th>
                <th className="text-right py-3 px-4 text-zinc-400 font-medium text-sm">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              <tr>
                <td className="py-3 px-4 text-zinc-300 flex items-center gap-2">
                  <span className="w-2 h-2 bg-amber-400 rounded-full"></span>
                  Alerts Created
                </td>
                <td className="py-3 px-4 text-right text-white font-mono">{overview?.loop.alerts_created ?? 0}</td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-zinc-300 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-zinc-500" />
                  Emails Sent
                </td>
                <td className="py-3 px-4 text-right text-white font-mono">{overview?.loop.emails_sent ?? 0}</td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-zinc-300 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-emerald-500" />
                  Emails Clicked
                </td>
                <td className="py-3 px-4 text-right text-emerald-400 font-mono">{overview?.loop.emails_clicked ?? 0}</td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-zinc-300 flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-zinc-500" />
                  Shares Opened
                </td>
                <td className="py-3 px-4 text-right text-white font-mono">{overview?.loop.shares_opened ?? 0}</td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-zinc-300 flex items-center gap-2">
                  <Users className="w-4 h-4 text-zinc-500" />
                  Matches Viewed
                </td>
                <td className="py-3 px-4 text-right text-white font-mono">{overview?.loop.matches_viewed ?? 0}</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        {/* User stats row */}
        <div className="mt-4 pt-4 border-t border-zinc-800 flex gap-6">
          <div>
            <span className="text-zinc-500 text-sm">Active Users (last {rangeDays}d):</span>
            <span className="ml-2 text-white font-mono">{overview?.users.active_users ?? 0}</span>
          </div>
          <div>
            <span className="text-zinc-500 text-sm">New Users:</span>
            <span className="ml-2 text-white font-mono">{overview?.users.new_users ?? 0}</span>
          </div>
        </div>
      </div>

      {/* Section 3: Sources Table */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-white">Top Converting Sources</h2>
          </div>
          {sources?.total_revenue && (
            <span className="text-emerald-400 font-mono font-semibold">
              Total: {sources.total_revenue}
            </span>
          )}
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                <SortableHeader column="source" label="Source" current={sortColumn} direction={sortDirection} onSort={handleSort} />
                <SortableHeader column="pricing_views" label="Pricing Views" current={sortColumn} direction={sortDirection} onSort={handleSort} align="right" />
                <SortableHeader column="cta_clicked" label="CTA Clicked" current={sortColumn} direction={sortDirection} onSort={handleSort} align="right" />
                <SortableHeader column="upgrades_started" label="Started" current={sortColumn} direction={sortDirection} onSort={handleSort} align="right" />
                <SortableHeader column="upgrades_completed" label="Completed" current={sortColumn} direction={sortDirection} onSort={handleSort} align="right" />
                <SortableHeader column="revenue_estimate" label="Revenue" current={sortColumn} direction={sortDirection} onSort={handleSort} align="right" />
                <SortableHeader column="cvr_view_to_complete" label="CVR" current={sortColumn} direction={sortDirection} onSort={handleSort} align="right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {sortedSources.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-500">
                    No upgrade data yet
                  </td>
                </tr>
              ) : (
                sortedSources.map((source, i) => (
                  <tr key={source.source} className={i === 0 ? 'bg-emerald-900/10' : ''}>
                    <td className="py-3 px-4 text-zinc-300 font-mono text-sm">
                      {source.source}
                      {i === 0 && <span className="ml-2 text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">TOP</span>}
                    </td>
                    <td className="py-3 px-4 text-right text-white font-mono">{source.pricing_views}</td>
                    <td className="py-3 px-4 text-right text-white font-mono">{source.cta_clicked}</td>
                    <td className="py-3 px-4 text-right text-white font-mono">{source.upgrades_started}</td>
                    <td className="py-3 px-4 text-right text-emerald-400 font-mono font-semibold">{source.upgrades_completed}</td>
                    <td className="py-3 px-4 text-right text-emerald-400 font-mono">{source.revenue_estimate}</td>
                    <td className="py-3 px-4 text-right text-amber-400 font-mono">{source.cvr_view_to_complete}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 4: Daily Breakdown */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-violet-400" />
          <h2 className="text-lg font-semibold text-white">Daily Breakdown</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left py-3 px-3 text-zinc-400 font-medium sticky left-0 bg-zinc-900">Day</th>
                <th className="text-right py-3 px-3 text-zinc-400 font-medium">Pricing</th>
                <th className="text-right py-3 px-3 text-zinc-400 font-medium">CTA</th>
                <th className="text-right py-3 px-3 text-zinc-400 font-medium">Started</th>
                <th className="text-right py-3 px-3 text-zinc-400 font-medium">Completed</th>
                <th className="text-right py-3 px-3 text-zinc-400 font-medium border-l border-zinc-800">Alerts</th>
                <th className="text-right py-3 px-3 text-zinc-400 font-medium">Emails</th>
                <th className="text-right py-3 px-3 text-zinc-400 font-medium">Clicked</th>
                <th className="text-right py-3 px-3 text-zinc-400 font-medium">Shares</th>
                <th className="text-right py-3 px-3 text-zinc-400 font-medium">Matches</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {(daily?.daily || []).map((row, i) => (
                <tr key={row.day} className={i === 0 ? 'bg-violet-900/10' : ''}>
                  <td className="py-2 px-3 text-zinc-300 font-mono sticky left-0 bg-zinc-900">
                    {row.day}
                    {i === 0 && <span className="ml-2 text-xs text-violet-400">today</span>}
                  </td>
                  <td className="py-2 px-3 text-right text-white font-mono">{row.pricing_viewed || '-'}</td>
                  <td className="py-2 px-3 text-right text-white font-mono">{row.upgrade_cta_clicked || '-'}</td>
                  <td className="py-2 px-3 text-right text-white font-mono">{row.upgrade_started || '-'}</td>
                  <td className="py-2 px-3 text-right text-emerald-400 font-mono">{row.upgrade_completed || '-'}</td>
                  <td className="py-2 px-3 text-right text-white font-mono border-l border-zinc-800">{row.alerts_created || '-'}</td>
                  <td className="py-2 px-3 text-right text-white font-mono">{row.emails_sent || '-'}</td>
                  <td className="py-2 px-3 text-right text-white font-mono">{row.emails_clicked || '-'}</td>
                  <td className="py-2 px-3 text-right text-white font-mono">{row.shares_opened || '-'}</td>
                  <td className="py-2 px-3 text-right text-white font-mono">{row.matches_viewed || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Sortable header component
interface SortableHeaderProps {
  column: SortColumn;
  label: string;
  current: SortColumn;
  direction: SortDirection;
  onSort: (column: SortColumn) => void;
  align?: 'left' | 'right';
}

function SortableHeader({ column, label, current, direction, onSort, align = 'left' }: SortableHeaderProps) {
  const isActive = current === column;
  
  return (
    <th 
      className={`py-3 px-4 text-zinc-400 font-medium text-sm cursor-pointer hover:text-white transition-colors ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
      onClick={() => onSort(column)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive && (
          direction === 'asc' 
            ? <ArrowUpRight className="w-3 h-3" />
            : <ArrowDownRight className="w-3 h-3" />
        )}
      </span>
    </th>
  );
}

export default AdminMetricsPage;
