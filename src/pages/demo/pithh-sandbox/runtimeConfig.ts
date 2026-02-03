/**
 * RUNTIME CONFIG
 * ==============
 *
 * Datasource selection: fake vs real, with intelligent fallback
 * Zero rebuild risk: all config is env vars + auto-detection
 *
 * ENV VARS:
 *   VITE_PYTHH_DATASOURCE = "fake" | "api" (default: detect)
 *   VITE_PYTHH_API_BASE = "http://localhost:3000" (default: window.location.origin)
 *
 * AUTO-DETECTION:
 *   1. Check VITE_PYTHH_DATASOURCE env var
 *   2. If not set, try API health check (timeout 2s)
 *   3. If API fails, fallback to fake with warning
 *   4. Log decision to console + feed
 */

export type DataSourceMode = "fake" | "api";

export interface RuntimeConfig {
  mode: DataSourceMode;
  apiBase: string;
  reason: string; // Why this mode was chosen
  apiHealthy: boolean; // Did API health check pass?
}

/**
 * Detect datasource mode (may be async)
 */
export async function detectDataSourceMode(): Promise<RuntimeConfig> {
  // 1. Check explicit env var
  const explicit = import.meta.env.VITE_PYTHH_DATASOURCE as string | undefined;
  if (explicit === "fake") {
    return {
      mode: "fake",
      apiBase: "", // Not used
      reason: "VITE_PYTHH_DATASOURCE=fake (explicit)",
      apiHealthy: false,
    };
  }

  if (explicit === "api") {
    const apiBase = import.meta.env.VITE_PYTHH_API_BASE as string || window.location.origin;
    return {
      mode: "api",
      apiBase,
      reason: "VITE_PYTHH_DATASOURCE=api (explicit)",
      apiHealthy: true, // Trust the env var
    };
  }

  // 2. Try API health check
  const apiBase = import.meta.env.VITE_PYTHH_API_BASE as string || window.location.origin;
  const healthy = await checkApiHealth(apiBase);

  if (healthy) {
    return {
      mode: "api",
      apiBase,
      reason: `Auto-detected: API responding at ${apiBase}`,
      apiHealthy: true,
    };
  }

  // 3. Fallback to fake
  return {
    mode: "fake",
    apiBase, // Store for potential later switch
    reason: `Auto-detected: API unavailable, falling back to fake (tried ${apiBase})`,
    apiHealthy: false,
  };
}

/**
 * Quick health check (2s timeout, non-blocking)
 */
async function checkApiHealth(apiBase: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(`${apiBase}/api/v1/health`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return res.ok;
  } catch (err) {
    // Timeout, network error, or CORS — treat as unhealthy
    return false;
  }
}

/**
 * Singleton config instance
 */
let configInstance: RuntimeConfig | null = null;

export async function getRuntimeConfig(): Promise<RuntimeConfig> {
  if (!configInstance) {
    configInstance = await detectDataSourceMode();
  }
  return configInstance;
}

/**
 * Force reset (for testing)
 */
export function resetConfig() {
  configInstance = null;
}
