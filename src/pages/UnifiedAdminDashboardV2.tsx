/**
 * Unified Admin Dashboard - Streamlined Version
 * Jan 2026 Cleanup - Focus on GOD Score Management
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Sparkles, Database, Activity, Cpu, RefreshCw, 
  Settings, ArrowRight, Rss, Users, BarChart3,
  FileText, Search, Shield
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { GODScoreMonitor, SocialSignalsMonitor, SystemHealthAlerts } from '../components/admin';

interface QuickStats {
  totalStartups: number;
  totalInvestors: number;
  totalMatches: number;
  avgGodScore: number;
}

export default function UnifiedAdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<QuickStats>({
    totalStartups: 0,
    totalInvestors: 0,
    totalMatches: 0,
    avgGodScore: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [startups, investors, matches, scores] = await Promise.all([
        supabase.from('startup_uploads').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('investors').select('*', { count: 'exact', head: true }),
        supabase.from('startup_investor_matches').select('*', { count: 'exact', head: true }),
        supabase.from('startup_uploads').select('total_god_score').eq('status', 'approved').not('total_god_score', 'is', null)
      ]);

      const avgScore = scores.data && scores.data.length > 0
        ? scores.data.reduce((sum: number, s: any) => sum + (s.total_god_score || 0), 0) / scores.data.length
        : 0;

      setStats({
        totalStartups: startups.count || 0,
        totalInvestors: investors.count || 0,
        totalMatches: matches.count || 0,
        avgGodScore: Math.round(avgScore)
      });
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

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-white">{stats.totalStartups.toLocaleString()}</div>
            <div className="text-xs text-slate-400 mt-1">Startups</div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-white">{stats.totalInvestors.toLocaleString()}</div>
            <div className="text-xs text-slate-400 mt-1">Investors</div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-white">{stats.totalMatches.toLocaleString()}</div>
            <div className="text-xs text-slate-400 mt-1">Matches</div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
              {stats.avgGodScore}
            </div>
            <div className="text-xs text-slate-400 mt-1">Avg GOD Score</div>
          </div>
        </div>

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
              <QuickLink icon={FileText} label="Edit Startups" route="/admin/edit-startups" color="cyan" stat={`${stats.totalStartups} total`} />
              <QuickLink icon={Search} label="RSS Discoveries" route="/admin/discovered-startups" color="cyan" />
              <QuickLink icon={Users} label="Investors" route="/admin/discovered-investors" color="cyan" stat={`${stats.totalInvestors} total`} />
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
              <QuickLink icon={Cpu} label="ML Dashboard" route="/admin/ml-dashboard" color="purple" />
              <QuickLink icon={Sparkles} label="AI Intelligence" route="/admin/ai-intelligence" color="purple" />
              <QuickLink icon={Settings} label="Scrapers" route="/admin/scrapers" color="slate" />
              <QuickLink icon={Settings} label="Control Center" route="/admin/control" color="slate" />
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
