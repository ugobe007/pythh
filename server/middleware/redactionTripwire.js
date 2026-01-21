/**
 * REDACTION TRIPWIRE MIDDLEWARE
 * ============================================================================
 * Security layer that prevents accidental exposure of identifying information.
 * 
 * This middleware scans all API responses and:
 * 1. Blocks dangerous fields (url, domain, website, linkedin, name, email)
 * 2. Detects potential domain names in string values
 * 3. Logs security warnings for review
 * 4. Returns sanitized response to client
 * 
 * Use on all observatory endpoints before sending responses.
 * ============================================================================
 */

// Dangerous field patterns
const BLOCKED_FIELD_PATTERNS = [
  /url$/i,
  /domain$/i,
  /website$/i,
  /linkedin/i,
  /_name$/i,
  /email/i,
  /founder/i,
  /company_name/i,
  /startup_name/i,
  /startup_id/i // Real startup UUID should never be exposed
];

// Domain detection heuristic (basic)
const DOMAIN_PATTERN = /\b[a-z0-9-]+\.(com|io|ai|co|net|org|dev)\b/i;

/**
 * Check if a field name matches blocked patterns
 */
function isBlockedField(fieldName) {
  return BLOCKED_FIELD_PATTERNS.some(pattern => pattern.test(fieldName));
}

/**
 * Check if a string value looks like a domain
 */
function looksLikeDomain(value) {
  if (typeof value !== 'string') return false;
  return DOMAIN_PATTERN.test(value);
}

/**
 * Recursively scan and redact an object
 * Returns: { sanitized, violations }
 */
function scanAndRedact(obj, path = 'root') {
  const violations = [];
  
  if (obj === null || obj === undefined) {
    return { sanitized: obj, violations };
  }
  
  // Handle arrays
  if (Array.isArray(obj)) {
    const sanitizedArray = [];
    obj.forEach((item, index) => {
      const result = scanAndRedact(item, `${path}[${index}]`);
      sanitizedArray.push(result.sanitized);
      violations.push(...result.violations);
    });
    return { sanitized: sanitizedArray, violations };
  }
  
  // Handle objects
  if (typeof obj === 'object') {
    const sanitized = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const fieldPath = `${path}.${key}`;
      
      // Check if field name is blocked
      if (isBlockedField(key)) {
        violations.push({
          type: 'BLOCKED_FIELD',
          field: fieldPath,
          value: typeof value === 'string' ? value.substring(0, 50) : typeof value
        });
        // Drop the field entirely
        continue;
      }
      
      // Check if string value looks like a domain
      if (typeof value === 'string' && looksLikeDomain(value)) {
        violations.push({
          type: 'POTENTIAL_DOMAIN',
          field: fieldPath,
          value: value
        });
        // Keep the value but log for review
      }
      
      // Recursively scan nested objects/arrays
      if (typeof value === 'object' && value !== null) {
        const result = scanAndRedact(value, fieldPath);
        sanitized[key] = result.sanitized;
        violations.push(...result.violations);
      } else {
        sanitized[key] = value;
      }
    }
    
    return { sanitized, violations };
  }
  
  // Primitive values
  return { sanitized: obj, violations };
}

/**
 * Express middleware: redact response before sending
 * Usage: app.use('/api/observatory', redactionTripwire);
 */
function redactionTripwire(req, res, next) {
  const originalJson = res.json.bind(res);
  
  res.json = function(data) {
    const { sanitized, violations } = scanAndRedact(data, `${req.method} ${req.path}`);
    
    if (violations.length > 0) {
      console.error('[SECURITY TRIPWIRE] Violations detected:');
      violations.forEach(v => {
        console.error(`  - ${v.type}: ${v.field} = ${JSON.stringify(v.value)}`);
      });
      
      // Log to monitoring system (could be Sentry, Datadog, etc.)
      // For now, just console
      console.error(`[SECURITY TRIPWIRE] ${violations.length} violations on ${req.method} ${req.path}`);
    }
    
    return originalJson(sanitized);
  };
  
  next();
}

/**
 * Standalone function for API route handlers
 * Usage: const safe = redactResponse(data);
 */
function redactResponse(data) {
  const { sanitized, violations } = scanAndRedact(data);
  
  if (violations.length > 0) {
    console.error('[SECURITY TRIPWIRE] Manual redaction found violations:');
    violations.forEach(v => {
      console.error(`  - ${v.type}: ${v.field} = ${JSON.stringify(v.value)}`);
    });
  }
  
  return sanitized;
}

module.exports = {
  redactionTripwire,
  redactResponse,
  isBlockedField,
  looksLikeDomain
};
