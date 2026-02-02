import { ChannelState, FeedItem, RadarEvent, StartupIdentity, SurfaceMode, SurfaceViewModel } from "./types";

const CHANNELS: { id: string; label: string }[] = [
  { id: "grit", label: "Grit" },
  { id: "opportunity", label: "Opportunity" },
  { id: "determination", label: "Determination" },
  { id: "velocity", label: "Velocity" },
  { id: "goldilocks", label: "Goldilocks" },
  { id: "capital_flow", label: "Capital Flow" },
  { id: "fomo", label: "FOMO" },
  { id: "talent", label: "Talent" },
  { id: "customers", label: "Customers" },
  { id: "media", label: "Media" },
  { id: "product", label: "Product" },
  { id: "hiring", label: "Hiring" },
  { id: "competition", label: "Competition" },
  { id: "regulatory", label: "Regulatory" },
  { id: "infrastructure", label: "Infrastructure" },
  { id: "signal_power", label: "Signal Power" },
  { id: "alignment", label: "Alignment" },
  { id: "pressure", label: "Pressure" },
];

function isoNow() {
  return new Date().toISOString();
}

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

function dir(delta: number): ChannelState["direction"] {
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return "flat";
}

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function pick<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

export function makeInitialVM(): SurfaceViewModel {
  const channels: ChannelState[] = CHANNELS.map((c) => {
    const value = Math.round(rand(35, 75));
    const delta = Math.round(rand(-3, 6));
    return {
      id: c.id,
      label: c.label,
      value: clamp(value),
      delta,
      direction: dir(delta),
      volatility: rand(0.2, 0.9),
      lastUpdatedAt: isoNow(),
      confidence: rand(0.6, 0.95),
    };
  });

  return {
    mode: "global",
    channels,
    radar: {
      sweepSpeed: 1.0,
      events: [],
      arcs: [],
      phaseChange: null,
    },
    feed: [],
    pulseSeq: 0,
  };
}

// Tiny semantic "event templates" (maps to channel deltas)
const EVENT_TEMPLATES = [
  {
    text: "Senior hire detected → Talent +6, Velocity +3",
    impacts: [
      { channelId: "talent", delta: 6 },
      { channelId: "velocity", delta: 3 },
      { channelId: "determination", delta: 2 },
    ],
  },
  {
    text: "Enterprise customer detected → Opportunity +9, Customers +8",
    impacts: [
      { channelId: "opportunity", delta: 9 },
      { channelId: "customers", delta: 8 },
      { channelId: "goldilocks", delta: 3 },
    ],
  },
  {
    text: "Tier-1 press mention → Media +7, FOMO +4",
    impacts: [
      { channelId: "media", delta: 7 },
      { channelId: "fomo", delta: 4 },
      { channelId: "capital_flow", delta: 2 },
    ],
  },
  {
    text: "Product launch detected → Product +6, Velocity +4",
    impacts: [
      { channelId: "product", delta: 6 },
      { channelId: "velocity", delta: 4 },
      { channelId: "determination", delta: 2 },
    ],
  },
  {
    text: "Competitive launch → Competition +6, Pressure −4",
    impacts: [
      { channelId: "competition", delta: 6 },
      { channelId: "pressure", delta: -4 },
      { channelId: "opportunity", delta: -2 },
    ],
  },
  {
    text: "Investor attention spike → Alignment +3, FOMO +2",
    impacts: [
      { channelId: "alignment", delta: 3 },
      { channelId: "fomo", delta: 2 },
    ],
  },
];

export function normalizeUrl(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, url: "", reason: "empty" as const };

  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withProto);
    if (!u.hostname || u.hostname.length < 3) return { ok: false, url: "", reason: "bad_host" as const };
    u.hash = "";
    return { ok: true, url: u.toString(), reason: "" as const };
  } catch {
    return { ok: false, url: "", reason: "invalid" as const };
  }
}

export function fakeResolveStartup(url: string): StartupIdentity {
  const host = new URL(url).hostname.replace(/^www\./, "");
  const name = host.split(".")[0];
  const initials = name.slice(0, 2).toUpperCase();
  return {
    id: makeId("st"),
    name: name.charAt(0).toUpperCase() + name.slice(1),
    initials,
    category: pick(["Robotics Infrastructure", "Fintech Infra", "Energy Storage", "Developer Tools", "AI Ops"]),
    stage: pick(["Seed", "Late Seed", "Series A Prep"]),
  };
}

function applyImpacts(channels: ChannelState[], impacts: { channelId: string; delta: number }[]) {
  const now = isoNow();
  const byId = new Map(channels.map((c) => [c.id, c]));
  for (const imp of impacts) {
    const ch = byId.get(imp.channelId);
    if (!ch) continue;
    const newValue = clamp(ch.value + imp.delta);
    ch.delta = imp.delta;
    ch.direction = dir(imp.delta);
    ch.value = newValue;
    ch.lastUpdatedAt = now;
    ch.confidence = clamp(ch.confidence * 100 + rand(-2, 2), 55, 98) / 100;
  }
  return channels;
}

function decayDeltas(channels: ChannelState[]) {
  // slowly relax deltas toward 0 so spikes feel transient
  for (const c of channels) {
    if (c.delta === 0) continue;
    c.delta = Math.abs(c.delta) <= 1 ? 0 : Math.round(c.delta * 0.6);
    c.direction = dir(c.delta);
  }
}

function derivePanels(vm: SurfaceViewModel) {
  // Minimal fake derived panels that "move" believably.
  const alignment = vm.channels.find((c) => c.id === "alignment")?.value ?? 50;
  const velocity = vm.channels.find((c) => c.id === "velocity")?.value ?? 50;
  const goldilocks = vm.channels.find((c) => c.id === "goldilocks")?.value ?? 50;

  const power = Math.round((alignment * 0.2 + velocity * 0.3 + goldilocks * 0.2 + rand(40, 80) * 0.3));
  const powerDelta = Math.round(rand(-2, 6));

  const windowScore = Math.round((velocity * 0.45 + goldilocks * 0.35 + alignment * 0.2));
  const state =
    windowScore > 78 ? "peak" :
    windowScore > 66 ? "open" :
    windowScore > 56 ? "opening" :
    windowScore > 46 ? "closing" : "closed";

  const startDays = state === "opening" ? 21 : state === "open" ? 10 : state === "peak" ? 7 : 35;
  const endDays = state === "opening" ? 38 : state === "open" ? 28 : state === "peak" ? 21 : 60;

  const alignCount = Math.round(clamp((alignment - 30) / 3, 0, 40));
  const alignDelta = Math.round(rand(-1, 3));

  vm.panels = {
    fundraisingWindow: { state, startDays, endDays },
    alignment: { count: alignCount, delta: alignDelta },
    power: { score: clamp(power), delta: powerDelta, percentile: clamp(Math.round((power / 100) * 100), 1, 99) },
  };

  vm.nextMoves = {
    items: [
      { text: "Hire a senior engineer", impacts: [{ channelId: "talent", delta: 6 }, { channelId: "velocity", delta: 3 }] },
      { text: "Publish a product update", impacts: [{ channelId: "media", delta: 5 }, { channelId: "product", delta: 3 }] },
      { text: "Close an enterprise customer", impacts: [{ channelId: "opportunity", delta: 9 }, { channelId: "customers", delta: 8 }] },
    ],
  };
}

export function tick(vm: SurfaceViewModel): SurfaceViewModel {
  // Heartbeat pulse: always increments to trigger micro-jitter
  vm.pulseSeq += 1;

  // Baseline delta decay
  decayDeltas(vm.channels);

  // Occasionally inject a semantic event (global or tracking)
  const shouldEvent = Math.random() < (vm.mode === "tracking" ? 0.55 : 0.35);
  if (shouldEvent) {
    const tmpl = pick(EVENT_TEMPLATES);

    // Apply channel impacts
    applyImpacts(vm.channels, tmpl.impacts);

    // Shared ID for feed item and radar event (enables hover linkage)
    const sharedId = makeId("ev");

    // Feed item
    const fi: FeedItem = {
      id: sharedId,
      text: tmpl.text,
      timestamp: isoNow(),
      confidence: rand(0.72, 0.93),
      impacts: tmpl.impacts.map((x) => ({ channelId: x.channelId, delta: x.delta })),
    };
    vm.feed = [fi, ...vm.feed].slice(0, 30);

    // Radar event
    const re: RadarEvent = {
      id: sharedId,
      type: tmpl.impacts.some((i) => i.channelId === "alignment") ? "alignment" : "ingestion",
      magnitude: rand(0.35, 0.85),
      timestamp: isoNow(),
      channelImpacts: tmpl.impacts.map((x) => ({ channelId: x.channelId, delta: x.delta })),
    };
    vm.radar.events = [re, ...vm.radar.events].slice(0, 50);

    // Arc on alignment deltas
    if (tmpl.impacts.some((i) => i.channelId === "alignment" && i.delta >= 2)) {
      vm.radar.arcs = [{ id: makeId("arc"), strength: rand(0.45, 0.9) }, ...vm.radar.arcs].slice(0, 8);
    }

    // Rare phase change
    if (Math.random() < 0.08) {
      vm.radar.phaseChange = { id: makeId("pc"), magnitude: rand(0.45, 0.9), timestamp: isoNow() };
      vm.radar.events = [
        {
          id: makeId("re"),
          type: "phase_change" as const,
          magnitude: vm.radar.phaseChange.magnitude,
          timestamp: vm.radar.phaseChange.timestamp,
          channelImpacts: [{ channelId: "goldilocks", delta: 2 }],
        },
        ...vm.radar.events,
      ].slice(0, 50);
    } else {
      vm.radar.phaseChange = null;
    }
  }

  // Sweep speed based on mode
  vm.radar.sweepSpeed = vm.mode === "injecting" ? 1.8 : 1.0;

  // Panels only in reveal/tracking (keeps global clean)
  if (vm.mode === "reveal" || vm.mode === "tracking") derivePanels(vm);

  return { ...vm };
}

export function setMode(vm: SurfaceViewModel, mode: SurfaceMode): SurfaceViewModel {
  vm.mode = mode;
  return { ...vm };
}
