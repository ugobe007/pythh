'use strict';

/**
 * POST /api/admin/targeted-match
 * Body: { url, limit?, force? }
 *
 * Auth: x-admin-key (ADMIN_KEY) OR session cookie with admin/owner role
 * (same owner-email list as tRPC adminProcedure).
 */

const express = require('express');
const { runAdminTargetedMatch, MAX_LIMIT } = require('../lib/runAdminTargetedMatch');

const router = express.Router();

function ownerEmails() {
  return String(process.env.OWNER_EMAILS || 'ugobe07@gmail.com')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function adminKeyOk(req) {
  const key = req.headers['x-admin-key'] || req.query?.admin_key;
  return !!(key && process.env.ADMIN_KEY && key === process.env.ADMIN_KEY);
}

async function sessionIsAdmin(req) {
  // Populated by Express session / oauth middleware when present
  const user = req.user || req.session?.user || null;
  if (!user) return false;
  if (user.role === 'admin') return true;
  const email = String(user.email || '').trim().toLowerCase();
  return email && ownerEmails().includes(email);
}

router.post('/targeted-match', async (req, res) => {
  try {
    const allowed = adminKeyOk(req) || (await sessionIsAdmin(req));
    if (!allowed) {
      return res.status(403).json({ error: 'Admin only' });
    }
    const url = String(req.body?.url || '').trim();
    if (!url) return res.status(400).json({ error: 'URL is required' });
    const limit = req.body?.limit;
    const force = req.body?.force !== false;
    const useHunter = req.body?.useHunter !== false && req.body?.use_hunter !== false;
    const validateHunter = req.body?.validateHunter === true || req.body?.validate_hunter === true;
    const persistContacts = req.body?.persistContacts !== false && req.body?.persist_contacts !== false;
    const result = await runAdminTargetedMatch({
      url,
      limit,
      force,
      useHunter,
      validateHunter,
      persistContacts,
    });
    return res.json(result);
  } catch (err) {
    const status = Number(err?.status) || 500;
    console.error('[admin/targeted-match]', err?.message || err);
    return res.status(status).json({
      error: err?.message || 'Targeted match failed',
      max_limit: MAX_LIMIT,
    });
  }
});

module.exports = router;
