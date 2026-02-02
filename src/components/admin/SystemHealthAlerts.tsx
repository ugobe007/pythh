/**
 * System Health Alerts - Real-time health monitoring with actionable alerts
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Shield, AlertTriangle, CheckCircle, XCircle, 
  RefreshCw, ExternalLink, Clock
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface HealthCheck {
  name: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
  action?: { label: string; route: string };
}

export default function SystemHealthAlerts() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [checks, setChecks] = useState<HealthCheck[]>([]);
  const [overallStatus, setOverallStatus] = useState<'ok' | 'warning' | 'error'>('ok');
  const [lastChecked, setLastChecked] = useState<Date>(new Date());

  useEffect(() => {
    runHealthChecks();
    const interval = setInterval(runHealthChecks, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  const runHealthChecks = async () => {
    const newChecks: HealthCheck[] = [];

    try {
      // 1. GOD Score Distribution Check
      const { data: scores } = await supabase
        .from('startup_uploads')
        .select('total_god_score')
        .eq('status', 'approved');

      if (scores && scores.length > 0) {
        const total = scores.length;
        const lowBandCount = scores.filter(s => s.total_god_score >= 40 && s.total_god_score < 50).length;
        const lowBandPercent = (lowBandCount / total) * 100;
        const avg = scores.reduce((a, s) => a + (s.total_god_score || 0), 0) / total;

        if (lowBandPercent > 30) {
          newChecks.push({
            name: 'GOD Score Distribution',
            status: 'error',
            message: `${lowBandPercent.toFixed(1)}% stuck in 40-49 band - scoring issue detected`,
            action: { label: 'Fix Scores', route: '/admin/god-settings' }
          });
        } else if (lowBandPercent > 10) {
          newChecks.push({
            name: 'GOD Score Distribution',
            status: 'warning',
            message: `${lowBandPercent.toFixed(1)}% in 40-49 band - monitor closely`,
            action: { label: 'View Scores', route: '/admin/god-scores' }
          });
        } else {
          newChecks.push({
            name: 'GOD Score Distribution',
            status: 'ok',
            message: `Healthy distribution (avg: ${avg.toFixed(1)})`
          });
        }
      } else {
        newChecks.push({
          name: 'GOD Score Distribution',
          status: 'error',
          message: 'No approved startups found',
          action: { label: 'Add Startups', route: '/admin/edit-startups' }
        });
      }

      // 2. Match Count Check
      const { count: matchCount } = await supabase
        .from('startup_investor_matches')
        .select('*', { count: 'exact', head: true });

      if ((matchCount || 0) < 1000) {
        newChecks.push({
          name: 'Match Pool',
          status: 'error',
          message: `Only ${matchCount?.toLocaleString()} matches - regeneration needed`,
          action: { label: 'View Health', route: '/admin/health' }
        });
      } else if ((matchCount || 0) < 5000) {
        newChecks.push({
          name: 'Match Pool',
          status: 'warning',
          message: `${matchCount?.toLocaleString()} matches - below optimal`,
          action: { label: 'View Health', route: '/admin/health' }
        });
      } else {
        newChecks.push({
          name: 'Match Pool',
          status: 'ok',
          message: `${matchCount?.toLocaleString()} matches active`
        });
      }

      // 3. Data Freshness Check
      const yesterday = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const { count: recentStartups } = await supabase
        .from('startup_uploads')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', yesterday);

      if ((recentStartups || 0) === 0) {
        newChecks.push({
          name: 'Data Freshness',
          status: 'warning',
          message: 'No new startups in 48 hours',
          action: { label: 'Check RSS', route: '/admin/discovered-startups' }
        });
      } else {
        newChecks.push({
          name: 'Data Freshness',
          status: 'ok',
          message: `${recentStartups} new startups in last 48h`
        });
      }

      // 4. Social Signals Check
      const { count: signalCount } = await supabase
        .from('social_signals')
        .select('*', { count: 'exact', head: true });

      if ((signalCount || 0) === 0) {
        newChecks.push({
          name: 'Social Signals',
          status: 'warning',
          message: 'No social signals collected',
          action: { label: 'Run Scraper', route: '/admin/ai-intelligence' }
        });
      } else {
        newChecks.push({
          name: 'Social Signals',
          status: 'ok',
          message: `${signalCount?.toLocaleString()} signals collected`
        });
      }

      // 5. Investor Data Check
      const { count: investorCount } = await supabase
        .from('investors')
        .select('*', { count: 'exact', head: true });

      if ((investorCount || 0) < 100) {
        newChecks.push({
          name: 'Investor Data',
          status: 'warning',
          message: `Only ${investorCount} investors - add more for better matching`,
          action: { label: 'Add Investors', route: '/admin/discovered-investors' }
        });
      } else {
        newChecks.push({
          name: 'Investor Data',
          status: 'ok',
          message: `${investorCount?.toLocaleString()} investors active`
        });
      }

    } catch (error) {
      console.error('Error running health checks:', error);
      newChecks.push({
        name: 'System',
        status: 'error',
        message: 'Failed to run health checks - database connection issue?'
      });
    }

    // Calculate overall status
    const hasError = newChecks.some(c => c.status === 'error');
    const hasWarning = newChecks.some(c => c.status === 'warning');
    
    setChecks(newChecks);
    setOverallStatus(hasError ? 'error' : hasWarning ? 'warning' : 'ok');
    setLastChecked(new Date());
    setLoading(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ok': return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      case 'error': return <XCircle className="w-4 h-4 text-red-400" />;
      default: return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getOverallColor = () => {
    switch (overallStatus) {
      case 'ok': return 'from-green-500 to-emerald-500';
      case 'warning': return 'from-yellow-500 to-orange-500';
      case 'error': return 'from-red-500 to-rose-500';
      default: return 'from-gray-500 to-slate-500';
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center gap-3">
          <RefreshCw className="w-5 h-5 text-green-400 animate-spin" />
          <span className="text-slate-400">Running health checks...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 bg-gradient-to-r ${getOverallColor()} rounded-lg`}>
            <Shield className="w-5 h-5 text-black" />
          </div>
          <div>
            <h3 className="font-bold text-white">System Health</h3>
            <p className="text-xs text-slate-400">
              {checks.filter(c => c.status === 'ok').length}/{checks.length} checks passing
            </p>
          </div>
        </div>
        <button
          onClick={runHealthChecks}
          className="p-2 hover:bg-slate-700 rounded-lg transition-all"
        >
          <RefreshCw className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {/* Checks */}
      <div className="divide-y divide-slate-700">
        {checks.map((check) => (
          <div key={check.name} className="p-3 flex items-center justify-between hover:bg-slate-700/30">
            <div className="flex items-center gap-3">
              {getStatusIcon(check.status)}
              <div>
                <div className="text-sm font-medium text-white">{check.name}</div>
                <div className="text-xs text-slate-400">{check.message}</div>
              </div>
            </div>
            {check.action && (
              <button
                onClick={() => navigate(check.action!.route)}
                className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-all flex items-center gap-1"
              >
                {check.action.label}
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="p-3 bg-slate-900/50 text-xs text-slate-500 flex items-center justify-between">
        <span>Last checked: {lastChecked.toLocaleTimeString()}</span>
        <button
          onClick={() => navigate('/admin/health')}
          className="text-cyan-400 hover:text-cyan-300 transition-all"
        >
          Full Health Dashboard →
        </button>
      </div>
    </div>
  );
}
