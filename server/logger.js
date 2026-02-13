/**
 * Structured Logger — Pino-based logging for Hot Honey / Pythh
 * 
 * Usage:
 *   const log = require('./logger');
 *   log.info({ component: 'billing', userId: '123' }, 'Payment processed');
 *   log.error({ component: 'scraper', err }, 'Scrape failed');
 * 
 * In production: JSON lines (machine-parseable, ready for log aggregators)
 * In development: pretty-printed with colors via pino-pretty
 * 
 * Migration guide:
 *   console.log('[tag] message', data)  →  log.info({ component: 'tag' }, 'message %o', data)
 *   console.error('[tag] Error:', err)  →  log.error({ component: 'tag', err }, 'Error')
 */

const pino = require('pino');

const IS_PRODUCTION = process.env.NODE_ENV === 'production' || !!process.env.FLY_APP_NAME;

const logger = pino({
  level: process.env.LOG_LEVEL || (IS_PRODUCTION ? 'info' : 'debug'),
  
  // Base fields included in every log line
  base: {
    service: 'pythh-api',
    ...(process.env.FLY_APP_NAME && { fly_app: process.env.FLY_APP_NAME }),
    ...(process.env.FLY_REGION && { region: process.env.FLY_REGION }),
  },

  // Timestamp format
  timestamp: pino.stdTimeFunctions.isoTime,

  // Serializers for common objects
  serializers: {
    err: pino.stdSerializers.err,
    req: (req) => ({
      method: req.method,
      url: req.url,
      remoteAddress: req.ip || req.connection?.remoteAddress,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },

  // Pretty print in development
  ...(!IS_PRODUCTION && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname,service,fly_app,region',
        messageFormat: '{component} | {msg}',
      },
    },
  }),
});

/**
 * Create a child logger for a specific component/module.
 * 
 * Usage:
 *   const log = require('./logger').child('scraper');
 *   log.info('Started scraping');  // automatically includes component: 'scraper'
 */
logger.child = logger.child.bind(logger);

// Convenience: create a component-scoped child logger
logger.forComponent = (component) => logger.child({ component });

module.exports = logger;
