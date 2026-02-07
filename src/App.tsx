/**
 * Phase A Router (IA locked - Feb 2026)
 *
 * Public (pythh.ai):
 * - /                  PythhMain
 * - /engine             MatchingEngine (core matching UI)
 * - /signal-matches     URL submission results (SignalMatches)
 * - /signals            Public Signals page (OR redirects to /signal-matches when ?url=...)
 * - /signals-significance  What signals mean
 * - /signal-trends      Trends
 *
 * App (instrument mode - inside pythh):
 * - /app/signals-dashboard     SignalsDashboard
 * - /app/in-signal-matches     Internal matches surface
 * - /app/signal-matches        Same as public submission page (optional mirror)
 *
 * Backwards compatibility:
 * - /signals?url=...   redirects to /signal-matches?url=...
 * - /signals-radar?... redirects to /signal-matches?...  (legacy)
 */

import React, { useEffect } from "react";
import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import "./App.css";

import { AuthProvider } from "./contexts/AuthContext";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { L5Guard } from "./lib/routeGuards";
import { trackEvent } from "./lib/analytics";

// Layouts
import PublicLayout from "./layouts/PublicLayout";
import AppLayout from "./layouts/AppLayout";

// PUBLIC
import PythhMain from "./pages/PythhMain";
import SignalMatches from "./pages/SignalMatches";
import SignalsRouteSwitch from "./pages/SignalsRouteSwitch";
import SignalsSignificance from "./pages/SignalsSignificance";
import SignalTrends from "./pages/SignalTrends";
import FounderSignalsPage from "./pages/FounderSignalsPage";
import HowItWorksPage from "./pages/HowItWorksPage";

// APP (instrument mode)
import SignalsDashboard from "./pages/app/SignalsDashboard";
import InSignalMatches from "./pages/inSignalMatches";
import InvestorRevealPage from "./pages/app/InvestorRevealPage";

// Oracle (signal wizard & coaching)
import OracleDashboard from "./pages/app/OracleDashboard";
import OracleWizard from "./pages/app/OracleWizard";
import OracleCohorts from "./pages/app/OracleCohorts";
import OracleActions from "./pages/app/OracleActions";
import OracleVCStrategy from "./pages/app/OracleVCStrategy";
import OraclePredictions from "./pages/app/OraclePredictions";
import OracleCoaching from "./pages/app/OracleCoaching";

// Core matching UI
import MatchingEngine from "./components/MatchingEngine";

// Pipeline View (how Pythh works — trust page)
import EnginePipelineView from "./pages/app/Engine";

// Legacy / preserved
import DemoPageDoctrine from "./pages/DemoPageDoctrine";
import Live from "./pages/public/Live";
import SignalResultsPage from "./pages/SignalResultsPage";
import InvestorProfile from "./pages/InvestorProfile";
import FounderMatchesPage from "./pages/FounderMatchesPage";

// Signup pages (Pythh-branded)
import SignupLanding from "./pages/SignupLanding";
import SignupFounderPythh from "./pages/SignupFounderPythh";
import InvestorSignupPythh from "./pages/InvestorSignupPythh";

// Admin (preserved)
import AdminRouteWrapper from "./components/AdminRouteWrapper";
import UnifiedAdminDashboard from "./pages/UnifiedAdminDashboardV2";
import SystemHealthDashboard from "./pages/SystemHealthDashboard";
import AILogsPage from "./pages/AILogsPage";
import GODScoresPage from "./pages/GODScoresPage";
import GODSettingsPage from "./pages/GODSettingsPage";
import IndustryRankingsPage from "./pages/IndustryRankingsPage";
import EditStartups from "./pages/EditStartups";
import DiscoveredStartups from "./pages/DiscoveredStartups";
import DiscoveredInvestors from "./pages/DiscoveredInvestors";
import BulkUpload from "./pages/BulkUpload";
import RSSManager from "./pages/RSSManager";
import DiagnosticPage from "./pages/DiagnosticPage";
import DatabaseDiagnostic from "./pages/DatabaseDiagnostic";
import ControlCenter from "./pages/ControlCenter";
import ScraperManagementPage from "./pages/ScraperManagementPage";
import AIIntelligenceDashboard from "./pages/AIIntelligenceDashboard";

const App: React.FC = () => {
  const location = useLocation();
  const qs = location.search || "";

  useEffect(() => {
    trackEvent("page_viewed", { path: location.pathname, search: location.search });
  }, [location.pathname, location.search]);

  const toWithQuery = (to: string) => `${to}${qs}`;

  return (
    <AppErrorBoundary>
      <AuthProvider>
        <Routes>
          {/* ──────────────────────────────────────────────────────────────
              PUBLIC (pythh.ai)
          ────────────────────────────────────────────────────────────── */}
          <Route path="/" element={<PythhMain />} />

          {/* Core matching UI — GOD-scored startup↔investor carousel */}
          <Route path="/engine" element={<MatchingEngine />} />

          {/* Canonical submission results page */}
          <Route path="/signal-matches" element={<SignalMatches />} />

          {/* /signals is now the new Pythh signals page with live bars
              - no query → render FounderSignalsPage
              - ?url=... or ?startup=... → still redirect to /signal-matches preserving QS */}
          <Route path="/signals" element={<FounderSignalsPage />} />

          {/* Legacy alias: /signals-radar ALWAYS redirects to /signal-matches */}
          <Route path="/signals-radar" element={<Navigate to={toWithQuery("/signal-matches")} replace />} />

          {/* Educational explainer */}
          <Route path="/signals-significance" element={<SignalsSignificance />} />

          {/* Trends */}
          <Route path="/signal-trends" element={<SignalTrends />} />

          {/* Optional preserved pages */}
          <Route element={<PublicLayout />}>
            <Route path="/live" element={<Live />} />
            <Route path="/demo" element={<DemoPageDoctrine />} />
          </Route>

          {/* Investor profile (public) */}
          <Route path="/investor/:id" element={<InvestorProfile />} />

          {/* Founder matches page (public) */}
          <Route path="/matches" element={<FounderMatchesPage />} />

          {/* How it works */}
          <Route path="/how-it-works" element={<HowItWorksPage />} />

          {/* Signup flow (Pythh-branded) */}
          <Route path="/signup" element={<SignupLanding />} />
          <Route path="/signup/founder" element={<SignupFounderPythh />} />
          <Route path="/signup/investor" element={<InvestorSignupPythh />} />

          {/* Legacy (consider deprecating later) */}
          <Route path="/signal-results" element={<SignalResultsPage />} />

          {/* ──────────────────────────────────────────────────────────────
              APP (instrument mode - inside pythh)
          ────────────────────────────────────────────────────────────── */}
          <Route path="/app" element={<AppLayout />}>
            {/* Dashboard renamed */}
            <Route index element={<Navigate to="signals-dashboard" replace />} />
            <Route path="signals-dashboard" element={<SignalsDashboard />} />

            {/* Internal matches surface */}
            <Route path="in-signal-matches" element={<InSignalMatches />} />

            {/* Mirror route: allow internal navigation to same results page */}
            <Route path="signal-matches" element={<SignalMatches />} />

            {/* Investor reveal (after unlock/view) */}
            <Route path="investors/:investorId" element={<InvestorRevealPage />} />

            {/* Engine — Pipeline View (how Pythh works) */}
            <Route path="engine" element={<EnginePipelineView />} />

            {/* Oracle — signal wizard & coaching */}
            <Route path="oracle" element={<OracleDashboard />} />
            <Route path="oracle/wizard" element={<OracleWizard />} />
            <Route path="oracle/cohorts" element={<OracleCohorts />} />
            <Route path="oracle/cohort" element={<OracleCohorts />} />
            <Route path="oracle/actions" element={<OracleActions />} />
            <Route path="oracle/vc-strategy" element={<OracleVCStrategy />} />
            <Route path="oracle/predictions" element={<OraclePredictions />} />
            <Route path="oracle/coaching" element={<OracleCoaching />} />
          </Route>

          {/* ──────────────────────────────────────────────────────────────
              ADMIN (preserved for Phase B cleanup)
          ────────────────────────────────────────────────────────────── */}
          <Route
            path="/admin"
            element={
              <L5Guard>
                <AdminRouteWrapper />
              </L5Guard>
            }
          >
            <Route index element={<UnifiedAdminDashboard />} />
            <Route path="god-scores" element={<GODScoresPage />} />
            <Route path="god-settings" element={<GODSettingsPage />} />
            <Route path="industry-rankings" element={<IndustryRankingsPage />} />
            <Route path="edit-startups" element={<EditStartups />} />
            <Route path="discovered-startups" element={<DiscoveredStartups />} />
            <Route path="discovered-investors" element={<DiscoveredInvestors />} />
            <Route path="bulk-upload" element={<BulkUpload />} />
            <Route path="rss-manager" element={<RSSManager />} />
            <Route path="health" element={<SystemHealthDashboard />} />
            <Route path="ai-logs" element={<AILogsPage />} />
            <Route path="diagnostic" element={<DiagnosticPage />} />
            <Route path="database-check" element={<DatabaseDiagnostic />} />
            <Route path="control" element={<ControlCenter />} />
            <Route path="scrapers" element={<ScraperManagementPage />} />
            <Route path="ai-intelligence" element={<AIIntelligenceDashboard />} />
          </Route>

          {/* 404 → main */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </AppErrorBoundary>
  );
};

export default App;
