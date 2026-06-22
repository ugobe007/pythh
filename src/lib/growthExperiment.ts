/**
 * Client-side growth experiment assignment + event tracking.
 */

import { apiUrl } from './apiConfig';

const STORAGE_KEY = 'pyth_growth_assignment';

export type GrowthAudience = 'founder' | 'investor';

export interface GrowthAssignment {
  experiment_id: string;
  variant_key: string;
  audience: GrowthAudience;
  schema: Record<string, unknown>;
  copy: Record<string, unknown>;
  source?: string;
}

function getAnonId(): string {
  const key = 'pyth_anon_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = `anon_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
    localStorage.setItem(key, id);
  }
  return id;
}

function getSessionId(): string {
  const key = 'pyth_session_id';
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = `sess_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
    sessionStorage.setItem(key, id);
  }
  return id;
}

export async function fetchGrowthAssignment(
  audience: GrowthAudience,
  experimentId?: string,
): Promise<GrowthAssignment | null> {
  const cached = sessionStorage.getItem(`${STORAGE_KEY}:${audience}`);
  if (cached) {
    try {
      return JSON.parse(cached) as GrowthAssignment;
    } catch {
      /* refresh */
    }
  }

  const params = new URLSearchParams({ audience, anon_id: getAnonId() });
  if (experimentId) params.set('experiment_id', experimentId);

  const res = await fetch(apiUrl(`/api/growth/assign?${params}`), {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return null;
  const j = await res.json();
  const assignment = j?.assignment as GrowthAssignment | undefined;
  if (assignment) {
    sessionStorage.setItem(`${STORAGE_KEY}:${audience}`, JSON.stringify(assignment));
  }
  return assignment ?? null;
}

export async function trackGrowthEvent(
  assignment: GrowthAssignment,
  eventName: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  try {
    await fetch(apiUrl('/api/growth/event'), {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        experiment_id: assignment.experiment_id,
        variant_key: assignment.variant_key,
        audience: assignment.audience,
        event_name: eventName,
        anon_id: getAnonId(),
        session_id: getSessionId(),
        payload,
      }),
    });
  } catch {
    /* non-blocking */
  }
}
