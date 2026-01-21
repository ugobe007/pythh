/**
 * V5.3 App Router (Doctrine-aligned)
 * 
 * DOCTRINE CHANGES (Dec 2024):
 * - / remains public homepage (LandingPage) — URL submission form
 * - /results is the canonical Results Page (Power Score + Investor Scorecards)
 * - /demo redirects to /results?url=https://sequencing.com (canned demo scan)
 * - /instant-matches and /match/results redirect to /results
 * - /discovery is internal diagnostic (convergence UI) — NOT founder-facing
 * 
 * ROUTE HIERARCHY:
 * - L0 (public): /, /results, /demo, /login, /pricing, /checkout, /about, /privacy
 * - L1 (signals): /feed → requires login OR post-submit session
 * - L2 (matches): /results, /saved-matches, /startup/:id, /investor/:id → requires scan
 * - L4 (connect): /invite-investor, /contact → requires phase >= 4
 * - L5 (admin): /admin/* → requires role === admin
 */

import React, { useEffect } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { L1Guard, L2Guard, L4Guard, L5Guard, AuthGuard } from './lib/routeGuards';
import { trackEvent } from './lib/analytics';
import './App.css';
import LogoDropdownMenu from './components/LogoDropdownMenu';
import { AppErrorBoundary } from './components/AppErrorBoundary';

// L0: Public Oracle Surface
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import SignupFounder from './pages/SignupFounder';
import SignalConfirmation from './pages/SignalConfirmation';
import WhyPythhExists from './pages/WhyPythhExists';
import HowItWorksPage from './pages/HowItWorksPage';
import HowPythhWorks from './pages/HowPythhWorks';
import ValuePage from './pages/ValuePage';
import SharedSignalView from './pages/SharedSignalView';
import PricingPage from './pages/PricingPage';
import CheckoutPage from './pages/CheckoutPage';
import SubscriptionSuccessPage from './pages/SubscriptionSuccessPage';
import Privacy from './pages/Privacy';

// L1: Signal Surfaces (gated)
import Feed from './pages/Feed';
import LiveDemo from './pages/LiveDemo';
import MetricsDashboard from './pages/MetricsDashboard';
import Dashboard from './pages/Dashboard';

// L2: Match Surfaces (gated)
import InstantMatches from './pages/InstantMatches';
import SavedMatches from './pages/SavedMatches';
import StartupDetail from './pages/StartupDetail';
import InvestorProfile from './pages/InvestorProfile';
import StartupMatches from './pages/StartupMatches';
import InvestorMatches from './pages/InvestorMatches';

// L4: Connection (gated)
import Contact from './pages/Contact';
import InviteInvestorPage from './pages/InviteInvestorPage';
import InvestorSignup from './pages/InvestorSignup';

// Authenticated routes
import ProfilePage from './pages/ProfilePage';
import Settings from './pages/Settings';

// L5: Admin
import AdminRouteWrapper from './components/AdminRouteWrapper';
import UnifiedAdminDashboard from './pages/UnifiedAdminDashboard';
import ControlCenter from './pages/ControlCenter';
import AdminReview from './pages/AdminReview';
import RSSManager from './pages/RSSManager';
import DiscoveredStartups from './pages/DiscoveredStartups';
import DiscoveredInvestors from './pages/DiscoveredInvestors';
import BulkUpload from './pages/BulkUpload';
import GODScoresPage from './pages/GODScoresPage';
import GODSettingsPage from './pages/GODSettingsPage';
import IndustryRankingsPage from './pages/IndustryRankingsPage';
import TierMatchingAdmin from './pages/TierMatchingAdmin';
import InvestorEnrichmentPage from './pages/InvestorEnrichmentPage';
import AILogsPage from './pages/AILogsPage';
import DiagnosticPage from './pages/DiagnosticPage';
import DatabaseDiagnostic from './pages/DatabaseDiagnostic';
import AIIntelligenceDashboard from './pages/AIIntelligenceDashboard';
import MLDashboard from './pages/MLDashboard';
import AdminAnalytics from './pages/AdminAnalytics';
import MatchingEngineAdmin from './pages/MatchingEngineAdmin';
import MatchReviewPage from './pages/MatchReviewPage';
import AgentDashboard from './components/admin/AgentDashboard';
import EditStartups from './pages/EditStartups';
import QuickAddInvestor from './pages/QuickAddInvestor';
import AdminInstructions from './pages/AdminInstructions';
import SystemHealthDashboard from './pages/SystemHealthDashboard';
import PipelineMonitor from './pages/PipelineMonitor';
import FundingForecasts from './pages/FundingForecasts';
import ScriptsControlPage from './pages/ScriptsControlPage';
import ScraperManagementPage from './pages/ScraperManagementPage';
import CommandCenter from './components/CommandCenter';
import DocumentUpload from './pages/DocumentUpload';
import SetupPage from './pages/SetupPage';
import SyncStartups from './pages/SyncStartups';
import MigrateLocalStorage from './pages/MigrateLocalStorage';
import MigrateStartupData from './pages/MigrateStartupData';
import StartupBenchmarksDashboard from './pages/StartupBenchmarksDashboard';
import EditInvestorPage from './pages/EditInvestorPage';
import TemplateSequentialFlow from './pages/TemplateSequentialFlow';
import Submit from './pages/Submit';
import UploadPage from './pages/UploadPage';
import MarketTrends from './pages/MarketTrends';
import DataIntelligence from './pages/DataIntelligence';
import Analytics from './pages/Analytics';
import SocialSignalsDashboard from './components/SocialSignalsDashboard';
import DiscoveryPage from './pages/DiscoveryPage';
import DiscoveryResultsPageV2 from './pages/DiscoveryResultsPageV2';
import InvestorLensPage from './pages/InvestorLensPage';
import DiscoveryGalleryPage from './pages/DiscoveryGalleryPage';
import MyLearningPage from './pages/MyLearningPage';
import InvestorDashboard from './pages/InvestorDashboard';

// Legacy redirect component
function LegacyRedirect(): React.ReactElement {
  return <Navigate to="/" replace />;
}

const App: React.FC = () => {
  const location = useLocation();

  // Track page views (includes search for scan tracking)
  useEffect(() => {
    trackEvent('page_viewed', { path: location.pathname, search: location.search });
    
    // Track oracle_viewed only on actual Oracle surface
    if (location.pathname === '/') {
      trackEvent('oracle_viewed', { path: location.pathname });
    }
  }, [location.pathname, location.search]);

  return (
    <AppErrorBoundary>
      <AuthProvider>
        <div className="min-h-screen bg-[#0a0a0a]">
          {/* LogoDropdownMenu is now rendered by each page that needs it */}
          
          <main>
            <Routes>
            {/* L0: PUBLIC ORACLE SURFACE */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/get-matched" element={<Navigate to="/" replace />} />
            <Route path="/home" element={<Navigate to="/" replace />} />
            <Route path="/match" element={<Navigate to="/" replace />} />
            <Route path="/matching" element={<Navigate to="/" replace />} />
            <Route path="/matching-engine" element={<Navigate to="/" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignupFounder />} />
            <Route path="/signal-confirmation" element={<SignalConfirmation />} />
            <Route path="/why" element={<WhyPythhExists />} />
            <Route path="/how-it-works" element={<HowItWorksPage />} />
            <Route path="/how-pythh-works" element={<HowPythhWorks />} />
            <Route path="/value" element={<ValuePage />} />
            <Route path="/shared/:shareToken" element={<SharedSignalView />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/get-matched/success" element={<SubscriptionSuccessPage />} />
            <Route path="/about" element={<Navigate to="/why" replace />} />
            <Route path="/privacy" element={<Privacy />} />

            {/* NEW: Canonical Results Page (Core Product) */}
            {/* For now, reuse InstantMatches while we refactor it into Results Page spec */}
            <Route path="/results" element={<L2Guard><InstantMatches /></L2Guard>} />

            {/* L1: SIGNAL SURFACES (requires login OR post-submit) */}
            <Route path="/feed" element={<L1Guard><Feed /></L1Guard>} />
            
            {/* Doctrine: /demo renders a canned InstantMatches scan result */}
            <Route path="/demo" element={<Navigate to="/results?url=https://sequencing.com" replace />} />
            
            <Route path="/dashboard" element={<L1Guard><Dashboard /></L1Guard>} />
            <Route path="/live-demo" element={<L1Guard><LiveDemo /></L1Guard>} />
            <Route path="/metrics" element={<MetricsDashboard />} />
            <Route path="/discovery" element={<DiscoveryResultsPageV2 />} />
            <Route path="/investor-lens/:id" element={<InvestorLensPage />} />
            <Route path="/gallery" element={<DiscoveryGalleryPage />} />
            <Route path="/how-startups-align" element={<DiscoveryGalleryPage />} />
            <Route path="/my-learning" element={<MyLearningPage />} />
            <Route path="/investor-dashboard" element={<InvestorDashboard />} />

            {/* L2: MATCH SURFACES (requires scan OR login) */}
            {/* Redirect old results routes to the new canonical /results */}
            <Route path="/instant-matches" element={<Navigate to="/results" replace />} />
            <Route path="/match/results" element={<Navigate to="/results" replace />} />
            <Route path="/saved-matches" element={<L2Guard><SavedMatches /></L2Guard>} />
            <Route path="/startup/:id" element={<L2Guard><StartupDetail /></L2Guard>} />
            <Route path="/startup/:id/matches" element={<L2Guard><StartupMatches /></L2Guard>} />
            <Route path="/investor/:id" element={<L2Guard><InvestorProfile /></L2Guard>} />
            <Route path="/investor/:id/matches" element={<L2Guard><InvestorMatches /></L2Guard>} />
            <Route path="/startup/:startupId/templates" element={<L2Guard><TemplateSequentialFlow /></L2Guard>} />

            {/* L4: CONNECTION (requires phase >= 4) */}
            <Route path="/contact" element={<L4Guard><Contact /></L4Guard>} />
            <Route path="/invite-investor" element={<L4Guard><InviteInvestorPage /></L4Guard>} />
            <Route path="/investor/signup" element={<InvestorSignup />} />

            {/* AUTHENTICATED ROUTES */}
            <Route path="/profile" element={<AuthGuard><ProfilePage /></AuthGuard>} />
            <Route path="/settings" element={<AuthGuard><Settings /></AuthGuard>} />

            {/* L5: ADMIN ROUTES */}
            <Route path="/admin" element={<L5Guard><AdminRouteWrapper /></L5Guard>}>
              <Route index element={<UnifiedAdminDashboard />} />
              <Route path="dashboard" element={<UnifiedAdminDashboard />} />
              <Route path="control" element={<ControlCenter />} />
              <Route path="review" element={<AdminReview />} />
              <Route path="rss-manager" element={<RSSManager />} />
              <Route path="discovered-startups" element={<DiscoveredStartups />} />
              <Route path="discovered-investors" element={<DiscoveredInvestors />} />
              <Route path="bulk-upload" element={<BulkUpload />} />
              <Route path="god-scores" element={<GODScoresPage />} />
              <Route path="god-settings" element={<GODSettingsPage />} />
              <Route path="industry-rankings" element={<IndustryRankingsPage />} />
              <Route path="tier-matching" element={<TierMatchingAdmin />} />
              <Route path="investor-enrichment" element={<InvestorEnrichmentPage />} />
              <Route path="ai-logs" element={<AILogsPage />} />
              <Route path="diagnostic" element={<DiagnosticPage />} />
              <Route path="database-check" element={<DatabaseDiagnostic />} />
              <Route path="ai-intelligence" element={<AIIntelligenceDashboard />} />
              <Route path="ml-dashboard" element={<MLDashboard />} />
              <Route path="analytics" element={<AdminAnalytics />} />
              <Route path="matching-engine" element={<MatchingEngineAdmin />} />
              <Route path="match-review" element={<MatchReviewPage />} />
              <Route path="agent" element={<AgentDashboard />} />
              <Route path="edit-startups" element={<EditStartups />} />
              <Route path="investors/add" element={<QuickAddInvestor />} />
              <Route path="investor/:id/edit" element={<EditInvestorPage />} />
              <Route path="instructions" element={<AdminInstructions />} />
              <Route path="health" element={<SystemHealthDashboard />} />
              <Route path="pipeline" element={<PipelineMonitor />} />
              <Route path="forecasts" element={<FundingForecasts />} />
              <Route path="scripts" element={<ScriptsControlPage />} />
              <Route path="scrapers" element={<ScraperManagementPage />} />
              <Route path="command-center" element={<CommandCenter />} />
              <Route path="document-upload" element={<DocumentUpload />} />
              <Route path="setup" element={<SetupPage />} />
              <Route path="sync" element={<SyncStartups />} />
              <Route path="migrate" element={<MigrateLocalStorage />} />
              <Route path="migrate-data" element={<MigrateStartupData />} />
              <Route path="benchmarks" element={<StartupBenchmarksDashboard />} />
              <Route path="submit" element={<Submit />} />
              <Route path="upload" element={<UploadPage />} />
              <Route path="market-trends" element={<MarketTrends />} />
              <Route path="data-intelligence" element={<DataIntelligence />} />
              <Route path="social-signals" element={<SocialSignalsDashboard />} />
            </Route>

            {/* Admin shortcuts */}
            <Route path="/bulkupload" element={<L5Guard><BulkUpload /></L5Guard>} />
            <Route path="/setup" element={<L5Guard><SetupPage /></L5Guard>} />
            <Route path="/analytics" element={<L5Guard><Analytics /></L5Guard>} />

            {/* LEGACY REDIRECTS */}
            <Route path="/vote" element={<LegacyRedirect />} />
            <Route path="/vote-demo" element={<LegacyRedirect />} />
            <Route path="/vote-cards" element={<LegacyRedirect />} />
            <Route path="/trending" element={<LegacyRedirect />} />
            <Route path="/discover" element={<LegacyRedirect />} />
            <Route path="/deals" element={<LegacyRedirect />} />
            <Route path="/portfolio" element={<LegacyRedirect />} />
            <Route path="/startups" element={<LegacyRedirect />} />
            <Route path="/investors" element={<LegacyRedirect />} />
            <Route path="/services" element={<LegacyRedirect />} />
            <Route path="/strategies" element={<LegacyRedirect />} />
            <Route path="/navigation" element={<LegacyRedirect />} />
            <Route path="/sitemap" element={<LegacyRedirect />} />
            <Route path="/market-trends" element={<LegacyRedirect />} />
            <Route path="/trends" element={<LegacyRedirect />} />
            <Route path="/benchmarks" element={<LegacyRedirect />} />
            <Route path="/data-intelligence" element={<LegacyRedirect />} />
            <Route path="/social-signals" element={<LegacyRedirect />} />
            <Route path="/submit" element={<LegacyRedirect />} />
            <Route path="/upload" element={<LegacyRedirect />} />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </AuthProvider>
    </AppErrorBoundary>
  );
};

export default App;
