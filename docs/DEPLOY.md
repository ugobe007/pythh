# Deploying to Fly.io

## Build and deploy methodology

1. **No database on server startup**  
   The server must not load from the database when it starts. Data is loaded when the **browser** (or a client) calls APIs. Any caches (e.g. investor list) are filled on **first request** that needs them, not in `setTimeout` or at module load.

2. **Catch errors before deploy**  
   Run the server-load check before deploying so failures (e.g. requiring `.ts` from `.js`, or missing deps) are caught locally:
   ```bash
   npm run check:server
   ```
   If this exits non-zero, fix the reported error before `fly deploy`. The script loads route modules that previously caused production crashes (e.g. `instantSubmit`).

3. **TypeScript in the server**  
   Plain Node cannot run `.ts` files. Either:
   - Use **try/catch** when requiring a `.ts` module from `.js` and provide a stub on failure, or
   - Add a build step that compiles `server/**/*.ts` to `.js` and require the compiled output.

4. **Frontend first**  
   The server registers `/ping`, static assets, and the SPA **before** `listen()`, so the site can load even if a later route or require fails. API routes are registered after.

## Database (Supabase) is separate from the app image

**The Docker image does not run or include Supabase migrations.** The app connects to your Supabase project via env vars; schema changes are applied to Supabase separately.

### Option A: Run one migration in the dashboard (no CLI sync)

1. Open [Supabase SQL Editor](https://supabase.com/dashboard/project/unkpogyhhjbvxxjvmxlt/sql/new).
2. Copy the contents of the migration file (e.g. `supabase/migrations/20260309000000_investor_curated_lists.sql`).
3. Paste and click **Run**.

Use this when you hit “Remote migration versions not found in local migrations directory” or don’t want to fix CLI history.

### Option B: Use Supabase CLI (`db push`)

**Install and link (one-time):**

```bash
brew install supabase/tap/supabase   # or: npx supabase login
npx supabase login
npx supabase link --project-ref unkpogyhhjbvxxjvmxlt
```

**If you see “Remote migration versions not found in local migrations directory”:**  
The remote DB has migration history that doesn’t match your local files. You can:

1. **Quick fix:** Apply the SQL for the migration you need in the SQL Editor (Option A above).
2. **Sync CLI with remote:** From repo root run:
   ```bash
   chmod +x scripts/supabase-repair-remote-migrations.sh
   ./scripts/supabase-repair-remote-migrations.sh
   ```
   That marks “remote only” versions as reverted so the CLI stops erroring. Then run:
   ```bash
   npx supabase db push
   ```
   If `db push` tries to apply old local migrations and fails (e.g. “relation already exists”), run:
   ```bash
   npx supabase migration repair --status applied <version>
   ```
   for each failing version so the CLI treats it as already applied.

Then deploy the app:

```bash
fly deploy
```

Or run migrations from CI after deploy, or apply them manually in the [Supabase Dashboard](https://supabase.com/dashboard) → SQL Editor.

### Why migrations aren’t in the image

- Migrations are SQL run against your **remote** Supabase DB, not inside the container.
- The app only needs the **connection** (e.g. `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`) set as [Fly secrets](https://fly.io/docs/reference/secrets/).
- Keeping migrations out of the image keeps the build small and avoids running DB commands from the app container.

## Log volume

Production defaults to `LOG_LEVEL=warn`. To see more (e.g. request logs):

```bash
fly secrets set LOG_LEVEL=info
```

Then restart: `fly apps restart hot-honey`.
