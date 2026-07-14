'use strict';

/**
 * Shared Peter founder-outreach helpers (dedup, first-contact detection).
 */

async function isFirstPeterFounderContact(db, email) {
  if (!db || !email) return true;
  const normalized = String(email).trim().toLowerCase();
  if (!normalized) return true;

  const { count, error } = await db
    .from('pythh_prospecting_log')
    .select('*', { count: 'exact', head: true })
    .eq('email', normalized)
    .eq('email_type', 'startup_matches')
    .eq('status', 'sent');

  if (error) return true;
  return (count ?? 0) === 0;
}

module.exports = {
  isFirstPeterFounderContact,
};
