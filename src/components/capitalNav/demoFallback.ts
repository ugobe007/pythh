import type {
  NavigationTriadData,
  ScanPlaybackData,
  IntentTraceSeries,
  AlignmentMetric,
  ConvergenceArchetypeCard,
  DegradedStatus,
} from "@/types/capitalNavigation";

export function makeDegradedDemoPayload(domain: string) {
  const triad: NavigationTriadData = {
    startupName: "Automax",
    url: domain,
    positionState: "emerging",
    flowState: "forming",
    directionState: "stable",
    observers7d: 0,
    activeInvestorsVisible: null,
    activeInvestorsTotal: null,
    positionScore01: 0.42,
    flowScore01: 0.38,
    trajectoryScore01: 0.34,
    alignment01: 0.52,
    signalQuality01: 0.52,
    confidence: "medium",
    latestIntentTraceHours: 4,
  };

  const degraded: DegradedStatus = {
    isDegraded: true,
    reasonCode: "match_query_failed",
    message: "Intent traces collected. Investor identity resolution is delayed.",
    retryHintSeconds: 60,
  };

  const scan: ScanPlaybackData = {
    domainLabel: domain.replace(/^https?:\/\//, ""),
    steps: [
      { id: "normalize", title: "Normalize URL", detail: "Canonical domain + redirects", state: "done" },
      { id: "infer", title: "Infer Profile", detail: "Sector, stage, velocity class", state: "done" },
      { id: "collect", title: "Collect Intent Traces", detail: "Signals + adjacency candidates", state: "done" },
      { id: "resolve", title: "Resolve Identities", detail: "Matching engine delayed (degraded)", state: "degraded" },
    ],
    summaryLines: [
      "+3 adjacency candidates detected",
      "Phase-change score updated: 0.42 → 0.48",
      "Portfolio overlap found: 2 investors",
      "Latest intent trace: 4 hours ago",
      "Identity resolution queued (degraded mode)",
      "Signal quality assessed: 0.52 (Medium confidence)",
    ],
  };

  const traces: IntentTraceSeries = {
    title: "Intent Trace Density",
    points: [
      { label: "Mon", value: 0 },
      { label: "Tue", value: 1 },
      { label: "Wed", value: 0 },
      { label: "Thu", value: 2 },
      { label: "Fri", value: 1 },
      { label: "Sat", value: 0 },
      { label: "Sun", value: 0 },
    ],
  };

  const alignment: AlignmentMetric[] = [
    { key: "team", label: "Team Alignment", value01: 0.52, why: "Hiring + founder profile partially matches prior funded teams." },
    { key: "market", label: "Market Alignment", value01: 0.48, why: "Category is adjacent but not yet in dense capital flow." },
    { key: "execution", label: "Execution Alignment", value01: 0.50, why: "Shipping cadence inferred as early; needs public proof." },
    { key: "portfolio_adjacency", label: "Portfolio Adjacency", value01: 0.56, why: "Similar startups appear in multiple investor portfolios." },
    { key: "phase_change", label: "Phase-Change Readiness", value01: 0.42, why: "Signals are forming; acceleration not yet strong." },
  ];

  const nextBestMove =
    "Publish technical proof (benchmarks, integrations, latency, or case studies) to deepen alignment with incoming capital.";

  const archetypes: ConvergenceArchetypeCard[] = [
    {
      title: "US Seed Operator Fund",
      fitScore: 72,
      state: "warming",
      evidence: ["Portfolio adjacency detected (2 overlaps)", "Early-stage velocity fit", "Fresh intent traces observed"],
      lockedReason: "Identity locked until resolution completes.",
    },
    {
      title: "EU Infra Specialist",
      fitScore: 68,
      state: "watch",
      evidence: ["Infra adjacency candidate found", "Market signals forming", "Confidence currently Medium"],
      lockedReason: "Identity locked until resolution completes.",
    },
    {
      title: "Enterprise SaaS Seed",
      fitScore: 75,
      state: "warming",
      evidence: ["Comparable tier: emerging", "Execution alignment improving", "Phase-change readiness rising"],
      lockedReason: "Identity locked until resolution completes.",
    },
    {
      title: "Industrial / Robotics",
      fitScore: 63,
      state: "watch",
      evidence: ["Weak sector fit today (cap on alignment)", "Some adjacency candidates", "Needs repositioning proof"],
      lockedReason: "Identity locked until resolution completes.",
    },
    {
      title: "Strategic Corporate",
      fitScore: 60,
      state: "watch",
      evidence: ["Market monitoring behavior possible", "Low density signals", "Increase visibility to trigger traces"],
      lockedReason: "Identity locked until resolution completes.",
    },
  ];

  return { triad, degraded, scan, traces, alignment, nextBestMove, archetypes, hiddenCount: 184 };
}
