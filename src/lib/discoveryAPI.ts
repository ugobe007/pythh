/**
 * Discovery API Client (Phase 4)
 * Job-based submit/poll pattern for startup signal discovery.
 * Replaces direct convergence API calls with robust job tracking.
 */

export type JobStatus =
  | "queued"
  | "building"
  | "scoring"
  | "matching"
  | "ready"
  | "failed"
  | "unknown";

export interface SubmitResponse {
  job_id: string;
  startup_id?: string;
  status: JobStatus;
  message?: string;
  debug?: any;
}

// Raw signal data from backend (database fields)
export interface RawSignalData {
  name?: string;
  sectors?: string[];
  stage?: number;
  signal_strength?: number;
  phase_score?: number;
  tier?: string;
  signal_band?: 'low' | 'med' | 'high';
}

export interface ResultsBuildingResponse {
  status: Exclude<JobStatus, "ready" | "failed" | "unknown">;
  progress?: number;
  message?: string;
  debug?: any;
}

export interface ResultsReadyResponse {
  status: "ready";
  job_id: string;
  startup_id: string;
  matches: any[];
  signal: RawSignalData | null;
  debug?: any;
}

export interface ResultsFailedResponse {
  status: "failed";
  error: string;
  retryable: boolean;
  debug?: any;
}

export interface ResultsUnknownResponse {
  status: "unknown";
  message: string;
}

export type ResultsResponse =
  | ResultsBuildingResponse
  | ResultsReadyResponse
  | ResultsFailedResponse
  | ResultsUnknownResponse;

export async function submitUrl(url: string): Promise<SubmitResponse> {
  const r = await fetch("/api/discovery/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!r.ok) throw new Error(`submit failed (${r.status})`);
  return r.json();
}

export async function fetchResults(jobId: string): Promise<ResultsResponse> {
  const r = await fetch(
    `/api/discovery/results?job_id=${encodeURIComponent(jobId)}`
  );
  if (!r.ok) throw new Error(`results failed (${r.status})`);
  return r.json();
}

export function calculatePollDelay(pollCount: number) {
  if (pollCount <= 6) return 900;
  if (pollCount <= 20) return 1500;
  return 2500;
}

export type SignalDelta = {
  phaseDelta: number;
  bandChanged: boolean;
  bandFrom: string | null;
  bandTo: string | null;
  matchCountDelta: number;
  alignmentDelta?: number | null;
  investorsGained: number;
  investorsLost: number;
  narrative: string;
  comparedAt: string;
};

export async function fetchLatestDelta(startupId: string) {
  const r = await fetch(
    `/api/discovery/delta?startup_id=${encodeURIComponent(startupId)}`
  );
  if (!r.ok) throw new Error(`delta fetch failed (${r.status})`);
  return r.json();
}

/**
 * Pipeline diagnostic endpoint (dev/admin only)
 * Returns internal truth about job state for debugging
 */
export type PipelineDiagnostic = {
  startup_id: string;
  queue_status: string;
  queue_attempts: number;
  queue_updated_at: string | null;
  last_error: string | null;
  match_count: number;
  active_match_count: number;
  last_match_at: string | null;
  system_state: 'ready' | 'matching' | 'needs_queue' | 'partial';
  diagnosis: string;
};

export async function diagnosePipeline(startupId: string): Promise<PipelineDiagnostic | null> {
  try {
    const r = await fetch(
      `/api/discovery/diagnose?startup_id=${encodeURIComponent(startupId)}`
    );
    if (!r.ok) return null;
    return r.json();
  } catch {
    return null;
  }
}
