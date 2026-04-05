/**
 * Strip HTML tags and normalize scraped text for plain-text UI (readiness report, profile card).
 * Handles broken scrapes: raw tags, malformed entities (`& ;`), spaced semicolons (`&nbsp ;`).
 */

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  ldquo: '"',
  rdquo: '"',
  lsquo: '\u2018',
  rsquo: '\u2019',
  mdash: '\u2014',
  ndash: '\u2013',
  hellip: '\u2026',
  zwj: '',
  zwnj: '',
  shy: '',
  copy: '\u00a9',
  reg: '\u00ae',
  trade: '\u2122',
};

function decodeNumericCode(code: number): string {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return '';
  try {
    return String.fromCodePoint(code);
  } catch {
    return '';
  }
}

export function stripHtmlForDisplay(input: string | undefined | null): string {
  if (!input || typeof input !== 'string') return '';

  let s = input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');

  // Decimal numeric refs: &#160; or broken &# 160 ;
  s = s.replace(/&#\s*(\d{1,7})\s*;/g, (_, n) => decodeNumericCode(Number(n)));

  // Hex numeric refs: &#xA0; &#X20;
  s = s.replace(/&#\s*[xX]\s*([0-9a-fA-F]{1,6})\s*;/g, (_, h) =>
    decodeNumericCode(parseInt(h, 16)),
  );

  // Named entities with optional space before `;` (e.g. `&nbsp ;` from bad scrapes)
  s = s.replace(/&([a-zA-Z][a-zA-Z0-9]{0,31})\s*;/g, (_, name: string) => {
    const v = NAMED_ENTITIES[name.toLowerCase()];
    return v !== undefined ? v : '';
  });

  // Empty / broken entity markers: "& ;" "&;"
  s = s.replace(/&\s*;/g, '');

  s = s.replace(/\s+/g, ' ').trim();

  // Strip leading/trailing quote or apostrophe artifacts from partial HTML pulls
  s = s.replace(/^[\s'"“”‘’\u2018\u2019\u201c\u201d]+/, '');
  s = s.replace(/[\s'"“”‘’\u2018\u2019\u201c\u201d]+$/, '');

  // Headline + article body often concatenated after tag strip: "...Our Time The struggle..."
  s = s.replace(/\b(Time)\s+(The\s)/g, '$1. $2');

  return s.replace(/\s+/g, ' ').trim();
}
