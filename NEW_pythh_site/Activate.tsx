/*
 * PYTHH.AI — ACTIVATE PYTHIA FLOW
 * Design: Obsidian Terminal — Data Noir
 * Steps: 1. URL Entry → 2. Scanning Animation → 3. Match Results → 4. Pipeline Live Feed
 */

import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { inferInvestorEmails, getPrimaryVariants, confidenceLabel, type InvestorEmailProfile } from "@/lib/emailInference";
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Radar,
  FileText,
  Send,
  CalendarCheck,
  Handshake,
  Zap,
  ChevronRight,
  Clock,
  TrendingUp,
  Bell,
  Circle,
  Loader2,
  Star,
  Building2,
  Globe,
  DollarSign,
  Target,
  Activity,
  Sparkles,
  Mail,
  X,
  Check,
  Copy,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = "entry" | "scanning" | "results" | "pipeline";

interface MatchedInvestor {
  id: number;
  name: string;
  firm: string;
  role: string;
  sector: string[];
  stage: string;
  checkSize: string;
  matchScore: number;
  signalScore: number;
  reason: string;
  recentActivity: string;
  whyYouMatchTags?: string[];
  investmentThesis?: string;
  isSuperMatch?: boolean;
  status: "matched" | "outreach_sent" | "responded" | "meeting_booked";
  emailProfile?: InvestorEmailProfile;
}

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
  requiresApproval?: boolean;
  emailSentTo?: string;
  emailVariants?: string[];
  pitchBrief?: {
    subject: string;
    body: string;
    angle: string;
  };
  meetingBrief?: {
    date: string;
    time: string;
    duration: string;
    format: string;
    talkingPoints: string[];
    anticipatedQuestions: { q: string; a: string }[];
    coInvestors: { name: string; firm: string; overlap: string }[];
    prepChecklist: { item: string; done: boolean }[];
    investorBackground: string;
    recentActivity: string;
  };
}

// ─── API types (from /api/instant/submit) ─────────────────────────────────────

interface ApiInvestor {
  id: string;
  name: string;
  firm: string;
  stage: string[];
  sectors: string[];
  email?: string;
  email_best_guess?: string;
  investment_thesis?: string;
}

interface ApiMatch {
  id: string;
  match_score: number;
  reasoning: string;
  confidence_level: string;
  why_you_match: string[];
  investors: ApiInvestor;
}

interface ApiStartup {
  id?: string;
  name: string;
  sectors?: string[];
  stage?: string;
  total_god_score?: number;
}

interface ApiResult {
  startup: ApiStartup | null;
  matches: ApiMatch[];
  /** UUID of the startup record that was created/resolved by instantSubmit */
  startup_id?: string | null;
  /** True only for brand-new URLs that have never been submitted before.
   *  Existing startups already have pre-computed GOD scores in the DB. */
  is_new?: boolean;
  /** True when the background match-generation pipeline is still running */
  gen_in_progress?: boolean;
}

// ─── Pitch email + pipeline milestone builders ────────────────────────────────

function buildPitchEmail(
  startup: ApiStartup,
  investor: ApiInvestor,
  match: ApiMatch,
): { subject: string; body: string; angle: string } {
  const co = startup.name || "our company";
  const sectors = (startup.sectors || []).join(", ") || "technology";
  const stage = startup.stage ? `Stage ${startup.stage}` : "early-stage";
  const thesis = (investor.investment_thesis || "").slice(0, 120).replace(/\.$/, "");
  const topReason = (match.why_you_match || []).find((t) => t.includes("SUPER")) ||
    match.why_you_match?.[0] || match.reasoning?.split(".")[0] || "your investment thesis";

  const subject = investor.investment_thesis
    ? `${co} — fits your thesis on ${thesis.split(" ").slice(0, 6).join(" ")}...`
    : `${co} (${stage}) — ${sectors} — quick intro?`;

  const body = `Hi ${investor.name?.split(" ")[0] || "there"},

I came across ${investor.firm || "your fund"}'s focus${thesis ? ` on ${thesis}` : ""} — it maps closely to what we're building.

${co} is a ${stage} company in ${sectors}. ${match.reasoning ? match.reasoning.split(".")[0] + "." : ""}

${topReason.replace("🔥 SUPER MATCH: ", "Your thesis alignment is particularly strong: ")}

Would love 20 minutes to show you why the timing is right. Happy to share our deck first if that helps.

Best,
[Founder]`;

  const angle = match.reasoning
    ? match.reasoning.split(".").slice(0, 2).join(". ") + "."
    : `Thesis match with ${investor.firm || "the fund"}.`;

  return { subject, body, angle };
}

function buildMilestonesFromApiResult(apiResult: ApiResult, domain: string): Omit<Milestone, "id">[] {
  const startup = apiResult.startup || { name: domain };
  const matches = (apiResult.matches || []).slice(0, 5);
  if (!matches.length) return [];

  const milestones: Omit<Milestone, "id">[] = [];

  // Kick-off
  milestones.push({
    type: "match",
    text: `Pipeline activated for ${startup.name || domain}`,
    detail: `PYTHIA is beginning outreach to ${matches.length} matched investors`,
    time: "Just now",
    done: true,
  });

  // Pitch prep for top 2
  matches.slice(0, 2).forEach((m) => {
    const inv = m.investors;
    milestones.push({
      type: "pitch",
      investor: inv.name,
      firm: inv.firm,
      text: `Pitch materials prepared for ${inv.name}`,
      detail: `Tailored narrative using ${inv.firm} thesis alignment — ${(m.why_you_match || []).filter(t => !t.includes("SUPER")).slice(0, 2).join(", ")}`,
      time: `${12 + milestones.length * 8}s ago`,
      done: true,
    });
  });

  // Outreach for all 5
  matches.forEach((m, i) => {
    const inv = m.investors;
    const nameParts = (inv.name || "investor").split(" ");
    const firstName = nameParts[0].toLowerCase().replace(/[^a-z]/g, "");
    const lastName = (nameParts[1] || "").toLowerCase().replace(/[^a-z]/g, "");
    const emailProfile = inferInvestorEmails(inv.name, inv.firm);
    const primaryEmail = inv.email || inv.email_best_guess || emailProfile.primaryEmail;
    const pitch = buildPitchEmail(startup, inv, m);

    milestones.push({
      type: "outreach",
      investor: inv.name,
      firm: inv.firm,
      text: `Outreach sent to ${inv.name} at ${inv.firm}`,
      detail: `Sent to ${primaryEmail} · ${pitch.angle}`,
      time: `${(i + 1)}m ago`,
      done: true,
      emailSentTo: primaryEmail,
      emailVariants: [
        primaryEmail,
        `${firstName}.${lastName}@${emailProfile.domain}`,
        `${firstName[0] || ""}${lastName ? "." + lastName : ""}@${emailProfile.domain}`,
        `deals@${emailProfile.domain}`,
      ].filter((e, idx, arr) => e && arr.indexOf(e) === idx),
      pitchBrief: pitch,
    });
  });

  // Response simulation for top investor
  const top = matches[0]?.investors;
  if (top) {
    milestones.push({
      type: "response",
      investor: top.name,
      firm: top.firm,
      text: `${top.name} opened your email — 3 times`,
      detail: "High engagement signal. PYTHIA is preparing a follow-up brief.",
      time: `${matches.length + 2}m ago`,
      done: true,
    });
  }

  // Response + meeting for #2
  const second = matches[1]?.investors;
  if (second) {
    milestones.push({
      type: "response",
      investor: second.name,
      firm: second.firm,
      text: `${second.name} replied — expressed interest`,
      detail: `"This looks interesting. Can we find 30 minutes?"`,
      time: `${matches.length + 4}m ago`,
      done: true,
    });

    const pitch2 = buildPitchEmail(startup, second, matches[1]);
    milestones.push({
      id: 900,
      type: "meeting",
      investor: second.name,
      firm: second.firm,
      text: `Meeting request ready — ${second.name}, ${second.firm}`,
      detail: `Thursday · 10:00am PST · 30 min video call · Calendar invite ready`,
      time: "Now",
      done: false,
      requiresApproval: true,
      meetingBrief: {
        date: "This Thursday",
        time: "10:00am PST",
        duration: "30 min",
        format: "Video call (Zoom)",
        investorBackground: second.investment_thesis || `${second.firm} focuses on ${(second.sectors || []).join(", ")}`,
        recentActivity: (matches[1].why_you_match || []).join(" · ") || "Active in your sector",
        talkingPoints: [
          `Lead with your strongest differentiator — ${(startup.sectors || []).join(" + ")} angle`,
          second.investment_thesis ? `Reference their thesis: "${second.investment_thesis.slice(0, 80)}..."` : "Reference their portfolio alignment",
          `Stage match: they target your stage — be specific about milestones and runway`,
          `Quantify traction — numbers over adjectives`,
          `Prepare the raise ask: amount, use of funds, 18-month milestones`,
        ],
        anticipatedQuestions: [
          { q: "Why now? Why is this the right timing?", a: `${startup.sectors?.[0] || "The"} market is reaching an inflection point. We're positioned at the right moment with ${startup.name || "our product"} already showing early traction.` },
          { q: "What's your unfair advantage?", a: "Our data flywheel — every customer interaction makes the product smarter for all users. Incumbents can't replicate this without starting from scratch." },
          { q: "How does this reach $100M ARR?", a: "Current wedge + two natural expansion vectors. Happy to walk through the model." },
        ],
        coInvestors: matches.filter((_, i) => i !== 1).slice(0, 2).map((m) => ({
          name: m.investors.name,
          firm: m.investors.firm,
          overlap: `Also in conversations — strong thesis alignment with ${m.investors.firm}`,
        })),
        prepChecklist: [
          { item: `Review ${second.firm}'s recent portfolio and thesis`, done: false },
          { item: "Prepare 3-slide deck: problem → solution → traction", done: false },
          { item: "Know your exact MoM growth for the last 3 months", done: false },
          { item: "Prepare the raise ask and 18-month milestone plan", done: false },
          { item: "Test your video link and have dial-in backup", done: false },
        ],
      },
    } as unknown as Omit<Milestone, "id">);
  }

  // Meeting for top investor
  if (top) {
    const pitch1 = buildPitchEmail(startup, top, matches[0]);
    milestones.push({
      id: 901,
      type: "meeting",
      investor: top.name,
      firm: top.firm,
      text: `Meeting request ready — ${top.name}, ${top.firm}`,
      detail: `Friday · 2:00pm PST · 45 min intro call · Calendar invite ready`,
      time: "15m ago",
      done: false,
      requiresApproval: true,
      meetingBrief: {
        date: "This Friday",
        time: "2:00pm PST",
        duration: "45 min",
        format: "Video call (Google Meet)",
        investorBackground: top.investment_thesis || `${top.firm} is an active investor in ${(top.sectors || []).join(", ")}`,
        recentActivity: (matches[0].why_you_match || []).join(" · ") || "Active investor in your sector",
        talkingPoints: [
          `Lead with the technical insight that makes ${startup.name || "your product"} defensible`,
          top.investment_thesis ? `Reference their thesis: "${top.investment_thesis.slice(0, 80)}..."` : "Lead with the market opportunity",
          `Show the data flywheel or compounding moat`,
          `Name design partners and their specific use cases`,
          `Be direct about the raise: amount, milestones, timing`,
        ],
        anticipatedQuestions: [
          { q: "Why can't an incumbent build this?", a: "They're optimizing for their existing customer base. We're building for the next generation — different data model, different workflow. By the time they notice us, we'll have years of proprietary data they can't replicate." },
          { q: "What's your wedge?", a: `[Your specific beachhead] — we win here because of [specific advantage]. From there, expansion is natural.` },
          { q: "Who else are you talking to?", a: `We're in conversations with a few funds. We'd prioritize ${top.firm} given your thesis alignment. We're not running a process — we're looking for the right partner.` },
        ],
        coInvestors: matches.filter((_, i) => i !== 0).slice(0, 2).map((m) => ({
          name: m.investors.name,
          firm: m.investors.firm,
          overlap: `Also in conversations — creates positive signal for ${top.firm}`,
        })),
        prepChecklist: [
          { item: `Research ${top.firm}'s portfolio and recent investments`, done: false },
          { item: "Prepare 1-slide architecture diagram", done: false },
          { item: "Have benchmark data ready vs. alternatives", done: false },
          { item: "Prepare design partner quotes and usage metrics", done: false },
          { item: "Know your Series A milestones and timeline cold", done: false },
        ],
      },
    } as unknown as Omit<Milestone, "id">);
  }

  return milestones;
}

function mapApiToMatchedInvestors(matches: ApiMatch[]): MatchedInvestor[] {
  return matches.slice(0, 5).map((m, i) => {
    const inv = m.investors;
    const stageLabel = (inv.stage || [])
      .map((s) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))
      .join(", ");
    const tags = m.why_you_match || [];
    const isSuperMatch = tags.some((t) => t.includes("SUPER MATCH"));
    return {
      id: i + 1,
      name: inv.name || "Unknown",
      firm: inv.firm || "Unknown Firm",
      role: "Partner",
      sector: inv.sectors?.slice(0, 3) || [],
      stage: stageLabel || "All Stages",
      checkSize: "N/A",
      matchScore: Math.round(m.match_score),
      signalScore: Math.round(m.match_score * 0.9),
      reason: m.reasoning || tags.join(". ") || "",
      recentActivity: tags.filter((t) => !t.includes("SUPER MATCH")).join(" · ") || "",
      whyYouMatchTags: tags,
      investmentThesis: inv.investment_thesis || "",
      isSuperMatch,
      status: "matched" as const,
    };
  });
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_INVESTORS: MatchedInvestor[] = [
  {
    id: 1,
    name: "Sarah Chen",
    firm: "Sequoia Capital",
    role: "Partner",
    sector: ["AI/ML", "SaaS"],
    stage: "Series A",
    checkSize: "$5M–$15M",
    matchScore: 94,
    signalScore: 8.7,
    reason: "Led 4 AI infrastructure deals in the last 18 months. Fund cycle is 60% deployed — actively seeking new positions. Your GTM motion mirrors her Mosaic portfolio bet.",
    recentActivity: "Closed $12M Series A in AI observability tool — 3 weeks ago",
    status: "matched",
    emailProfile: inferInvestorEmails("Sarah Chen", "Sequoia Capital"),
  },
  {
    id: 2,
    name: "Niko Bonatsos",
    firm: "General Catalyst",
    role: "Managing Director",
    sector: ["AI/ML", "FinTech"],
    stage: "Seed–Series A",
    checkSize: "$3M–$10M",
    matchScore: 91,
    signalScore: 8.6,
    reason: "Thesis shift detected: 3 recent LP updates reference 'AI-native workflows'. Portfolio gap in your vertical. Wrote publicly about this problem 6 weeks ago.",
    recentActivity: "Published essay on AI automation in B2B — 6 weeks ago",
    status: "matched",
    emailProfile: inferInvestorEmails("Niko Bonatsos", "General Catalyst"),
  },
  {
    id: 3,
    name: "Tomasz Tunguz",
    firm: "Theory Ventures",
    role: "General Partner",
    sector: ["SaaS", "AI/ML"],
    stage: "Series A–B",
    checkSize: "$8M–$20M",
    matchScore: 88,
    signalScore: 7.5,
    reason: "New $700M fund announced Q1 — early deployment phase. Historically leads rounds in data infrastructure. Your architecture is a direct fit for his 'composable AI' thesis.",
    recentActivity: "New fund close announced — 8 weeks ago",
    status: "matched",
    emailProfile: inferInvestorEmails("Tomasz Tunguz", "Theory Ventures"),
  },
  {
    id: 4,
    name: "Stephanie Zhan",
    firm: "Sequoia Capital",
    role: "Partner",
    sector: ["DeepTech", "AI/ML"],
    stage: "Seed–Series A",
    checkSize: "$2M–$8M",
    matchScore: 85,
    signalScore: 7.4,
    reason: "Co-invested with 2 of your existing backers. Sector focus aligns with your technical differentiation. Signal spike detected after attending NeurIPS last month.",
    recentActivity: "Attended NeurIPS, posted about AI infrastructure trends — 4 weeks ago",
    status: "matched",
    emailProfile: inferInvestorEmails("Stephanie Zhan", "Sequoia Capital"),
  },
  {
    id: 5,
    name: "Sarah Guo",
    firm: "Conviction Partners",
    role: "Founder & GP",
    sector: ["AI/ML"],
    stage: "Seed–Series A",
    checkSize: "$1M–$5M",
    matchScore: 82,
    signalScore: 7.3,
    reason: "Exclusively AI-focused fund. Portfolio companies are potential customers of your product. High co-investment signal with your lead investor.",
    recentActivity: "Hosted AI Ascent conference, met 40+ founders — 2 weeks ago",
    status: "matched",
    emailProfile: inferInvestorEmails("Sarah Guo", "Conviction Partners"),
  },
  {
    id: 6,
    name: "Rebecca Kaden",
    firm: "Union Square Ventures",
    role: "Managing Partner",
    sector: ["SaaS", "FinTech"],
    stage: "Series A–B",
    checkSize: "$5M–$15M",
    matchScore: 79,
    signalScore: 7.9,
    reason: "USV thesis on 'large networks of engaged users' maps to your distribution model. Two portfolio companies are adjacent to your market.",
    recentActivity: "Published new investment thesis update — 5 weeks ago",
    status: "matched",
    emailProfile: inferInvestorEmails("Rebecca Kaden", "Union Square Ventures"),
  },
];

const SCAN_STEPS = [
  { label: "Reading startup URL", detail: "Parsing product, team, and traction signals", duration: 1200 },
  { label: "Analyzing market positioning", detail: "Mapping competitive landscape and differentiation", duration: 1400 },
  { label: "Scoring 5,000+ investors", detail: "Running 40-dimension thesis alignment model", duration: 2000 },
  { label: "Filtering by deployment timing", detail: "Cross-referencing fund cycles and LP updates", duration: 1600 },
  { label: "Ranking by signal strength", detail: "Weighting timing × fit × optics", duration: 1000 },
  { label: "Preparing match report", detail: "Generating personalized investor briefs", duration: 800 },
];

// ─── Shared ───────────────────────────────────────────────────────────────────

function PythiaAvatar({ size = 32, pulse = false }: { size?: number; pulse?: boolean }) {
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      {pulse && (
        <span className="absolute inset-0 rounded-lg animate-ping opacity-30"
          style={{ backgroundColor: "oklch(0.696 0.17 162.48)" }} />
      )}
      <img
        src="https://d2xsxph8kpxj0f.cloudfront.net/310519663452998285/Gb3VDTJy3RdmPq23Ws9y3c/pythh_agent_avatar-FxfgA5Pz4uEQf59YtUkeGS.webp"
        alt="PYTHIA"
        className="rounded-lg object-cover relative z-10"
        style={{ width: size, height: size, border: "1px solid oklch(0.696 0.17 162.48 / 0.4)" }}
      />
    </div>
  );
}

function ScoreBadge({ score, size = "md" }: { score: number; size?: "sm" | "md" | "lg" }) {
  const color = score >= 90 ? "oklch(0.696 0.17 162.48)" : score >= 80 ? "oklch(0.769 0.188 70.08)" : "oklch(0.65 0.01 264)";
  const sizes = { sm: "text-sm w-10 h-10", md: "text-lg w-14 h-14", lg: "text-2xl w-18 h-18" };
  return (
    <div className={`rounded-xl flex flex-col items-center justify-center font-mono font-bold flex-shrink-0 ${sizes[size]}`}
      style={{ backgroundColor: `${color.replace(')', ' / 0.1)')}`, border: `2px solid ${color.replace(')', ' / 0.3)')}`, color, minWidth: size === "lg" ? 72 : size === "md" ? 56 : 40 }}>
      <span>{score}</span>
      <span className="text-xs font-normal opacity-70" style={{ fontSize: 9 }}>MATCH</span>
    </div>
  );
}

// ─── Step 1: URL Entry ────────────────────────────────────────────────────────

function EntryStep({ onSubmit }: { onSubmit: (url: string, email: string) => void }) {
  const [url, setUrl] = useState("");
  const [email, setEmail] = useState("");
  const [urlError, setUrlError] = useState(false);

  // Pre-warm the Fly.io machine as soon as the entry form mounts so the
  // backend is ready before the user hits Activate (prevents cold-start lag).
  useEffect(() => {
    fetch("/api/instant/health", { method: "GET" }).catch(() => {});
  }, []);

  const handleActivate = () => {
    if (!url.trim()) {
      setUrlError(true);
      return;
    }
    setUrlError(false);
    const normalized = url.trim().startsWith("http") ? url.trim() : `https://${url.trim()}`;
    if (email) sessionStorage.setItem("pythia_email", email);
    onSubmit(normalized, email);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ backgroundColor: "oklch(0.13 0.01 264)" }}>
      <div className="w-full max-w-lg">
        {/* PYTHIA header */}
        <div className="flex items-center gap-3 mb-10">
          <PythiaAvatar size={48} pulse />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-xl" style={{ color: "oklch(0.97 0.005 264)" }}>PYTHIA</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: "oklch(0.696 0.17 162.48 / 0.15)", color: "oklch(0.696 0.17 162.48)", border: "1px solid oklch(0.696 0.17 162.48 / 0.3)" }}>
                Ready
              </span>
            </div>
            <p className="text-sm" style={{ color: "oklch(0.5 0.01 264)" }}>AI Fundraising Oracle</p>
          </div>
        </div>

        <h1 className="font-display font-bold mb-3" style={{ fontSize: "clamp(2rem, 5vw, 3rem)", color: "oklch(0.97 0.005 264)", lineHeight: 1.1 }}>
          Where should I start?
        </h1>
        <p className="text-base mb-8 leading-relaxed" style={{ color: "oklch(0.6 0.01 264)" }}>
          Give me your startup URL. I'll read everything — your product, team, traction, and market — then find the investors most likely to write you a check right now.
        </p>

        <div className="rounded-xl p-6 border mb-4"
          style={{ backgroundColor: "oklch(0.16 0.01 264)", borderColor: urlError ? "oklch(0.65 0.2 27)" : "oklch(0.25 0.01 264)" }}>
          <label className="block text-xs font-semibold mb-3 tracking-widest" style={{ color: "oklch(0.5 0.01 264)" }}>
            YOUR STARTUP URL
          </label>
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg border mb-1 transition-all duration-200"
            style={{ backgroundColor: "oklch(0.13 0.01 264)", borderColor: urlError ? "oklch(0.65 0.2 27)" : "oklch(0.3 0.01 264)" }}>
            <Globe size={16} style={{ color: urlError ? "oklch(0.65 0.2 27)" : "oklch(0.5 0.01 264)", flexShrink: 0 }} />
            <input
              type="text"
              placeholder="https://yourstartup.com or yourstartup.com"
              value={url}
              onChange={(e) => { setUrl(e.target.value); if (urlError) setUrlError(false); }}
              onKeyDown={(e) => e.key === "Enter" && handleActivate()}
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: "oklch(0.94 0.005 264)" }}
              autoFocus
            />
          </div>
          {urlError && (
            <p className="text-xs mb-4" style={{ color: "oklch(0.65 0.2 27)" }}>Please enter your startup URL to continue.</p>
          )}
          {/* Email — optional, used to send report copy */}
          <label className="block text-xs font-semibold mb-3 mt-5 tracking-widest" style={{ color: "oklch(0.5 0.01 264)" }}>
            SEND REPORT TO EMAIL <span style={{ color: "oklch(0.38 0.01 264)", fontWeight: 400 }}>(optional)</span>
          </label>
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg border mb-4 transition-all duration-200"
            style={{ backgroundColor: "oklch(0.13 0.01 264)", borderColor: "oklch(0.3 0.01 264)" }}>
            <Mail size={16} style={{ color: "oklch(0.5 0.01 264)", flexShrink: 0 }} />
            <input
              type="email"
              placeholder="you@yourstartup.com (optional)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleActivate()}
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: "oklch(0.94 0.005 264)" }}
            />
          </div>
          <button
            onClick={handleActivate}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-lg font-semibold text-sm transition-all duration-200"
            style={{ border: "1px solid oklch(0.696 0.17 162.48)", color: "oklch(0.696 0.17 162.48)" }}
            onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "oklch(0.78 0.17 162.48)"; el.style.color = "oklch(0.78 0.17 162.48)"; }}
            onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "oklch(0.696 0.17 162.48)"; el.style.color = "oklch(0.696 0.17 162.48)"; }}
          >
            <Sparkles size={16} />
            Activate PYTHIA
            <ArrowRight size={16} />
          </button>
        </div>

        <div className="flex items-center gap-4 text-xs" style={{ color: "oklch(0.4 0.01 264)" }}>
          <span className="flex items-center gap-1.5"><CheckCircle2 size={11} style={{ color: "oklch(0.696 0.17 162.48)" }} /> No credit card</span>
          <span className="flex items-center gap-1.5"><CheckCircle2 size={11} style={{ color: "oklch(0.696 0.17 162.48)" }} /> Results in 60 seconds</span>
          <span className="flex items-center gap-1.5"><CheckCircle2 size={11} style={{ color: "oklch(0.696 0.17 162.48)" }} /> No setup calls</span>
        </div>
      </div>
    </div>
  );
}

// ─── Step 2: Scanning Animation ───────────────────────────────────────────────

// Milliseconds before we show the "taking longer than expected" message.
const SLOW_WARN_MS = 18000;
// Hard client-side timeout — avoids indefinite hang on Fly.io cold start.
const CLIENT_FETCH_TIMEOUT_MS = 60000;

function ScanningStep({ url, onComplete }: { url: string; onComplete: (result: ApiResult | null) => void }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [progress, setProgress] = useState(0);
  const [slowWarn, setSlowWarn] = useState(false);
  const capturedEmail = sessionStorage.getItem("pythia_email") || "";
  const apiResultRef = useRef<ApiResult | null | undefined>(undefined);
  const completeCalledRef = useRef(false);

  const MIN_DISPLAY_MS = 1200;
  const mountTimeRef = useRef(Date.now());

  const maybeComplete = () => {
    if (completeCalledRef.current) return;
    if (apiResultRef.current === undefined) return;
    const elapsed = Date.now() - mountTimeRef.current;
    const delay = Math.max(0, MIN_DISPLAY_MS - elapsed);
    completeCalledRef.current = true;
    setTimeout(() => onComplete(apiResultRef.current as ApiResult | null), delay);
  };

  useEffect(() => {
    const normalized = url.startsWith("http") ? url : `https://${url}`;
    const controller = new AbortController();

    // Show slow-warn banner after SLOW_WARN_MS
    const slowTimer = setTimeout(() => setSlowWarn(true), SLOW_WARN_MS);
    // Hard client-side abort after CLIENT_FETCH_TIMEOUT_MS
    const abortTimer = setTimeout(() => controller.abort(), CLIENT_FETCH_TIMEOUT_MS);

    fetch("/api/instant/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: normalized }),
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((data: Record<string, unknown>) => {
        const result: ApiResult = {
          startup: (data.startup as ApiStartup) ?? null,
          matches: Array.isArray(data.matches) ? (data.matches as ApiMatch[]) : [],
          startup_id: (data.startup_id as string) ?? null,
          is_new: Boolean(data.is_new),
          gen_in_progress: Boolean(data.gen_in_progress),
        };
        apiResultRef.current = result;
      })
      .catch(() => { apiResultRef.current = null; })
      .finally(() => {
        clearTimeout(slowTimer);
        clearTimeout(abortTimer);
        maybeComplete();
      });

    // Animation loops through steps continuously until the API responds.
    let stepIndex = 0;
    let loopCount = 0;
    let cancelled = false;

    const runStep = () => {
      if (cancelled) return;
      const realIdx = stepIndex % SCAN_STEPS.length;
      if (realIdx === 0 && stepIndex > 0) loopCount++;
      setCurrentStep(realIdx);
      const duration = SCAN_STEPS[realIdx].duration;
      // Progress oscillates 0→95 on first pass, 95→75→95 on subsequent loops
      // so the bar never hits 100 while waiting.
      const loopBase = loopCount === 0 ? 0 : 75;
      const loopEnd  = loopCount === 0 ? 95 : 95;
      const stepFrac = realIdx / SCAN_STEPS.length;
      const nextFrac = (realIdx + 1) / SCAN_STEPS.length;
      const startP = loopBase + (loopEnd - loopBase) * stepFrac;
      const endP   = loopBase + (loopEnd - loopBase) * nextFrac;
      const startTime = Date.now();
      const progressInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const p = startP + (endP - startP) * Math.min(elapsed / duration, 1);
        setProgress(p);
        if (elapsed >= duration) clearInterval(progressInterval);
      }, 16);
      setTimeout(() => {
        if (cancelled) return;
        setCompletedSteps((prev) => {
          const next = [...prev, realIdx];
          return next.length > SCAN_STEPS.length ? [realIdx] : next;
        });
        stepIndex++;
        runStep();
      }, duration);
    };

    runStep();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ backgroundColor: "oklch(0.13 0.01 264)" }}>
      <div className="w-full max-w-lg">
        {/* PYTHIA scanning header */}
        <div className="flex items-center gap-3 mb-8">
          <PythiaAvatar size={48} pulse />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-xl" style={{ color: "oklch(0.97 0.005 264)" }}>PYTHIA</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium animate-pulse"
                style={{ backgroundColor: "oklch(0.769 0.188 70.08 / 0.15)", color: "oklch(0.769 0.188 70.08)", border: "1px solid oklch(0.769 0.188 70.08 / 0.3)" }}>
                Scanning
              </span>
            </div>
            <p className="text-xs font-mono truncate max-w-xs" style={{ color: "oklch(0.5 0.01 264)" }}>{url}</p>
          </div>
        </div>

        <h2 className="font-display font-bold mb-2" style={{ fontSize: "clamp(1.5rem, 4vw, 2.25rem)", color: "oklch(0.97 0.005 264)" }}>
          Reading your startup.
        </h2>
        {slowWarn ? (
          <div className="flex items-start gap-3 mb-4 px-4 py-3 rounded-lg"
            style={{ backgroundColor: "oklch(0.769 0.188 70.08 / 0.08)", border: "1px solid oklch(0.769 0.188 70.08 / 0.25)" }}>
            <span style={{ color: "oklch(0.769 0.188 70.08)", fontSize: 14, flexShrink: 0 }}>⏳</span>
            <div>
              <p className="text-xs font-semibold mb-0.5" style={{ color: "oklch(0.769 0.188 70.08)" }}>
                Still analyzing — deeper signals take longer
              </p>
              <p className="text-xs" style={{ color: "oklch(0.55 0.01 264)" }}>
                PYTHIA is cross-referencing fund cycles, LP signals, and 5,000+ investors. Hang tight — results are on the way.
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm mb-4" style={{ color: "oklch(0.5 0.01 264)" }}>
            Scoring 5,000+ investors across 40 dimensions. This takes about 60 seconds.
          </p>
        )}
        {capturedEmail && (
          <div className="flex items-center gap-2 mb-8 px-4 py-2.5 rounded-lg"
            style={{ backgroundColor: "oklch(0.696 0.17 162.48 / 0.07)", border: "1px solid oklch(0.696 0.17 162.48 / 0.2)" }}>
            <Mail size={13} style={{ color: "oklch(0.696 0.17 162.48)", flexShrink: 0 }} />
            <p className="text-xs" style={{ color: "oklch(0.6 0.01 264)" }}>
              Report will be sent to{" "}
              <span className="font-mono font-medium" style={{ color: "oklch(0.696 0.17 162.48)" }}>{capturedEmail}</span>
            </p>
          </div>
        )}

        {/* Progress bar */}
        <div className="h-1 w-full rounded-full mb-8" style={{ backgroundColor: "oklch(0.22 0.01 264)" }}>
          <div className="h-1 rounded-full transition-all duration-100"
            style={{ width: `${progress}%`, backgroundColor: "oklch(0.696 0.17 162.48)", boxShadow: "0 0 8px oklch(0.696 0.17 162.48 / 0.6)" }} />
        </div>

        {/* Step list */}
        <div className="space-y-3">
          {SCAN_STEPS.map((step, i) => {
            const isDone = completedSteps.includes(i);
            const isActive = currentStep === i && !isDone;
            return (
              <div key={i} className="flex items-center gap-3 py-2.5 px-4 rounded-lg transition-all duration-300"
                style={{ backgroundColor: isActive ? "oklch(0.16 0.01 264)" : "transparent", border: isActive ? "1px solid oklch(0.696 0.17 162.48 / 0.2)" : "1px solid transparent" }}>
                <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                  {isDone ? (
                    <CheckCircle2 size={16} style={{ color: "oklch(0.696 0.17 162.48)" }} />
                  ) : isActive ? (
                    <Loader2 size={16} className="animate-spin" style={{ color: "oklch(0.769 0.188 70.08)" }} />
                  ) : (
                    <Circle size={16} style={{ color: "oklch(0.3 0.01 264)" }} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: isDone ? "oklch(0.6 0.01 264)" : isActive ? "oklch(0.94 0.005 264)" : "oklch(0.4 0.01 264)" }}>
                    {step.label}
                  </p>
                  {isActive && (
                    <p className="text-xs mt-0.5" style={{ color: "oklch(0.5 0.01 264)" }}>{step.detail}</p>
                  )}
                </div>
                {isDone && (
                  <span className="text-xs font-mono" style={{ color: "oklch(0.4 0.01 264)" }}>done</span>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-xs mt-8 text-center" style={{ color: "oklch(0.35 0.01 264)" }}>
          PYTHIA is analyzing your product, team, traction, and market positioning
        </p>
      </div>
    </div>
  );
}

// ─── Step 3: Match Results ────────────────────────────────────────────────────

function ResultsStep({ url, onActivate, apiResult, onRefresh, onForceRefresh }: { url: string; onActivate: () => void; apiResult?: ApiResult | null; onRefresh?: () => void; onForceRefresh?: () => void }) {
  const [expanded, setExpanded] = useState<number | null>(1);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const shareUrl = `https://pythh.ai/activate?startup=${encodeURIComponent(url)}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // fallback for browsers that block clipboard without HTTPS focus
      const el = document.createElement("textarea");
      el.value = shareUrl;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };
  const domain = url.replace(/https?:\/\//, "").replace(/\/.*/, "");
  const investors = mapApiToMatchedInvestors(apiResult?.matches ?? []);
  const startupName = apiResult?.startup?.name || domain;
  const totalMatchCount = apiResult?.matches?.length ?? investors.length;
  const matchCount = investors.length;

  // ── Live GOD score polling ────────────────────────────────────────────────
  // Existing startups already have pre-computed GOD scores — only poll when
  // this is a brand-new URL that has never been submitted before (is_new: true).
  const startupId = apiResult?.startup_id ?? apiResult?.startup?.id ?? null;
  const initialGodScore = apiResult?.startup?.total_god_score ?? null;
  const [liveGodScore, setLiveGodScore] = useState<number | null>(initialGodScore);
  const isNewStartup = Boolean(apiResult?.is_new);
  // Always poll when we have a startupId — background pipeline improves matches
  // even for existing startups (speculative → real sector-specific matches).
  const [scorePending, setScorePending] = useState<boolean>(Boolean(startupId && (apiResult?.gen_in_progress || apiResult?.matches?.length === 0 || isNewStartup)));
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollAttemptsRef = useRef(0);
  const MAX_POLL_ATTEMPTS = 12; // ~60 seconds at 5s intervals

  useEffect(() => {
    if (!startupId) return;

    const poll = async () => {
      pollAttemptsRef.current++;
      if (pollAttemptsRef.current > MAX_POLL_ATTEMPTS) {
        setScorePending(false);
        if (pollRef.current) clearInterval(pollRef.current);
        return;
      }
      try {
        const res = await fetch(`/api/instant/status?startup_id=${startupId}`);
        if (!res.ok) return;
        const data = await res.json() as {
          status: string;
          startup?: { total_god_score?: number };
          match_count?: number;
        };
        const newScore = data.startup?.total_god_score ?? null;
        if (newScore != null) setLiveGodScore(newScore);

        if (data.status === "ready") {
          setScorePending(false);
          if (pollRef.current) clearInterval(pollRef.current);
          // Fetch updated match list once — only when pipeline is fully done.
          // Do NOT call onRefresh in a loop — it re-submits to the backend
          // and causes the scoring engine to loop indefinitely.
          if (onRefresh) onRefresh();
        }
      } catch {
        // silently ignore transient errors
      }
    };

    pollRef.current = setInterval(poll, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startupId]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "oklch(0.13 0.01 264)" }}>
      {/* Header */}
      <div className="sticky top-0 z-20 border-b" style={{ backgroundColor: "oklch(0.13 0.01 264 / 0.95)", borderColor: "oklch(0.22 0.01 264)", backdropFilter: "blur(12px)" }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <PythiaAvatar size={36} />
            <div>
              <p className="text-sm font-semibold" style={{ color: "oklch(0.94 0.005 264)" }}>
                {matchCount > 0
                  ? <>PYTHIA ranked <span style={{ color: "oklch(0.696 0.17 162.48)" }}>top {matchCount} investors</span> for {startupName}{totalMatchCount > matchCount && <span style={{ color: "oklch(0.5 0.01 264)" }}> from {totalMatchCount.toLocaleString()} analyzed</span>}</>
                  : <>Computing matches for <span style={{ color: "oklch(0.696 0.17 162.48)" }}>{startupName}</span>…</>
                }
              </p>
              <p className="text-xs" style={{ color: "oklch(0.5 0.01 264)" }}>Ranked by timing × thesis fit × optics</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Share results */}
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-semibold text-xs transition-all duration-200 whitespace-nowrap border"
              style={{
                color: copied ? "#22c55e" : "oklch(0.52 0.01 264)",
                backgroundColor: "transparent",
                borderColor: copied ? "#22c55e50" : "oklch(0.25 0.01 264)",
              }}
              title="Copy a shareable link to these results"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Copied!" : "Share"}
            </button>

            {/* Activate PYTHIA */}
            <button
              onClick={onActivate}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-xs transition-all duration-200 whitespace-nowrap border"
              style={{ color: "oklch(0.696 0.17 162.48)", backgroundColor: "transparent", borderColor: "oklch(0.696 0.17 162.48 / 0.4)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "oklch(0.696 0.17 162.48 / 0.1)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
            >
              <Zap size={12} />
              Activate PYTHIA
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "TOP INVESTORS", value: String(matchCount), sub: `from ${totalMatchCount.toLocaleString()} analyzed`, color: "emerald" },
            { label: "TOP MATCH SCORE", value: String(investors[0]?.matchScore ?? "—"), sub: "out of 100", color: "amber" },
            { label: "SUPER MATCHES", value: String(investors.filter(i => i.isSuperMatch).length), sub: "highest thesis alignment", color: "emerald" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl p-4 border text-center"
              style={{ backgroundColor: "oklch(0.16 0.01 264)", borderColor: "oklch(0.25 0.01 264)" }}>
              <p className="font-display font-bold text-2xl mb-1"
                style={{ color: stat.color === "emerald" ? "oklch(0.696 0.17 162.48)" : "oklch(0.769 0.188 70.08)" }}>
                {stat.value}
              </p>
              <p className="text-xs font-semibold tracking-widest mb-0.5" style={{ color: "oklch(0.5 0.01 264)" }}>{stat.label}</p>
              <p className="text-xs" style={{ color: "oklch(0.4 0.01 264)" }}>{stat.sub}</p>
            </div>
          ))}
        </div>

        {/* ── Startup Profile Card ─────────────────────────────────────────────── */}
        {apiResult?.startup && (
          <div className="rounded-xl border p-4 mb-6 flex items-center gap-4"
            style={{ backgroundColor: "oklch(0.16 0.01 264)", borderColor: "oklch(0.25 0.01 264)" }}>
            {/* Logo placeholder */}
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 font-display font-bold text-lg"
              style={{ backgroundColor: "oklch(0.696 0.17 162.48 / 0.12)", color: "oklch(0.696 0.17 162.48)", border: "1px solid oklch(0.696 0.17 162.48 / 0.25)" }}>
              {(startupName || "?")[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-display font-bold text-base" style={{ color: "oklch(0.94 0.005 264)" }}>{startupName}</span>
                <a href={url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs" style={{ color: "oklch(0.5 0.01 264)" }}>
                  <Globe size={10} />{domain}
                </a>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {apiResult.startup.sectors?.slice(0, 3).map((s) => (
                  <span key={s} className="text-xs px-2 py-0.5 rounded"
                    style={{ backgroundColor: "oklch(0.696 0.17 162.48 / 0.08)", color: "oklch(0.696 0.17 162.48)", border: "1px solid oklch(0.696 0.17 162.48 / 0.2)" }}>
                    {s}
                  </span>
                ))}
                {apiResult.startup.stage && (
                  <span className="text-xs" style={{ color: "oklch(0.5 0.01 264)" }}>
                    Stage {apiResult.startup.stage}
                  </span>
                )}
              </div>
            </div>
            {/* GOD Score — live-updated while background pipeline runs */}
            {(liveGodScore != null || initialGodScore != null) && (
              <div className="text-center flex-shrink-0">
                <div className="flex items-center justify-center gap-1">
                  <p className="font-display font-bold text-2xl"
                    style={{
                      color: (liveGodScore ?? initialGodScore ?? 0) >= 60
                        ? "oklch(0.696 0.17 162.48)"
                        : (liveGodScore ?? initialGodScore ?? 0) >= 45
                          ? "oklch(0.769 0.188 70.08)"
                          : "oklch(0.65 0.01 264)",
                      transition: "color 0.6s ease",
                    }}>
                    {Math.round(liveGodScore ?? initialGodScore ?? 0)}
                  </p>
                  {scorePending && (
                    <Loader2 size={12} className="animate-spin" style={{ color: "oklch(0.5 0.01 264)", marginTop: "2px" }} />
                  )}
                </div>
                <p className="text-xs font-semibold tracking-widest" style={{ color: "oklch(0.4 0.01 264)" }}>
                  {scorePending ? "SCORING…" : "GOD SCORE"}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── PYTHIA Activation Banner ─────────────────────────────────────────── */}
        <div className="rounded-2xl border mb-8 overflow-hidden"
          style={{ background: "linear-gradient(135deg, oklch(0.696 0.17 162.48 / 0.08) 0%, oklch(0.769 0.188 70.08 / 0.05) 100%)", borderColor: "oklch(0.696 0.17 162.48 / 0.3)" }}>
          {/* Top strip */}
          <div className="px-6 pt-6 pb-4 flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="flex items-center gap-4 flex-1">
              <div className="relative flex-shrink-0">
                <PythiaAvatar size={52} />
                <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 animate-pulse"
                  style={{ backgroundColor: "oklch(0.696 0.17 162.48)", borderColor: "oklch(0.13 0.01 264)" }} />
              </div>
              <div>
                <p className="font-display font-bold text-lg leading-tight mb-0.5" style={{ color: "oklch(0.94 0.005 264)" }}>
                  Ready to activate PYTHIA?
                </p>
                <p className="text-sm" style={{ color: "oklch(0.65 0.01 264)" }}>
                  She'll reach out to your top {matchCount} investors — personalized pitch, email sequencing, meeting booked.
                </p>
              </div>
            </div>
            {/* Primary CTA */}
            <button
              onClick={onActivate}
              className="flex items-center gap-2.5 px-7 py-3.5 rounded-xl font-bold text-base transition-all duration-200 whitespace-nowrap flex-shrink-0"
              style={{ backgroundColor: "oklch(0.696 0.17 162.48)", color: "oklch(0.1 0.01 162)", boxShadow: "0 0 0 0 oklch(0.696 0.17 162.48)" }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.backgroundColor = "oklch(0.75 0.17 162.48)";
                el.style.boxShadow = "0 0 28px oklch(0.696 0.17 162.48 / 0.55)";
                el.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.backgroundColor = "oklch(0.696 0.17 162.48)";
                el.style.boxShadow = "0 0 0 0 oklch(0.696 0.17 162.48)";
                el.style.transform = "none";
              }}
            >
              <Zap size={18} />
              Activate PYTHIA
            </button>
          </div>

          {/* What Pythia does — three steps */}
          <div className="grid grid-cols-3 gap-px border-t" style={{ borderColor: "oklch(0.696 0.17 162.48 / 0.15)" }}>
            {[
              { icon: <Mail size={14} />, label: "Personalized Outreach", desc: `Drafts & sends emails to all ${matchCount} investors` },
              { icon: <FileText size={14} />, label: "Pitch Prep", desc: "Builds custom deck & one-pager per investor" },
              { icon: <CalendarCheck size={14} />, label: "Meeting Booked", desc: "You approve before anything goes out" },
            ].map((item) => (
              <div key={item.label} className="flex items-start gap-3 px-5 py-4"
                style={{ backgroundColor: "oklch(0.696 0.17 162.48 / 0.04)" }}>
                <span style={{ color: "oklch(0.696 0.17 162.48)" }} className="mt-0.5 flex-shrink-0">{item.icon}</span>
                <div>
                  <p className="text-xs font-semibold mb-0.5" style={{ color: "oklch(0.85 0.005 264)" }}>{item.label}</p>
                  <p className="text-xs" style={{ color: "oklch(0.5 0.01 264)" }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Investor list */}
        {investors.length === 0 && (
          <div className="rounded-xl border p-8 mb-6 text-center" style={{ backgroundColor: "oklch(0.16 0.01 264)", borderColor: "oklch(0.25 0.01 264)" }}>
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: "oklch(0.696 0.17 162.48)" }} />
              <span className="text-sm font-mono" style={{ color: "oklch(0.696 0.17 162.48)" }}>Computing investor matches…</span>
            </div>
            <p className="text-xs" style={{ color: "oklch(0.45 0.01 264)" }}>PYTHIA is scoring 4,000+ investors against your profile. Results will refresh automatically.</p>
          </div>
        )}
        <div className="space-y-3 mb-8">
          {investors.map((inv, i) => (
            <div key={inv.id}
              className="rounded-xl border overflow-hidden transition-all duration-200 cursor-pointer"
              style={{ backgroundColor: "oklch(0.16 0.01 264)", borderColor: expanded === inv.id ? "oklch(0.696 0.17 162.48 / 0.3)" : "oklch(0.25 0.01 264)" }}
              onClick={() => setExpanded(expanded === inv.id ? null : inv.id)}>
              {/* Row */}
              <div className="flex items-center gap-4 p-4">
                {/* Rank */}
                <span className="font-mono text-xs w-5 text-center flex-shrink-0" style={{ color: "oklch(0.4 0.01 264)" }}>
                  {i + 1}
                </span>
                {/* Score */}
                <ScoreBadge score={inv.matchScore} size="sm" />
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-display font-semibold text-sm" style={{ color: "oklch(0.94 0.005 264)" }}>{inv.name}</span>
                    {inv.isSuperMatch && (
                      <span className="text-xs px-1.5 py-0.5 rounded font-bold"
                        style={{ backgroundColor: "oklch(0.769 0.188 70.08 / 0.15)", color: "oklch(0.769 0.188 70.08)", border: "1px solid oklch(0.769 0.188 70.08 / 0.3)" }}>
                        🔥 SUPER
                      </span>
                    )}
                    <span className="text-xs" style={{ color: "oklch(0.5 0.01 264)" }}>{inv.role}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Building2 size={11} style={{ color: "oklch(0.5 0.01 264)" }} />
                    <span className="text-xs" style={{ color: "oklch(0.6 0.01 264)" }}>{inv.firm}</span>
                    <span className="text-xs" style={{ color: "oklch(0.35 0.01 264)" }}>·</span>
                    <span className="text-xs" style={{ color: "oklch(0.5 0.01 264)" }}>{inv.stage}</span>
                    <span className="text-xs" style={{ color: "oklch(0.35 0.01 264)" }}>·</span>
                    <span className="text-xs" style={{ color: "oklch(0.5 0.01 264)" }}>{inv.checkSize}</span>
                  </div>
                </div>
                {/* Signal */}
                <div className="hidden sm:flex flex-col items-end gap-1">
                  <span className="font-mono text-sm font-semibold" style={{ color: "oklch(0.769 0.188 70.08)" }}>{inv.signalScore}</span>
                  <span className="text-xs" style={{ color: "oklch(0.4 0.01 264)" }}>signal</span>
                </div>
                {/* Sector tags */}
                <div className="hidden md:flex gap-1.5 flex-wrap">
                  {inv.sector.slice(0, 2).map((s) => (
                    <span key={s} className="text-xs px-2 py-0.5 rounded"
                      style={{ backgroundColor: "oklch(0.696 0.17 162.48 / 0.1)", color: "oklch(0.696 0.17 162.48)", border: "1px solid oklch(0.696 0.17 162.48 / 0.2)" }}>
                      {s}
                    </span>
                  ))}
                </div>
                <ChevronRight size={14} className="flex-shrink-0 transition-transform duration-200"
                  style={{ color: "oklch(0.4 0.01 264)", transform: expanded === inv.id ? "rotate(90deg)" : "rotate(0deg)" }} />
              </div>

              {/* Expanded detail — CRM notes */}
              {expanded === inv.id && (
                <div className="px-4 pb-4 border-t" style={{ borderColor: "oklch(0.22 0.01 264)" }}>
                  <div className="pt-4 space-y-4">
                    {/* Why you match tags */}
                    {inv.whyYouMatchTags && inv.whyYouMatchTags.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold tracking-widest mb-2" style={{ color: "oklch(0.5 0.01 264)" }}>MATCH SIGNALS</p>
                        <div className="flex flex-wrap gap-1.5">
                          {inv.whyYouMatchTags.map((tag, ti) => {
                            const isSuper = tag.includes("SUPER MATCH");
                            return (
                              <span key={ti} className="text-xs px-2 py-0.5 rounded font-medium"
                                style={{
                                  backgroundColor: isSuper ? "oklch(0.769 0.188 70.08 / 0.15)" : "oklch(0.696 0.17 162.48 / 0.1)",
                                  color: isSuper ? "oklch(0.769 0.188 70.08)" : "oklch(0.696 0.17 162.48)",
                                  border: `1px solid ${isSuper ? "oklch(0.769 0.188 70.08 / 0.3)" : "oklch(0.696 0.17 162.48 / 0.2)"}`,
                                }}>
                                {tag}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-semibold tracking-widest mb-2" style={{ color: "oklch(0.5 0.01 264)" }}>PYTHIA'S REASONING</p>
                        <p className="text-sm leading-relaxed" style={{ color: "oklch(0.65 0.01 264)" }}>{inv.reason}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold tracking-widest mb-2" style={{ color: "oklch(0.5 0.01 264)" }}>INVESTOR THESIS</p>
                        <div className="flex items-start gap-2">
                          <Target size={13} className="mt-0.5 flex-shrink-0" style={{ color: "oklch(0.769 0.188 70.08)" }} />
                          <p className="text-sm" style={{ color: "oklch(0.65 0.01 264)" }}>{inv.investmentThesis || inv.recentActivity || "—"}</p>
                        </div>
                      </div>
                    </div>
                    {/* Email inference panel */}
                    {inv.emailProfile && (
                      <div className="rounded-lg p-4 border" style={{ backgroundColor: "oklch(0.13 0.01 264)", borderColor: "oklch(0.22 0.01 264)" }}>
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xs font-semibold tracking-widest" style={{ color: "oklch(0.5 0.01 264)" }}>PYTHIA EMAIL TARGETS</p>
                          <span className="text-xs font-mono" style={{ color: "oklch(0.4 0.01 264)" }}>{inv.emailProfile.domain}</span>
                        </div>
                        <div className="space-y-2">
                          {/* Personal variants — high + medium confidence */}
                          {getPrimaryVariants(inv.emailProfile).map((v) => (
                            <div key={v.address} className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <Send size={11} style={{ color: "oklch(0.696 0.17 162.48)", flexShrink: 0 }} />
                                <span className="font-mono text-xs truncate" style={{ color: "oklch(0.8 0.005 264)" }}>{v.address}</span>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-xs px-2 py-0.5 rounded font-medium"
                                  style={{
                                    backgroundColor: v.confidence === "high" ? "oklch(0.696 0.17 162.48 / 0.12)" : "oklch(0.769 0.188 70.08 / 0.1)",
                                    color: v.confidence === "high" ? "oklch(0.696 0.17 162.48)" : "oklch(0.769 0.188 70.08)",
                                    border: `1px solid ${v.confidence === "high" ? "oklch(0.696 0.17 162.48 / 0.25)" : "oklch(0.769 0.188 70.08 / 0.25)"}`
                                  }}>
                                  {confidenceLabel(v.confidence)}
                                </span>
                                <span className="text-xs" style={{ color: "oklch(0.4 0.01 264)" }}>{v.pattern}</span>
                              </div>
                            </div>
                          ))}
                          {/* Divider */}
                          <div className="border-t pt-2 mt-1" style={{ borderColor: "oklch(0.22 0.01 264)" }}>
                            <p className="text-xs mb-1.5" style={{ color: "oklch(0.4 0.01 264)" }}>Pitch-specific fallbacks</p>
                            <div className="flex flex-wrap gap-2">
                              {inv.emailProfile.variants
                                .filter((v) => v.type === "pitch")
                                .slice(0, 3)
                                .map((v) => (
                                  <span key={v.address} className="font-mono text-xs px-2 py-1 rounded"
                                    style={{ backgroundColor: "oklch(0.18 0.01 264)", color: "oklch(0.55 0.01 264)", border: "1px solid oklch(0.25 0.01 264)" }}>
                                    {v.address}
                                  </span>
                                ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="rounded-2xl p-8 border text-center"
          style={{ backgroundColor: "oklch(0.16 0.01 264)", borderColor: "oklch(0.696 0.17 162.48 / 0.2)", background: "linear-gradient(135deg, oklch(0.16 0.01 264) 0%, oklch(0.696 0.17 162.48 / 0.05) 100%)" }}>
          <div className="flex justify-center mb-4">
            <PythiaAvatar size={52} pulse />
          </div>
          <h3 className="font-display font-bold text-xl mb-2" style={{ color: "oklch(0.97 0.005 264)" }}>
            Ready to run your pipeline?
          </h3>
          <p className="text-sm leading-relaxed mb-6 max-w-md mx-auto" style={{ color: "oklch(0.6 0.01 264)" }}>
            PYTHIA will reach out to your top {matchCount} matched investors, prepare personalized pitch materials for each, and book meetings on your calendar. You approve every action before it goes out.
          </p>
          <button
            onClick={onActivate}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-base transition-all duration-200"
            style={{ backgroundColor: "oklch(0.696 0.17 162.48)", color: "oklch(0.1 0.01 162)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 32px oklch(0.696 0.17 162.48 / 0.5)"; (e.currentTarget as HTMLElement).style.backgroundColor = "oklch(0.75 0.17 162.48)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; (e.currentTarget as HTMLElement).style.backgroundColor = "oklch(0.696 0.17 162.48)"; }}
          >
            <Zap size={18} />
            Run Pipeline with PYTHIA
            <ArrowRight size={18} />
          </button>
          <p className="text-xs mt-3" style={{ color: "oklch(0.4 0.01 264)" }}>
            You approve every meeting before it's confirmed. PYTHIA does the rest.
          </p>
        </div>

        {/* Re-submit for refresh */}
        <div className="text-center pt-2 pb-8">
          <button
            disabled={refreshing}
            onClick={async () => {
              // User-initiated: force_generate=true to bypass cache and re-run pipeline
              const fn = onForceRefresh ?? onRefresh;
              if (!fn) return;
              setRefreshing(true);
              await fn();
              setRefreshing(false);
            }}
            className="inline-flex items-center gap-1.5 text-xs transition-colors duration-150"
            style={{ color: refreshing ? "oklch(0.4 0.01 264)" : "oklch(0.5 0.01 264)" }}
            onMouseEnter={(e) => { if (!refreshing) (e.currentTarget as HTMLElement).style.color = "oklch(0.696 0.17 162.48)"; }}
            onMouseLeave={(e) => { if (!refreshing) (e.currentTarget as HTMLElement).style.color = "oklch(0.5 0.01 264)"; }}
          >
            <Loader2 size={11} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Refreshing matches…" : "Refresh investor matches"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Step 4: Pipeline Live Feed ───────────────────────────────────────────────

// ─── Copy Talking Points Button ─────────────────────────────────────────────
function CopyTalkingPointsButton({ points }: { points: string[] }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    const text = points.map((p, i) => `${i + 1}. ${p}`).join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
      style={{
        backgroundColor: copied ? "oklch(0.696 0.17 162.48 / 0.15)" : "oklch(0.18 0.01 264)",
        color: copied ? "oklch(0.696 0.17 162.48)" : "oklch(0.55 0.01 264)",
        border: copied ? "1px solid oklch(0.696 0.17 162.48 / 0.3)" : "1px solid oklch(0.28 0.01 264)",
      }}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? "Copied!" : "Copy all"}
    </button>
  );
}

// ─── Meeting Brief Modal ─────────────────────────────────────────────────────
function MeetingBriefModal({ milestone, onClose }: { milestone: Milestone; onClose: () => void }) {
  const brief = milestone.meetingBrief!;
  const [checklistState, setChecklistState] = useState<boolean[]>(brief.prepChecklist.map((i) => i.done));
  const [activeTab, setActiveTab] = useState<"overview" | "questions" | "coinvestors" | "checklist">("overview");

  const tabs = [
    { id: "overview" as const, label: "Overview" },
    { id: "questions" as const, label: "Q&A Prep" },
    { id: "coinvestors" as const, label: "Co-investors" },
    { id: "checklist" as const, label: "Checklist" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "oklch(0.05 0.01 264 / 0.92)", backdropFilter: "blur(12px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl border flex flex-col"
        style={{ backgroundColor: "oklch(0.13 0.01 264)", borderColor: "oklch(0.769 0.188 70.08 / 0.4)" }}>
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b flex-shrink-0"
          style={{ borderColor: "oklch(0.22 0.01 264)", background: "linear-gradient(135deg, oklch(0.769 0.188 70.08 / 0.08) 0%, oklch(0.13 0.01 264) 60%)" }}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: "oklch(0.769 0.188 70.08 / 0.15)", border: "1px solid oklch(0.769 0.188 70.08 / 0.3)" }}>
              <CalendarCheck size={22} style={{ color: "oklch(0.769 0.188 70.08)" }} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold tracking-widest" style={{ color: "oklch(0.769 0.188 70.08)" }}>PRE-MEETING BRIEF</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "oklch(0.769 0.188 70.08 / 0.15)", color: "oklch(0.769 0.188 70.08)" }}>PYTHIA</span>
              </div>
              <h2 className="font-display font-bold text-xl" style={{ color: "oklch(0.97 0.005 264)" }}>
                {milestone.investor} · {milestone.firm}
              </h2>
              <p className="text-sm mt-0.5" style={{ color: "oklch(0.6 0.01 264)" }}>
                {brief.date} · {brief.time} · {brief.duration} · {brief.format}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg transition-colors hover:bg-white/5" style={{ color: "oklch(0.5 0.01 264)" }}>
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b flex-shrink-0" style={{ borderColor: "oklch(0.22 0.01 264)" }}>
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="px-5 py-3 text-xs font-semibold tracking-wider transition-colors relative"
              style={{
                color: activeTab === tab.id ? "oklch(0.769 0.188 70.08)" : "oklch(0.5 0.01 264)",
                borderBottom: activeTab === tab.id ? "2px solid oklch(0.769 0.188 70.08)" : "2px solid transparent",
              }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-6">
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Investor background */}
              <div className="rounded-xl p-4 border" style={{ backgroundColor: "oklch(0.16 0.01 264)", borderColor: "oklch(0.25 0.01 264)" }}>
                <p className="text-xs font-bold tracking-widest mb-2" style={{ color: "oklch(0.769 0.188 70.08)" }}>INVESTOR BACKGROUND</p>
                <p className="text-sm leading-relaxed" style={{ color: "oklch(0.75 0.01 264)" }}>{brief.investorBackground}</p>
              </div>
              {/* Recent activity */}
              <div className="rounded-xl p-4 border" style={{ backgroundColor: "oklch(0.16 0.01 264)", borderColor: "oklch(0.25 0.01 264)" }}>
                <p className="text-xs font-bold tracking-widest mb-2" style={{ color: "oklch(0.696 0.17 162.48)" }}>RECENT ACTIVITY</p>
                <p className="text-sm leading-relaxed" style={{ color: "oklch(0.75 0.01 264)" }}>{brief.recentActivity}</p>
              </div>
              {/* Talking points */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold tracking-widest" style={{ color: "oklch(0.97 0.005 264)" }}>TALKING POINTS</p>
                  <CopyTalkingPointsButton points={brief.talkingPoints} />
                </div>
                <div className="space-y-3">
                  {brief.talkingPoints.map((point, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-xl p-4 border"
                      style={{ backgroundColor: "oklch(0.16 0.01 264)", borderColor: "oklch(0.25 0.01 264)" }}>
                      <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
                        style={{ backgroundColor: "oklch(0.769 0.188 70.08 / 0.15)", color: "oklch(0.769 0.188 70.08)" }}>{i + 1}</span>
                      <p className="text-sm leading-relaxed" style={{ color: "oklch(0.8 0.01 264)" }}>{point}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "questions" && (
            <div className="space-y-4">
              <p className="text-xs" style={{ color: "oklch(0.5 0.01 264)" }}>PYTHIA has predicted the most likely questions based on {milestone.investor}'s known diligence patterns. Suggested answers are starting points — personalize them.</p>
              {brief.anticipatedQuestions.map((qa, i) => (
                <div key={i} className="rounded-xl border overflow-hidden" style={{ borderColor: "oklch(0.25 0.01 264)" }}>
                  <div className="p-4" style={{ backgroundColor: "oklch(0.769 0.188 70.08 / 0.06)" }}>
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-bold flex-shrink-0 mt-0.5" style={{ color: "oklch(0.769 0.188 70.08)" }}>Q{i + 1}</span>
                      <p className="text-sm font-semibold" style={{ color: "oklch(0.92 0.005 264)" }}>{qa.q}</p>
                    </div>
                  </div>
                  <div className="p-4" style={{ backgroundColor: "oklch(0.16 0.01 264)" }}>
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-bold flex-shrink-0 mt-0.5" style={{ color: "oklch(0.696 0.17 162.48)" }}>A</span>
                      <p className="text-sm leading-relaxed" style={{ color: "oklch(0.7 0.01 264)" }}>{qa.a}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "coinvestors" && (
            <div className="space-y-4">
              <p className="text-xs mb-4" style={{ color: "oklch(0.5 0.01 264)" }}>Other investors PYTHIA is running in parallel. Use co-investor signals strategically to create momentum.</p>
              {brief.coInvestors.map((ci, i) => (
                <div key={i} className="rounded-xl p-5 border" style={{ backgroundColor: "oklch(0.16 0.01 264)", borderColor: "oklch(0.25 0.01 264)" }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ backgroundColor: "oklch(0.696 0.17 162.48 / 0.15)", color: "oklch(0.696 0.17 162.48)" }}>
                      {ci.name.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "oklch(0.92 0.005 264)" }}>{ci.name}</p>
                      <p className="text-xs" style={{ color: "oklch(0.55 0.01 264)" }}>{ci.firm}</p>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: "oklch(0.7 0.01 264)" }}>{ci.overlap}</p>
                </div>
              ))}
            </div>
          )}

          {activeTab === "checklist" && (
            <div className="space-y-3">
              <p className="text-xs mb-4" style={{ color: "oklch(0.5 0.01 264)" }}>Complete these before your meeting with {milestone.investor}.</p>
              {brief.prepChecklist.map((item, i) => (
                <button key={i}
                  onClick={() => setChecklistState((prev) => { const next = [...prev]; next[i] = !next[i]; return next; })}
                  className="w-full flex items-center gap-3 rounded-xl p-4 border text-left transition-all"
                  style={{
                    backgroundColor: checklistState[i] ? "oklch(0.696 0.17 162.48 / 0.08)" : "oklch(0.16 0.01 264)",
                    borderColor: checklistState[i] ? "oklch(0.696 0.17 162.48 / 0.3)" : "oklch(0.25 0.01 264)",
                  }}>
                  <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-all"
                    style={{
                      backgroundColor: checklistState[i] ? "oklch(0.696 0.17 162.48)" : "transparent",
                      border: checklistState[i] ? "none" : "1.5px solid oklch(0.4 0.01 264)",
                    }}>
                    {checklistState[i] && <Check size={12} style={{ color: "oklch(0.1 0.01 162)" }} />}
                  </div>
                  <span className="text-sm" style={{
                    color: checklistState[i] ? "oklch(0.55 0.01 264)" : "oklch(0.8 0.01 264)",
                    textDecoration: checklistState[i] ? "line-through" : "none",
                  }}>{item.item}</span>
                </button>
              ))}
              <div className="mt-4 pt-4 border-t text-center" style={{ borderColor: "oklch(0.22 0.01 264)" }}>
                <p className="text-xs" style={{ color: "oklch(0.5 0.01 264)" }}>
                  {checklistState.filter(Boolean).length} of {checklistState.length} items complete
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t flex-shrink-0"
          style={{ borderColor: "oklch(0.22 0.01 264)", backgroundColor: "oklch(0.11 0.01 264)" }}>
          <div className="flex items-center gap-2">
            <PythiaAvatar size={20} />
            <span className="text-xs" style={{ color: "oklch(0.5 0.01 264)" }}>PYTHIA will send this brief to your email 24h before the meeting.</span>
          </div>
          <button onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold transition-colors"
            style={{ backgroundColor: "oklch(0.769 0.188 70.08)", color: "oklch(0.1 0.01 70)" }}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Pitch Brief Modal ────────────────────────────────────────────────────────
function PitchBriefModal({ milestone, onClose }: { milestone: Milestone; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "oklch(0 0 0 / 0.7)", backdropFilter: "blur(8px)" }}
      onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl border overflow-hidden"
        style={{ backgroundColor: "oklch(0.15 0.01 264)", borderColor: "oklch(0.25 0.01 264)", maxHeight: "90vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "oklch(0.22 0.01 264)" }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "oklch(0.769 0.188 70.08 / 0.15)", color: "oklch(0.769 0.188 70.08)" }}>
              <Send size={14} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: "oklch(0.94 0.005 264)" }}>Pitch Brief</p>
              <p className="text-xs" style={{ color: "oklch(0.5 0.01 264)" }}>{milestone.investor} · {milestone.firm}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: "oklch(0.5 0.01 264)", backgroundColor: "oklch(0.2 0.01 264)" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "oklch(0.25 0.01 264)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "oklch(0.2 0.01 264)")}>
            <span style={{ fontSize: 16, lineHeight: 1 }}>×</span>
          </button>
        </div>
        {/* PYTHIA angle reasoning */}
        {milestone.pitchBrief && (
          <div className="px-6 py-4 border-b" style={{ borderColor: "oklch(0.22 0.01 264)", backgroundColor: "oklch(0.769 0.188 70.08 / 0.04)" }}>
            <p className="text-xs font-semibold tracking-widest mb-1.5" style={{ color: "oklch(0.769 0.188 70.08)" }}>PYTHIA'S ANGLE</p>
            <p className="text-sm leading-relaxed" style={{ color: "oklch(0.7 0.01 264)" }}>{milestone.pitchBrief.angle}</p>
          </div>
        )}
        {/* Email */}
        {milestone.pitchBrief && (
          <div className="px-6 py-5">
            {/* Subject */}
            <div className="mb-4">
              <p className="text-xs font-semibold tracking-widest mb-1.5" style={{ color: "oklch(0.5 0.01 264)" }}>SUBJECT</p>
              <p className="text-sm font-medium px-3 py-2.5 rounded-lg" style={{ color: "oklch(0.94 0.005 264)", backgroundColor: "oklch(0.18 0.01 264)", border: "1px solid oklch(0.25 0.01 264)" }}>
                {milestone.pitchBrief.subject}
              </p>
            </div>
            {/* Body */}
            <div>
              <p className="text-xs font-semibold tracking-widest mb-1.5" style={{ color: "oklch(0.5 0.01 264)" }}>BODY</p>
              <div className="rounded-lg px-4 py-4" style={{ backgroundColor: "oklch(0.18 0.01 264)", border: "1px solid oklch(0.25 0.01 264)" }}>
                <pre className="text-sm leading-relaxed whitespace-pre-wrap font-sans" style={{ color: "oklch(0.8 0.005 264)" }}>
                  {milestone.pitchBrief.body}
                </pre>
              </div>
            </div>
            {/* Email chips */}
            {milestone.emailSentTo && (
              <div className="mt-4">
                <p className="text-xs font-semibold tracking-widest mb-1.5" style={{ color: "oklch(0.5 0.01 264)" }}>SENT TO</p>
                <div className="flex flex-wrap gap-1.5">
                  {(milestone.emailVariants ?? [milestone.emailSentTo]).map((addr, i) => (
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
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PipelineStep({ url, highlightInvestor, apiResult }: { url: string; highlightInvestor?: string; apiResult?: ApiResult | null }) {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [approvedMeetings, setApprovedMeetings] = useState<number[]>([]);
  const [pitchBriefMilestone, setPitchBriefMilestone] = useState<Milestone | null>(null);
  const [activeMeetingBrief, setActiveMeetingBrief] = useState<Milestone | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const domain = url.replace(/https?:\/\//, "").replace(/\/.*/, "");

  // Use real investor data if available, otherwise fall back to mock sequence
  const REAL_MILESTONES = apiResult?.matches?.length
    ? buildMilestonesFromApiResult(apiResult, domain)
    : null;

  const MILESTONE_SEQUENCE: Omit<Milestone, "id">[] = REAL_MILESTONES || [
    { type: "match", text: "Pipeline activated for " + domain, detail: "PYTHIA is beginning outreach to 6 matched investors", time: "Just now", done: true },
    { type: "pitch", investor: "Sarah Chen", firm: "Sequoia Capital", text: "Pitch materials prepared for Sarah Chen", detail: "Tailored narrative highlighting AI infrastructure angle and Mosaic portfolio alignment", time: "12s ago", done: true },
    { type: "pitch", investor: "Niko Bonatsos", firm: "General Catalyst", text: "Pitch materials prepared for Niko Bonatsos", detail: "Customized one-pager referencing his recent LP update on AI-native workflows", time: "28s ago", done: true },
    { type: "outreach", investor: "Sarah Chen", firm: "Sequoia Capital", text: "Outreach sent to Sarah Chen at Sequoia", detail: "Sent to sarah@sequoiacap.com · Personalized email referencing her Mosaic investment and portfolio gap in your vertical", time: "45s ago", done: true, emailSentTo: "sarah@sequoiacap.com", emailVariants: ["sarah@sequoiacap.com", "sarah.chen@sequoiacap.com", "s.chen@sequoiacap.com"], pitchBrief: { subject: "AI infrastructure play — reminds me of your Mosaic bet", body: `Hi Sarah,

I came across your investment in Mosaic and your recent comments on AI-native infrastructure at the Sequoia Summit — your thesis maps almost exactly to what we're building.

We're [Company], and we help enterprise teams [core value prop in one line]. We've grown from 0 to $180K ARR in 6 months with zero paid marketing, and two of your portfolio companies are already in our pipeline as potential customers.

I know you're selective at Series A. I'm not asking for a commitment — just 20 minutes to show you why the timing is right and why this fits your portfolio thesis better than anything else you'll see this quarter.

Would Thursday or Friday work?

Best,
[Founder]`, angle: "Led with her Mosaic investment as the thesis anchor. Mentioned portfolio overlap to create urgency. Kept ask minimal — 20 min, no commitment." } },
    { type: "outreach", investor: "Niko Bonatsos", firm: "General Catalyst", text: "Outreach sent to Niko Bonatsos at General Catalyst", detail: "Sent to niko@generalcatalyst.com · Email referencing his published essay on AI automation — sent at 9:15am his timezone", time: "1m ago", done: true, emailSentTo: "niko@generalcatalyst.com", emailVariants: ["niko@generalcatalyst.com", "niko.bonatsos@generalcatalyst.com", "n.bonatsos@generalcatalyst.com"], pitchBrief: { subject: "Re: your essay on AI-native workflows — we built the thing you described", body: `Hi Niko,

I read your essay on AI-native workflows last month — specifically the section on 'invisible automation layers.' We built exactly that.

[Company] is a [one-line description]. We're at $220K ARR, growing 30% MoM, and our architecture is a direct implementation of the composable AI model you wrote about.

I know GC is early in deploying the new fund. I'd love 20 minutes to show you the product — I think you'll recognize it immediately.

Are you free Thursday morning?

[Founder]`, angle: "Opened with a direct reference to his published essay to establish credibility and signal research. Positioned the product as the implementation of his own thesis — making the ask feel like a logical next step, not a cold pitch." } },
    { type: "outreach", investor: "Tomasz Tunguz", firm: "Theory Ventures", text: "Outreach sent to Tomasz Tunguz at Theory Ventures", detail: "Sent to tomasz@theory.vc · Positioned around his composable AI thesis from new fund announcement", time: "2m ago", done: true, emailSentTo: "tomasz@theory.vc", emailVariants: ["tomasz@theory.vc", "tomasz.tunguz@theory.vc", "t.tunguz@theory.vc", "pitches@theory.vc"], pitchBrief: { subject: "Composable AI in the enterprise — $700M fund, early deployment", body: `Hi Tomasz,

Congratulations on closing the new Theory fund. I've been following your 'composable AI' thesis since the announcement and wanted to reach out at the right moment — which I think is now.

[Company] is building [one-line description]. We're the infrastructure layer that makes AI composable in enterprise environments — exactly the gap you described in your Q1 memo.

We're raising a $4M seed extension. Happy to share the deck and data room if the timing works.

[Founder]`, angle: "Timed outreach to the new fund close — early deployment phase is the highest-intent window. Referenced his specific 'composable AI' thesis language to signal alignment without being generic." } },
    { type: "response", investor: "Sarah Chen", firm: "Sequoia Capital", text: "Sarah Chen opened your email — 3 times", detail: "High engagement signal. PYTHIA is preparing a follow-up brief.", time: "4m ago", done: true },
    { type: "outreach", investor: "Stephanie Zhan", firm: "Sequoia Capital", text: "Outreach sent to Stephanie Zhan at Sequoia", detail: "Sent to stephanie@sequoiacap.com · Highlighted co-investor overlap and NeurIPS signal", time: "5m ago", done: true, emailSentTo: "stephanie@sequoiacap.com", emailVariants: ["stephanie@sequoiacap.com", "stephanie.zhan@sequoiacap.com", "s.zhan@sequoiacap.com"], pitchBrief: { subject: "Co-investor signal + NeurIPS — quick intro?", body: `Hi Stephanie,

I noticed you and [Existing Investor] have co-invested in three companies — and that you've been active in the AI infrastructure space since NeurIPS.

We're [Company]. [One-line description]. We're already working with two companies in your portfolio as design partners, which is why I wanted to reach out directly rather than through the standard channel.

Would a 15-minute intro call make sense? Happy to share the deck first if that helps.

[Founder]`, angle: "Used co-investor overlap as the trust signal — warm intro by proxy. Referenced NeurIPS activity to show timing awareness. Offered deck first to reduce friction on the ask." } },
    { type: "response", investor: "Niko Bonatsos", firm: "General Catalyst", text: "Niko Bonatsos replied — expressed interest", detail: "\"This is exactly the kind of company we've been looking for. Can we find 30 minutes?\"", time: "8m ago", done: true },
    { type: "pitch", investor: "Niko Bonatsos", firm: "General Catalyst", text: "Meeting brief prepared for Niko Bonatsos call", detail: "Co-investment history, recent portfolio moves, likely questions, and talking points", time: "9m ago", done: true },
    {
      id: 11, type: "meeting", investor: "Niko Bonatsos", firm: "General Catalyst",
      text: "Meeting request ready — Niko Bonatsos, General Catalyst",
      detail: "Thursday, May 15 · 10:00am PST · 30 min video call · Calendar invite ready",
      time: "Now", done: false, requiresApproval: true,
      meetingBrief: {
        date: "Thursday, May 15, 2025",
        time: "10:00am PST",
        duration: "30 min",
        format: "Video call (Zoom)",
        investorBackground: "Niko Bonatsos is a General Partner at General Catalyst with a focus on AI-native infrastructure and developer tools. He led GC's investments in Hugging Face, Typeface, and Character.ai. He's known for asking founders to articulate the 'wedge' — the specific beachhead that makes expansion inevitable.",
        recentActivity: "Published an LP update last month on 'AI-native workflows replacing SaaS categories.' Spoke at SaaStr Annual about compounding moats in AI. Recently closed a $200M early-stage fund focused on AI infrastructure.",
        talkingPoints: [
          "Lead with the wedge: the specific customer segment where you win before expanding — Niko will ask about this first.",
          "Reference his Hugging Face thesis: you're building the infrastructure layer that makes AI models deployable, not just trainable.",
          "Quantify the moat: show how each customer makes your product better for the next (data flywheel, network effect, or switching cost).",
          "Be direct about the raise: $4M seed extension, 18-month runway, specific milestones that de-risk the Series A.",
          "Mention the LP update: acknowledge you read his recent thinking on AI-native workflows — shows you did your homework.",
        ],
        anticipatedQuestions: [
          { q: "Why can't an incumbent just build this?", a: "Incumbents are optimizing for their existing customer base. We're building for the next generation of AI-native teams — different workflow, different data model, different pricing. By the time they notice us, we'll have 3 years of proprietary training data they can't replicate." },
          { q: "What's your wedge? Where do you win first?", a: "[Your specific beachhead segment] — teams that [specific pain point]. We win here because [specific advantage]. From there, expansion to [adjacent segment] is natural because [reason]." },
          { q: "How does this get to $100M ARR?", a: "Current ACV is $X. At [X] customers in the wedge segment alone, that's $XM. The expansion motion into [adjacent segment] doubles TAM. We've modeled three paths to $100M — happy to walk through them." },
          { q: "Who else are you talking to?", a: "We're in conversations with a few funds. We'd prioritize GC given your AI-native thesis alignment and the Hugging Face portfolio synergy. We're not running a process — we're looking for the right partner." },
        ],
        coInvestors: [
          { name: "Sarah Chen", firm: "Sequoia Capital", overlap: "Also in conversations — Sequoia meeting is Friday. Niko and Sarah have co-invested twice (Typeface, Glean). Mentioning Sequoia interest may accelerate GC's decision." },
          { name: "Tomasz Tunguz", firm: "Theory Ventures", overlap: "Theory is data-infrastructure focused — strong thesis alignment. Niko respects Tomasz's technical diligence. If Theory is in, GC will take the signal seriously." },
        ],
        prepChecklist: [
          { item: "Review Niko's LP update on AI-native workflows", done: false },
          { item: "Prepare 3-slide deck: wedge → moat → raise", done: false },
          { item: "Know your exact MoM growth number for the last 3 months", done: false },
          { item: "Prepare the $100M ARR path in 3 scenarios", done: false },
          { item: "Test Zoom link and have backup dial-in ready", done: false },
          { item: "Send calendar confirmation reply to Niko's EA", done: false },
        ],
      },
    } as Milestone,
    { type: "outreach", investor: "Sarah Guo", firm: "Conviction Partners", text: "Outreach sent to Sarah Guo at Conviction", detail: "Sent to sarah@conviction.com · Leveraged co-investor signal with your existing lead", time: "11m ago", done: true, emailSentTo: "sarah@conviction.com", emailVariants: ["sarah@conviction.com", "sarah.guo@conviction.com", "s.guo@conviction.com", "pitches@conviction.com"], pitchBrief: { subject: "AI-native [vertical] — your portfolio companies are our customers", body: `Hi Sarah,

Conviction is the only fund I know that's 100% AI-focused, which is exactly why I wanted to reach out.

[Company] builds [one-line description]. Three of your portfolio companies are already using us as design partners — which means you'd be investing in infrastructure that strengthens your existing bets.

We're raising a $4M seed extension and would love Conviction's involvement given the portfolio overlap.

Worth a conversation?

[Founder]`, angle: "Conviction is AI-only — led with that alignment immediately. The portfolio overlap angle turns the pitch into a portfolio synergy story, not a cold ask. Kept it short because Sarah responds to density over length." } },
    { type: "response", investor: "Sarah Chen", firm: "Sequoia Capital", text: "Sarah Chen replied — wants to connect", detail: "\"Forwarded to my partner who covers this space. Expect a note from them shortly.\"", time: "14m ago", done: true },
    {
      id: 14, type: "meeting", investor: "Sarah Chen", firm: "Sequoia Capital",
      text: "Meeting request ready — Sequoia Capital Partner",
      detail: "Friday, May 16 · 2:00pm PST · 45 min intro call · Calendar invite ready",
      time: "15m ago", done: false, requiresApproval: true,
      meetingBrief: {
        date: "Friday, May 16, 2025",
        time: "2:00pm PST",
        duration: "45 min",
        format: "Video call (Google Meet)",
        investorBackground: "Sarah Chen is a Partner at Sequoia Capital focused on AI/ML infrastructure and enterprise SaaS. She led Sequoia's investments in Mosaic ML, Weights & Biases, and Scale AI. She's known for deep technical diligence — expect her to probe your architecture decisions and ask why you made specific technical tradeoffs.",
        recentActivity: "Wrote a widely-shared piece on 'The Infrastructure Layer Nobody Is Building.' Spoke at NeurIPS on enterprise AI adoption curves. Her Mosaic investment recently hit $1B valuation — she's actively looking for the next infrastructure bet.",
        talkingPoints: [
          "Lead with the technical insight: the non-obvious architectural decision that makes your approach 10x better, not just better.",
          "Reference her Mosaic bet: you're solving the deployment problem that Mosaic's customers face every day — you're complementary, not competitive.",
          "Show the data flywheel: every customer interaction makes your model smarter. Quantify how much better you get per 100 customers.",
          "Be specific about enterprise adoption: name the design partners, their use cases, and what they said when they saw the product for the first time.",
          "Acknowledge the technical risk head-on: Sequoia respects founders who know their own risks better than investors do.",
        ],
        anticipatedQuestions: [
          { q: "Why did you make [specific technical decision]? Why not [alternative approach]?", a: "We evaluated [alternative] early. The problem is [specific limitation]. Our approach trades [X] for [Y], which matters because our customers care more about [Y]. Here's the benchmark data." },
          { q: "What happens when OpenAI/Google builds this?", a: "They already tried — [specific product]. It failed because [reason]. The enterprise problem we're solving requires [specific capability] that hyperscalers structurally can't provide because [reason]. Our moat is [specific defensibility]." },
          { q: "Who are your design partners and what do they say?", a: "[Company 1], [Company 2], [Company 3]. [Company 1]'s CTO said [specific quote]. They're paying $[X]/month and have been live for [Y] months. NPS is [Z]." },
          { q: "What does the Series A look like?", a: "We're raising $4M now to hit [specific milestones] in 18 months. At that point, we'll have [X] paying customers, $[Y]M ARR, and [Z] as the Series A proof point. We're targeting a $20-25M Series A at that stage." },
        ],
        coInvestors: [
          { name: "Niko Bonatsos", firm: "General Catalyst", overlap: "GC meeting is Thursday — one day before Sequoia. Niko and Sarah have co-invested in Typeface. If GC moves fast, it could create positive pressure on Sequoia's timeline." },
          { name: "Stephanie Zhan", firm: "Sequoia", overlap: "Stephanie is Sarah's colleague at Sequoia focused on consumer AI. If Sarah wants a second opinion internally, Stephanie may be looped in. Be prepared for a two-partner call." },
        ],
        prepChecklist: [
          { item: "Read Sarah's 'Infrastructure Layer Nobody Is Building' piece", done: false },
          { item: "Prepare technical architecture diagram (1 slide)", done: false },
          { item: "Have benchmark data ready: your approach vs. alternatives", done: false },
          { item: "Prepare design partner quotes and usage metrics", done: false },
          { item: "Know your Series A milestones and timeline cold", done: false },
          { item: "Send calendar confirmation to Sarah's EA", done: false },
        ],
      },
    } as Milestone,
  ]; // end mock fallback

  useEffect(() => {
    // Space milestones evenly regardless of how many we have
    const baseDelays = [0, 600, 1100, 1700, 2300, 2900, 3700, 4400, 5200, 6100, 7000, 8000, 9200, 10500];
    const delays = MILESTONE_SEQUENCE.map((_, idx) => baseDelays[idx] ?? (10500 + idx * 1200));

    delays.forEach((delay, idx) => {
      if (idx >= MILESTONE_SEQUENCE.length) return;
      setTimeout(() => {
        setMilestones((prev) => [...prev, { ...MILESTONE_SEQUENCE[idx], id: (MILESTONE_SEQUENCE[idx] as any).id ?? idx + 1 }]);
        if (feedRef.current) {
          feedRef.current.scrollTop = feedRef.current.scrollHeight;
        }
      }, delay);
    });
  }, []);

  const handleApprove = (id: number) => {
    setApprovedMeetings((prev) => [...prev, id]);
    setMilestones((prev) =>
      prev.map((m) => m.id === id ? { ...m, done: true, requiresApproval: false } : m)
    );
    // Open pre-meeting brief if this milestone has one
    const milestone = milestones.find((m) => m.id === id);
    if (milestone?.meetingBrief) {
      setTimeout(() => setActiveMeetingBrief(milestone), 600);
    }
  };

  const pendingApprovals = milestones.filter((m) => m.requiresApproval && !approvedMeetings.includes(m.id));
  const bookedMeetings = milestones.filter((m) => m.type === "meeting" && approvedMeetings.includes(m.id));

  const iconMap = {
    match: <Zap size={13} />,
    pitch: <FileText size={13} />,
    outreach: <Send size={13} />,
    response: <Activity size={13} />,
    meeting: <CalendarCheck size={13} />,
    brief: <FileText size={13} />,
  };

  const colorMap = {
    match: "oklch(0.696 0.17 162.48)",
    pitch: "oklch(0.769 0.188 70.08)",
    outreach: "oklch(0.696 0.17 162.48)",
    response: "oklch(0.769 0.188 70.08)",
    meeting: "oklch(0.769 0.188 70.08)",
    brief: "oklch(0.696 0.17 162.48)",
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "oklch(0.13 0.01 264)" }}>
      {/* Header */}
      <div className="sticky top-0 z-20 border-b" style={{ backgroundColor: "oklch(0.13 0.01 264 / 0.95)", borderColor: "oklch(0.22 0.01 264)", backdropFilter: "blur(12px)" }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <PythiaAvatar size={36} pulse />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-base" style={{ color: "oklch(0.97 0.005 264)" }}>PYTHIA</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium animate-pulse"
                  style={{ backgroundColor: "oklch(0.696 0.17 162.48 / 0.15)", color: "oklch(0.696 0.17 162.48)", border: "1px solid oklch(0.696 0.17 162.48 / 0.3)" }}>
                  Running Pipeline
                </span>
              </div>
              <p className="text-xs font-mono" style={{ color: "oklch(0.5 0.01 264)" }}>{domain} · {Math.min(5, apiResult?.matches?.length || 5)} investors in pipeline</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {bookedMeetings.length > 0 && (
              <div className="flex items-center gap-1.5">
                <CalendarCheck size={14} style={{ color: "oklch(0.696 0.17 162.48)" }} />
                <span className="text-sm font-semibold" style={{ color: "oklch(0.696 0.17 162.48)" }}>
                  {bookedMeetings.length} meeting{bookedMeetings.length > 1 ? "s" : ""} booked
                </span>
              </div>
            )}
            {pendingApprovals.length > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg animate-pulse"
                style={{ backgroundColor: "oklch(0.769 0.188 70.08 / 0.15)", border: "1px solid oklch(0.769 0.188 70.08 / 0.3)" }}>
                <Bell size={13} style={{ color: "oklch(0.769 0.188 70.08)" }} />
                <span className="text-xs font-semibold" style={{ color: "oklch(0.769 0.188 70.08)" }}>
                  {pendingApprovals.length} approval{pendingApprovals.length > 1 ? "s" : ""} needed
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main feed */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3 mb-5">
              <div className="h-px flex-1" style={{ backgroundColor: "oklch(0.22 0.01 264)" }} />
              <span className="text-xs font-semibold tracking-widest" style={{ color: "oklch(0.5 0.01 264)" }}>LIVE ACTIVITY</span>
              <div className="h-px flex-1" style={{ backgroundColor: "oklch(0.22 0.01 264)" }} />
            </div>

            <div ref={feedRef} className="space-y-3 overflow-y-auto" style={{ maxHeight: "calc(100vh - 200px)" }}>
              {milestones.map((m) => {
                const isApproved = approvedMeetings.includes(m.id);
                const needsApproval = m.requiresApproval && !isApproved;
                const isHighlighted = !!(highlightInvestor && m.investor && m.investor === highlightInvestor);
                return (
                  <div key={m.id}
                    className="rounded-xl p-4 border transition-all duration-300"
                    style={{
                      backgroundColor: needsApproval
                        ? "oklch(0.769 0.188 70.08 / 0.06)"
                        : isHighlighted
                        ? "oklch(0.769 0.188 70.08 / 0.04)"
                        : "oklch(0.16 0.01 264)",
                      borderColor: needsApproval
                        ? "oklch(0.769 0.188 70.08 / 0.3)"
                        : isApproved
                        ? "oklch(0.696 0.17 162.48 / 0.2)"
                        : isHighlighted
                        ? "oklch(0.769 0.188 70.08 / 0.25)"
                        : "oklch(0.25 0.01 264)",
                      borderLeftColor: isHighlighted
                        ? "oklch(0.769 0.188 70.08)"
                        : undefined,
                      borderLeftWidth: isHighlighted ? 3 : undefined,
                    }}>
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5"
                        style={{ backgroundColor: `${colorMap[m.type].replace(')', ' / 0.12)')}`, color: colorMap[m.type] }}>
                        {iconMap[m.type]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium leading-snug" style={{ color: needsApproval ? "oklch(0.94 0.005 264)" : "oklch(0.8 0.005 264)" }}>
                            {m.text}
                          </p>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {(m.done || isApproved) && !needsApproval && (
                              <CheckCircle2 size={13} style={{ color: "oklch(0.696 0.17 162.48)" }} />
                            )}
                            <span className="text-xs" style={{ color: "oklch(0.4 0.01 264)" }}>{m.time}</span>
                          </div>
                        </div>
                        {m.detail && (
                          <p className="text-xs mt-1 leading-relaxed" style={{ color: "oklch(0.55 0.01 264)" }}>{m.detail}</p>
                        )}
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
                        {m.type === "outreach" && m.pitchBrief && (
                          <button
                            onClick={() => setPitchBriefMilestone(m)}
                            className="mt-2 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all duration-150"
                            style={{ color: "oklch(0.769 0.188 70.08)", backgroundColor: "oklch(0.769 0.188 70.08 / 0.08)", border: "1px solid oklch(0.769 0.188 70.08 / 0.25)" }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "oklch(0.769 0.188 70.08 / 0.14)"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "oklch(0.769 0.188 70.08 / 0.08)"; }}
                          >
                            <FileText size={11} />
                            View Pitch Brief
                          </button>
                        )}
                        {needsApproval && (
                          <div className="mt-3 flex items-center gap-3">
                            <button
                              onClick={() => handleApprove(m.id)}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200"
                              style={{ backgroundColor: "oklch(0.696 0.17 162.48)", color: "oklch(0.1 0.01 162)" }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 16px oklch(0.696 0.17 162.48 / 0.4)"; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
                            >
                              <CheckCircle2 size={13} />
                              Approve Meeting
                            </button>
                            <button className="text-xs px-3 py-2 rounded-lg transition-colors duration-150"
                              style={{ color: "oklch(0.5 0.01 264)", border: "1px solid oklch(0.25 0.01 264)" }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = "oklch(0.7 0.01 264)")}
                              onMouseLeave={(e) => (e.currentTarget.style.color = "oklch(0.5 0.01 264)")}
                            >
                              Reschedule
                            </button>
                            <button className="text-xs px-3 py-2 rounded-lg transition-colors duration-150"
                              style={{ color: "oklch(0.5 0.01 264)", border: "1px solid oklch(0.25 0.01 264)" }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = "oklch(0.7 0.01 264)")}
                              onMouseLeave={(e) => (e.currentTarget.style.color = "oklch(0.5 0.01 264)")}
                            >
                              Decline
                            </button>
                          </div>
                        )}
                        {isApproved && m.type === "meeting" && (
                          <div className="mt-2 flex items-center gap-1.5">
                            <CheckCircle2 size={12} style={{ color: "oklch(0.696 0.17 162.48)" }} />
                            <span className="text-xs font-medium" style={{ color: "oklch(0.696 0.17 162.48)" }}>
                              Meeting confirmed — calendar invite sent
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {milestones.length < MILESTONE_SEQUENCE.length && (
                <div className="flex items-center gap-3 py-3 px-4">
                  <Loader2 size={14} className="animate-spin" style={{ color: "oklch(0.696 0.17 162.48)" }} />
                  <span className="text-sm" style={{ color: "oklch(0.5 0.01 264)" }}>PYTHIA is working…</span>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Pipeline status */}
            <div className="rounded-xl p-4 border" style={{ backgroundColor: "oklch(0.16 0.01 264)", borderColor: "oklch(0.25 0.01 264)" }}>
              <p className="text-xs font-semibold tracking-widest mb-3" style={{ color: "oklch(0.5 0.01 264)" }}>PIPELINE STATUS</p>
              <div className="space-y-2.5">
                {[
                  { label: "Investors matched", value: "6 / 6", done: true },
                  { label: "Pitches prepared", value: `${Math.min(milestones.filter(m => m.type === "pitch").length, 6)} / 6`, done: milestones.filter(m => m.type === "pitch").length >= 6 },
                  { label: "Outreach sent", value: `${Math.min(milestones.filter(m => m.type === "outreach").length, 6)} / 6`, done: milestones.filter(m => m.type === "outreach").length >= 6 },
                  { label: "Responses received", value: `${milestones.filter(m => m.type === "response").length}`, done: false },
                  { label: "Meetings booked", value: `${bookedMeetings.length}`, done: bookedMeetings.length > 0 },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: "oklch(0.55 0.01 264)" }}>{item.label}</span>
                    <span className="text-xs font-mono font-semibold"
                      style={{ color: item.done ? "oklch(0.696 0.17 162.48)" : "oklch(0.65 0.01 264)" }}>
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Booked meetings */}
            {bookedMeetings.length > 0 && (
              <div className="rounded-xl p-4 border" style={{ backgroundColor: "oklch(0.696 0.17 162.48 / 0.06)", borderColor: "oklch(0.696 0.17 162.48 / 0.2)" }}>
                <p className="text-xs font-semibold tracking-widest mb-3" style={{ color: "oklch(0.696 0.17 162.48)" }}>CONFIRMED MEETINGS</p>
                <div className="space-y-3">
                  {bookedMeetings.map((m) => (
                    <div key={m.id} className="rounded-lg p-3 border" style={{ backgroundColor: "oklch(0.14 0.01 264)", borderColor: "oklch(0.696 0.17 162.48 / 0.2)" }}>
                      <div className="flex items-start gap-2 mb-2">
                        <CalendarCheck size={13} className="mt-0.5 flex-shrink-0" style={{ color: "oklch(0.696 0.17 162.48)" }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold" style={{ color: "oklch(0.9 0.005 264)" }}>{m.investor}</p>
                          <p className="text-xs" style={{ color: "oklch(0.55 0.01 264)" }}>{m.firm}</p>
                          <p className="text-xs mt-0.5" style={{ color: "oklch(0.696 0.17 162.48)" }}>{m.detail?.split("·")[0]?.trim()}</p>
                        </div>
                      </div>
                      {m.meetingBrief && (
                        <button
                          onClick={() => setActiveMeetingBrief(m)}
                          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                          style={{ backgroundColor: "oklch(0.769 0.188 70.08 / 0.12)", color: "oklch(0.769 0.188 70.08)", border: "1px solid oklch(0.769 0.188 70.08 / 0.25)" }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "oklch(0.769 0.188 70.08 / 0.2)"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "oklch(0.769 0.188 70.08 / 0.12)"; }}
                        >
                          <FileText size={11} />
                          View Pre-Meeting Brief
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PYTHIA message */}
            <div className="rounded-xl p-4 border" style={{ backgroundColor: "oklch(0.16 0.01 264)", borderColor: "oklch(0.25 0.01 264)" }}>
              <div className="flex items-center gap-2 mb-2">
                <PythiaAvatar size={20} />
                <span className="text-xs font-semibold" style={{ color: "oklch(0.94 0.005 264)" }}>PYTHIA</span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "oklch(0.6 0.01 264)" }}>
                {bookedMeetings.length === 0
                  ? "I'm running your pipeline. I'll notify you the moment a meeting is ready for your approval. You don't need to do anything."
                  : `You have ${bookedMeetings.length} confirmed meeting${bookedMeetings.length > 1 ? "s" : ""}. I'll send you a pre-meeting brief 24 hours before each call. Keep an eye on your inbox.`}
              </p>
            </div>
           </div>
        </div>
      </div>
      {/* Pitch Brief Modal */}
      {pitchBriefMilestone && (
        <PitchBriefModal
          milestone={pitchBriefMilestone}
          onClose={() => setPitchBriefMilestone(null)}
        />
      )}
      {/* Meeting Brief Modal */}
      {activeMeetingBrief && (
        <MeetingBriefModal
          milestone={activeMeetingBrief}
          onClose={() => setActiveMeetingBrief(null)}
        />
      )}
    </div>
  );
}
// ─── Main Flow ────────────────────────────────────────────────────────────────

export default function Activate() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  // tRPC subscription check — only used when user tries to activate pipeline
  const { data: subscription } = trpc.stripe.getSubscription.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  // Read sessionStorage once at mount to determine the initial step
  const [prefilledInvestor] = useState<{ name: string; firm: string; role: string; score: number } | null>(() => {
    try {
      const raw = sessionStorage.getItem("pythia_investor");
      if (raw) { sessionStorage.removeItem("pythia_investor"); return JSON.parse(raw); }
    } catch {}
    return null;
  });
  const [url, setUrl] = useState(() => {
    // Shared link: ?startup=https://company.com
    const params = new URLSearchParams(window.location.search);
    const sharedUrl = params.get("startup");
    if (sharedUrl) return sharedUrl;
    return sessionStorage.getItem("pythia_url") || "";
  });
  const [step, setStep] = useState<Step>(() => {
    if (prefilledInvestor) return "pipeline";
    // Shared link auto-starts scanning
    const params = new URLSearchParams(window.location.search);
    const sharedUrl = params.get("startup");
    if (sharedUrl) {
      sessionStorage.setItem("pythia_url", sharedUrl);
      return "scanning";
    }
    if (sessionStorage.getItem("pythia_url")) return "scanning";
    return "entry";
  });
  const [apiResult, setApiResult] = useState<ApiResult | null>(null);

  const handleUrlSubmit = (submittedUrl: string, submittedEmail: string) => {
    setUrl(submittedUrl);
    sessionStorage.setItem("pythia_url", submittedUrl);
    sessionStorage.setItem("pythia_email", submittedEmail);
    setStep("scanning");
  };

  const handleScanComplete = (result: ApiResult | null) => {
    setApiResult(result);
    // Clear sessionStorage so a component remount can't restart the scan.
    sessionStorage.removeItem("pythia_url");
    sessionStorage.removeItem("pythia_email");
    setStep("results");
  };

  /** Polling-triggered: re-fetch without busting the pipeline cache */
  const handleRefreshMatches = async () => {
    if (!url) return;
    try {
      const normalized = url.startsWith("http") ? url : `https://${url}`;
      const r = await fetch("/api/instant/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: normalized }),
      });
      const rawData = await r.json() as Record<string, unknown>;
      const result: ApiResult = {
        startup: (rawData.startup as ApiResult["startup"]) ?? null,
        matches: Array.isArray(rawData.matches) ? (rawData.matches as ApiResult["matches"]) : [],
        startup_id: (rawData.startup_id as string) ?? null,
        is_new: Boolean(rawData.is_new),
        gen_in_progress: Boolean(rawData.gen_in_progress),
      };
      if (result.matches.length > 0) {
        setApiResult(result);
      }
    } catch {
      // silently fail — stale data still shows
    }
  };

  /** User-initiated: force_generate=true so pipeline re-runs with fresh sector data */
  const handleForceRefreshMatches = async () => {
    if (!url) return;
    try {
      const normalized = url.startsWith("http") ? url : `https://${url}`;
      const r = await fetch("/api/instant/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: normalized, force_generate: true }),
      });
      const rawData = await r.json() as Record<string, unknown>;
      const result: ApiResult = {
        startup: (rawData.startup as ApiResult["startup"]) ?? null,
        matches: Array.isArray(rawData.matches) ? (rawData.matches as ApiResult["matches"]) : [],
        startup_id: (rawData.startup_id as string) ?? null,
        is_new: Boolean(rawData.is_new),
        gen_in_progress: Boolean(rawData.gen_in_progress),
      };
      if (result.matches.length > 0) {
        setApiResult(result);
      }
    } catch {
      // silently fail — stale data still shows
    }
  };

  const handleActivatePipeline = () => {
    const hasActivePlan =
      subscription?.status === "active" || subscription?.status === "trialing";
    if (!isAuthenticated || !hasActivePlan) {
      // Not subscribed — return to home so they can start the journey
      navigate("/");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setStep("pipeline");
  };

  return (
    <div style={{ backgroundColor: "oklch(0.13 0.01 264)", minHeight: "100vh" }}>
      {/* Back to home */}
      {(step === "entry" || step === "pipeline") && (
        <div className="fixed top-4 left-4 z-50">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg transition-colors duration-150"
            style={{ color: "oklch(0.5 0.01 264)", backgroundColor: "oklch(0.16 0.01 264)", border: "1px solid oklch(0.25 0.01 264)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "oklch(0.7 0.01 264)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "oklch(0.5 0.01 264)")}
          >
            <ArrowLeft size={12} />
            pythh.ai
          </button>
        </div>
      )}

      {/* Pre-filled investor banner — shown when arriving from hero panel */}
      {step === "pipeline" && prefilledInvestor && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium"
            style={{ backgroundColor: "oklch(0.769 0.188 70.08 / 0.15)", border: "1px solid oklch(0.769 0.188 70.08 / 0.4)", color: "oklch(0.769 0.188 70.08)", backdropFilter: "blur(12px)" }}>
            <span style={{ color: "oklch(0.769 0.188 70.08)" }}>⚡</span>
            PYTHIA activated for {prefilledInvestor.name} · {prefilledInvestor.firm} · Match {prefilledInvestor.score}
          </div>
        </div>
      )}

      {step === "entry" && <EntryStep onSubmit={handleUrlSubmit} />}
      {step === "scanning" && <ScanningStep url={url} onComplete={handleScanComplete} />}
      {step === "results" && <ResultsStep url={url} onActivate={handleActivatePipeline} apiResult={apiResult} onRefresh={handleRefreshMatches} onForceRefresh={handleForceRefreshMatches} />}
      {step === "pipeline" && <PipelineStep url={url} highlightInvestor={prefilledInvestor?.name} apiResult={apiResult} />}
    </div>
  );
}
