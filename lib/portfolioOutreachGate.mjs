/**
 * Block Peter / founder outreach for portfolio positions that fail integrity gates.
 */

const MATURE_ENTRY_USD = 200_000_000;

/** Wrong-company or unverified-mark positions (portfolio pick names). */
export const ENTITY_QUARANTINE_BY_NAME = {
  Shockwave: 'Entity error — Shockwave Medical / Galvanize, not Oracle pick',
  Neon: 'Entity collision — Brazil fintech vs Postgres Neon vs media',
  Ultra: 'Entity collision — Ultra Maritime vs Ultra nicotine pouches',
  Seven: 'Not a startup — real estate DST portfolio headline',
  Tigris: 'Wrong company — Detroit bar/café headline matched',
  MinecraftLM: 'Unverified 7.61× mark — no press-confirmed round',
  Zuora: 'Entered after Silver Lake take-private — no seed-stage alpha',
  Playlist: 'MOIC artifact — entered at implied seed vs multi-billion exit',
  'Zero Billion': 'RSS headline junk — not a real startup entity',
  'Australian AI': 'Geographic category headline — not a fundable company',
  'MI308 AI': 'Entity collision — AMD MI308 chip export news, not a startup round',
  CAPTCHA: 'Unverified 50× mark — bot/SaaS headline junk, no press-confirmed round',
};

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 * @returns {Promise<{ blockedIds: Set<string>, reasons: Map<string, string> }>}
 */
export async function loadOutreachBlockedStartups(sb) {
  const blockedIds = new Set();
  const reasons = new Map();

  const add = (id, reason) => {
    if (!id) return;
    blockedIds.add(id);
    if (!reasons.has(id)) reasons.set(id, reason);
  };

  const { data: picks, error } = await sb
    .from('virtual_portfolio')
    .select('startup_id, entity_quarantined, entity_quarantine_reason, entered_late, status, moic, entry_valuation_usd, startup_uploads(name)')
    .in('status', ['active', 'acquired', 'exited']);

  if (error) throw error;

  for (const row of picks || []) {
    const su = Array.isArray(row.startup_uploads) ? row.startup_uploads[0] : row.startup_uploads;
    const name = su?.name || '';
    const id = row.startup_id;

    if (row.entity_quarantined) {
      add(id, row.entity_quarantine_reason || `Entity quarantined (${name})`);
      continue;
    }

    const staticReason = ENTITY_QUARANTINE_BY_NAME[name];
    if (staticReason) {
      add(id, staticReason);
      continue;
    }

    // Only gate live picks for entered-late / laggard MOIC — not historical acquired rows
    if (row.status !== 'active') continue;

    if (row.entered_late) {
      add(id, `Entered-late portfolio pick ($${Math.round((Number(row.entry_valuation_usd) || 0) / 1e6)}M entry)`);
    }

    if (row.moic != null && Number(row.moic) < 1) {
      add(id, `Portfolio laggard (MOIC ${Number(row.moic).toFixed(2)}×)`);
    }
  }

  // Static quarantine map — block by name even when no active virtual_portfolio row
  const staticNames = Object.keys(ENTITY_QUARANTINE_BY_NAME);
  if (staticNames.length) {
    const { data: namedRows, error: nameErr } = await sb
      .from('startup_uploads')
      .select('id, name')
      .in('name', staticNames);
    if (!nameErr) {
      for (const row of namedRows || []) {
        add(row.id, ENTITY_QUARANTINE_BY_NAME[row.name]);
      }
    }
  }

  const { data: healthRows, error: healthErr } = await sb
    .from('portfolio_health')
    .select('startup_id, startup_name, health_tier, god_delta, entity_quarantined')
    .eq('status', 'active')
    .in('health_tier', ['review', 'quarantined']);

  if (!healthErr) {
    for (const h of healthRows || []) {
      if (h.health_tier === 'quarantined' || h.entity_quarantined) {
        add(h.startup_id, `Portfolio quarantined (${h.startup_name})`);
      } else if (h.health_tier === 'review') {
        add(h.startup_id, `Portfolio Review tier (GOD Δ ${h.god_delta ?? '?'})`);
      }
    }
  }

  return { blockedIds, reasons };
}

export function isOutreachBlocked(startupId, blockedIds) {
  return blockedIds.has(startupId);
}

export { MATURE_ENTRY_USD };
