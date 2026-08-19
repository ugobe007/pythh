'use strict';

async function extractPdfText(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new TypeError('A non-empty PDF buffer is required');
  }

  // pdf-parse loads native canvas/font dependencies. Keep them off the server
  // startup path and pay that cost only when a founder uploads a deck.
  const { PDFParse } = require('pdf-parse');
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return String(result?.text || '').trim();
  } finally {
    await parser.destroy();
  }
}

module.exports = { extractPdfText };
