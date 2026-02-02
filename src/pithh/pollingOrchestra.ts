/**
 * POLLING ORCHESTRATION
 * ======================
 *
 * Cursor-based polling with exponential backoff + merge rules
 * Used in tracking mode for live observatory updates
 *
 * Rules:
 * - Only poll in tracking mode
 * - Poll interval: 2s default
 * - Backoff: 2s → 4s → 8s → 16s (cap 15s)
 * - Never poll concurrently (inFlightRef gate)
 * - Merge rules: strict (channels keyed, feed prepend-only, etc.)
 * - Cursor must be monotonic (warn if duplicate)
 */

export interface PollState {
  lastCursor: string | null;
  retryCount: number;
  nextRetryDelay: number; // milliseconds
  lastError: string | null;
  paused: boolean; // If true, don't poll until user resumes
}

export function makeInitialPollState(): PollState {
  return {
    lastCursor: null,
    retryCount: 0,
    nextRetryDelay: 2000, // Start at 2s
    lastError: null,
    paused: false,
  };
}

/**
 * Backoff calculation: exponential with cap
 * 2s → 4s → 8s → 16s (cap 15s)
 */
export function calculateBackoff(retryCount: number): number {
  const base = 2000; // 2s
  const delay = Math.min(base * Math.pow(2, retryCount), 15000); // cap 15s
  return delay;
}

/**
 * Cursor validation
 * Returns { valid: boolean, issue: string | null }
 */
export function validateCursor(
  newCursor: string | null,
  lastCursor: string | null
): { valid: boolean; issue: string | null } {
  // Cursor can be null on first poll
  if (!newCursor) {
    return { valid: true, issue: null };
  }

  // Cursor must not regress (monotonic check)
  if (lastCursor === newCursor) {
    return { valid: false, issue: "Cursor duplicate (no progress)" };
  }

  // Basic sanity: cursor should look like a timestamp or sequence
  // This is a basic check; backend contract defines exact format
  if (newCursor.length < 5) {
    return { valid: false, issue: "Cursor suspiciously short" };
  }

  return { valid: true, issue: null };
}

/**
 * Merge rules enforcer
 * Validates that incoming delta respects merge semantics
 */
export interface MergeValidation {
  valid: boolean;
  warnings: string[];
}

export function validateMergeDelta(delta: any): MergeValidation {
  const warnings: string[] = [];

  // Check: channels must be array of updates (not full replacement)
  if (delta.channels && !Array.isArray(delta.channels)) {
    warnings.push("Channels should be array, not object");
  }

  // Check: feed items must be chronologically correct
  if (delta.feed && Array.isArray(delta.feed)) {
    for (let i = 1; i < delta.feed.length; i++) {
      const prev = delta.feed[i - 1];
      const curr = delta.feed[i];
      if (new Date(prev.timestamp) < new Date(curr.timestamp)) {
        warnings.push(`Feed item ${i} out of order (should be newest first)`);
      }
    }
  }

  // Check: radar events must be newest first
  if (delta.radar?.events && Array.isArray(delta.radar.events)) {
    for (let i = 1; i < delta.radar.events.length; i++) {
      const prev = delta.radar.events[i - 1];
      const curr = delta.radar.events[i];
      if (new Date(prev.timestamp) < new Date(curr.timestamp)) {
        warnings.push(`Radar event ${i} out of order`);
      }
    }
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}

/**
 * Poll result (success or failure)
 */
export interface PollResult {
  ok: boolean;
  cursor?: string;
  delta?: any; // Partial<SurfaceViewModel>
  error?: string;
  serverTime?: string;
}

/**
 * Update poll state on success
 */
export function advancePollState(current: PollState, result: PollResult): PollState {
  if (!result.ok) {
    // Failure: increment backoff
    return {
      ...current,
      retryCount: current.retryCount + 1,
      nextRetryDelay: calculateBackoff(current.retryCount + 1),
      lastError: result.error || "Unknown error",
    };
  }

  // Success: reset backoff, update cursor
  return {
    ...current,
    lastCursor: result.cursor || current.lastCursor,
    retryCount: 0,
    nextRetryDelay: 2000,
    lastError: null,
  };
}

/**
 * Manual resume (e.g., after user clicks "Try again")
 */
export function resumePollState(state: PollState): PollState {
  return {
    ...state,
    paused: false,
    retryCount: 0,
    nextRetryDelay: 2000,
    lastError: null,
  };
}
