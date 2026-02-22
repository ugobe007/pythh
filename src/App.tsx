/**
 * Phase A Router (IA locked - Feb 2026)
 *
 * CANONICAL SUBMISSION: /signal-matches?url=...
 * Every URL input bar in the app navigates here. The unified submitStartup()
 * service (src/services/submitStartup.ts) handles resolution + creation + matching.
 *
 * Public (pythh.ai) — 5-page architecture:
 * - /                  PythhMain (landing — hook + URL submit)
 * - /platform          PlatformPage (merged: signals + engine + how-it-works)
 * - /rankings          SignalTrends (VC Lens rankings — addiction feature)
 * - /explore           ExplorePage (startup search)
 * - /pricing           PricingPage (conversion)
 * - /about             AboutPage
 * - /support           SupportPage
 * - /signal-matches    URL submission results (THE canonical submit surface)
 *
 * Redirects → /platform:
 * - /signals, /matches, /how-it-works, /signals-significance, /engine
 *
 * Redirects → /pricing:
 * - /value
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
import { useStore } from "./store";

// Layouts
import PublicLayout from "./layouts/PublicLayout";
import AppLayout from "./layouts/AppLayout";

// PUBLIC
import PythhMain from "./pages/PythhMain";
import PlatformPage from "./pages/PlatformPage";
import SignalMatches from "./pages/SignalMatches";
import SignalTrends from "./pages/SignalTrends";
import AboutPage from "./pages/AboutPage";
import SupportPage from "./pages/SupportPage";

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

// Signup pages (Pythh-branded)
import SignupLanding from "./pages/SignupLanding";
import SignupFounderPythh from "./pages/SignupFounderPythh";
import InvestorSignupPythh from "./pages/InvestorSignupPythh";
import SignupComplete from "./pages/SignupComplete";
import EnrichStartupPage from "./pages/EnrichStartupPage";

// User account pages
import ProfilePage from "./pages/ProfilePage";
import FounderProfileDashboard from "./pages/FounderProfileDashboard";
import InvestorProfileDashboard from "./pages/InvestorProfileDashboard";
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import AdminBypass from "./pages/AdminBypass";
import AdminLogin from "./pages/AdminLogin";

// Explore
import ExplorePage from "./pages/ExplorePage";

// Sector landing pages
import AIMLInvestorsPage from "./pages/sectors/AIMLInvestorsPage";
import FintechInvestorsPage from "./pages/sectors/FintechInvestorsPage";
import HealthTechInvestorsPage from "./pages/sectors/HealthTechInvestorsPage";
import DevToolsInvestorsPage from "./pages/sectors/DevToolsInvestorsPage";
import B2BSaaSInvestorsPage from "./pages/sectors/B2BSaaSInvestorsPage";

// Commercial pages
import PricingPage from "./pages/PricingPage";

// Shared dashboard views (public, read-only)
import SharedDashboardView from "./pages/SharedDashboardView";
import MatchPreviewPage from "./pages/MatchPreviewPage";

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
import ScraperManagementPage from "./pages/ScraperManagementPage";
import AIIntelligenceDashboard from "./pages/AIIntelligenceDashboard";
import AdminActions from "./pages/AdminActions";
import ReviewQueue from "./pages/ReviewQueue";
import MLDashboard from "./pages/MLDashboard";

const App: React.FC = () => {
  const location = useLocation();
  const qs = location.search || "";
  const loadStartupsFromDatabase = useStore((s) => s.loadStartupsFromDatabase);
  const didInit = React.useRef(false);

  // ── SSOT: Hydrate store from Supabase exactly once per app session ────────
  // useRef guard prevents StrictMode double-invoke and any remount churn.
  // The store-level single-flight + TTL cache is a second line of defence.
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    loadStartupsFromDatabase();
  }, [loadStartupsFromDatabase]);

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
          <Route path="/support" element={<SupportPage />} />

          {/* Platform — unified learn/signals/engine page */}
          <Route path="/platform" element={<PlatformPage />} />

          {/* Old pages → redirect to /platform */}
          <Route path="/engine" element={<Navigate to="/platform" replace />} />
          <Route path="/signals" element={<Navigate to="/platform" replace />} />
          <Route path="/how-it-works" element={<Navigate to="/platform" replace />} />
          <Route path="/signals-significance" element={<Navigate to="/platform" replace />} />
          <Route path="/matches" element={<Navigate to="/platform" replace />} />

          {/* Canonical submission results page */}
          <Route path="/signal-matches" element={<SignalMatches />} />

          {/* Legacy aliases: all roads lead to /signal-matches */}
          <Route path="/signals-radar" element={<Navigate to={toWithQuery("/signal-matches")} replace />} />
          <Route path="/discover" element={<Navigate to={toWithQuery("/signal-matches")} replace />} />
          <Route path="/get-matched" element={<Navigate to={toWithQuery("/signal-matches")} replace />} />
          <Route path="/match" element={<Navigate to={toWithQuery("/signal-matches")} replace />} />

          {/* Rankings (was Trends) */}
          <Route path="/rankings" element={<SignalTrends />} />
          <Route path="/signal-trends" element={<Navigate to="/rankings" replace />} />

          {/* Explore — startup search by name/sector/stage */}
          <Route path="/explore" element={<ExplorePage />} />

          {/* Sector landing pages */}
          <Route path="/ai-ml-investors" element={<AIMLInvestorsPage />} />
          <Route path="/fintech-investors" element={<FintechInvestorsPage />} />
          <Route path="/healthtech-investors" element={<HealthTechInvestorsPage />} />
          <Route path="/devtools-investors" element={<DevToolsInvestorsPage />} />
          <Route path="/b2b-saas-investors" element={<B2BSaaSInvestorsPage />} />

          {/* Optional preserved pages */}
          <Route element={<PublicLayout />}>
            <Route path="/live" element={<Live />} />
            <Route path="/demo" element={<DemoPageDoctrine />} />
          </Route>

          {/* Investor profile (public) */}
          <Route path="/investor/:id" element={<InvestorProfile />} />

          {/* Signup flow (Pythh-branded) */}
          <Route path="/signup" element={<SignupLanding />} />
          <Route path="/signup/founder" element={<SignupFounderPythh />} />
          <Route path="/signup/investor" element={<InvestorSignupPythh />} />
          <Route path="/signup/complete" element={<SignupComplete />} />

          {/* Founder enrichment — self-service data quality improvement */}
          <Route path="/enrich/:token" element={<EnrichStartupPage />} />

          {/* Legacy (consider deprecating later) */}
          <Route path="/signal-results" element={<SignalResultsPage />} />

          {/* User account pages */}
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/admin-login" element={<AdminLogin />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<FounderProfileDashboard />} />
          <Route path="/profile/account" element={<ProfilePage />} />
          <Route path="/investor/dashboard" element={<InvestorProfileDashboard />} />
          <Route path="/settings" element={<Settings />} />

          {/* Commercial pages */}
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/value" element={<Navigate to="/pricing" replace />} />

          {/* Shared dashboard views (public, read-only — no auth required) */}
          <Route path="/s/:shareId" element={<SharedDashboardView />} />
          <Route path="/matches/preview/:startupId" element={<MatchPreviewPage />} />

          {/* Admin bypass (emergency access, no Supabase auth required) */}
          <Route path="/admin-bypass" element={<AdminBypass />} />

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
            <Route path="control" element={<Navigate to="/admin" replace />} />
            <Route path="scrapers" element={<ScraperManagementPage />} />
            <Route path="ai-intelligence" element={<AIIntelligenceDashboard />} />
            <Route path="actions" element={<AdminActions />} />
            <Route path="review-queue" element={<ReviewQueue />} />
            <Route path="ml-dashboard" element={<MLDashboard />} />
          </Route>

          {/* 404 → main */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </AppErrorBoundary>
  );
};

export default App;
