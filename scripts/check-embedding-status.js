#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  const { count: totalS } = await sb.from('startup_uploads').select('id', { count: 'exact', head: true }).eq('status','approved');
  const { count: noEmbS } = await sb.from('startup_uploads').select('id', { count: 'exact', head: true }).eq('status','approved').is('embedding', null);
  const { count: totalI } = await sb.from('investors').select('id', { count: 'exact', head: true });
  const { count: noEmbI } = await sb.from('investors').select('id', { count: 'exact', head: true }).is('embedding', null);
  
  console.log('=== Embedding Coverage ===');
  console.log('Startups: ' + (totalS - noEmbS) + '/' + totalS + ' have embeddings (' + noEmbS + ' remaining)');
  console.log('Investors: ' + (totalI - noEmbI) + '/' + totalI + ' have embeddings (' + noEmbI + ' remaining)');
  
  const remaining = noEmbS + noEmbI;
  const mins = Math.ceil((remaining / 20) * 0.5);
  console.log('Est. time remaining: ~' + mins + ' minutes (' + remaining + ' records at ~20/30s)');
  process.exit(0);
})();
