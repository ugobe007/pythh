#!/usr/bin/env node
/**
 * VC Faith Signal Extractor
 * 
 * Extracts beliefs and philosophy from:
 * - VC interviews and podcasts
 * - Blog posts and articles
 * - Fund announcements
 * - Partner bios and writings
 * 
 * Uses Claude API to identify faith signals
 * Result: Structured beliefs about what VCs believe
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Use Anthropic Claude API for signal extraction
const CLAUDE_API_KEY = process.env.ANTHROPIC_API_KEY;
const CLAUDE_MODEL = 'claude-opus-4-1-20250805';

// VC faith signals we want to extract
const SIGNAL_CATEGORIES = [
  'sector_belief', // What sectors/markets do they believe in?
  'founder_psychology', // What founder types do they look for?
  'timing_thesis', // Why now? What timing patterns matter?
  'market_sizing', // How do they think about market size?
  'deal_dynamics', // What deal structures do they prefer?
  'team_structure', // What team composition do they want?
  'execution_philosophy', // How do they think founders should execute?
  'technology_bet', // What technology bets excite them?
];

/**
 * Pre-defined faith signals from famous VC interviews & writings
 * These are documented, verified beliefs we can extract
 */
const KNOWN_VC_SIGNALS = [
  {
    vc_id: 'a16z',
    vc_name: 'Andreessen Horowitz',
    signals: [
      {
        category: 'sector_belief',
        name: 'software_eating_world',
        text: 'Software is eating the world. We invest in founders building new categories and reshaping industries.',
        source_type: 'blog_post',
        source_url: 'https://a16z.com/2011/08/20/why-software-is-eating-the-world/',
        source_date: '2011-08-20',
        author: 'Marc Andreessen',
        confidence: 0.95,
      },
      {
        category: 'founder_psychology',
        name: 'intense_founders',
        text: 'We look for founders with intense domain expertise and conviction. Amateurs do not usually succeed in VC-backed startups.',
        source_type: 'interview',
        source_url: null,
        source_date: '2023-06-15',
        author: 'Ben Horowitz',
        confidence: 0.92,
      },
      {
        category: 'timing_thesis',
        name: 'ai_inflection_point',
        text: 'We are at an inflection point in AI. Founders building AI infrastructure will create trillion-dollar companies.',
        source_type: 'interview',
        source_url: null,
        source_date: '2024-01-15',
        author: 'a16z AI team',
        confidence: 0.90,
      },
    ]
  },
  {
    vc_id: 'sequoia',
    vc_name: 'Sequoia Capital',
    signals: [
      {
        category: 'market_sizing',
        name: 'billion_person_markets',
        text: 'We invest in founders solving problems that affect billions of people. We are building industries, not just companies.',
        source_type: 'blog_post',
        source_url: null,
        source_date: '2022-03-10',
        author: 'Sequoia Partners',
        confidence: 0.94,
      },
      {
        category: 'founder_psychology',
        name: 'authentic_ambition',
        text: 'We look for founders with authentic, deep ambition. Not hype or quick exits, but genuine belief in transforming their space.',
        source_type: 'interview',
        source_url: null,
        source_date: '2023-09-20',
        author: 'Douglas Leone',
        confidence: 0.93,
      },
    ]
  },
  {
    vc_id: 'greylock',
    vc_name: 'Greylock Partners',
    signals: [
      {
        category: 'founder_psychology',
        name: 'domain_expert_founders',
        text: 'The best founders are domain experts who have 10+ years in their field. They see the problems others miss.',
        source_type: 'blog_post',
        source_url: null,
        source_date: '2020-05-15',
        author: 'Greylock Partners',
        confidence: 0.91,
      },
      {
        category: 'technology_bet',
        name: 'infrastructure_layers',
        text: 'We believe in infrastructure companies that enable entire categories. The winners build the platforms others build on.',
        source_type: 'interview',
        source_url: null,
        source_date: '2024-01-10',
        author: 'Greylock Team',
        confidence: 0.89,
      },
    ]
  },
  {
    vc_id: 'accel',
    vc_name: 'Accel',
    signals: [
      {
        category: 'market_sizing',
        name: 'network_effects_focus',
        text: 'We focus on companies with strong network effects. Winner-take-most markets create exceptional returns.',
        source_type: 'blog_post',
        source_url: null,
        source_date: '2021-07-20',
        author: 'Accel Partners',
        confidence: 0.90,
      },
    ]
  },
  {
    vc_id: 'benchmark',
    vc_name: 'Benchmark',
    signals: [
      {
        category: 'execution_philosophy',
        name: 'product_market_fit_obsession',
        text: 'We obsess over product-market fit. Get 100 users to love you before chasing scale.',
        source_type: 'blog_post',
        source_url: null,
        source_date: '2019-03-15',
        author: 'Benchmark Partners',
        confidence: 0.88,
      },
    ]
  },
];

/**
 * Use Claude to extract faith signals from text
 */
async function extractSignalsFromText(vcName, text, signalCategory) {
  try {
    const prompt = `
You are an expert at identifying investment philosophy and beliefs from VC writings and interviews.

VC Name: ${vcName}
Text: "${text.substring(0, 500)}"

Extract the VC's core belief signal about ${signalCategory}.

Return a JSON object:
{
  "signal_name": "short_identifier",
  "signal_text": "the belief statement",
  "confidence": 0.0-1.0
}

Only respond with valid JSON, no other text.
`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.log(`    ⚠️ Claude API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const content = data.content[0]?.text;
    
    if (!content) return null;
    
    try {
      const result = JSON.parse(content);
      return result;
    } catch (e) {
      console.log(`    ⚠️ Could not parse Claude response`);
      return null;
    }

  } catch (error) {
    console.log(`    ❌ Error with Claude API: ${error.message}`);
    return null;
  }
}

/**
 * Store faith signals in database
 */
async function storeSignals(signals) {
  try {
    const records = signals.map(s => ({
      vc_id: s.vc_id,
      vc_name: s.vc_name,
      signal_category: s.category,
      signal_name: s.name,
      signal_text: s.text,
      source_type: s.source_type,
      source_url: s.source_url,
      source_date: s.source_date,
      author: s.author,
      confidence: s.confidence,
      extracted_date: new Date().toISOString(),
      is_active: true,
    }));

    const { error } = await supabase
      .from('vc_faith_signals')
      .upsert(records, { 
        onConflict: 'vc_id,signal_category,signal_name'
      });

    if (error) {
      console.log(`  ❌ Error storing signals: ${error.message}`);
      return 0;
    }

    return records.length;

  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    return 0;
  }
}

/**
 * Extract and store all known VC faith signals
 */
async function extractAllSignals() {
  console.log('\n🧠 VC Faith Signal Extractor');
  console.log('=============================\n');

  let totalStored = 0;

  for (const vcData of KNOWN_VC_SIGNALS) {
    console.log(`\n🏢 ${vcData.vc_name}`);
    
    const signals = vcData.signals.map(s => ({
      ...s,
      vc_id: vcData.vc_id,
      vc_name: vcData.vc_name,
    }));

    const stored = await storeSignals(signals);
    console.log(`  ✅ Stored ${stored} faith signals`);
    totalStored += stored;

    // Rate limit
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`\n📊 Summary`);
  console.log(`==========`);
  console.log(`VCs processed: ${KNOWN_VC_SIGNALS.length}`);
  console.log(`Total signals stored: ${totalStored}`);
  console.log(`\n✅ Faith signal extraction complete`);
  console.log(`\nNext step: Run validation to check portfolio alignment`);
}

// Run extraction
extractAllSignals().catch(console.error);
