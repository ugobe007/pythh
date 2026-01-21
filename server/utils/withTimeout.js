class TimeoutError extends Error {
  constructor(message = 'Timed out') {
    super(message);
    this.name = 'TimeoutError';
  }
}

function withTimeout(promise, ms, label = 'operation') {
  let t;
  const timeout = new Promise((_, reject) => {
    t = setTimeout(() => reject(new TimeoutError(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}

// Pre-configured timeouts for common operations
const TIMEOUTS = {
  SUPABASE_READ: 2500,   // 2.5s for reads
  SUPABASE_WRITE: 2000,  // 2.0s for writes
  EXTERNAL_FETCH: 8000,  // 8s for website crawl/enrichment
  MATCHES_TOTAL: 10000,  // 10s hard limit for /api/matches
};

module.exports = { withTimeout, TimeoutError, TIMEOUTS };
