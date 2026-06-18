'use strict';

/**
 * Investor Read — Act 1 reveal payload
 * Mirrors what partners see: company scores, founder proxies, consensus map, hot-company gap.
 */

const COMPONENT_LABELS = {
  team: 'Team',
  traction: 'Traction',
  market: 'Market',
  product: 'Product',
  vision: 'Vision',
};

const HOT_THRESHOLD = 72;
const GOOD_THRESHOLD = 55;

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function textLen(...parts) {
  return parts.filter(Boolean).join(' ').trim().length;
}

/**
 * Lightweight founder DNA proxies from public startup data (no wizard required).
 */
function buildFounderRead(startup) {
  const extracted =
    startup.extracted_data && typeof startup.extracted_data === 'object'
      ? startup.extracted_data
      : {};

  const narrativeLen = textLen(startup.tagline, startup.pitch, startup.description, extracted.product_description);
  const narrativePower = clamp(Math.round(narrativeLen / 25), 3, 9);

  const hasTraction =
    startup.has_revenue ||
    startup.has_customers ||
    (startup.customer_count && startup.customer_count > 0) ||
    (startup.mrr && startup.mrr > 0);
  const signalReading = clamp(
    (hasTraction ? 6 : 4) +
      (startup.growth_rate_monthly && startup.growth_rate_monthly > 10 ? 2 : 0) +
      (startup.is_launched ? 1 : 0),
    3,
    9,
  );

  const technicalDepth = clamp(
    Math.round((startup.product_score || 40) / 12) +
      (extracted.tech_stack || extracted.technical_details ? 1 : 0),
    3,
    9,
  );

  const teamComplete = clamp(Math.round((startup.team_score || 40) / 11), 3, 9);

  const timingAwareness = clamp(Math.round((startup.market_score || 40) / 12), 3, 9);

  const coachabilityProxy = clamp(
    5 +
      (startup.data_completeness && startup.data_completeness > 0.6 ? 1 : 0) +
      (narrativeLen > 120 ? 1 : 0) +
      (startup.is_launched ? 1 : 0),
    4,
    9,
  );

  const scores = [
    { key: 'signal_reading', label: 'Signal reading', score: signalReading, note: hasTraction ? 'Early traction visible in public signals' : 'Market signal not yet visible publicly' },
    { key: 'narrative', label: 'Narrative power', score: narrativePower, note: narrativeLen > 80 ? 'Clear positioning on site' : 'Story is thin in scraped content' },
    { key: 'technical_depth', label: 'Technical depth', score: technicalDepth, note: technicalDepth >= 6 ? 'Product depth reads credibly' : 'Hard to verify build depth from public data' },
    { key: 'coachability', label: 'Coachability proxy', score: coachabilityProxy, note: 'Based on profile completeness + shipped artifacts' },
  ];

  const avg = scores.reduce((s, x) => s + x.score, 0) / scores.length;
  let archetype = 'Builder-operator';
  if (timingAwareness >= 7 && narrativePower >= 6) archetype = 'Market reader';
  else if (technicalDepth >= 7) archetype = 'Technical founder';
  else if (narrativePower >= 7) archetype = 'Story-driven founder';
  else if (teamComplete <= 4) archetype = 'Solo builder';

  const summary =
    avg >= 7
      ? 'Partners would read you as high-conviction on founder-market fit — the debate is company stage, not capability.'
      : avg >= 5.5
        ? 'Mixed partner read: strong angles exist, but some partners will flag gaps before advocating in Monday meeting.'
        : 'Associate-level pass risk: thesis may fit, but partner would need more evidence before fighting for a slot.';

  return {
    archetype_label: archetype,
    proxies: scores.map(({ label, score, note }) => ({ label, score, max: 10, note })),
    composite: Math.round(avg * 10),
    summary,
  };
}

function classifyInvestorVerdict(matchScore, godScore, weakestKey) {
  if (matchScore >= 78 && godScore >= HOT_THRESHOLD - 8) return 'partner_advocate';
  if (matchScore >= 70 && godScore >= GOOD_THRESHOLD) return 'partner_advocate';
  if (matchScore >= 62 && godScore < GOOD_THRESHOLD) return 'associate_pass';
  if (matchScore >= 55 && godScore < HOT_THRESHOLD - 5) return 'associate_pass';
  if (matchScore < 55) return 'filtered';
  return 'borderline';
}

const VERDICT_COPY = {
  partner_advocate: 'Would likely advance to partner meeting',
  associate_pass: 'Associate pass — thesis fit, company not hot enough yet',
  borderline: 'Split vote — depends which partner owns the sector',
  filtered: 'Low thesis fit at this stage',
};

function buildConsensusMap(matches, godScore, weakestKey) {
  const top = (matches || []).slice(0, 5).map((m) => {
    const inv = m.investors || {};
    const matchScore = Math.round(m.match_score || 0);
    const verdict = classifyInvestorVerdict(matchScore, godScore, weakestKey);
    const tags = Array.isArray(m.why_you_match) ? m.why_you_match : [];
    const reason =
      m.reasoning ||
      tags.slice(0, 2).join(' · ') ||
      'Thesis alignment from sector and stage signals';

    return {
      id: m.id,
      name: inv.name || 'Unknown',
      firm: inv.firm || 'Unknown firm',
      match_score: matchScore,
      verdict,
      verdict_label: VERDICT_COPY[verdict],
      reason: String(reason).slice(0, 220),
      is_super: tags.some((t) => String(t).includes('SUPER')),
    };
  });

  const advocates = top.filter((i) => i.verdict === 'partner_advocate').length;
  const passes = top.filter((i) => i.verdict === 'associate_pass').length;
  const borderline = top.filter((i) => i.verdict === 'borderline').length;

  let explanation;
  if (advocates >= 3) {
    explanation =
      'Strong consensus among top matches — multiple partners would likely compete for this deal if traction confirms the story.';
  } else if (passes >= 3 && advocates === 0) {
    explanation =
      'Thesis fit is real, but partners would pass at associate level today. The gap is company readiness, not investor interest.';
  } else if (borderline >= 2 || (advocates > 0 && passes > 0)) {
    explanation =
      'Partner split is expected — seed GPs love the market read; growth partners want more traction. This is why spray-and-pray fails.';
  } else if (top.length === 0) {
    explanation = 'Matches still generating — consensus map will populate as investors are scored.';
  } else {
    explanation =
      'Early signal: a few firms align on thesis. Closing the hottest gap moves associate passes toward partner advocates.';
  }

  return {
    investors: top,
    partner_advocates: advocates,
    associate_passes: passes,
    borderline,
    explanation,
  };
}

function buildHotCompanyGap(startup, components, gapTasks) {
  const god = startup.total_god_score || 0;
  const sorted = [...components].sort((a, b) => a.score - b.score);
  const weakest = sorted[0];
  const strongest = sorted[sorted.length - 1];

  const isHot = god >= HOT_THRESHOLD;
  const isGood = god >= GOOD_THRESHOLD;

  let headline = "You're building a good company.";
  if (isHot) headline = "You're approaching hot-company territory.";
  else if (!isGood) headline = "You're early — investors see potential, not inevitability yet.";

  const gapLines = {
    team: 'a credible technical co-founder or advisor bench partners can name in the room',
    traction: 'one falsifiable traction proof — paying customer or real MRR — that ends the pre-revenue debate',
    market: 'a crisp "why now" with a sourced TAM partners can repeat internally',
    product: 'a live product demo that eliminates "is this real?" in the first 5 minutes',
    vision: 'a one-sentence mission partners can advocate without explaining',
  };

  const gapLine = isHot
    ? `To stay hot: sharpen ${COMPONENT_LABELS[weakest.key].toLowerCase()} before the round gets noisy.`
    : `What would make you hot: ${gapLines[weakest.key] || 'close your weakest GOD dimension'}.`;

  const topUnlock = gapTasks[0]
    ? {
        task_key: gapTasks[0].task_key,
        title: gapTasks[0].title,
        component: gapTasks[0].component,
        impact_points: gapTasks[0].impact_points,
        investors_unlocked_estimate: Math.min(
          40,
          Math.max(8, Math.round((HOT_THRESHOLD - god) * 1.2 + gapTasks[0].impact_points)),
        ),
      }
    : null;

  return {
    headline,
    gap_line: gapLine,
    weakest_component: weakest.key,
    strongest_component: strongest.key,
    god_score: god,
    hot_threshold: HOT_THRESHOLD,
    top_unlock: topUnlock,
  };
}

function buildHiddenAdvantages(startup, components) {
  const advantages = [];
  const sorted = [...components].sort((a, b) => b.score - a.score);
  const strongest = sorted[0];
  const weakest = sorted[sorted.length - 1];

  if (strongest.score >= 60 && strongest.key !== weakest.key) {
    advantages.push({
      title: `Hidden edge: ${COMPONENT_LABELS[strongest.key]}`,
      body: `Most founders in your cohort lead with product. Your strongest public signal is ${COMPONENT_LABELS[strongest.key].toLowerCase()} (${strongest.score}/100) — but it may not be front-and-center on your site yet.`,
    });
  }

  const sectors = Array.isArray(startup.sectors) ? startup.sectors : [];
  if (sectors.length >= 2) {
    advantages.push({
      title: 'Cross-sector positioning',
      body: `You span ${sectors.slice(0, 3).join(' + ')} — partners who hunt intersection deals may see a non-obvious angle others miss.`,
    });
  } else if (startup.market_score >= 58) {
    advantages.push({
      title: 'Timing signal',
      body: 'Market score suggests a credible "why now" — investors who bet on inflection points may read this before traction catches up.',
    });
  }

  if (startup.is_launched && (startup.traction_score || 0) < 50) {
    advantages.push({
      title: 'Shipped before traction',
      body: 'You have a live product without heavy revenue signaling — some partners prefer learning velocity over early MRR for your stage.',
    });
  }

  return advantages.slice(0, 2);
}

function buildFundingPath(startup, godScore, founderRead) {
  const stage = startup.stage;
  const stageNum = typeof stage === 'number' ? stage : parseInt(String(stage || ''), 10);

  if (godScore >= HOT_THRESHOLD && founderRead.composite >= 65) {
    return {
      label: 'Institutional seed / Series A',
      note: 'Profile matches partner-advocate pattern at thesis-aligned firms. Round is viable with targeted outreach.',
    };
  }
  if (godScore >= GOOD_THRESHOLD) {
    return {
      label: 'Selective institutional + strong angels',
      note: 'Good company, not yet hot everywhere. Close top gap before broad VC outreach — quality over volume.',
    };
  }
  if (stageNum === 1 || stageNum === 0 || stage === 'pre-seed' || stage === 'Pre-Seed') {
    return {
      label: 'Angels, pre-seed funds, accelerators',
      note: 'YC-style honesty: institutional partners may pass until traction and team signals cross their floor. Build proof first.',
    };
  }
  return {
    label: 'Angels + milestone-driven path',
    note: 'Not a moral judgment — many great companies fund outside classic VC. Close one high-impact gap to reopen institutional doors.',
  };
}

/**
 * @param {object} startup - startup_uploads row
 * @param {object[]} matches - startup_investor_matches with investors join
 * @param {object[]} gapTasks - from deriveGapTasks()
 */
function buildInvestorReadPayload(startup, matches, gapTasks) {
  const components = [
    { key: 'team', score: startup.team_score ?? 0 },
    { key: 'traction', score: startup.traction_score ?? 0 },
    { key: 'market', score: startup.market_score ?? 0 },
    { key: 'product', score: startup.product_score ?? 0 },
    { key: 'vision', score: startup.vision_score ?? 0 },
  ];

  const weakestKey = [...components].sort((a, b) => a.score - b.score)[0].key;
  const godScore = startup.total_god_score ?? 0;
  const founderRead = buildFounderRead(startup);
  const consensusMap = buildConsensusMap(matches, godScore, weakestKey);
  const hotCompanyGap = buildHotCompanyGap(startup, components, gapTasks);
  const hiddenAdvantages = buildHiddenAdvantages(startup, components);
  const fundingPath = buildFundingPath(startup, godScore, founderRead);

  return {
    startup_id: startup.id,
    startup_name: startup.name || 'Your startup',
    website: startup.website || null,
    sectors: startup.sectors || [],
    stage: startup.stage,
    god_score: godScore,
    score_components: Object.fromEntries(components.map((c) => [c.key, c.score])),
    founder_read: founderRead,
    consensus_map: consensusMap,
    hot_company_gap: hotCompanyGap,
    hidden_advantages: hiddenAdvantages,
    funding_path: fundingPath,
    match_count: (matches || []).length,
  };
}

module.exports = {
  buildInvestorReadPayload,
  buildFounderRead,
  buildConsensusMap,
  buildHotCompanyGap,
};
