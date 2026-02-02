#!/usr/bin/env node
/**
 * Batch Faith Signal Extractor
 * Automatically extracts VC belief statements from all investors with blog/thesis URLs
 */

import { config } from 'dotenv';
config({ path: '.env.bak' });

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { createHash } from 'crypto';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
const anthropicKey = process.env.ANTHROPIC_API_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);
const anthropic = new Anthropic({ apiKey: anthropicKey });

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

// Parse command line args
function parseArgs() {
  const args = process.argv.slice(2);
  let limit = 50; // Process 50 investors by default
  let minNameLength = 5; // Filter out generic/placeholder names
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

// Fetch investors with blog URLs
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

  // Filter out generic names
  return (data || []).filter(inv => 
    inv.name && inv.name.length >= minNameLength
  );
}

// Fetch content from URL
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
    
    // Basic HTML stripping - extract text content
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return text.substring(0, 50000); // Limit to 50k chars
  } catch (err: any) {
    throw new Error(`Fetch failed: ${err.message}`);
  }
}

// Call Claude to extract faith signals
async function callClaude(content: string, investorName: string): Promise<ExtractedSignal[]> {
  const prompt = `You are analyzing a VC's blog, thesis page, or interview. Extract their FORWARD-LOOKING BELIEFS about what will succeed in the future.

Source: ${investorName}
Content: ${content}

Extract 3-10 faith signals (beliefs, predictions, investment theses). For each:
- signal_text: The belief statement (1-3 sentences, quote if possible)
- signal_type: "thesis" | "prediction" | "belief" | "conviction"
- categories: Array of themes (e.g., ["AI", "infrastructure", "developer tools"])
- conviction: 0.0-1.0 (how strongly they believe this)
- confidence: 0.0-1.0 (how certain you are this is their real belief)

Return ONLY valid JSON array:
[
  {
    "signal_text": "...",
    "signal_type": "thesis",
    "categories": ["AI", "B2B"],
    "conviction": 0.9,
    "confidence": 0.85
  }
]`;

  const message = await anthropic.messages.create({
    model: 'claude-3-sonnet-20240229',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const responseText = (message.content[0] as any).text;
  
  // Parse JSON from response
  const jsonMatch = responseText.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('No JSON array found in Claude response');
  }

  return JSON.parse(jsonMatch[0]);
}

// Generate hash for deduplication
function hashSignal(investorId: string, signalText: string): string {
  return createHash('sha256')
    .update(`${investorId}:${signalText}`)
    .digest('hex');
}

// Upsert signals to database
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

// Process one investor
async function processInvestor(investor: Investor): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    // Try blog_url first, fall back to investment_thesis
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

    // Extract signals via Claude
    const signals = await callClaude(content, investor.name);

    if (signals.length === 0) {
      return { success: false, count: 0, error: 'No signals extracted' };
    }

    // Store in database
    const count = await upsertSignals(investor.id, investor.name, sourceUrl, signals);

    return { success: true, count };
  } catch (err: any) {
    return { success: false, count: 0, error: err.message };
  }
}

// Main
async function main() {
  const { limit, minNameLength, onlyWithBlogUrl } = parseArgs();

  console.log('\n🔮 Batch Faith Signal Extractor\n');
  console.log(`📊 Config: limit=${limit}, minNameLength=${minNameLength}, onlyWithBlogUrl=${onlyWithBlogUrl}\n`);

  // Fetch investors
  console.log('📥 Fetching investors...');
  const investors = await fetchInvestors(limit, minNameLength, onlyWithBlogUrl);
  console.log(`✅ Found ${investors.length} investors to process\n`);

  if (investors.length === 0) {
    console.log('⚠️  No investors found with blog URLs. Add blog_url data first.');
    process.exit(0);
  }

  // Process each investor
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

    // Rate limiting - wait 2 seconds between Claude API calls
    if (i < investors.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
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
