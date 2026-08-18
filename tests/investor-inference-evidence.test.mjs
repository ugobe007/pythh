import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  articleMentionsInvestorInvestment,
  eligibleInvestorEvidenceArticles,
  extractExplicitCheckSizeRange,
  extractInvestorDataFromArticles,
  extractPortfolioCompanies,
} = require('../server/services/investorInferenceService.js');

test('requires the target investor and investment context before using an article', () => {
  const investor = { name: 'Acme Ventures', firm: 'Acme Ventures' };
  assert.equal(articleMentionsInvestorInvestment({ title: 'Acme Ventures invests in Nova' }, investor), true);
  assert.equal(articleMentionsInvestorInvestment({ title: 'Nova raises a $30M round' }, investor), false);
  assert.equal(articleMentionsInvestorInvestment({ title: 'Acme Ventures opens a new office' }, investor), false);
});

test('extracts only explicit check or ticket sizes, never ordinary round amounts', () => {
  assert.deepEqual(extractExplicitCheckSizeRange('Typical check sizes range from $500K to $2M.'), {
    min: 500_000,
    max: 2_000_000,
    evidence: 'check sizes range from $500K to $2M',
  });
  assert.equal(extractExplicitCheckSizeRange('Acme led Nova’s $30M Series B round.'), null);
});

test('accepts one reviewed source or two independent unreviewed publishers', () => {
  const investor = { name: 'Acme Ventures', firm: 'Acme Ventures' };
  const trusted = [{ title: 'Acme Ventures invests in Nova - Reuters', link: 'https://news.google.com/article/1' }];
  assert.equal(eligibleInvestorEvidenceArticles(trusted, investor).length, 1);

  const oneUnreviewed = [{ title: 'Acme Ventures invests in Nova - Local Tech', link: 'https://news.google.com/article/2' }];
  assert.equal(eligibleInvestorEvidenceArticles(oneUnreviewed, investor).length, 0);

  const corroborated = [
    ...oneUnreviewed,
    { title: 'Acme Ventures backs Nova - Venture Daily', link: 'https://news.google.com/article/3' },
  ];
  assert.equal(eligibleInvestorEvidenceArticles(corroborated, investor).length, 2);
});

test('portfolio extraction requires the target investor to be an explicit participant', () => {
  const investor = { name: 'Acme Ventures', firm: 'Acme Ventures' };
  const articles = [
    { title: 'Acme Ventures invests in Nova', content: '' },
    { title: 'Other Capital invests in Orbit', content: 'Acme Ventures was mentioned elsewhere.' },
  ];
  assert.deepEqual(extractPortfolioCompanies(articles, investor), ['Nova']);
});

test('does not convert a funding round amount or news prose into check size or thesis', () => {
  const investor = {
    name: 'Acme Ventures', firm: 'Acme Ventures', sectors: [], stage: [],
    check_size_min: null, check_size_max: null, portfolio_companies: [],
    investment_thesis: null, bio: null, geography_focus: [],
  };
  const { enrichedData } = extractInvestorDataFromArticles([
    { title: 'Acme Ventures leads Nova’s $30M Series A', content: 'The AI startup is based in New York.', link: 'https://example.com' },
  ], investor);
  assert.equal(enrichedData.check_size_min, undefined);
  assert.equal(enrichedData.check_size_max, undefined);
  assert.equal(enrichedData.inferred_bio, undefined);
  assert.equal(enrichedData.investment_thesis, undefined);
});
