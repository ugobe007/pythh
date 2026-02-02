#!/usr/bin/env node
/**
 * Batch Faith Signal Extractor (OpenAI Version)
 * Uses GPT-4 instead of Claude for VC belief extraction
 */

import { config } from 'dotenv';
config({ path: '.env.bak' });

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { createHash } from 'crypto';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
const openaiKey = process.env.VITE_OPENAI_API_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);
const openai = new OpenAI({ apiKey: openaiKey });

interface Investor {
  id: string;
  name: string;
  firm: string;
  blog_url: string | null;
  linkedin_url: string | null;
  investment_thesis: string | null;
}

interface ExtractedSignal {
  signal_text: string;
  signal_type: string;
  categories: string[];
  conviction: number;
  confidence: number;
}

function parseArgs() {
  const args = process.argv.slice(2);
  let limit = 50;
  let minNameLength = 5;
  let onlyWithBlogUrl = true;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--all') {
      limit = 999999;
    } else if (args[i] === '--include-no-urls') {
      onlyWithBlogUrl = false;
    }
  }

  return { limit, minNameLength, onlyWithBlogUrl };
}

async function fetchInvestors(limit: number, minNameLength: number, onlyWithBlogUrl: boolean) {
  let query = supabase
    .from('investors')
    .select('id, name, firm, blog_url, linkedin_url, investment_thesis')
    .order('name');

  if (onlyWithBlogUrl) {
    query = query.not('blog_url', 'is', null);
  }

  const { data, error } = await query.limit(limit);

  if (error) throw error;

  return (data || []).filter(inv => 
    inv.name && inv.name.length >= minNameLength
  );
}

async function fetchTextFromUrl(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return text.substring(0, 50000);
  } catch (err: any) {
    throw new Error(`Fetch failed: ${err.message}`);
  }
}

async function callOpenAI(content: string, investorName: string): Promise<ExtractedSignal[]> {
  const prompt = `You are analyzing a VC's blog, thesis page, or interview. Extract their FORWARD-LOOKING BELIEFS about what will succeed in the future.

Source: ${investorName}
Content: ${content}

Extract 3-10 faith signals (beliefs, predictions, investment theses). For each:
- signal_text: The belief statement (1-3 sentences, quote if possible)
- signal_type: MUST be one of: "thesis" | "interview" | "blog" | "fund_announcement" | "tweet" | "podcast"
- categories: Array of themes (e.g., ["AI", "infrastructure", "developer tools"])
- conviction: 0.0-1.0 (how strongly they believe this)
- confidence: 0.0-1.0 (how certain you are this is their real belief)

Return ONLY valid JSON array:
[
  {
    "signal_text": "...",
    "signal_type": "blog",
    "categories": ["AI", "B2B"],
    "conviction": 0.9,
    "confidence": 0.85
  }
]`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are a VC thesis analyst. Extract investment beliefs as structured JSON.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.3,
    max_tokens: 2000,
  });

  const responseText = response.choices[0].message.content || '[]';
  
  const jsonMatch = responseText.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('No JSON array found in response');
  }

  const signals = JSON.parse(jsonMatch[0]);
  
  // Validate and fix signal_type
  const validTypes = ['thesis', 'interview', 'blog', 'fund_announcement', 'tweet', 'podcast'];
  return signals.map((sig: ExtractedSignal) => ({
    ...sig,
    signal_type: validTypes.includes(sig.signal_type) ? sig.signal_type : 'blog'
  }));
}

function hashSignal(investorId: string, signalText: string): string {
  return createHash('sha256')
    .update(`${investorId}:${signalText}`)
    .digest('hex');
}

async function upsertSignals(investorId: string, investorName: string, sourceUrl: string, signals: ExtractedSignal[]) {
  const rows = signals.map(sig => ({
    investor_id: investorId,
    signal_text: sig.signal_text,
    signal_type: sig.signal_type,
    categories: sig.categories,
    conviction: sig.conviction,
    confidence: sig.confidence,
    source_url: sourceUrl,
    signal_hash: hashSignal(investorId, sig.signal_text),
  }));

  const { error } = await supabase
    .from('vc_faith_signals')
    .upsert(rows, { onConflict: 'investor_id,signal_hash' });

  if (error) throw error;
  return rows.length;
}

async function processInvestor(investor: Investor): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    let content = '';
    let sourceUrl = '';

    if (investor.blog_url) {
      sourceUrl = investor.blog_url;
      content = await fetchTextFromUrl(investor.blog_url);
    } else if (investor.investment_thesis && investor.investment_thesis.length > 200) {
      sourceUrl = 'database:investment_thesis';
      content = investor.investment_thesis;
    } else {
      return { success: false, count: 0, error: 'No URL or thesis' };
    }

    const signals = await callOpenAI(content, investor.name);

    if (signals.length === 0) {
      return { success: false, count: 0, error: 'No signals extracted' };
    }

    const count = await upsertSignals(investor.id, investor.name, sourceUrl, signals);

    return { success: true, count };
  } catch (err: any) {
    return { success: false, count: 0, error: err.message };
  }
}

async function main() {
  const { limit, minNameLength, onlyWithBlogUrl } = parseArgs();

  console.log('\n🔮 Batch Faith Signal Extractor (OpenAI GPT-4)\n');
  console.log(`📊 Config: limit=${limit}, minNameLength=${minNameLength}, onlyWithBlogUrl=${onlyWithBlogUrl}\n`);

  console.log('📥 Fetching investors...');
  const investors = await fetchInvestors(limit, minNameLength, onlyWithBlogUrl);
  console.log(`✅ Found ${investors.length} investors to process\n`);

  if (investors.length === 0) {
    console.log('⚠️  No investors found with blog URLs. Add blog_url data first.');
    process.exit(0);
  }

  let totalSignals = 0;
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < investors.length; i++) {
    const inv = investors[i];
    const progress = `[${i + 1}/${investors.length}]`;

    process.stdout.write(`${progress} ${inv.name.padEnd(30)} ... `);

    const result = await processInvestor(inv);

    if (result.success) {
      console.log(`✅ ${result.count} signals`);
      totalSignals += result.count;
      successCount++;
    } else {
      console.log(`❌ ${result.error}`);
      failCount++;
    }

    // Rate limiting
    if (i < investors.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }

  console.log('\n📊 Summary:');
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log(`   🔮 Total signals: ${totalSignals}`);
  console.log(`\n💡 Next: npx tsx scripts/faith-validation-engine.ts --limit 500\n`);
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
