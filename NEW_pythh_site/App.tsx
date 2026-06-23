import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./Home";
import Activate from "./Activate";
import Wizard from "./pages/Wizard";
import Pricing from "./Pricing";
import CheckoutSuccess from "./CheckoutSuccess";
import CheckoutCancel from "./CheckoutCancel";
import Account from "./Account";
import InvestorRankings from "./Rankings";
import Profile from "./pages/Profile";
import Admin from "./pages/Admin";
import Login from "./pages/Login";
import AuthCallback from "./pages/AuthCallback";
import Platform from "./pages/Platform";
import Methodology from "./pages/Methodology";
import Newsletter from "./pages/Newsletter";
import SignalTrends from "./pages/SignalTrends";
import About from "./pages/About";
import Support from "./pages/Support";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Explore from "./pages/Explore";
import Portfolio from "./pages/Portfolio";
import PortfolioDetail from "./pages/PortfolioDetail";
import Oracle from "./pages/Oracle";
import Matches from "./pages/Matches";
import MatchPreview from "./pages/MatchPreview";
import InvestorSignup from "./pages/InvestorSignup";
import InvestorSignupComplete from "./pages/InvestorSignupComplete";
import InvestorLogin from "./pages/InvestorLogin";
import InvestorProfile from "./pages/InvestorProfile";
import Developers from "./pages/Developers";
import Outreach from "./pages/Outreach";
import Calendar from "./pages/Calendar";
import GodScores from "./pages/admin/GodScores";
import GodWeights from "./pages/admin/GodWeights";
import SignalScores from "./pages/admin/SignalScores";
import SignalWeights from "./pages/admin/SignalWeights";
import MatchingAdmin from "./pages/admin/Matching";
import Scrapers from "./pages/admin/Scrapers";
import ToolsHub from "./pages/admin/ToolsHub";
import MlAgent from "./pages/admin/MlAgent";
import RssManager from "./pages/admin/RssManager";
import Analytics from "./pages/admin/Analytics";
import Pythiam from "./pages/Pythiam";
import { OAuthSessionBridge } from "./components/OAuthSessionBridge";
import { SpeedInsights } from "@vercel/speed-insights/react";

// Scroll to top on every client-side navigation
function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, [location]);
  return null;
}

function Router() {
  return (
    <>
      <ScrollToTop />
      <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/activate"} component={Activate} />
      <Route path={"/wizard/:startupId"} component={Wizard} />
      {/* /rankings = startup VC-lens scoreboard (legacy app canonical route) */}
      <Route path={"/rankings"} component={SignalTrends} />
      {/* /signal-trends redirects to /rankings for backward compat */}
      <Route path={"/signal-trends"}>
        <Redirect to="/rankings" />
      </Route>
      {/* /investors = investor intelligence table */}
      <Route path={"/investors"} component={InvestorRankings} />
      <Route path={"/explore"} component={Explore} />
      <Route path={"/oracle"} component={Oracle} />
      <Route path={"/matches/preview/:startupId"} component={MatchPreview} />
      <Route path={"/matches"} component={Matches} />
      <Route path={"/signup/investor"} component={InvestorSignup} />
      <Route path={"/signup/investor/complete"} component={InvestorSignupComplete} />
      <Route path={"/investor/login"} component={InvestorLogin} />
      <Route path={"/investor/profile"} component={InvestorProfile} />
      <Route path={"/developers"} component={Developers} />
      <Route path={"/outreach"}><Redirect to="/admin/outreach" /></Route>
      <Route path={"/calendar"}><Redirect to="/admin/calendar" /></Route>
      <Route path={"/admin/outreach"} component={Outreach} />
      <Route path={"/admin/calendar"} component={Calendar} />
      <Route path={"/portfolio"} component={Portfolio} />
      <Route path={"/portfolio/:startupId"} component={PortfolioDetail} />
      <Route path={"/platform"} component={Platform} />
      <Route path={"/methodology"} component={Methodology} />
      <Route path={"/newsletter"} component={Newsletter} />
      <Route path={"/about"} component={About} />
      <Route path={"/pythiam"} component={Pythiam} />
      <Route path={"/support"} component={Support} />
      <Route path={"/privacy"} component={Privacy} />
      <Route path={"/terms"} component={Terms} />
      <Route path={"/pricing"} component={Pricing} />
      <Route path={"/checkout/success"} component={CheckoutSuccess} />
      <Route path={"/checkout/cancel"} component={CheckoutCancel} />
      <Route path={"/account"} component={Account} />
      <Route path={"/profile"} component={Profile} />
      <Route path={"/admin"} component={Admin} />
      <Route path={"/admin/tools"} component={ToolsHub} />
      <Route path={"/admin/analytics"} component={Analytics} />
      <Route path={"/admin/god/weights"} component={GodWeights} />
      <Route path={"/admin/god"}       component={GodScores} />
      <Route path={"/admin/signals"}   component={SignalScores} />
      <Route path={"/admin/signal-weights"} component={SignalWeights} />
      <Route path={"/admin/matching"}  component={MatchingAdmin} />
      <Route path={"/admin/scrapers"}  component={Scrapers} />
      <Route path={"/admin/ml"}        component={MlAgent} />
      <Route path={"/admin/rss"}       component={RssManager} />
      <Route path={"/login"} component={Login} />
      <Route path={"/auth/callback"} component={AuthCallback} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <OAuthSessionBridge />
          <Toaster />
          <SpeedInsights />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
