'use strict';

/**
 * Render the Fresh Rounds edition as a black editorial PDF (pdfkit).
 * Compact single-page layout matching /rounds.
 */

const PDFDocument = require('pdfkit');
const { FRESH_ROUNDS_EDITION } = require('../../lib/freshRoundsEdition');

const BLACK = '#000000';
const WHITE = '#ffffff';
const DIM = '#8c8c8c';
const RULE = '#2a2a2a';
const FOOT = '#616161';

/**
 * Absolute-positioned text that must not paginate.
 * pdfkit's default text flow continues onto a new page when y exceeds the
 * bottom margin — we draw within a clipped height so the edition stays one page.
 */
function paint(doc, str, x, y, opts = {}) {
  const { width, align, font, size, color, characterSpacing } = opts;
  if (font) doc.font(font);
  if (size != null) doc.fontSize(size);
  if (color) doc.fillColor(color);
  doc.text(str, x, y, {
    width,
    align,
    characterSpacing,
    lineBreak: false,
    ellipsis: true,
    height: (size || 12) + 2,
  });
}

/**
 * @param {typeof FRESH_ROUNDS_EDITION} [edition]
 * @returns {Promise<Buffer>}
 */
function buildFreshRoundsPdf(edition = FRESH_ROUNDS_EDITION) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      autoFirstPage: true,
      info: {
        Title: `${edition.masthead} — ${edition.title}`,
        Author: 'Pythh.ai',
        Subject: edition.subtitle,
      },
    });

    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageW = doc.page.width;
    const pageH = doc.page.height;
    const left = 48;
    const right = pageW - 48;
    const contentW = right - left;
    const ROW_H = 36;

    doc.rect(0, 0, pageW, pageH).fill(BLACK);

    let y = 48;
    paint(doc, edition.masthead, left, y, {
      font: 'Helvetica-Bold',
      size: 10,
      color: WHITE,
      characterSpacing: 2,
      width: contentW,
    });
    y += 16;
    paint(doc, edition.dateLabel, left, y, {
      font: 'Helvetica',
      size: 8,
      color: DIM,
      characterSpacing: 1.2,
      width: contentW,
    });
    y += 24;

    paint(doc, edition.title, left, y, {
      font: 'Helvetica-Bold',
      size: 48,
      color: WHITE,
      width: contentW,
    });
    y += 54;

    paint(doc, edition.subtitle, left, y, {
      font: 'Helvetica',
      size: 10,
      color: DIM,
      width: contentW,
    });
    y += 20;

    doc.moveTo(left, y).lineTo(right, y).strokeColor(RULE).lineWidth(0.8).stroke();
    y += 10;

    const idxW = 26;
    const amountColW = 70;
    const nameColX = left + idxW;
    const nameColW = contentW - idxW - amountColW - 10;
    const amountColX = right - amountColW;

    for (let i = 0; i < edition.rows.length; i++) {
      const row = edition.rows[i];
      const rowTop = y;
      const idx = String(i + 1).padStart(2, '0');

      paint(doc, idx, left, rowTop + 3, {
        font: 'Helvetica',
        size: 8,
        color: DIM,
        width: idxW,
      });
      paint(doc, row.name, nameColX, rowTop, {
        font: 'Helvetica-Bold',
        size: 13,
        color: WHITE,
        width: nameColW,
      });
      paint(doc, row.line, nameColX, rowTop + 16, {
        font: 'Helvetica',
        size: 8,
        color: DIM,
        width: nameColW,
      });
      paint(doc, row.amount, amountColX, rowTop, {
        font: 'Helvetica-Bold',
        size: 13,
        color: WHITE,
        width: amountColW,
        align: 'right',
      });
      paint(doc, row.investor, amountColX, rowTop + 16, {
        font: 'Helvetica',
        size: 8,
        color: DIM,
        width: amountColW,
        align: 'right',
      });

      y = rowTop + ROW_H;
      doc.moveTo(left, y).lineTo(right, y).strokeColor(RULE).lineWidth(0.6).stroke();
      y += 6;
    }

    y += 8;
    paint(doc, edition.masthead, left, y, {
      font: 'Helvetica-Bold',
      size: 8,
      color: DIM,
      characterSpacing: 1.4,
      width: contentW,
    });
    y += 14;
    paint(doc, edition.cadence, left, y, {
      font: 'Helvetica',
      size: 9,
      color: DIM,
      width: contentW,
    });
    y += 14;
    // Footnote may wrap — give it a bounded height so it cannot spawn a page.
    doc.font('Helvetica').fontSize(8).fillColor(FOOT);
    doc.text(edition.footnote, left, y, {
      width: Math.min(contentW, 430),
      height: 36,
      ellipsis: true,
    });

    paint(doc, 'pythh.ai/rounds', left, pageH - 32, {
      font: 'Helvetica',
      size: 8,
      color: DIM,
      width: contentW,
    });

    doc.end();
  });
}

function freshRoundsPdfFilename(edition = FRESH_ROUNDS_EDITION) {
  return `pythh-fresh-rounds-${edition.slug}.pdf`;
}

module.exports = {
  buildFreshRoundsPdf,
  freshRoundsPdfFilename,
  FRESH_ROUNDS_EDITION,
};
