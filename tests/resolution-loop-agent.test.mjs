import test from 'node:test';
import assert from 'node:assert/strict';

function shouldStop(progress, wavesRun, lastResolvedCounts, { target, maxWaves, stallWaves }) {
  if (!progress) return { stop: false, reason: null };
  if (progress.resolved_count >= target) {
    return { stop: true, reason: 'target_reached' };
  }
  if (wavesRun >= maxWaves) {
    return { stop: true, reason: 'max_waves' };
  }
  if (lastResolvedCounts.length >= stallWaves) {
    const recent = lastResolvedCounts.slice(-stallWaves);
    const delta = recent[recent.length - 1] - recent[0];
    if (delta <= 0) {
      return { stop: true, reason: 'stalled' };
    }
  }
  return { stop: false, reason: null };
}

function parseJsonStdout(stdout) {
  const trimmed = String(stdout || '').trim();
  if (!trimmed) return null;
  const lastBrace = trimmed.lastIndexOf('{');
  if (lastBrace < 0) return null;
  try {
    return JSON.parse(trimmed.slice(lastBrace));
  } catch {
    return null;
  }
}

test('shouldStop reaches target', () => {
  const r = shouldStop(
    { resolved_count: 5000 },
    1,
    [4800, 5000],
    { target: 5000, maxWaves: 50, stallWaves: 3 },
  );
  assert.equal(r.stop, true);
  assert.equal(r.reason, 'target_reached');
});

test('shouldStop detects stall', () => {
  const r = shouldStop(
    { resolved_count: 2929 },
    5,
    [2929, 2929, 2929, 2929],
    { target: 5000, maxWaves: 50, stallWaves: 3 },
  );
  assert.equal(r.stop, true);
  assert.equal(r.reason, 'stalled');
});

test('shouldStop continues when progressing', () => {
  const r = shouldStop(
    { resolved_count: 3000 },
    2,
    [2929, 3000],
    { target: 5000, maxWaves: 50, stallWaves: 3 },
  );
  assert.equal(r.stop, false);
});

test('parseJsonStdout extracts trailing JSON object', () => {
  const stdout = 'some logs\n{"resolved_count": 42, "mode": "apply"}\n';
  const parsed = parseJsonStdout(stdout);
  assert.equal(parsed.resolved_count, 42);
  assert.equal(parsed.mode, 'apply');
});
