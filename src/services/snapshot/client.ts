import type { SignalSnapshot, Mode } from '../../types/snapshot';
import { buildMockSnapshot } from './mock';

export async function computeSnapshot(input: { startupUrl?: string; startupId?: string; mode: Mode }): Promise<SignalSnapshot> {
  // ✅ V0: return mock
  // Replace this with a real POST to your backend when ready.
  // Example:
  // const res = await fetch("/api/snapshot/compute", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(input) });
  // if (!res.ok) throw new Error("Snapshot compute failed");
  // return res.json();

  const s = buildMockSnapshot();
  return {
    ...s,
    startupUrl: input.startupUrl ?? s.startupUrl,
    startupId: input.startupId ?? s.startupId,
    mode: input.mode,
    computedAt: new Date().toISOString(),
  };
}
