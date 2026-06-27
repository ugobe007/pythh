'use strict';

const PDFDocument = require('pdfkit');

async function fetchBuffer(url) {
  if (!url) return null;
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Failed to fetch asset (${res.status})`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

function mimeForFormat(format) {
  switch (format) {
    case 'pdf':
      return 'application/pdf';
    case 'svg':
      return 'image/svg+xml';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    default:
      return 'application/octet-stream';
  }
}

function extensionForFormat(format) {
  if (format === 'jpeg') return 'jpg';
  return format;
}

function renderPdfPages(doc, edition, W, EMERALD, GOLD, DARK, MUTED, WHITE, imgBuf) {
  const copy = edition.copy || {};
  const title = copy.title || `Signal Art · ${edition.edition_date}`;

  const drawBg = () => {
    doc.rect(0, 0, doc.page.width, doc.page.height).fill(DARK);
  };

  const drawFooter = () => {
    doc
      .fontSize(8)
      .fillColor(MUTED)
      .text(`pythh.ai — Signal Art · ${edition.edition_date}`, 64, doc.page.height - 40, {
        width: W - 128,
        align: 'left',
      });
  };

  drawBg();
  doc.rect(0, 0, 5, doc.page.height).fill(EMERALD);
  doc.fontSize(10).fillColor(EMERALD).font('Helvetica-Bold').text('PYTHH SIGNAL ART', 80, 72);
  doc.fontSize(28).fillColor(WHITE).font('Helvetica-Bold').text(title, 80, 96, { width: W - 160 });
  if (copy.subtitle) {
    doc.fontSize(12).fillColor(MUTED).font('Helvetica').text(copy.subtitle, 80, doc.y + 10, { width: W - 160 });
  }
  doc
    .fontSize(9)
    .fillColor(GOLD)
    .text(`Edition ${edition.edition_date} · seed ${edition.seed}`, 80, doc.y + 14, { width: W - 160 });
  drawFooter();

  doc.addPage();
  drawBg();
  doc.rect(0, 0, 5, doc.page.height).fill(EMERALD);
  doc.fontSize(11).fillColor(EMERALD).font('Helvetica-Bold').text('Composition', 80, 72);

  const artTop = 100;
  const artSize = Math.min(W - 160, 420);
  const artLeft = (W - artSize) / 2;

  if (imgBuf) {
    doc.image(imgBuf, artLeft, artTop, { fit: [artSize, artSize], align: 'center' });
  } else if (edition.svg) {
    doc
      .fontSize(9)
      .fillColor(MUTED)
      .font('Helvetica')
      .text('Vector edition — download SVG for full resolution.', 80, artTop, { width: W - 160 });
  } else {
    doc
      .fontSize(9)
      .fillColor(MUTED)
      .text('Artwork preview unavailable — use PNG or SVG download.', 80, artTop, { width: W - 160 });
  }

  doc.addPage();
  drawBg();
  doc.rect(0, 0, 5, doc.page.height).fill(EMERALD);
  doc.fontSize(11).fillColor(EMERALD).font('Helvetica-Bold').text('What PYTHH saw', 80, 72);
  doc
    .fontSize(10)
    .fillColor(WHITE)
    .font('Helvetica')
    .text(copy.process || '', 80, 96, { width: W - 160, lineGap: 4 });

  doc.fontSize(11).fillColor(EMERALD).font('Helvetica-Bold').text('Philosophy', 80, doc.y + 20);
  doc
    .fontSize(10)
    .fillColor(MUTED)
    .font('Helvetica')
    .text(copy.philosophy || '', 80, doc.y + 8, { width: W - 160, lineGap: 4 });

  if (copy.introspection) {
    doc.fontSize(11).fillColor(GOLD).font('Helvetica-Bold').text('Introspection', 80, doc.y + 20);
    doc
      .fontSize(11)
      .fillColor(WHITE)
      .font('Helvetica-Oblique')
      .text(`"${copy.introspection}"`, 80, doc.y + 8, { width: W - 160, lineGap: 4 });
  }
  drawFooter();

  if (Array.isArray(copy.legend) && copy.legend.length) {
    doc.addPage();
    drawBg();
    doc.rect(0, 0, 5, doc.page.height).fill(EMERALD);
    doc.fontSize(11).fillColor(EMERALD).font('Helvetica-Bold').text('Signal legend', 80, 72);
    let y = 96;
    copy.legend.slice(0, 12).forEach((item) => {
      doc.fontSize(9).fillColor(MUTED).font('Helvetica').text(item.label || '', 80, y);
      doc.fontSize(10).fillColor(WHITE).font('Helvetica-Bold').text(item.value || '', 80, y + 12);
      y += 36;
    });
    drawFooter();
  }
}

/**
 * Branded PDF — cover, artwork page, PYTHIA artist statement, legend.
 */
async function buildArtEditionPdf(edition) {
  let imgBuf = null;
  if (edition.raster_url) {
    try {
      imgBuf = await fetchBuffer(edition.raster_url);
    } catch {
      imgBuf = null;
    }
  }

  const chunks = [];
  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 56, bottom: 56, left: 64, right: 64 },
      info: {
        Title: edition.copy?.title || `Signal Art · ${edition.edition_date}`,
        Author: 'PYTHH — pythh.ai',
        Subject: `Pythh Signal Art edition ${edition.edition_date}`,
      },
    });

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', resolve);
    doc.on('error', reject);

    try {
      renderPdfPages(doc, edition, doc.page.width, '#10b981', '#f59e0b', '#050508', '#9ca3af', '#ffffff', imgBuf);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });

  return Buffer.concat(chunks);
}

async function buildArtDownload(edition, format) {
  const fmt = String(format || 'pdf').toLowerCase();
  const baseName = `pythh-signal-art-${edition.edition_date}`;

  if (fmt === 'pdf') {
    const buffer = await buildArtEditionPdf(edition);
    return {
      buffer,
      filename: `${baseName}.pdf`,
      mimeType: mimeForFormat('pdf'),
    };
  }

  if (fmt === 'svg') {
    const svg = edition.svg || '';
    if (!svg.trim()) throw new Error('SVG not available for this edition');
    return {
      buffer: Buffer.from(svg, 'utf8'),
      filename: `${baseName}.svg`,
      mimeType: mimeForFormat('svg'),
    };
  }

  if (fmt === 'png' || fmt === 'jpg' || fmt === 'jpeg') {
    const ext = fmt === 'jpeg' ? 'jpg' : fmt;
    const rasterUrl = edition.raster_url;
    if (!rasterUrl) throw new Error('Raster image not available — try SVG or PDF');
    const buffer = await fetchBuffer(rasterUrl);
    return {
      buffer,
      filename: `${baseName}.${ext}`,
      mimeType: mimeForFormat(fmt),
    };
  }

  throw new Error(`Unsupported format: ${format}`);
}

module.exports = {
  buildArtEditionPdf,
  buildArtDownload,
  mimeForFormat,
  extensionForFormat,
};
