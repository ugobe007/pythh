// Quick script to check startup_events table schema
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkSchema() {
  console.log('Checking startup_events table schema...\n');
  
  // Try to query the table
  const { data, error } = await supabase
    .from('startup_events')
    .select('*')
    .limit(1);
  
  if (error) {
    console.log('❌ Table query error:', error.message);
    console.log('   Code:', error.code);
    
    if (error.code === '42P01') {
      console.log('\n✅ Table does not exist - safe to create fresh');
    }
  } else {
    console.log('✅ Table exists');
    
    // Insert a dummy row to see structure, then delete it
    const dummyEvent = {
      event_id: 'test_check_schema',
      event_type: 'OTHER',
      frame_type: 'UNKNOWN',
      frame_confidence: 0.5,
      occurred_at: new Date().toISOString(),
      source_publisher: 'test',
      source_url: 'test',
      source_title: 'test',
      entities: [],
      extraction_meta: { decision: 'ACCEPT', graph_safe: false }
    };
    
    const { data: insertData, error: insertError } = await supabase
      .from('startup_events')
      .insert(dummyEvent)
      .select();
    
    if (insertError) {
      console.log('   Insert failed (this helps us see what columns exist):', insertError.message);
    } else {
      console.log('   Successfully inserted test row - columns:', Object.keys(insertData[0]));
      
      // Delete the test row
      await supabase
        .from('startup_events')
        .delete()
        .eq('event_id', 'test_check_schema');
    }
  }
  
  // Check startup_uploads schema too
  console.log('\n\nChecking startup_uploads.discovery_event_id...\n');
  const { data: uploads, error: uploadsError } = await supabase
    .from('startup_uploads')
    .select('id, discovery_event_id')
    .limit(1);
  
  if (uploadsError) {
    console.log('❌ Error:', uploadsError.message);
    if (uploadsError.message.includes('discovery_event_id')) {
      console.log('✅ Column does not exist - safe to add');
    }
  } else {
    console.log('✅ Column exists:', uploads);
  }
}

checkSchema().catch(console.error);
