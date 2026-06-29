'use strict';

/**
 * Weekly public thesis report — sector-level Thesis Fit Index + outbound copy.
 * Used by: scripts/weekly-thesis-report.mjs
 */

const {
  getCanonicalSector,
  normalizeSectors,
  expandRelatedSectors,
} = require('./sectorTaxonomy');
const { paginateStartupUploads } = require('./supabaseClient');

const GOD_STRONG = 70;
const ACTIVE_VELOCITY_MIN = 2.0;
const INVESTOR_PAGE = 1000;

/** Broad tags that dominate multi-label rows — skip for auto-picked weekly sector. */
const AUTO_PICK_EXCLUDE = new Set([
  'Technology',
  'Consumer',
  'Gaming',
  'Climate',
  'Media',
  'Enterprise',
  'SaaS',
]);

function daysAgo(n) {
  return new Date(Date.now() - n * 86_400_000);
}

function ctaUrl(siteBase, channel) {
  const base = siteBase.replace(/\/$/, '');
  return `${base}/find-investors?utm_source=${channel}&utm_medium=social&utm_campaign=thesis_fit`;
}

function startupCanonicalSectors(startup) {
  return normalizeSectors(startup.sectors || []);
}

function primarySector(startup) {
  const sectors = startupCanonicalSectors(startup);
  return sectors[0] || null;
}

function investorCanonicalSectors(investor) {
  return normalizeSectors(investor.sectors || []);
}

function sectorExpanded(sector) {
  return expandRelatedSectors([sector]);
}

function startupInSector(startup, sector) {
  const primary = primarySector(startup);
  if (!primary) return false;
  return sectorExpanded(sector).includes(primary);
}

function investorInSector(investor, sector) {
  const expanded = sectorExpanded(sector);
  return investorCanonicalSectors(investor).some((s) => expanded.includes(s));
}

function isEarlyStageInvestor(investor) {
  const raw = investor.stage;
  const stages = Array.isArray(raw)
    ? raw.map(String)
    : typeof raw === 'string'
      ? raw.split(/[,/|]/).map((s) => s.trim())
      : [];
  const joined = stages.join(' ').toLowerCase();
  return /pre[- ]?seed|seed(?!\s*[b-z]{2,})/i.test(joined) || joined.includes('early');
}

function isActiveDeployer(investor) {
  const v = investor.deployment_velocity_index;
  return typeof v === 'number' && v >= ACTIVE_VELOCITY_MIN;
}

function isAiSlop(startup) {
  const raw = Array.isArray(startup.sectors) ? startup.sectors.join(' ') : String(startup.sectors || '');
  const aiTagged = /ai|ml|llm|gen\s*ai|machine learning/i.test(raw);
  const score = startup.total_god_score ?? 0;
  return aiTagged && score < 50;
}

async function paginateInvestors(supabase, selectColumns) {
  const all = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('investors')
      .select(selectColumns)
      .order('id', { ascending: true })
      .range(from, from + INVESTOR_PAGE - 1);
    if (error) throw error;
    if (!data?.length) break;
    all.push(...data);
    if (data.length < INVESTOR_PAGE) break;
    from += INVESTOR_PAGE;
  }
  return all;
}

function buildSectorStats(startups, { since7d, since14d }) {
  const stats = new Map();

  const touch = (sector) => {
    if (!stats.has(sector)) {
      stats.set(sector, {
        sector,
        total: 0,
        god70_plus: 0,
        god80_plus: 0,
        new_7d: 0,
        prev_7d: 0,
        slop_count: 0,
        top_startups: [],
      });
    }
    return stats.get(sector);
  };

  for (const s of startups) {
    const sector = primarySector(s);
    if (!sector) continue;

    const created = s.created_at ? new Date(s.created_at) : null;
    const in7d = created && created >= since7d;
    const inPrev7d = created && created >= since14d && created < since7d;
    const score = s.total_god_score ?? 0;
    const slop = isAiSlop(s);

    const row = touch(sector);
    row.total += 1;
    if (score >= GOD_STRONG) row.god70_plus += 1;
    if (score >= 80) row.god80_plus += 1;
    if (in7d) row.new_7d += 1;
    if (inPrev7d) row.prev_7d += 1;
    if (slop) row.slop_count += 1;

    if (score >= GOD_STRONG && s.name) {
      row.top_startups.push({
        name: s.name,
        score,
        stage: s.stage || null,
      });
    }
  }

  for (const row of stats.values()) {
    row.top_startups.sort((a, b) => b.score - a.score);
    row.top_startups = row.top_startups.slice(0, 5);
    row.signal_delta = row.new_7d - row.prev_7d;
    row.slop_filter_pct =
      row.total > 0 ? Math.round((row.slop_count / row.total) * 1000) / 10 : 0;
    row.god70_pct =
      row.total > 0 ? Math.round((row.god70_plus / row.total) * 1000) / 10 : 0;
  }

  return stats;
}

function pickFeaturedSector(sectorStats, forcedSector) {
  if (forcedSector) {
    const canonical = getCanonicalSector(forcedSector) || forcedSector;
    if (!sectorStats.has(canonical)) {
      throw new Error(
        `Sector "${forcedSector}" not found in approved startup data (canonical: ${canonical})`,
      );
    }
    return canonical;
  }

  let best = null;
  let bestScore = -1;

  for (const row of sectorStats.values()) {
    if (row.total < 5) continue;
    if (AUTO_PICK_EXCLUDE.has(row.sector)) continue;
    const score = row.new_7d * 3 + row.god70_plus * 2 + row.total * 0.05;
    if (score > bestScore) {
      bestScore = score;
      best = row.sector;
    }
  }

  if (!best) {
    const fallback = [...sectorStats.values()]
      .filter((r) => r.total >= 5 && !AUTO_PICK_EXCLUDE.has(r.sector))
      .sort((a, b) => b.god70_plus - a.god70_plus)[0];
    if (!fallback) {
      const any = [...sectorStats.values()].sort((a, b) => b.total - a.total)[0];
      if (!any) throw new Error('No sector data available from approved startups');
      return any.sector;
    }
    return fallback.sector;
  }

  return best;
}

function investorStatsForSector(investors, sector) {
  const inSector = investors.filter((i) => investorInSector(i, sector));
  const active = inSector.filter(isActiveDeployer);
  const early = inSector.filter(isEarlyStageInvestor);
  const activeEarly = inSector.filter((i) => isActiveDeployer(i) && isEarlyStageInvestor(i));

  return {
    total: inSector.length,
    active_deploy: active.length,
    early_stage: early.length,
    active_early_stage: activeEarly.length,
  };
}

function formatDelta(n) {
  if (n > 0) return `+${n}`;
  return String(n);
}

function renderMarkdown(report, siteBase) {
  const s = report.sector;
  const delta = formatDelta(s.signal_delta);
  const lines = [
    `# Pythh Weekly: ${report.featured_sector} Thesis Fit`,
    '',
    `Generated: ${report.generated_at}`,
    '',
    '## Thesis Fit Index',
    '',
    `- **${s.god70_plus}** startups scored **70+** in ${report.featured_sector} (${s.god70_pct}% of sector pipeline)`,
    `- **${s.investors.active_early_stage || s.investors.early_stage}** investors covering pre-seed/seed in this sector`,
    `- **${s.investors.active_deploy}** actively deploying (velocity ≥ ${ACTIVE_VELOCITY_MIN})`,
    '',
    '## Signal Delta (7d)',
    '',
    `- **${s.new_7d}** new approved startups this week (${delta} vs prior 7d)`,
    `- **${s.god80_plus}** at elite tier (80+ GOD)`,
    '',
    '## Slop Filter',
    '',
    `- **${s.slop_filter_pct}%** of sector rows are AI-tagged but score <50 (noise, not signal)`,
    `- Compare to **${s.god70_plus}** thesis-fit names at 70+`,
    '',
  ];

  if (s.top_startups.length) {
    lines.push('## Top names (GOD 70+)', '');
    for (const t of s.top_startups) {
      lines.push(`- **${t.name}** — GOD ${t.score}${t.stage ? ` · ${t.stage}` : ''}`);
    }
    lines.push('');
  }

  lines.push(
    '## CTA',
    '',
    `Paste your URL → ranked investor shortlist in ~20s:`,
    '',
    ctaUrl(siteBase, 'weekly_report'),
    '',
  );

  return lines.join('\n');
}

function renderLinkedIn(report, siteBase) {
  const s = report.sector;
  const delta = formatDelta(s.signal_delta);
  const example =
    s.top_startups[0]?.name
      ? `Example: ${s.top_startups[0].name} scored ${s.top_startups[0].score} on our GOD rubric.`
      : '';

  return [
    `Pythh Weekly — ${report.featured_sector} thesis fit`,
    '',
    `This week: ${s.god70_plus} startups scored 70+ in ${report.featured_sector}. Only ${s.investors.active_early_stage || s.investors.early_stage} investors are actively covering pre-seed/seed here.`,
    '',
    `Signal delta: ${s.new_7d} new names (${delta} vs last week). Slop filter: ${s.slop_filter_pct}% AI-tagged noise under score 50.`,
    example,
    '',
    'Paste your startup URL → see your ranked shortlist in ~20 seconds (free preview):',
    ctaUrl(siteBase, 'linkedin'),
  ]
    .filter(Boolean)
    .join('\n\n');
}

function renderX(report, siteBase) {
  const s = report.sector;
  return [
    `Pythh Weekly: ${report.featured_sector}`,
    `${s.god70_plus} startups at GOD 70+ · ${s.investors.active_early_stage || s.investors.early_stage} pre-seed/seed investors · ${s.new_7d} new this week`,
    '',
    'Paste your URL → thesis-fit investors in ~20s:',
    ctaUrl(siteBase, 'x'),
  ].join('\n');
}

function renderReddit(report, siteBase) {
  const s = report.sector;
  return {
    title: `[Data] ${report.featured_sector}: ${s.god70_plus} startups scored 70+ this week — ${s.investors.active_early_stage || s.investors.early_stage} investors actually deploying pre-seed/seed`,
    body: [
      `We run a scored startup pipeline at Pythh and publish a weekly sector snapshot.`,
      '',
      `**${report.featured_sector} this week:**`,
      `- ${s.god70_plus} startups at GOD 70+ (${s.god70_pct}% of sector pipeline)`,
      `- ${s.new_7d} new approved names (${formatDelta(s.signal_delta)} vs prior week)`,
      `- ${s.investors.active_early_stage || s.investors.early_stage} investors covering pre-seed/seed; ${s.investors.active_deploy} actively deploying`,
      `- Slop filter: ${s.slop_filter_pct}% AI-tagged rows score under 50 — most "AI startup" lists are noise`,
      '',
      s.top_startups.length
        ? `Top scored: ${s.top_startups.slice(0, 3).map((t) => `${t.name} (${t.score})`).join(', ')}`
        : '',
      '',
      'Free preview — paste your URL, get a ranked investor shortlist:',
      ctaUrl(siteBase, 'reddit_startups'),
      '',
      'Happy to explain how GOD scoring works. Looking for founder feedback.',
    ]
      .filter(Boolean)
      .join('\n'),
    submitUrl: 'https://www.reddit.com/r/startups/submit',
  };
}

function renderQueueMarkdown(report, siteBase) {
  const reddit = renderReddit(report, siteBase);
  return [
    `# Outbound queue — weekly thesis (${report.report_date})`,
    '',
    `Featured sector: **${report.featured_sector}**`,
    '',
    `Track UTMs: \`page_view\` / \`url_submitted\` with \`utm_campaign=thesis_fit\``,
    '',
    '---',
    '',
    '## LinkedIn',
    '',
    renderLinkedIn(report, siteBase),
    '',
    '---',
    '',
    '## X / Twitter',
    '',
    renderX(report, siteBase),
    '',
    '---',
    '',
    '## Reddit — r/startups',
    '',
    `**Title:** ${reddit.title}`,
    '',
    '**Body:**',
    '',
    '```',
    reddit.body,
    '```',
    '',
    `Submit: ${reddit.submitUrl}`,
    '',
    '---',
    '',
    '## Full brief',
    '',
    renderMarkdown(report, siteBase),
  ].join('\n');
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ sector?: string, days?: number, siteBase?: string }} [options]
 */
async function generateWeeklyThesisReport(supabase, options = {}) {
  const days = options.days ?? 7;
  const siteBase = (options.siteBase || process.env.SITE_URL || 'https://pythh.ai').replace(/\/$/, '');
  const since7d = daysAgo(days);
  const since14d = daysAgo(days * 2);
  const generated_at = new Date().toISOString();
  const report_date = generated_at.slice(0, 10);

  const startups = await paginateStartupUploads(
    supabase,
    'id, name, sectors, stage, total_god_score, created_at, status',
    (q) => q.eq('status', 'approved'),
  );

  const investors = await paginateInvestors(
    supabase,
    'id, name, sectors, stage, deployment_velocity_index',
  );

  const sectorStats = buildSectorStats(startups, { since7d, since14d });
  const featured_sector = pickFeaturedSector(sectorStats, options.sector || null);
  const sectorRow = sectorStats.get(featured_sector);
  const inv = investorStatsForSector(investors, featured_sector);

  const report = {
    generated_at,
    report_date,
    report_type: 'weekly_thesis_fit',
    featured_sector,
    days_window: days,
    global: {
      approved_startups: startups.length,
      investors_profiled: investors.length,
      sectors_tracked: sectorStats.size,
    },
    sector: {
      ...sectorRow,
      investors: inv,
    },
    sector_rankings: [...sectorStats.values()]
      .sort((a, b) => b.new_7d * 3 + b.god70_plus * 2 - (a.new_7d * 3 + a.god70_plus * 2))
      .slice(0, 10)
      .map(({ sector, total, god70_plus, new_7d, signal_delta }) => ({
        sector,
        total,
        god70_plus,
        new_7d,
        signal_delta,
      })),
    cta: ctaUrl(siteBase, 'weekly_report'),
    social: {
      linkedin: renderLinkedIn({ featured_sector, sector: { ...sectorRow, investors: inv } }, siteBase),
      x: renderX({ featured_sector, sector: { ...sectorRow, investors: inv } }, siteBase),
      reddit: renderReddit({ featured_sector, sector: { ...sectorRow, investors: inv } }, siteBase),
    },
  };

  return {
    report,
    markdown: renderMarkdown({ featured_sector, sector: { ...sectorRow, investors: inv }, generated_at }, siteBase),
    queueMarkdown: renderQueueMarkdown(report, siteBase),
  };
}

module.exports = {
  generateWeeklyThesisReport,
  renderMarkdown,
  renderLinkedIn,
  renderX,
  renderReddit,
  renderQueueMarkdown,
  GOD_STRONG,
  ACTIVE_VELOCITY_MIN,
};
