/**
 * Retry Supabase REST calls on transient Node fetch failures (ETIMEDOUT, ECONNRESET, etc.).
 */

export function isTransientNetworkError(err) {
  if (!err) return false;
  const parts = [];
  let e = err;
  for (let i = 0; i < 6 && e; i++) {
    parts.push(e.message || '', e.details || '', String(e.code || ''));
    e = e.cause;
  }
  const s = parts.join(' ');
  return /ETIMEDOUT|ECONNRESET|ECONNREFUSED|fetch failed|socket hang up|NetworkError|ENOTFOUND|EAI_AGAIN/i.test(s);
}

export async function withNetworkRetry(label, fn, { maxAttempts = 6 } = {}) {
  let last;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (!isTransientNetworkError(e) || attempt === maxAttempts) throw e;
      const ms = Math.min(400 * 2 ** (attempt - 1), 12000);
      console.warn(`  retry ${label}: ${e.message || e} (${attempt}/${maxAttempts}, wait ${ms}ms)`);
      await new Promise((r) => setTimeout(r, ms));
    }
  }
  throw last;
}

export async function supabaseResult(label, runQuery) {
  return withNetworkRetry(label, async () => {
    const result = await runQuery();
    if (result?.error) throw result.error;
    return result;
  });
}
