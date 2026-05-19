import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./Home";
import Activate from "./Activate";
import Pricing from "./Pricing";
import CheckoutSuccess from "./CheckoutSuccess";
import CheckoutCancel from "./CheckoutCancel";
import Account from "./Account";
import InvestorRankings from "./Rankings";
import Profile from "./pages/Profile";
import Admin from "./pages/Admin";
import Login from "./pages/Login";
import Platform from "./pages/Platform";
import Methodology from "./pages/Methodology";
import Newsletter from "./pages/Newsletter";
import SignalTrends from "./pages/SignalTrends";
import About from "./pages/About";
import Support from "./pages/Support";
import Explore from "./pages/Explore";
import Portfolio from "./pages/Portfolio";
import PortfolioDetail from "./pages/PortfolioDetail";
import Oracle from "./pages/Oracle";
import Matches from "./pages/Matches";
import Developers from "./pages/Developers";
function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/activate"} component={Activate} />
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
      <Route path={"/matches"} component={Matches} />
      <Route path={"/developers"} component={Developers} />
      <Route path={"/portfolio"} component={Portfolio} />
      <Route path={"/portfolio/:startupId"} component={PortfolioDetail} />
      <Route path={"/platform"} component={Platform} />
      <Route path={"/methodology"} component={Methodology} />
      <Route path={"/newsletter"} component={Newsletter} />
      <Route path={"/about"} component={About} />
      <Route path={"/support"} component={Support} />
      <Route path={"/pricing"} component={Pricing} />
      <Route path={"/checkout/success"} component={CheckoutSuccess} />
      <Route path={"/checkout/cancel"} component={CheckoutCancel} />
      <Route path={"/account"} component={Account} />
      <Route path={"/profile"} component={Profile} />
      <Route path={"/admin"} component={Admin} />
      <Route path={"/login"} component={Login} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
