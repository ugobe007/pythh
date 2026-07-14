'use strict';

const express = require('express');
const router = express.Router();
const { getSupabaseClient } = require('../lib/supabaseClient');
const { isValidEmail, sendPeterIntroConcierge } = require('../lib/peterIntroConcierge');

/**
 * POST /api/intro/concierge
 * Peter intro help — thesis framing + warm-intro bridge (no signup required).
 *
 * Body: {
 *   email, startup_id, startup_name?, startup_url?,
 *   investor_id?, investor_name?, investor_firm?,
 *   note?, source?
 * }
 */
router.post('/concierge', async (req, res) => {
  try {
    const body = req.body || {};
    const email = String(body.email || '').trim().toLowerCase();
    const startupId = body.startup_id;
    const startupName = String(body.startup_name || 'your startup').trim();
    const startupUrl = body.startup_url ? String(body.startup_url).trim() : null;
    const note = body.note ? String(body.note).trim().slice(0, 2000) : '';
    const source = body.source ? String(body.source).slice(0, 64) : 'preview';

    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, error: 'Valid email required' });
    }
    if (!startupId) {
      return res.status(400).json({ success: false, error: 'startup_id required' });
    }

    const investor =
      body.investor_id || body.investor_name
        ? {
            id: body.investor_id || null,
            name: body.investor_name || null,
            firm: body.investor_firm || null,
          }
        : null;

    const supabase = getSupabaseClient();
    const result = await sendPeterIntroConcierge({
      supabase,
      founderEmail: email,
      startupId,
      startupName,
      startupUrl,
      investor,
      note,
      source,
    });

    if (!result.success) {
      const status = result.step === 'team_notify' ? 502 : 502;
      return res.status(status).json({ success: false, error: result.error || 'Send failed' });
    }

    res.json({
      success: true,
      message: 'Peter will reply within 2 business days with why this match surfaced and how to frame it.',
    });
  } catch (err) {
    console.error('[intro/concierge]', err);
    res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

module.exports = router;
