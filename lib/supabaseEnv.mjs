/**
 * Resolve Supabase REST API URL + service key for Node scripts.
 * SUPABASE_URL is sometimes mistakenly set to DATABASE_URL (postgres pooler).
 * Search scripts prefer VITE_SUPABASE_URL; seed/ingest used SUPABASE_URL first — mismatch caused fetch failed.
 */

export function isSupabaseRestUrl(value) {
  const s = String(value || '').trim();
  if (!s) return false;
  try {
    const u = new URL(s);
    return u.protocol === 'https:' && /\.supabase\.co$/i.test(u.hostname);
  } catch {
    return false;
  }
}

export function looksLikeDatabaseUrl(value) {
  const s = String(value || '').trim();
  return /^postgres(ql)?:/i.test(s) || /pooler\.supabase\.com/i.test(s);
}

/** First valid https://*.supabase.co URL from env (VITE_ first — matches search-funding). */
export function resolveSupabaseRestUrl(env = process.env) {
  const candidates = [
    ['VITE_SUPABASE_URL', env.VITE_SUPABASE_URL],
    ['SUPABASE_URL', env.SUPABASE_URL],
  ];
  for (const [name, value] of candidates) {
    if (isSupabaseRestUrl(value)) return { url: value.trim(), source: name };
  }
  const wrong = candidates.find(([, v]) => v && looksLikeDatabaseUrl(v));
  if (wrong) {
    throw new Error(
      `${wrong[0]} looks like DATABASE_URL (postgres pooler), not the REST API. ` +
        'Set SUPABASE_URL=https://<ref>.supabase.co (Supabase Dashboard → Settings → API → Project URL).',
    );
  }
  throw new Error(
    'Missing Supabase REST URL. Set VITE_SUPABASE_URL or SUPABASE_URL to https://<ref>.supabase.co',
  );
}

export function resolveSupabaseServiceKey(env = process.env) {
  const key = (env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!key) throw new Error('Missing SUPABASE_SERVICE_KEY (service_role JWT from Supabase Dashboard → API)');
  return key;
}

export function describeSupabaseEnv(env = process.env) {
  const lines = [];
  for (const name of ['VITE_SUPABASE_URL', 'SUPABASE_URL']) {
    const raw = String(env[name] || '').trim();
    if (!raw) lines.push(`${name}: unset`);
    else if (isSupabaseRestUrl(raw)) lines.push(`${name}: REST ${new URL(raw).host}`);
    else if (looksLikeDatabaseUrl(raw)) lines.push(`${name}: WRONG (postgres/pooler — use https://*.supabase.co)`);
    else lines.push(`${name}: invalid (${raw.slice(0, 40)}…)`);
  }
  return lines;
}
