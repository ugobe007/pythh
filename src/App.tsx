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

import React, { useEffect, lazy, Suspense } from "react";
import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import "./App.css";

import { AuthProvider } from "./contexts/AuthContext";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { L5Guard } from "./lib/routeGuards";
import { trackEvent } from "./lib/analytics";
import { useStore } from "./store";

// Layouts (kept eager — used as wrappers across many routes)
import PublicLayout from "./layouts/PublicLayout";
import AppLayout from "./layouts/AppLayout";
import AdminRouteWrapper from "./components/AdminRouteWrapper";

// Homepage — critical path, must stay eager
import PythhMain from "./pages/PythhMain";

// Fallback shown while lazy chunks load
const RouteFallback = () => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0a0a0a" }}>
    <div style={{ width: 32, height: 32, border: "3px solid #ff6600", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

// PUBLIC pages
const PlatformPage = lazy(() => import("./pages/PlatformPage"));
const SignalMatches = lazy(() => import("./pages/SignalMatches"));
const SignalTrends = lazy(() => import("./pages/SignalTrends"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const SupportPage = lazy(() => import("./pages/SupportPage"));
const ExplorePage = lazy(() => import("./pages/ExplorePage"));
const PricingPage = lazy(() => import("./pages/PricingPage"));

// Sector landing pages
const AIMLInvestorsPage = lazy(() => import("./pages/sectors/AIMLInvestorsPage"));
const FintechInvestorsPage = lazy(() => import("./pages/sectors/FintechInvestorsPage"));
const HealthTechInvestorsPage = lazy(() => import("./pages/sectors/HealthTechInvestorsPage"));
const DevToolsInvestorsPage = lazy(() => import("./pages/sectors/DevToolsInvestorsPage"));
const B2BSaaSInvestorsPage = lazy(() => import("./pages/sectors/B2BSaaSInvestorsPage"));

// Legacy / preserved
const DemoPageDoctrine = lazy(() => import("./pages/DemoPageDoctrine"));
const Live = lazy(() => import("./pages/public/Live"));
const SignalResultsPage = lazy(() => import("./pages/SignalResultsPage"));
const InvestorProfile = lazy(() => import("./pages/InvestorProfile"));

// Signup flow
const SignupLanding = lazy(() => import("./pages/SignupLanding"));
const SignupFounderPythh = lazy(() => import("./pages/SignupFounderPythh"));
const InvestorSignupPythh = lazy(() => import("./pages/InvestorSignupPythh"));
const SignupComplete = lazy(() => import("./pages/SignupComplete"));
const EnrichStartupPage = lazy(() => import("./pages/EnrichStartupPage"));

// User account pages
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const FounderProfileDashboard = lazy(() => import("./pages/FounderProfileDashboard"));
const InvestorProfileDashboard = lazy(() => import("./pages/InvestorProfileDashboard"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Settings = lazy(() => import("./pages/Settings"));
const Login = lazy(() => import("./pages/Login"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const AdminBypass = lazy(() => import("./pages/AdminBypass"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));

// Shared / preview
const SharedDashboardView = lazy(() => import("./pages/SharedDashboardView"));
const MatchPreviewPage = lazy(() => import("./pages/MatchPreviewPage"));

// APP (instrument mode)
const SignalsDashboard = lazy(() => import("./pages/app/SignalsDashboard"));
const InSignalMatches = lazy(() => import("./pages/inSignalMatches"));
const InvestorRevealPage = lazy(() => import("./pages/app/InvestorRevealPage"));
const EnginePipelineView = lazy(() => import("./pages/app/Engine"));

// Oracle
const OracleDashboard = lazy(() => import("./pages/app/OracleDashboard"));
const OracleWizard = lazy(() => import("./pages/app/OracleWizard"));
const OracleCohorts = lazy(() => import("./pages/app/OracleCohorts"));
const OracleActions = lazy(() => import("./pages/app/OracleActions"));
const OracleVCStrategy = lazy(() => import("./pages/app/OracleVCStrategy"));
const OraclePredictions = lazy(() => import("./pages/app/OraclePredictions"));
const OracleCoaching = lazy(() => import("./pages/app/OracleCoaching"));
const OracleScribe = lazy(() => import("./pages/app/OracleScribe"));

// Signal navigation tools (premium)
const SignalPlaybook = lazy(() => import("./pages/app/SignalPlaybook"));
const PitchSignalScan = lazy(() => import("./pages/app/PitchSignalScan"));
const FundraisingTimingMap = lazy(() => import("./pages/app/FundraisingTimingMap"));

// Admin
const UnifiedAdminDashboard = lazy(() => import("./pages/UnifiedAdminDashboardV2"));
const SystemHealthDashboard = lazy(() => import("./pages/SystemHealthDashboard"));
const AILogsPage = lazy(() => import("./pages/AILogsPage"));
const GODScoresPage = lazy(() => import("./pages/GODScoresPage"));
const GODSettingsPage = lazy(() => import("./pages/GODSettingsPage"));
const IndustryRankingsPage = lazy(() => import("./pages/IndustryRankingsPage"));
const EditStartups = lazy(() => import("./pages/EditStartups"));
const DiscoveredStartups = lazy(() => import("./pages/DiscoveredStartups"));
const DiscoveredInvestors = lazy(() => import("./pages/DiscoveredInvestors"));
const BulkUpload = lazy(() => import("./pages/BulkUpload"));
const RSSManager = lazy(() => import("./pages/RSSManager"));
const DiagnosticPage = lazy(() => import("./pages/DiagnosticPage"));
const DatabaseDiagnostic = lazy(() => import("./pages/DatabaseDiagnostic"));
const ScraperManagementPage = lazy(() => import("./pages/ScraperManagementPage"));
const AIIntelligenceDashboard = lazy(() => import("./pages/AIIntelligenceDashboard"));
const AdminActions = lazy(() => import("./pages/AdminActions"));
const ReviewQueue = lazy(() => import("./pages/ReviewQueue"));
const MLDashboard = lazy(() => import("./pages/MLDashboard"));

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
        <Suspense fallback={<RouteFallback />}>
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
        </Suspense>
      </AuthProvider>
    </AppErrorBoundary>
  );
};

export default App;
