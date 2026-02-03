require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function analyzeOtherEvents() {
  const { data, error } = await supabase
    .from('startup_events')
    .select('source_title, source_publisher, created_at, notes')
    .eq('event_type', 'OTHER')
    .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`\n📊 Analyzing ${data.length} recent OTHER events (last 48h)\n`);
  
  const categories = {
    non_event: [],        // Opinion, analysis, questions
    future_tense: [],     // Plans to, will, aims to
    noun_first: [],       // "$50M round", "Series B funding"
    passive: [],          // "Secured by", "Raised by"
    compound: [],         // Multiple events in one
    missing_entity: [],   // No clear startup name
    weak_signal: [],      // Has verb but low confidence
    unclear: []           // Unknown pattern
  };

  data.forEach(event => {
    const title = event.source_title || '';
    const lower = title.toLowerCase();
    
    // 1. Non-event patterns (should be filtered)
    if (/^(why|how|what|opinion|analysis|commentary|podcast|interview)/i.test(title) || title.endsWith('?')) {
      categories.non_event.push(title);
    }
    // 2. Future tense (not actual events)
    else if (/\b(will|plans to|aims to|expects to|intends to|looking to|seeking to|to raise|to launch|to acquire)/i.test(title)) {
      categories.future_tense.push(title);
    }
    // 3. Noun-first patterns (need noun-phrase matching)
    else if (/^\$\d+/i.test(title) || /^(seed|series [a-f]|growth)\s+(round|funding)/i.test(title)) {
      categories.noun_first.push(title);
    }
    // 4. Passive voice
    else if (/\b(secured|raised|launched|acquired|announced|completed)\s+by\b/i.test(title)) {
      categories.passive.push(title);
    }
    // 5. Compound events
    else if ((title.match(/\band\b/gi) || []).length >= 2) {
      categories.compound.push(title);
    }
    // 6. Missing clear entity (no company/startup name pattern)
    else if (!/\b(startup|company|firm|corp|inc|ltd)\b/i.test(title) && !/^[A-Z][a-z]+([A-Z][a-z]+)*/.test(title)) {
      categories.missing_entity.push(title);
    }
    // 7. Has verb but weak (check for known verbs)
    else if (/\b(raise|land|bag|snag|grab|acquire|launch|partner|announce|close|secure|introduce|reveal|release)/i.test(title)) {
      categories.weak_signal.push(title);
    }
    else {
      categories.unclear.push(title);
    }
  });

  // Print results with priorities
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('📈 CATEGORIZATION RESULTS (Priority Order):\n');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const priorities = [
    { key: 'non_event', label: '🔴 NON-EVENTS (filter these)', priority: 'HIGH' },
    { key: 'noun_first', label: '🟡 NOUN-FIRST PATTERNS', priority: 'HIGH' },
    { key: 'future_tense', label: '🟡 FUTURE TENSE', priority: 'MEDIUM' },
    { key: 'weak_signal', label: '🟢 WEAK SIGNALS (has verb)', priority: 'MEDIUM' },
    { key: 'passive', label: '🟢 PASSIVE VOICE', priority: 'LOW' },
    { key: 'compound', label: '🟢 COMPOUND EVENTS', priority: 'LOW' },
    { key: 'missing_entity', label: '⚪ MISSING ENTITY', priority: 'LOW' },
    { key: 'unclear', label: '⚫ UNCLEAR', priority: 'LOW' }
  ];
  
  priorities.forEach(({ key, label, priority }) => {
    const items = categories[key];
    const pct = ((items.length / data.length) * 100).toFixed(1);
    console.log(`${label}: ${items.length} (${pct}%) - Priority: ${priority}`);
    if (items.length > 0) {
      items.slice(0, 3).forEach(title => console.log(`  • ${title}`));
      console.log('');
    }
  });

  // Summary recommendations
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('💡 RECOMMENDED FIXES:\n');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const nonEventPct = (categories.non_event.length / data.length * 100).toFixed(0);
  const nounFirstPct = (categories.noun_first.length / data.length * 100).toFixed(0);
  const futurePct = (categories.future_tense.length / data.length * 100).toFixed(0);
  
  console.log(`1. 🔴 Filter non-events (~${nonEventPct}% impact)`);
  console.log(`   Add to event-classifier.js NON_EVENT_PATTERNS`);
  console.log('');
  console.log(`2. 🟡 Add noun-first patterns (~${nounFirstPct}% impact)`);
  console.log(`   Match "$50M round", "Series B funding" structures`);
  console.log('');
  console.log(`3. 🟡 Filter future tense (~${futurePct}% impact)`);
  console.log(`   Reject "plans to raise", "will launch"`);
  console.log('');
  console.log(`4. 🟢 Lower confidence threshold (0.6 → 0.5)`);
  console.log(`   May capture weak signals currently rejected`);
  console.log('');
}

analyzeOtherEvents().catch(console.error);
