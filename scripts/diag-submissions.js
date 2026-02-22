require('dotenv').config({ path: '/Users/leguplabs/Desktop/hot-honey/.env' });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY);

(async () => {
  // Recent submissions
  const { data: recent, error: e1 } = await sb.from('startup_uploads')
    .select('id, name, website, company_website, source_url, company_domain, status, total_god_score, created_at, tagline, description, team_score, traction_score, market_score, product_score, vision_score')
    .order('created_at', { ascending: false })
    .limit(15);

  if (e1) { console.error('Query error:', e1.message); process.exit(1); }

  console.log('=== RECENT 15 SUBMISSIONS ===');
  recent.forEach(s => {
    const issues = [];
    if (s.website === null && s.company_website === null) issues.push('NO_URL');
    if (s.name === null) issues.push('NO_NAME');
    if (s.total_god_score === null || s.total_god_score === 0) issues.push('NO_SCORE');
    if (!s.description || s.description.length < 20) issues.push('SPARSE_DESC');
    if (s.tagline && s.tagline.startsWith('Startup at')) issues.push('PLACEHOLDER_TAGLINE');
    const allScores = [s.team_score, s.traction_score, s.market_score, s.product_score, s.vision_score];
    if (allScores.every(x => x === null || x === 0)) issues.push('NO_COMPONENTS');
    console.log(
      new Date(s.created_at).toISOString().slice(0,16),
      '|', s.status.padEnd(8),
      '| GOD:', String(s.total_god_score || 0).padStart(3),
      '|', (s.name || '?').substring(0,28).padEnd(28),
      '| issues:', issues.join(',') || 'OK'
    );
  });

  // Status counts
  const { data: all } = await sb.from('startup_uploads').select('status').limit(20000);
  const byStatus = {};
  all.forEach(r => { byStatus[r.status] = (byStatus[r.status] || 0) + 1; });
  console.log('\n=== STATUS COUNTS ===');
  Object.entries(byStatus).sort(([,a],[,b]) => b - a).forEach(([k, v]) => console.log(k + ':', v));

  // Null score count among approved
  const { count: nullScores } = await sb.from('startup_uploads')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'approved')
    .is('total_god_score', null);
  
  const { count: zeroScores } = await sb.from('startup_uploads')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'approved')
    .eq('total_god_score', 0);

  console.log('\n=== SCORE GAPS (approved) ===');
  console.log('Null total_god_score:', nullScores);
  console.log('Zero total_god_score:', zeroScores);

  // Check RPC functions exist
  const { error: rpcErr } = await sb.rpc('resolve_startup_by_url', { p_url: 'https://example.com' });
  console.log('\n=== RPC resolve_startup_by_url ===');
  if (rpcErr && rpcErr.code === 'PGRST202') {
    console.log('MISSING - function does not exist!');
  } else if (rpcErr) {
    console.log('Error:', rpcErr.message, '(code:', rpcErr.code + ')');
  } else {
    console.log('OK - function exists');
  }

  const { error: rpcErr2 } = await sb.rpc('get_startup_context', { p_website: 'https://example.com' });
  console.log('=== RPC get_startup_context ===');
  if (rpcErr2 && rpcErr2.code === 'PGRST202') {
    console.log('MISSING - function does not exist!');
  } else if (rpcErr2) {
    console.log('Error:', rpcErr2.message, '(code:', rpcErr2.code + ')');
  } else {
    console.log('OK - function exists');
  }

  // Pending count
  const { count: pendingCount } = await sb.from('startup_uploads')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');
  console.log('\n=== PENDING APPROVAL QUEUE ===');
  console.log('Pending review:', pendingCount);

  process.exit(0);
})();
