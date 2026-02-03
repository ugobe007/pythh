import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import Signals from "./Signals";

/**
 * /signals is now BOTH:
 * - Public Signals page (no query)
 * - Backwards-compatible submission alias (when ?url= or ?startup= exists)
 *
 * If querystring indicates a submission workflow, we redirect to /signal-matches.
 * Otherwise, render the public Signals page.
 */
export default function SignalsRouteSwitch() {
  const loc = useLocation();
  const qs = loc.search || "";

  const sp = new URLSearchParams(qs);
  const hasSubmissionParam = sp.has("url") || sp.has("startup") || sp.has("startup_id");

  if (hasSubmissionParam) {
    return <Navigate to={`/signal-matches${qs}`} replace />;
  }

  return <Signals />;
}
