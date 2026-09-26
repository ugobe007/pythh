'use strict';

const path = require('path');

const BUCKET = 'founder-media';
const MAX_VIDEOS = 8;
const DECK_MAX_BYTES = 25 * 1024 * 1024;
const VIDEO_MAX_BYTES = 100 * 1024 * 1024;

const DECK_EXT = new Set(['.pdf', '.ppt', '.pptx']);
const VIDEO_EXT = new Set(['.mp4', '.webm', '.mov']);

const DECK_MIME = new Set([
  'application/pdf',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);
const VIDEO_MIME = new Set(['video/mp4', 'video/webm', 'video/quicktime']);

function baseMime(mimeType) {
  return String(mimeType || '').split(';')[0].trim().toLowerCase();
}

function kindFromExt(ext) {
  if (DECK_EXT.has(ext)) return 'deck';
  if (VIDEO_EXT.has(ext)) return 'video';
  return null;
}

function kindFromMime(mime) {
  if (DECK_MIME.has(mime)) return 'deck';
  if (VIDEO_MIME.has(mime)) return 'video';
  return null;
}

const MIME_BY_EXT = {
  '.pdf': 'application/pdf',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
};

function defaultExt(kind, mime) {
  if (kind === 'deck') {
    if (mime === 'application/vnd.ms-powerpoint') return '.ppt';
    if (mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') return '.pptx';
    return '.pdf';
  }
  if (mime === 'video/webm') return '.webm';
  if (mime === 'video/quicktime') return '.mov';
  return '.mp4';
}

/**
 * Classify a founder upload. Extension wins when the browser sends a generic mime.
 * A deck extension with a video mime (or the reverse) is rejected.
 */
function classifyUpload({ fileName, mimeType }) {
  const ext = path.extname(String(fileName || '')).toLowerCase();
  const mime = baseMime(mimeType);
  const genericMime = !mime || mime === 'application/octet-stream';
  const extKind = kindFromExt(ext);
  const mimeKind = genericMime ? null : kindFromMime(mime);

  if (ext && !extKind) {
    return { error: 'Upload a deck (PDF, PPT, PPTX) or a video (MP4, WEBM, MOV).' };
  }
  if (extKind && mimeKind && extKind !== mimeKind) {
    return { error: 'That file type does not match its extension.' };
  }
  const kind = extKind || mimeKind;
  if (!kind) {
    return { error: 'Upload a deck (PDF, PPT, PPTX) or a video (MP4, WEBM, MOV).' };
  }
  const resolvedExt = extKind ? ext : defaultExt(kind, mime);
  return {
    kind,
    ext: resolvedExt,
    mime: mimeKind ? mime : (MIME_BY_EXT[resolvedExt] || (kind === 'deck' ? 'application/pdf' : 'video/mp4')),
  };
}

function maxBytes(kind) {
  return kind === 'video' ? VIDEO_MAX_BYTES : DECK_MAX_BYTES;
}

function safeFileName(fileName, ext) {
  const base = path.basename(String(fileName || 'file'), path.extname(String(fileName || '')));
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 60);
  const stem = cleaned || 'file';
  const suffix = ext && ext.startsWith('.') ? ext : '';
  return `${stem}${suffix}`;
}

function buildStoragePath(userId, kind, fileName) {
  const classified = classifyUpload({ fileName, mimeType: '' });
  const ext = classified.ext || (kind === 'video' ? '.mp4' : '.pdf');
  const safe = safeFileName(fileName, ext);
  return `users/${userId}/${kind}/${Date.now()}-${safe}`;
}

function parseOwnedPath(userId, storagePath) {
  const value = String(storagePath || '');
  if (value.includes('..') || value.includes('\\')) return null;
  const match = value.match(/^users\/(\d+)\/(deck|video)\/(\d{10,16})-([a-zA-Z0-9._-]{1,80})$/);
  if (!match) return null;
  if (Number(match[1]) !== Number(userId)) return null;
  return { path: value, kind: match[2], fileName: match[4] };
}

module.exports = {
  BUCKET,
  MAX_VIDEOS,
  DECK_MAX_BYTES,
  VIDEO_MAX_BYTES,
  classifyUpload,
  maxBytes,
  safeFileName,
  buildStoragePath,
  parseOwnedPath,
};
