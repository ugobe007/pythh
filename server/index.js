// --- FILE: server/index.js ---
// Load environment variables first (from project root, not server directory)
const path = require('path');
const fs = require('fs');

const envPath = path.join(__dirname, '..', '.env');
console.log('[Server Startup] Loading .env from:', envPath);
console.log('[Server Startup] .env file exists:', fs.existsSync(envPath));

// Try to load dotenv - Node.js should find it in parent node_modules
let dotenv;
try {
  dotenv = require('dotenv');
} catch (dotenvError) {
  // If not found, try from root node_modules explicitly
  try {
    dotenv = require(path.join(__dirname, '..', 'node_modules', 'dotenv'));
  } catch (rootError) {
    console.error('[Server Startup] ❌ Could not load dotenv module:', rootError.message);
    console.error('[Server Startup] Please install dotenv: cd .. && npm install dotenv');
  }
}

// Load the .env file
let envResult;
if (dotenv) {
  envResult = dotenv.config({ path: envPath });
} else {
  console.error('[Server Startup] ❌ Cannot load .env - dotenv module not available');
}

if (envResult.error) {
  console.warn('[Server Startup] ⚠️  Error loading .env:', envResult.error.message);
} else {
  console.log('[Server Startup] ✅ .env loaded successfully');
  const loadedVars = Object.keys(envResult.parsed || {});
  console.log('[Server Startup] Loaded', loadedVars.length, 'environment variables');
  const supabaseVars = loadedVars.filter(k => k.includes('SUPABASE'));
  if (supabaseVars.length > 0) {
    console.log('[Server Startup] Supabase variables found:', supabaseVars.join(', '));
  } else {
    console.warn('[Server Startup] ⚠️  No Supabase variables found in .env file');
  }
}

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const helmet = require('helmet');
const logger = require('./logger');
const { pool } = require('./db');
const { getSupabaseClient } = require('./lib/supabaseClient');
// fs and path are already declared above

const app = express();
const PORT = process.env.PORT || 3002;
const IS_PRODUCTION = process.env.NODE_ENV === 'production' || !!process.env.FLY_APP_NAME;

// Security headers (helmet)
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for now (React injects inline scripts)
  crossOriginEmbedderPolicy: false,
}));

// CORS: locked to known domains in production, permissive in dev
const ALLOWED_ORIGINS = [
  'https://hot-honey.fly.dev',
  'https://pythh.ai',
  'https://www.pythh.ai',
  'https://hothoney.ai',
  'https://www.hothoney.ai',
];
if (!IS_PRODUCTION) {
  ALLOWED_ORIGINS.push('http://localhost:5173', 'http://localhost:3002', 'http://localhost:3000');
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, curl, mobile apps)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    // In production, reject unknown origins
    if (IS_PRODUCTION) return callback(new Error('CORS not allowed'), false);
    // In dev, allow all
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-plan', 'X-Request-ID', 'X-Pythh-Key', 'X-Session-Id', 'x-admin-key']
}));
// Skip JSON parsing for Stripe webhook (needs raw body for signature verification)
app.use((req, res, next) => {
  if (req.originalUrl === '/api/billing/webhook') {
    next();
  } else {
    express.json()(req, res, next);
  }
});

// Request ID middleware (for tracing)
const { requestIdMiddleware } = require('./middleware/requestId');
app.use(requestIdMiddleware);

// Rate limiting (general API protection)
const { rateLimitGeneral } = require('./middleware/rateLimit');
app.use(rateLimitGeneral);

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      component: 'http',
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      requestId: req.requestId,
    };
    if (res.statusCode >= 400) {
      logger.warn(logData, '%s %s %d %dms', req.method, req.path, res.statusCode, duration);
    } else {
      logger.info(logData, '%s %s %d %dms', req.method, req.path, res.statusCode, duration);
    }
  });
  next();
});

// File storage for uploaded documents
const upload = multer({ dest: 'uploads/' });

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Helper function is imported from lib/supabaseClient.js (SSOT)

// ============================================================
// SIGNAL HISTORY HELPERS
// Track Power Score, Signal Strength, Readiness over time
// ============================================================
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function computeFundraisingWindow(powerScore) {
  if (powerScore >= 85) return 'Prime';
  if (powerScore >= 65) return 'Forming';
  return 'Too Early';
}

function computeSignalMetrics(rawMatches, godScore) {
  const top = (rawMatches || [])
    .slice()
    .sort((a, b) => (b.match_score || 0) - (a.match_score || 0))
    .slice(0, 5);

  const signalStrength =
    top.length > 0
      ? Math.round(top.reduce((acc, m) => acc + (m.match_score || 0), 0) / top.length)
      : 50;

  const readiness = clamp(Math.round(godScore ?? 60), 0, 100);
  const powerScore = clamp(Math.round((signalStrength * readiness) / 100), 0, 100);
  const fundraisingWindow = computeFundraisingWindow(powerScore);

  return { signalStrength, readiness, powerScore, fundraisingWindow };
}

async function recordSignalHistory({ supabase, startupId, rawMatches, godScore, source = 'scan', meta = {} }) {
  try {
    const { signalStrength, readiness, powerScore, fundraisingWindow } =
      computeSignalMetrics(rawMatches, godScore);

    const { error } = await supabase.rpc('upsert_signal_history', {
      p_startup_id: startupId,
      p_signal_strength: signalStrength,
      p_readiness: readiness,
      p_power_score: powerScore,
      p_fundraising_window: fundraisingWindow,
      p_source: source,
      p_meta: { ...meta, match_count: rawMatches?.length || 0 }
    });

    if (error) {
      console.error('[matches] Failed to record signal history:', error);
    } else {
      console.log(`[matches] Recorded signal history: ${powerScore} (${fundraisingWindow})`);
    }
  } catch (err) {
    console.error('[matches] Signal history recording error:', err);
  }
}

// Import convergence endpoint
const { convergenceEndpoint } = require('./routes/convergence.js');

// Import share links router
const shareLinksRouter = require('./routes/shareLinks.js');

// Register share links API routes
app.use('/api/share-links', shareLinksRouter);

// Health check endpoint (with DB ping via Supabase)
// Supports both /api/health and /api/v1/health (for frontend auto-detection)
app.get(['/api/health', '/api/v1/health'], async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('ai_logs').select('created_at').limit(1).single();
    
    res.json({
      status: error ? 'degraded' : 'ok',
      timestamp: new Date().toISOString(),
      port: PORT,
      version: '0.1.0',
      database: { 
        connected: !error, 
        lastActivity: data?.created_at || null,
        error: error?.message || null
      }
    });
  } catch (err) {
    console.error('[/api/health] db error', err);
    res.json({
      status: 'degraded',
      timestamp: new Date().toISOString(),
      port: PORT,
      version: '0.1.0',
      database: { connected: false, error: 'db_unreachable' }
    });
  }
});


// ============================================================
// PHASE B: ENGINE STATUS & EVENT STREAM APIs
// Powers /app/engine and /app/logs pages
// ============================================================

// GET /api/engine/status
// Returns: scraper, scoring, matching, ML health tiles
app.get('/api/engine/status', async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    
    // Get latest ai_logs entries by type
    const { data: logs } = await supabase
      .from('ai_logs')
      .select('type, action, status, output, created_at')
      .in('type', ['scraper', 'score', 'match', 'ml', 'guardian'])
      .order('created_at', { ascending: false })
      .limit(100);

    // Group by type to get latest per system
    const latestByType = {};
    (logs || []).forEach(log => {
      if (!latestByType[log.type]) {
        latestByType[log.type] = log;
      }
    });

    // Count recent activity (last 24h)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const last24h = (logs || []).filter(l => l.created_at >= oneDayAgo);

    // Build health tiles
    const scraperLog = latestByType['scraper'] || {};
    const scraperStatus = scraperLog.status === 'error' ? 'down' : 
                          scraperLog.status === 'warning' ? 'warn' : 'ok';
    const scraperRecent = last24h.filter(l => l.type === 'scraper');
    const scraperThroughput = scraperRecent.length > 0 ? 
      Math.round(scraperRecent.length / 24 * 60) : 0; // per minute estimate

    const scoreLog = latestByType['score'] || {};
    const scoreStatus = scoreLog.status === 'error' ? 'down' : 
                        scoreLog.status === 'warning' ? 'warn' : 'ok';
    const scoreRecent = last24h.filter(l => l.type === 'score');
    const scoresUpdated = scoreRecent.reduce((sum, l) => 
      sum + (l.output?.startups_updated || 0), 0);

    const matchLog = latestByType['match'] || {};
    const matchStatus = matchLog.status === 'error' ? 'down' : 
                       matchLog.status === 'warning' ? 'warn' : 'ok';
    const matchRecent = last24h.filter(l => l.type === 'match');
    const matchesGenerated = matchRecent.reduce((sum, l) => 
      sum + (l.output?.matches_generated || 0), 0);

    const mlLog = latestByType['ml'] || {};
    const mlStatus = mlLog.status === 'error' ? 'down' : 
                     mlLog.status === 'warning' ? 'warn' : 'ok';

    const tiles = [
      {
        label: 'Scraper',
        status: scraperStatus,
        primary: `Throughput: ${scraperThroughput}/min`,
        secondary: `Last run: ${scraperLog.created_at ? 
          Math.round((Date.now() - new Date(scraperLog.created_at)) / 60000) + 'm ago' : 'unknown'}`
      },
      {
        label: 'GOD Scoring',
        status: scoreStatus,
        primary: `Recalc: ${scoresUpdated} startups / 24h`,
        secondary: `Last run: ${scoreLog.created_at ? 
          Math.round((Date.now() - new Date(scoreLog.created_at)) / 60000) + 'm ago' : 'unknown'}`
      },
      {
        label: 'Matching',
        status: matchStatus,
        primary: `Generated: ${matchesGenerated} matches / 24h`,
        secondary: `Last run: ${matchLog.created_at ? 
          Math.round((Date.now() - new Date(matchLog.created_at)) / 60000) + 'm ago' : 'unknown'}`
      },
      {
        label: 'ML Learning',
        status: mlStatus,
        primary: `Model: ${mlLog.output?.model_version || 'v0.7'}`,
        secondary: `Training set: ${mlLog.output?.training_count || '182k'}`
      }
    ];

    res.json({ tiles, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('[/api/engine/status] Error:', error);
    res.status(500).json({ error: 'Failed to fetch engine status' });
  }
});

// GET /api/events?type=&limit=
// Returns: event stream from ai_logs (filterable by type)
app.get('/api/events', async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    const { type, limit = 50 } = req.query;
    
    let query = supabase
      .from('ai_logs')
      .select('created_at, type, action, status, output')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    // Filter by type if provided
    if (type) {
      const types = type.split(',').map(t => t.trim());
      query = query.in('type', types);
    }

    const { data: logs, error } = await query;

    if (error) throw error;

    // Format for frontend
    const events = (logs || []).map(log => ({
      ts: new Date(log.created_at).toISOString().replace('T', ' ').substring(0, 19),
      type: log.type,
      action: log.action,
      status: log.status || 'ok',
      note: log.output?.message || log.output?.note || 
            `${log.output?.items_processed || ''} ${log.output?.action_taken || ''}`.trim() || 
            'completed'
    }));

    res.json({ events, total: events.length, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('[/api/events] Error:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// GET /api/live-signals
// Returns: Recent investor signals for /live page
app.get('/api/live-signals', async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    const { limit = 20 } = req.query;

    // Query investor_events_weighted or ai_logs for recent signals
    const { data: signals, error } = await supabase
      .from('ai_logs')
      .select('created_at, type, action, output')
      .eq('type', 'signal')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (error) throw error;

    // Format as firm · signal · time
    const formatted = (signals || []).map(s => ({
      firm: s.output?.firm || 'Unknown Firm',
      signal: s.output?.signal_type || s.action || 'Activity detected',
      time: formatTimeAgo(new Date(s.created_at))
    }));

    res.json({ signals: formatted, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('[/api/live-signals] Error:', error);
    res.status(500).json({ error: 'Failed to fetch live signals' });
  }
});

// Helper: Format time ago
function formatTimeAgo(date) {
  const mins = Math.floor((Date.now() - date) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return 'today';
}

// ============================================================
// GET /api/pulse - Time-series signals for /live heat chart
// Params: windowHours (default 24, max 168), bucketMinutes (default 10, max 60)
// Returns: bucketed signal activity over time by archetype/channel
// ============================================================
function clampInt(value, def, min, max) {
  const n = Number.parseInt(value ?? def, 10);
  if (Number.isNaN(n)) return def;
  return Math.max(min, Math.min(max, n));
}

app.get('/api/pulse', async (req, res) => {
  const windowHours = clampInt(req.query.windowHours, 24, 1, 168);
  const bucketMinutes = clampInt(req.query.bucketMinutes, 10, 1, 60);

  try {
    const supabase = getSupabaseClient();
    
    // Calculate time window
    const cutoffTime = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();
    
    // Fetch raw data from investor_events_weighted
    const { data: events, error } = await supabase
      .from('investor_events_weighted')
      .select('occurred_at, archetype, event_type, signal_weight')
      .gte('occurred_at', cutoffTime)
      .order('occurred_at', { ascending: true });

    if (error) throw error;

    // Bucket the data in JavaScript
    const bucketMs = bucketMinutes * 60 * 1000;
    const buckets = {};
    
    (events || []).forEach(event => {
      const ts = new Date(event.occurred_at).getTime();
      const bucketTs = Math.floor(ts / bucketMs) * bucketMs;
      const channel = event.archetype || event.event_type || 'unknown';
      const weight = event.signal_weight || 1.0;
      
      const key = `${bucketTs}:${channel}`;
      if (!buckets[key]) {
        buckets[key] = { bucket_ts: new Date(bucketTs).toISOString(), channel, signal: 0 };
      }
      buckets[key].signal += weight;
    });

    const rows = Object.values(buckets).sort((a, b) => 
      new Date(a.bucket_ts).getTime() - new Date(b.bucket_ts).getTime()
    );

    res.json({ ok: true, rows, windowHours, bucketMinutes });
  } catch (err) {
    console.error('[/api/pulse] error', err);
    res.status(500).json({ ok: false, error: 'pulse_query_failed', message: err.message });
  }
});

// ============================================================
// CONVERGENCE ENDPOINT - Capital Intelligence Surface
// GET /api/discovery/convergence?url=https://example.com
// Returns: status, investors (5 visible + hidden preview), comparable startups, coaching
// ============================================================
app.get('/api/discovery/convergence', convergenceEndpoint);

// ============================================================
// Helper: Extract plan from request (JWT verified, DB cached)
// PRODUCTION: Only trust verified JWT via Supabase auth.getUser()
// Reads plan from profiles table (updated by Stripe webhooks)
// DEV/STAGING: Allow x-user-plan header for testing
// ============================================================
// IS_PRODUCTION already declared at top of file

// Simple in-memory cache for plan lookups (5 minute TTL)
const planCache = new Map();
const PLAN_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getPlanFromRequest(req) {
  const validPlans = ['free', 'pro', 'elite'];
  
  // Try JWT first (Authorization: Bearer <token>)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.slice(7);
      const supabase = getSupabaseClient();
      
      // SECURE: Use Supabase auth.getUser() to verify token signature
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (!error && user) {
        // Check cache first
        const cacheKey = user.id;
        const cached = planCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < PLAN_CACHE_TTL) {
          return cached.plan;
        }
        
        // ENTITLEMENTS OVERLAY: Check for active entitlements first
        const effectivePlan = await getEffectivePlan(user.id);
        
        // Cache and return
        planCache.set(cacheKey, { plan: effectivePlan.plan, timestamp: Date.now() });
        return effectivePlan.plan;
      }
      // Token invalid - fall through
    } catch (e) {
      console.error('[getPlanFromRequest] Error:', e.message);
      // Continue to fallbacks
    }
  }
  
  // DEV ONLY: Allow x-user-plan header for testing (NEVER in production)
  if (!IS_PRODUCTION) {
    const headerPlan = req.headers['x-user-plan'];
    if (headerPlan && validPlans.includes(headerPlan)) {
      console.log('[getPlanFromRequest] DEV MODE: Using x-user-plan header:', headerPlan);
      return headerPlan;
    }
  }
  
  // Default: free (unverified users get free tier)
  return 'free';
}

// ============================================================
// Analytics: trackEvent helper (Prompt 18)
// Lightweight event tracking for product analytics
// ============================================================

// Events that update last-touch attribution (high-intent signals)
const ATTRIBUTION_EVENTS = new Set([
  'email_clicked', 'share_opened', 'upgrade_cta_clicked', 
  'pricing_viewed', 'matches_viewed', 'watchlist_toggled'
]);

// Allowlist of valid event names (prevent garbage)
const VALID_EVENT_NAMES = new Set([
  // Server events
  'alert_created', 'email_sent', 'email_clicked', 'email_failed',
  'upgrade_started', 'upgrade_completed', 'subscription_canceled',
  'live_pairings_viewed', 'trending_viewed', 'matches_viewed',
  // Client events
  'pricing_viewed', 'upgrade_cta_clicked', 'matches_page_viewed',
  'export_csv_clicked', 'deal_memo_copied', 'share_created', 'share_opened',
  'watchlist_toggled', 'email_alerts_toggled', 'page_viewed',
  // Referral events (Prompt 24)
  'invite_created', 'invite_opened', 'invite_accepted', 
  'referral_activation', 'reward_granted', 
  'invite_link_copied', 'referral_card_viewed'
]);

/**
 * Track a product event (server-side)
 * @param {Object} params - Event parameters
 * @param {string} params.user_id - User ID (UUID, optional)
 * @param {string} params.session_id - Session ID (optional)
 * @param {string} params.event_name - Event name (required)
 * @param {string} params.source - Event source ('web', 'server', 'email', 'cron')
 * @param {string} params.page - Page path (optional)
 * @param {string} params.referrer - Referrer URL (optional)
 * @param {string} params.entity_type - Entity type ('startup', 'investor', etc.)
 * @param {string} params.entity_id - Entity ID (optional)
 * @param {string} params.plan - User's plan at event time (optional)
 * @param {Object} params.properties - Additional properties (optional)
 */
async function trackEvent({ 
  user_id, session_id, event_name, source = 'server', 
  page, referrer, entity_type, entity_id, plan, properties = {} 
}) {
  if (!event_name) {
    console.warn('[trackEvent] Missing event_name, skipping');
    return null;
  }
  
  // Validate event name (allow unknown in dev for flexibility)
  if (IS_PRODUCTION && !VALID_EVENT_NAMES.has(event_name)) {
    console.warn(`[trackEvent] Unknown event_name: ${event_name}, skipping in production`);
    return null;
  }
  
  try {
    const supabase = getSupabaseClient();
    
    // Insert event
    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .insert({
        user_id,
        session_id,
        event_name,
        source,
        page,
        referrer,
        entity_type,
        entity_id,
        plan,
        properties,
        created_at: new Date().toISOString()
      })
      .select('id, created_at')
      .single();
    
    if (eventError) {
      console.error(`[trackEvent] Error inserting ${event_name}:`, eventError.message);
      return null;
    }
    
    // Update last-touch attribution for high-intent events
    if (user_id && ATTRIBUTION_EVENTS.has(event_name)) {
      const { error: attrError } = await supabase
        .from('user_attribution')
        .upsert({
          user_id,
          last_touch_event_id: eventData.id,
          last_touch_name: event_name,
          last_touch_source: source,
          last_touch_created_at: eventData.created_at,
          last_touch_properties: properties,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
      
      if (attrError) {
        console.warn(`[trackEvent] Attribution upsert error:`, attrError.message);
      }
    }
    
    return eventData;
  } catch (e) {
    console.error(`[trackEvent] Exception:`, e.message);
    return null;
  }
}

// ============================================================
// POST /api/events - Client-side event tracking (Prompt 18)
// ============================================================
app.post('/api/events', async (req, res) => {
  try {
    const { event_name, page, referrer, entity_type, entity_id, properties, session_id } = req.body;
    
    if (!event_name) {
      return res.status(400).json({ error: 'event_name required' });
    }
    
    // Validate event name
    if (!VALID_EVENT_NAMES.has(event_name)) {
      return res.status(400).json({ error: 'Invalid event_name' });
    }
    
    // Get user from JWT if available
    let user_id = null;
    let plan = 'free';
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.slice(7);
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) {
          user_id = user.id;
          plan = await getPlanFromRequest(req);
        }
      } catch (e) {
        // Continue without user
      }
    }
    
    const event = await trackEvent({
      user_id,
      session_id,
      event_name,
      source: 'web',
      page,
      referrer,
      entity_type,
      entity_id,
      plan,
      properties: properties || {}
    });
    
    res.json({ success: true, event_id: event?.id || null });
  } catch (error) {
    console.error('[POST /api/events] Error:', error);
    res.status(500).json({ error: 'Failed to track event' });
  }
});

// ============================================================
// GET /e/click - Email click tracking + redirect (Prompt 18)
// URL format: /e/click?u=<user_id>&n=<notification_id>&to=<destination>
// ============================================================
app.get('/e/click', async (req, res) => {
  try {
    const { u: userId, n: notificationId, to: destination } = req.query;
    
    if (!destination) {
      return res.redirect(process.env.APP_BASE_URL || 'https://pythh.ai');
    }
    
    // Security: Validate destination starts with our domain (prevent open redirect)
    const baseUrl = process.env.APP_BASE_URL || 'https://pythh.ai';
    const decodedDest = decodeURIComponent(destination);
    if (!decodedDest.startsWith(baseUrl) && !decodedDest.startsWith('/')) {
      console.warn(`[/e/click] Blocked open redirect attempt: ${decodedDest}`);
      return res.redirect(baseUrl);
    }
    
    // Track the click event (fire and forget, don't block redirect)
    trackEvent({
      user_id: userId || null,
      event_name: 'email_clicked',
      source: 'email',
      entity_type: 'notification',
      entity_id: notificationId || null,
      properties: {
        notification_id: notificationId,
        destination: decodedDest
      }
    }).catch(e => console.error('[/e/click] trackEvent error:', e.message));
    
    // Redirect to destination
    res.redirect(302, decodedDest.startsWith('/') ? `${baseUrl}${decodedDest}` : decodedDest);
  } catch (error) {
    console.error('[/e/click] Error:', error);
    res.redirect(process.env.APP_BASE_URL || 'https://pythh.ai');
  }
});

// Plan limits for live-pairings
const PLAN_LIMITS = { free: 1, pro: 3, elite: 10 };

// ============================================================
// GET /api/live-pairings - Live Signal Pairings for landing page
// Returns top startups paired with matching investors
// SERVER-SIDE GATING: Enforces plan limits and field masking
// ============================================================
app.get('/api/live-pairings', async (req, res) => {
  try {
    // Determine plan and enforce limit (await - async JWT verification)
    const plan = await getPlanFromRequest(req);
    const maxLimit = PLAN_LIMITS[plan] || 1;
    const requestedLimit = parseInt(req.query.limit) || maxLimit;
    // Double clamp: enforce plan ceiling AND absolute max of 10
    const limit = Math.min(Math.max(requestedLimit, 1), maxLimit, 10);
    
    const supabase = getSupabaseClient();
    
    // Step 1: Get top startups from v5_sector view
    const { data: startups, error: startupError } = await supabase
      .from('startup_intel_v5_sector')
      .select('id, name, sector_key, investor_signal_sector_0_10, investor_state_sector, sector_momentum_0_10, sector_evidence_0_10, sector_narrative_0_10')
      .not('sector_key', 'is', null)
      .not('investor_signal_sector_0_10', 'is', null)
      .gte('investor_signal_sector_0_10', 5)
      .order('investor_signal_sector_0_10', { ascending: false })
      .limit(50);
    
    if (startupError) {
      console.error('[live-pairings] Startup query error:', startupError);
      return res.status(500).json({ error: 'Failed to fetch startups' });
    }
    
    if (!startups || startups.length === 0) {
      return res.status(200).json([]);
    }
    
    // Step 2: Get investors
    const { data: investors, error: investorError } = await supabase
      .from('investors')
      .select('id, name, sectors, investment_thesis, firm_description_normalized')
      .not('name', 'is', null)
      .limit(200);
    
    if (investorError) {
      console.error('[live-pairings] Investor query error:', investorError);
      return res.status(500).json({ error: 'Failed to fetch investors' });
    }
    
    // Step 3: Create pairings by matching sectors
    const pairings = [];
    const usedStartups = new Set();
    const usedInvestors = new Set();
    
    // Sort startups: 'hot' first, then by signal score
    const sortedStartups = [...startups].sort((a, b) => {
      if (a.investor_state_sector === 'hot' && b.investor_state_sector !== 'hot') return -1;
      if (b.investor_state_sector === 'hot' && a.investor_state_sector !== 'hot') return 1;
      return (b.investor_signal_sector_0_10 || 0) - (a.investor_signal_sector_0_10 || 0);
    });
    
    for (const startup of sortedStartups) {
      if (pairings.length >= limit) break;
      if (usedStartups.has(startup.id)) continue;
      
      const sectorKey = startup.sector_key?.toLowerCase() || '';
      
      // Find matching investor
      const matchingInvestor = investors.find(inv => {
        if (usedInvestors.has(inv.id)) return false;
        
        // Check sectors array
        if (inv.sectors && Array.isArray(inv.sectors)) {
          if (inv.sectors.some(s => s?.toLowerCase()?.includes(sectorKey) || sectorKey.includes(s?.toLowerCase() || ''))) {
            return true;
          }
        }
        // Check investment_thesis
        if (inv.investment_thesis?.toLowerCase()?.includes(sectorKey)) {
          return true;
        }
        // Check firm description
        if (inv.firm_description_normalized?.toLowerCase()?.includes(sectorKey)) {
          return true;
        }
        return false;
      });
      
      if (matchingInvestor) {
        usedStartups.add(startup.id);
        usedInvestors.add(matchingInvestor.id);
        
        // Determine reason based on strongest dimension
        const momentum = startup.sector_momentum_0_10 || 0;
        const evidence = startup.sector_evidence_0_10 || 0;
        const narrative = startup.sector_narrative_0_10 || 0;
        
        let reason = 'Thesis convergence';
        if (momentum >= evidence && momentum >= narrative) {
          reason = 'Capital velocity';
        } else if (evidence >= momentum && evidence >= narrative) {
          reason = 'Stage readiness';
        }
        
        // Confidence = signal / 10, clamped 0-1
        const confidence = Math.min(Math.max((startup.investor_signal_sector_0_10 || 0) / 10, 0), 1);
        
        // Apply field masking based on plan
        // free: mask investor_name, reason, confidence
        // pro: mask reason, confidence
        // elite: show everything
        pairings.push({
          startup_id: startup.id,
          startup_name: startup.name,
          investor_id: plan === 'free' ? null : matchingInvestor.id,
          investor_name: plan === 'free' ? null : matchingInvestor.name,
          reason: plan === 'elite' ? reason : null,
          confidence: plan === 'elite' ? confidence : null,
          sector_key: startup.sector_key,
          created_at: new Date().toISOString()
        });
      }
    }
    
    // Set caching headers based on plan (elite gets fresher data)
    const cacheMaxAge = plan === 'elite' ? 15 : 60;
    res.set('Cache-Control', `public, max-age=${cacheMaxAge}`);
    res.set('X-Plan', plan); // Debug header
    res.json(pairings);
    
  } catch (error) {
    console.error('[live-pairings] Error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Plan limits for trending/sector endpoint
const TRENDING_LIMITS = { free: 3, pro: 10, elite: 50 };

// ============================================================
// GET /api/trending - Sector/Trending data with tier gating
// Returns startups with sector signals, gated by plan
// ============================================================
app.get('/api/trending', async (req, res) => {
  try {
    // Determine plan and enforce limit
    const plan = await getPlanFromRequest(req);
    const maxLimit = TRENDING_LIMITS[plan] || 3;
    const requestedLimit = parseInt(req.query.limit) || maxLimit;
    const limit = Math.min(Math.max(requestedLimit, 1), maxLimit, 50);
    const sector = req.query.sector || null; // Optional sector filter
    
    const supabase = getSupabaseClient();
    
    // Query startup_intel_v5_sector view with sector filter
    // Available columns: investor_signal_sector_0_10, investor_state_sector, sector_quantile,
    // sector_momentum_0_10, sector_evidence_0_10, sector_narrative_0_10, primary_reason, risk_flag
    let query = supabase
      .from('startup_intel_v5_sector')
      .select('id, name, sector_key, investor_signal_sector_0_10, investor_state_sector, sector_quantile, sector_momentum_0_10, sector_evidence_0_10, sector_narrative_0_10, primary_reason, risk_flag')
      .not('sector_key', 'is', null)
      .not('investor_state_sector', 'is', null);
    
    if (sector) {
      query = query.ilike('sector_key', `%${sector}%`);
    }
    
    const { data: startups, error } = await query
      .order('investor_signal_sector_0_10', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('[trending] Query error:', error);
      return res.status(500).json({ error: 'Failed to fetch trending data' });
    }
    
    // Apply field masking based on plan
    // free: name + sector + state only; hide all scores/reasons
    // pro: show investor_signal_sector_0_10 + state; hide sector scores + reasons
    // elite: show everything including sector_quantile, momentum, evidence, narrative, reason, risk
    const maskedStartups = (startups || []).map(s => {
      // Base fields (all tiers)
      const base = {
        id: s.id,
        name: s.name,
        sector_key: s.sector_key,
        investor_state_sector: s.investor_state_sector, // hot/warm/watch/cold
      };
      
      if (plan === 'free') {
        // Free: Only state, no scores
        return base;
      }
      
      if (plan === 'pro') {
        // Pro: Add global signal score
        return {
          ...base,
          investor_signal_sector_0_10: s.investor_signal_sector_0_10,
        };
      }
      
      // Elite: Everything
      return {
        ...base,
        investor_signal_sector_0_10: s.investor_signal_sector_0_10,
        sector_quantile: s.sector_quantile,
        sector_momentum_0_10: s.sector_momentum_0_10,
        sector_evidence_0_10: s.sector_evidence_0_10,
        sector_narrative_0_10: s.sector_narrative_0_10,
        primary_reason: s.primary_reason,
        risk_flag: s.risk_flag,
      };
    });
    
    // Set caching headers based on plan
    const cacheMaxAge = plan === 'elite' ? 30 : 120;
    res.set('Cache-Control', `public, max-age=${cacheMaxAge}`);
    res.set('X-Plan', plan);
    res.json({
      plan,
      limit,
      total: maskedStartups.length,
      data: maskedStartups,
    });
    
  } catch (error) {
    console.error('[trending] Error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Plan limits for investor matches endpoint
const MATCH_LIMITS = { free: 3, pro: 10, elite: 50 };

// Import guardrails utilities
const { rateLimitMatches } = require('./middleware/rateLimit');
const { safeLog } = require('./utils/safeLog');
const { withTimeout, TimeoutError, TIMEOUTS } = require('./utils/withTimeout');
const { matchesCache } = require('./utils/cache');

// ============================================================
// GET /api/matches - Startup → Investor matches with tier gating
// Core conversion endpoint - the page people pay for
// HARDENED: rate limit + cache + timeout + degradation
// ============================================================
app.get('/api/matches', rateLimitMatches((req) => req.user?.id || null), async (req, res) => {
  const requestId = req.requestId;
  const startTime = Date.now();
  let degraded = false;
  const degradationReasons = [];
  
  try {
    const startupId = req.query.startup_id;
    if (!startupId) {
      safeLog('warn', 'matches.missing_id', { requestId });
      return res.status(400).json({ error: 'startup_id is required' });
    }
    
    // Determine plan and enforce limit
    const plan = await getPlanFromRequest(req);
    const maxLimit = MATCH_LIMITS[plan] || 3;
    const requestedLimit = parseInt(req.query.limit) || maxLimit;
    const limit = Math.min(Math.max(requestedLimit, 1), maxLimit, 50);
    
    // Check cache first
    const cacheKey = `matches:v1:${startupId}:${plan}`;
    const cached = matchesCache.get(cacheKey);
    if (cached) {
      safeLog('info', 'matches.cache_hit', {
        requestId,
        startupId,
        plan,
        duration_ms: Date.now() - startTime,
      });
      res.set('X-Cache', 'HIT');
      res.set('X-Request-ID', requestId);
      return res.json({ ...cached, cached: true });
    }
    
    const supabase = getSupabaseClient();
    
    // Step 1: Get startup details (with timeout)
    let startup;
    try {
      const { data, error } = await withTimeout(
        supabase
          .from('startup_uploads')
          .select('id, name, sectors, stage, tagline, total_god_score')
          .eq('id', startupId)
          .single(),
        TIMEOUTS.SUPABASE_READ,
        'startup query'
      );
      
      if (error || !data) {
        safeLog('error', 'matches.startup_not_found', {
          requestId,
          startupId,
          error: error?.message,
        });
        return res.status(404).json({ error: 'Startup not found' });
      }
      
      startup = data;
    } catch (timeoutError) {
      safeLog('error', 'matches.startup_timeout', {
        requestId,
        startupId,
        error: timeoutError.message,
      });
      return res.status(504).json({ error: 'Startup query timed out', request_id: requestId });
    }
    
    // Step 2: Get matches (with timeout + graceful degradation)
    let matchData;
    try {
      const { data, error } = await withTimeout(
        supabase
          .from('startup_investor_matches')
          .select('investor_id, match_score, confidence_level, reasoning, why_you_match, fit_analysis')
          .eq('startup_id', startupId)
          .gte('match_score', 20)
          .order('match_score', { ascending: false })
          .limit(limit),
        TIMEOUTS.SUPABASE_READ,
        'matches query'
      );
      
      if (error) {
        throw error;
      }
      
      matchData = data || [];
    } catch (matchError) {
      // GRACEFUL DEGRADATION: Return partial results instead of failing
      const isPostgresTimeout = matchError.message?.includes('statement timeout') || 
                                matchError.message?.includes('canceling statement') ||
                                matchError.code === '57014'; // Postgres query_canceled
      
      safeLog('error', 'matches.query_failed', {
        requestId,
        startupId,
        error: matchError.message,
        code: matchError.code,
        is_postgres_timeout: isPostgresTimeout,
      });
      
      degraded = true;
      degradationReasons.push(isPostgresTimeout ? 'database query timeout' : 'match query failed');
      matchData = [];
    }
    
    // Step 2.5: Record signal history (BEFORE tier gating, non-blocking)
    try {
      await withTimeout(
        recordSignalHistory({
          supabase,
          startupId: startup.id,
          rawMatches: matchData,
          godScore: startup.total_god_score,
          source: 'scan',
          meta: { endpoint: '/api/matches', request_id: requestId }
        }),
        TIMEOUTS.SUPABASE_WRITE,
        'signal history recording'
      );
    } catch (historyError) {
      // Log but don't fail the request
      safeLog('warn', 'matches.history_failed', {
        requestId,
        startupId,
        error: historyError.message,
      });
      degraded = true;
      degradationReasons.push('history recording failed');
    }
    
    // Step 3: Get total count (with timeout, non-critical)
    let totalMatches = matchData.length;
    try {
      const { count } = await withTimeout(
        supabase
          .from('startup_investor_matches')
          .select('id', { count: 'exact', head: true })
          .eq('startup_id', startupId)
          .gte('match_score', 20),
        TIMEOUTS.SUPABASE_READ,
        'match count query'
      );
      totalMatches = count || matchData.length;
    } catch (countError) {
      // Non-critical - use fallback
      safeLog('warn', 'matches.count_failed', {
        requestId,
        startupId,
        error: countError.message,
      });
      degraded = true;
      degradationReasons.push('count query failed');
    }
    
    // Step 4: Get investor details (with timeout + graceful degradation)
    const investorIds = matchData.map(m => m.investor_id).filter(Boolean);
    let investors = [];
    
    if (investorIds.length > 0) {
      try {
        const { data } = await withTimeout(
          supabase
            .from('investors')
            .select('id, name, firm, photo_url, linkedin_url, sectors, stage, check_size_min, check_size_max, type, notable_investments, investment_thesis')
            .in('id', investorIds),
          TIMEOUTS.SUPABASE_READ,
          'investor query'
        );
        investors = data || [];
      } catch (investorError) {
        // GRACEFUL DEGRADATION: Show matches without investor details
        safeLog('warn', 'matches.investors_failed', {
          requestId,
          startupId,
          error: investorError.message,
        });
        degraded = true;
        degradationReasons.push('investor details unavailable');
      }
    }
    
    const investorMap = new Map(investors.map(inv => [inv.id, inv]));
    
    // Step 5: Apply field masking based on plan
    const maskedMatches = matchData.map(m => {
      const investor = investorMap.get(m.investor_id) || {};
      
      // Base fields (all tiers) - always include score + firm hint
      const base = {
        investor_id: m.investor_id,
        match_score: m.match_score,
        // Firm is always shown (hint for free users)
        firm: investor.firm || null,
        // Photo always shown (visual hook for free tier)
        photo_url: investor.photo_url || null,
        // Sector key for sorting/filtering
        sectors: investor.sectors || [],
        // Stage for filtering
        stage: investor.stage || [],
        // Type (VC/Angel/etc)
        type: investor.type || null,
      };
      
      if (plan === 'free') {
        // Free: Show logo + firm, mask name. No reasons/confidence.
        return {
          ...base,
          investor_name: null, // MASKED - upgrade to reveal
          investor_name_masked: true,
          linkedin_url: null, // Hidden
          check_size_min: null,
          check_size_max: null,
          notable_investments: null,
          reasoning: null,
          confidence_level: null,
          why_you_match: null,
          fit_analysis: null,
        };
      }
      
      if (plan === 'pro') {
        // Pro: Show name + firm + check size. Hide detailed reasoning/confidence.
        return {
          ...base,
          investor_name: investor.name || 'Unknown Investor',
          investor_name_masked: false,
          linkedin_url: investor.linkedin_url || null,
          check_size_min: investor.check_size_min || null,
          check_size_max: investor.check_size_max || null,
          notable_investments: investor.notable_investments || null,
          reasoning: null, // MASKED - upgrade to elite
          confidence_level: null,
          why_you_match: null,
          fit_analysis: null,
        };
      }
      
      // Elite: Everything
      return {
        ...base,
        investor_name: investor.name || 'Unknown Investor',
        investor_name_masked: false,
        linkedin_url: investor.linkedin_url || null,
        check_size_min: investor.check_size_min || null,
        check_size_max: investor.check_size_max || null,
        notable_investments: investor.notable_investments || null,
        investment_thesis: investor.investment_thesis || null,
        reasoning: m.reasoning || null,
        confidence_level: m.confidence_level || null,
        why_you_match: m.why_you_match || null,
        fit_analysis: m.fit_analysis || null,
      };
    });
    
    // Build response
    const response = {
      plan,
      startup: {
        id: startup.id,
        name: startup.name,
        sectors: startup.sectors,
        stage: startup.stage,
        tagline: startup.tagline,
      },
      limit,
      showing: maskedMatches.length,
      total: totalMatches,
      data: maskedMatches,
      degraded,
      degradation_reasons: degraded ? degradationReasons : undefined,
    };
    
    // Cache the response (even if degraded - prevents retry storms)
    matchesCache.set(cacheKey, response);
    
    // Set headers
    const cacheMaxAge = plan === 'elite' ? 60 : 300;
    res.set('Cache-Control', `private, max-age=${cacheMaxAge}`);
    res.set('X-Plan', plan);
    res.set('X-Cache', 'MISS');
    res.set('X-Request-ID', requestId);
    if (degraded) {
      res.set('X-Degraded', 'true');
    }
    
    // Log success
    safeLog('info', 'matches.success', {
      requestId,
      startupId,
      plan,
      showing: maskedMatches.length,
      total: totalMatches,
      degraded,
      duration_ms: Date.now() - startTime,
    });
    
    res.json(response);
    
  } catch (error) {
    safeLog('error', 'matches.error', {
      requestId,
      error: error.message,
      stack: error.stack,
      duration_ms: Date.now() - startTime,
    });
    
    res.status(500).json({ 
      error: 'Failed to fetch matches',
      request_id: requestId,
      degraded: true,
    });
  }
});

// ============================================================
// STRIPE BILLING ENDPOINTS
// Handles subscription checkout, portal, and webhooks
// ============================================================

// Initialize Stripe (lazy-loaded to handle missing key gracefully)
let stripeInstance = null;
function getStripe() {
  if (!stripeInstance) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY not configured');
    }
    const Stripe = require('stripe');
    stripeInstance = new Stripe(secretKey, {
      apiVersion: '2024-12-18.acacia'
    });
  }
  return stripeInstance;
}

// Price IDs from environment
const STRIPE_PRICES = {
  pro: process.env.STRIPE_PRICE_PRO_MONTHLY,
  elite: process.env.STRIPE_PRICE_ELITE_MONTHLY
};

// POST /api/billing/create-checkout-session
// Creates a Stripe Checkout session for subscription
app.post('/api/billing/create-checkout-session', async (req, res) => {
  try {
    const { plan } = req.body;
    
    // Validate plan
    if (!['pro', 'elite'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan. Must be "pro" or "elite"' });
    }
    
    const priceId = STRIPE_PRICES[plan];
    if (!priceId) {
      return res.status(500).json({ error: `Price ID not configured for ${plan} plan` });
    }
    
    // Get authenticated user
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const token = authHeader.slice(7);
    const supabase = getSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    const stripe = getStripe();
    
    // Check if user already has a Stripe customer ID
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();
    
    let customerId = profile?.stripe_customer_id;
    
    // Create customer if not exists
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id }
      });
      customerId = customer.id;
      
      // Save customer ID to profile
      await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          email: user.email,
          stripe_customer_id: customerId
        }, { onConflict: 'id' });
    }
    
    // Create checkout session
    const successUrl = process.env.STRIPE_SUCCESS_URL || `${req.headers.origin || 'http://localhost:5173'}/billing/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = process.env.STRIPE_CANCEL_URL || `${req.headers.origin || 'http://localhost:5173'}/pricing`;
    
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{
        price: priceId,
        quantity: 1
      }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          plan: plan
        }
      },
      metadata: {
        supabase_user_id: user.id,
        plan: plan
      }
    });
    
    console.log(`[billing] Created checkout session for user ${user.id}, plan ${plan}`);
    
    // Track upgrade_started event
    trackEvent({
      user_id: user.id,
      event_name: 'upgrade_started',
      source: 'server',
      page: '/pricing',
      plan: currentPlan,
      properties: {
        target_plan: plan,
        price_id: priceId,
        checkout_session_id: session.id
      }
    }).catch(e => console.error('[upgrade_started] trackEvent error:', e.message));
    
    res.json({ url: session.url, sessionId: session.id });
    
  } catch (error) {
    console.error('[billing/create-checkout-session] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/billing/create-portal-session
// Creates a Stripe Customer Portal session for managing subscriptions
app.post('/api/billing/create-portal-session', async (req, res) => {
  try {
    // Get authenticated user
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const token = authHeader.slice(7);
    const supabase = getSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    // Get customer ID from profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();
    
    if (!profile?.stripe_customer_id) {
      return res.status(400).json({ error: 'No subscription found' });
    }
    
    const stripe = getStripe();
    const returnUrl = process.env.STRIPE_PORTAL_RETURN_URL || `${req.headers.origin || 'http://localhost:5173'}/settings`;
    
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: returnUrl
    });
    
    console.log(`[billing] Created portal session for user ${user.id}`);
    res.json({ url: session.url });
    
  } catch (error) {
    console.error('[billing/create-portal-session] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/billing/webhook
// Stripe webhook handler - updates profiles table on subscription events
// IMPORTANT: Must use raw body for signature verification
app.post('/api/billing/webhook', 
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      console.error('[billing/webhook] STRIPE_WEBHOOK_SECRET not configured');
      return res.status(500).send('Webhook secret not configured');
    }
    
    let event;
    try {
      const stripe = getStripe();
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      console.error('[billing/webhook] Signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    
    const supabase = getSupabaseClient();
    
    console.log(`[billing/webhook] Received event: ${event.type}`);
    
    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object;
          const userId = session.metadata?.supabase_user_id;
          const plan = session.metadata?.plan;
          
          if (userId && plan) {
            await supabase.from('profiles').upsert({
              id: userId,
              stripe_customer_id: session.customer,
              stripe_subscription_id: session.subscription,
              plan: plan,
              plan_status: 'active'
            }, { onConflict: 'id' });
            console.log(`[billing/webhook] User ${userId} upgraded to ${plan}`);
            
            // Track upgrade_completed with attribution
            const { data: attribution } = await supabase
              .from('user_attribution')
              .select('*')
              .eq('user_id', userId)
              .single();
            
            trackEvent({
              user_id: userId,
              event_name: 'upgrade_completed',
              source: 'server',
              plan: plan,
              properties: {
                new_plan: plan,
                subscription_id: session.subscription,
                // Attribution: what drove this upgrade?
                upgrade_source_event_name: attribution?.last_touch_name || null,
                upgrade_source_event_id: attribution?.last_touch_event_id || null,
                upgrade_source_source: attribution?.last_touch_source || null,
                upgrade_source_properties: attribution?.last_touch_properties || {}
              }
            }).catch(e => console.error('[upgrade_completed] trackEvent error:', e.message));
          }
          break;
        }
        
        case 'customer.subscription.updated': {
          const subscription = event.data.object;
          const customerId = subscription.customer;
          
          // Find user by customer ID
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('stripe_customer_id', customerId)
            .single();
          
          if (profile) {
            const plan = subscription.metadata?.plan || 
                         (subscription.items.data[0]?.price.id === STRIPE_PRICES.elite ? 'elite' : 'pro');
            
            await supabase.from('profiles').update({
              stripe_subscription_id: subscription.id,
              plan: plan,
              plan_status: subscription.status,
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
            }).eq('id', profile.id);
            
            console.log(`[billing/webhook] Updated subscription for user ${profile.id}: ${plan}, ${subscription.status}`);
          }
          break;
        }
        
        case 'customer.subscription.deleted': {
          const subscription = event.data.object;
          const customerId = subscription.customer;
          
          // Find user by customer ID
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('stripe_customer_id', customerId)
            .single();
          
          if (profile) {
            await supabase.from('profiles').update({
              plan: 'free',
              plan_status: 'canceled',
              stripe_subscription_id: null,
              current_period_end: null
            }).eq('id', profile.id);
            
            console.log(`[billing/webhook] Subscription canceled for user ${profile.id}`);
            
            // Track subscription_canceled
            trackEvent({
              user_id: profile.id,
              event_name: 'subscription_canceled',
              source: 'server',
              plan: 'free',
              properties: {
                previous_subscription_id: subscription.id,
                canceled_at: new Date().toISOString()
              }
            }).catch(e => console.error('[subscription_canceled] trackEvent error:', e.message));
          }
          break;
        }
        
        case 'invoice.payment_failed': {
          const invoice = event.data.object;
          const customerId = invoice.customer;
          
          // Find user by customer ID
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('stripe_customer_id', customerId)
            .single();
          
          if (profile) {
            await supabase.from('profiles').update({
              plan_status: 'past_due'
            }).eq('id', profile.id);
            
            console.log(`[billing/webhook] Payment failed for user ${profile.id}`);
          }
          break;
        }
        
        default:
          console.log(`[billing/webhook] Unhandled event type: ${event.type}`);
      }
      
      res.json({ received: true });
      
    } catch (error) {
      console.error('[billing/webhook] Error processing event:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// GET /api/billing/status
// Returns current subscription status for authenticated user
app.get('/api/billing/status', async (req, res) => {
  try {
    // Get authenticated user
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const token = authHeader.slice(7);
    const supabase = getSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    // Get profile with subscription info
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan, plan_status, current_period_end, stripe_customer_id')
      .eq('id', user.id)
      .single();
    
    if (!profile) {
      return res.json({
        plan: 'free',
        plan_status: 'active',
        hasSubscription: false
      });
    }
    
    res.json({
      plan: profile.plan || 'free',
      plan_status: profile.plan_status || 'active',
      current_period_end: profile.current_period_end,
      hasSubscription: !!profile.stripe_customer_id
    });
    
  } catch (error) {
    console.error('[billing/status] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/billing/create-guest-checkout
// Creates a Stripe Checkout session for NEW users (no auth required)
// Flow: collect email → Stripe checkout → account creation on success page
app.post('/api/billing/create-guest-checkout', async (req, res) => {
  try {
    const { plan } = req.body;
    
    if (!['pro', 'elite'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan. Must be "pro" or "elite"' });
    }
    
    const priceId = STRIPE_PRICES[plan];
    if (!priceId) {
      return res.status(500).json({ error: `Price ID not configured for ${plan} plan` });
    }
    
    const stripe = getStripe();
    
    const successUrl = `${req.headers.origin || 'http://localhost:5173'}/signup/complete?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${req.headers.origin || 'http://localhost:5173'}/pricing`;
    
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{
        price: priceId,
        quantity: 1
      }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        plan: plan,
        flow: 'guest_checkout'
      },
      subscription_data: {
        metadata: {
          plan: plan
        }
      }
    });
    
    console.log(`[billing] Created guest checkout session for plan ${plan}: ${session.id}`);
    res.json({ url: session.url, sessionId: session.id });
    
  } catch (error) {
    console.error('[billing/create-guest-checkout] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/billing/verify-session
// Verifies a Stripe checkout session and returns email + plan (no auth required)
// Used by the signup completion page after payment
app.get('/api/billing/verify-session', async (req, res) => {
  try {
    const { session_id } = req.query;
    
    if (!session_id) {
      return res.status(400).json({ error: 'session_id is required' });
    }
    
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ['subscription', 'customer']
    });
    
    if (session.payment_status !== 'paid') {
      return res.status(400).json({ error: 'Payment not completed', status: session.payment_status });
    }
    
    res.json({
      email: session.customer_details?.email || session.customer?.email,
      plan: session.metadata?.plan || 'pro',
      customerId: session.customer?.id || session.customer,
      subscriptionId: session.subscription?.id || session.subscription,
      status: 'paid'
    });
    
  } catch (error) {
    console.error('[billing/verify-session] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/billing/complete-signup
// Creates a Supabase auth user after successful Stripe payment
// Links the Stripe customer/subscription to the new user profile
app.post('/api/billing/complete-signup', async (req, res) => {
  try {
    const { session_id, password } = req.body;
    
    if (!session_id || !password) {
      return res.status(400).json({ error: 'session_id and password are required' });
    }
    
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    
    // Verify the Stripe session
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ['subscription', 'customer']
    });
    
    if (session.payment_status !== 'paid') {
      return res.status(400).json({ error: 'Payment not completed' });
    }
    
    const email = session.customer_details?.email || session.customer?.email;
    const plan = session.metadata?.plan || 'pro';
    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
    const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
    
    if (!email) {
      return res.status(400).json({ error: 'No email found in checkout session' });
    }
    
    // Create Supabase auth user via admin API
    const supabase = getSupabaseClient();
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Auto-confirm since they paid
      user_metadata: {
        name: email.split('@')[0],
        role: 'founder'
      }
    });
    
    if (authError) {
      // If user already exists, try to sign them in instead
      if (authError.message.includes('already been registered') || authError.message.includes('already exists')) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: email,
          password: password
        });
        
        if (signInError) {
          return res.status(400).json({ 
            error: 'An account with this email already exists. Please log in instead.',
            code: 'existing_user'
          });
        }
        
        // Update existing user's profile with subscription info
        await supabase.from('profiles').upsert({
          id: signInData.user.id,
          email: email,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          plan: plan,
          plan_status: 'active'
        }, { onConflict: 'id' });
        
        // Update Stripe customer metadata
        await stripe.customers.update(customerId, {
          metadata: { supabase_user_id: signInData.user.id }
        });
        
        // Update subscription metadata
        if (subscriptionId) {
          await stripe.subscriptions.update(subscriptionId, {
            metadata: { supabase_user_id: signInData.user.id, plan: plan }
          });
        }
        
        console.log(`[billing/complete-signup] Existing user ${signInData.user.id} linked to subscription, plan: ${plan}`);
        
        return res.json({
          userId: signInData.user.id,
          accessToken: signInData.session?.access_token,
          refreshToken: signInData.session?.refresh_token,
          plan: plan,
          isExistingUser: true
        });
      }
      
      throw authError;
    }
    
    const userId = authData.user.id;
    
    // Update profile with Stripe subscription info
    // (handle_new_user trigger creates the base profile, we add billing data)
    await supabase.from('profiles').upsert({
      id: userId,
      email: email,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      plan: plan,
      plan_status: 'active'
    }, { onConflict: 'id' });
    
    // Update Stripe customer metadata with Supabase user ID
    await stripe.customers.update(customerId, {
      metadata: { supabase_user_id: userId }
    });
    
    // Update subscription metadata
    if (subscriptionId) {
      await stripe.subscriptions.update(subscriptionId, {
        metadata: { supabase_user_id: userId, plan: plan }
      });
    }
    
    // Sign in the new user to get session tokens
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    });
    
    if (signInError) {
      // User was created but sign-in failed - they can log in manually
      console.error(`[billing/complete-signup] Sign-in failed for new user ${userId}:`, signInError.message);
      return res.json({
        userId: userId,
        plan: plan,
        needsLogin: true
      });
    }
    
    console.log(`[billing/complete-signup] New user ${userId} created with plan ${plan}`);
    
    // Track signup + upgrade
    trackEvent({
      user_id: userId,
      event_name: 'signup_with_paid_plan',
      source: 'server',
      plan: plan,
      properties: {
        checkout_session_id: session_id,
        subscription_id: subscriptionId
      }
    }).catch(e => console.error('[signup_with_paid_plan] trackEvent error:', e.message));
    
    res.json({
      userId: userId,
      accessToken: signInData.session?.access_token,
      refreshToken: signInData.session?.refresh_token,
      plan: plan,
      isExistingUser: false
    });
    
  } catch (error) {
    console.error('[billing/complete-signup] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// END STRIPE BILLING ENDPOINTS
// ============================================================

// ============================================================
// ELITE EXPORT, MEMO, AND SHARE ENDPOINTS
// All require Elite plan
// ============================================================

// Helper: Convert array of objects to CSV string
function toCsv(rows, columns) {
  if (!rows || rows.length === 0) return '';
  
  // Escape CSV value (handle commas, quotes, newlines)
  const escapeValue = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    // If contains comma, quote, or newline, wrap in quotes and escape internal quotes
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  
  // Header row
  const header = columns.map(c => escapeValue(c.label || c.key)).join(',');
  
  // Data rows
  const dataRows = rows.map(row => 
    columns.map(c => escapeValue(row[c.key])).join(',')
  ).join('\n');
  
  return header + '\n' + dataRows;
}

// Helper: Format check size range
function formatCheckSize(min, max) {
  if (!min && !max) return '';
  const fmt = (n) => n >= 1000000 ? `$${n/1000000}M` : `$${n/1000}K`;
  if (min && max) return `${fmt(min)}-${fmt(max)}`;
  if (min) return `${fmt(min)}+`;
  return `Up to ${fmt(max)}`;
}

// GET /api/matches/export.csv - Elite-only CSV export
app.get('/api/matches/export.csv', async (req, res) => {
  try {
    const plan = await getPlanFromRequest(req);
    
    // Elite-only
    if (plan !== 'elite') {
      return res.status(403).json({ error: 'upgrade_required', message: 'CSV export requires Elite plan' });
    }
    
    const startupId = req.query.startup_id;
    if (!startupId) {
      return res.status(400).json({ error: 'startup_id required' });
    }
    
    const requestedLimit = parseInt(req.query.limit) || 50;
    const limit = Math.min(Math.max(requestedLimit, 1), 50); // Clamp to max 50
    
    const supabase = getSupabaseClient();
    
    // Get startup details
    const { data: startup, error: startupError } = await supabase
      .from('startup_uploads')
      .select('id, name, sectors')
      .eq('id', startupId)
      .single();
    
    if (startupError || !startup) {
      return res.status(404).json({ error: 'Startup not found' });
    }
    
    // Get matches with full data
    const { data: matchData } = await supabase
      .from('startup_investor_matches')
      .select('investor_id, match_score, confidence_level, reasoning, fit_analysis, why_you_match')
      .eq('startup_id', startupId)
      .gte('match_score', 20)
      .order('match_score', { ascending: false })
      .limit(limit);
    
    // Get investor details
    const investorIds = (matchData || []).map(m => m.investor_id).filter(Boolean);
    let investors = [];
    if (investorIds.length > 0) {
      const { data: investorData } = await supabase
        .from('investors')
        .select('id, name, firm, linkedin_url, sectors, stage, check_size_min, check_size_max, type, notable_investments, investment_thesis')
        .in('id', investorIds);
      investors = investorData || [];
    }
    
    const investorMap = new Map(investors.map(inv => [inv.id, inv]));
    
    // Build rows for CSV
    const rows = (matchData || []).map(m => {
      const inv = investorMap.get(m.investor_id) || {};
      return {
        startup_id: startupId,
        startup_name: startup.name,
        sector_key: Array.isArray(startup.sectors) ? startup.sectors[0] : startup.sectors,
        investor_id: m.investor_id,
        investor_name: inv.name || '',
        firm: inv.firm || '',
        stage: Array.isArray(inv.stage) ? inv.stage.join('; ') : (inv.stage || ''),
        type: inv.type || '',
        check_size: formatCheckSize(inv.check_size_min, inv.check_size_max),
        linkedin_url: inv.linkedin_url || '',
        notable_investments: inv.notable_investments || '',
        confidence_level: m.confidence_level || '',
        reason: m.reasoning || m.why_you_match || '',
        fit_analysis: m.fit_analysis || '',
        investment_thesis: inv.investment_thesis || ''
      };
    });
    
    // Define CSV columns
    const columns = [
      { key: 'startup_id', label: 'startup_id' },
      { key: 'startup_name', label: 'startup_name' },
      { key: 'sector_key', label: 'sector_key' },
      { key: 'investor_id', label: 'investor_id' },
      { key: 'investor_name', label: 'investor_name' },
      { key: 'firm', label: 'firm' },
      { key: 'stage', label: 'stage' },
      { key: 'type', label: 'type' },
      { key: 'check_size', label: 'check_size' },
      { key: 'linkedin_url', label: 'linkedin_url' },
      { key: 'notable_investments', label: 'notable_investments' },
      { key: 'confidence_level', label: 'confidence_level' },
      { key: 'reason', label: 'reason' },
      { key: 'fit_analysis', label: 'fit_analysis' },
      { key: 'investment_thesis', label: 'investment_thesis' }
    ];
    
    const csv = toCsv(rows, columns);
    const timestamp = new Date().toISOString().slice(0,16).replace(/[-:T]/g, '_').replace('_', '');
    const filename = `matches_${startupId.slice(0,8)}_${timestamp}.csv`;
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
    
    console.log(`[export] CSV exported for startup ${startupId}, ${rows.length} matches`);
    
  } catch (error) {
    console.error('[export] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/matches/memo - Elite-only Deal Memo (markdown)
app.get('/api/matches/memo', async (req, res) => {
  try {
    const plan = await getPlanFromRequest(req);
    
    // Elite-only
    if (plan !== 'elite') {
      return res.status(403).json({ error: 'upgrade_required', message: 'Deal Memo requires Elite plan' });
    }
    
    const startupId = req.query.startup_id;
    if (!startupId) {
      return res.status(400).json({ error: 'startup_id required' });
    }
    
    const supabase = getSupabaseClient();
    
    // Get startup details with intel data
    const { data: startup, error: startupError } = await supabase
      .from('startup_uploads')
      .select('id, name, tagline, description, sectors, stage, extracted_data')
      .eq('id', startupId)
      .single();
    
    if (startupError || !startup) {
      return res.status(404).json({ error: 'Startup not found' });
    }
    
    // Get startup intel for signals
    const { data: intel } = await supabase
      .from('startup_intel_v5_sector')
      .select('momentum, evidence, narrative, obsession, investor_state_sector, risk_flag')
      .eq('startup_id', startupId)
      .single();
    
    // Get top 10 matches
    const { data: matchData } = await supabase
      .from('startup_investor_matches')
      .select('investor_id, match_score, confidence_level, reasoning, why_you_match')
      .eq('startup_id', startupId)
      .gte('match_score', 20)
      .order('match_score', { ascending: false })
      .limit(10);
    
    // Get investor details
    const investorIds = (matchData || []).map(m => m.investor_id).filter(Boolean);
    let investors = [];
    if (investorIds.length > 0) {
      const { data: investorData } = await supabase
        .from('investors')
        .select('id, name, firm')
        .in('id', investorIds);
      investors = investorData || [];
    }
    
    const investorMap = new Map(investors.map(inv => [inv.id, inv]));
    
    // Build markdown memo
    const sectorLabel = Array.isArray(startup.sectors) ? startup.sectors[0] : (startup.sectors || 'Technology');
    const description = startup.tagline || startup.description || startup.extracted_data?.pitch || 'No description available.';
    
    let memo = `# ${startup.name} — ${sectorLabel}\n\n`;
    memo += `${description}\n\n`;
    
    // Signals section
    memo += `## 📊 Signals\n\n`;
    if (intel) {
      if (intel.momentum) memo += `- **Momentum:** ${intel.momentum}\n`;
      if (intel.evidence) memo += `- **Evidence:** ${intel.evidence}\n`;
      if (intel.narrative) memo += `- **Narrative:** ${intel.narrative}\n`;
      if (intel.obsession) memo += `- **Obsession:** ${intel.obsession}\n`;
      if (intel.investor_state_sector) memo += `- **Investor Activity:** ${intel.investor_state_sector}\n`;
    } else {
      memo += `_Signals data not yet computed._\n`;
    }
    memo += `\n`;
    
    // Risks section
    memo += `## ⚠️ Risks\n\n`;
    if (intel?.risk_flag) {
      memo += `${intel.risk_flag}\n`;
    } else {
      memo += `_No material risk flags identified._\n`;
    }
    memo += `\n`;
    
    // Top 10 matches table
    memo += `## 🎯 Top 10 Matched Investors\n\n`;
    memo += `| Investor | Fit | Confidence | Why |\n`;
    memo += `|----------|-----|------------|-----|\n`;
    
    (matchData || []).forEach(m => {
      const inv = investorMap.get(m.investor_id) || {};
      const name = inv.name || 'Unknown';
      const firm = inv.firm ? ` (${inv.firm})` : '';
      const fit = m.match_score || '-';
      const conf = m.confidence_level || '-';
      const why = (m.reasoning || m.why_you_match || '-').replace(/\|/g, '/').replace(/\n/g, ' ').slice(0, 100);
      memo += `| ${name}${firm} | ${fit} | ${conf} | ${why} |\n`;
    });
    
    memo += `\n---\n\n`;
    memo += `_Generated by Hot Honey on ${new Date().toLocaleDateString()}. Use this memo to prioritize warm intro requests._\n`;
    
    res.json({ memo, startup_name: startup.name });
    
    console.log(`[memo] Deal memo generated for startup ${startupId}`);
    
  } catch (error) {
    console.error('[memo] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/share/matches - Elite-only create share link
app.post('/api/share/matches', async (req, res) => {
  try {
    const plan = await getPlanFromRequest(req);
    
    // Elite-only
    if (plan !== 'elite') {
      return res.status(403).json({ error: 'upgrade_required', message: 'Share links require Elite plan' });
    }
    
    // Get authenticated user
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const token = authHeader.slice(7);
    const supabase = getSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    const { startup_id, limit = 10 } = req.body;
    if (!startup_id) {
      return res.status(400).json({ error: 'startup_id required' });
    }
    
    const effectiveLimit = Math.min(Math.max(limit, 1), 25); // Clamp for share links
    
    // Get startup details
    const { data: startup, error: startupError } = await supabase
      .from('startup_uploads')
      .select('id, name, tagline, sectors, stage')
      .eq('id', startup_id)
      .single();
    
    if (startupError || !startup) {
      return res.status(404).json({ error: 'Startup not found' });
    }
    
    // Get matches for snapshot
    const { data: matchData } = await supabase
      .from('startup_investor_matches')
      .select('investor_id, match_score, confidence_level, reasoning')
      .eq('startup_id', startup_id)
      .gte('match_score', 20)
      .order('match_score', { ascending: false })
      .limit(effectiveLimit);
    
    // Get investor details
    const investorIds = (matchData || []).map(m => m.investor_id).filter(Boolean);
    let investors = [];
    if (investorIds.length > 0) {
      const { data: investorData } = await supabase
        .from('investors')
        .select('id, name, firm, type, sectors, stage')
        .in('id', investorIds);
      investors = investorData || [];
    }
    
    const investorMap = new Map(investors.map(inv => [inv.id, inv]));
    
    // Build snapshot payload
    const matches = (matchData || []).map(m => {
      const inv = investorMap.get(m.investor_id) || {};
      return {
        investor_name: inv.name || 'Unknown',
        firm: inv.firm || null,
        type: inv.type || null,
        match_score: m.match_score,
        confidence_level: m.confidence_level,
        reasoning: m.reasoning
      };
    });
    
    const payload = {
      startup: {
        name: startup.name,
        tagline: startup.tagline,
        sectors: startup.sectors,
        stage: startup.stage
      },
      matches,
      generated_at: new Date().toISOString()
    };
    
    // Generate secure token
    const crypto = require('crypto');
    const shareToken = crypto.randomBytes(24).toString('hex');
    
    // 7-day expiry
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    // Insert share link
    const { error: insertError } = await supabase
      .from('share_links')
      .insert({
        user_id: user.id,
        token: shareToken,
        startup_id: startup_id,
        payload: payload,
        expires_at: expiresAt.toISOString()
      });
    
    if (insertError) {
      console.error('[share] Insert error:', insertError);
      // If table doesn't exist, return helpful error
      if (insertError.code === '42P01') {
        return res.status(500).json({ error: 'share_links table not found. Run migration first.' });
      }
      return res.status(500).json({ error: 'Failed to create share link' });
    }
    
    const baseUrl = process.env.APP_URL || req.headers.origin || 'https://hothoney.ai';
    const shareUrl = `${baseUrl}/share/matches/${shareToken}`;
    
    res.json({ url: shareUrl, token: shareToken, expires_at: expiresAt.toISOString() });
    
    console.log(`[share] Share link created for startup ${startup_id}, expires ${expiresAt.toISOString()}`);
    
  } catch (error) {
    console.error('[share] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/share/matches/:token - Public endpoint to view shared matches
app.get('/api/share/matches/:token', async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({ error: 'Token required' });
    }
    
    const supabase = getSupabaseClient();
    
    // Get share link
    const { data: shareLink, error } = await supabase
      .from('share_links')
      .select('payload, expires_at')
      .eq('token', token)
      .single();
    
    if (error || !shareLink) {
      return res.status(404).json({ error: 'Share link not found or invalid' });
    }
    
    // Check expiry
    if (new Date(shareLink.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Share link has expired' });
    }
    
    res.json(shareLink.payload);
    
  } catch (error) {
    console.error('[share/get] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// END ELITE EXPORT, MEMO, AND SHARE ENDPOINTS
// ============================================================

// ============================================================
// WATCHLIST + NOTIFICATIONS ENDPOINTS (Prompt 13)
// Alerts foundation: watchlists for all, alerts for Elite only
// ============================================================

// Helper: Get authenticated user from request
async function getAuthenticatedUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.slice(7);
  const supabase = getSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    return null;
  }
  
  return user;
}

// ============================================================
// REFERRAL SYSTEM - Prompt 24
// Stripe-safe entitlements overlay for rewards
// ============================================================

/**
 * Get effective plan including entitlements overlay
 * Checks entitlements first, then falls back to Stripe/profiles
 */
async function getEffectivePlan(userId) {
  const supabase = getSupabaseClient();
  
  // Check for active entitlements (highest priority)
  const { data: entitlements } = await supabase
    .from('entitlements')
    .select('entitlement, expires_at, source')
    .eq('user_id', userId)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });
  
  if (entitlements && entitlements.length > 0) {
    // Return highest entitlement: elite > pro
    const hasElite = entitlements.find(e => e.entitlement === 'elite');
    if (hasElite) {
      return { 
        plan: 'elite', 
        plan_status: 'entitled', 
        entitlement_expires_at: hasElite.expires_at,
        entitlement_source: hasElite.source 
      };
    }
    
    const hasPro = entitlements.find(e => e.entitlement === 'pro');
    if (hasPro) {
      return { 
        plan: 'pro', 
        plan_status: 'entitled',
        entitlement_expires_at: hasPro.expires_at,
        entitlement_source: hasPro.source
      };
    }
  }
  
  // Fallback to profiles table (Stripe SSOT)
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, plan_status')
    .eq('id', userId)
    .single();
  
  if (profile) {
    return { 
      plan: profile.plan || 'free', 
      plan_status: profile.plan_status || 'active' 
    };
  }
  
  return { plan: 'free', plan_status: 'active' };
}

/**
 * Generate a secure invite token (48 chars, URL-safe)
 */
function generateInviteToken() {
  const crypto = require('crypto');
  return crypto.randomBytes(36).toString('base64url').substring(0, 48);
}

/**
 * Credit referral activation (called when invitee watches first startup)
 * Uses advisory lock to prevent race conditions
 */
async function maybeCreditReferralActivation(inviteeUserId) {
  const supabase = getSupabaseClient();
  
  try {
    // Find accepted invite for this invitee
    const { data: invite } = await supabase
      .from('invites')
      .select('id, inviter_user_id')
      .eq('invitee_user_id', inviteeUserId)
      .eq('status', 'accepted')
      .single();
    
    if (!invite) {
      return; // No invite found
    }
    
    // Insert into invite_activations (unique constraint prevents double-count)
    const { data: activation, error: activationError } = await supabase
      .from('invite_activations')
      .insert({
        inviter_user_id: invite.inviter_user_id,
        invitee_user_id: inviteeUserId,
        invite_id: invite.id
      })
      .select('id')
      .single();
    
    // If unique constraint violated, already counted
    if (activationError?.code === '23505') {
      return;
    }
    
    if (activationError) {
      console.error('[referral] Activation insert error:', activationError.message);
      return;
    }
    
    // Increment referral progress
    const { data: progress } = await supabase.rpc('increment_referral_progress', {
      p_inviter_user_id: invite.inviter_user_id
    });
    
    // Log activation event
    await trackEvent({
      user_id: invite.inviter_user_id,
      event_name: 'referral_activation',
      source: 'server',
      entity_type: 'invite',
      entity_id: invite.id,
      properties: { invitee_user_id: inviteeUserId }
    });
    
    // Check if we hit the reward threshold (3 activations)
    const { data: currentProgress } = await supabase
      .from('referral_progress')
      .select('activated_invitees_count, reward_granted_at')
      .eq('inviter_user_id', invite.inviter_user_id)
      .single();
    
    if (currentProgress && 
        currentProgress.activated_invitees_count >= 3 && 
        !currentProgress.reward_granted_at) {
      
      // Grant 7 days Elite entitlement
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      
      await supabase.from('entitlements').insert({
        user_id: invite.inviter_user_id,
        entitlement: 'elite',
        source: 'referral',
        expires_at: expiresAt.toISOString()
      });
      
      // Mark reward as granted
      await supabase
        .from('referral_progress')
        .update({ reward_granted_at: new Date().toISOString() })
        .eq('inviter_user_id', invite.inviter_user_id);
      
      // Log reward event
      await trackEvent({
        user_id: invite.inviter_user_id,
        event_name: 'reward_granted',
        source: 'server',
        entity_type: 'referral_reward',
        properties: { entitlement: 'elite', days: 7 }
      });
      
      console.log(`[referral] User ${invite.inviter_user_id} earned 7 days Elite (3 referrals)`);
    }
  } catch (err) {
    console.error('[referral] Credit activation error:', err.message);
  }
}

// POST /api/invites/create - Create invite link (auth required)
app.post('/api/invites/create', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const supabase = getSupabaseClient();
    
    // Anti-abuse: Hard cap at 50 invites created per day
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    const { count } = await supabase
      .from('invites')
      .select('id', { count: 'exact', head: true })
      .eq('inviter_user_id', user.id)
      .gt('created_at', oneDayAgo.toISOString());
    
    if (count >= 50) {
      return res.status(429).json({ error: 'Daily invite limit reached (50/day)' });
    }
    
    // Generate token and create invite
    const token = generateInviteToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 day expiry
    
    const { data: invite, error: insertError } = await supabase
      .from('invites')
      .insert({
        token,
        inviter_user_id: user.id,
        expires_at: expiresAt.toISOString()
      })
      .select('id, token, expires_at')
      .single();
    
    if (insertError) {
      throw insertError;
    }
    
    const baseUrl = process.env.APP_BASE_URL || 'https://pythh.ai';
    const inviteUrl = `${baseUrl}/i/${token}`;
    
    // Log event
    await trackEvent({
      user_id: user.id,
      event_name: 'invite_created',
      source: 'server',
      entity_type: 'invite',
      entity_id: invite.id
    });
    
    res.json({
      success: true,
      invite_url: inviteUrl,
      token: invite.token,
      expires_at: invite.expires_at
    });
  } catch (error) {
    console.error('[invites/create] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /i/:token - Invite link redirect (public)
app.get('/i/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const supabase = getSupabaseClient();
    const baseUrl = process.env.APP_BASE_URL || 'https://pythh.ai';
    
    // Validate invite exists and not expired
    const { data: invite, error } = await supabase
      .from('invites')
      .select('id, status, expires_at, inviter_user_id')
      .eq('token', token)
      .single();
    
    if (error || !invite) {
      return res.redirect(`${baseUrl}?error=invalid_invite`);
    }
    
    // Check expiry
    if (new Date(invite.expires_at) < new Date()) {
      await supabase
        .from('invites')
        .update({ status: 'expired' })
        .eq('id', invite.id);
      
      return res.redirect(`${baseUrl}?error=invite_expired`);
    }
    
    // Update to 'opened' on first view
    if (invite.status === 'created') {
      await supabase
        .from('invites')
        .update({ 
          status: 'opened', 
          opened_at: new Date().toISOString() 
        })
        .eq('id', invite.id);
      
      // Log event
      await trackEvent({
        user_id: invite.inviter_user_id,
        event_name: 'invite_opened',
        source: 'server',
        entity_type: 'invite',
        entity_id: invite.id
      });
    }
    
    // Redirect to signup with token
    res.redirect(`${baseUrl}/signup?invite=${token}`);
  } catch (error) {
    console.error('[invite-redirect] Error:', error);
    const baseUrl = process.env.APP_BASE_URL || 'https://pythh.ai';
    res.redirect(`${baseUrl}?error=server_error`);
  }
});

// POST /api/invites/accept - Accept invite (auth required, called after signup)
app.post('/api/invites/accept', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'token required' });
    }
    
    const supabase = getSupabaseClient();
    
    // Validate invite
    const { data: invite, error: inviteError } = await supabase
      .from('invites')
      .select('id, inviter_user_id, status, expires_at')
      .eq('token', token)
      .single();
    
    if (inviteError || !invite) {
      return res.status(404).json({ error: 'Invite not found' });
    }
    
    // Check expiry
    if (new Date(invite.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Invite expired' });
    }
    
    // Prevent self-invite
    if (invite.inviter_user_id === user.id) {
      return res.status(400).json({ error: 'Cannot accept own invite' });
    }
    
    // Accept invite
    const { error: updateError } = await supabase
      .from('invites')
      .update({
        invitee_user_id: user.id,
        status: 'accepted',
        accepted_at: new Date().toISOString()
      })
      .eq('id', invite.id);
    
    if (updateError) {
      throw updateError;
    }
    
    // Optional: Grant invitee 3-day Pro trial
    const trialExpiresAt = new Date();
    trialExpiresAt.setDate(trialExpiresAt.getDate() + 3);
    
    await supabase.from('entitlements').insert({
      user_id: user.id,
      entitlement: 'pro',
      source: 'referral_invitee_trial',
      expires_at: trialExpiresAt.toISOString()
    }).catch(() => {}); // Don't fail if already exists
    
    // Log event
    await trackEvent({
      user_id: user.id,
      event_name: 'invite_accepted',
      source: 'server',
      entity_type: 'invite',
      entity_id: invite.id,
      properties: { inviter_user_id: invite.inviter_user_id }
    });
    
    // Get inviter progress
    const { data: progress } = await supabase
      .from('referral_progress')
      .select('activated_invitees_count')
      .eq('inviter_user_id', invite.inviter_user_id)
      .single();
    
    res.json({
      success: true,
      inviter_progress: {
        activated_count: progress?.activated_invitees_count || 0,
        target: 3
      }
    });
  } catch (error) {
    console.error('[invites/accept] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/referrals/status - Get referral status (auth required)
app.get('/api/referrals/status', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const supabase = getSupabaseClient();
    
    // Get progress
    const { data: progress } = await supabase
      .from('referral_progress')
      .select('activated_invitees_count, last_activated_at, reward_granted_at')
      .eq('inviter_user_id', user.id)
      .single();
    
    // Get active Elite entitlement from referrals
    const { data: entitlements } = await supabase
      .from('entitlements')
      .select('expires_at, source')
      .eq('user_id', user.id)
      .eq('entitlement', 'elite')
      .eq('source', 'referral')
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: false })
      .limit(1);
    
    // Get recent invites
    const { data: invites } = await supabase
      .from('invites')
      .select('id, token, status, created_at, opened_at, accepted_at, expires_at')
      .eq('inviter_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);
    
    const rewardActive = entitlements && entitlements.length > 0;
    
    res.json({
      activated_count: progress?.activated_invitees_count || 0,
      target: 3,
      reward_active: rewardActive,
      reward_expires_at: rewardActive ? entitlements[0].expires_at : null,
      invites: invites || []
    });
  } catch (error) {
    console.error('[referrals/status] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// WATCHLIST ENDPOINTS
// ============================================================

// POST /api/watchlist/add - Add startup to watchlist (auth required)
app.post('/api/watchlist/add', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const { startup_id } = req.body;
    if (!startup_id) {
      return res.status(400).json({ error: 'startup_id required' });
    }
    
    const supabase = getSupabaseClient();
    
    // Verify startup exists
    const { data: startup, error: startupError } = await supabase
      .from('startup_uploads')
      .select('id, name')
      .eq('id', startup_id)
      .single();
    
    if (startupError || !startup) {
      return res.status(404).json({ error: 'Startup not found' });
    }
    
    // Add to watchlist (upsert to handle duplicates gracefully)
    const { error: insertError } = await supabase
      .from('watchlists')
      .upsert({
        user_id: user.id,
        startup_id: startup_id
      }, { onConflict: 'user_id,startup_id' });
    
    if (insertError) {
      // Handle table not existing gracefully
      if (insertError.code === '42P01') {
        return res.status(500).json({ error: 'Watchlists not set up. Run migration 003.' });
      }
      throw insertError;
    }
    
    console.log(`[watchlist] User ${user.id} added startup ${startup_id} (${startup.name})`);
    
    // REFERRAL ACTIVATION: Credit first watchlist add as activation
    // This is the "activation_completed" trigger point
    maybeCreditReferralActivation(user.id).catch(err => {
      console.error('[referral] Failed to credit activation:', err.message);
    });
    
    res.json({ success: true, startup_id, startup_name: startup.name });
    
  } catch (error) {
    console.error('[watchlist/add] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/watchlist/remove - Remove startup from watchlist (auth required)
app.post('/api/watchlist/remove', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const { startup_id } = req.body;
    if (!startup_id) {
      return res.status(400).json({ error: 'startup_id required' });
    }
    
    const supabase = getSupabaseClient();
    
    const { error: deleteError } = await supabase
      .from('watchlists')
      .delete()
      .eq('user_id', user.id)
      .eq('startup_id', startup_id);
    
    if (deleteError) {
      if (deleteError.code === '42P01') {
        return res.status(500).json({ error: 'Watchlists not set up. Run migration 003.' });
      }
      throw deleteError;
    }
    
    console.log(`[watchlist] User ${user.id} removed startup ${startup_id}`);
    res.json({ success: true, startup_id });
    
  } catch (error) {
    console.error('[watchlist/remove] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/watchlist - Get user's watchlist (auth required)
app.get('/api/watchlist', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const supabase = getSupabaseClient();
    
    // Get watchlist items with startup info
    const { data: watchlist, error } = await supabase
      .from('watchlists')
      .select('startup_id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      if (error.code === '42P01') {
        return res.json({ items: [], count: 0 });
      }
      throw error;
    }
    
    // Get startup details for watched items
    const startupIds = (watchlist || []).map(w => w.startup_id);
    let startups = [];
    if (startupIds.length > 0) {
      const { data: startupData } = await supabase
        .from('startup_uploads')
        .select('id, name, tagline, sectors, total_god_score')
        .in('id', startupIds);
      startups = startupData || [];
    }
    
    const startupMap = new Map(startups.map(s => [s.id, s]));
    
    // Merge watchlist with startup info
    const items = (watchlist || []).map(w => ({
      startup_id: w.startup_id,
      watched_at: w.created_at,
      startup: startupMap.get(w.startup_id) || null
    }));
    
    res.json({ items, count: items.length });
    
  } catch (error) {
    console.error('[watchlist] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/notifications - Get user's notifications (auth required)
app.get('/api/notifications', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const plan = await getPlanFromRequest(req);
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    
    const supabase = getSupabaseClient();
    
    // Get notifications
    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('id, kind, entity_type, entity_id, title, body, payload, is_read, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      if (error.code === '42P01') {
        return res.json({ notifications: [], unread_count: 0, plan });
      }
      throw error;
    }
    
    // Get unread count
    const { count: unreadCount } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
    
    res.json({
      notifications: notifications || [],
      unread_count: unreadCount || 0,
      plan,
      alerts_enabled: plan === 'elite'
    });
    
  } catch (error) {
    console.error('[notifications] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/notifications/mark-read - Mark notification as read (auth required)
app.post('/api/notifications/mark-read', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const { id, all } = req.body;
    
    const supabase = getSupabaseClient();
    
    if (all === true) {
      // Mark all as read
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      
      if (error) throw error;
      
      console.log(`[notifications] User ${user.id} marked all as read`);
      res.json({ success: true, marked: 'all' });
    } else if (id) {
      // Mark single notification as read
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)
        .eq('user_id', user.id); // Security: only update own notifications
      
      if (error) throw error;
      
      res.json({ success: true, id });
    } else {
      return res.status(400).json({ error: 'id or all=true required' });
    }
    
  } catch (error) {
    console.error('[notifications/mark-read] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/notifications/count - Get unread count only (auth required)
app.get('/api/notifications/count', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const supabase = getSupabaseClient();
    
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
    
    if (error) {
      if (error.code === '42P01') {
        return res.json({ unread_count: 0 });
      }
      throw error;
    }
    
    res.json({ unread_count: count || 0 });
    
  } catch (error) {
    console.error('[notifications/count] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// ALERTS SWEEP (Elite-only, triggered by admin/cron)
// Evaluates watchlisted startups and generates notifications
// ============================================================

// Helper: Check if notification was sent recently (anti-spam)
async function wasNotificationSentRecently(supabase, userId, kind, entityId, hours = 24) {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - hours);
  
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('kind', kind)
    .eq('entity_id', entityId)
    .gte('created_at', cutoff.toISOString());
  
  return (count || 0) > 0;
}

// Main sweep function: evaluates watchlisted startups for Elite users
async function runAlertsSweep() {
  const supabase = getSupabaseClient();
  const results = { processed: 0, alerts_sent: 0, errors: [], elite_users: 0, watchlist_entries: 0 };
  const startTime = Date.now();
  
  console.log('[alerts-sweep] Starting sweep...');
  
  try {
    // Step 1: Get all Elite users with watchlists
    // Join profiles (for plan) with watchlists
    const { data: eliteWatchlists, error: watchlistError } = await supabase
      .from('watchlists')
      .select(`
        user_id,
        startup_id,
        profiles!inner(plan)
      `)
      .eq('profiles.plan', 'elite');
    
    if (watchlistError) {
      // Fallback: Get all watchlists and filter in memory
      console.log('[alerts-sweep] Join failed, using fallback:', watchlistError.message);
      
      const { data: allWatchlists } = await supabase
        .from('watchlists')
        .select('user_id, startup_id');
      
      const { data: eliteProfiles } = await supabase
        .from('profiles')
        .select('id')
        .eq('plan', 'elite');
      
      const eliteUserIds = new Set((eliteProfiles || []).map(p => p.id));
      const filteredWatchlists = (allWatchlists || []).filter(w => eliteUserIds.has(w.user_id));
      
      if (filteredWatchlists.length === 0) {
        console.log('[alerts-sweep] No Elite users with watchlists');
        return results;
      }
      
      // Continue with filteredWatchlists
      return await processWatchlists(supabase, filteredWatchlists, results);
    }
    
    if (!eliteWatchlists || eliteWatchlists.length === 0) {
      console.log('[alerts-sweep] No Elite users with watchlists');
      return results;
    }
    
    return await processWatchlists(supabase, eliteWatchlists, results);
    
  } catch (error) {
    console.error('[alerts-sweep] Error:', error);
    results.errors.push(error.message);
    return results;
  }
}

// Process watchlists and generate alerts
async function processWatchlists(supabase, watchlists, results) {
  // Get unique startup IDs and user IDs
  const startupIds = [...new Set(watchlists.map(w => w.startup_id))];
  const uniqueUsers = [...new Set(watchlists.map(w => w.user_id))];
  
  // Update results with sweep scope
  results.elite_users = uniqueUsers.length;
  results.watchlist_entries = watchlists.length;
  
  console.log(`[alerts-sweep] Processing ${startupIds.length} watched startups for ${uniqueUsers.length} elite users (${watchlists.length} watchlist entries)`);
  
  // Step 2: Get current intel for watched startups
  // Note: startup_intel_v5_sector uses 'id' as the startup reference, not 'startup_id'
  const { data: intelData, error: intelError } = await supabase
    .from('startup_intel_v5_sector')
    .select('id, investor_state_sector, sector_key, sector_momentum_0_10, sector_evidence_0_10')
    .in('id', startupIds);
  
  if (intelError) {
    console.error('[alerts-sweep] Intel query failed:', intelError);
    results.errors.push('Intel query failed: ' + intelError.message);
    return results;
  }
  
  const intelMap = new Map((intelData || []).map(i => [i.id, i]));
  
  // Step 3: Get previous alert state
  const { data: prevStates } = await supabase
    .from('startup_alert_state')
    .select('startup_id, last_investor_state_sector, last_momentum_signal, last_evidence_signal')
    .in('startup_id', startupIds);
  
  const stateMap = new Map((prevStates || []).map(s => [s.startup_id, s]));
  
  // Step 4: Get startup names for notifications
  const { data: startups } = await supabase
    .from('startup_uploads')
    .select('id, name, sectors')
    .in('id', startupIds);
  
  const startupMap = new Map((startups || []).map(s => [s.id, s]));
  
  // Step 5: Evaluate each watchlist entry
  const notifications = [];
  const stateUpdates = [];
  
  for (const watchEntry of watchlists) {
    const { user_id, startup_id } = watchEntry;
    const intel = intelMap.get(startup_id);
    const prevState = stateMap.get(startup_id);
    const startup = startupMap.get(startup_id);
    
    if (!intel || !startup) continue;
    
    results.processed++;
    
    // Rule 1: State transition to HOT
    const currentState = intel.investor_state_sector?.toLowerCase();
    const prevStateValue = prevState?.last_investor_state_sector?.toLowerCase();
    const sectorKey = intel.sector_key || (startup.sectors || [])[0] || 'unknown';
    const momentum = parseFloat(intel.sector_momentum_0_10) || 0;
    const evidence = parseFloat(intel.sector_evidence_0_10) || 0;
    
    if (currentState === 'hot' && prevStateValue && prevStateValue !== 'hot') {
      // Transition into HOT detected!
      const alreadySent = await wasNotificationSentRecently(supabase, user_id, 'startup_hot', startup_id);
      
      if (!alreadySent) {
        notifications.push({
          user_id,
          kind: 'startup_hot',
          entity_type: 'startup',
          entity_id: startup_id,
          title: `🔥 ${startup.name} is now HOT`,
          body: `Moved ${prevStateValue} → hot in ${sectorKey} (momentum ${momentum.toFixed(1)}, evidence ${evidence.toFixed(1)})`,
          payload: {
            startup_name: startup.name,
            sector_key: sectorKey,
            previous_state: prevStateValue,
            current_state: currentState,
            momentum_at_trigger: momentum,
            evidence_at_trigger: evidence,
            triggered_at: new Date().toISOString()
          }
        });
        results.alerts_sent++;
      }
    }
    
    // Rule 2: Momentum spike (momentum >= 9.0 AND evidence >= 7.0)
    // Note: momentum and evidence already calculated above for Rule 1
    
    if (momentum >= 9.0 && evidence >= 7.0) {
      const alreadySent = await wasNotificationSentRecently(supabase, user_id, 'momentum_spike', startup_id);
      
      if (!alreadySent) {
        const prevMomentum = prevState?.last_momentum_signal || 0;
        const prevEvidence = prevState?.last_evidence_signal || 0;
        
        notifications.push({
          user_id,
          kind: 'momentum_spike',
          entity_type: 'startup',
          entity_id: startup_id,
          title: `📈 ${startup.name} momentum spike`,
          body: `Momentum ${momentum.toFixed(1)} + evidence ${evidence.toFixed(1)} in ${sectorKey}. Thresholds exceeded.`,
          payload: {
            startup_name: startup.name,
            sector_key: sectorKey,
            momentum_at_trigger: momentum,
            evidence_at_trigger: evidence,
            previous_momentum: prevMomentum,
            previous_evidence: prevEvidence,
            thresholds: { momentum: 9.0, evidence: 7.0 },
            triggered_at: new Date().toISOString()
          }
        });
        results.alerts_sent++;
      }
    }
    
    // Queue state update
    stateUpdates.push({
      startup_id,
      last_investor_state_sector: currentState || null,
      last_momentum_signal: momentum,
      last_evidence_signal: evidence,
      updated_at: new Date().toISOString()
    });
  }
  
  // Step 6: Insert notifications
  if (notifications.length > 0) {
    const { error: notifError } = await supabase
      .from('notifications')
      .insert(notifications);
    
    if (notifError) {
      console.error('[alerts-sweep] Failed to insert notifications:', notifError);
      results.errors.push('Notification insert failed');
    } else {
      console.log(`[alerts-sweep] Inserted ${notifications.length} notifications`);
      
      // Track alert_created events for each notification
      for (const notif of notifications) {
        trackEvent({
          user_id: notif.user_id,
          event_name: 'alert_created',
          source: 'cron',
          entity_type: 'startup',
          entity_id: notif.entity_id,
          properties: {
            kind: notif.kind,
            startup_name: notif.payload?.startup_name,
            sector_key: notif.payload?.sector_key
          }
        }).catch(e => console.error('[alert_created] trackEvent error:', e.message));
      }
    }
  }
  
  // Step 7: Update alert state (upsert)
  if (stateUpdates.length > 0) {
    const { error: stateError } = await supabase
      .from('startup_alert_state')
      .upsert(stateUpdates, { onConflict: 'startup_id' });
    
    if (stateError) {
      console.error('[alerts-sweep] Failed to update state:', stateError);
      results.errors.push('State update failed');
    }
  }
  
  // Enhanced logging for monitoring
  const summary = [
    `Elite users: ${results.elite_users}`,
    `Watchlist entries: ${results.watchlist_entries}`,
    `Startups evaluated: ${results.processed}`,
    `Alerts sent: ${results.alerts_sent}`,
    results.errors.length > 0 ? `Errors: ${results.errors.length}` : null
  ].filter(Boolean).join(' | ');
  
  console.log(`[alerts-sweep] ✅ Complete. ${summary}`);
  return results;
}

// POST /api/admin/alerts/sweep - Manually trigger alerts sweep (admin only)
app.post('/api/admin/alerts/sweep', async (req, res) => {
  try {
    // Check for admin key or admin role
    const adminKey = req.headers['x-admin-key'];
    const expectedKey = process.env.ADMIN_KEY || process.env.VITE_ADMIN_KEY;
    
    if (!adminKey || !expectedKey || adminKey !== expectedKey) {
      // Try to check user role instead
      const user = await getAuthenticatedUser(req);
      if (!user || user.user_metadata?.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }
    }
    
    const results = await runAlertsSweep();
    
    // After sweep, trigger email delivery for pending notifications
    if (results.alerts_sent > 0) {
      setImmediate(async () => {
        try {
          const emailResults = await deliverPendingAlertEmails();
          console.log(`[alerts-sweep] Email delivery: ${emailResults.sent} sent, ${emailResults.skipped} skipped, ${emailResults.failed} failed`);
        } catch (err) {
          console.error('[alerts-sweep] Email delivery error:', err.message);
        }
      });
    }
    
    res.json({
      success: true,
      ...results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[admin/alerts/sweep] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// EMAIL ALERTS VIA RESEND (Prompt 16)
// Elite-only email delivery for startup_hot notifications
// ============================================================

const crypto = require('crypto');

// Email configuration
const EMAIL_CONFIG = {
  from: process.env.EMAIL_FROM || 'Pythh Alerts <alerts@pythh.ai>',
  baseUrl: process.env.APP_BASE_URL || 'https://hot-honey.fly.dev',
  secret: process.env.EMAIL_SECRET || 'dev-email-secret-change-in-prod'
};

// Resend API helper
async function sendEmailViaResend({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not configured, skipping email');
    return { success: false, error: 'RESEND_API_KEY not configured' };
  }
  
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: EMAIL_CONFIG.from,
        to: [to],
        subject,
        html,
        text
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('[email] Resend error:', data);
      return { success: false, error: data.message || 'Resend API error' };
    }
    
    return { success: true, id: data.id };
  } catch (error) {
    console.error('[email] Send failed:', error);
    return { success: false, error: error.message };
  }
}

// Sign email unsubscribe link (HMAC SHA256)
function signUnsubscribeToken(userId, email) {
  const payload = `${userId}:${email}:unsubscribe`;
  const hmac = crypto.createHmac('sha256', EMAIL_CONFIG.secret);
  hmac.update(payload);
  const signature = hmac.digest('hex');
  const token = Buffer.from(`${userId}:${email}:${signature}`).toString('base64url');
  return token;
}

// Verify email unsubscribe token
function verifyUnsubscribeToken(token) {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length !== 3) return null;
    
    const [userId, email, providedSignature] = parts;
    
    // Recreate signature
    const payload = `${userId}:${email}:unsubscribe`;
    const hmac = crypto.createHmac('sha256', EMAIL_CONFIG.secret);
    hmac.update(payload);
    const expectedSignature = hmac.digest('hex');
    
    // Timing-safe comparison
    if (crypto.timingSafeEqual(Buffer.from(providedSignature), Buffer.from(expectedSignature))) {
      return { userId, email };
    }
    return null;
  } catch (error) {
    console.error('[email] Token verification failed:', error);
    return null;
  }
}

// Render startup_hot email template
function renderStartupHotEmail({ userEmail, startupName, sectorKey, payload }) {
  const unsubscribeToken = signUnsubscribeToken(payload.user_id || 'unknown', userEmail);
  const unsubscribeUrl = `${EMAIL_CONFIG.baseUrl}/unsubscribe?token=${unsubscribeToken}`;
  const rawViewUrl = `${EMAIL_CONFIG.baseUrl}/startup/${payload.entity_id || ''}`;
  // Wrap in click tracker for attribution
  const viewUrl = `${EMAIL_CONFIG.baseUrl}/e/click?u=${encodeURIComponent(payload.user_id || '')}&n=${encodeURIComponent(payload.notification_id || '')}&to=${encodeURIComponent(rawViewUrl)}`;
  
  const previousState = (payload.previous_state || 'unknown').toUpperCase();
  const currentState = (payload.current_state || 'HOT').toUpperCase();
  const momentum = payload.momentum_at_trigger?.toFixed?.(1) || '?';
  const evidence = payload.evidence_at_trigger?.toFixed?.(1) || '?';
  
  const subject = `🔥 ${startupName} is now HOT in ${sectorKey}`;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 32px;">
      <h1 style="color: #ffffff; font-size: 24px; margin: 0;">
        🔥 <span style="color: #f97316;">${startupName}</span> is now HOT
      </h1>
      <p style="color: #a1a1aa; font-size: 14px; margin-top: 8px;">
        in ${sectorKey}
      </p>
    </div>
    
    <!-- Why Card -->
    <div style="background-color: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
      <p style="color: #a1a1aa; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 8px 0;">
        Why this alert
      </p>
      <p style="color: #ffffff; font-size: 16px; margin: 0 0 16px 0;">
        <span style="color: #71717a;">${previousState}</span>
        <span style="color: #f97316;"> → </span>
        <span style="color: #f97316; font-weight: 600;">${currentState}</span>
        transition detected
      </p>
      <div style="display: flex; gap: 16px;">
        <div style="flex: 1; background-color: #27272a; border-radius: 8px; padding: 12px; text-align: center;">
          <p style="color: #a1a1aa; font-size: 11px; margin: 0 0 4px 0;">Momentum</p>
          <p style="color: #22c55e; font-size: 20px; font-weight: 700; margin: 0;">${momentum}</p>
        </div>
        <div style="flex: 1; background-color: #27272a; border-radius: 8px; padding: 12px; text-align: center;">
          <p style="color: #a1a1aa; font-size: 11px; margin: 0 0 4px 0;">Evidence</p>
          <p style="color: #3b82f6; font-size: 20px; font-weight: 700; margin: 0;">${evidence}</p>
        </div>
      </div>
    </div>
    
    <!-- CTA Button -->
    <div style="text-align: center; margin-bottom: 32px;">
      <a href="${viewUrl}" style="display: inline-block; background: linear-gradient(135deg, #f97316, #ea580c); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">
        View Startup Details →
      </a>
    </div>
    
    <!-- Footer -->
    <div style="text-align: center; border-top: 1px solid #27272a; padding-top: 24px;">
      <p style="color: #71717a; font-size: 12px; margin: 0 0 8px 0;">
        You're receiving this because you're watching this startup on Pythh.
      </p>
      <p style="color: #71717a; font-size: 12px; margin: 0;">
        <a href="${unsubscribeUrl}" style="color: #71717a; text-decoration: underline;">Unsubscribe from alerts</a>
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
  
  const text = `
🔥 ${startupName} is now HOT in ${sectorKey}

Why this alert:
${previousState} → ${currentState} transition detected
Momentum: ${momentum} | Evidence: ${evidence}

View startup: ${viewUrl}

---
You're receiving this because you're watching this startup on Pythh.
Unsubscribe: ${unsubscribeUrl}
  `.trim();
  
  return { subject, html, text };
}

// Advisory lock ID for email delivery (prevents duplicate sends across instances)
const EMAIL_DELIVERY_LOCK_ID = 9876543210;
const DAILY_EMAIL_CAP_PER_USER = 10;

// Main email delivery function with advisory lock + claim pattern
async function deliverPendingAlertEmails() {
  const supabase = getSupabaseClient();
  const results = { sent: 0, skipped: 0, failed: 0, claimed: 0, errors: [], lockAcquired: false };
  
  console.log('[email-deliver] Starting email delivery...');
  
  try {
    // 16.5: Try to acquire advisory lock (prevents duplicate delivery across instances)
    const { data: lockResult } = await supabase.rpc('pg_try_advisory_lock', { key: EMAIL_DELIVERY_LOCK_ID });
    
    if (!lockResult) {
      console.log('[email-deliver] Could not acquire lock - another instance is processing');
      return { ...results, skipped_reason: 'lock_not_acquired' };
    }
    
    results.lockAcquired = true;
    console.log('[email-deliver] Advisory lock acquired');
    
    // Get pending notifications (not claimed by another worker)
    const { data: pending, error: queryError } = await supabase
      .from('notifications')
      .select(`
        id,
        user_id,
        kind,
        entity_id,
        title,
        body,
        payload,
        created_at
      `)
      .eq('email_status', 'pending')
      .eq('kind', 'startup_hot')
      .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: true })
      .limit(50);
    
    if (queryError) {
      console.error('[email-deliver] Query failed:', queryError);
      results.errors.push('Query failed');
      return results;
    }
    
    if (!pending || pending.length === 0) {
      console.log('[email-deliver] No pending notifications');
      return results;
    }
    
    console.log(`[email-deliver] Found ${pending.length} pending notifications`);
    
    // Get unique user IDs and fetch their profiles
    const userIds = [...new Set(pending.map(n => n.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, plan, email_alerts_enabled')
      .in('id', userIds);
    
    const profileMap = new Map((profiles || []).map(p => [p.id, p]));
    
    // Get unsubscribed emails
    const profileEmails = (profiles || []).map(p => p.email).filter(Boolean);
    const { data: unsubscribed } = await supabase
      .from('email_unsubscribes')
      .select('email')
      .in('email', profileEmails);
    
    const unsubscribedSet = new Set((unsubscribed || []).map(u => u.email));
    
    // 16.6: Get today's email counts per user (enforced daily cap)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const { data: todaySent } = await supabase
      .from('notifications')
      .select('user_id')
      .eq('email_status', 'sent')
      .gte('email_sent_at', todayStart.toISOString())
      .in('user_id', userIds);
    
    // Count sent emails per user today
    const userEmailCountToday = new Map();
    for (const row of (todaySent || [])) {
      userEmailCountToday.set(row.user_id, (userEmailCountToday.get(row.user_id) || 0) + 1);
    }
    
    // Track emails we send in this batch (adds to today's count)
    const userEmailCountBatch = new Map();
    
    // Process each notification
    for (const notification of pending) {
      // 16.5: Claim step - atomically mark pending → sending
      const { data: claimed, error: claimError } = await supabase
        .from('notifications')
        .update({ email_status: 'sending' })
        .eq('id', notification.id)
        .eq('email_status', 'pending') // Only if still pending (atomic)
        .select('id')
        .single();
      
      if (claimError || !claimed) {
        // Another worker claimed this notification
        console.log(`[email-deliver] Notification ${notification.id} already claimed`);
        continue;
      }
      
      results.claimed++;
      
      const profile = profileMap.get(notification.user_id);
      
      // Skip conditions
      if (!profile) {
        await markEmailStatus(supabase, notification.id, 'skipped', 'No profile found');
        results.skipped++;
        continue;
      }
      
      if (!profile.email) {
        await markEmailStatus(supabase, notification.id, 'skipped', 'No email address');
        results.skipped++;
        continue;
      }
      
      if (profile.plan !== 'elite') {
        await markEmailStatus(supabase, notification.id, 'skipped', 'Not Elite plan');
        results.skipped++;
        continue;
      }
      
      if (profile.email_alerts_enabled === false) {
        await markEmailStatus(supabase, notification.id, 'skipped', 'Email alerts disabled');
        results.skipped++;
        continue;
      }
      
      if (unsubscribedSet.has(profile.email)) {
        await markEmailStatus(supabase, notification.id, 'skipped', 'Email unsubscribed');
        results.skipped++;
        continue;
      }
      
      // 16.6: Enforce daily cap (10/day/user)
      const todayCount = userEmailCountToday.get(notification.user_id) || 0;
      const batchCount = userEmailCountBatch.get(notification.user_id) || 0;
      const totalToday = todayCount + batchCount;
      
      if (totalToday >= DAILY_EMAIL_CAP_PER_USER) {
        await markEmailStatus(supabase, notification.id, 'skipped', 'daily_cap');
        console.log(`[email-deliver] User ${notification.user_id} hit daily cap (${totalToday}/${DAILY_EMAIL_CAP_PER_USER})`);
        results.skipped++;
        continue;
      }
      
      // Render and send email
      const payload = notification.payload || {};
      const startupName = payload.startup_name || 'A startup';
      const sectorKey = payload.sector_key || 'your sector';
      
      const emailContent = renderStartupHotEmail({
        userEmail: profile.email,
        startupName,
        sectorKey,
        payload: { 
          ...payload, 
          user_id: notification.user_id, 
          entity_id: notification.entity_id,
          notification_id: notification.id // For click tracking
        }
      });
      
      const sendResult = await sendEmailViaResend({
        to: profile.email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text
      });
      
      if (sendResult.success) {
        await markEmailStatus(supabase, notification.id, 'sent', null, sendResult.id);
        userEmailCountBatch.set(notification.user_id, batchCount + 1);
        results.sent++;
        
        // Track email_sent event
        trackEvent({
          user_id: notification.user_id,
          event_name: 'email_sent',
          source: 'cron',
          entity_type: 'notification',
          entity_id: notification.id,
          properties: {
            kind: notification.kind,
            resend_email_id: sendResult.id
          }
        }).catch(e => console.error('[email_sent] trackEvent error:', e.message));
      } else {
        await markEmailStatus(supabase, notification.id, 'failed', sendResult.error);
        results.failed++;
        results.errors.push(sendResult.error);
        
        // Track email_failed event
        trackEvent({
          user_id: notification.user_id,
          event_name: 'email_failed',
          source: 'cron',
          entity_type: 'notification',
          entity_id: notification.id,
          properties: {
            kind: notification.kind,
            error: sendResult.error
          }
        }).catch(e => console.error('[email_failed] trackEvent error:', e.message));
      }
      
      // Small delay between emails to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
  } catch (error) {
    console.error('[email-deliver] Error:', error);
    results.errors.push(error.message);
  } finally {
    // 16.5: Always release the advisory lock
    if (results.lockAcquired) {
      try {
        await supabase.rpc('pg_advisory_unlock', { key: EMAIL_DELIVERY_LOCK_ID });
        console.log('[email-deliver] Advisory lock released');
      } catch (unlockErr) {
        console.error('[email-deliver] Failed to release lock:', unlockErr.message);
      }
    }
  }
  
  console.log(`[email-deliver] Complete. Claimed: ${results.claimed}, Sent: ${results.sent}, Skipped: ${results.skipped}, Failed: ${results.failed}`);
  return results;
}

// Helper: Update notification email status
async function markEmailStatus(supabase, notificationId, status, error = null, resendId = null) {
  const update = {
    email_status: status,
    email_error: error
  };
  
  if (status === 'sent') {
    update.email_sent_at = new Date().toISOString();
    if (resendId) {
      update.email_error = `resend_id:${resendId}`; // Store Resend ID for tracking
    }
  }
  
  await supabase
    .from('notifications')
    .update(update)
    .eq('id', notificationId);
}

// POST /api/admin/email/deliver - Manually trigger email delivery
app.post('/api/admin/email/deliver', async (req, res) => {
  try {
    const adminKey = req.headers['x-admin-key'];
    const expectedKey = process.env.ADMIN_KEY || process.env.VITE_ADMIN_KEY;
    
    if (!adminKey || !expectedKey || adminKey !== expectedKey) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const results = await deliverPendingAlertEmails();
    
    res.json({
      success: true,
      ...results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[admin/email/deliver] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// PROMPT 19: DAILY DIGEST EMAILS (Elite-only)
// ============================================================

const DIGEST_LOCK_ID = 1234567891; // Distinct from email delivery lock
const DIGEST_CIRCUIT_BREAKER_THRESHOLD = 5; // Stop after 5 consecutive failures
let digestCircuitBreakerFailures = 0;

// Build digest content for a user
async function buildDigestForUser(supabase, userId, timezone, digestTimeLocal) {
  // Compute window_end = now, window_start = 24h ago in UTC
  const now = new Date();
  const windowEnd = now;
  const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  // Get notifications in the window (HOT transitions + momentum spikes)
  const { data: notifications, error } = await supabase
    .from('notifications')
    .select('id, kind, title, body, payload, created_at, entity_id')
    .eq('user_id', userId)
    .in('kind', ['startup_hot', 'momentum_spike'])
    .gte('created_at', windowStart.toISOString())
    .lte('created_at', windowEnd.toISOString())
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error(`[digest] Failed to query notifications for user ${userId}:`, error);
    return { items: [], notification_ids: [], windowStart, windowEnd };
  }
  
  if (!notifications || notifications.length === 0) {
    return { items: [], notification_ids: [], windowStart, windowEnd };
  }
  
  // Group by startup (entity_id)
  const byStartup = new Map();
  
  for (const n of notifications) {
    const entityId = n.entity_id || n.payload?.entity_id || 'unknown';
    if (!byStartup.has(entityId)) {
      byStartup.set(entityId, {
        entityId,
        name: n.payload?.startup_name || n.title?.replace(/^[🔥📈]\s*/, '').replace(/ is now HOT.*$/, '') || 'Unknown Startup',
        sector: n.payload?.sector_key || 'Unknown',
        alerts: []
      });
    }
    
    const why = n.payload?.previous_state && n.payload?.current_state
      ? `${n.payload.previous_state.toUpperCase()} → ${n.payload.current_state.toUpperCase()}`
      : n.kind === 'momentum_spike' 
        ? `Momentum spike: ${n.payload?.momentum_at_trigger?.toFixed?.(1) || '?'}`
        : n.body || n.title;
    
    byStartup.get(entityId).alerts.push({
      id: n.id,
      kind: n.kind,
      why,
      momentum: n.payload?.momentum_at_trigger,
      evidence: n.payload?.evidence_at_trigger,
      createdAt: n.created_at
    });
  }
  
  return {
    items: Array.from(byStartup.values()),
    notification_ids: notifications.map(n => n.id),
    windowStart,
    windowEnd
  };
}

// Render digest email HTML + text
function renderDigestEmail({ userEmail, userId, items, digestDate }) {
  const unsubscribeToken = signUnsubscribeToken(userId, userEmail);
  const unsubscribeUrl = `${EMAIL_CONFIG.baseUrl}/unsubscribe?token=${unsubscribeToken}`;
  
  const subject = `📊 Your Daily Digest – ${items.length} startup${items.length === 1 ? '' : 's'} with activity`;
  
  // Build startup sections
  const startupSections = items.map(startup => {
    const rawViewUrl = `${EMAIL_CONFIG.baseUrl}/startup/${startup.entityId}`;
    const viewUrl = `${EMAIL_CONFIG.baseUrl}/e/click?u=${encodeURIComponent(userId)}&n=digest_${digestDate}&to=${encodeURIComponent(rawViewUrl)}`;
    
    const alertBullets = startup.alerts.map(a => `
      <li style="color: #d4d4d8; font-size: 14px; margin-bottom: 6px;">
        ${a.kind === 'startup_hot' ? '🔥' : '📈'} ${a.why}
      </li>
    `).join('');
    
    return `
    <div style="background-color: #27272a; border-radius: 12px; padding: 20px; margin-bottom: 16px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
        <div>
          <h3 style="color: #ffffff; font-size: 18px; margin: 0 0 4px 0;">${startup.name}</h3>
          <p style="color: #71717a; font-size: 12px; margin: 0;">${startup.sector}</p>
        </div>
        <a href="${viewUrl}" style="background: linear-gradient(135deg, #f97316, #ea580c); color: #ffffff; text-decoration: none; padding: 8px 16px; border-radius: 6px; font-weight: 600; font-size: 12px; white-space: nowrap;">
          View →
        </a>
      </div>
      <ul style="margin: 0; padding-left: 20px;">
        ${alertBullets}
      </ul>
    </div>
    `;
  }).join('');
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 32px;">
      <h1 style="color: #ffffff; font-size: 24px; margin: 0;">
        📊 <span style="color: #f97316;">Daily Digest</span>
      </h1>
      <p style="color: #a1a1aa; font-size: 14px; margin-top: 8px;">
        ${digestDate} • ${items.length} startup${items.length === 1 ? '' : 's'} with activity
      </p>
    </div>
    
    <!-- Startups -->
    <div style="background-color: #18181b; border: 1px solid #27272a; border-radius: 16px; padding: 24px;">
      ${startupSections}
    </div>
    
    <!-- Footer -->
    <div style="text-align: center; border-top: 1px solid #27272a; padding-top: 24px; margin-top: 32px;">
      <p style="color: #71717a; font-size: 12px; margin: 0 0 8px 0;">
        You're receiving this daily digest because you have it enabled on Pythh.
      </p>
      <p style="color: #71717a; font-size: 12px; margin: 0;">
        <a href="${unsubscribeUrl}" style="color: #71717a; text-decoration: underline;">Unsubscribe from all emails</a>
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
  
  // Plain text version
  const textStartups = items.map(startup => {
    const bullets = startup.alerts.map(a => `  • ${a.why}`).join('\n');
    return `${startup.name} (${startup.sector})\n${bullets}\n  View: ${EMAIL_CONFIG.baseUrl}/startup/${startup.entityId}`;
  }).join('\n\n');
  
  const text = `
📊 Daily Digest – ${digestDate}
${items.length} startup${items.length === 1 ? '' : 's'} with activity in the last 24 hours

${textStartups}

---
You're receiving this daily digest because you have it enabled on Pythh.
Unsubscribe: ${unsubscribeUrl}
  `.trim();
  
  return { subject, html, text };
}

// Get current local time for a timezone
function getLocalTimeInTimezone(timezone) {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    return formatter.format(now); // Returns "HH:MM"
  } catch (e) {
    console.error(`[digest] Invalid timezone ${timezone}, using default`);
    return getLocalTimeInTimezone('America/Los_Angeles');
  }
}

// Get local date string for a timezone
function getLocalDateInTimezone(timezone) {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', { // en-CA gives YYYY-MM-DD
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(now);
  } catch (e) {
    return getLocalDateInTimezone('America/Los_Angeles');
  }
}

// Enqueue daily digests for users whose local time matches
async function enqueueDailyDigests() {
  const supabase = getSupabaseClient();
  const results = { enqueued: 0, skipped: 0, errors: [] };
  
  console.log('[digest-enqueue] Starting digest enqueue...');
  
  try {
    // Get all elite users with digests enabled
    const { data: eligibleUsers, error: userError } = await supabase
      .from('profiles')
      .select('id, email, timezone, digest_time_local, last_digest_sent_at')
      .eq('digest_enabled', true)
      .eq('email_alerts_enabled', true)
      .in('plan', ['elite'])
      .in('plan_status', ['active', 'trialing']);
    
    if (userError) {
      console.error('[digest-enqueue] Failed to fetch users:', userError);
      results.errors.push('User query failed');
      return results;
    }
    
    if (!eligibleUsers || eligibleUsers.length === 0) {
      console.log('[digest-enqueue] No eligible users for digest');
      return results;
    }
    
    console.log(`[digest-enqueue] Found ${eligibleUsers.length} eligible users`);
    
    // Get unsubscribed emails
    const userEmails = eligibleUsers.map(u => u.email).filter(Boolean);
    const { data: unsubscribed } = await supabase
      .from('email_unsubscribes')
      .select('email')
      .in('email', userEmails);
    
    const unsubscribedSet = new Set((unsubscribed || []).map(u => u.email));
    
    for (const user of eligibleUsers) {
      // Skip unsubscribed
      if (unsubscribedSet.has(user.email)) {
        results.skipped++;
        continue;
      }
      
      const tz = user.timezone || 'America/Los_Angeles';
      const digestTime = user.digest_time_local || '08:00';
      const currentLocalTime = getLocalTimeInTimezone(tz);
      const localDate = getLocalDateInTimezone(tz);
      
      // Check if within 10-minute window of their digest time
      const [digestHour, digestMinute] = digestTime.split(':').map(Number);
      const [currentHour, currentMinute] = currentLocalTime.split(':').map(Number);
      
      const digestMinutes = digestHour * 60 + digestMinute;
      const currentMinutes = currentHour * 60 + currentMinute;
      const diff = Math.abs(currentMinutes - digestMinutes);
      
      if (diff > 10 && diff < (24 * 60 - 10)) {
        // Not within 10-minute window
        continue;
      }
      
      // Check if we already sent a digest for this user today (by local date)
      const { data: existingDigest } = await supabase
        .from('email_digests')
        .select('id')
        .eq('user_id', user.id)
        .eq('digest_date', localDate)
        .single();
      
      if (existingDigest) {
        results.skipped++;
        continue;
      }
      
      // Build digest content
      const digest = await buildDigestForUser(supabase, user.id, tz, digestTime);
      
      if (digest.items.length === 0) {
        // No activity to report, skip but mark so we don't retry
        await supabase.from('email_digests').insert({
          user_id: user.id,
          digest_date: localDate,
          window_start: digest.windowStart.toISOString(),
          window_end: digest.windowEnd.toISOString(),
          notification_ids: [],
          email_status: 'skipped'
        });
        results.skipped++;
        continue;
      }
      
      // Insert pending digest
      const { error: insertError } = await supabase.from('email_digests').insert({
        user_id: user.id,
        digest_date: localDate,
        window_start: digest.windowStart.toISOString(),
        window_end: digest.windowEnd.toISOString(),
        notification_ids: digest.notification_ids,
        email_status: 'pending'
      });
      
      if (insertError) {
        if (insertError.code === '23505') {
          // Duplicate - already exists
          results.skipped++;
        } else {
          console.error(`[digest-enqueue] Insert failed for user ${user.id}:`, insertError);
          results.errors.push(`User ${user.id}: ${insertError.message}`);
        }
      } else {
        results.enqueued++;
        console.log(`[digest-enqueue] Enqueued digest for user ${user.id} (${digest.items.length} startups)`);
      }
    }
    
  } catch (error) {
    console.error('[digest-enqueue] Error:', error);
    results.errors.push(error.message);
  }
  
  console.log(`[digest-enqueue] Complete. Enqueued: ${results.enqueued}, Skipped: ${results.skipped}, Errors: ${results.errors.length}`);
  return results;
}

// Deliver pending digests
async function deliverPendingDigests() {
  const supabase = getSupabaseClient();
  const results = { sent: 0, skipped: 0, failed: 0, errors: [], lockAcquired: false };
  
  console.log('[digest-deliver] Starting digest delivery...');
  
  // Check circuit breaker
  if (digestCircuitBreakerFailures >= DIGEST_CIRCUIT_BREAKER_THRESHOLD) {
    console.log('[digest-deliver] Circuit breaker open - too many consecutive failures');
    return { ...results, skipped_reason: 'circuit_breaker_open' };
  }
  
  try {
    // Acquire advisory lock
    const { data: lockResult } = await supabase.rpc('pg_try_advisory_lock', { key: DIGEST_LOCK_ID });
    
    if (!lockResult) {
      console.log('[digest-deliver] Could not acquire lock - another instance is processing');
      return { ...results, skipped_reason: 'lock_not_acquired' };
    }
    
    results.lockAcquired = true;
    
    // Get pending digests
    const { data: pending, error: queryError } = await supabase
      .from('email_digests')
      .select(`
        id,
        user_id,
        digest_date,
        window_start,
        window_end,
        notification_ids
      `)
      .eq('email_status', 'pending')
      .order('created_at', { ascending: true })
      .limit(20);
    
    if (queryError) {
      console.error('[digest-deliver] Query failed:', queryError);
      results.errors.push('Query failed');
      return results;
    }
    
    if (!pending || pending.length === 0) {
      console.log('[digest-deliver] No pending digests');
      return results;
    }
    
    console.log(`[digest-deliver] Found ${pending.length} pending digests`);
    
    // Get user profiles for emails
    const userIds = [...new Set(pending.map(d => d.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, timezone')
      .in('id', userIds);
    
    const profileMap = new Map((profiles || []).map(p => [p.id, p]));
    
    for (const digest of pending) {
      const profile = profileMap.get(digest.user_id);
      if (!profile?.email) {
        // Mark as skipped
        await supabase.from('email_digests')
          .update({ email_status: 'skipped', email_error: 'No email found' })
          .eq('id', digest.id);
        results.skipped++;
        continue;
      }
      
      // Build digest content
      const digestContent = await buildDigestForUser(
        supabase, 
        digest.user_id, 
        profile.timezone || 'America/Los_Angeles',
        '08:00'
      );
      
      if (digestContent.items.length === 0) {
        await supabase.from('email_digests')
          .update({ email_status: 'skipped', email_error: 'No activity in window' })
          .eq('id', digest.id);
        results.skipped++;
        continue;
      }
      
      // Render email
      const emailContent = renderDigestEmail({
        userEmail: profile.email,
        userId: digest.user_id,
        items: digestContent.items,
        digestDate: digest.digest_date
      });
      
      // Send via Resend
      const sendResult = await sendEmailViaResend({
        to: profile.email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text
      });
      
      if (sendResult.success) {
        await supabase.from('email_digests')
          .update({
            email_status: 'sent',
            email_sent_at: new Date().toISOString(),
            email_error: sendResult.id ? `resend_id:${sendResult.id}` : null
          })
          .eq('id', digest.id);
        
        // Update profile.last_digest_sent_at
        await supabase.from('profiles')
          .update({ last_digest_sent_at: new Date().toISOString() })
          .eq('id', digest.user_id);
        
        results.sent++;
        digestCircuitBreakerFailures = 0; // Reset on success
        
        // Track event
        trackEvent({
          user_id: digest.user_id,
          event_name: 'digest_sent',
          source: 'cron',
          entity_type: 'digest',
          entity_id: digest.id,
          properties: {
            startup_count: digestContent.items.length,
            digest_date: digest.digest_date
          }
        }).catch(e => console.error('[digest_sent] trackEvent error:', e.message));
        
        console.log(`[digest-deliver] Sent digest to ${profile.email} (${digestContent.items.length} startups)`);
      } else {
        await supabase.from('email_digests')
          .update({ email_status: 'failed', email_error: sendResult.error })
          .eq('id', digest.id);
        
        results.failed++;
        results.errors.push(sendResult.error);
        digestCircuitBreakerFailures++;
        
        if (digestCircuitBreakerFailures >= DIGEST_CIRCUIT_BREAKER_THRESHOLD) {
          console.error('[digest-deliver] Circuit breaker tripped after 5 consecutive failures');
          // Log to ai_logs
          await supabase.from('ai_logs').insert({
            type: 'digest_delivery',
            action: 'circuit_breaker_tripped',
            status: 'error',
            output: { failures: digestCircuitBreakerFailures, last_error: sendResult.error }
          }).catch(() => {});
          break;
        }
      }
      
      // Small delay between emails
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
  } catch (error) {
    console.error('[digest-deliver] Error:', error);
    results.errors.push(error.message);
  } finally {
    if (results.lockAcquired) {
      try {
        await supabase.rpc('pg_advisory_unlock', { key: DIGEST_LOCK_ID });
        console.log('[digest-deliver] Advisory lock released');
      } catch (unlockErr) {
        console.error('[digest-deliver] Failed to release lock:', unlockErr.message);
      }
    }
  }
  
  console.log(`[digest-deliver] Complete. Sent: ${results.sent}, Skipped: ${results.skipped}, Failed: ${results.failed}`);
  return results;
}

// POST /api/admin/digests/run - Manually trigger digest enqueue + delivery
app.post('/api/admin/digests/run', async (req, res) => {
  try {
    const adminKey = req.headers['x-admin-key'];
    const expectedKey = process.env.ADMIN_KEY || process.env.VITE_ADMIN_KEY;
    
    if (!adminKey || !expectedKey || adminKey !== expectedKey) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    console.log('[admin/digests/run] Manual trigger...');
    
    // Run enqueue then deliver
    const enqueueResults = await enqueueDailyDigests();
    const deliverResults = await deliverPendingDigests();
    
    // Log to ai_logs
    const supabase = getSupabaseClient();
    await supabase.from('ai_logs').insert({
      type: 'digest_run',
      action: 'manual_trigger',
      status: (enqueueResults.errors.length + deliverResults.errors.length) > 0 ? 'partial' : 'success',
      output: { enqueue: enqueueResults, deliver: deliverResults }
    }).catch(() => {});
    
    res.json({
      success: true,
      enqueue: enqueueResults,
      deliver: deliverResults,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[admin/digests/run] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// END DAILY DIGEST
// ============================================================

// GET /unsubscribe - Public unsubscribe page
app.get('/unsubscribe', async (req, res) => {
  const { token } = req.query;
  
  if (!token) {
    return res.status(400).send(renderUnsubscribePage('error', 'Missing unsubscribe token'));
  }
  
  const verified = verifyUnsubscribeToken(token);
  
  if (!verified) {
    return res.status(400).send(renderUnsubscribePage('error', 'Invalid or expired unsubscribe link'));
  }
  
  try {
    const supabase = getSupabaseClient();
    
    // Insert into unsubscribes table (upsert)
    await supabase
      .from('email_unsubscribes')
      .upsert({
        email: verified.email,
        user_id: verified.userId !== 'unknown' ? verified.userId : null,
        reason: 'clicked_unsubscribe_link',
        unsubscribed_at: new Date().toISOString()
      }, { onConflict: 'email' });
    
    // Also disable in profile if user exists
    if (verified.userId && verified.userId !== 'unknown') {
      await supabase
        .from('profiles')
        .update({ email_alerts_enabled: false })
        .eq('id', verified.userId);
    }
    
    console.log(`[unsubscribe] Unsubscribed: ${verified.email}`);
    
    return res.send(renderUnsubscribePage('success', verified.email));
    
  } catch (error) {
    console.error('[unsubscribe] Error:', error);
    return res.status(500).send(renderUnsubscribePage('error', 'Something went wrong. Please try again.'));
  }
});

// Render unsubscribe confirmation page
function renderUnsubscribePage(status, message) {
  const isSuccess = status === 'success';
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${isSuccess ? 'Unsubscribed' : 'Error'} - Pythh</title>
  <style>
    body {
      margin: 0;
      padding: 40px 20px;
      background-color: #0a0a0a;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #ffffff;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      max-width: 400px;
      text-align: center;
    }
    .icon {
      font-size: 48px;
      margin-bottom: 24px;
    }
    h1 {
      font-size: 24px;
      margin: 0 0 16px 0;
    }
    p {
      color: #a1a1aa;
      font-size: 14px;
      line-height: 1.5;
    }
    .email {
      color: #f97316;
      word-break: break-all;
    }
    a {
      display: inline-block;
      margin-top: 24px;
      color: #f97316;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">${isSuccess ? '✅' : '❌'}</div>
    <h1>${isSuccess ? "You're unsubscribed" : 'Oops!'}</h1>
    <p>
      ${isSuccess 
        ? `<span class="email">${message}</span> will no longer receive alert emails from Pythh.`
        : message
      }
    </p>
    <a href="${EMAIL_CONFIG.baseUrl}">← Back to Pythh</a>
  </div>
</body>
</html>
  `.trim();
}

// POST /api/profile/settings - Update user email preferences and preferences
app.post('/api/profile/settings', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const { email_alerts_enabled, digest_enabled, timezone, digest_time_local, preferences } = req.body;
    
    const supabase = getSupabaseClient();
    
    // Build update object with only provided fields
    const updates = {};
    if (typeof email_alerts_enabled === 'boolean') updates.email_alerts_enabled = email_alerts_enabled;
    if (typeof digest_enabled === 'boolean') updates.digest_enabled = digest_enabled;
    if (timezone) updates.timezone = timezone;
    if (digest_time_local) updates.digest_time_local = digest_time_local;
    
    // Handle preferences merge (not overwrite) - fetch existing first
    if (preferences && typeof preferences === 'object') {
      const { data: profile } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('id', user.id)
        .single();
      
      const existingPrefs = profile?.preferences || {};
      updates.preferences = { ...existingPrefs, ...preferences };
    }
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No settings to update' });
    }
    
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);
    
    if (error) {
      console.error('[profile/settings] Update failed:', error);
      return res.status(500).json({ error: 'Failed to update settings' });
    }
    
    console.log(`[profile/settings] Updated for user ${user.id}:`, updates);
    
    res.json({ success: true, updated: updates });
    
  } catch (error) {
    console.error('[profile/settings] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/profile/settings - Get user email preferences and preferences
app.get('/api/profile/settings', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const supabase = getSupabaseClient();
    
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('email_alerts_enabled, digest_enabled, timezone, digest_time_local, plan, preferences')
      .eq('id', user.id)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
      console.error('[profile/settings] Query failed:', error);
      return res.status(500).json({ error: 'Failed to fetch settings' });
    }
    
    // Return defaults if no profile
    res.json({
      email_alerts_enabled: profile?.email_alerts_enabled ?? true,
      digest_enabled: profile?.digest_enabled ?? false,
      timezone: profile?.timezone ?? 'America/Los_Angeles',
      digest_time_local: profile?.digest_time_local ?? '08:00',
      plan: profile?.plan ?? 'free',
      preferences: profile?.preferences ?? {}
    });
    
  } catch (error) {
    console.error('[profile/settings] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// USER PROFILE MANAGEMENT
// ============================================================

// GET /api/profile - Get full user profile
app.get('/api/profile', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const supabase = getSupabaseClient();
    
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('[profile] Query failed:', error);
      return res.status(500).json({ error: 'Failed to fetch profile' });
    }
    
    // Get Supabase auth user metadata for name
    const { data: { user: authUser } } = await supabase.auth.admin.getUserById(user.id);
    
    res.json({
      id: user.id,
      email: profile?.email ?? authUser?.email ?? '',
      display_name: profile?.display_name ?? authUser?.user_metadata?.name ?? '',
      plan: profile?.plan ?? 'free',
      plan_status: profile?.plan_status ?? 'active',
      role: profile?.role ?? 'founder',
      email_alerts_enabled: profile?.email_alerts_enabled ?? true,
      digest_enabled: profile?.digest_enabled ?? false,
      timezone: profile?.timezone ?? 'America/Los_Angeles',
      preferences: profile?.preferences ?? {},
      created_at: profile?.created_at ?? null,
    });
    
  } catch (error) {
    console.error('[profile] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/profile - Update user profile fields (name, role, preferences)
app.put('/api/profile', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const { display_name, role, preferences } = req.body;
    const supabase = getSupabaseClient();
    
    // Build update object
    const updates = {};
    if (typeof display_name === 'string' && display_name.trim()) {
      updates.display_name = display_name.trim().slice(0, 100);
    }
    if (role && ['founder', 'investor', 'operator', 'other'].includes(role)) {
      updates.role = role;
    }
    
    // Handle preferences merge
    if (preferences && typeof preferences === 'object') {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('id', user.id)
        .single();
      
      const existingPrefs = existingProfile?.preferences || {};
      updates.preferences = { ...existingPrefs, ...preferences };
    }
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);
    
    if (error) {
      console.error('[profile] Update failed:', error);
      return res.status(500).json({ error: 'Failed to update profile' });
    }
    
    // Also update Supabase auth metadata if display_name changed
    if (updates.display_name) {
      await supabase.auth.admin.updateUserById(user.id, {
        user_metadata: { name: updates.display_name }
      });
    }
    
    console.log(`[profile] Updated for user ${user.id}:`, Object.keys(updates));
    res.json({ success: true, updated: updates });
    
  } catch (error) {
    console.error('[profile] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/profile - Delete user account
app.delete('/api/profile', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const supabase = getSupabaseClient();
    
    // Delete profile row (cascade will handle related data)
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', user.id);
    
    if (profileError) {
      console.error('[profile/delete] Profile deletion failed:', profileError);
    }
    
    // Delete auth user
    const { error: authError } = await supabase.auth.admin.deleteUser(user.id);
    
    if (authError) {
      console.error('[profile/delete] Auth deletion failed:', authError);
      return res.status(500).json({ error: 'Failed to delete account' });
    }
    
    console.log(`[profile/delete] Account deleted: ${user.id}`);
    res.json({ success: true });
    
  } catch (error) {
    console.error('[profile/delete] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// REFERRAL/INVITE SYSTEM
// ============================================================

// Helper: Generate invite token
function generateInviteToken() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Helper: Check and grant referral rewards
async function checkAndGrantReferralReward(supabase, inviterUserId) {
  try {
    // Count accepted referrals
    const { count: acceptedCount } = await supabase
      .from('invites')
      .select('*', { count: 'exact', head: true })
      .eq('inviter_user_id', inviterUserId)
      .eq('status', 'accepted');
    
    console.log(`[referral] User ${inviterUserId} has ${acceptedCount} accepted referrals`);
    
    // Check if user already has a reward for this milestone
    const milestones = [
      { count: 3, reward: 'elite_7_days', reason: 'referral_milestone_3', days: 7 },
      { count: 5, reward: 'elite_14_days', reason: 'referral_milestone_5', days: 14 },
      { count: 10, reward: 'elite_30_days', reason: 'referral_milestone_10', days: 30 }
    ];
    
    for (const milestone of milestones) {
      if (acceptedCount >= milestone.count) {
        // Check if reward already granted
        const { count: existingReward } = await supabase
          .from('referral_rewards')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', inviterUserId)
          .eq('reason', milestone.reason);
        
        if (existingReward === 0) {
          // Grant the reward
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + milestone.days);
          
          await supabase.from('referral_rewards').insert({
            user_id: inviterUserId,
            reward_type: milestone.reward,
            reason: milestone.reason,
            expires_at: expiresAt.toISOString()
          });
          
          // Update profile plan to elite temporarily
          await supabase
            .from('profiles')
            .update({ plan: 'elite', plan_expires_at: expiresAt.toISOString() })
            .eq('id', inviterUserId);
          
          console.log(`[referral] Granted ${milestone.reward} to user ${inviterUserId} for ${milestone.reason}`);
          
          // Log event
          await supabase.from('ai_logs').insert({
            type: 'referral',
            action: 'reward_granted',
            status: 'success',
            output: {
              user_id: inviterUserId,
              reward: milestone.reward,
              reason: milestone.reason,
              referral_count: acceptedCount
            }
          }).catch(() => {});
          
          return { granted: true, reward: milestone.reward, days: milestone.days };
        }
      }
    }
    
    return { granted: false };
  } catch (error) {
    console.error('[referral] Error checking/granting reward:', error);
    return { granted: false, error: error.message };
  }
}

// POST /api/invites/create - Create a new invite
app.post('/api/invites/create', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const { email } = req.body; // Optional: pre-fill invitee email
    const supabase = getSupabaseClient();
    
    // Check existing pending invites (limit to 10)
    const { count: pendingCount } = await supabase
      .from('invites')
      .select('*', { count: 'exact', head: true })
      .eq('inviter_user_id', user.id)
      .eq('status', 'pending');
    
    if (pendingCount >= 10) {
      return res.status(400).json({ error: 'Maximum pending invites reached (10). Wait for some to be accepted.' });
    }
    
    const token = generateInviteToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    
    const { data: invite, error } = await supabase
      .from('invites')
      .insert({
        token,
        inviter_user_id: user.id,
        invitee_email: email || null,
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single();
    
    if (error) {
      console.error('[invites/create] Insert failed:', error);
      return res.status(500).json({ error: 'Failed to create invite' });
    }
    
    const baseUrl = process.env.APP_URL || 'https://pythdata.com';
    const inviteUrl = `${baseUrl}/i/${token}`;
    
    console.log(`[invites/create] User ${user.id} created invite ${token}`);
    
    res.json({
      success: true,
      invite: {
        id: invite.id,
        token: invite.token,
        url: inviteUrl,
        expires_at: invite.expires_at
      }
    });
    
  } catch (error) {
    console.error('[invites/create] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/invites - Get user's invites and stats
app.get('/api/invites', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const supabase = getSupabaseClient();
    
    // Get all invites
    const { data: invites, error } = await supabase
      .from('invites')
      .select('id, token, status, invitee_email, created_at, opened_at, accepted_at, expires_at')
      .eq('inviter_user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('[invites] Query failed:', error);
      return res.status(500).json({ error: 'Failed to fetch invites' });
    }
    
    // Get user's referral code
    const { data: profile } = await supabase
      .from('profiles')
      .select('referral_code, referral_count')
      .eq('id', user.id)
      .single();
    
    // Get rewards
    const { data: rewards } = await supabase
      .from('referral_rewards')
      .select('reward_type, reason, granted_at, expires_at, applied')
      .eq('user_id', user.id)
      .order('granted_at', { ascending: false });
    
    // Stats
    const stats = {
      total_sent: invites.length,
      pending: invites.filter(i => i.status === 'pending').length,
      opened: invites.filter(i => i.status === 'opened').length,
      accepted: invites.filter(i => i.status === 'accepted').length,
      referral_code: profile?.referral_code || null,
      referral_count: profile?.referral_count || 0,
      next_milestone: 3 - (profile?.referral_count || 0),
      rewards: rewards || []
    };
    
    const baseUrl = process.env.APP_URL || 'https://pythdata.com';
    
    res.json({
      invites: invites.map(i => ({
        ...i,
        url: `${baseUrl}/i/${i.token}`
      })),
      stats
    });
    
  } catch (error) {
    console.error('[invites] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/invites/:token - Get invite details (public, for landing page)
app.get('/api/invites/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const supabase = getSupabaseClient();
    
    const { data: invite, error } = await supabase
      .from('invites')
      .select(`
        id, token, status, created_at, expires_at,
        inviter:profiles!invites_inviter_user_id_fkey(
          id, full_name, avatar_url
        )
      `)
      .eq('token', token)
      .single();
    
    if (error || !invite) {
      return res.status(404).json({ error: 'Invite not found' });
    }
    
    // Check expiration
    if (new Date(invite.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Invite has expired' });
    }
    
    // Mark as opened if pending
    if (invite.status === 'pending') {
      await supabase
        .from('invites')
        .update({ status: 'opened', opened_at: new Date().toISOString() })
        .eq('id', invite.id);
    }
    
    res.json({
      valid: true,
      token: invite.token,
      inviter: invite.inviter ? {
        name: invite.inviter.full_name || 'A pyth member',
        avatar: invite.inviter.avatar_url
      } : null,
      expires_at: invite.expires_at
    });
    
  } catch (error) {
    console.error('[invites/:token] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/invites/:token/accept - Accept an invite (called after signup)
app.post('/api/invites/:token/accept', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const { token } = req.params;
    const supabase = getSupabaseClient();
    
    // Get the invite
    const { data: invite, error } = await supabase
      .from('invites')
      .select('id, inviter_user_id, status, expires_at')
      .eq('token', token)
      .single();
    
    if (error || !invite) {
      return res.status(404).json({ error: 'Invite not found' });
    }
    
    // Validate
    if (new Date(invite.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Invite has expired' });
    }
    
    if (invite.status === 'accepted') {
      return res.status(400).json({ error: 'Invite already accepted' });
    }
    
    // Can't accept your own invite
    if (invite.inviter_user_id === user.id) {
      return res.status(400).json({ error: 'Cannot accept your own invite' });
    }
    
    // Mark invite as accepted
    await supabase
      .from('invites')
      .update({
        status: 'accepted',
        invitee_user_id: user.id,
        accepted_at: new Date().toISOString()
      })
      .eq('id', invite.id);
    
    // Update invitee profile with referrer
    await supabase
      .from('profiles')
      .update({ referred_by: invite.inviter_user_id })
      .eq('id', user.id);
    
    // Increment inviter's referral count
    await supabase.rpc('increment_referral_count', { user_id: invite.inviter_user_id }).catch(() => {
      // Fallback if RPC doesn't exist
      supabase
        .from('profiles')
        .update({ referral_count: supabase.rpc('coalesce', { col: 'referral_count', default: 0 }) + 1 })
        .eq('id', invite.inviter_user_id);
    });
    
    // Check and grant rewards to inviter
    const rewardResult = await checkAndGrantReferralReward(supabase, invite.inviter_user_id);
    
    console.log(`[invites/accept] User ${user.id} accepted invite from ${invite.inviter_user_id}`);
    
    // Log
    await supabase.from('ai_logs').insert({
      type: 'referral',
      action: 'invite_accepted',
      status: 'success',
      output: {
        inviter_id: invite.inviter_user_id,
        invitee_id: user.id,
        reward_granted: rewardResult.granted,
        reward: rewardResult.reward
      }
    }).catch(() => {});
    
    res.json({
      success: true,
      inviter_rewarded: rewardResult.granted,
      reward: rewardResult.reward
    });
    
  } catch (error) {
    console.error('[invites/accept] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// END EMAIL ALERTS
// ============================================================

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'pyth ai API',
    version: '0.1.0',
    endpoints: [
      'GET /api/health',
      'GET /api',
      'GET /api/live-pairings',
      'GET /api/trending',
      'GET /api/matches?startup_id=...&limit=',
      'GET /api/matches/export.csv?startup_id=...&limit= (elite)',
      'GET /api/matches/memo?startup_id=... (elite)',
      'POST /api/share/matches (elite)',
      'GET /api/share/matches/:token',
      'POST /api/watchlist/add',
      'POST /api/watchlist/remove',
      'GET /api/watchlist',
      'GET /api/notifications',
      'POST /api/notifications/mark-read',
      'GET /api/notifications/count',
      'POST /api/admin/alerts/sweep',
      'POST /api/billing/create-checkout-session',
      'POST /api/billing/create-portal-session',
      'POST /api/billing/webhook',
      'GET /api/billing/status',
      'POST /upload',
      'POST /syndicate',
      'POST /api/syndicates',
      'POST /api/documents',
      'GET /api/matches/startup/:startupId',
      'GET /api/matches/investor/:investorId',
      'GET /api/matches/:matchId/breakdown',
      'GET /api/matches/:entityType/:entityId/insights',
      'GET /api/matches/:entityType/:entityId/report',
      'GET /api/matches/:entityType/:entityId/export',
      'POST /api/ml/training/run',
      'POST /api/rss/refresh',
      'POST /api/rss/discover-startups',
      'POST /api/investors/scrape',
      'POST /api/god-scores/calculate',
      'GET /api/talent/matches/:startupId',
      'POST /api/talent/matches/:startupId/:talentId',
      'GET /api/talent/pool',
      'POST /api/talent/pool',
      'GET /api/market-intelligence/sector-performance',
      'GET /api/market-intelligence/founder-patterns',
      'GET /api/market-intelligence/benchmark/:startupId',
      'GET /api/market-intelligence/key-variables'
    ]
  });
});

// Upload route
app.post('/upload', upload.single('file'), (req, res) => {
  res.json({ filename: req.file.filename, originalname: req.file.originalname });
});

// Syndicate route (legacy)
app.post('/syndicate', (req, res) => {
  const { name, email, message } = req.body;
  const record = `${new Date().toISOString()} - ${name}, ${email}: ${message}\n`;
  fs.appendFileSync('syndicates.txt', record);
  res.json({ success: true });
});

// API-style syndicate route
app.post('/api/syndicates', (req, res) => {
  const { name, email, message } = req.body;
  const record = `${new Date().toISOString()} - ${name}, ${email}: ${message}\n`;
  fs.appendFileSync('syndicates.txt', record);
  res.json({ success: true });
});

// API-style document upload route
app.post('/api/documents', upload.single('file'), (req, res) => {
  res.json({ filename: req.file.filename, originalname: req.file.originalname });
});

// Admin API routes (secure AI enrichment + audit logging)
const adminImportDiscovered = require('./routes/adminImportDiscovered');
app.use('/api/admin', adminImportDiscovered.default || adminImportDiscovered);

// Match API routes
const matchesRouter = require('./routes/matches');
const scanRouter = require('./routes/scan');
app.use('/api/matches', matchesRouter);
app.use('/api', scanRouter);

// Match Run API routes (V1 - Supabase RPC-native orchestration)
const matchRunRoutes = require('./routes/matchRun');
app.use('/api/match', matchRunRoutes);

// Resolve API route (Bulletproof URL resolution)
const resolveRouter = require('./routes/resolve');
app.use('/api', resolveRouter);

// INSTANT Submit API - The Pythh Fast Path (URL → Matches in <3 seconds)
const instantSubmit = require('./routes/instantSubmit');
app.use('/api/instant', instantSubmit);

// Discovery API routes (Phase 3: Job-based submit/poll pattern)
const discoverySubmit = require('./routes/discoverySubmit');
const discoveryResults = require('./routes/discoveryResults');
const deltaResults = require('./routes/deltaResults');
const discoveryDiagnostic = require('./routes/discoveryDiagnostic');
app.use('/api/discovery', discoverySubmit);
app.use('/api/discovery', discoveryResults);
app.use('/api/discovery', deltaResults);
app.use('/api/discovery', discoveryDiagnostic);

// Oracle API routes
const oracleRouter = require('./routes/oracle');
app.use('/api/oracle', oracleRouter);

// Startup API routes (including signal history)
const startupsRouter = require('./routes/startups');
app.use('/api/startups', startupsRouter);

// Startup scrape & enrich API routes
const startupScrapeRouter = require('./routes/startupScrape');
app.use('/api/startup', startupScrapeRouter);

// Talent matching API routes
const talentRouter = require('./routes/talent');
app.use('/api/talent', talentRouter);

// Market intelligence API routes
const marketIntelligenceRouter = require('./routes/marketIntelligence');
app.use('/api/market-intelligence', marketIntelligenceRouter);

// Intelligence API routes (Pythh Brain v1 - read-only)
const intelligenceRouter = require('./routes/intelligence');
app.use('/api', intelligenceRouter);

// GOD Score Guardrails API routes
const godRouter = require('./routes/god');
app.use('/api/god', godRouter);

// Agent API v1 routes (public + keyed access)
const apiV1Router = require('./routes/apiV1');
app.use('/api/v1', apiV1Router);

// Canonical Verification API routes (locked surface)
const canonicalRouter = require('./routes/canonical');
app.use('/api', canonicalRouter);

// Helper function to spawn automation scripts
function spawnAutomationScript(scriptName, description) {
  const { spawn } = require('child_process');
  const path = require('path');
  const rootDir = path.join(__dirname, '..');
  const scriptPath = path.join(rootDir, scriptName);
  
  const process = spawn('node', [scriptPath], {
    cwd: rootDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
    shell: true
  });
  
  process.stdout.on('data', (data) => {
    console.log(`[${description}] ${data.toString()}`);
  });
  
  process.stderr.on('data', (data) => {
    console.error(`[${description} Error] ${data.toString()}`);
  });
  
  process.on('close', (code) => {
    if (code === 0) {
      console.log(`✅ ${description} completed successfully`);
    } else {
      console.error(`❌ ${description} exited with code ${code}`);
    }
  });
  
  process.unref();
  return process;
}

// RSS refresh endpoint - actually runs the scraper
app.post('/api/rss/refresh', requireAdminToken, async (req, res) => {
  try {
    console.log('📡 RSS refresh triggered');
    spawnAutomationScript('run-rss-scraper.js', 'RSS Scraper');
    res.json({ 
      success: true, 
      message: 'RSS scraper started. Check server logs for progress.',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error triggering RSS refresh:', error);
    res.status(500).json({ error: 'Failed to refresh RSS feeds', message: error.message });
  }
});

// Discover startups from RSS endpoint - actually runs the discovery script
app.post('/api/rss/discover-startups', requireAdminToken, async (req, res) => {
  try {
    console.log('🚀 Startup discovery triggered');
    spawnAutomationScript('discover-startups-from-rss.js', 'Startup Discovery');
    res.json({ 
      success: true, 
      message: 'Startup discovery started. Check server logs for progress.',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error triggering startup discovery:', error);
    res.status(500).json({ error: 'Failed to start startup discovery', message: error.message });
  }
});

// Investor scraper endpoint
app.post('/api/investors/scrape', requireAdminToken, async (req, res) => {
  try {
    console.log('💼 Investor scraper triggered');
    spawnAutomationScript('investor-mega-scraper.js', 'Investor Scraper');
    res.json({ 
      success: true, 
      message: 'Investor scraper started. Check server logs for progress.',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error triggering investor scraper:', error);
    res.status(500).json({ error: 'Failed to start investor scraper', message: error.message });
  }
});

// GOD score calculation endpoint
app.post('/api/god-scores/calculate', requireAdminToken, async (req, res) => {
  try {
    console.log('⚡ GOD score calculation triggered');
    spawnAutomationScript('calculate-component-scores.js', 'GOD Score Calculation');
    res.json({ 
      success: true, 
      message: 'GOD score calculation started. Check server logs for progress.',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error triggering GOD score calculation:', error);
    res.status(500).json({ error: 'Failed to start GOD score calculation', message: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// URL SUBMISSION WITH PYTH INFERENCE ENGINE
// ═══════════════════════════════════════════════════════════════════════════
app.post('/api/startup/enrich-url', async (req, res) => {
  const startTime = Date.now();
  const supabase = getSupabaseClient();
  
  try {
    const { url, startupId } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'url is required' });
    }
    
    console.log(`🔥 Enriching URL with inference engine: ${url}`);
    
    // Log to ai_logs for admin visibility (non-blocking)
    try {
      await supabase.from('ai_logs').insert({
        operation: 'inference_engine',
        model: 'pyth_inference',
        status: 'pending',
        error_message: JSON.stringify({ action: 'enrich_url_start', url, startupId, started_at: new Date().toISOString() })
      });
    } catch (logErr) { /* ignore logging errors */ }
    
    // Import inference extractor
    const { extractInferenceData } = require('../lib/inference-extractor');
    const axios = require('axios');
    
    // Fetch website content
    let websiteContent = '';
    try {
      const fullUrl = url.startsWith('http') ? url : `https://${url}`;
      const response = await axios.get(fullUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'text/html',
        },
        timeout: 15000,
        maxRedirects: 5,
      });
      
      // Strip HTML tags
      websiteContent = response.data
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 15000);
    } catch (fetchError) {
      console.log(`⚠️  Could not fetch ${url}: ${fetchError.message}`);
    }
    
    // Run inference engine
    const inference = extractInferenceData(websiteContent, url) || {};
    
    // Calculate GOD score from inference
    const SECTOR_WEIGHTS = {
      'AI/ML': 15, 'FinTech': 12, 'HealthTech': 12, 'CleanTech': 10, 'DevTools': 10,
      'SaaS': 8, 'Cybersecurity': 8, 'E-Commerce': 6, 'LegalTech': 6, 'Gaming': 5,
    };
    
    // Determine data tier
    const hasRichData = !!(
      inference.funding_amount ||
      inference.customer_count ||
      inference.has_revenue ||
      (inference.execution_signals?.length >= 3)
    );
    const hasSomeData = !!(
      inference.sectors?.length > 0 ||
      inference.team_signals?.length > 0 ||
      inference.is_launched ||
      inference.has_customers
    );
    const tier = hasRichData ? 'A' : (hasSomeData ? 'B' : 'C');
    
    let godScore = 40; // Default Tier C
    let scores = { vision: 10, market: 10, traction: 8, team: 8, product: 8 };
    
    if (tier === 'A') {
      // Full scoring
      let vision = 0, market = 0, traction = 0, team = 0, product = 0;
      if (inference.problem_keywords?.length > 0) vision += 10;
      if (inference.problem_severity_estimate >= 7) vision += 10;
      vision += 5;
      vision = Math.min(25, vision);
      
      if (inference.sectors?.length > 0) {
        for (const sector of inference.sectors) {
          market = Math.max(market, SECTOR_WEIGHTS[sector] || 5);
        }
        market += 5;
      }
      market = Math.min(25, market);
      
      if (inference.has_revenue) traction += 15;
      if (inference.has_customers) traction += 8;
      if (inference.customer_count && inference.customer_count > 10) traction += 5;
      if (inference.growth_rate) traction += 5;
      if (inference.funding_amount) {
        const amt = parseFloat(String(inference.funding_amount));
        if (amt >= 10000000) traction += 10;
        else if (amt >= 1000000) traction += 5;
      }
      traction = Math.min(25, traction);
      
      if (inference.has_technical_cofounder) team += 10;
      if (inference.credential_signals?.length > 0) {
        team += Math.min(10, inference.credential_signals.length * 3);
      }
      if (inference.grit_signals?.length > 0) {
        team += Math.min(5, inference.grit_signals.length * 2);
      }
      team = Math.min(25, team);
      
      if (inference.is_launched) product += 15;
      if (inference.has_demo) product += 5;
      product = Math.min(20, product);
      
      godScore = Math.min(100, vision + market + traction + team + product + (tier === 'A' && (vision + market + traction + team + product) >= 60 ? 5 : 0));
      scores = { vision, market, traction, team, product };
    } else if (tier === 'B') {
      // Capped at 55
      let base = 40;
      if (inference.sectors?.length > 0) {
        for (const sector of inference.sectors) {
          base = Math.max(base, 40 + (SECTOR_WEIGHTS[sector] || 0) / 2);
        }
      }
      if (inference.is_launched) base += 4;
      if (inference.has_demo) base += 2;
      if (inference.has_customers) base += 3;
      if (inference.has_technical_cofounder) base += 2;
      if (inference.team_signals?.length > 0) base += 2;
      godScore = Math.min(55, Math.round(base));
      scores = {
        vision: 12,
        market: Math.min(20, (SECTOR_WEIGHTS[inference.sectors?.[0]] || 5)),
        traction: inference.is_launched ? 15 : 8,
        team: inference.has_technical_cofounder ? 15 : 8,
        product: (inference.is_launched ? 10 : 5) + (inference.has_demo ? 5 : 0)
      };
    }
    
    // If we have a startupId, update the database
    if (startupId) {
      const supabase = getSupabaseClient();
      const { error: updateError } = await supabase
        .from('startup_uploads')
        .update({
          sectors: inference.sectors || ['Technology'],
          is_launched: inference.is_launched || false,
          has_demo: inference.has_demo || false,
          has_technical_cofounder: inference.has_technical_cofounder || false,
          total_god_score: godScore,
          vision_score: scores.vision,
          market_score: scores.market,
          traction_score: scores.traction,
          team_score: scores.team,
          product_score: scores.product,
          extracted_data: {
            ...inference,
            data_tier: tier,
            inference_method: 'pyth_inference_engine',
            enriched_at: new Date().toISOString(),
          },
        })
        .eq('id', startupId);
      
      if (updateError) {
        console.error('Failed to update startup:', updateError);
      } else {
        console.log(`✅ Updated startup ${startupId} with GOD score ${godScore} (Tier ${tier})`);
      }
    }
    
    // Log success to ai_logs for admin visibility (non-blocking)
    const duration = Date.now() - startTime;
    try {
      await supabase.from('ai_logs').insert({
        operation: 'inference_engine',
        model: 'pyth_inference',
        status: 'success',
        error_message: JSON.stringify({ 
          action: 'enrich_url_complete',
          url, 
          startupId, 
          godScore, 
          tier, 
          signals_found: (inference.team_signals?.length || 0) + (inference.execution_signals?.length || 0),
          duration_ms: duration,
          completed_at: new Date().toISOString() 
        })
      });
    } catch (logErr) { /* ignore */ }
    
    res.json({
      success: true,
      godScore,
      tier,
      scores,
      inference: {
        sectors: inference.sectors,
        is_launched: inference.is_launched,
        has_demo: inference.has_demo,
        has_technical_cofounder: inference.has_technical_cofounder,
        has_revenue: inference.has_revenue,
        has_customers: inference.has_customers,
        funding_amount: inference.funding_amount,
        team_signals: inference.team_signals,
        credential_signals: inference.credential_signals,
        execution_signals: inference.execution_signals,
      }
    });
  } catch (error) {
    console.error('Error enriching URL:', error);
    
    // Log failure to ai_logs (non-blocking)
    try {
      const supabase = getSupabaseClient();
      await supabase.from('ai_logs').insert({
        operation: 'inference_engine',
        model: 'pyth_inference',
        status: 'error',
        error_message: JSON.stringify({ action: 'enrich_url_error', url: req.body?.url, error: error.message, failed_at: new Date().toISOString() })
      });
    } catch (logErr) { /* ignore */ }
    
    res.status(500).json({ error: 'Failed to enrich URL', message: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN: INFERENCE ENGINE STATUS
// ═══════════════════════════════════════════════════════════════════════════
app.get('/api/admin/inference-status', requireAdminToken, async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    
    // Get recent enrichment logs
    const { data: logs } = await supabase
      .from('ai_logs')
      .select('*')
      .eq('operation', 'inference_engine')
      .order('created_at', { ascending: false })
      .limit(20);
    
    // Get stats
    const { count: totalEnriched } = await supabase
      .from('startup_uploads')
      .select('*', { count: 'exact', head: true })
      .not('extracted_data->inference_method', 'is', null);
    
    const { count: pendingEnrichment } = await supabase
      .from('startup_uploads')
      .select('*', { count: 'exact', head: true })
      .eq('total_god_score', 45)
      .is('extracted_data', null);
    
    const { count: recentErrors } = await supabase
      .from('ai_logs')
      .select('*', { count: 'exact', head: true })
      .eq('operation', 'inference_engine')
      .eq('status', 'error')
      .gte('created_at', new Date(Date.now() - 24*60*60*1000).toISOString());
    
    // Parse error_message JSON and get average duration from recent successes
    const successLogs = logs?.filter(l => l.status === 'success') || [];
    let avgDuration = null;
    if (successLogs.length > 0) {
      const durations = successLogs.map(l => {
        try { return JSON.parse(l.error_message)?.duration_ms; } catch { return null; }
      }).filter(Boolean);
      if (durations.length > 0) {
        avgDuration = Math.round(durations.reduce((a, d) => a + d, 0) / durations.length);
      }
    }
    
    res.json({
      status: recentErrors > 5 ? 'degraded' : 'healthy',
      stats: {
        total_enriched: totalEnriched || 0,
        pending_enrichment: pendingEnrichment || 0,
        errors_last_24h: recentErrors || 0,
        avg_duration_ms: avgDuration,
      },
      recent_logs: logs?.slice(0, 10).map(l => {
        let parsed = {};
        try { parsed = JSON.parse(l.error_message); } catch {}
        return {
          action: parsed.action,
          status: l.status,
          url: parsed.url,
          godScore: parsed.godScore,
          tier: parsed.tier,
          duration_ms: parsed.duration_ms,
          created_at: l.created_at,
        };
      }) || [],
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get inference status', message: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN: ANALYTICS METRICS (Prompt 18)
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/admin/metrics/overview - High-level event counts
app.get('/api/admin/metrics/overview', async (req, res) => {
  try {
    // Require admin key
    const adminKey = req.headers['x-admin-key'] || req.query.admin_key;
    if (!adminKey || !process.env.ADMIN_KEY || adminKey !== process.env.ADMIN_KEY) {
      if (IS_PRODUCTION) return res.status(403).json({ error: 'Admin key required' });
    }
    
    const days = parseInt(req.query.days) || 7;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffISO = cutoff.toISOString();
    
    const supabase = getSupabaseClient();
    
    // Get signups (profiles created)
    const { count: signups } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', cutoffISO);
    
    // Get event counts by type
    const eventTypes = [
      'upgrade_started', 'upgrade_completed', 'alert_created',
      'email_sent', 'email_clicked', 'email_failed'
    ];
    
    const eventCounts = {};
    for (const eventType of eventTypes) {
      const { count } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('event_name', eventType)
        .gte('created_at', cutoffISO);
      eventCounts[eventType] = count || 0;
    }
    
    // Conversion rate: upgrades / signups
    const conversionRate = signups > 0 
      ? ((eventCounts.upgrade_completed / signups) * 100).toFixed(1)
      : 0;
    
    // Email click rate: clicked / sent
    const emailClickRate = eventCounts.email_sent > 0
      ? ((eventCounts.email_clicked / eventCounts.email_sent) * 100).toFixed(1)
      : 0;
    
    res.json({
      period_days: days,
      cutoff: cutoffISO,
      metrics: {
        signups: signups || 0,
        upgrade_started: eventCounts.upgrade_started,
        upgrade_completed: eventCounts.upgrade_completed,
        alerts_created: eventCounts.alert_created,
        emails_sent: eventCounts.email_sent,
        emails_clicked: eventCounts.email_clicked,
        emails_failed: eventCounts.email_failed,
        conversion_rate_pct: parseFloat(conversionRate),
        email_click_rate_pct: parseFloat(emailClickRate)
      }
    });
  } catch (error) {
    console.error('[admin/metrics/overview] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/admin/metrics/funnel - Plan upgrade funnel
app.get('/api/admin/metrics/funnel', async (req, res) => {
  try {
    // Require admin key
    const adminKey = req.headers['x-admin-key'] || req.query.admin_key;
    if (!adminKey || !process.env.ADMIN_KEY || adminKey !== process.env.ADMIN_KEY) {
      if (IS_PRODUCTION) return res.status(403).json({ error: 'Admin key required' });
    }
    
    const days = parseInt(req.query.days) || 7;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffISO = cutoff.toISOString();
    
    const supabase = getSupabaseClient();
    
    // Get upgrade events with target plan
    const { data: upgrades } = await supabase
      .from('events')
      .select('properties')
      .eq('event_name', 'upgrade_completed')
      .gte('created_at', cutoffISO);
    
    // Count by upgrade path
    const funnel = {
      free_to_pro: 0,
      free_to_elite: 0,
      pro_to_elite: 0
    };
    
    for (const upgrade of (upgrades || [])) {
      const newPlan = upgrade.properties?.new_plan;
      const sourceName = upgrade.properties?.upgrade_source_event_name;
      
      // Determine likely source plan (simplified - could track more precisely)
      if (newPlan === 'elite') {
        // Could be from free or pro
        if (sourceName && sourceName.includes('pro')) {
          funnel.pro_to_elite++;
        } else {
          funnel.free_to_elite++;
        }
      } else if (newPlan === 'pro') {
        funnel.free_to_pro++;
      }
    }
    
    // Get current plan distribution
    const { data: planDist } = await supabase
      .from('profiles')
      .select('plan');
    
    const planCounts = { free: 0, pro: 0, elite: 0 };
    for (const p of (planDist || [])) {
      const plan = p.plan || 'free';
      planCounts[plan] = (planCounts[plan] || 0) + 1;
    }
    
    res.json({
      period_days: days,
      cutoff: cutoffISO,
      upgrades: funnel,
      plan_distribution: planCounts
    });
  } catch (error) {
    console.error('[admin/metrics/funnel] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/admin/metrics/attribution - What drove upgrades?
app.get('/api/admin/metrics/attribution', async (req, res) => {
  try {
    // Require admin key
    const adminKey = req.headers['x-admin-key'] || req.query.admin_key;
    if (!adminKey || !process.env.ADMIN_KEY || adminKey !== process.env.ADMIN_KEY) {
      if (IS_PRODUCTION) return res.status(403).json({ error: 'Admin key required' });
    }
    
    const days = parseInt(req.query.days) || 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffISO = cutoff.toISOString();
    
    const supabase = getSupabaseClient();
    
    // Get upgrade events with attribution
    const { data: upgrades } = await supabase
      .from('events')
      .select('properties')
      .eq('event_name', 'upgrade_completed')
      .gte('created_at', cutoffISO);
    
    // Group by source event
    const attribution = {};
    for (const upgrade of (upgrades || [])) {
      const source = upgrade.properties?.upgrade_source_event_name || 'unknown';
      attribution[source] = (attribution[source] || 0) + 1;
    }
    
    // Sort by count descending
    const sortedAttribution = Object.entries(attribution)
      .sort((a, b) => b[1] - a[1])
      .map(([source, count]) => ({ source, count }));
    
    res.json({
      period_days: days,
      cutoff: cutoffISO,
      attribution: sortedAttribution,
      total_upgrades: upgrades?.length || 0
    });
  } catch (error) {
    console.error('[admin/metrics/attribution] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN METRICS DASHBOARD (Prompt 21) - Comprehensive funnel + loop metrics
// ═══════════════════════════════════════════════════════════════════════════

// Pricing constants for revenue estimation
const PLAN_PRICES = { pro: 49, elite: 149 };

// Admin session token management (HMAC-based, 10 minute expiry)
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || process.env.EMAIL_SECRET || 'admin-session-secret-change-in-prod';

function generateAdminToken(userId) {
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
  const payload = `${userId}:${expiresAt}`;
  const hmac = crypto.createHmac('sha256', ADMIN_SESSION_SECRET);
  hmac.update(payload);
  const signature = hmac.digest('hex');
  return { token: `${payload}:${signature}`, expiresAt };
}

function verifyAdminToken(token) {
  if (!token) return { valid: false, error: 'No token provided' };
  
  const parts = token.split(':');
  if (parts.length !== 3) return { valid: false, error: 'Invalid token format' };
  
  const [userId, expiresAtStr, providedSignature] = parts;
  const expiresAt = parseInt(expiresAtStr);
  
  if (Date.now() > expiresAt) return { valid: false, error: 'Token expired' };
  
  const payload = `${userId}:${expiresAtStr}`;
  const hmac = crypto.createHmac('sha256', ADMIN_SESSION_SECRET);
  hmac.update(payload);
  const expectedSignature = hmac.digest('hex');
  
  try {
    if (crypto.timingSafeEqual(Buffer.from(providedSignature), Buffer.from(expectedSignature))) {
      return { valid: true, userId };
    }
  } catch (e) {
    return { valid: false, error: 'Signature mismatch' };
  }
  return { valid: false, error: 'Invalid signature' };
}

// Middleware to verify admin token from Authorization header OR x-admin-key
function requireAdminToken(req, res, next) {
  // Allow direct admin key for local dev/testing
  const adminKey = req.headers['x-admin-key'];
  if (adminKey && process.env.ADMIN_KEY && adminKey === process.env.ADMIN_KEY) {
    req.adminUserId = 'admin-key-user';
    return next();
  }
  // In non-production, accept any admin key value for convenience
  if (!IS_PRODUCTION && adminKey) {
    req.adminUserId = 'admin-key-user';
    return next();
  }
  
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header with Bearer token required' });
  }
  
  const token = authHeader.substring(7);
  const verification = verifyAdminToken(token);
  
  if (!verification.valid) {
    return res.status(401).json({ error: verification.error });
  }
  
  req.adminUserId = verification.userId;
  next();
}

// POST /api/admin/session - Generate admin session token (requires ADMIN_KEY)
app.post('/api/admin/session', async (req, res) => {
  try {
    const adminKey = req.headers['x-admin-key'];
    if (!adminKey || !process.env.ADMIN_KEY || adminKey !== process.env.ADMIN_KEY) {
      if (IS_PRODUCTION) return res.status(403).json({ error: 'Admin key required' });
    }
    
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    
    const { token, expiresAt } = generateAdminToken(userId);
    
    // Log admin session
    const supabase = getSupabaseClient();
    await supabase.from('events').insert({
      user_id: userId,
      event_name: 'admin_session_created',
      source: 'server',
      properties: { expires_at: new Date(expiresAt).toISOString() }
    }).catch(() => {});
    
    res.json({ token, expires_at: new Date(expiresAt).toISOString() });
  } catch (error) {
    console.error('[admin/session] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper: get date range cutoff
function getMetricsRange(days) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);
  return cutoff.toISOString();
}

// GET /api/admin/metrics/v2/overview - Comprehensive funnel + loop + user metrics
app.get('/api/admin/metrics/v2/overview', requireAdminToken, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const cutoffISO = getMetricsRange(days);
    
    const supabase = getSupabaseClient();
    
    // Funnel events
    const funnelEvents = ['pricing_viewed', 'upgrade_cta_clicked', 'upgrade_started', 'upgrade_completed'];
    const funnel = {};
    
    for (const eventName of funnelEvents) {
      const { count } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('event_name', eventName)
        .gte('created_at', cutoffISO);
      funnel[eventName] = count || 0;
    }
    
    // Calculate conversion rates
    funnel.cvr_view_to_complete = funnel.pricing_viewed > 0 
      ? ((funnel.upgrade_completed / funnel.pricing_viewed) * 100).toFixed(2) + '%'
      : '0%';
    funnel.cvr_cta_to_complete = funnel.upgrade_cta_clicked > 0
      ? ((funnel.upgrade_completed / funnel.upgrade_cta_clicked) * 100).toFixed(2) + '%'
      : '0%';
    
    // Loop events (retention)
    const loopEventNames = ['alert_created', 'email_sent', 'email_clicked', 'share_opened', 'match_viewed'];
    const loop = {};
    
    for (const eventName of loopEventNames) {
      const { count } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('event_name', eventName)
        .gte('created_at', cutoffISO);
      // Map to friendly names
      const key = eventName.replace('alert_', 'alerts_')
        .replace('email_', 'emails_')
        .replace('share_', 'shares_')
        .replace('match_', 'matches_');
      loop[key] = count || 0;
    }
    
    // Referral metrics (Prompt 24)
    const referralEventNames = ['invite_created', 'invite_opened', 'invite_accepted', 
                                 'referral_activation', 'reward_granted'];
    const referrals = {};
    
    for (const eventName of referralEventNames) {
      const { count } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('event_name', eventName)
        .gte('created_at', cutoffISO);
      referrals[eventName] = count || 0;
    }
    
    // User metrics
    const { count: activeUsers } = await supabase
      .from('events')
      .select('user_id', { count: 'exact', head: true })
      .not('user_id', 'is', null)
      .gte('created_at', cutoffISO);
    
    const { count: newUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', cutoffISO);
    
    res.json({
      range_days: days,
      cutoff: cutoffISO,
      funnel,
      loop,
      referrals,
      users: {
        active_users: activeUsers || 0,
        new_users: newUsers || 0
      }
    });
  } catch (error) {
    console.error('[admin/metrics/v2/overview] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/admin/metrics/v2/sources - Upgrade sources with full funnel per source
app.get('/api/admin/metrics/v2/sources', requireAdminToken, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const cutoffISO = getMetricsRange(days);
    
    const supabase = getSupabaseClient();
    
    // Get all funnel events with properties
    const funnelEventNames = ['pricing_viewed', 'upgrade_cta_clicked', 'upgrade_started', 'upgrade_completed'];
    
    // Fetch upgrade_completed events to get sources
    const { data: upgrades } = await supabase
      .from('events')
      .select('properties')
      .eq('event_name', 'upgrade_completed')
      .gte('created_at', cutoffISO);
    
    // Get pricing_viewed events with source
    const { data: pricingViews } = await supabase
      .from('events')
      .select('properties')
      .eq('event_name', 'pricing_viewed')
      .gte('created_at', cutoffISO);
    
    // Get upgrade_cta_clicked events with source
    const { data: ctaClicks } = await supabase
      .from('events')
      .select('properties')
      .eq('event_name', 'upgrade_cta_clicked')
      .gte('created_at', cutoffISO);
    
    // Get upgrade_started events with source
    const { data: upgradeStarts } = await supabase
      .from('events')
      .select('properties')
      .eq('event_name', 'upgrade_started')
      .gte('created_at', cutoffISO);
    
    // Helper to extract source from properties
    const getSource = (props) => {
      return props?.source || props?.upgrade_source_event_name || props?.upgrade_source || 'unknown';
    };
    
    // Aggregate by source
    const sourceStats = {};
    
    // Count pricing views by source
    for (const pv of (pricingViews || [])) {
      const source = getSource(pv.properties);
      if (!sourceStats[source]) sourceStats[source] = { pricing_views: 0, cta_clicked: 0, upgrades_started: 0, upgrades_completed: 0, revenue: 0 };
      sourceStats[source].pricing_views++;
    }
    
    // Count CTA clicks by source
    for (const cc of (ctaClicks || [])) {
      const source = getSource(cc.properties);
      if (!sourceStats[source]) sourceStats[source] = { pricing_views: 0, cta_clicked: 0, upgrades_started: 0, upgrades_completed: 0, revenue: 0 };
      sourceStats[source].cta_clicked++;
    }
    
    // Count upgrade starts by source
    for (const us of (upgradeStarts || [])) {
      const source = getSource(us.properties);
      if (!sourceStats[source]) sourceStats[source] = { pricing_views: 0, cta_clicked: 0, upgrades_started: 0, upgrades_completed: 0, revenue: 0 };
      sourceStats[source].upgrades_started++;
    }
    
    // Count completed upgrades by source + calculate revenue
    for (const upgrade of (upgrades || [])) {
      const source = getSource(upgrade.properties);
      const plan = upgrade.properties?.plan_new || upgrade.properties?.new_plan || 'pro';
      const price = PLAN_PRICES[plan] || 49;
      
      if (!sourceStats[source]) sourceStats[source] = { pricing_views: 0, cta_clicked: 0, upgrades_started: 0, upgrades_completed: 0, revenue: 0 };
      sourceStats[source].upgrades_completed++;
      sourceStats[source].revenue += price;
    }
    
    // Convert to array with CVR calculation
    const sourcesArray = Object.entries(sourceStats)
      .map(([source, stats]) => ({
        source,
        pricing_views: stats.pricing_views,
        cta_clicked: stats.cta_clicked,
        upgrades_started: stats.upgrades_started,
        upgrades_completed: stats.upgrades_completed,
        revenue_estimate: `$${stats.revenue}`,
        cvr_view_to_complete: stats.pricing_views > 0 
          ? ((stats.upgrades_completed / stats.pricing_views) * 100).toFixed(2) + '%'
          : '0%'
      }))
      .sort((a, b) => b.upgrades_completed - a.upgrades_completed);
    
    res.json({
      range_days: days,
      cutoff: cutoffISO,
      sources: sourcesArray,
      total_revenue: `$${sourcesArray.reduce((sum, s) => sum + parseInt(s.revenue_estimate.replace('$', '')), 0)}`
    });
  } catch (error) {
    console.error('[admin/metrics/v2/sources] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/admin/metrics/v2/daily - Per-day breakdown
app.get('/api/admin/metrics/v2/daily', requireAdminToken, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const cutoffISO = getMetricsRange(days);
    
    const supabase = getSupabaseClient();
    
    // Generate date range for the past N days
    const dates = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().split('T')[0]);
    }
    
    // Event types to track daily
    const eventTypes = [
      'pricing_viewed', 'upgrade_cta_clicked', 'upgrade_started', 'upgrade_completed',
      'alert_created', 'email_sent', 'email_clicked', 'share_opened', 'match_viewed'
    ];
    
    // Fetch all events in range
    const { data: allEvents } = await supabase
      .from('events')
      .select('event_name, created_at')
      .in('event_name', eventTypes)
      .gte('created_at', cutoffISO);
    
    // Group by day
    const dailyMap = {};
    for (const date of dates) {
      dailyMap[date] = {
        day: date,
        pricing_viewed: 0,
        upgrade_cta_clicked: 0,
        upgrade_started: 0,
        upgrade_completed: 0,
        alerts_created: 0,
        emails_sent: 0,
        emails_clicked: 0,
        shares_opened: 0,
        matches_viewed: 0
      };
    }
    
    // Tally events
    for (const event of (allEvents || [])) {
      const day = event.created_at.split('T')[0];
      if (!dailyMap[day]) continue;
      
      // Map event names to column names
      switch (event.event_name) {
        case 'pricing_viewed': dailyMap[day].pricing_viewed++; break;
        case 'upgrade_cta_clicked': dailyMap[day].upgrade_cta_clicked++; break;
        case 'upgrade_started': dailyMap[day].upgrade_started++; break;
        case 'upgrade_completed': dailyMap[day].upgrade_completed++; break;
        case 'alert_created': dailyMap[day].alerts_created++; break;
        case 'email_sent': dailyMap[day].emails_sent++; break;
        case 'email_clicked': dailyMap[day].emails_clicked++; break;
        case 'share_opened': dailyMap[day].shares_opened++; break;
        case 'match_viewed': dailyMap[day].matches_viewed++; break;
      }
    }
    
    // Convert to array (newest first)
    const dailyRows = Object.values(dailyMap).reverse();
    
    res.json({
      range_days: days,
      cutoff: cutoffISO,
      daily: dailyRows
    });
  } catch (error) {
    console.error('[admin/metrics/v2/daily] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Log admin metrics view event
app.post('/api/admin/metrics/log-view', requireAdminToken, async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    await supabase.from('events').insert({
      user_id: req.adminUserId,
      event_name: 'admin_metrics_viewed',
      source: 'server',
      page: '/admin/metrics',
      properties: { viewed_at: new Date().toISOString() }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generic scraper endpoint - runs any scraper script
app.post('/api/scrapers/run', async (req, res) => {
  try {
    const { scriptName, description } = req.body;
    
    if (!scriptName) {
      return res.status(400).json({ error: 'scriptName is required' });
    }


    console.log(`🔄 Scraper triggered: ${description || scriptName}`);
    spawnAutomationScript(scriptName, description || scriptName);
    
    res.json({ 
      success: true, 
      message: `${description || scriptName} started. Check server logs for progress.`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error triggering scraper:', error);
    res.status(500).json({ error: 'Failed to start scraper', message: error.message });
  }
});

// ML Recommendation apply endpoint
app.post('/api/ml/recommendations/:id/apply', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get Supabase client with error handling
    let supabase;
    try {
      supabase = getSupabaseClient();
    } catch (clientError) {
      console.error('[API /api/ml/recommendations/:id/apply] Error creating Supabase client:', clientError.message);
      console.error('[API] Available Supabase env vars:', Object.keys(process.env).filter(k => k.includes('SUPABASE')));
      return res.status(500).json({ 
        error: 'Server configuration error',
        message: clientError.message,
        details: 'The server could not connect to Supabase. Please check environment variables in .env file.'
      });
    }

    // Fetch recommendation
    const { data: recommendation, error: fetchError } = await supabase
      .from('ml_recommendations')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !recommendation) {
      return res.status(404).json({ error: 'Recommendation not found' });
    }

    if (recommendation.status === 'applied') {
      return res.status(400).json({ error: 'Recommendation already applied' });
    }

    // Update status to applied
    const { error: updateError } = await supabase
      .from('ml_recommendations')
      .update({
        status: 'applied',
        applied_at: new Date().toISOString(),
        applied_by: req.body.userId || 'admin'
      })
      .eq('id', id);

    if (updateError) {
      throw updateError;
    }

    // TODO: Actually apply the weight changes to the algorithm
    // This would involve updating environment variables or a config table
    console.log('Applied recommendation:', recommendation);

    res.json({ 
      success: true, 
      message: 'Recommendation applied successfully',
      recommendation 
    });
  } catch (error) {
    console.error('Error applying recommendation:', error);
    res.status(500).json({ error: 'Failed to apply recommendation', message: error.message });
  }
});

// GOD weights save endpoint
app.post('/api/god-weights/save', async (req, res) => {
  try {
    const { weights, userId } = req.body;
    
    if (!weights) {
      return res.status(400).json({ error: 'weights are required' });
    }

    const supabase = getSupabaseClient();

    // Save to algorithm_weight_history
    const { error: historyError } = await supabase
      .from('algorithm_weight_history')
      .insert({
        applied_by: userId || 'admin',
        applied_at: new Date().toISOString(),
        weight_updates: [{
          component: 'all',
          new_weight: weights,
          reason: 'Manual weight adjustment via GOD Settings'
        }]
      });

    if (historyError) {
      console.warn('Failed to save weight history:', historyError);
    }

    // TODO: Actually update the algorithm configuration
    // This could update environment variables or a config table

    res.json({ 
      success: true, 
      message: 'GOD algorithm weights saved successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error saving GOD weights:', error);
    res.status(500).json({ error: 'Failed to save weights', message: error.message });
  }
});

// ML Training endpoint
app.post('/api/ml/training/run', async (req, res) => {
  try {
    console.log('🤖 ML Training triggered via API');
    
    const { spawn } = require('child_process');
    const path = require('path');
    const fs = require('fs');
    
    // Get the root directory (one level up from server/)
    const rootDir = path.join(__dirname, '..');
    const trainingScript = path.join(rootDir, 'run-ml-training.js');
    
    // Check if script exists
    if (!fs.existsSync(trainingScript)) {
      console.error(`❌ Training script not found: ${trainingScript}`);
      return res.status(500).json({ 
        error: 'Training script not found',
        message: `Expected file: ${trainingScript}` 
      });
    }
    
    // Check if tsx is available (for TypeScript support)
    const rootPackageJson = path.join(rootDir, 'package.json');
    let useTsx = false;
    if (fs.existsSync(rootPackageJson)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(rootPackageJson, 'utf8'));
        if (pkg.dependencies && (pkg.dependencies['tsx'] || (pkg.devDependencies && pkg.devDependencies['tsx']))) {
          useTsx = true;
        }
      } catch (e) {
        console.warn('Could not parse package.json:', e.message);
      }
    }
    
    // Try to use tsx if available, otherwise use node
    // If the script uses ES modules, we might need tsx
    const command = useTsx ? 'npx' : 'node';
    const args = useTsx ? ['tsx', trainingScript] : [trainingScript];
    
    // Spawn the training script as a child process
    const trainingProcess = spawn(command, args, {
      cwd: rootDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false, // Changed to false for better error handling
      shell: true // Use shell for npx to work
    });
    
    // Log output from the training process
    trainingProcess.stdout.on('data', (data) => {
      console.log(`[ML Training] ${data.toString()}`);
    });
    
    trainingProcess.stderr.on('data', (data) => {
      console.error(`[ML Training Error] ${data.toString()}`);
    });
    
    trainingProcess.on('close', (code) => {
      if (code === 0) {
        console.log('✅ ML Training cycle completed successfully');
      } else {
        console.error(`❌ ML Training cycle exited with code ${code}`);
      }
    });
    
    // Don't wait for the process - let it run in background
    trainingProcess.unref();
    
    // Return immediately - training runs in background
    res.json({ 
      success: true, 
      message: 'ML training cycle started. Check server logs for progress.',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error starting ML training:', error);
    res.status(500).json({ 
      error: 'Failed to start ML training',
      message: error.message 
    });
  }
});

// ------------------------------------------------------------
// API 404 HANDLER (catch unmatched /api/* BEFORE static/SPA)
// ------------------------------------------------------------
app.use('/api', (req, res) => {
  console.log(`[API 404] Not found: ${req.method} ${req.path} [${req.requestId || 'no-id'}]`);
  res.status(404).json({
    ok: false,
    error: { code: 'not_found', message: 'API route not found' },
    path: req.path,
    requestId: req.requestId
  });
});

// === PRODUCTION: Serve Frontend Static Files ===
// This serves the built React app from /app/dist in production
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  console.log('[Server] Serving static files from:', distPath);
  app.use(express.static(distPath));
  
  // SPA fallback - serve index.html for all non-API routes
  // Use regex pattern instead of '*' for Express 5 / path-to-regexp compatibility
  app.get(/^(?!\/api\/)(?!\/uploads\/).*/, (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// ------------------------------------------------------------
// 404 HANDLER (for all unmatched routes - AFTER static/SPA)
// ------------------------------------------------------------
app.use((req, res, next) => {
  // Don't log static asset 404s
  if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf)$/)) {
    return res.status(404).end();
  }
  
  console.log(`[404] Not found: ${req.method} ${req.path} [${req.requestId || 'no-id'}]`);
  res.status(404).json({ 
    error: 'Not Found', 
    path: req.path,
    requestId: req.requestId 
  });
});

// ------------------------------------------------------------
// ERROR HANDLER (must be last middleware)
// ------------------------------------------------------------
app.use((err, req, res, next) => {
  console.error(`[error] ${err.message} [${req.requestId || 'no-id'}]`);
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    requestId: req.requestId
  });
});

// Start server with error handling
try {
  app.listen(PORT, '0.0.0.0', () => {
    logger.info({ component: 'startup', port: PORT, env: IS_PRODUCTION ? 'production' : 'development' }, 'Server started on port %d', PORT);
    
    // Prompt 14: Scheduled alerts sweep
    // Run every 15 minutes (900000ms)
    const SWEEP_INTERVAL_MS = 15 * 60 * 1000;
    
    // Initial sweep after 60 seconds to let server stabilize
    setTimeout(async () => {
      console.log('[scheduled-sweep] Running initial alerts sweep...');
      try {
        const results = await runAlertsSweep();
        console.log(`[scheduled-sweep] Initial sweep complete: ${results.processed} processed, ${results.alerts_sent} alerts sent`);
      } catch (err) {
        console.error('[scheduled-sweep] Initial sweep failed:', err.message);
      }
    }, 60 * 1000);
    
    // Regular interval sweep
    setInterval(async () => {
      console.log('[scheduled-sweep] Running scheduled alerts sweep...');
      try {
        const results = await runAlertsSweep();
        console.log(`[scheduled-sweep] Sweep complete: ${results.processed} processed, ${results.alerts_sent} alerts sent`);
        
        // Log to ai_logs for monitoring (Prompt 14)
        if (results.alerts_sent > 0 || results.errors.length > 0) {
          const supabase = getSupabaseClient();
          await supabase.from('ai_logs').insert({
            type: 'alerts_sweep',
            action: 'scheduled_run',
            status: results.errors.length > 0 ? 'partial' : 'success',
            output: {
              processed: results.processed,
              alerts_sent: results.alerts_sent,
              errors: results.errors,
              timestamp: new Date().toISOString()
            }
          });
        }
      } catch (err) {
        console.error('[scheduled-sweep] Sweep failed:', err.message);
        
        // Log failure to ai_logs
        try {
          const supabase = getSupabaseClient();
          await supabase.from('ai_logs').insert({
            type: 'alerts_sweep',
            action: 'scheduled_run',
            status: 'error',
            output: { error: err.message, timestamp: new Date().toISOString() }
          });
        } catch (logErr) {
          console.error('[scheduled-sweep] Failed to log error:', logErr.message);
        }
      }
    }, SWEEP_INTERVAL_MS);
    
    console.log(`🔔 Alerts sweep scheduled every ${SWEEP_INTERVAL_MS / 1000 / 60} minutes`);
    
    // Prompt 19: Scheduled daily digest delivery
    // Run every 5 minutes to check for users whose local time matches digest_time
    const DIGEST_INTERVAL_MS = 5 * 60 * 1000;
    
    // Initial digest check after 90 seconds
    setTimeout(async () => {
      console.log('[scheduled-digest] Running initial digest check...');
      try {
        const enqueueResults = await enqueueDailyDigests();
        const deliverResults = await deliverPendingDigests();
        console.log(`[scheduled-digest] Initial check complete: enqueued ${enqueueResults.enqueued}, sent ${deliverResults.sent}`);
      } catch (err) {
        console.error('[scheduled-digest] Initial check failed:', err.message);
      }
    }, 90 * 1000);
    
    // Regular interval digest check
    setInterval(async () => {
      try {
        const enqueueResults = await enqueueDailyDigests();
        const deliverResults = await deliverPendingDigests();
        
        // Only log if something happened
        if (enqueueResults.enqueued > 0 || deliverResults.sent > 0 || deliverResults.failed > 0) {
          console.log(`[scheduled-digest] Cycle complete: enqueued ${enqueueResults.enqueued}, sent ${deliverResults.sent}, failed ${deliverResults.failed}`);
          
          const supabase = getSupabaseClient();
          await supabase.from('ai_logs').insert({
            type: 'digest_sweep',
            action: 'scheduled_run',
            status: deliverResults.failed > 0 ? 'partial' : 'success',
            output: { enqueue: enqueueResults, deliver: deliverResults, timestamp: new Date().toISOString() }
          }).catch(() => {});
        }
      } catch (err) {
        console.error('[scheduled-digest] Cycle failed:', err.message);
      }
    }, DIGEST_INTERVAL_MS);
    
    console.log(`📊 Daily digest check scheduled every ${DIGEST_INTERVAL_MS / 1000 / 60} minutes`);
  });
} catch (error) {
  logger.fatal({ component: 'startup', err: error }, 'Failed to start server');
  process.exit(1);
}

// Handle server errors (these are fine outside app.listen)
process.on('uncaughtException', (error) => {
  logger.fatal({ component: 'process', err: error }, 'Uncaught Exception — exiting');
  // Node is in undefined state after uncaught exception — must exit and let PM2 restart
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ component: 'process', err: reason }, 'Unhandled Rejection');
});
