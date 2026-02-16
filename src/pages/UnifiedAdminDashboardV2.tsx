/**
 * Unified Admin Dashboard - Streamlined Version
 * Jan 2026 Cleanup - Focus on GOD Score Management
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Sparkles, Database, Activity, Cpu, RefreshCw, 
  Settings, ArrowRight, Rss, Users, BarChart3,
  FileText, Search, Shield, AlertCircle
} from 'lucide-react';
import { adminRpc } from '../services/adminRpc';
import { GODScoreMonitor, SocialSignalsMonitor, SystemHealthAlerts } from '../components/admin';

interface QuickStats {
  startups_approved: number;
  startups_pending: number;
  investors_total: number;
  matches_total: number;
  avg_god_score: number;
}

export default function UnifiedAdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<QuickStats>({
    startups_approved: 0,
    startups_pending: 0,
    investors_total: 0,
    matches_total: 0,
    avg_god_score: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const kpis = await adminRpc.getDashboardKpis();
      setStats(kpis);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const QuickLink = ({ 
    icon: Icon, 
    label, 
    route, 
    color = 'slate',
    stat 
  }: { 
    icon: any; 
    label: string; 
    route: string; 
    color?: string;
    stat?: string | number;
  }) => {
    const colorClasses: Record<string, string> = {
      amber: 'hover:border-amber-500/50 hover:bg-amber-500/10',
      cyan: 'hover:border-cyan-500/50 hover:bg-cyan-500/10',
      green: 'hover:border-green-500/50 hover:bg-green-500/10',
      purple: 'hover:border-purple-500/50 hover:bg-purple-500/10',
      slate: 'hover:border-slate-500/50 hover:bg-slate-500/10',
    };

    return (
      <button
        onClick={() => navigate(route)}
        className={`group flex items-center gap-3 p-3 bg-slate-800/50 border border-slate-700 rounded-lg transition-all ${colorClasses[color]}`}
      >
        <Icon className="w-5 h-5 text-slate-400 group-hover:text-white" />
        <div className="flex-1 text-left">
          <div className="text-sm font-medium text-white">{label}</div>
          {stat !== undefined && (
            <div className="text-xs text-slate-500">{stat}</div>
          )}
        </div>
        <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-white group-hover:translate-x-1 transition-all" />
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
            Admin Dashboard
          </h1>
          <p className="text-slate-400 mt-1">GOD Score Management & System Monitoring</p>
        </div>

        {/* Quick Stats - Clickable KPI Cards */}
        <div className="grid grid-cols-5 gap-4 mb-8">
          <button
            onClick={() => navigate('/admin/edit-startups?status=approved')}
            className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-center hover:border-green-500/50 hover:bg-green-500/5 transition-all cursor-pointer group"
          >
            <div className="text-2xl font-bold text-white group-hover:text-green-400 transition-colors">{stats.startups_approved.toLocaleString()}</div>
            <div className="text-xs text-slate-400 mt-1">Approved</div>
          </button>
          <button
            onClick={() => navigate('/admin/review-queue')}
            className="bg-slate-800/50 border border-yellow-500/30 rounded-xl p-4 text-center hover:border-yellow-500/60 hover:bg-yellow-500/10 transition-all cursor-pointer group animate-pulse-slow"
          >
            <div className="text-2xl font-bold text-yellow-400 group-hover:text-yellow-300 transition-colors">{stats.startups_pending.toLocaleString()}</div>
            <div className="text-xs text-slate-400 mt-1">Pending Review →</div>
          </button>
          <button
            onClick={() => navigate('/admin/discovered-investors')}
            className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-center hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all cursor-pointer group"
          >
            <div className="text-2xl font-bold text-white group-hover:text-cyan-400 transition-colors">{stats.investors_total.toLocaleString()}</div>
            <div className="text-xs text-slate-400 mt-1">Investors</div>
          </button>
          <button
            onClick={() => navigate('/admin/health')}
            className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-center hover:border-purple-500/50 hover:bg-purple-500/5 transition-all cursor-pointer group"
          >
            <div className="text-2xl font-bold text-white group-hover:text-purple-400 transition-colors">{stats.matches_total.toLocaleString()}</div>
            <div className="text-xs text-slate-400 mt-1">Matches</div>
          </button>
          <button
            onClick={() => navigate('/admin/god-scores')}
            className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-center hover:border-amber-500/50 hover:bg-amber-500/5 transition-all cursor-pointer group"
          >
            <div className="text-2xl font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
              {Math.round(stats.avg_god_score)}
            </div>
            <div className="text-xs text-slate-400 mt-1">Avg GOD Score</div>
          </button>
        </div>

        {/* Pending Review Banner */}
        {stats.startups_pending > 0 && (
          <button
            onClick={() => navigate('/admin/review-queue')}
            className="w-full mb-6 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-center gap-4 hover:bg-yellow-500/15 hover:border-yellow-500/50 transition-all group"
          >
            <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-yellow-400" />
            </div>
            <div className="flex-1 text-left">
              <div className="text-sm font-bold text-yellow-400">{stats.startups_pending} startups awaiting review</div>
              <div className="text-xs text-slate-400">Click to open Review Queue — approve, reject, or adjust GOD scores</div>
            </div>
            <ArrowRight className="w-5 h-5 text-yellow-400 group-hover:translate-x-1 transition-transform" />
          </button>
        )}

        {/* Main Grid: Core Tools */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* GOD Score Monitor - Takes 2 columns */}
          <div className="lg:col-span-2">
            <GODScoreMonitor />
          </div>
          
          {/* System Health Alerts */}
          <div>
            <SystemHealthAlerts />
          </div>
        </div>

        {/* Social Signals + Quick Links */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Social Signals Monitor */}
          <div>
            <SocialSignalsMonitor />
          </div>

          {/* Quick Links - GOD Score Tools */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <h3 className="font-bold text-white">GOD Score Tools</h3>
            </div>
            <div className="space-y-2">
              <QuickLink icon={BarChart3} label="View All Scores" route="/admin/god-scores" color="amber" />
              <QuickLink icon={Settings} label="Algorithm Settings" route="/admin/god-settings" color="amber" />
              <QuickLink icon={BarChart3} label="Industry Rankings" route="/admin/industry-rankings" color="amber" />
            </div>
          </div>

          {/* Quick Links - Data Management */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Database className="w-5 h-5 text-cyan-400" />
              <h3 className="font-bold text-white">Data Management</h3>
            </div>
            <div className="space-y-2">
              <QuickLink icon={FileText} label="Edit Startups" route="/admin/edit-startups" color="cyan" stat={`${stats.startups_approved} approved`} />
              <QuickLink icon={Search} label="RSS Discoveries" route="/admin/discovered-startups" color="cyan" />
              <QuickLink icon={Users} label="Investors" route="/admin/discovered-investors" color="cyan" stat={`${stats.investors_total} total`} />
              <QuickLink icon={Rss} label="RSS Manager" route="/admin/rss-manager" color="cyan" />
            </div>
          </div>
        </div>

        {/* Bottom Row: System Tools */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* System Monitoring */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5 text-green-400" />
              <h3 className="font-bold text-white">System Monitoring</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <QuickLink icon={Shield} label="System Health" route="/admin/health" color="green" />
              <QuickLink icon={FileText} label="AI Logs" route="/admin/ai-logs" color="green" />
              <QuickLink icon={Settings} label="Diagnostic" route="/admin/diagnostic" color="slate" />
              <QuickLink icon={Database} label="Database Check" route="/admin/database-check" color="slate" />
            </div>
          </div>

          {/* AI/ML Tools */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Cpu className="w-5 h-5 text-purple-400" />
              <h3 className="font-bold text-white">AI/ML Tools</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <QuickLink icon={Cpu} label="AI Intelligence" route="/admin/ai-intelligence" color="purple" />
              <QuickLink icon={AlertCircle} label="Bulk Actions" route="/admin/actions" color="purple" />
              <QuickLink icon={Settings} label="Scrapers" route="/admin/scrapers" color="slate" />
              <QuickLink icon={RefreshCw} label="Refresh Stats" route="/admin" color="slate" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-slate-500">
          <p>Pythh Admin • GOD Algorithm v5 • Jan 2026</p>
        </div>
      </div>
    </div>
  );
}
