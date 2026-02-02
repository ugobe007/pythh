const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function runAudit() {
  console.log('🔍 HOT HONEY SYSTEM AUDIT');
  console.log('=' .repeat(60));
  
  const issues = [];
  
  // 1. Check Supabase connection
  console.log('\n📡 1. SUPABASE CONNECTION');
  try {
    const { data, error } = await supabase.from('startup_uploads').select('id').limit(1);
    if (error) {
      console.log('❌ Connection failed:', error.message);
      issues.push('Supabase connection failed');
    } else {
      console.log('✅ Connected to Supabase');
    }
  } catch (err) {
    console.log('❌ Connection error:', err.message);
    issues.push('Supabase connection error');
  }
  
  // 2. Check startup_uploads table
  console.log('\n📊 2. STARTUP_UPLOADS TABLE');
  try {
    const { count: total } = await supabase
      .from('startup_uploads')
      .select('*', { count: 'exact', head: true });
    
    const { count: approved } = await supabase
      .from('startup_uploads')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved');
    
    const { count: withWebsite } = await supabase
      .from('startup_uploads')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved')
      .not('website', 'is', null);
    
    console.log(`   Total startups: ${total}`);
    console.log(`   Approved: ${approved}`);
    console.log(`   With website: ${withWebsite}`);
    
    if (approved === 0) {
      issues.push('No approved startups in database');
    }
  } catch (err) {
    console.log('❌ Error:', err.message);
    issues.push('startup_uploads table error');
  }
  
  // 3. Check investors table
  console.log('\n💼 3. INVESTORS TABLE');
  try {
    const { count: total } = await supabase
      .from('investors')
      .select('*', { count: 'exact', head: true });
    
    console.log(`   Total investors: ${total}`);
    
    if (total === 0) {
      issues.push('No investors in database');
    }
  } catch (err) {
    console.log('❌ Error:', err.message);
    issues.push('investors table error');
  }
  
  // 4. Check startup_investor_matches table
  console.log('\n🎯 4. STARTUP_INVESTOR_MATCHES TABLE');
  try {
    const { count: total } = await supabase
      .from('startup_investor_matches')
      .select('*', { count: 'exact', head: true });
    
    const { count: highQuality } = await supabase
      .from('startup_investor_matches')
      .select('*', { count: 'exact', head: true })
      .gte('match_score', 70);
    
    console.log(`   Total matches: ${total}`);
    console.log(`   High quality (70+): ${highQuality}`);
    
    if (total === 0) {
      issues.push('NO MATCHES IN DATABASE - Match generation not run');
    } else if (highQuality === 0) {
      issues.push('No high-quality matches found');
    }
  } catch (err) {
    console.log('❌ Error:', err.message);
    issues.push('startup_investor_matches table error');
  }
  
  // 5. Test a real startup → matches pipeline
  console.log('\n🧪 5. TEST REAL STARTUP → MATCHES PIPELINE');
  try {
    const { data: startup } = await supabase
      .from('startup_uploads')
      .select('id, name, website, total_god_score')
      .eq('status', 'approved')
      .not('website', 'is', null)
      .limit(1)
      .single();
    
    if (startup) {
      console.log(`   Test startup: ${startup.name} (ID: ${startup.id})`);
      console.log(`   Website: ${startup.website}`);
      console.log(`   GOD Score: ${startup.total_god_score}`);
      
      // Check if this startup has matches
      const { data: matches, count } = await supabase
        .from('startup_investor_matches')
        .select('match_score, investor_id', { count: 'exact' })
        .eq('startup_id', startup.id)
        .gte('match_score', 50);
      
      console.log(`   Matches for this startup: ${count}`);
      
      if (count === 0) {
        issues.push(`Startup ${startup.name} has NO MATCHES`);
      } else {
        // Test investor lookup
        const { data: investor } = await supabase
          .from('investors')
          .select('id, name, firm')
          .eq('id', matches[0].investor_id)
          .single();
        
        if (investor) {
          console.log(`   ✅ Sample match: ${investor.name} (Score: ${matches[0].match_score})`);
        } else {
          issues.push('Investor lookup failed - orphaned match data');
        }
      }
    } else {
      issues.push('No startups available for testing');
    }
  } catch (err) {
    console.log('❌ Error:', err.message);
    issues.push('Pipeline test failed');
  }
  
  // 6. Check if match-regenerator has run recently
  console.log('\n⚙️  6. MATCH GENERATION STATUS');
  try {
    const { data: logs } = await supabase
      .from('ai_logs')
      .select('created_at, action, output')
      .eq('type', 'match_regeneration')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (logs) {
      const hoursSince = (Date.now() - new Date(logs.created_at).getTime()) / (1000 * 60 * 60);
      console.log(`   Last match generation: ${Math.round(hoursSince)} hours ago`);
      console.log(`   Action: ${logs.action}`);
      
      if (hoursSince > 48) {
        issues.push('Matches are stale (>48 hours old)');
      }
    } else {
      console.log('   ⚠️  No match regeneration logs found');
      issues.push('Match regeneration may never have run');
    }
  } catch (err) {
    console.log('   ℹ️  No match generation logs available');
  }
  
  // 7. Check PM2 processes
  console.log('\n🔄 7. PM2 PROCESSES');
  const { execSync } = require('child_process');
  try {
    const pm2Status = execSync('pm2 jlist', { encoding: 'utf-8' });
    const processes = JSON.parse(pm2Status);
    
    const critical = ['mega-scraper', 'system-guardian'];
    critical.forEach(name => {
      const proc = processes.find(p => p.name === name);
      if (proc) {
        const status = proc.pm2_env.status;
        console.log(`   ${status === 'online' ? '✅' : '❌'} ${name}: ${status}`);
        if (status !== 'online') {
          issues.push(`${name} is not running`);
        }
      } else {
        console.log(`   ⚠️  ${name}: not found`);
      }
    });
  } catch (err) {
    console.log('   ℹ️  PM2 not running or not available');
  }
  
  // SUMMARY
  console.log('\n' + '='.repeat(60));
  console.log('📋 AUDIT SUMMARY');
  console.log('='.repeat(60));
  
  if (issues.length === 0) {
    console.log('✅ All systems operational');
  } else {
    console.log(`❌ Found ${issues.length} issue(s):\n`);
    issues.forEach((issue, i) => {
      console.log(`   ${i + 1}. ${issue}`);
    });
    
    console.log('\n💡 RECOMMENDED ACTIONS:');
    
    if (issues.some(i => i.includes('NO MATCHES'))) {
      console.log('   → Run: node match-regenerator.js');
    }
    if (issues.some(i => i.includes('not running'))) {
      console.log('   → Run: pm2 restart ecosystem.config.js');
    }
    if (issues.some(i => i.includes('No approved startups'))) {
      console.log('   → Check startup approval workflow');
    }
  }
  
  console.log('\n');
}

runAudit().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
