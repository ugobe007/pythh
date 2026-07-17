import { describe, it, expect } from 'vitest';
import { normalizeWhyYouMatch } from './lib/normalizeWhyYouMatch';

describe('normalizeWhyYouMatch', () => {
  it('joins string arrays from the database', () => {
    expect(normalizeWhyYouMatch(['Stage match', 'Sector fit'])).toBe('Stage match · Sector fit');
  });

  it('passes through plain strings', () => {
    expect(normalizeWhyYouMatch('Suggested for preview')).toBe('Suggested for preview');
  });

  it('handles null and empty', () => {
    expect(normalizeWhyYouMatch(null)).toBe('');
    expect(normalizeWhyYouMatch([])).toBe('');
  });
});
