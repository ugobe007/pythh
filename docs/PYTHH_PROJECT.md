# Pythh — project identity

**Product name:** Pythh (public site: [pythh.ai](https://pythh.ai))

**Supabase (database):** project ref `unkpogyhhjbvxxjvmxlt` — [dashboard](https://supabase.com/dashboard/project/unkpogyhhjbvxxjvmxlt)

**Fly.io:** app name in [`fly.toml`](../fly.toml) is `hot-honey` (infrastructure hostname: `https://hot-honey.fly.dev`). Custom domain `pythh.ai` is the canonical public URL; prefer `APP_URL` / `APP_BASE_URL` in `.env` for links in emails and scripts.

**Environment:** see [`.env.example`](../.env.example). For production links, set:

- `APP_URL=https://pythh.ai`
- `APP_BASE_URL=https://pythh.ai`

**Repo folder name:** may still be `hot-honey` on disk; that does not change the product name.

Legacy docs may say “Hot Honey” or “Hot Money”; treat **Pythh** as correct for user-facing copy going forward.
