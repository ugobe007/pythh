/**
 * Shared Supabase Client for Backend Services
 * ============================================
 * Reusable client with environment variable validation
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

function getSupabaseClient() {
  // Check for all possible environment variable names
  const supabaseUrl = process.env.VITE_SUPABASE_URL ||
                      process.env.SUPABASE_URL || 
                      process.env.NEXT_PUBLIC_SUPABASE_URL;
  
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 
                      process.env.SUPABASE_SERVICE_ROLE_KEY || 
                      process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
                      process.env.VITE_SUPABASE_ANON_KEY ||
                      process.env.SUPABASE_ANON_KEY;
  
  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL environment variable is required. Check .env file in project root.');
  }
  
  if (!supabaseKey) {
    throw new Error('SUPABASE_KEY environment variable is required. Check .env file in project root.');
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

// Create singleton instance
let supabaseInstance = null;

module.exports = {
  get supabase() {
    if (!supabaseInstance) {
      supabaseInstance = getSupabaseClient();
    }
    return supabaseInstance;
  },
  getSupabaseClient
};
