/**
 * INVESTOR LOOKUP SERVICE
 * =======================
 * Search and filter PYTHH's approved startups for VCs building curated portfolios.
 * - Search by sector, stage, GOD score range, text
 * - Optional: rank by thesis fit when investor profile is provided
 */

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

/**
 * Normalize stage for filter (stage_estimate values in DB)
 */
function normalizeStage(stage) {
  if (!stage || typeof stage !== 'string') return null;
  const s = stage.toLowerCase().trim();
  const map = {
    'pre-seed': 'pre-seed',
    'preseed': 'pre-seed',
    'seed': 'seed',
    'series a': 'series-a',
    'series-a': 'series-a',
    'series b': 'series-b',
    'series-b': 'series-b',
    'series c': 'series-c',
    'series-c': 'series-c',
  };
  return map[s] || s;
}

/**
 * Search approved startups with filters.
 * @param {object} supabase - Supabase client
 * @param {object} opts - { q?, sectors[], stage?, minScore?, maxScore?, limit?, offset? }
 * @returns {Promise<{ rows: object[], total: number, hasMore: boolean }>}
 */
async function searchStartups(supabase, opts = {}) {
  const limit = Math.min(
    parseInt(opts.limit, 10) || DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE
  );
  const offset = Math.max(0, parseInt(opts.offset, 10) || 0);
  const minScore = opts.minScore != null ? Number(opts.minScore) : null;
  const maxScore = opts.maxScore != null ? Number(opts.maxScore) : null;
  const stage = opts.stage ? normalizeStage(opts.stage) : null;
  const sectors = Array.isArray(opts.sectors)
    ? opts.sectors.filter(Boolean).map(s => String(s).trim())
    : [];
  const q = typeof opts.q === 'string' ? opts.q.trim() : '';

  let query = supabase
    .from('startup_uploads')
    .select(
      'id, name, tagline, website, sectors, stage_estimate, total_god_score, pitch, description',
      { count: 'exact' }
    )
    .eq('status', 'approved')
    .order('total_god_score', { ascending: false })
    .range(offset, offset + limit - 1);

  if (minScore != null && !isNaN(minScore)) {
    query = query.gte('total_god_score', minScore);
  }
  if (maxScore != null && !isNaN(maxScore)) {
    query = query.lte('total_god_score', maxScore);
  }
  if (stage) {
    query = query.eq('stage_estimate', stage);
  }

  // Sector filter: do in-memory so we're case-insensitive and work with any DB format (jsonb/text[])
  // Fetch more rows when filtering by sector so we have enough after filtering
  const limitForQuery = sectors.length > 0 ? Math.min(limit * 4, MAX_PAGE_SIZE * 2) : limit;
  query = query.range(offset, offset + limitForQuery - 1);

  // Text search: startup name or website URL only (not tagline/pitch/description)
  if (q.length >= 2) {
    const safeQ = q.replace(/'/g, "''");
    query = query.or(`name.ilike.%${safeQ}%,website.ilike.%${safeQ}%`);
  }

  const { data, error, count } = await query;

  if (error) {
    throw error;
  }

  let rows = data || [];
  // Sector filter in memory (case-insensitive overlap)
  if (sectors.length > 0) {
    const sectorSet = new Set(sectors.map((s) => String(s).trim().toLowerCase()));
    rows = rows.filter((r) => {
      const list = Array.isArray(r.sectors) ? r.sectors : (r.sectors ? [r.sectors] : []);
      return list.some((s) => sectorSet.has(String(s).trim().toLowerCase()));
    });
  }
  const filteredCount = rows.length;
  rows = rows.slice(0, limit);
  const total = sectors.length > 0 ? filteredCount : (count != null ? count : rows.length);
  const hasMore = sectors.length > 0 ? filteredCount > limit : offset + rows.length < total;

  return {
    rows: rows.map((r) => ({
      id: r.id,
      name: r.name,
      tagline: r.tagline || null,
      website: r.website || null,
      sectors: r.sectors || [],
      stage_estimate: r.stage_estimate || null,
      total_god_score: r.total_god_score != null ? Math.round(r.total_god_score) : null,
    })),
    total,
    hasMore,
    limit,
    offset,
  };
}

/**
 * Load investor profile and return search opts for "thesis fit" (sectors + stage).
 * @param {object} supabase
 * @param {string} investorId
 * @returns {Promise<{ sectors: string[], stage: string | null } | null>}
 */
async function getThesisCriteria(supabase, investorId) {
  const { data, error } = await supabase
    .from('investors')
    .select('sectors, stage, investment_thesis')
    .eq('id', investorId)
    .maybeSingle();

  if (error || !data) return null;
  const sectors = Array.isArray(data.sectors) ? data.sectors : [];
  const stage = data.stage;
  let stageStr = null;
  if (Array.isArray(stage) && stage.length > 0) {
    stageStr = stage[0];
  } else if (typeof stage === 'string') {
    stageStr = stage;
  }
  return {
    sectors: sectors.map((s) => (typeof s === 'string' ? s : String(s))),
    stage: stageStr ? normalizeStage(stageStr) : null,
  };
}

/**
 * Get one startup by id with detail and recent activity (for review).
 * Recent activity: updated_at, funding/investor mentions from extracted_data, portfolio_events if any.
 */
async function getStartupDetail(supabase, startupId) {
  const { data: startup, error } = await supabase
    .from('startup_uploads')
    .select(
      'id, name, tagline, website, pitch, description, sectors, stage_estimate, total_god_score, updated_at, extracted_data'
    )
    .eq('id', startupId)
    .eq('status', 'approved')
    .single();

  if (error || !startup) return null;

  const extracted = startup.extracted_data || {};
  const activities = [];

  if (startup.updated_at) {
    activities.push({
      type: 'update',
      date: startup.updated_at,
      description: 'Profile or score updated',
    });
  }
  const funding = extracted.funding_mentions || extracted.funding_amount || extracted.last_funding_round;
  if (funding) {
    const arr = Array.isArray(funding) ? funding : [funding];
    arr.slice(0, 3).forEach((f) => {
      const obj = typeof f === 'object' && f !== null ? f : {};
      const desc = obj.round ? `${obj.round}${obj.amount ? ` — ${obj.amount}` : ''}` : String(funding);
      activities.push({ type: 'funding', date: obj.date || startup.updated_at, description: desc || 'Funding' });
    });
  }
  const investors = extracted.investors || extracted.investor_mentions || extracted.backed_by;
  if (investors && (Array.isArray(investors) ? investors.length : 1)) {
    const list = Array.isArray(investors) ? investors.slice(0, 5) : [investors];
    activities.push({
      type: 'investors',
      date: startup.updated_at,
      description: `Investors: ${list.join(', ')}`,
    });
  }
  activities.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  return {
    id: startup.id,
    name: startup.name,
    tagline: startup.tagline || null,
    website: startup.website || null,
    pitch: startup.pitch || null,
    description: startup.description || null,
    sectors: startup.sectors || [],
    stage_estimate: startup.stage_estimate || null,
    total_god_score: startup.total_god_score != null ? Math.round(startup.total_god_score) : null,
    updated_at: startup.updated_at,
    recent_activity: activities.slice(0, 10),
  };
}

const VIRTUAL_PORTFOLIO_LIST_NAME = 'Virtual portfolio';

/**
 * Get or create the investor's "Virtual portfolio" list id.
 */
async function getOrCreateVirtualPortfolioListId(supabase, ownerId) {
  const { data: rows } = await supabase
    .from('investor_curated_lists')
    .select('id, name')
    .eq('owner_id', ownerId)
    .limit(20);
  const existing = (rows || []).find((r) => (r.name || '').trim() === VIRTUAL_PORTFOLIO_LIST_NAME);
  if (existing) return existing.id;

  if (existing?.id) return existing.id;

  const { data: created, error } = await supabase
    .from('investor_curated_lists')
    .insert({ owner_id: ownerId, name: VIRTUAL_PORTFOLIO_LIST_NAME })
    .select('id')
    .single();

  if (error || !created) return null;
  return created.id;
}

/**
 * Get portfolio list with items and recent activity per startup.
 */
async function getPortfolioWithActivity(supabase, ownerId) {
  const listId = await getOrCreateVirtualPortfolioListId(supabase, ownerId);
  if (!listId) return null;

  const { data: list, error: listErr } = await supabase
    .from('investor_curated_lists')
    .select('id, name, created_at, updated_at')
    .eq('id', listId)
    .single();

  if (listErr || !list) return null;

  const { data: items, error: itemsErr } = await supabase
    .from('investor_curated_list_items')
    .select('startup_id, added_at, notes')
    .eq('list_id', listId)
    .order('added_at', { ascending: false });

  if (itemsErr) return null;

  const startupIds = (items || []).map((i) => i.startup_id);
  if (startupIds.length === 0) {
    return { list, items: [], count: 0 };
  }

  const { data: startups, error: suErr } = await supabase
    .from('startup_uploads')
    .select('id, name, tagline, website, sectors, stage_estimate, total_god_score, updated_at, extracted_data')
    .in('id', startupIds);

  if (suErr || !startups) return { list, items: [], count: 0 };

  const byId = Object.fromEntries(startups.map((s) => [s.id, s]));
  const itemsWithActivity = startupIds.map((sid) => {
    const item = items.find((i) => i.startup_id === sid);
    const s = byId[sid];
    const extracted = (s && s.extracted_data) || {};
    const activities = [];
    if (s && s.updated_at) {
      activities.push({ type: 'update', date: s.updated_at, description: 'Updated' });
    }
    const funding = extracted.funding_mentions || extracted.funding_amount;
    if (funding) {
      const arr = Array.isArray(funding) ? funding : [funding];
      arr.slice(0, 2).forEach((f) => {
        const obj = typeof f === 'object' && f !== null ? f : {};
        activities.push({
          type: 'funding',
          date: obj.date || s?.updated_at,
          description: obj.round ? String(obj.round) : String(f),
        });
      });
    }
    activities.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    return {
      startup_id: sid,
      added_at: item?.added_at,
      notes: item?.notes || null,
      name: s?.name,
      tagline: s?.tagline,
      website: s?.website,
      sectors: s?.sectors,
      stage_estimate: s?.stage_estimate,
      total_god_score: s?.total_god_score != null ? Math.round(s.total_god_score) : null,
      updated_at: s?.updated_at,
      recent_activity: activities.slice(0, 5),
    };
  });

  return {
    list: { ...list, id: listId },
    items: itemsWithActivity,
    count: itemsWithActivity.length,
  };
}

module.exports = {
  searchStartups,
  getThesisCriteria,
  getStartupDetail,
  getOrCreateVirtualPortfolioListId,
  getPortfolioWithActivity,
  VIRTUAL_PORTFOLIO_LIST_NAME,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
};
