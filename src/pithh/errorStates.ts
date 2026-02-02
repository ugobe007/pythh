/**
 * GRACEFUL ERROR STATES
 * =====================
 *
 * Three failure modes that must be beautiful (not blank screens):
 * 1. Resolve failed → feed item + stay in global
 * 2. Scan failed → feed item + show error panel in right rail
 * 3. Tracking degraded → keep last state, show pause notice, auto-resume on success
 *
 * Philosophy: The radar is always alive, never blank.
 */

import { SurfaceViewModel, FeedItem } from "./types";

export type ErrorMode = "resolve-failed" | "scan-failed" | "tracking-degraded" | "none";

export interface ErrorState {
  mode: ErrorMode;
  message: string;
  recoverable: boolean; // Can user retry?
  timestamp: string;
}

export function makeErrorState(mode: ErrorMode, message: string): ErrorState {
  return {
    mode,
    message,
    recoverable: mode === "resolve-failed" || mode === "scan-failed" || mode === "tracking-degraded",
    timestamp: new Date().toISOString(),
  };
}

/**
 * Resolve failed: stayed in global mode, show feed item
 */
export function handleResolveFailed(vm: SurfaceViewModel, reason: string): SurfaceViewModel {
  const next = { ...vm };
  next.feed = [
    {
      id: `err_resolve_${Date.now()}`,
      text: `Failed to resolve startup: ${reason}. Try another URL.`,
      timestamp: new Date().toISOString(),
      confidence: 1.0,
      impacts: [],
    },
    ...next.feed,
  ].slice(0, 30);

  // Stay in global mode, don't transition
  return next;
}

/**
 * Scan failed: transition to reveal but show error in right rail
 * (panels will show error state instead of real data)
 */
export function handleScanFailed(vm: SurfaceViewModel, reason: string): SurfaceViewModel {
  const next = { ...vm };

  // Show error feed item
  next.feed = [
    {
      id: `err_scan_${Date.now()}`,
      text: `Scan failed: ${reason}. Check signal and try again.`,
      timestamp: new Date().toISOString(),
      confidence: 1.0,
      impacts: [],
    },
    ...next.feed,
  ].slice(0, 30);

  // Set error panel (right rail will render error instead of real panels)
  next.panels = {
    fundraisingWindow: { state: "closed" as const, startDays: 0, endDays: 0 },
    alignment: { count: 0, delta: 0 },
    power: { score: 0, delta: 0 },
  };

  return next;
}

/**
 * Tracking degraded: keep last known state, show pause notice
 */
export function handleTrackingDegraded(
  vm: SurfaceViewModel,
  reason: string,
  isRetrying: boolean
): SurfaceViewModel {
  const next = { ...vm };

  // Add notice to feed (but keep all other state intact)
  const message = isRetrying
    ? `Tracking paused (${reason}). Retrying…`
    : `Tracking paused (${reason}). Tap to resume.`;

  next.feed = [
    {
      id: `err_tracking_${Date.now()}`,
      text: message,
      timestamp: new Date().toISOString(),
      confidence: 0.9,
      impacts: [],
    },
    ...next.feed,
  ].slice(0, 30);

  // Mode stays 'tracking', no transition
  return next;
}

/**
 * Tracking recovered: remove pause notice, resume normal updates
 */
export function handleTrackingRecovered(vm: SurfaceViewModel): SurfaceViewModel {
  const next = { ...vm };

  // Remove the pause notice from feed
  next.feed = next.feed.filter((item) => !item.id.startsWith("err_tracking_"));

  // Add recovery notice
  next.feed = [
    {
      id: `err_tracking_recovered_${Date.now()}`,
      text: "Tracking resumed.",
      timestamp: new Date().toISOString(),
      confidence: 1.0,
      impacts: [],
    },
    ...next.feed,
  ].slice(0, 30);

  return next;
}

/**
 * Feed helper: create error feed item
 */
export function createErrorFeedItem(message: string, confidence = 0.9): FeedItem {
  return {
    id: `err_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    text: message,
    timestamp: new Date().toISOString(),
    confidence,
    impacts: [],
  };
}

/**
 * UI panel for errors (shown in RightRail when error occurs)
 */
export interface ErrorPanel {
  title: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function makeResolveFailed(reason: string): ErrorPanel {
  return {
    title: "Resolve Failed",
    message: `Could not identify startup: ${reason}`,
    action: {
      label: "Try Another URL",
      onClick: () => {}, // handled by caller
    },
  };
}

export function makeScanFailed(reason: string): ErrorPanel {
  return {
    title: "Scan Failed",
    message: `Investor alignment scan could not complete: ${reason}`,
    action: {
      label: "Retry Scan",
      onClick: () => {}, // handled by caller
    },
  };
}

export function makeTrackingDegraded(reason: string): ErrorPanel {
  return {
    title: "Tracking Paused",
    message: `Live tracking paused: ${reason}. Will auto-resume when connection restored.`,
    action: {
      label: "Try Now",
      onClick: () => {}, // handled by caller
    },
  };
}
