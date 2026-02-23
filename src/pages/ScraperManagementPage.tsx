import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Webhook, RefreshCw, Play, Pause, Settings, AlertTriangle, 
  CheckCircle, Clock, Edit2, Save, X, ArrowRight, Activity
} from 'lucide-react';
import { API_BASE } from '../lib/apiConfig';
import LogoDropdownMenu from '../components/LogoDropdownMenu';

interface ScraperConfig {
  id: string;
  name: string;
  description: string;
  script: string;
  schedule?: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
  status: 'running' | 'stopped' | 'error' | 'unknown';
  errorCount: number;
  successCount: number;
  settings?: {
    delay?: number;
    timeout?: number;
    retries?: number;
    maxItems?: number;
  };
}

const defaultScrapers: ScraperConfig[] = [
  {
    id: 'rss',
    name: 'RSS Scraper',
    description: 'Scrapes news feeds and articles',
    script: 'run-rss-scraper.js',
    schedule: 'every 30 minutes',
    enabled: true,
    status: 'stopped',
    errorCount: 0,
    successCount: 0,
    settings: { delay: 1000, timeout: 60000, retries: 3, maxItems: 100 }
  },
  {
    id: 'startup-discovery',
    name: 'Startup Discovery',
    description: 'Discovers startups from RSS feeds',
    script: 'discover-startups-from-rss.js',
    schedule: 'every 30 minutes',
    enabled: true,
    status: 'stopped',
    errorCount: 0,
    successCount: 0,
    settings: { delay: 2000, timeout: 120000, retries: 5, maxItems: 1000 }
  },
  {
    id: 'investor-mega',
    name: 'Investor Scraper',
    description: 'Bulk investor data collection',
    script: 'scripts/scrapers/investor-mega-scraper.js',
    schedule: 'daily',
    enabled: true,
    status: 'stopped',
    errorCount: 0,
    successCount: 0,
    settings: { delay: 1500, timeout: 180000, retries: 3, maxItems: 500 }
  },
  {
    id: 'yc-companies',
    name: 'YC Companies',
    description: 'Y Combinator portfolio scraper',
    script: 'scripts/scrapers/yc-companies-scraper.js',
    schedule: 'weekly',
    enabled: true,
    status: 'stopped',
    errorCount: 0,
    successCount: 0,
    settings: { delay: 2000, timeout: 120000, retries: 3, maxItems: 200 }
  },
  {
    id: 'intelligent',
    name: 'Intelligent Scraper',
    description: 'AI-powered web scraping',
    script: 'scripts/scrapers/intelligent-scraper.js',
    schedule: 'on-demand',
    enabled: true,
    status: 'stopped',
    errorCount: 0,
    successCount: 0,
    settings: { delay: 3000, timeout: 180000, retries: 5, maxItems: 50 }
  },
  {
    id: 'social-signals',
    name: 'Social Signals',
    description: 'Social media sentiment & buzz',
    script: 'scripts/enrichment/social-signals-scraper.js',
    schedule: 'daily',
    enabled: true,
    status: 'stopped',
    errorCount: 0,
    successCount: 0,
    settings: { delay: 5000, timeout: 60000, retries: 2, maxItems: 200 }
  },
  {
    id: 'multimodal',
    name: 'Multimodal Scraper',
    description: 'Hybrid RSS + web scraping',
    script: 'scripts/scrapers/multimodal-scraper.js',
    schedule: 'every 2 hours',
    enabled: true,
    status: 'stopped',
    errorCount: 0,
    successCount: 0,
    settings: { delay: 2000, timeout: 150000, retries: 3, maxItems: 300 }
  },
  {
    id: 'continuous',
    name: 'Continuous Scraper',
    description: 'Automated discovery pipeline',
    script: 'scripts/scrapers/continuous-scraper.js',
    schedule: 'continuous',
    enabled: true,
    status: 'stopped',
    errorCount: 0,
    successCount: 0,
    settings: { delay: 1000, timeout: 120000, retries: 5, maxItems: 1000 }
  },
];

export default function ScraperManagementPage() {
  const navigate = useNavigate();
  const [scrapers, setScrapers] = useState<ScraperConfig[]>(defaultScrapers);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editSettings, setEditSettings] = useState<ScraperConfig['settings'] | null>(null);
  const [running, setRunning] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadScraperStatus();
    const interval = setInterval(loadScraperStatus, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const loadScraperStatus = async () => {
    // Load from localStorage (in production, load from database)
    const saved = localStorage.getItem('scraper_configs');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setScrapers(parsed);
      } catch (e) {
        console.error('Error loading scraper configs:', e);
      }
    }
    setLoading(false);
  };

  const saveScraperConfig = (id: string) => {
    const updated = scrapers.map(s => 
      s.id === id ? { ...s, settings: editSettings || s.settings } : s
    );
    setScrapers(updated);
    localStorage.setItem('scraper_configs', JSON.stringify(updated));
    setEditing(null);
    setEditSettings(null);
    alert('✅ Scraper configuration saved!');
  };

  const toggleScraper = (id: string) => {
    const updated = scrapers.map(s => 
      s.id === id ? { ...s, enabled: !s.enabled } : s
    );
    setScrapers(updated);
    localStorage.setItem('scraper_configs', JSON.stringify(updated));
  };

  const runScraper = async (scraper: ScraperConfig) => {
    if (!confirm(`Start ${scraper.name}? This will run in the background.`)) {
      return;
    }

    setRunning(prev => ({ ...prev, [scraper.id]: true }));
    try {
      const response = await fetch(`${API_BASE}/api/scrapers/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scriptName: scraper.script,
          description: scraper.name,
          settings: scraper.settings
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start scraper');
      }

      alert(`✅ ${data.message || `${scraper.name} started successfully!`}`);
      
      // Update status
      const updated = scrapers.map(s => 
        s.id === scraper.id 
          ? { ...s, status: 'running' as const, lastRun: new Date().toISOString() }
          : s
      );
      setScrapers(updated);
      localStorage.setItem('scraper_configs', JSON.stringify(updated));
      
    } catch (error: any) {
      console.error(`Error running ${scraper.name}:`, error);
      alert(`❌ Failed to start ${scraper.name}: ${error.message}`);
      
      // Update error count
      const updated = scrapers.map(s => 
        s.id === scraper.id 
          ? { ...s, status: 'error' as const, errorCount: s.errorCount + 1 }
          : s
      );
      setScrapers(updated);
      localStorage.setItem('scraper_configs', JSON.stringify(updated));
    } finally {
      setRunning(prev => ({ ...prev, [scraper.id]: false }));
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'error':
        return <AlertTriangle className="w-5 h-5 text-red-400" />;
      case 'stopped':
        return <Clock className="w-5 h-5 text-gray-400" />;
      default:
        return <Clock className="w-5 h-5 text-slate-400" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0f0729] via-[#1a0f3a] to-[#2d1558] flex items-center justify-center">
        <RefreshCw className="w-12 h-12 text-orange-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0729] via-[#1a0f3a] to-[#2d1558] text-white">
      <LogoDropdownMenu />
      
      <div className="max-w-7xl mx-auto px-4 pt-20 pb-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent mb-2 flex items-center gap-3">
                <Webhook className="w-10 h-10 text-orange-400" />
                Scraper Management & Configuration
              </h1>
              <p className="text-slate-400">Configure, monitor, and control all data scrapers</p>
            </div>
            <button
              onClick={() => navigate('/admin')}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>

        {/* Scrapers List */}
        <div className="space-y-4">
          {scrapers.map(scraper => {
            const isEditing = editing === scraper.id;
            const currentSettings = isEditing ? editSettings : scraper.settings;
            
            return (
              <div
                key={scraper.id}
                className="bg-slate-800/50 rounded-xl p-6 border border-slate-700"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-4">
                    {getStatusIcon(scraper.status)}
                    <div>
                      <h3 className="text-xl font-bold text-white mb-1">{scraper.name}</h3>
                      <p className="text-sm text-slate-400 mb-2">{scraper.description}</p>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span>Script: {scraper.script}</span>
                        <span>Schedule: {scraper.schedule}</span>
                        {scraper.lastRun && (
                          <span>Last run: {new Date(scraper.lastRun).toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleScraper(scraper.id)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium ${
                        scraper.enabled
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                          : 'bg-slate-700 text-slate-400 border border-slate-600'
                      }`}
                    >
                      {scraper.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                    
                    {!isEditing ? (
                      <>
                        <button
                          onClick={() => {
                            setEditing(scraper.id);
                            setEditSettings({ ...scraper.settings });
                          }}
                          className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg"
                        >
                          <Settings className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => runScraper(scraper)}
                          disabled={running[scraper.id] || !scraper.enabled}
                          className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-black font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          {running[scraper.id] ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              Starting...
                            </>
                          ) : (
                            <>
                              <Play className="w-4 h-4" />
                              Run Now
                            </>
                          )}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => saveScraperConfig(scraper.id)}
                          className="p-2 bg-green-600 hover:bg-green-700 rounded-lg"
                        >
                          <Save className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setEditing(null);
                            setEditSettings(null);
                          }}
                          className="p-2 bg-red-600 hover:bg-red-700 rounded-lg"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Settings Editor */}
                {isEditing && currentSettings && (
                  <div className="mt-4 pt-4 border-t border-slate-700">
                    <h4 className="text-sm font-semibold text-white mb-3">Configuration Settings</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">Delay (ms)</label>
                        <input
                          type="number"
                          value={currentSettings.delay || 1000}
                          onChange={(e) => setEditSettings({
                            ...currentSettings,
                            delay: parseInt(e.target.value)
                          })}
                          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">Timeout (ms)</label>
                        <input
                          type="number"
                          value={currentSettings.timeout || 60000}
                          onChange={(e) => setEditSettings({
                            ...currentSettings,
                            timeout: parseInt(e.target.value)
                          })}
                          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">Retries</label>
                        <input
                          type="number"
                          value={currentSettings.retries || 3}
                          onChange={(e) => setEditSettings({
                            ...currentSettings,
                            retries: parseInt(e.target.value)
                          })}
                          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">Max Items</label>
                        <input
                          type="number"
                          value={currentSettings.maxItems || 100}
                          onChange={(e) => setEditSettings({
                            ...currentSettings,
                            maxItems: parseInt(e.target.value)
                          })}
                          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Stats */}
                <div className="mt-4 pt-4 border-t border-slate-700 flex items-center gap-6 text-sm">
                  <div>
                    <span className="text-slate-400">Success: </span>
                    <span className="text-green-400 font-semibold">{scraper.successCount}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Errors: </span>
                    <span className="text-red-400 font-semibold">{scraper.errorCount}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Info Box */}
        <div className="mt-8 bg-blue-500/10 border border-blue-500/30 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-blue-400 mt-0.5" />
            <div>
              <h4 className="font-semibold text-white mb-2">Troubleshooting Scrapers</h4>
              <ul className="text-sm text-slate-300 space-y-1 list-disc list-inside">
                <li>If a scraper is failing, check the error count and adjust timeout/retry settings</li>
                <li>Increase delay if you're getting rate-limited</li>
                <li>Check server logs for detailed error messages</li>
                <li>Disable scrapers that are consistently failing to prevent resource waste</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
