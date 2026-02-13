import { Navigate, useLocation } from "react-router-dom";

/**
 * SignalsAlias
 * ------------
 * Redirect-only component for /signals and /signals-radar.
 * Preserves full querystring (url, startup, etc).
 *
 * CANONICAL ENGINE SURFACE: /app/radar (SignalsRadarPage)
 *
 * This component exists to make it IMPOSSIBLE for /signals
 * or /signals-radar to ever render static content again.
 *
 * All traffic flows to: /app/radar
 */
export default function SignalsAlias() {
  const loc = useLocation();
  const qs = loc.search || "";
  
  // Route truth beacon
  console.log('[SignalsAlias] HIT:', loc.pathname + qs, '→ redirecting to /app/radar');
  
  // Forward to canonical engine with query preserved
  return <Navigate to={`/app/radar${qs}`} replace />;
}
