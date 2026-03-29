/**
 * GITHUB DATA SOURCE
 *
 * Queries the GitHub API v3 to collect product velocity and team size signals
 * for a given company. No auth = 60 req/hr. With GITHUB_TOKEN = 5,000 req/hr.
 *
 * Signals produced:
 *   ACTIVE_DEVELOPMENT  — recent commits, active repo
 *   DEVELOPER_ADOPTION  — stars, forks, enterprise features
 *   DEAD_CODEBASE       — no commits, archived repo
 *   STRUGGLING_PRODUCT  — only bug fixes, rewrite signals
 *   PLATFORM_STRATEGY   — SDK/API repos
 *   EXPANSION           — multiple active repos (new product lines)
 *
 * Each signal carries { signal, category, strength, detectedAt, source, evidence }
 */

'use strict';

const GITHUB_TOKEN  = process.env.GITHUB_TOKEN;
const API_BASE      = 'https://api.github.com';
const TIMEOUT_MS    = 10_000;
const MAX_REPOS     = 5;   // check top-N repos by update date

const HEADERS = {
  'Accept':     'application/vnd.github+json',
  'User-Agent': 'PythhBot/1.0 (+https://pythh.ai)',
  ...(GITHUB_TOKEN ? { 'Authorization': `Bearer ${GITHUB_TOKEN}` } : {}),
};

async function fetchJSON(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: HEADERS, signal: ctrl.signal });
    if (!res.ok) throw new Error(`GitHub API ${res.status}: ${url}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Compute days since a date string.
 */
function daysSince(dateStr) {
  if (!dateStr) return Infinity;
  return (Date.now() - new Date(dateStr).getTime()) / 86_400_000;
}

/**
 * Search GitHub for repos associated with a company name.
 * Returns the top repos by update date.
 */
async function searchRepos(companyName) {
  const q = encodeURIComponent(`${companyName} in:name,description fork:false`);
  const data = await fetchJSON(`${API_BASE}/search/repositories?q=${q}&sort=updated&per_page=${MAX_REPOS}`);
  return (data.items || []).slice(0, MAX_REPOS);
}

/**
 * Get the commit activity for a repo (last 52 weeks).
 * Returns total commits in the last 4 weeks and last 52 weeks.
 */
async function getCommitActivity(owner, repo) {
  try {
    const data = await fetchJSON(`${API_BASE}/repos/${owner}/${repo}/stats/commit_activity`);
    if (!Array.isArray(data)) return null;
    const recent4  = data.slice(-4).reduce((s, w) => s + w.total, 0);
    const recent52 = data.reduce((s, w) => s + w.total, 0);
    return { recent4, recent52 };
  } catch {
    return null;
  }
}

/**
 * Get contributor count for a repo.
 */
async function getContributors(owner, repo) {
  try {
    const data = await fetchJSON(`${API_BASE}/repos/${owner}/${repo}/contributors?per_page=100&anon=0`);
    return Array.isArray(data) ? data.length : 0;
  } catch {
    return 0;
  }
}

/**
 * Get the latest releases for a repo.
 */
async function getReleases(owner, repo) {
  try {
    const data = await fetchJSON(`${API_BASE}/repos/${owner}/${repo}/releases?per_page=5`);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/**
 * Classify a repo as relevant to the company (filter out forks, mirrors, etc.)
 */
function isRelevantRepo(repo, companyName) {
  const name = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const repoFull = (repo.full_name || '').toLowerCase().replace(/[^a-z0-9/]/g, '');
  // Prefer repos where the owner or repo name contains the company name
  return repoFull.includes(name.slice(0, 5)) && !repo.fork;
}

/**
 * Main entry point.
 *
 * @param {string} companyName
 * @param {Object} [opts]
 * @param {string} [opts.githubOrg]  — optional known org/username to use directly
 * @returns {Promise<Array<SignalResult>>}
 */
async function fetchGithubSignals(companyName, opts = {}) {
  const now = Date.now();
  const signals = [];

  try {
    let repos = [];

    if (opts.githubOrg) {
      // If we know the org, go directly
      const data = await fetchJSON(`${API_BASE}/orgs/${opts.githubOrg}/repos?sort=updated&per_page=${MAX_REPOS}`);
      repos = Array.isArray(data) ? data.slice(0, MAX_REPOS) : [];
    } else {
      repos = await searchRepos(companyName);
      repos = repos.filter(r => isRelevantRepo(r, companyName));
    }

    if (repos.length === 0) {
      return signals; // no repos found → no signals
    }

    // Aggregate across top repos
    let totalStars       = 0;
    let totalForks       = 0;
    let maxContributors  = 0;
    let recentCommits    = 0;
    let annualCommits    = 0;
    let hasArchivedRepo  = false;
    let hasActiveRepo    = false;
    let latestPushDays   = Infinity;
    let latestRelease    = null;
    let sdkRepo          = false;
    let enterpriseKeywords = 0;

    const repoDetails = await Promise.allSettled(
      repos.map(async repo => {
        const [commits, contributors, releases] = await Promise.all([
          getCommitActivity(repo.owner?.login, repo.name),
          getContributors(repo.owner?.login, repo.name),
          getReleases(repo.owner?.login, repo.name),
        ]);
        return { repo, commits, contributors, releases };
      })
    );

    for (const r of repoDetails) {
      if (r.status !== 'fulfilled') continue;
      const { repo, commits, contributors, releases } = r.value;

      totalStars     += repo.stargazers_count  || 0;
      totalForks     += repo.forks_count       || 0;
      maxContributors = Math.max(maxContributors, contributors);

      if (repo.archived)           hasArchivedRepo = true;
      const pushDays = daysSince(repo.pushed_at);
      if (pushDays < latestPushDays) latestPushDays = pushDays;
      if (pushDays < 90)           hasActiveRepo = true;

      if (commits) {
        recentCommits += commits.recent4;
        annualCommits += commits.recent52;
      }

      // SDK / API repo detection
      const desc = (repo.description || '').toLowerCase();
      const nm   = (repo.name || '').toLowerCase();
      if (nm.includes('sdk') || nm.includes('api') || nm.includes('client') ||
          desc.includes('sdk') || desc.includes('api client')) {
        sdkRepo = true;
      }

      // Enterprise features
      const topics = (repo.topics || []).join(' ').toLowerCase();
      if (topics.includes('enterprise') || topics.includes('security') ||
          desc.includes('soc2') || desc.includes('compliance')) {
        enterpriseKeywords++;
      }

      // Most recent release
      if (releases.length > 0 && (!latestRelease || new Date(releases[0].published_at) > new Date(latestRelease))) {
        latestRelease = releases[0].published_at;
      }
    }

    // ── Produce signals ───────────────────────────────────────────────────────

    // DEAD_CODEBASE — archived or no pushes in 12+ months
    if (hasArchivedRepo || latestPushDays > 365) {
      signals.push({
        signal:     'DEAD_CODEBASE',
        category:   'GITHUB_NEGATIVE',
        strength:   hasArchivedRepo ? 0.90 : 0.75,
        detectedAt: now,
        source:     'github',
        evidence:   hasArchivedRepo
          ? `Repo is archived`
          : `Last push ${Math.round(latestPushDays)}d ago`,
      });
    }

    // ACTIVE_DEVELOPMENT — commits in the last 4 weeks
    if (recentCommits > 0 && hasActiveRepo) {
      const strength = recentCommits >= 20 ? 0.90
                     : recentCommits >= 5  ? 0.78
                     : 0.65;
      signals.push({
        signal:     'ACTIVE_DEVELOPMENT',
        category:   'GITHUB_POSITIVE',
        strength,
        detectedAt: now,
        source:     'github',
        evidence:   `${recentCommits} commits in last 4 weeks across ${repos.length} repos`,
      });
    }

    // DEVELOPER_ADOPTION — stars and forks signal community interest
    if (totalStars >= 100 || totalForks >= 25) {
      const strength = totalStars >= 1000 ? 0.90
                     : totalStars >= 500  ? 0.82
                     : 0.70;
      signals.push({
        signal:     'DEVELOPER_ADOPTION',
        category:   'GITHUB_POSITIVE',
        strength,
        detectedAt: now,
        source:     'github',
        evidence:   `${totalStars} stars, ${totalForks} forks across top repos`,
      });
    }

    // PLATFORM_STRATEGY — has a dedicated SDK or API client repo
    if (sdkRepo) {
      signals.push({
        signal:     'PLATFORM_STRATEGY',
        category:   'PRODUCT_LAUNCH',
        strength:   0.82,
        detectedAt: now,
        source:     'github',
        evidence:   'SDK / API client repo detected',
      });
    }

    // ENTERPRISE_READINESS — enterprise/security/compliance topics
    if (enterpriseKeywords >= 2) {
      signals.push({
        signal:     'ENTERPRISE_COMPLIANCE',
        category:   'PRODUCT_LAUNCH',
        strength:   0.75,
        detectedAt: now,
        source:     'github',
        evidence:   'Enterprise/security topics on public repos',
      });
    }

    // Team size from contributors
    if (maxContributors >= 10) {
      signals.push({
        signal:     'GENERAL_HIRING',
        category:   'HIRING_GROWTH',
        strength:   maxContributors >= 25 ? 0.80 : 0.65,
        detectedAt: now,
        source:     'github',
        evidence:   `${maxContributors} unique contributors on top repo`,
      });
    }

    // Recent release within 30 days
    if (latestRelease && daysSince(latestRelease) < 30) {
      signals.push({
        signal:     'PUBLIC_LAUNCH',
        category:   'PRODUCT_LAUNCH',
        strength:   0.78,
        detectedAt: now,
        source:     'github',
        evidence:   `Release published ${Math.round(daysSince(latestRelease))}d ago`,
      });
    }

    // Annual commit volume → product velocity
    if (annualCommits >= 500) {
      signals.push({
        signal:     'ACTIVE_DEVELOPMENT',
        category:   'GITHUB_POSITIVE',
        strength:   0.85,
        detectedAt: now,
        source:     'github',
        evidence:   `${annualCommits} commits in past 12 months`,
      });
    }

  } catch (err) {
    // Non-fatal — return whatever signals were collected before the error
    if (process.env.DEBUG_INFERENCE === '1') {
      console.error(`[githubSource] ${companyName}: ${err.message}`);
    }
  }

  return signals;
}

module.exports = { fetchGithubSignals };
