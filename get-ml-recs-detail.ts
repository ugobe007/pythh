import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function getMLRecommendations() {
  console.log('🤖 ML AGENT RECOMMENDATIONS DETAIL\n');

  // Get all columns from ml_recommendations
  const { data, error } = await supabase
    .from('ml_recommendations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.log('⚠️  No recommendations found');
    return;
  }

  console.log(`Found ${data.length} recommendations:\n`);
  console.log('=' .repeat(80));

  data.forEach((rec, i) => {
    console.log(`\n${i + 1}. RECOMMENDATION (${rec.created_at})`);
    console.log('-'.repeat(80));
    
    // Print all fields
    Object.entries(rec).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        if (typeof value === 'object') {
          console.log(`${key}:`);
          console.log(JSON.stringify(value, null, 2));
        } else {
          console.log(`${key}: ${value}`);
        }
      }
    });
  });

  // Check what columns exist
  console.log('\n\n📋 TABLE SCHEMA:');
  console.log('Columns found:', Object.keys(data[0] || {}).join(', '));
}

getMLRecommendations().catch(console.error);
