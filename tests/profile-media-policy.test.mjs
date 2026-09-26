import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const {
  classifyUpload,
  maxBytes,
  parseOwnedPath,
  buildStoragePath,
  DECK_MAX_BYTES,
  VIDEO_MAX_BYTES,
  MAX_VIDEOS,
} = require('../server/lib/profileMediaPolicy.js');

test('classify accepts decks and videos and rejects mismatches', () => {
  assert.equal(classifyUpload({ fileName: 'Pythh Deck.pdf', mimeType: 'application/pdf' }).kind, 'deck');
  assert.equal(
    classifyUpload({ fileName: 'deck.pptx', mimeType: '' }).mime,
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  );
  assert.equal(classifyUpload({ fileName: 'demo.mov', mimeType: 'video/quicktime' }).kind, 'video');
  assert.equal(classifyUpload({ fileName: 'clip.mp4', mimeType: 'application/octet-stream' }).kind, 'video');
  assert.ok(classifyUpload({ fileName: 'notes.docx', mimeType: 'application/pdf' }).error);
  assert.ok(classifyUpload({ fileName: 'deck.pdf', mimeType: 'video/mp4' }).error);
  assert.equal(maxBytes('deck'), DECK_MAX_BYTES);
  assert.equal(maxBytes('video'), VIDEO_MAX_BYTES);
  assert.equal(MAX_VIDEOS, 8);
});

test('storage paths stay inside the signed-in user folder', () => {
  const path = buildStoragePath(42, 'deck', 'My Deck (final).pdf');
  const owned = parseOwnedPath(42, path);
  assert.ok(owned);
  assert.equal(owned.kind, 'deck');
  assert.equal(parseOwnedPath(7, path), null);
  assert.equal(parseOwnedPath(42, 'users/42/deck/../../etc/passwd'), null);
  assert.equal(parseOwnedPath(42, 'users/42/other/1-file.pdf'), null);
});
