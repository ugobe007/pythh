/**
 * MERGE HELPERS
 * =============
 *
 * Strategies for merging API deltas into SurfaceViewModel without clobbering.
 * Delta merging prevents UI flicker and maintains animation state.
 * 
 * MERGE STRATEGY:
 * - Channels: Keyed merge by ID (update changed fields, preserve animation state)
 * - Feed: Prepend-only (no delete/modify, chronological order preserved)
 * - Radar events: Prepend-only (new events always bubble up)
 * - Panels: Atomic replace (full snapshot, not delta)
 * - pulseSeq: Never touched (UI-side animation only)
 */

import { ChannelState, FeedItem, RadarEvent, SurfaceViewModel } from "./types";

/**
 * Merge channel deltas: match by ID, apply delta, update timestamp
 * Preserves animation sequences by not resetting fields not in delta
 */
export function mergeChannels(existing: ChannelState[], deltas: ChannelState[]): ChannelState[] {
  const byId = new Map(existing.map((c) => [c.id, c]));

  for (const delta of deltas) {
    const ch = byId.get(delta.id);
    if (ch) {
      // Shallow merge: update changed fields only
      byId.set(delta.id, {
        ...ch,
        ...delta,
        lastUpdatedAt: new Date().toISOString(),
      });
      console.log(`[MERGE] Channel ${delta.id} updated`, { delta });
    } else {
      // New channel not in existing set
      byId.set(delta.id, { ...delta, lastUpdatedAt: new Date().toISOString() });
      console.log(`[MERGE] Channel ${delta.id} added (new)`, delta);
    }
  }

  return Array.from(byId.values());
}

/**
 * Merge feed: prepend new items, cap at 50
 * Feed is append-only (no deletes), chronological order preserved
 */
export function mergeFeed(existing: FeedItem[], newItems: FeedItem[]): FeedItem[] {
  const merged = [...newItems, ...existing].slice(0, 50);
  console.log(`[MERGE] Feed: ${newItems.length} new items added, total ${merged.length}`);
  return merged;
}

/**
 * Merge radar events: prepend new events, cap at 100
 * Events are append-only, newest first
 */
export function mergeRadarEvents(existing: RadarEvent[], newEvents: RadarEvent[]): RadarEvent[] {
  const merged = [...newEvents, ...existing].slice(0, 100);
  console.log(`[MERGE] Radar events: ${newEvents.length} new events, total ${merged.length}`);
  return merged;
}

/**
 * Merge radar arcs: prepend new arcs, cap at 12
 * Arcs represent investor clusters; newer ones take precedence
 */
export function mergeRadarArcs(
  existing: { id: string; strength: number }[],
  newArcs: { id: string; strength: number }[]
): { id: string; strength: number }[] {
  // Dedupe by ID: if arc already exists, keep latest strength
  const byId = new Map(existing.map((a) => [a.id, a]));
  for (const arc of newArcs) {
    byId.set(arc.id, arc); // Newer arc overwrites
  }
  const merged = Array.from(byId.values()).slice(0, 12);
  console.log(`[MERGE] Radar arcs: updated, total ${merged.length}`);
  return merged;
}

/**
 * Merge entire ViewModel delta into existing state
 * Used in tracking mode: only apply non-undefined fields
 * 
 * IMPORTANT: pulseSeq is NEVER touched (UI-only animation trigger)
 */
export function mergeViewModelDelta(
  current: SurfaceViewModel,
  delta: Partial<SurfaceViewModel>
): SurfaceViewModel {
  console.log("[MERGE] Applying delta", Object.keys(delta).filter(k => delta[k as keyof typeof delta] !== undefined));

  const next = { ...current };
  let changed = false;

  // Merge channels (if provided)
  if (delta.channels && delta.channels.length > 0) {
    next.channels = mergeChannels(next.channels, delta.channels);
    changed = true;
  }

  // Merge feed (if provided)
  if (delta.feed && delta.feed.length > 0) {
    next.feed = mergeFeed(next.feed, delta.feed);
    changed = true;
  }

  // Merge radar (if provided)
  if (delta.radar) {
    next.radar = { ...next.radar };
    if (delta.radar.events && delta.radar.events.length > 0) {
      next.radar.events = mergeRadarEvents(next.radar.events, delta.radar.events);
      changed = true;
    }
    if (delta.radar.arcs && delta.radar.arcs.length > 0) {
      next.radar.arcs = mergeRadarArcs(next.radar.arcs, delta.radar.arcs);
      changed = true;
    }
    if (delta.radar.phaseChange !== undefined) {
      next.radar.phaseChange = delta.radar.phaseChange;
      changed = true;
    }
    if (delta.radar.you !== undefined) {
      next.radar.you = delta.radar.you;
      changed = true;
    }
    if (delta.radar.sweepSpeed !== undefined) {
      next.radar.sweepSpeed = delta.radar.sweepSpeed;
      changed = true;
    }
  }

  // Merge panels (if provided) — atomically replace
  if (delta.panels !== undefined) {
    next.panels = delta.panels;
    changed = true;
  }

  // Merge nextMoves (if provided) — atomically replace
  if (delta.nextMoves !== undefined) {
    next.nextMoves = delta.nextMoves;
    changed = true;
  }

  // NOTE: pulseSeq and mode are NEVER merged from delta
  // They are UI-side state only

  console.log(`[MERGE] Complete (changed: ${changed})`);
  return next;
}

