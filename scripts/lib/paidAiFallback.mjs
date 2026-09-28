/**
 * Funding search policy: when Anthropic / OpenAI / Gemini cannot run,
 * continue on the inference engine and the URL search service.
 * See docs/FUNDING_SEARCH_POLICY.md.
 */
import { spawnSync } from 'node:child_process';

const PAID_UNAVAILABLE =
  /credit balance is too low|credits? (are )?depleted|insufficient.?credits?|quota|RESOURCE_EXHAUSTED|Claude Code returned an error result/i;

export function isPaidAiUnavailable(err) {
  const msg = String(err?.message || err || '');
  return PAID_UNAVAILABLE.test(msg);
}

/**
 * Inference news search, then URL recovery. Either step may find nothing.
 * The fallback itself is success when the commands finish.
 *
 * @param {string} repoRoot
 * @returns {number} process exit code
 */
export function runFreeSearchFallback(repoRoot) {
  console.warn(
    '\nPaid AI unavailable. Continuing on the inference engine and the URL search service (docs/FUNDING_SEARCH_POLICY.md).\n',
  );
  const steps = [
    ['scripts/search-startup-funding-evidence.mjs', '--provider=inference', '--apply', '--limit=40', '--delay=400'],
    ['scripts/recover-startup-urls.mjs', '--apply', '--limit=40'],
  ];
  let failed = 0;
  for (const args of steps) {
    console.log(`\n▶ node ${args.join(' ')}`);
    const result = spawnSync(process.execPath, args, {
      cwd: repoRoot,
      stdio: 'inherit',
      env: process.env,
    });
    if (result.status !== 0) {
      failed += 1;
      console.error(`free search step failed: ${args[0]} (${result.status})`);
    }
  }
  return failed === steps.length ? 1 : 0;
}
