# Pipeline Component Patterns

## Step State Machine

```tsx
type Step = "entry" | "scanning" | "results" | "pipeline";
const [step, setStep] = useState<Step>("entry");

// Pre-populate URL from hero
const [url, setUrl] = useState(() => sessionStorage.getItem("pythia_url") ?? "");
```

## Scanning Step — Progress Tracker

```tsx
const SCAN_STEPS = [
  { label: "Reading startup URL",         detail: "Parsing product, team, and traction signals",          duration: 1200 },
  { label: "Analyzing market positioning",detail: "Mapping competitive landscape and differentiation",     duration: 1400 },
  { label: "Scoring 5,000+ investors",    detail: "Running 40-dimension thesis alignment model",           duration: 2000 },
  { label: "Filtering by deployment timing", detail: "Cross-referencing fund cycles and LP updates",       duration: 1600 },
  { label: "Ranking by signal strength",  detail: "Weighting timing × fit × optics",                      duration: 1000 },
  { label: "Preparing match report",      detail: "Generating personalized investor briefs",               duration: 800  },
];

// Advance through steps using cumulative timeouts
useEffect(() => {
  if (step !== "scanning") return;
  let elapsed = 0;
  SCAN_STEPS.forEach((s, i) => {
    elapsed += s.duration;
    setTimeout(() => {
      setScanStep(i + 1);
      if (i === SCAN_STEPS.length - 1) setTimeout(() => setStep("results"), 600);
    }, elapsed);
  });
}, [step]);
```

## Investor Match Card

```tsx
interface MatchedInvestor {
  id: number;
  name: string;
  firm: string;
  role: string;
  sector: string[];
  stage: string;
  checkSize: string;
  matchScore: number;   // 0–100
  signalScore: number;  // 0–10
  reason: string;       // Why PYTHIA matched
  recentActivity: string;
  status: "matched" | "outreach_sent" | "responded" | "meeting_booked";
  emailProfile?: InvestorEmailProfile;
}
```

Card renders: match score badge (emerald), signal score (amber), sector chips, expand chevron.
Expanded panel: WHY MATCHED + RECENT SIGNAL + EMAIL TARGETS (see email-inference-template.ts).

## Pipeline Milestone Types

```tsx
interface Milestone {
  id: number;
  type: "match" | "pitch" | "outreach" | "response" | "meeting" | "brief";
  investor?: string;
  firm?: string;
  text: string;
  detail?: string;
  time: string;
  done: boolean;
  highlight?: boolean;
  requiresApproval?: boolean;  // true for meeting milestones
  emailSentTo?: string;
  emailVariants?: string[];
}
```

## Milestone Auto-Advance

```tsx
const MILESTONE_SEQUENCE: Omit<Milestone, "id">[] = [
  { type: "match",    text: "Pipeline activated",          detail: "Beginning outreach to N matched investors", time: "Just now", done: true },
  { type: "pitch",    text: "Pitch brief prepared",        detail: "Tailored 1-pager for each investor",        time: "30s ago",  done: true },
  { type: "outreach", text: "Outreach sent to [Name]",     detail: "Sent to firstname@firm.com · [angle]",      time: "45s ago",  done: true, emailSentTo: "...", emailVariants: [...] },
  // ... more outreach milestones
  { type: "response", text: "[Name] opened your email",    detail: "High engagement signal",                    time: "4m ago",   done: true },
  { type: "meeting",  text: "Meeting request from [Name]", detail: "[Date] · [Time] · [Format]",                time: "Now",      done: false, requiresApproval: true, highlight: true },
];

useEffect(() => {
  if (step !== "pipeline") return;
  let idx = 0;
  const advance = () => {
    if (idx >= MILESTONE_SEQUENCE.length) return;
    setMilestones(prev => [...prev, { ...MILESTONE_SEQUENCE[idx], id: idx + 1 }]);
    idx++;
    setTimeout(advance, 3000 + Math.random() * 5000); // 3–8s stagger
  };
  setTimeout(advance, 800);
}, [step]);
```

## Meeting Approval Handler

```tsx
const handleApprove = (milestoneId: number) => {
  setMilestones(prev => prev.map(m =>
    m.id === milestoneId
      ? { ...m, requiresApproval: false, done: true, text: m.text.replace("Meeting request", "Meeting confirmed") }
      : m
  ));
  setConfirmedMeetings(prev => [...prev, {
    investor: milestone.investor!,
    firm: milestone.firm!,
    date: "Thu, May 15 · 10:00 AM PT",
  }]);
};
```

## Pipeline Layout

```
<div className="grid lg:grid-cols-[1fr_320px] gap-6">
  {/* Left: milestone feed */}
  <div>
    {milestones.map(m => <MilestoneCard key={m.id} milestone={m} />)}
    {/* Loading indicator while more milestones incoming */}
  </div>
  {/* Right: sidebar */}
  <div>
    <PipelineStatusTracker />   {/* 5-stage progress: Matched → Outreach → Responses → Meetings → Confirmed */}
    <ConfirmedMeetingsList />
  </div>
</div>
```

## Milestone Card — Email Chip Row

```tsx
{m.emailSentTo && (
  <div className="mt-2 flex flex-wrap items-center gap-1.5">
    <span className="text-xs" style={{ color: "oklch(0.4 0.01 264)" }}>Tried:</span>
    {(m.emailVariants ?? [m.emailSentTo]).map((addr, i) => (
      <span key={addr} className="font-mono text-xs px-2 py-0.5 rounded"
        style={{
          backgroundColor: i === 0 ? "oklch(0.696 0.17 162.48 / 0.1)" : "oklch(0.18 0.01 264)",
          color: i === 0 ? "oklch(0.696 0.17 162.48)" : "oklch(0.5 0.01 264)",
          border: `1px solid ${i === 0 ? "oklch(0.696 0.17 162.48 / 0.25)" : "oklch(0.25 0.01 264)"}`
        }}>
        {addr}{i === 0 ? " ✓" : ""}
      </span>
    ))}
  </div>
)}
```
