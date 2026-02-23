/**
 * System Health Alerts - Real-time health monitoring with actionable alerts
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Shield, AlertTriangle, CheckCircle, XCircle, 
  RefreshCw, ExternalLink, Clock
} from 'lucide-react';
import { API_BASE } from '../../lib/apiConfig';

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
    try {
      const res = await fetch(`${API_BASE}/api/admin/system-health`);
      if (!res.ok) throw new Error(`system-health ${res.status}`);
      const data = await res.json();
      setChecks(data.checks || []);
      setOverallStatus(data.overallStatus || 'ok');
      setLastChecked(new Date(data.lastChecked || Date.now()));
    } catch (error) {
      console.error('Error running health checks:', error);
      setChecks([{ name: 'System', status: 'error', message: 'Failed to run health checks - server connection issue?' }]);
      setOverallStatus('error');
    } finally {
      setLoading(false);
    }
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
