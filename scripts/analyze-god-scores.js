/**
 * GOD score distribution for approved startups.
 * PostgREST returns at most 1000 rows per request — we paginate to load all rows.
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const PAGE = 1000;

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

async function fetchAllApprovedScores() {
  const rows = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('startup_uploads')
      .select(
        'id, name, total_god_score, team_score, traction_score, market_score, product_score, vision_score, status, created_at',
      )
      .eq('status', 'approved')
      .not('total_god_score', 'is', null)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);

    if (error) {
      throw error;
    }
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

function medianSorted(sortedNums) {
  const n = sortedNums.length;
  if (!n) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 ? sortedNums[mid] : (sortedNums[mid - 1] + sortedNums[mid]) / 2;
}

async function analyzeScores() {
  const scores = await fetchAllApprovedScores();

  if (!scores.length) {
    console.log('No approved startups with GOD scores found.');
    return;
  }

  const numeric = scores.map((s) => Number(s.total_god_score)).filter((x) => !Number.isNaN(x));
  const sorted = [...numeric].sort((a, b) => a - b);
  const n = numeric.length;
  const avg = numeric.reduce((sum, s) => sum + s, 0) / n;
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const med = medianSorted(sorted);

  console.log('\n📊 GOD SCORE DISTRIBUTION (Approved Startups, full count)\n');
  console.log('Total approved (non-null GOD):', n);
  console.log('Average:', avg.toFixed(2));
  console.log('Median:', med);
  console.log('Range:', min, '-', max);

  const buckets = {
    '0-39': 0,
    '40-49': 0,
    '50-59': 0,
    '60-69': 0,
    '70-79': 0,
    '80+': 0,
  };
  numeric.forEach((score) => {
    if (score < 40) buckets['0-39']++;
    else if (score < 50) buckets['40-49']++;
    else if (score < 60) buckets['50-59']++;
    else if (score < 70) buckets['60-69']++;
    else if (score < 80) buckets['70-79']++;
    else buckets['80+']++;
  });

  const maxBucket = Math.max(...Object.values(buckets), 1);
  console.log('\nDistribution:');
  Object.entries(buckets).forEach(([range, count]) => {
    const pct = ((count / n) * 100).toFixed(1);
    const barLen = Math.round((count / maxBucket) * 40);
    const bar = '█'.repeat(barLen);
    console.log(`  ${range}: ${count} (${pct}%) ${bar}`);
  });

  console.log('\n📈 COMPONENT SCORE AVERAGES\n');
  const components = ['team_score', 'traction_score', 'market_score', 'product_score', 'vision_score'];
  components.forEach((comp) => {
    const validScores = scores.filter((s) => s[comp] != null);
    if (validScores.length > 0) {
      const compAvg =
        validScores.reduce((sum, s) => sum + s[comp], 0) / validScores.length;
      console.log(
        `  ${comp.replace('_score', '').toUpperCase()}: ${compAvg.toFixed(2)} (n=${validScores.length})`,
      );
    }
  });

  const byGodDesc = [...scores].sort(
    (a, b) => (b.total_god_score || 0) - (a.total_god_score || 0),
  );
  const byGodAsc = [...scores].sort(
    (a, b) => (a.total_god_score || 0) - (b.total_god_score || 0),
  );

  console.log('\n🏆 TOP 10 STARTUPS\n');
  byGodDesc.slice(0, 10).forEach((s, i) => {
    console.log(`${i + 1}. ${s.name} - GOD: ${s.total_god_score}`);
    console.log(
      `   T:${s.team_score ?? 'N/A'} TR:${s.traction_score ?? 'N/A'} M:${s.market_score ?? 'N/A'} P:${s.product_score ?? 'N/A'} V:${s.vision_score ?? 'N/A'}`,
    );
  });

  console.log('\n⚠️  BOTTOM 10 STARTUPS\n');
  byGodAsc.slice(0, 10).forEach((s, i) => {
    console.log(`${i + 1}. ${s.name} - GOD: ${s.total_god_score}`);
    console.log(
      `   T:${s.team_score ?? 'N/A'} TR:${s.traction_score ?? 'N/A'} M:${s.market_score ?? 'N/A'} P:${s.product_score ?? 'N/A'} V:${s.vision_score ?? 'N/A'}`,
    );
  });
}

analyzeScores()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
