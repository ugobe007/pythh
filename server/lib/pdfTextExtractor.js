'use strict';

const { PDFParse } = require('pdf-parse');

async function extractPdfText(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new TypeError('A non-empty PDF buffer is required');
  }

  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return String(result?.text || '').trim();
  } finally {
    await parser.destroy();
  }
}

module.exports = { extractPdfText };
