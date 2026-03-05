const { createClient } = require('@supabase/supabase-js');
require('dotenv/config');
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  // Check the former top scorer
  const { data: upscale } = await sb.from('startup_uploads')
    .select('name, total_god_score, team_score, traction_score, market_score, product_score, vision_score, extracted_data')
    .ilike('name', '%Upscale%')
    .limit(3);

  console.log('=== Former top scorers ===');
  for (const s of (upscale || [])) {
    const ws = s.extracted_data?.web_signals;
    console.log(`${s.name}: GOD=${s.total_god_score} team=${s.team_score} traction=${s.traction_score} market=${s.market_score} product=${s.product_score} vision=${s.vision_score}`);
    console.log(`  web_signals: blog=${ws?.blog?.post_count ?? 'null'} t1=${ws?.press?.tier1_count ?? 'null'} infer_mentions=${ws?.reddit?.mention_count ?? 'null'}`);
  }

  // Check a few more former high scorers
  const names = ['Housetrak', 'Nango', 'Deepgram', 'Hebbia', 'Palona AI'];
  for (const n of names) {
    const { data } = await sb.from('startup_uploads')
      .select('name, total_god_score, extracted_data')
      .ilike('name', `%${n}%`)
      .limit(1);
    if (data?.[0]) {
      const ws = data[0].extracted_data?.web_signals;
      console.log(`${data[0].name}: GOD=${data[0].total_god_score}  t1=${ws?.press?.tier1_count ?? 'null'}  infer=${ws?.reddit?.mention_count ?? 'null'}`);
    }
  }

  // Check score-recalc last run time
  const { data: logs } = await sb.from('ai_logs')
    .select('created_at, message')
    .like('message', '%recalcul%')
    .order('created_at', { ascending: false })
    .limit(5);
  console.log('\n=== Recent recalc activity ===');
  (logs || []).forEach(l => console.log(new Date(l.created_at).toLocaleString(), '|', l.message?.slice(0, 100)));
})();
