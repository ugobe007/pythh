#!/usr/bin/env node
/**
 * Test vote uniqueness: vote twice on same startup, verify only 1 row exists
 * Run: npx ts-node scripts/test-vote-uniqueness.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testVoteUniqueness() {
  const testUserId = crypto.randomUUID();
  const testStartupId = '999-test-' + Date.now();

  console.log('\n🧪 Testing vote uniqueness...');
  console.log(`User ID: ${testUserId}`);
  console.log(`Startup ID: ${testStartupId}\n`);

  try {
    // First vote: YES
    console.log('1️⃣ Casting first vote (YES)...');
    const { data: data1, error: error1 } = await (supabase as any)
      .from('votes')
      .upsert(
        {
          user_id: testUserId,
          vote: 'yes',
          weight: 1.0,
          metadata: {
            startup_local_id: testStartupId,
          },
        },
        {
          onConflict: 'user_id,metadata->>startup_local_id',
        }
      )
      .select();

    if (error1) {
      console.error('❌ First vote failed:', error1.message);
      return;
    }
    console.log('✅ First vote saved:', data1?.[0]?.vote);

    // Count votes
    const { count: count1 } = await (supabase as any)
      .from('votes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', testUserId);
    console.log(`   Row count after first vote: ${count1}\n`);

    // Second vote: NO (should UPDATE the existing row)
    console.log('2️⃣ Casting second vote (NO) for same startup...');
    const { data: data2, error: error2 } = await (supabase as any)
      .from('votes')
      .upsert(
        {
          user_id: testUserId,
          vote: 'no',
          weight: 1.0,
          metadata: {
            startup_local_id: testStartupId,
          },
        },
        {
          onConflict: 'user_id,metadata->>startup_local_id',
        }
      )
      .select();

    if (error2) {
      console.error('❌ Second vote failed:', error2.message);
      return;
    }
    console.log('✅ Second vote saved:', data2?.[0]?.vote);

    // Count votes again
    const { count: count2 } = await (supabase as any)
      .from('votes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', testUserId);
    console.log(`   Row count after second vote: ${count2}\n`);

    // Verify uniqueness
    if (count2 === 1) {
      console.log('✅ SUCCESS: Uniqueness constraint works!');
      console.log('   Only 1 row exists (second vote updated the first)');
    } else {
      console.log(
        `❌ FAIL: Expected 1 row, got ${count2}. Uniqueness not enforced.`
      );
    }

    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    await (supabase as any)
      .from('votes')
      .delete()
      .eq('user_id', testUserId);
    console.log('✅ Test data removed\n');
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
  }
}

testVoteUniqueness();
