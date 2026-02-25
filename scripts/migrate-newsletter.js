// One-time migration: create newsletter_subscribers + newsletter_editions tables
'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) { console.error('Missing SUPABASE env vars'); process.exit(1); }

const supabase = createClient(url, key);

async function run() {
  // Test table creation by doing simple inserts that will fail gracefully if tables exist
  // Since we can't run raw DDL via the JS client, we use the Postgres REST endpoint directly
  const headers = {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal',
  };

  const ddl = `
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,
  subscribed_at timestamptz NOT NULL DEFAULT now(),
  confirmed     boolean NOT NULL DEFAULT false,
  unsubscribed_at timestamptz,
  source        text DEFAULT 'website'
);
CREATE INDEX IF NOT EXISTS idx_newsletter_subs_email ON newsletter_subscribers(email);

CREATE TABLE IF NOT EXISTS newsletter_editions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_date  date NOT NULL UNIQUE,
  data          jsonb NOT NULL,
  generated_at  timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_newsletter_editions_date ON newsletter_editions(edition_date DESC);
`;

  // Use the Supabase /rest/v1/rpc/exec_sql if available, otherwise fall back to pg REST
  const baseUrl = url.replace(/\/$/, '');

  const res = await fetch(`${baseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ sql: ddl }),
  });

  if (res.ok) {
    console.log('✅ Tables created via exec_sql RPC');
    return;
  }

  // Fallback: try to query each table — if it errors with "does not exist", we need manual DDL
  const { error: e1 } = await supabase.from('newsletter_subscribers').select('id').limit(1);
  const { error: e2 } = await supabase.from('newsletter_editions').select('id').limit(1);

  if (!e1 && !e2) {
    console.log('✅ Both tables already exist — nothing to do');
    return;
  }

  if (e1) console.log('❌ newsletter_subscribers missing:', e1.message);
  if (e2) console.log('❌ newsletter_editions missing:', e2.message);
  console.log('\nRun this SQL in the Supabase SQL editor:\n');
  console.log(ddl);
}

run().catch(console.error);
