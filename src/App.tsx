/**
 * Phase A Router (IA locked - Jan 2026)
 *
 * Canonical founder flow:
 * - /         Front page (Find my investors)
 * - /discover Discovery (matching engine surface)
 * - /matches  Results (top matches by signal)
 *
 * Aliases / backwards compat (preserve querystring):
 * - /discovery → /discover
 * - /pythh     → /discover
 * - /hotmatch  → /discover
 * - /results   → /matches
 *
 * PUBLIC (persuasion mode):
 * - /live, /signals, /demo
 *
 * APP (instrument mode):
 * - /app, /app/engine, /app/logs, /app/startup/:id
 *
 * ADMIN (legacy, preserved for Phase B cleanup):
 * - /admin/*
 */

import React, { useEffect } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { L5Guard } from './lib/routeGuards';
import { trackEvent } from './lib/analytics';
import './App.css';
import { AppErrorBoundary } from './components/AppErrorBoundary';

// Layouts
import PublicLayout from './layouts/PublicLayout';
import AppLayout from './layouts/AppLayout';

// Canonical founder surfaces (Pythh v2 - Supabase-inspired)
import PythhHome from './pages/PythhHome';
import PythhSignalsPage from './pages/PythhSignalsPage';
import PythhMatchesPage from './pages/PythhMatchesPage';
import PythhTrendsPage from './pages/PythhTrendsPage';
import HowPythhWorksPage from './pages/HowPythhWorksPage';

// Legacy home (preserved for fallback)
import Home from './pages/Home';
import PythhMatchingEngine from './components/PythhMatchingEngine';
import DiscoveryResultsPage from './pages/DiscoveryResultsPage';

// Public pages
import Live from './pages/public/Live';
import DemoPageDoctrine from './pages/DemoPageDoctrine';
import SignalResultsPage from './pages/SignalResultsPage';
import InvestorProfile from './pages/InvestorProfile';
import SignalsExplainer from './pages/SignalsExplainer';

// App pages (instrument mode)
import Dashboard from './pages/app/Dashboard';
import Logs from './pages/app/Logs';
import StartupIntelligencePage from './pages/StartupIntelligencePage'; // Canonical startup intel
import SignalCardPage from './pages/SignalCardPage'; // Founder decision journal
import SharedSignalCardPage from './pages/SharedSignalCardPage'; // Public shared signal view
import SharedSurfacePage from './pages/SharedSurfacePage'; // Public share links (scores, investors, trends)
import FounderCommunityPage from './pages/FounderCommunityPage'; // Founder community
import SignalsExplorer from './pages/app/SignalsExplorer';

// Pythh founder pages (new UI)
import SignalsRadarPage from './pages/app/SignalsRadarPage';
import InvestorRevealPage from './pages/app/InvestorRevealPage';
import SignalsAlias from './pages/app/SignalsAlias';

// PYTHH v2 — New surfaces (Jan 2026)
import SubmitStartupPage from './pages/SubmitStartupPage';
import CohortsPage from './pages/CohortsPage';
import PortfoliosPage from './pages/PortfoliosPage';

// Legacy preserved for Phase B
import Login from './pages/Login';
import MatchController from './pages/MatchController';

// Admin pages - Core Tools
import AdminRouteWrapper from './components/AdminRouteWrapper';
import UnifiedAdminDashboard from './pages/UnifiedAdminDashboardV2';
import SystemHealthDashboard from './pages/SystemHealthDashboard';
import AILogsPage from './pages/AILogsPage';

// Admin pages - GOD Score Management
import GODScoresPage from './pages/GODScoresPage';
import GODSettingsPage from './pages/GODSettingsPage';
import IndustryRankingsPage from './pages/IndustryRankingsPage';

// Admin pages - Data Management
import EditStartups from './pages/EditStartups';
import DiscoveredStartups from './pages/DiscoveredStartups';
import DiscoveredInvestors from './pages/DiscoveredInvestors';
import BulkUpload from './pages/BulkUpload';
import RSSManager from './pages/RSSManager';

// Admin pages - Diagnostics & Monitoring
import DiagnosticPage from './pages/DiagnosticPage';
import DatabaseDiagnostic from './pages/DatabaseDiagnostic';
import ControlCenter from './pages/ControlCenter';
import ScraperManagementPage from './pages/ScraperManagementPage';
import AIIntelligenceDashboard from './pages/AIIntelligenceDashboard';

const App: React.FC = () => {
  const location = useLocation();
  const qs = location.search || '';

  useEffect(() => {
    trackEvent('page_viewed', { path: location.pathname, search: location.search });
  }, [location.pathname, location.search]);

  const toWithQuery = (to: string) => `${to}${qs}`;

  return (
    <AppErrorBoundary>
      <AuthProvider>
        <Routes>
          {/* ═══════════════════════════════════════════════════════════════
              PYTHH v2 — Supabase-inspired founder flow (Jan 2026)
              /         → Home (two-column hero, pipeline, engine preview)
              /matches  → Matches page (investor targets)
              /trends   → Trends page (market scoreboard)
              /how-it-works → Documentation-style explainer
              
              NOTE: /signals is REDIRECT ONLY (see below) - routes to pythh engine
          ═══════════════════════════════════════════════════════════════ */}
          <Route path="/" element={<PythhHome />} />
          <Route path="/matches" element={<PythhMatchesPage />} />
          <Route path="/trends" element={<PythhTrendsPage />} />
          <Route path="/how-it-works" element={<HowPythhWorksPage />} />

          {/* LEGACY: Preserved for backwards compatibility */}
          <Route path="/home-legacy" element={<Home />} />
          <Route path="/discover" element={<PythhMatchingEngine />} />

          {/* PUBLIC (persuasion mode) */}
          <Route element={<PublicLayout />}>
            <Route path="/live" element={<Live />} />
            <Route path="/demo" element={<DemoPageDoctrine />} />
          </Route>
          
          {/* ═══════════════════════════════════════════════════════════════════
              PYTHH ENGINE ALIASES - REDIRECT TO CANONICAL /app/radar
              ═══════════════════════════════════════════════════════════════════
              Both /signals and /signals-radar are REDIRECT-ONLY aliases.
              They cannot render content - only forward to /app/radar.
              
              Canonical engine: /app/radar (SignalsRadarPage)
              
              Flow:
              1. Homepage submits URL → /signals?url=example.com
              2. SignalsAlias redirects → /app/radar?url=example.com
              3. SignalsRadarPage processes URL via useResolveStartup
              4. Returns results (5 unlocked + 50 locked signals)
              
              This structure makes it IMPOSSIBLE to accidentally add
              content pages at /signals or /signals-radar.
          ═══════════════════════════════════════════════════════════════════ */}
          <Route path="/signals" element={<SignalsAlias />} />
          <Route path="/signals-radar" element={<SignalsAlias />} />
          
          {/* SIGNALS EXPLAINER (educational marketing page) */}
          <Route path="/what-are-signals" element={<SignalsExplainer />} />
          
          {/* SIGNAL RESULTS (legacy - consider deprecating) */}
          <Route path="/signal-results" element={<SignalResultsPage />} />
          
          {/* INVESTOR PROFILE */}
          <Route path="/investor/:id" element={<InvestorProfile />} />

          {/* SHARED SIGNAL CARD (public view) */}
          <Route path="/shared/signal/:token" element={<SharedSignalCardPage />} />

          {/* PUBLIC SHARE LINKS (canonical - revocable, no auth) */}
          <Route path="/s/:shareId" element={<SharedSurfacePage />} />

          {/* FOUNDER COMMUNITY */}
          <Route path="/community" element={<FounderCommunityPage />} />

          {/* ALIASES (preserve querystring) */}
          <Route path="/discovery" element={<Navigate to={toWithQuery('/discover')} replace />} />
          <Route path="/pythh" element={<Navigate to={toWithQuery('/discover')} replace />} />
          <Route path="/hotmatch" element={<Navigate to={toWithQuery('/discover')} replace />} />
          <Route path="/results" element={<Navigate to={toWithQuery('/matches')} replace />} />

          {/* *** /signals redirect removed - now handled by SignalsAlias above *** */}
          
          {/* LEGACY (Phase B cleanup) */}
          <Route path="/live-match" element={<Navigate to="/live" replace />} />
          <Route path="/signals-flow" element={<Navigate to="/signals" replace />} />
          <Route path="/match" element={<MatchController />} />
          <Route path="/login" element={<Login />} />

          {/* APP (instrument mode) */}
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="logs" element={<Logs />} />
            <Route path="signals" element={<SignalsExplorer />} />
            <Route path="startup/:id" element={<StartupIntelligencePage />} />
            <Route path="signal-card" element={<SignalCardPage />} />
            
            {/* Pythh v2 — New surfaces */}
            <Route path="submit" element={<SubmitStartupPage />} />
            <Route path="cohorts" element={<CohortsPage />} />
            <Route path="portfolios" element={<PortfoliosPage />} />
            
            {/* Pythh founder UI */}
            <Route path="radar" element={<SignalsRadarPage />} />
            <Route path="radar/:startupId" element={<SignalsRadarPage />} />
            <Route path="investors/:investorId" element={<InvestorRevealPage />} />
          </Route>

          {/* ADMIN (preserved for Phase B) */}
          <Route
            path="/admin"
            element={
              <L5Guard>
                <AdminRouteWrapper />
              </L5Guard>
            }
          >
            {/* Dashboard */}
            <Route index element={<UnifiedAdminDashboard />} />
            
            {/* GOD Score Management - CORE */}
            <Route path="god-scores" element={<GODScoresPage />} />
            <Route path="god-settings" element={<GODSettingsPage />} />
            <Route path="industry-rankings" element={<IndustryRankingsPage />} />
            
            {/* Data Management */}
            <Route path="edit-startups" element={<EditStartups />} />
            <Route path="discovered-startups" element={<DiscoveredStartups />} />
            <Route path="discovered-investors" element={<DiscoveredInvestors />} />
            <Route path="bulk-upload" element={<BulkUpload />} />
            <Route path="rss-manager" element={<RSSManager />} />
            
            {/* System Monitoring */}
            <Route path="health" element={<SystemHealthDashboard />} />
            <Route path="ai-logs" element={<AILogsPage />} />
            <Route path="diagnostic" element={<DiagnosticPage />} />
            <Route path="database-check" element={<DatabaseDiagnostic />} />
            <Route path="control" element={<ControlCenter />} />
            <Route path="scrapers" element={<ScraperManagementPage />} />
            <Route path="ai-intelligence" element={<AIIntelligenceDashboard />} />
          </Route>

          {/* 404 → home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </AppErrorBoundary>
  );
};

export default App;
