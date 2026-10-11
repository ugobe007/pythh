import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('founder signup persists startup context for email and OAuth paths', async () => {
  const signup = await read('site/pages/FounderSignup.tsx');
  const account = await read('site/lib/founderAccount.ts');
  assert.match(account, /trpcVanilla\.profile\.upsert\.mutate/);
  // Email, OAuth, and already-authenticated handoff all persist startup ownership.
  assert.ok(((signup.match(/persistFounderStartup\(\{/g) || []).length) >= 3);
  assert.match(signup, /startupId, companyUrl: url/);
});

test('startup-only persistence does not erase the rest of the founder profile', async () => {
  const router = await read('site/routers.ts');
  assert.match(router, /if \('startupId' in input\) patch\.startupId/);
  assert.match(router, /if \('companyName' in input\) patch\.companyName/);
  assert.doesNotMatch(router, /const patch = \{\s*companyName: input\.companyName/);
});

test('founder account restores startup context from the protected profile', async () => {
  const hub = await read('site/components/FounderOnboardingHub.tsx');
  const account = await read('site/lib/founderAccount.ts');
  assert.match(hub, /trpc\.profile\.get\.useQuery/);
  assert.match(hub, /profile\?\.startupId/);
  assert.match(hub, /pinActiveStartup\(profile\.startupId/);
  assert.match(hub, /Your saved matches/);
  assert.match(hub, /fetchInstantResults/);
  assert.match(hub, /readCachedFounderShortlist/);
  assert.match(hub, /resolveStartupIdForUrl/);
  assert.match(hub, /source=account_saved/);
  assert.match(account, /cacheFounderShortlist/);
  assert.match(account, /pinActiveStartup\(opts\.startupId/);
});

test('founder profile schema and migration include startup ownership', async () => {
  const schema = await read('site/schema.ts');
  const migration = await read('supabase/migrations/20260817010000_founder_profile_startup_ownership.sql');
  assert.match(schema, /startupId: uuid\("startup_id"\)/);
  assert.match(migration, /REFERENCES public\.startup_uploads\(id\) ON DELETE SET NULL/);
});
