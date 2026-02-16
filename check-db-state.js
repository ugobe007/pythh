const {createClient} = require('@supabase/supabase-js');
require('dotenv').config();

(async () => {
  const s = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  
  const {data: startups} = await s.from('startup_uploads').select('status');
  const {data: discovered} = await s.from('discovered_startups').select('imported_to_startups');
  const {count: investors} = await s.from('investors').select('*', {count: 'exact', head: true});
  
  const approved = startups.filter(s => s.status === 'approved').length;
  const pending = startups.filter(s => s.status === 'pending').length;
  const unimported = discovered.filter(d => d.imported_to_startups === false).length;
  
  console.log('\n📊 ACTUAL DATABASE STATE:\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\nstartup_uploads table:');
  console.log('  Total:', startups.length);
  console.log('  ✅ Approved:', approved);
  console.log('  ⏳ Pending:', pending);
  console.log('  ❌ Rejected:', startups.length - approved - pending);
  
  console.log('\ndiscovered_startups table:');
  console.log('  Total:', discovered.length);
  console.log('  🆕 Ready to import:', unimported);
  
  console.log('\ninvestors table:', investors || 0);
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n🎯 THE PROBLEM:');
  
  if (approved === 0) {
    console.log('\n  ❌ ZERO APPROVED STARTUPS');
    console.log('  This is why all pages show empty!');
    console.log('  System Health Dashboard filters by status="approved"');
    console.log('  Most public pages only show approved startups');
  }
  
  if (unimported > 0) {
    console.log('\n  ✨ You have ' + unimported + ' startups ready to import');
    console.log('  📍 Go to: http://localhost:5173/admin/discovered-startups');
    console.log('  1. Select startups');
    console.log('  2. Click "Import Selected" (enriches with AI)');
    console.log('  3. They move to "pending" status');
  }
  
  if (pending > 0) {
    console.log('\n  ⏳ You have ' + pending + ' pending startups');
    console.log('  📍 Go to: http://localhost:5173/admin/edit-startups');
    console.log('  1. Review startups');
    console.log('  2. Click ✅ button to approve');
    console.log('  3. They become visible on site');
  }
  
  console.log('\n');
  process.exit(0);
})();
