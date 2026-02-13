/**
 * Phase A Router (IA locked - Feb 2026)
 *
 * CANONICAL SUBMISSION: /signal-matches?url=...
 * Every URL input bar in the app navigates here. The unified submitStartup()
 * service (src/services/submitStartup.ts) handles resolution + creation + matching.
 *
 * Public (pythh.ai):
 * - /                  PythhMain
 * - /signal-matches     URL submission results (THE canonical submit surface)
 * - /signals            Public Signals page (sector dashboard)
 * - /signals-significance  What signals mean
 * - /signal-trends      Trends
 * - /matches            Founder matches page
 *
 * App (instrument mode - inside pythh):
 * - /app/signals-dashboard     SignalsDashboard
 * - /app/in-signal-matches     Internal matches surface
 * - /app/signal-matches        Same as public submission page
 *
 * Legacy redirects (ALL → /signal-matches):
 * - /discover, /get-matched, /match, /signals-radar
 * - /app/signals, /app/radar
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
import FounderSignalsPage from "./pages/FounderSignalsPage";
import HowItWorksPage from "./pages/HowItWorksPage";
import SignalsSignificance from "./pages/SignalsSignificance";
import SignalTrends from "./pages/SignalTrends";
import AboutPage from "./pages/AboutPage";

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
import OracleScribe from "./pages/app/OracleScribe";

// Signal navigation tools (premium features)
import SignalPlaybook from "./pages/app/SignalPlaybook";
import PitchSignalScan from "./pages/app/PitchSignalScan";
import FundraisingTimingMap from "./pages/app/FundraisingTimingMap";

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

// User account pages
import ProfilePage from "./pages/ProfilePage";
import FounderProfileDashboard from "./pages/FounderProfileDashboard";
import InvestorProfileDashboard from "./pages/InvestorProfileDashboard";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";

// Explore
import ExplorePage from "./pages/ExplorePage";

// Commercial pages
import PricingPage from "./pages/PricingPage";
import ValuePage from "./pages/ValuePage";

// Shared dashboard views (public, read-only)
import SharedDashboardView from "./pages/SharedDashboardView";

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

          {/* About pythh.ai — the Pythia story */}
          <Route path="/about" element={<AboutPage />} />

          {/* Engine now redirects to combined matches page */}
          <Route path="/engine" element={<Navigate to="/matches" replace />} />

          {/* Canonical submission results page */}
          <Route path="/signal-matches" element={<SignalMatches />} />

          {/* /signals is now the new Pythh signals page with live bars
              - no query → render FounderSignalsPage
              - ?url=... or ?startup=... → still redirect to /signal-matches preserving QS */}
          <Route path="/signals" element={<FounderSignalsPage />} />

          {/* Legacy alias: /signals-radar ALWAYS redirects to /signal-matches */}
          <Route path="/signals-radar" element={<Navigate to={toWithQuery("/signal-matches")} replace />} />

          {/* Legacy aliases: all roads lead to /signal-matches */}
          <Route path="/discover" element={<Navigate to={toWithQuery("/signal-matches")} replace />} />
          <Route path="/get-matched" element={<Navigate to={toWithQuery("/signal-matches")} replace />} />
          <Route path="/match" element={<Navigate to={toWithQuery("/signal-matches")} replace />} />

          {/* Educational explainer */}
          <Route path="/signals-significance" element={<SignalsSignificance />} />

          {/* Rankings (was Trends) */}
          <Route path="/rankings" element={<SignalTrends />} />
          <Route path="/signal-trends" element={<Navigate to="/rankings" replace />} />

          {/* Explore — startup search by name/sector/stage */}
          <Route path="/explore" element={<ExplorePage />} />

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

          {/* User account pages */}
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/profile" element={<FounderProfileDashboard />} />
          <Route path="/profile/account" element={<ProfilePage />} />
          <Route path="/investor/dashboard" element={<InvestorProfileDashboard />} />
          <Route path="/settings" element={<Settings />} />

          {/* Commercial pages */}
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/value" element={<ValuePage />} />

          {/* Shared dashboard views (public, read-only — no auth required) */}
          <Route path="/s/:shareId" element={<SharedDashboardView />} />

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

            {/* Legacy aliases → canonical /signal-matches */}
            <Route path="signals" element={<Navigate to={toWithQuery("/signal-matches")} replace />} />
            <Route path="radar" element={<Navigate to={toWithQuery("/signal-matches")} replace />} />

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
            <Route path="oracle/scribe" element={<OracleScribe />} />

            {/* Signal navigation tools (premium) */}
            <Route path="playbook" element={<SignalPlaybook />} />
            <Route path="pitch-scan" element={<PitchSignalScan />} />
            <Route path="timing-map" element={<FundraisingTimingMap />} />
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
