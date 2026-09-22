'use strict';

/**
 * Daily Signal trend agent.
 *
 * Reads the compiled newsletter edition (plus yesterday's edition when present)
 * and writes a short report on *underlying* drivers of investor choice:
 * optics / attention, team shape, growth rates, receptivity shifts.
 *
 * Does not rematch, retune GOD/fit, or invent pair/portfolio numbers.
 */

function yesterdayDate(date) {
  const d = new Date(`${date || new Date().toISOString().slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function pillarValue(startup, label) {
  const hit = (startup?.pillars || []).find((p) => String(p.label).toLowerCase() === label);
  return Number(hit?.value) || 0;
}

function signalHint(startup) {
  const why = String(startup?.why || '');
  const m = why.match(/live signal:\s*([^·]+)/i);
  return (m ? m[1] : '').trim();
}

function looksSolo(startup) {
  const why = String(startup?.why || '').toLowerCase();
  if (startup?.repeat_founder || /repeat founder/.test(why)) return false;
  const team = pillarValue(startup, 'team');
  return team > 0 && team < 55;
}

function looksOptics(startup) {
  const why = String(startup?.why || '').toLowerCase();
  const hint = signalHint(startup).toLowerCase();
  return /news momentum|press|mention/.test(`${why} ${hint}`) || Number(startup?.signals?.news_momentum) >= 0.8;
}

function looksGrowth(startup) {
  const traction = pillarValue(startup, 'traction');
  const why = String(startup?.why || '').toLowerCase();
  return traction >= 80 || /growth|arr|mrr|revenue/.test(why);
}

function collectEvidence(edition, prior) {
  const hottest = edition?.hottestStartups || [];
  const leading = edition?.signalsThatMatter?.leading || null;
  const money = edition?.moneyMoves || edition?.fundingRounds || [];
  const matches = edition?.topMatches || edition?.hotMatches || [];
  const sectors = edition?.sectorTrends || [];
  const news = [...(edition?.vcNews || []), ...(edition?.radarNews || [])];

  const opticsNames = hottest.filter(looksOptics).map((s) => s.name).filter(Boolean);
  const soloNames = hottest.filter(looksSolo).map((s) => s.name).filter(Boolean);
  const growthNames = hottest.filter(looksGrowth).map((s) => s.name).filter(Boolean);
  const repeatNames = hottest
    .filter((s) => s.repeat_founder || /repeat founder/i.test(String(s.why || '')))
    .map((s) => s.name)
    .filter(Boolean);

  const hiringNews = news.filter((n) =>
    /\b(hire|hiring|appoint|joins|co-?founder|team|cto|ceo)\b/i.test(`${n.title || ''} ${n.company || ''}`),
  );
  const attentionNews = news.filter((n) =>
    /\b(hot|viral|spotlight|breakout|hype|attention|buzz)\b/i.test(`${n.title || ''}`),
  );

  const priorLead = prior?.signalsThatMatter?.leading?.label || null;
  const priorTopSector = prior?.sectorTrends?.[0]?.sector || null;
  const topSector = sectors[0]?.sector || null;

  return {
    date: edition?.date || new Date().toISOString().slice(0, 10),
    leadingSignal: leading ? { label: leading.label, blurb: leading.blurb, pct: leading.pct } : null,
    coverage: edition?.signalsThatMatter?.coverage || null,
    topSectors: sectors.slice(0, 3).map((s) => s.sector),
    topSector,
    priorLead,
    priorTopSector,
    signalShift: priorLead && leading?.label && priorLead !== leading.label
      ? { from: priorLead, to: leading.label }
      : null,
    sectorShift: priorTopSector && topSector && priorTopSector !== topSector
      ? { from: priorTopSector, to: topSector }
      : null,
    opticsNames: opticsNames.slice(0, 4),
    soloNames: soloNames.slice(0, 4),
    growthNames: growthNames.slice(0, 4),
    repeatNames: repeatNames.slice(0, 4),
    fundingCount: money.length,
    fundingStages: [...new Set(money.map((m) => m.stage).filter(Boolean))].slice(0, 4),
    topMatch: matches[0]
      ? `${matches[0].startup?.name || '—'} → ${matches[0].investor?.firm_name || matches[0].investor?.firm || matches[0].investor?.name || '—'}`
      : null,
    hiringHeadlines: hiringNews.slice(0, 3).map((n) => n.title),
    attentionHeadlines: attentionNews.slice(0, 3).map((n) => n.title),
    hottest: hottest.slice(0, 5).map((s) => ({
      name: s.name,
      god: s.total_god_score,
      why: s.why,
      signal: signalHint(s) || null,
    })),
  };
}

function templateTrendReport(evidence) {
  const drivers = [];
  if (evidence.opticsNames.length || evidence.attentionHeadlines.length) {
    drivers.push({
      key: 'optics',
      label: 'Optics and attention',
      finding: evidence.opticsNames.length
        ? `${evidence.opticsNames.join(', ')} are carrying press/mention velocity on the board.`
        : `Headlines are privileging attention: ${evidence.attentionHeadlines[0]}.`,
      why_it_matters: 'Checks still follow visibility. A crowded tape can look like conviction when it is mostly optics.',
    });
  }
  if (evidence.soloNames.length || evidence.repeatNames.length || evidence.hiringHeadlines.length) {
    const teamBits = [];
    if (evidence.soloNames.length) teamBits.push(`lean/solo-looking teams: ${evidence.soloNames.join(', ')}`);
    if (evidence.repeatNames.length) teamBits.push(`repeat founders: ${evidence.repeatNames.join(', ')}`);
    if (evidence.hiringHeadlines.length) teamBits.push(`team-move headlines (${evidence.hiringHeadlines.length})`);
    drivers.push({
      key: 'team',
      label: 'Founder and team shape',
      finding: teamBits.join(' · ') || 'Team composition is in motion on the tape.',
      why_it_matters: 'Investors still underwrite people first. Solo vs repeat vs a hiring surge changes who gets the meeting.',
    });
  }
  if (evidence.growthNames.length || /growth|traction/i.test(evidence.leadingSignal?.label || '')) {
    drivers.push({
      key: 'growth',
      label: 'Growth rate as proof',
      finding: evidence.growthNames.length
        ? `Traction is doing the scoring work on ${evidence.growthNames.join(', ')}.`
        : 'The dominant platform signal is execution/growth, not narrative.',
      why_it_matters: 'High growth is used as a shortcut for quality. It is real — and it crowds out slower compounds.',
    });
  }
  if (evidence.leadingSignal) {
    drivers.push({
      key: 'sentiment',
      label: 'Investor sentiment',
      finding: `${evidence.leadingSignal.label} is the dominant signal${evidence.coverage ? ` across ${evidence.coverage} tracked companies` : ''}${evidence.leadingSignal.blurb ? ` — ${evidence.leadingSignal.blurb}` : ''}.`,
      why_it_matters: 'This is the preference layer: where funds are warming, circling, or waiting.',
    });
  }
  if (!drivers.length) {
    drivers.push({
      key: 'sentiment',
      label: 'Investor sentiment',
      finding: 'The board is still compiling a clean preference read for today.',
      why_it_matters: 'Without a dominant signal, stage and sector fit remain the safer targeting rule.',
    });
  }

  const shifts = [];
  if (evidence.signalShift) {
    shifts.push({
      label: 'Signal rotation',
      detail: `Dominant signal moved from ${evidence.signalShift.from} to ${evidence.signalShift.to}.`,
    });
  }
  if (evidence.sectorShift) {
    shifts.push({
      label: 'Sector preference',
      detail: `Board weight shifted from ${evidence.sectorShift.from} toward ${evidence.sectorShift.to}.`,
    });
  }

  const lead = drivers[0];
  const headline = lead?.key === 'optics'
    ? 'Attention is still writing the shortlist.'
    : lead?.key === 'growth'
      ? 'Growth rates are doing the underwriting.'
      : lead?.key === 'team'
        ? 'Team shape is moving investor preference.'
        : evidence.leadingSignal
          ? `${evidence.leadingSignal.label} is the preference to underwrite today.`
          : 'Investor preference is still forming on today’s tape.';

  const thesisParts = [headline];
  if (evidence.topSectors?.length) thesisParts.push(`Capital clustering: ${evidence.topSectors.slice(0, 2).join(', ')}.`);
  if (evidence.fundingCount) thesisParts.push(`${evidence.fundingCount} public raises on the week’s tape.`);
  if (evidence.topMatch) thesisParts.push(`Sharpest pairing: ${evidence.topMatch}.`);
  thesisParts.push('The useful read is not the headline company — it is the preference that made that company look fundable.');

  return {
    date: evidence.date,
    headline,
    thesis: thesisParts.join(' '),
    drivers: drivers.slice(0, 4),
    shifts,
    source: 'template',
  };
}

const TREND_VOICE = [
  'You write the Daily Signal trend report for pythh.ai.',
  'Task: name the UNDERLYING preferences shaping investor choice today — not a recap of who raised.',
  'Investors often allocate on optics: attention, solo vs repeat founders, growth-rate screens, sector fashion.',
  'Use only the evidence JSON. Name real companies when given. No hype, no exclamation points, no invented numbers.',
  'Return STRICT JSON: { "headline": string, "thesis": string, "drivers": [{ "key": "optics"|"team"|"growth"|"sentiment", "label": string, "finding": string, "why_it_matters": string }], "shifts": [{ "label": string, "detail": string }] }',
  'headline ≤ 90 chars. thesis 2–4 sentences. 2–4 drivers. shifts only when evidence shows a change vs yesterday.',
].join(' ');

async function synthesizeWithLlm(evidence) {
  if (!process.env.OPENAI_API_KEY) return null;
  try {
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.4,
      max_tokens: 500,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: TREND_VOICE },
        { role: 'user', content: JSON.stringify(evidence) },
      ],
    });
    const raw = completion.choices?.[0]?.message?.content?.trim();
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.headline || !parsed?.thesis || !Array.isArray(parsed.drivers)) return null;
    return {
      date: evidence.date,
      headline: String(parsed.headline).slice(0, 140),
      thesis: String(parsed.thesis),
      drivers: parsed.drivers.slice(0, 4).map((d) => ({
        key: ['optics', 'team', 'growth', 'sentiment'].includes(d.key) ? d.key : 'sentiment',
        label: String(d.label || d.key || 'Driver'),
        finding: String(d.finding || ''),
        why_it_matters: String(d.why_it_matters || ''),
      })),
      shifts: Array.isArray(parsed.shifts)
        ? parsed.shifts.slice(0, 3).map((s) => ({
          label: String(s.label || 'Shift'),
          detail: String(s.detail || ''),
        }))
        : [],
      source: 'llm',
    };
  } catch (err) {
    console.warn('[newsletter-trends] LLM failed:', err.message);
    return null;
  }
}

async function buildTrendReport(edition, { prior = null } = {}) {
  const evidence = collectEvidence(edition, prior);
  const llm = await synthesizeWithLlm(evidence);
  const report = llm || templateTrendReport(evidence);
  return { ...report, evidence };
}

async function runNewsletterTrendAgent({ edition, loadPrior } = {}) {
  let prior = null;
  const date = edition?.date;
  if (typeof loadPrior === 'function' && date) {
    const y = yesterdayDate(date);
    if (y) {
      try { prior = await loadPrior(y); } catch { prior = null; }
    }
  }
  return buildTrendReport(edition, { prior });
}

module.exports = {
  yesterdayDate,
  collectEvidence,
  templateTrendReport,
  buildTrendReport,
  runNewsletterTrendAgent,
};
