import type { ChannelState, FeedItem, SurfaceViewModel } from "./types";

export type MacroShift = {
  id: string;
  sector: string;
  beliefShift: string; // "Accelerating" | "Emerging" | ...
  badge?: "UP" | "DOWN" | "FLAT";
  impacts: { channelId: string; label: string; delta: number }[];
  why: string[];
};

const SECTORS = ["Vertical AI", "Biotech", "Climate Tech", "Robotics Infra", "Fintech Infra", "Developer Tools"] as const;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function pick<T>(arr: readonly T[], seed: number) {
  const i = Math.abs(Math.floor(seed)) % arr.length;
  return arr[i];
}

function scoreChannel(c: ChannelState) {
  // prioritizes "recent movement" (delta) and high confidence
  return Math.abs(c.delta) * 2 + c.value * 0.015 + c.confidence * 0.6;
}

function topMovingChannels(channels: ChannelState[], k = 4) {
  return [...channels]
    .sort((a, b) => scoreChannel(b) - scoreChannel(a))
    .slice(0, k);
}

function beliefFromEnergy(energy: number) {
  if (energy >= 10) return "Surging";
  if (energy >= 7) return "Accelerating";
  if (energy >= 4) return "Opening";
  if (energy >= 1) return "Emerging";
  if (energy <= -6) return "Cooling";
  if (energy <= -2) return "Softening";
  return "Stable";
}

function badgeFromEnergy(energy: number): "UP" | "DOWN" | "FLAT" {
  if (energy > 1.5) return "UP";
  if (energy < -1.5) return "DOWN";
  return "FLAT";
}

function channelLabel(chId: string, channels: ChannelState[]) {
  return channels.find((c) => c.id === chId)?.label ?? chId.replace(/_/g, " ");
}

function deriveWhy(feed: FeedItem[], sector: string, impacts: { channelId: string; delta: number }[]) {
  // turn recent feed into "why" bullets; keep it short and causal
  const bullets: string[] = [];

  const recent = feed.slice(0, 8).map((f) => f.text);
  const add = (s: string) => {
    if (bullets.length >= 3) return;
    if (!bullets.includes(s)) bullets.push(s);
  };

  // Prefer text that matches impacted channels
  const ids = new Set(impacts.map((i) => i.channelId));
  for (const t of recent) {
    const tl = t.toLowerCase();
    if ([...ids].some((id) => tl.includes(id.replace(/_/g, " ")))) add(t.replace(/^•?\s*/g, ""));
    if (bullets.length >= 3) break;
  }

  // Fill if needed with sector-specific "macro explainers"
  if (bullets.length < 3) {
    const macro = [
      `${sector}: investor mandate language shifted this week`,
      `${sector}: comparable deal velocity changed (pricing + round size)`,
      `${sector}: founder narrative density increased (press + hiring + launches)`,
    ];
    for (const b of macro) add(b);
  }

  return bullets.slice(0, 3);
}

export function buildMacroShifts(vm: SurfaceViewModel, seedKey?: string): MacroShift[] {
  const channels = vm.channels ?? [];
  const feed = vm.feed ?? [];

  const seedBase =
    (seedKey?.split("").reduce((a, c) => a + c.charCodeAt(0), 0) ?? 1234) +
    (vm.panels?.power?.score ?? 50) +
    (vm.pulseSeq ?? 0);

  const movers = topMovingChannels(channels, 5);

  // Energy is aggregate signed movement from top movers
  const signedEnergy = movers.reduce((sum, c, i) => sum + c.delta * (i < 2 ? 1.4 : 1.0), 0);
  const belief = beliefFromEnergy(signedEnergy);
  const badge = badgeFromEnergy(signedEnergy);

  // Pick 3 sectors deterministically-ish so it doesn't jump wildly
  const s1 = pick(SECTORS, seedBase * 1.11);
  const s2 = pick(SECTORS, seedBase * 2.07);
  const s3 = pick(SECTORS, seedBase * 3.01);
  const uniq = Array.from(new Set([s1, s2, s3])).slice(0, 3) as string[];
  while (uniq.length < 3) uniq.push(pick(SECTORS, seedBase + uniq.length * 9.3) as string);

  // Build 3 cards: each takes 3 channel impacts (scaled slightly)
  const cards = uniq.map((sector, idx) => {
    const base = movers.slice(idx, idx + 3).length ? movers.slice(idx, idx + 3) : movers.slice(0, 3);
    const impacts = base.map((c) => ({
      channelId: c.id,
      label: channelLabel(c.id, channels),
      delta: clamp(Math.round(c.delta * (idx === 0 ? 1.0 : idx === 1 ? 0.9 : 0.8)), -12, 12),
    }));

    // Sector-specific bias: nudge language based on strongest channel
    const strongest = impacts[0]?.label?.toLowerCase() ?? "";
    const beliefShift =
      strongest.includes("velocity") || strongest.includes("product") ? "Accelerating" :
      strongest.includes("capital") || strongest.includes("alignment") ? "Opening" :
      strongest.includes("pressure") || strongest.includes("competition") ? "Cooling" :
      belief;

    return {
      id: makeId("ms"),
      sector,
      beliefShift,
      badge,
      impacts,
      why: deriveWhy(feed, sector, impacts.map((i) => ({ channelId: i.channelId, delta: i.delta }))),
    } satisfies MacroShift;
  });

  return cards;
}
