/**
 * MODE CHOREOGRAPHY GUARDS & INVARIANTS
 * =====================================
 * 
 * Prevent invalid mode transitions and data inconsistencies.
 * Used by SignalRadarPage.tsx to gate state mutations.
 * 
 * Mode lifecycle: global → injecting → reveal → tracking → (back to global)
 * 
 * INVARIANTS:
 * - Channels frozen during injecting
 * - Panels only present in reveal/tracking
 * - Feed always populated
 * - Radar events only in reveal+
 */

import { SurfaceMode, SurfaceViewModel } from "./types";

/**
 * Valid mode transitions (guards state machine)
 */
export const VALID_TRANSITIONS: Record<SurfaceMode, SurfaceMode[]> = {
  global: ["injecting"],
  injecting: ["reveal"],
  reveal: ["tracking"],
  tracking: ["global"],
};

/**
 * Check if transition is allowed
 */
export function isValidModeTransition(from: SurfaceMode, to: SurfaceMode): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Invariant: Channels frozen during injecting
 * (prevents flicker from updates during startup identity resolution)
 */
export function channelsFrozenDuring(mode: SurfaceMode): boolean {
  return mode === "injecting";
}

/**
 * Invariant: Panels only present in reveal/tracking
 */
export function panelsAllowedIn(mode: SurfaceMode): boolean {
  return mode === "reveal" || mode === "tracking";
}

/**
 * Invariant: Radar events only in reveal+
 */
export function radarEventsAllowedIn(mode: SurfaceMode): boolean {
  return mode === "reveal" || mode === "tracking";
}

/**
 * Verify all invariants for a given ViewModel
 * Returns { isValid: boolean, violations: string[] }
 */
export function checkModeInvariants(vm: SurfaceViewModel): {
  isValid: boolean;
  violations: string[];
} {
  const violations: string[] = [];

  // Invariant 1: Feed always has items
  if (!vm.feed || vm.feed.length === 0) {
    violations.push("Feed must never be empty");
  }

  // Invariant 2: Startup identity required after injecting
  if ((vm.mode === "reveal" || vm.mode === "tracking") && !vm.startup) {
    violations.push(`Startup identity required in ${vm.mode} mode`);
  }

  // Invariant 3: Panels only in reveal/tracking
  if (!panelsAllowedIn(vm.mode) && vm.panels) {
    violations.push(`Panels not allowed in ${vm.mode} mode`);
  }

  // Invariant 4: Radar events only in reveal+
  if (!radarEventsAllowedIn(vm.mode) && vm.radar.events.length > 0) {
    violations.push(`Radar events not allowed in ${vm.mode} mode`);
  }

  // Invariant 5: Mode is valid
  const validModes: SurfaceMode[] = ["global", "injecting", "reveal", "tracking"];
  if (!validModes.includes(vm.mode)) {
    violations.push(`Invalid mode: ${vm.mode}`);
  }

  return {
    isValid: violations.length === 0,
    violations,
  };
}

/**
 * Guard: Can channel be updated in this mode?
 * Returns false during injecting (frozen state)
 */
export function canUpdateChannels(mode: SurfaceMode): boolean {
  return mode !== "injecting";
}

/**
 * Guard: Can feed be updated in this mode?
 * Always allowed (feed is append-only during all modes)
 */
export function canUpdateFeed(mode: SurfaceMode): boolean {
  return true;
}

/**
 * Guard: Can radar be updated in this mode?
 * Only in reveal and tracking (not during global/injecting setup)
 */
export function canUpdateRadar(mode: SurfaceMode): boolean {
  return mode === "reveal" || mode === "tracking";
}

/**
 * Logging helper for mode transitions
 */
export function logModeTransition(from: SurfaceMode, to: SurfaceMode, reason: string) {
  const valid = isValidModeTransition(from, to);
  const status = valid ? "✓" : "✗ INVALID";
  console.log(
    `[MODE] ${status} ${from} → ${to} | ${reason}`
  );
  return valid;
}

/**
 * Concurrency safety: Check if an operation is safe to execute
 * given current mode and pending operations
 */
export interface ConcurrencyContext {
  mode: SurfaceMode;
  inFlight: boolean; // Any API call pending?
  timersPending: number; // How many timeouts scheduled?
}

export function canExecuteOperation(ctx: ConcurrencyContext, operationType: "api" | "timer" | "sync"): boolean {
  // Block concurrent API calls
  if (operationType === "api" && ctx.inFlight) {
    console.warn("[GUARD] Blocking concurrent API call");
    return false;
  }

  // Block mode transitions during injecting (channels frozen)
  if (ctx.mode === "injecting" && operationType === "sync") {
    // Allow sync within injecting (e.g., feed updates), just not transitions
    return true;
  }

  return true;
}
