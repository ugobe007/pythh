#!/usr/bin/env node
/**
 * Analyze Faith Signals - What patterns are VCs talking about?
 */

import { config } from 'dotenv';
config({ path: '.env.bak' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function analyzeFaithSignals() {
  console.log('\n🔍 Faith Signal Analysis\n');

  // Get all faith signals
  const { data: signals, error } = await supabase
    .from('vc_faith_signals')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  if (!signals || signals.length === 0) {
    console.log('No faith signals found yet.');
    return;
  }

  console.log(`📊 Total Signals: ${signals.length}`);
  console.log(`👥 Unique Investors: ${new Set(signals.map(s => s.investor_id)).size}\n`);

  // Analyze categories (themes/ontologies)
  const categoryCount: Record<string, number> = {};
  const categoryConviction: Record<string, number[]> = {};

  signals.forEach(sig => {
    if (sig.categories && Array.isArray(sig.categories)) {
      sig.categories.forEach((cat: string) => {
        categoryCount[cat] = (categoryCount[cat] || 0) + 1;
        categoryConviction[cat] = categoryConviction[cat] || [];
        categoryConviction[cat].push(sig.conviction || 0);
      });
    }
  });

  // Sort by frequency
  const topCategories = Object.entries(categoryCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  console.log('🏷️  Top 20 Themes/Categories VCs Are Talking About:\n');
  topCategories.forEach(([cat, count], idx) => {
    const avgConviction = (
      categoryConviction[cat].reduce((a, b) => a + b, 0) / categoryConviction[cat].length
    ).toFixed(2);
    console.log(`${(idx + 1).toString().padStart(2)}. ${cat.padEnd(30)} (${count} mentions, avg conviction: ${avgConviction})`);
  });

  // Analyze signal types
  console.log('\n📝 Signal Types:\n');
  const typeCount: Record<string, number> = {};
  signals.forEach(sig => {
    typeCount[sig.signal_type] = (typeCount[sig.signal_type] || 0) + 1;
  });
  Object.entries(typeCount)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`   ${type.padEnd(20)} ${count}`);
    });

  // Conviction analysis
  const convictions = signals.map(s => s.conviction || 0).filter(c => c > 0);
  const avgConviction = convictions.reduce((a, b) => a + b, 0) / convictions.length;
  const highConviction = convictions.filter(c => c >= 0.8).length;
  const lowConviction = convictions.filter(c => c < 0.5).length;

  console.log('\n💪 Conviction Levels:\n');
  console.log(`   Average: ${avgConviction.toFixed(2)}`);
  console.log(`   High (≥0.8): ${highConviction} (${((highConviction / convictions.length) * 100).toFixed(1)}%)`);
  console.log(`   Low (<0.5): ${lowConviction} (${((lowConviction / convictions.length) * 100).toFixed(1)}%)`);

  // Sample high-conviction signals
  console.log('\n🔥 Sample High-Conviction Signals (conviction ≥ 0.9):\n');
  const highConvictionSignals = signals
    .filter(s => s.conviction >= 0.9)
    .slice(0, 5);

  highConvictionSignals.forEach((sig, idx) => {
    console.log(`${idx + 1}. [${sig.categories?.join(', ')}] (conviction: ${sig.conviction})`);
    console.log(`   "${sig.signal_text.substring(0, 150)}..."\n`);
  });

  // ML/Embedding usage check
  console.log('🤖 ML Pipeline Status:\n');
  const { data: investorEmbeddings } = await supabase
    .from('investors')
    .select('embedding')
    .not('embedding', 'is', null);

  const { data: startupEmbeddings } = await supabase
    .from('startup_uploads')
    .select('embedding')
    .not('embedding', 'is', null);

  console.log(`   Investor embeddings: ${investorEmbeddings?.length || 0}`);
  console.log(`   Startup embeddings: ${startupEmbeddings?.length || 0}`);
  console.log(`   Faith signal extraction: ✅ Using GPT-4 (OpenAI)`);
  console.log(`   Faith matching: ⚠️  Heuristic (keyword-based) - embeddings available for upgrade\n`);

  // GOD score integration
  console.log('⚡ GOD Score Integration:\n');
  console.log('   Current: Faith signals are SEPARATE from GOD scores');
  console.log('   - GOD scores: Startup intrinsic quality (team, traction, market)');
  console.log('   - Faith signals: VC psychology/beliefs about future');
  console.log('   - Integration: Faith validation gives +5 bonus for GOD score >70');
  console.log('\n   Potential enhancement: Use faith signal patterns to INFORM GOD scoring');
  console.log('   (e.g., if top VCs all believe in "climate tech", boost climate startups)\n');
}

analyzeFaithSignals().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
