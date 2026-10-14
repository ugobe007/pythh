'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildFreshRoundsPdf, freshRoundsPdfFilename, FRESH_ROUNDS_EDITION } = require('../server/lib/freshRoundsPdf');

test('fresh rounds PDF is a single-page %PDF with edition rows', async () => {
  const buf = await buildFreshRoundsPdf();
  assert.equal(buf.slice(0, 5).toString('ascii'), '%PDF-');
  assert.ok(buf.length > 1000);
  assert.equal(freshRoundsPdfFilename(), `pythh-fresh-rounds-${FRESH_ROUNDS_EDITION.slug}.pdf`);
  assert.equal(FRESH_ROUNDS_EDITION.rows.length, 10);

  const PDFDocument = require('pdfkit');
  const orig = PDFDocument.prototype.addPage;
  let adds = 0;
  PDFDocument.prototype.addPage = function addPagePatched(...args) {
    adds += 1;
    return orig.apply(this, args);
  };
  try {
    await buildFreshRoundsPdf();
    assert.equal(adds, 1, 'edition must fit on one page');
  } finally {
    PDFDocument.prototype.addPage = orig;
  }
});
