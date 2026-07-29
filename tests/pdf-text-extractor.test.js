'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { extractPdfText } = require('../server/lib/pdfTextExtractor');

describe('extractPdfText', () => {
  it('extracts text using the pdf-parse v2 class API', async () => {
    const fixture = path.join(__dirname, '..', 'Ontologies_Startups_Investors.pdf');
    const text = await extractPdfText(fs.readFileSync(fixture));
    assert.ok(text.length > 100);
  });

  it('rejects an empty upload before constructing the parser', async () => {
    await assert.rejects(() => extractPdfText(Buffer.alloc(0)), /non-empty PDF buffer/);
  });
});
