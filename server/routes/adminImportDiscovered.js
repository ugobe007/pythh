// server/routes/adminImportDiscovered.js
import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('[adminImportDiscovered] ⚠️  Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}
if (!OPENAI_API_KEY) {
  console.warn('[adminImportDiscovered] ⚠️  Missing OPENAI_API_KEY - import will fail');
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function withTimeout(ms) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  return { ac, done: () => clearTimeout(t) };
}

async function enrichStartup({ name, website, description, funding_amount, funding_stage }) {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured on server');

  const { ac, done } = withTimeout(8000);
  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: ac.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.6,
        response_format: { type: 'json_object' },
        messages: [
          { 
            role: 'system', 
            content: 'Create JSON: pitch (<=200 chars), fivePoints (5 short strings), industry, stage, funding. JSON only.' 
          },
          { 
            role: 'user', 
            content: `Company: ${name}\nWebsite: ${website || 'N/A'}\nDescription: ${description || 'N/A'}\nFunding: ${funding_amount || 'N/A'} at ${funding_stage || 'N/A'}` 
          },
        ],
      }),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`OpenAI ${resp.status}: ${text}`);
    }

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error('OpenAI response missing content');
    return JSON.parse(content);
  } finally {
    done();
  }
}

router.post('/import-discovered', async (req, res) => {
  try {
    const discovered_ids = req.body?.discovered_ids;
    if (!Array.isArray(discovered_ids) || discovered_ids.length === 0) {
      return res.status(400).json({ error: 'discovered_ids must be a non-empty array' });
    }

    console.log(`[adminImportDiscovered] Processing ${discovered_ids.length} startups`);

    // Fetch discovered rows
    const { data: discoveredRows, error: dErr } = await supabaseAdmin
      .from('discovered_startups')
      .select('id,name,website,description,funding_amount,funding_stage,imported_to_startups')
      .in('id', discovered_ids);

    if (dErr) throw dErr;

    const results = [];
    for (const row of discoveredRows || []) {
      if (row.imported_to_startups) {
        results.push({ ok: true, discovered_id: row.id, error: 'already_imported' });
        continue;
      }

      try {
        console.log(`  [import] ${row.name}`);
        const enriched = await enrichStartup(row);

        // Insert startup_uploads
        const { data: inserted, error: iErr } = await supabaseAdmin
          .from('startup_uploads')
          .insert({
            name: row.name,
            tagline: (enriched.pitch || row.name || '').slice(0, 200),
            pitch: row.description || '',
            status: 'pending',
            source_type: 'rss_discovery',
            extracted_data: {
              fivePoints: enriched.fivePoints || [],
              industry: enriched.industry || 'Unknown',
              stage: enriched.stage || 'Unknown',
              funding: enriched.funding || row.funding_amount || 'Unknown',
              website: row.website || null,
            },
          })
          .select('id')
          .single();

        if (iErr) throw iErr;

        // Mark discovered imported
        const { error: uErr } = await supabaseAdmin
          .from('discovered_startups')
          .update({ imported_to_startups: true })
          .eq('id', row.id);

        if (uErr) throw uErr;

        // Audit log
        await supabaseAdmin.from('admin_actions_log').insert({
          action: 'import_discovered_startup',
          target_type: 'discovered_startup',
          target_id: row.id,
          payload: { discovered_id: row.id, startup_id: inserted.id },
          result: 'ok',
        });

        results.push({ ok: true, discovered_id: row.id, startup_id: inserted.id });
        console.log(`    ✅ Imported → ${inserted.id}`);
      } catch (err) {
        const msg = err?.message || String(err);
        console.error(`    ❌ Failed: ${msg}`);
        
        await supabaseAdmin.from('admin_actions_log').insert({
          action: 'import_discovered_startup',
          target_type: 'discovered_startup',
          target_id: row.id,
          payload: { discovered_id: row.id },
          result: 'error',
          error: msg,
        });
        
        results.push({ ok: false, discovered_id: row.id, error: msg });
      }
    }

    console.log(`[adminImportDiscovered] Complete: ${results.filter(r => r.ok).length}/${results.length} succeeded`);
    res.json({ results });
  } catch (err) {
    console.error('[adminImportDiscovered] Fatal error:', err);
    res.status(500).json({ error: err?.message || String(err) });
  }
});

export default router;
