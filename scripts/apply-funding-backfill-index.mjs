#!/usr/bin/env node
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and service-role key are required');

const db = createClient(url, key, { auth: { persistSession: false } });
const sql = `
CREATE INDEX IF NOT EXISTS idx_startup_events_funding_backfill_order
  ON public.startup_events (created_at DESC, id DESC)
  WHERE event_type IN ('FUNDING', 'INVESTMENT')
`;

const { data, error } = await db.rpc('exec_sql_modify', { sql_query: sql });
if (error) throw error;
if (data?.success === false) throw new Error(data.error || 'Index creation failed');
console.log(JSON.stringify({ applied: true, index: 'idx_startup_events_funding_backfill_order' }));
