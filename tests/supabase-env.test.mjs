import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isSupabaseRestUrl,
  looksLikeDatabaseUrl,
  resolveSupabaseRestUrl,
} from '../lib/supabaseEnv.mjs';

test('isSupabaseRestUrl accepts project REST host', () => {
  assert.equal(isSupabaseRestUrl('https://unkpogyhhjbvxxjvmxlt.supabase.co'), true);
  assert.equal(isSupabaseRestUrl('postgresql://postgres.pooler.supabase.com:5432/postgres'), false);
});

test('looksLikeDatabaseUrl detects pooler strings', () => {
  assert.equal(
    looksLikeDatabaseUrl('postgresql://postgres.ref:pass@aws-1-us-east-2.pooler.supabase.com:5432/postgres'),
    true,
  );
});

test('resolveSupabaseRestUrl prefers VITE when both valid', () => {
  const r = resolveSupabaseRestUrl({
    VITE_SUPABASE_URL: 'https://a.supabase.co',
    SUPABASE_URL: 'https://b.supabase.co',
  });
  assert.equal(r.url, 'https://a.supabase.co');
  assert.equal(r.source, 'VITE_SUPABASE_URL');
});

test('resolveSupabaseRestUrl rejects postgres SUPABASE_URL when VITE missing', () => {
  assert.throws(
    () =>
      resolveSupabaseRestUrl({
        SUPABASE_URL: 'postgresql://postgres.ref@aws.pooler.supabase.com:5432/postgres',
      }),
    /looks like DATABASE_URL/,
  );
});

test('resolveSupabaseRestUrl falls back to SUPABASE_URL when VITE unset', () => {
  const r = resolveSupabaseRestUrl({
    SUPABASE_URL: 'https://b.supabase.co',
  });
  assert.equal(r.url, 'https://b.supabase.co');
});
