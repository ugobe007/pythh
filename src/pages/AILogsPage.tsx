import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brain, CheckCircle, XCircle, Clock, RefreshCw, TrendingUp } from 'lucide-react';
import { API_BASE } from '../lib/apiConfig';

interface AILog {
  id: string;
  operation: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  status: string;
  error_message?: string;
  created_at: string;
}

export default function AILogsPage() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<AILog[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    success: 0,
    failed: 0,
    totalTokens: 0,
    avgTokens: 0
  });

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/ai-logs`);
      const data: AILog[] = await res.json();
      setLogs(Array.isArray(data) ? data : []);
      const successLogs = data.filter(l => l.status === 'success');
      const failedLogs = data.filter(l => l.status === 'failed');
      const totalTokens = data.reduce((sum, l) => sum + (l.input_tokens || 0) + (l.output_tokens || 0), 0);
      setStats({
        total: data.length,
        success: successLogs.length,
        failed: failedLogs.length,
        totalTokens,
        avgTokens: data.length > 0 ? Math.round(totalTokens / data.length) : 0
      });
    } catch (error) {
      console.error('Error loading logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-400" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1140] via-[#2d1b69] to-[#4a2a8f] relative overflow-hidden">
      {/* Background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="relative z-10 container mx-auto px-8 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-5xl font-bold text-white mb-3">
              AI <span className="bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">Processing Logs</span>
            </h1>
            <p className="text-gray-400 text-lg">Monitor AI operations and token usage</p>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={loadLogs}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white rounded-lg font-semibold transition-all"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => navigate('/admin')}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all"
            >
              Back to Workflow
            </button>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-5 gap-6 mb-12">
          <div className="bg-gradient-to-br from-gray-900/80 to-purple-900/50 backdrop-blur-lg border-2 border-purple-500/30 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <Brain className="w-6 h-6 text-purple-400" />
              <h3 className="text-gray-400 text-sm uppercase tracking-wide">Total Operations</h3>
            </div>
            <div className="text-4xl font-bold text-white">{stats.total}</div>
          </div>

          <div className="bg-gradient-to-br from-gray-900/80 to-green-900/50 backdrop-blur-lg border-2 border-green-500/30 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle className="w-6 h-6 text-green-400" />
              <h3 className="text-gray-400 text-sm uppercase tracking-wide">Success</h3>
            </div>
            <div className="text-4xl font-bold text-white">{stats.success}</div>
            <div className="text-sm text-gray-500 mt-1">
              {stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0}% success rate
            </div>
          </div>

          <div className="bg-gradient-to-br from-gray-900/80 to-red-900/50 backdrop-blur-lg border-2 border-red-500/30 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <XCircle className="w-6 h-6 text-red-400" />
              <h3 className="text-gray-400 text-sm uppercase tracking-wide">Failed</h3>
            </div>
            <div className="text-4xl font-bold text-white">{stats.failed}</div>
          </div>

          <div className="bg-gradient-to-br from-gray-900/80 to-blue-900/50 backdrop-blur-lg border-2 border-blue-500/30 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-6 h-6 text-blue-400" />
              <h3 className="text-gray-400 text-sm uppercase tracking-wide">Total Tokens</h3>
            </div>
            <div className="text-4xl font-bold text-white">{stats.totalTokens.toLocaleString()}</div>
          </div>

          <div className="bg-gradient-to-br from-gray-900/80 to-cyan-900/50 backdrop-blur-lg border-2 border-cyan-500/30 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-6 h-6 text-cyan-400" />
              <h3 className="text-gray-400 text-sm uppercase tracking-wide">Avg Tokens</h3>
            </div>
            <div className="text-4xl font-bold text-white">{stats.avgTokens.toLocaleString()}</div>
          </div>
        </div>

        {/* Logs list */}
        <div className="bg-gradient-to-br from-gray-900/80 to-purple-900/50 backdrop-blur-lg border-2 border-purple-500/30 rounded-2xl p-8">
          <h2 className="text-2xl font-bold text-white mb-6">Recent AI Operations</h2>

          {loading ? (
            <div className="text-center text-white py-12">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
              Loading logs...
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12">
              <Brain className="w-16 h-16 text-purple-400 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-white mb-2">No AI Operations Yet</h3>
              <p className="text-gray-400">AI processing logs will appear here</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-4">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {getStatusIcon(log.status)}
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-white font-semibold">{log.operation}</span>
                          <span className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded">
                            {log.model}
                          </span>
                        </div>
                        <div className="text-sm text-gray-400">
                          {new Date(log.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-right">
                        <div className="text-gray-400">Input Tokens</div>
                        <div className="text-white font-semibold">{log.input_tokens.toLocaleString()}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-gray-400">Output Tokens</div>
                        <div className="text-white font-semibold">{log.output_tokens.toLocaleString()}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-gray-400">Total</div>
                        <div className="text-cyan-400 font-bold">
                          {(log.input_tokens + log.output_tokens).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {log.error_message && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <div className="text-red-400 text-sm">{log.error_message}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Custom scrollbar */}
      <style>{`
        ::-webkit-scrollbar {
          width: 8px;
        }
        ::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(139, 92, 246, 0.5);
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(139, 92, 246, 0.7);
        }
      `}</style>
    </div>
  );
}
