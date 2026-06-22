'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REGISTRY_PATH = path.join(__dirname, '../../agents/product/opportunity-registry.json');

function loadRegistry() {
  const raw = fs.readFileSync(REGISTRY_PATH, 'utf8');
  return JSON.parse(raw);
}

async function syncRegistryToDb(supabase) {
  const registry = loadRegistry();
  const rows = (registry.opportunities || []).map((o) => ({
    opportunity_id: o.id,
    domain: o.domain,
    priority: o.priority || 'P2',
    status: o.status || 'idea',
    title: o.title,
    problem: o.problem || null,
    hypothesis: o.hypothesis || null,
    metric: o.metric || null,
    baseline: o.baseline ?? null,
    target: o.target || null,
    next_step: o.next_step || null,
    related_experiments: o.related_experiments || [],
    payload: o,
    updated_at: new Date().toISOString(),
  }));

  if (!rows.length) return { synced: 0 };

  const { error } = await supabase.from('product_opportunities').upsert(rows, {
    onConflict: 'opportunity_id',
  });
  if (error) throw error;
  return { synced: rows.length };
}

module.exports = { loadRegistry, syncRegistryToDb, REGISTRY_PATH };
