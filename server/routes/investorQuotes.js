'use strict';

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { loadInvestorQuotes } = require('../../lib/investorQuotes');

const router = express.Router();

function supabase() {
  return createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

router.get('/investor-quotes', async (req, res) => {
  try {
    const quotes = await loadInvestorQuotes(supabase(), { limit: req.query.limit });
    res.set('Cache-Control', 'public, max-age=300');
    res.json({ quotes });
  } catch (err) {
    res.status(500).json({ error: 'investor_quotes_unavailable', quotes: [] });
  }
});

module.exports = router;
