/**
 * NOTIFICATION PREFERENCES — Sprint 4
 * ====================================
 * 
 * Control panel for notification settings.
 * 
 * Defaults (protecting founders):
 * - Weekly digest: ON
 * - Alignment changes (new investors, improvements): ON
 * - Investor alerts: ON
 * - Signal alerts: OFF (opt-in only)
 * 
 * "Silence builds trust."
 */

import React, { useState, useEffect } from 'react';
import { Bell, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

// Match actual database schema
interface NotificationPrefs {
  weekly_digest: boolean;
  alignment_changes: boolean;
  investor_alerts: boolean;
  signal_alerts: boolean;
  is_active: boolean;
}

interface NotificationPreferencesProps {
  startupUrl?: string;
  founderSessionId?: string;
  className?: string;
}

const DEFAULT_PREFS: NotificationPrefs = {
  weekly_digest: true,
  alignment_changes: true,
  investor_alerts: true,
  signal_alerts: false, // OFF by default - prevents anxiety
  is_active: true
};

export function NotificationPreferences({
  startupUrl,
  founderSessionId,
  className = ''
}: NotificationPreferencesProps) {
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  
  // Fetch existing preferences
  useEffect(() => {
    async function fetchPrefs() {
      if (!startupUrl && !founderSessionId) {
        setIsLoading(false);
        return;
      }
      
      try {
        let query = supabase
          .from('founder_notification_prefs')
          .select('*');
        
        if (startupUrl) {
          query = query.eq('startup_url', startupUrl);
        }
        
        const { data } = await query.maybeSingle();
        
        if (data) {
          setPrefs({
            weekly_digest: data.weekly_digest ?? true,
            alignment_changes: data.alignment_changes ?? true,
            investor_alerts: data.investor_alerts ?? true,
            signal_alerts: data.signal_alerts ?? false,
            is_active: data.is_active ?? true
          });
        }
      } catch (err) {
        // No existing prefs, use defaults
        console.log('[NotificationPrefs] Using defaults');
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchPrefs();
  }, [startupUrl, founderSessionId]);
  
  // Save preferences
  const savePrefs = async (newPrefs: NotificationPrefs) => {
    setIsSaving(true);
    setSaveMessage(null);
    
    try {
      const { error } = await supabase
        .from('founder_notification_prefs')
        .upsert({
          startup_url: startupUrl,
          ...newPrefs,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'startup_url'
        });
      
      if (error) throw error;
      
      setPrefs(newPrefs);
      setSaveMessage('Saved');
      setTimeout(() => setSaveMessage(null), 2000);
    } catch (err) {
      console.error('[NotificationPrefs] Save error:', err);
      setSaveMessage('Error saving');
    } finally {
      setIsSaving(false);
    }
  };
  
  const togglePref = (key: keyof NotificationPrefs) => {
    const newPrefs = { ...prefs, [key]: !prefs[key] };
    savePrefs(newPrefs);
  };
  
  if (isLoading) {
    return (
      <div className={`animate-pulse space-y-4 ${className}`}>
        <div className="h-6 bg-gray-800 rounded w-1/3" />
        <div className="h-12 bg-gray-800 rounded" />
        <div className="h-12 bg-gray-800 rounded" />
      </div>
    );
  }
  
  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-400" />
            Notification Preferences
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Control when Pythh updates you about your investor alignment.
          </p>
        </div>
        {saveMessage && (
          <span className={`text-sm px-3 py-1 rounded-full ${
            saveMessage === 'Saved' 
              ? 'text-emerald-400 bg-emerald-500/10' 
              : 'text-red-400 bg-red-500/10'
          }`}>
            {saveMessage}
          </span>
        )}
      </div>
      
      {/* Master Toggle - Controls all notifications */}
      <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700/50">
        <PreferenceToggle
          label="Weekly Digest"
          description="Receive a calm summary when your alignment actually changes"
          enabled={prefs.weekly_digest}
          onToggle={() => togglePref('weekly_digest')}
          isLoading={isSaving}
          icon={<Bell className="w-4 h-4" />}
        />
        
        {!prefs.weekly_digest && (
          <p className="mt-3 text-xs text-gray-500 italic pl-7">
            With this off, you won't receive any alignment updates.
          </p>
        )}
      </div>
      
      {/* Alignment & Investor Events */}
      <div className={`p-4 bg-gray-800/50 rounded-xl border border-gray-700/50 ${!prefs.weekly_digest ? 'opacity-50' : ''}`}>
        <p className="text-xs text-amber-400/80 uppercase tracking-wider mb-4 font-medium">
          Alignment Events
        </p>
        
        <div className="space-y-4">
          <PreferenceToggle
            label="Alignment Changes"
            description="When your investor alignment shifts (new matches, improvements)"
            enabled={prefs.alignment_changes}
            onToggle={() => togglePref('alignment_changes')}
            isLoading={isSaving}
            disabled={!prefs.weekly_digest}
          />
          
          <PreferenceToggle
            label="Investor Alerts"
            description="When investors enter or leave your alignment zone"
            enabled={prefs.investor_alerts}
            onToggle={() => togglePref('investor_alerts')}
            isLoading={isSaving}
            disabled={!prefs.weekly_digest}
          />
        </div>
      </div>
      
      {/* Signal Alerts - Caution */}
      <div className={`p-4 bg-gray-800/50 rounded-xl border border-gray-700/50 ${!prefs.weekly_digest ? 'opacity-50' : ''}`}>
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-4 font-medium flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5" />
          Signal Alerts
        </p>
        <p className="text-xs text-gray-600 mb-4">
          Off by default to prevent anxiety. Enable only if you want full visibility.
        </p>
        
        <div className="space-y-4">
          <PreferenceToggle
            label="Signal Changes"
            description="When your traction, team, or market signals shift"
            enabled={prefs.signal_alerts}
            onToggle={() => togglePref('signal_alerts')}
            isLoading={isSaving}
            disabled={!prefs.weekly_digest}
          />
        </div>
      </div>
      
      {/* Trust message */}
      <p className="text-xs text-gray-600 text-center italic">
        Silence means nothing meaningful happened.
        <br />
        When Pythh updates you, it matters.
      </p>
    </div>
  );
}

// =============================================================================
// TOGGLE COMPONENT
// =============================================================================

interface PreferenceToggleProps {
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
}

function PreferenceToggle({
  label,
  description,
  enabled,
  onToggle,
  isLoading = false,
  disabled = false,
  icon
}: PreferenceToggleProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          {icon && <span className="text-gray-500">{icon}</span>}
          <span className="text-sm font-medium text-white">{label}</span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5 pl-0">{description}</p>
      </div>
      
      <button
        onClick={onToggle}
        disabled={disabled || isLoading}
        className={`relative w-11 h-6 rounded-full transition-all ${
          enabled 
            ? 'bg-amber-500/30 border border-amber-500/50' 
            : 'bg-gray-700 border border-gray-600'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full transition-all ${
            enabled 
              ? 'left-5 bg-amber-400' 
              : 'left-0.5 bg-gray-500'
          }`}
        />
      </button>
    </div>
  );
}

export default NotificationPreferences;
