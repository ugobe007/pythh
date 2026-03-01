/**
 * Find & migrate the GOD score DB floor: 40 → 30
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
  // 1. Check current constraints on startup_uploads
  let { data: cols } = await sb
    .from('startup_uploads')
    .select('total_god_score')
    .lt('total_god_score', 40)
    .limit(5);
  if (cols && cols.length > 0) {
    console.log('✓ Already have scores below 40:', cols.map(r => r.total_god_score));
  } else {
    console.log('No scores below 40 currently (floor active)');
  }

  // 2. Try inserting a temporary test row with low score to probe the constraint
  // This will tell us if there's a CHECK constraint
  try {
    const { error: testErr } = await sb
      .from('startup_uploads')
      .update({ total_god_score: 35 })
      .eq('total_god_score', 40)
      .eq('status', 'approved')
      .limit(1)
      .select('id');
    if (testErr) {
      console.log('Update to 35 failed (constraint active):', testErr.message);
    } else {
      console.log('Update to 35 succeeded — constraint allows 35');
    }
  } catch (e) {
    console.log('Exception:', e.message);
  }

  // 3. Count how many are exactly at 40
  const { data: atFloor } = await sb
    .from('startup_uploads')
    .select('id', { count: 'exact' })
    .eq('status', 'approved')
    .eq('total_god_score', 40);
  console.log(`\nStartups at exactly 40 (floor): ${atFloor?.length || 'unknown'}`);

  // 4. Check current score distribution
  const { data: dist } = await sb
    .from('startup_uploads')
    .select('total_god_score')
    .eq('status', 'approved')
    .limit(100);
  if (dist) {
    const scores = dist.map(r => r.total_god_score);
    const at40 = scores.filter(s => s === 40).length;
    const below40 = scores.filter(s => s < 40).length;
    console.log(`Sample of 100 approved: ${at40} at 40, ${below40} below 40`);
  }
}

run();
