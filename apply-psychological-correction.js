const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env file
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  console.log('🔧 Applying psychological signals correction migration...\n');

  try {
    // Read the migration SQL
    const migrationPath = path.join(__dirname, 'supabase/migrations/20260212_fix_psychological_additive.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Split into individual statements (rough split, good enough for this migration)
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--') && !s.startsWith('/*'));

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip comments and empty statements
      if (!statement || statement.startsWith('--')) continue;

      console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`);
      
      try {
        const { data, error } = await supabase.rpc('exec_sql', {
          query: statement + ';'
        });

        if (error) {
          console.error(`❌ Error in statement ${i + 1}:`, error.message);
          // Continue to next statement
        } else {
          console.log(`✅ Statement ${i + 1} completed`);
        }
      } catch (err) {
        console.error(`❌ Exception in statement ${i + 1}:`, err.message);
        // Continue to next statement
      }
    }

    console.log('\n✅ Migration application attempted (check for errors above)');
    console.log('\n📊 Verifying changes...\n');

    // Verify the column was renamed
    const { data: columns, error: colError } = await supabase
      .from('startup_uploads')
      .select('psychological_bonus, enhanced_god_score')
      .limit(1);

    if (colError) {
      console.error('❌ Verification failed:', colError.message);
      console.log('\n⚠️  Migration may not have applied correctly');
      console.log('    Try running SQL manually in Supabase SQL Editor:');
      console.log('    ' + migrationPath);
    } else {
      console.log('✅ Column psychological_bonus exists');
      console.log('✅ Migration appears successful\n');
    }

  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
}

applyMigration().then(() => {
  console.log('\n✨ Migration process complete');
  console.log('Next steps:');
  console.log('  1. Run: npx tsx scripts/recalculate-scores.ts');
  console.log('  2. Verify enhanced scores are now additive (base + bonus)');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
