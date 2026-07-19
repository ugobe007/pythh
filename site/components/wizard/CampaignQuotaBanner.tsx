/**
 * Campaign quota meter + upgrade prompt on Outreach tab.
 */

import { Link } from "wouter";
import { ArrowRight, Sparkles, Zap } from "lucide-react";
import { ORACLE_PLAN, SCOUT_PLAN } from "@/lib/pricingPlans";

export interface CampaignQuota {
  plan: string;
  active_count: number;
  campaign_limit: number | null;
  investors_per_campaign: number | null;
  slots_remaining: number | null;
  current_startup_active: boolean;
  can_activate: boolean;
  at_limit: boolean;
  upgrade_plan: string | null;
  message: string | null;
  estimated_monthly_touches: number | null;
}

interface Props {
  quota: CampaignQuota | null;
  onUpgradeClick?: () => void;
}

export default function CampaignQuotaBanner({ quota, onUpgradeClick }: Props) {
  if (!quota) return null;

  const limit = quota.campaign_limit;
  const used = quota.active_count;
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const planLabel =
    quota.plan === "oracle" ? "Oracle" : quota.plan === "scout" ? "Scout" : "Free";

  if (quota.plan === "none") {
    return (
      <div
        className="rounded-xl p-4 mb-4"
        style={{ backgroundColor: "oklch(0.696 0.17 162.48 / 0.08)", border: "1px solid oklch(0.696 0.17 162.48 / 0.3)" }}
      >
        <p className="text-xs font-semibold mb-1" style={{ color: "#22d3ee" }}>
          Automate outreach with PYTHIA
        </p>
        <p className="text-xs leading-relaxed mb-3" style={{ color: "oklch(0.55 0.01 264)" }}>
          {quota.message ||
            `Scout includes ${SCOUT_PLAN.outreachCampaigns} campaigns (~${SCOUT_PLAN.outreachCampaigns! * (SCOUT_PLAN.investorsPerCampaign as number)} automated touches/mo). Start your 14-day trial.`}
        </p>
        <Link href="/pricing" onClick={onUpgradeClick}>
          <span
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold"
            style={{ background: "#22c55e", color: "#0a0a0a" }}
          >
            <Sparkles size={14} />
            Start Scout trial — $19/mo
            <ArrowRight size={14} />
          </span>
        </Link>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl p-4 mb-4"
      style={{
        backgroundColor: quota.at_limit ? "oklch(0.769 0.188 70.08 / 0.06)" : "oklch(0.12 0.01 264)",
        border: `1px solid ${quota.at_limit ? "oklch(0.769 0.188 70.08 / 0.35)" : "oklch(0.2 0.01 264)"}`,
      }}
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <Zap size={14} style={{ color: "oklch(0.696 0.17 162.48)" }} />
          <p className="text-xs font-semibold" style={{ color: "oklch(0.88 0.005 264)" }}>
            {planLabel} · outreach campaigns
          </p>
        </div>
        {limit != null && (
          <p className="text-xs font-mono tabular-nums" style={{ color: "oklch(0.55 0.01 264)" }}>
            {used} / {limit} active
          </p>
        )}
      </div>

      {limit != null && (
        <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ backgroundColor: "oklch(0.18 0.01 264)" }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${pct}%`,
              backgroundColor: quota.at_limit ? "#facc15" : "#22c55e",
            }}
          />
        </div>
      )}

      <p className="text-[11px] leading-relaxed" style={{ color: "oklch(0.5 0.01 264)" }}>
        {quota.current_startup_active
          ? "This startup has an active PYTHIA campaign."
          : quota.slots_remaining != null && quota.slots_remaining > 0
            ? `${quota.slots_remaining} campaign slot${quota.slots_remaining === 1 ? "" : "s"} remaining on your plan.`
            : quota.message}
        {quota.investors_per_campaign
          ? ` · Up to ${quota.investors_per_campaign} investors per campaign.`
          : quota.plan === "oracle"
            ? " · Unlimited investors per campaign."
            : null}
      </p>

      {quota.at_limit && quota.upgrade_plan === "oracle" && (
        <Link href="/pricing" className="block mt-3" onClick={onUpgradeClick}>
          <span
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold"
            style={{ background: "oklch(0.769 0.188 70.08)", color: "#0a0a0a" }}
          >
            Upgrade to Oracle — {ORACLE_PLAN.outreachCampaigns} campaigns · $49/mo
            <ArrowRight size={14} />
          </span>
        </Link>
      )}
    </div>
  );
}
