/**
 * Oracle Email Click Tracking Handler
 * Handles email open tracking and click tracking pixels/links
 * 
 * USAGE:
 * - Email opens: <img src="/api/oracle/email/track/open/{email_send_id}" />
 * - Click links: /api/oracle/email/track/click/{email_send_id}?url={destination}&type={link_type}
 */

// In server/routes/oracle.js - add these endpoints

// ============================================================================
// Email Tracking Endpoints
// ============================================================================

/**
 * GET /api/oracle/email/track/open/:email_send_id
 * 1x1 transparent tracking pixel for email opens
 */
router.get('/email/track/open/:email_send_id', async (req, res) => {
  try {
    const { email_send_id } = req.params;

    // Mark email as opened
    const { error } = await supabase.rpc('mark_oracle_email_opened', {
      p_email_send_id: email_send_id,
    });

    if (error) {
      console.error('[Email Tracking] Open tracking error:', error);
    }

    // Return 1x1 transparent GIF
    const pixel = Buffer.from(
      'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      'base64'
    );
    
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(pixel);
  } catch (error) {
    console.error('[Email Tracking] Open pixel error:', error);
    // Still return pixel on error
    const pixel = Buffer.from(
      'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      'base64'
    );
    res.setHeader('Content-Type', 'image/gif');
    res.send(pixel);
  }
});

/**
 * GET /api/oracle/email/track/click/:email_send_id
 * Click tracking + redirect
 */
router.get('/email/track/click/:email_send_id', async (req, res) => {
  try {
    const { email_send_id } = req.params;
    const { url, type, label } = req.query;

    if (!url) {
      return res.status(400).json({ error: 'Missing url parameter' });
    }

    // Record click
    await supabase.rpc('record_oracle_email_click', {
      p_email_send_id: email_send_id,
      p_link_url: url,
      p_link_type: type || null,
      p_link_label: label || null,
    });

    // Redirect to destination
    res.redirect(url);
  } catch (error) {
    console.error('[Email Tracking] Click tracking error:', error);
    // Redirect anyway
    res.redirect(req.query.url || '/app/oracle/dashboard');
  }
});

/**
 * GET /api/oracle/email/analytics/:user_id
 * Get email engagement analytics for user (admin/self only)
 */
router.get('/email/analytics/:user_id', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    const { user_id } = req.params;

    // Only allow viewing own analytics (or admin)
    if (user.id !== user_id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Fetch email sends
    const { data: sends, error: sendsError } = await supabase
      .from('oracle_email_sends')
      .select('*')
      .eq('user_id', user_id)
      .order('sent_at', { ascending: false })
      .limit(50);

    if (sendsError) throw sendsError;

    // Calculate aggregate stats
    const totalSent = sends.length;
    const totalOpened = sends.filter(s => s.opened_at).length;
    const totalClicked = sends.filter(s => s.first_click_at).length;
    const openRate = totalSent > 0 ? (totalOpened / totalSent) * 100 : 0;
    const clickRate = totalSent > 0 ? (totalClicked / totalSent) * 100 : 0;

    // Fetch recent clicks
    const { data: clicks, error: clicksError } = await supabase
      .from('oracle_email_clicks')
      .select('*')
      .eq('user_id', user_id)
      .order('clicked_at', { ascending: false })
      .limit(20);

    if (clicksError) throw clicksError;

    res.json({
      stats: {
        totalSent,
        totalOpened,
        totalClicked,
        openRate: Math.round(openRate * 10) / 10,
        clickRate: Math.round(clickRate * 10) / 10,
      },
      recentSends: sends.slice(0, 10),
      recentClicks: clicks,
    });
  } catch (error) {
    console.error('[Email Analytics] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/oracle/email/a-b-test
 * Create or update A/B test campaign
 */
router.post('/email/a-b-test', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    const {
      name,
      variant_a_subject,
      variant_b_subject,
      description,
    } = req.body;

    // Create campaign
    const { data: campaign, error } = await supabase
      .from('oracle_email_campaigns')
      .insert({
        name,
        campaign_type: 'ab_test',
        description: description || null,
        variant_a_subject,
        variant_b_subject,
        status: 'active',
      })
      .select()
      .single();

    if (error) {
      console.error('[Email A/B Test] Create error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ campaign });
  } catch (error) {
    console.error('[Email A/B Test] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/oracle/email/a-b-test/:campaign_id/results
 * Get A/B test results
 */
router.get('/email/a-b-test/:campaign_id/results', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    const { campaign_id } = req.params;

    // Fetch campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('oracle_email_campaigns')
      .select('*')
      .eq('id', campaign_id)
      .single();

    if (campaignError) throw campaignError;

    // Fetch sends by variant
    const { data: sends, error: sendsError } = await supabase
      .from('oracle_email_sends')
      .select('*')
      .eq('campaign_id', campaign_id);

    if (sendsError) throw sendsError;

    // Calculate variant performance
    const variantA = sends.filter(s => s.template_variant === 'a');
    const variantB = sends.filter(s => s.template_variant === 'b');

    const variantAStats = {
      sent: variantA.length,
      opened: variantA.filter(s => s.opened_at).length,
      clicked: variantA.filter(s => s.first_click_at).length,
      openRate: variantA.length > 0 ? (variantA.filter(s => s.opened_at).length / variantA.length) * 100 : 0,
      clickRate: variantA.length > 0 ? (variantA.filter(s => s.first_click_at).length / variantA.length) * 100 : 0,
    };

    const variantBStats = {
      sent: variantB.length,
      opened: variantB.filter(s => s.opened_at).length,
      clicked: variantB.filter(s => s.first_click_at).length,
      openRate: variantB.length > 0 ? (variantB.filter(s => s.opened_at).length / variantB.length) * 100 : 0,
      clickRate: variantB.length > 0 ? (variantB.filter(s => s.first_click_at).length / variantB.length) * 100 : 0,
    };

    // Determine winner (based on open rate + click rate)
    const variantAScore = variantAStats.openRate + (variantAStats.clickRate * 2);
    const variantBScore = variantBStats.openRate + (variantBStats.clickRate * 2);
    const winner = variantAScore > variantBScore ? 'a' : variantBScore > variantAScore ? 'b' : 'tie';

    res.json({
      campaign,
      variantA: variantAStats,
      variantB: variantBStats,
      winner,
      confidence: Math.abs(variantAScore - variantBScore) / Math.max(variantAScore, variantBScore, 1),
    });
  } catch (error) {
    console.error('[Email A/B Test Results] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// Email Template Helpers (with tracking links)
// ============================================================================

/**
 * Generate trackable link for email
 */
function generateTrackableLink(emailSendId, destinationUrl, linkType, linkLabel) {
  const baseUrl = process.env.APP_URL || 'https://hot-honey.fly.dev';
  const trackingUrl = `${baseUrl}/api/oracle/email/track/click/${emailSendId}`;
  const params = new URLSearchParams({
    url: destinationUrl,
    type: linkType,
    label: linkLabel,
  });
  return `${trackingUrl}?${params.toString()}`;
}

/**
 * Generate tracking pixel for email
 */
function generateTrackingPixel(emailSendId) {
  const baseUrl = process.env.APP_URL || 'https://hot-honey.fly.dev';
  return `${baseUrl}/api/oracle/email/track/open/${emailSendId}`;
}

/**
 * Example email template with tracking
 */
function buildEmailWithTracking(emailSendId, content) {
  const trackingPixelUrl = generateTrackingPixel(emailSendId);
  const dashboardUrl = generateTrackableLink(
    emailSendId,
    'https://hot-honey.fly.dev/app/oracle/dashboard',
    'cta',
    'View Oracle Dashboard'
  );

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background: #000;">
  ${content}
  
  <!-- Main CTA with tracking -->
  <a href="${dashboardUrl}" 
     style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; padding: 14px 32px; border-radius: 12px; text-decoration: none; 
            font-weight: 600;">
    View Oracle Dashboard →
  </a>
  
  <!-- Tracking pixel (invisible) -->
  <img src="${trackingPixelUrl}" width="1" height="1" alt="" style="display: block;" />
</body>
</html>
  `;
}

module.exports = {
  generateTrackableLink,
  generateTrackingPixel,
  buildEmailWithTracking,
};
