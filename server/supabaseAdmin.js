/**
 * Supabase Admin Client (ES Module)
 * For use by ESM routes like god.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL ||
                    process.env.SUPABASE_URL || 
                    process.env.NEXT_PUBLIC_SUPABASE_URL;

const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 
                    process.env.SUPABASE_SERVICE_ROLE_KEY || 
                    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
                    process.env.VITE_SUPABASE_ANON_KEY ||
                    process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('[supabaseAdmin] Missing Supabase credentials - some features may not work');
}

export const supabaseAdmin = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder'
);
