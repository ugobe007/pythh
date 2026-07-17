/**
 * Scout — Pythh orchestrator persona loader and prompt blocks.
 */

import fs from 'node:fs';
import path from 'node:path';

const PERSONA_PATH = 'agents/orchestrator-persona.json';

export function loadOrchestratorPersona(repoRoot) {
  const p = path.join(repoRoot, PERSONA_PATH);
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

export function buildPersonaBlock(repoRoot, { agentRole, brief } = {}) {
  const persona = loadOrchestratorPersona(repoRoot);
  if (!persona) return '';

  const weakest = brief?.weakest_stage;
  const delegation = agentRole ? persona.delegation?.[agentRole] : null;
  const order =
    delegation && weakest
      ? delegation.order_template
          .replace('{stage}', weakest.label || weakest.id || 'unknown')
          .replace('{weakest_stage}', weakest.label || weakest.id || 'unknown')
      : null;

  const lines = [
    `## Orchestrator persona: ${persona.name} (${persona.title})`,
    persona.identity,
    '',
    `**Voice:** ${persona.voice.summary} (${persona.voice.ratio})`,
    '',
    '**Scout always:**',
    ...persona.voice.always.map((r) => `- ${r}`),
    '',
    '**Scout never:**',
    ...persona.voice.never.map((r) => `- ${r}`),
  ];

  if (agentRole && delegation) {
    lines.push('', `**Your charter (${agentRole}):** ${delegation.when}`, order ? `**Today's order:** ${order}` : '');
  }

  if (weakest) {
    lines.push('', `**Binding constraint:** ${weakest.label} — ${weakest.problem}`);
  }

  const forbidden = persona.forbidden_actions?.slice(0, 6) || [];
  if (forbidden.length) {
    lines.push('', '**Hard stops:**', ...forbidden.map((r) => `- ${r}`));
  }

  return `\n\n${lines.join('\n')}\n`;
}

export function buildOrchestratorSystemPrompt(repoRoot, agentRole) {
  const persona = loadOrchestratorPersona(repoRoot);
  if (!persona) {
    return `You are the Pythh ${agentRole} agent. Read agents/ORCHESTRATOR.md. Voice: picky, skeptical, motivating. Never propose passive monitoring alone.`;
  }

  return [
    `You are the Pythh ${agentRole} agent reporting to ${persona.name} (${persona.title}).`,
    persona.identity,
    `Voice: ${persona.voice.summary}. Ratio: ${persona.voice.ratio}.`,
    `Read agents/ORCHESTRATOR.md and agents/orchestrator-persona.json before acting.`,
    `Follow Scout's decision_rules — human_funnel only, no passive monitoring, one shippable fix per run.`,
    persona.delegation?.[agentRole]
      ? `Charter: ${persona.delegation[agentRole].when}`
      : '',
  ]
    .filter(Boolean)
    .join(' ');
}
