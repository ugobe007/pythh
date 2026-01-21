function maskEmail(s) {
  if (!s || typeof s !== 'string') return s;
  return s.replace(/([a-zA-Z0-9._%+-])([a-zA-Z0-9._%+-]*)(@[^ \t\r\n]+)/g, (_, a, mid, domain) => {
    return `${a}${mid ? '***' : ''}${domain}`;
  });
}

function stripQuery(url) {
  if (!url || typeof url !== 'string') return url;
  try {
    const u = new URL(url, 'http://local');
    return `${u.origin}${u.pathname}`;
  } catch {
    // fallback for relative
    return url.split('?')[0];
  }
}

function redact(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  const out = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    const key = k.toLowerCase();

    if (key.includes('authorization') || key.includes('cookie') || key.includes('set-cookie')) {
      out[k] = '[REDACTED]';
      continue;
    }
    if (key.includes('token') || key.includes('service_key') || key.includes('apikey') || key.includes('api_key')) {
      out[k] = '[REDACTED]';
      continue;
    }

    if (typeof v === 'string') {
      let s = v;
      s = maskEmail(s);
      if (key.includes('url')) s = stripQuery(s);
      out[k] = s;
      continue;
    }

    if (typeof v === 'object' && v !== null) {
      out[k] = redact(v);
      continue;
    }

    out[k] = v;
  }
  return out;
}

function safeLog(level, msg, meta = {}) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...redact(meta),
  };

  // eslint-disable-next-line no-console
  console[level] ? console[level](JSON.stringify(payload)) : console.log(JSON.stringify(payload));
}

module.exports = { safeLog, redact };
