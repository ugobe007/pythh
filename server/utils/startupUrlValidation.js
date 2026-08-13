/**
 * Validate the hostname boundary before Submit URL performs any lookup or write.
 * This deliberately does not canonicalize the URL or alter matching inputs.
 */
function validateStartupUrl(value) {
  const input = String(value || '').trim();
  if (!input || /\s/.test(input)) return { valid: false, domain: '' };

  try {
    const parsed = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
    const domain = parsed.hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
    const labels = domain.split('.');
    const validLabels = labels.every(
      (label) =>
        label.length > 0 &&
        label.length <= 63 &&
        /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label),
    );
    const suffix = labels.at(-1) || '';
    const valid =
      parsed.protocol === 'http:' || parsed.protocol === 'https:'
        ? labels.length >= 2 && validLabels && /^[a-z]{2,63}$/i.test(suffix)
        : false;

    return { valid, domain: valid ? domain : '' };
  } catch {
    return { valid: false, domain: '' };
  }
}

module.exports = { validateStartupUrl };
