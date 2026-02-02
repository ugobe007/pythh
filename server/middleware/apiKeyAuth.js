/**
 * API Key Authentication Middleware
 * Header: X-Pythh-Key: pk_live_xxxxx
 * 
 * Rate limits:
 *   - Public (no key): 30 req/min
 *   - API key: 300 req/min (configurable per key)
 */

const crypto = require('crypto');
const { getSupabaseClient } = require('../lib/supabaseClient');

// Rate limit constants
const PUBLIC_RATE_LIMIT = 30;  // per minute
const DEFAULT_KEY_RATE_LIMIT = 300;  // per minute
const RATE_WINDOW_MS = 60 * 1000;  // 1 minute

/**
 * Hash an API key for storage/lookup
 */
function hashApiKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Generate a new API key
 * Format: pk_live_<32 random chars>
 */
function generateApiKey() {
  const randomPart = crypto.randomBytes(24).toString('base64url');
  return `pk_live_${randomPart}`;
}

/**
 * Check rate limit for a given key hash or IP
 * Returns { allowed: boolean, remaining: number, reset_at: Date }
 */
async function checkRateLimit(keyHash, ipAddress, limit) {
  const supabase = getSupabaseClient();
  const windowStart = new Date(Math.floor(Date.now() / RATE_WINDOW_MS) * RATE_WINDOW_MS);
  
  // Use 'public' as the key_hash for unauthenticated requests
  const effectiveKeyHash = keyHash || 'public';
  
  try {
    // Try to insert first
    const { data: insertData, error: insertError } = await supabase
      .from('api_rate_limits')
      .insert({
        key_hash: effectiveKeyHash,
        ip_address: ipAddress,
        window_start: windowStart.toISOString(),
        request_count: 1
      })
      .select('request_count')
      .single();
    
    if (!insertError) {
      return {
        allowed: true,
        remaining: limit - 1,
        reset_at: new Date(windowStart.getTime() + RATE_WINDOW_MS)
      };
    }
    
    // If insert failed (duplicate), fetch and increment
    const { data: existing } = await supabase
      .from('api_rate_limits')
      .select('request_count')
      .eq('key_hash', effectiveKeyHash)
      .eq('ip_address', ipAddress)
      .eq('window_start', windowStart.toISOString())
      .single();
    
    if (existing) {
      const newCount = existing.request_count + 1;
      await supabase
        .from('api_rate_limits')
        .update({ request_count: newCount })
        .eq('key_hash', effectiveKeyHash)
        .eq('ip_address', ipAddress)
        .eq('window_start', windowStart.toISOString());
      
      return {
        allowed: newCount <= limit,
        remaining: Math.max(0, limit - newCount),
        reset_at: new Date(windowStart.getTime() + RATE_WINDOW_MS)
      };
    }
    
    // Fallback - allow request but don't track
    return {
      allowed: true,
      remaining: limit - 1,
      reset_at: new Date(windowStart.getTime() + RATE_WINDOW_MS)
    };
  } catch (e) {
    // On any error, allow the request (fail open for rate limiting)
    console.error('[apiKeyAuth] Rate limit check error:', e.message);
    return {
      allowed: true,
      remaining: limit - 1,
      reset_at: new Date(windowStart.getTime() + RATE_WINDOW_MS)
    };
  }
}

/**
 * Main API key authentication middleware
 * Sets req.apiKey with key info if valid key provided
 * Allows public access with lower rate limits
 */
async function apiKeyAuth(req, res, next) {
  const apiKey = req.headers['x-pythh-key'];
  const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
  
  let keyHash = null;
  let rateLimit = PUBLIC_RATE_LIMIT;
  let keyInfo = null;
  
  if (apiKey) {
    // Validate API key format
    if (!apiKey.startsWith('pk_live_')) {
      return res.status(401).json({
        ok: false,
        error: {
          code: 'unauthorized',
          message: 'Invalid API key format. Keys must start with pk_live_'
        }
      });
    }
    
    keyHash = hashApiKey(apiKey);
    
    // Look up key in database
    const supabase = getSupabaseClient();
    const { data: key, error } = await supabase
      .from('api_keys')
      .select('*')
      .eq('key_hash', keyHash)
      .eq('is_active', true)
      .single();
    
    if (error || !key) {
      return res.status(401).json({
        ok: false,
        error: {
          code: 'unauthorized',
          message: 'Invalid or inactive API key'
        }
      });
    }
    
    // Check expiration
    if (key.expires_at && new Date(key.expires_at) < new Date()) {
      return res.status(401).json({
        ok: false,
        error: {
          code: 'unauthorized',
          message: 'API key has expired'
        }
      });
    }
    
    keyInfo = key;
    rateLimit = key.rate_limit_per_min || DEFAULT_KEY_RATE_LIMIT;
    
    // Update last_used_at and request_count
    supabase
      .from('api_keys')
      .update({ 
        last_used_at: new Date().toISOString(),
        request_count: (key.request_count || 0) + 1
      })
      .eq('id', key.id)
      .then(() => {});  // Fire and forget
  }
  
  // Check rate limit
  const rateLimitResult = await checkRateLimit(keyHash, ipAddress, rateLimit);
  
  // Set rate limit headers
  res.set('X-RateLimit-Limit', rateLimit.toString());
  res.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
  res.set('X-RateLimit-Reset', Math.floor(rateLimitResult.reset_at.getTime() / 1000).toString());
  
  if (!rateLimitResult.allowed) {
    return res.status(429).json({
      ok: false,
      error: {
        code: 'rate_limited',
        message: `Rate limit exceeded. Limit: ${rateLimit} requests per minute.`
      }
    });
  }
  
  // Attach key info to request
  req.apiKey = keyInfo;
  req.apiKeyHash = keyHash;
  req.isPublicAccess = !keyInfo;
  
  next();
}

/**
 * Middleware factory to require API key with optional scope check
 * Usage: requireApiKey() or requireApiKey('movements') or requireApiKey(['movements', 'market_slice'])
 * 
 * God mode policy (clean rule):
 *   - allowed_scopes = null or undefined → god mode (all scopes)
 *   - allowed_scopes = [] empty array → no scopes (valid but useless)
 *   - allowed_scopes = ['scope1', ...] → specific scopes only
 */
function requireApiKey(requiredScope) {
  return (req, res, next) => {
    // Check if authenticated
    if (req.isPublicAccess) {
      return res.status(401).json({
        ok: false,
        error: {
          code: 'unauthorized',
          message: 'API key required for this endpoint'
        }
      });
    }
    
    // Check scope if required
    if (requiredScope) {
      const scopes = Array.isArray(requiredScope) ? requiredScope : [requiredScope];
      const keyScopes = req.apiKey?.allowed_scopes;
      
      // God mode: null or undefined = all scopes allowed
      // Empty array [] means NO scopes (not god mode)
      const isGodMode = keyScopes === null || keyScopes === undefined;
      
      if (!isGodMode) {
        const hasScope = scopes.some(s => Array.isArray(keyScopes) && keyScopes.includes(s));
        if (!hasScope) {
          return res.status(403).json({
            ok: false,
            error: {
              code: 'forbidden',
              message: `API key lacks required scope: ${scopes.join(' or ')}`
            }
          });
        }
      }
    }
    
    next();
  };
}

/**
 * Log API request (fire and forget)
 */
async function logApiRequest(req, statusCode, responseTimeMs) {
  try {
    const supabase = getSupabaseClient();
    await supabase.from('api_request_logs').insert({
      key_id: req.apiKey?.id || null,
      endpoint: req.path,
      method: req.method,
      status_code: statusCode,
      response_time_ms: responseTimeMs,
      ip_address: req.ip || req.connection.remoteAddress,
      user_agent: req.headers['user-agent'],
      query_params: req.query
    });
  } catch (e) {
    // Silent fail - logging shouldn't break API
  }
}

module.exports = {
  apiKeyAuth,
  requireApiKey,
  hashApiKey,
  generateApiKey,
  logApiRequest,
  PUBLIC_RATE_LIMIT,
  DEFAULT_KEY_RATE_LIMIT
};
