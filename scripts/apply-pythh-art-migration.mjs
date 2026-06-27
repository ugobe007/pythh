#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const sql = fs.readFileSync(
  path.join(__dirname, '../supabase/migrations/20260627000000_pythh_art_editions.sql'),
  'utf8',
);

const { data, error } = await supabase.rpc('exec_sql_modify', { sql_query: sql });
if (error) {
  console.error('RPC error:', error.message);
  process.exit(1);
}
console.log('exec_sql_modify result:', JSON.stringify(data));
if (data && data.success === false) {
  console.error('SQL error:', data.error, data.code);
  process.exit(1);
}

const { error: selErr } = await supabase.from('pythh_art_editions').select('edition_date').limit(1);
console.log(selErr ? `Verify FAILED: ${selErr.message}` : '✅ pythh_art_editions table is live.');
