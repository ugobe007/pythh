/**
 * Cursor pagination helpers for agent feeds
 * 
 * Cursor format: base64(created_at|id)
 * This provides stable, offset-free pagination that doesn't drift
 * when new items are inserted.
 */

/**
 * Encode a cursor from created_at timestamp and id
 * @param {string} createdAt - ISO timestamp
 * @param {string} id - UUID
 * @returns {string} Base64 encoded cursor
 */
function encodeCursor(createdAt, id) {
  if (!createdAt || !id) return null;
  return Buffer.from(`${createdAt}|${id}`, 'utf8').toString('base64');
}

/**
 * Decode a cursor back to created_at and id
 * @param {string} cursor - Base64 encoded cursor
 * @returns {{ created_at: string, id: string } | null}
 */
function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    const raw = Buffer.from(cursor, 'base64').toString('utf8');
    const pipeIndex = raw.indexOf('|');
    if (pipeIndex === -1) return null;
    
    const created_at = raw.substring(0, pipeIndex);
    const id = raw.substring(pipeIndex + 1);
    
    if (!created_at || !id) return null;
    
    // Validate created_at looks like a timestamp
    if (isNaN(Date.parse(created_at))) return null;
    
    // Validate id looks like a UUID (basic check)
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    
    return { created_at, id };
  } catch {
    return null;
  }
}

module.exports = { encodeCursor, decodeCursor };
