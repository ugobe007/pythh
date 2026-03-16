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

  // Sector filter: sectors is JSONB array; use contains for first sector, then in-memory for rest
  if (sectors.length > 0) {
    query = query.contains('sectors', [sectors[0]]);
  }

  // Text search: name (safe single-column ilike)
  if (q.length >= 2) {
    const safeQ = q.replace(/'/g, "''");
    query = query.or(`name.ilike.%${safeQ}%,tagline.ilike.%${safeQ}%,pitch.ilike.%${safeQ}%,description.ilike.%${safeQ}%`);
  }

  const { data, error, count } = await query;

  if (error) {
    throw error;
  }

  let rows = data || [];
  // If we had multiple sectors, filter in memory (sectors overlap)
  if (sectors.length > 1) {
    const sectorSet = new Set(sectors.map(s => s.toLowerCase()));
    rows = rows.filter((r) => {
      const list = Array.isArray(r.sectors) ? r.sectors : [];
      return list.some((s) => sectorSet.has(String(s).toLowerCase()));
    });
  }

  const total = count != null ? count : rows.length;
  const hasMore = offset + rows.length < total;

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

module.exports = {
  searchStartups,
  getThesisCriteria,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
};
