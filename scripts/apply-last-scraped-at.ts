/**
 * Apply last_scraped_at migration via Supabase client
 * Run: npx tsx scripts/apply-last-scraped-at.ts
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
);

async function apply() {
  // Test if column already exists
  const { error: testErr } = await supabase
    .from('startup_uploads')
    .select('last_scraped_at')
    .limit(1);

  if (testErr && testErr.message.includes('last_scraped_at')) {
    console.log('❌ last_scraped_at column does not exist.');
    console.log('Please run this SQL in the Supabase dashboard SQL editor:');
    console.log('');
    console.log(`ALTER TABLE startup_uploads ADD COLUMN IF NOT EXISTS last_scraped_at TIMESTAMPTZ;`);
    console.log(`CREATE INDEX IF NOT EXISTS idx_startup_last_scraped ON startup_uploads(last_scraped_at) WHERE status = 'approved';`);
    console.log(`CREATE INDEX IF NOT EXISTS idx_score_history_created_at ON score_history(created_at DESC);`);
    console.log(`UPDATE startup_uploads SET last_scraped_at = created_at WHERE last_scraped_at IS NULL AND created_at IS NOT NULL;`);
    console.log(`COMMENT ON COLUMN startup_uploads.last_scraped_at IS 'Timestamp of last data refresh by scraper pipeline.';`);
    process.exit(1);
  }

  console.log('✅ last_scraped_at column exists!');

  // Backfill: set last_scraped_at = created_at where null
  let backfilled = 0;
  let page = 0;
  const PS = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('startup_uploads')
      .select('id, created_at')
      .is('last_scraped_at', null)
      .not('created_at', 'is', null)
      .range(page * PS, (page + 1) * PS - 1);

    if (error) { console.error('Fetch error:', error); break; }
    if (!data || data.length === 0) break;

    for (const row of data) {
      await supabase
        .from('startup_uploads')
        .update({ last_scraped_at: row.created_at })
        .eq('id', row.id);
      backfilled++;
    }
    if (data.length < PS) break;
    page++;
  }

  console.log(`✅ Backfilled ${backfilled} startups with last_scraped_at = created_at`);
}

apply().catch(console.error);
