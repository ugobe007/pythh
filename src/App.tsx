/**
 * Phase A Router (IA locked - Jan 2026)
 * 
 * PUBLIC (persuasion mode):
 * - / Home (CTA-first, intrigue signals, no explanations)
 * - /live Live Signals (scrollable signal tape, no scores)
 * - /signals How Signals Flow (3-step visual diagram)
 * - /demo Demo (optional, scripted URL → sample results)
 * 
 * APP (instrument mode):
 * - /app Dashboard (what changed hub)
 * - /app/engine Engine Status (command center - scraper/scoring/matching/ML telemetry)
 * - /app/logs Event Stream (raw ai_logs feed, filterable)
 * - /app/startup/:id Startup Intelligence (signals + matches + recommendations)
 * 
 * LEGACY ADMIN:
 * - /admin/* (preserved for Phase B cleanup)
 */

import React, { useEffect } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { L1Guard, L2Guard, L4Guard, L5Guard, AuthGuard } from './lib/routeGuards';
import { trackEvent } from './lib/analytics';
import './App.css';
import LogoDropdownMenu from './components/LogoDropdownMenu';
import { AppErrorBoundary } from './components/AppErrorBoundary';

// Layouts
import PublicLayout from './layouts/PublicLayout';
import AppLayout from './layouts/AppLayout';

// Public pages
import HomePage from './pages/HomePage';
import Live from './pages/public/Live';
import Signals from './pages/public/Signals';
import DemoPageDoctrine from './pages/DemoPageDoctrine';

// App pages (instrument mode)
import Dashboard from './pages/app/Dashboard';
import Engine from './pages/app/Engine';
import Logs from './pages/app/Logs';
import StartupIntelligence from './pages/app/StartupIntelligence';
// Legacy pages preserved for Phase B
import Login from './pages/Login';
import MatchController from './pages/MatchController';
import ResultsPageDoctrine from './pages/ResultsPageDoctrine';

// Admin routes (preserved for Phase B cleanup)
import AdminRouteWrapper from './components/AdminRouteWrapper';
import UnifiedAdminDashboard from './pages/UnifiedAdminDashboard';
import SystemHealthDashboard from './pages/SystemHealthDashboard';
import AILogsPage from './pages/AILogsPage';

const App: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    trackEvent('page_viewed', { path: location.pathname, search: location.search });
  }, [location.pathname, location.search]);

  return (
    <AppErrorBoundary>
      <AuthProvider>
        <Routes>
          {/* PUBLIC (persuasion mode) */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/live" element={<Live />} />
            <Route path="/signals" element={<Signals />} />
            <Route path="/demo" element={<DemoPageDoctrine />} />
          </Route>

          {/* APP (instrument mode) */}
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="engine" element={<Engine />} />
            <Route path="logs" element={<Logs />} />
            <Route path="startup/:id" element={<StartupIntelligence />} />
          </Route>

          {/* LEGACY: Redirect old routes */}
          <Route path="/live-match" element={<Navigate to="/live" replace />} />
          <Route path="/signals-flow" element={<Navigate to="/signals" replace />} />
          <Route path="/match" element={<MatchController />} />
          <Route path="/results" element={<L2Guard><ResultsPageDoctrine /></L2Guard>} />
          <Route path="/login" element={<Login />} />

          {/* ADMIN (preserved for Phase B) */}
          <Route path="/admin" element={<L5Guard><AdminRouteWrapper /></L5Guard>}>
            <Route index element={<UnifiedAdminDashboard />} />
            <Route path="health" element={<SystemHealthDashboard />} />
            <Route path="ai-logs" element={<AILogsPage />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </AppErrorBoundary>
  );
};

export default App;
