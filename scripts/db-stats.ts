#!/usr/bin/env tsx
import { config } from 'dotenv';
config({ path: '.env.bak' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_KEY as string
);

async function main() {
  const [startups, investors, discovered, matches] = await Promise.all([
    supabase.from('startup_uploads').select('*', { count: 'exact', head: true }),
    supabase.from('investors').select('*', { count: 'exact', head: true }),
    supabase.from('discovered_startups').select('*', { count: 'exact', head: true }),
    supabase.from('startup_investor_matches').select('*', { count: 'exact', head: true })
  ]);
  
  console.log('\n📊 DATABASE STATS');
  console.log('==================');
  console.log(`📦 Startups (approved): ${startups.count?.toLocaleString() || 0}`);
  console.log(`💼 Investors: ${investors.count?.toLocaleString() || 0}`);
  console.log(`🔍 Discovered (pending review): ${discovered.count?.toLocaleString() || 0}`);
  console.log(`🤝 Matches: ${matches.count?.toLocaleString() || 0}`);
  
  // Get recent activity
  const { data: recentStartups } = await supabase
    .from('startup_uploads')
    .select('name, created_at')
    .order('created_at', { ascending: false })
    .limit(5);
    
  console.log('\n🆕 RECENT STARTUPS (Last 5):');
  console.log('==================');
  recentStartups?.forEach(s => {
    const date = new Date(s.created_at);
    const timeAgo = getTimeAgo(date);
    console.log(`  • ${s.name} (${timeAgo})`);
  });
  
  // Get recent discovered
  const { data: recentDiscovered } = await supabase
    .from('discovered_startups')
    .select('name, source, created_at')
    .order('created_at', { ascending: false })
    .limit(5);
    
  console.log('\n🔍 RECENT DISCOVERED (Last 5):');
  console.log('==================');
  recentDiscovered?.forEach(s => {
    const date = new Date(s.created_at);
    const timeAgo = getTimeAgo(date);
    console.log(`  • ${s.name} from ${s.source} (${timeAgo})`);
  });
  
  console.log();
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

main().catch(console.error);
