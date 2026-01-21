const { RateLimiterMemory } = require('rate-limiter-flexible');

const generalLimiter = new RateLimiterMemory({
  points: 120, // 120 req
  duration: 60, // per 60s
});

const matchesLimiterAuth = new RateLimiterMemory({
  points: 10, // 10 scans
  duration: 600, // per 10 min
});

const matchesLimiterAnon = new RateLimiterMemory({
  points: 3, // 3 scans
  duration: 1800, // per 30 min
});

const matchesBurstLimiter = new RateLimiterMemory({
  points: 2,
  duration: 10, // 2 scans / 10s
});

function getIp(req) {
  return (req.headers['x-forwarded-for'] || '').toString().split(',')[0].trim() || req.ip;
}

async function rateLimitGeneral(req, res, next) {
  try {
    await generalLimiter.consume(getIp(req));
    return next();
  } catch (rej) {
    const retryAfter = Math.ceil(rej.msBeforeNext / 1000);
    res.set('Retry-After', String(retryAfter));
    res.set('X-RateLimit-Limit', '120');
    res.set('X-RateLimit-Remaining', String(rej.remainingPoints || 0));
    return res.status(429).json({ error: 'Too many requests', retry_after_s: retryAfter });
  }
}

function rateLimitMatches(getUserId) {
  return async (req, res, next) => {
    const ip = getIp(req);
    const userId = getUserId ? getUserId(req) : null;

    try {
      await matchesBurstLimiter.consume(userId ? `burst:u:${userId}` : `burst:ip:${ip}`);

      if (userId) {
        await matchesLimiterAuth.consume(`scan:u:${userId}`);
      } else {
        await matchesLimiterAnon.consume(`scan:ip:${ip}`);
      }

      return next();
    } catch (rej) {
      const retryAfter = Math.ceil(rej.msBeforeNext / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ error: 'Too many scans', retry_after_s: retryAfter });
    }
  };
}

module.exports = { rateLimitGeneral, rateLimitMatches };
