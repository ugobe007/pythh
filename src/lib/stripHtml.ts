/**
 * Strip HTML tags and collapse whitespace for plain-text UI.
 * Scraped descriptions often include raw markup — never render as HTML unsanitized.
 */
export function stripHtmlForDisplay(input: string | undefined | null): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return code === 160 ? ' ' : '';
    })
    .replace(/&[a-z]{2,10};/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
