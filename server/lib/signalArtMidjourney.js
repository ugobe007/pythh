'use strict';

/**
 * Midjourney prompt export for Signal Art (no official MJ API — paste at midjourney.com).
 * @see mcpmarket-me/skills/ai-artist/references/image-prompting.md
 */

const DEFAULT_ACCOUNT = {
  username: 'u7352532762',
  displayName: 'u7352532762',
  profileUrl: 'https://www.midjourney.com/@u7352532762',
};

function getMidjourneyAccount() {
  return {
    username: process.env.MIDJOURNEY_USERNAME || DEFAULT_ACCOUNT.username,
    displayName: process.env.MIDJOURNEY_DISPLAY_NAME || process.env.MIDJOURNEY_USERNAME || DEFAULT_ACCOUNT.displayName,
    profileUrl: process.env.MIDJOURNEY_PROFILE_URL || DEFAULT_ACCOUNT.profileUrl,
    version: process.env.MIDJOURNEY_VERSION || '6.1',
  };
}

/** Map lighting style → Midjourney lighting keywords */
const LIGHTING_KW = {
  neon_glow: 'neon glow, cyberpunk rim light',
  blue_hour: 'blue hour, cool twilight, moody',
  golden_hour: 'golden hour, warm directional light',
  rim: 'rim light, back light, edge highlight',
  split: 'split lighting, dramatic shadow, asymmetric',
};

/**
 * Build a Midjourney /imagine prompt with v6.1 parameters.
 * Keeps stylize low + chaos restrained for minimalist vector aesthetic.
 */
function buildMidjourneyPrompt(snapshot, plan, imageBrief) {
  const account = getMidjourneyAccount();
  const leading = snapshot.leading_signal;
  const top = snapshot.hottest[0];
  const lighting = LIGHTING_KW[plan.lightingStyle] || LIGHTING_KW.neon_glow;

  const subject = top
    ? `abstract ${plan.accentLabel} market beacon, ${leading?.label?.toLowerCase() || 'signal'} energy`
    : 'abstract neon market beacon, minimalist horizon study';

  const promptCore = [
    subject,
    'minimalist vector art',
    'flat stroke illustration',
    'synthwave neon palette',
    plan.accent,
    'void black background',
    'golden ratio composition',
    'rule of thirds',
    'generous negative space',
    lighting,
    'layered depth',
    'foreground interest',
    'editorial illustration',
  ].join(', ');

  const negatives = (imageBrief?.negative || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12)
    .join(', ');

  const stylize = plan.tension > 0.4 ? 100 : 75;
  const chaos = Math.max(0, Math.min(15, Math.round(plan.tension * 18)));

  const params = [
    `--ar 1:1`,
    `--style raw`,
    `--v ${account.version}`,
    `--seed ${plan.seed || imageBrief?.seed || 0}`,
    `--stylize ${stylize}`,
    `--chaos ${chaos}`,
    `--no ${negatives}`,
  ].join(' ');

  const imagine = `/imagine prompt: ${promptCore} ${params}`;

  return {
    account,
    imagine,
    prompt: promptCore,
    parameters: params,
    profileUrl: account.profileUrl,
    username: account.username,
    seed: plan.seed || imageBrief?.seed,
    version: account.version,
    instructions: [
      `1. Open ${account.profileUrl}`,
      '2. Paste the /imagine line into Create (or Discord /imagine if you use bot)',
      '3. Upscale preferred variant → download → optional: npm run art:attach-raster',
    ],
  };
}

function formatMidjourneyQueueMarkdown(edition) {
  const mj = edition.signal_snapshot?.midjourney || edition.midjourney;
  if (!mj) return '';
  const lines = [
    `# Signal Art — Midjourney queue · ${edition.edition_date}`,
    '',
    `**Profile:** [${mj.account?.username || mj.username}](${mj.profileUrl || mj.account?.profileUrl})`,
    `**Seed:** ${mj.seed} · **Version:** v${mj.version || '6.1'}`,
    '',
    '## /imagine (copy-paste)',
    '',
    '```',
    mj.imagine,
    '```',
    '',
    '## After generation',
    '',
    '- Upscale (U1–U4) → download PNG',
    '- Optional: attach to edition via `npm run art:attach-raster -- --date=YYYY-MM-DD --url=...`',
    '',
    '---',
    `*${edition.copy?.title || 'Signal Composition'}*`,
  ];
  return lines.join('\n');
}

module.exports = {
  getMidjourneyAccount,
  buildMidjourneyPrompt,
  formatMidjourneyQueueMarkdown,
  DEFAULT_ACCOUNT,
};
