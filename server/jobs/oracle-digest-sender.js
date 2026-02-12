/**
 * Oracle Email Digest Sender
 * Runs every Monday at 9am to send weekly digest emails
 * 
 * WHAT IT DOES:
 * 1. Finds users due for weekly digest (based on oracle_digest_schedule)
 * 2. Fetches their fresh insights from yesterday's refresh
 * 3. Sends personalized email via Resend
 * 4. Tracks delivery and updates schedule
 * 
 * SCHEDULE: Monday 9am (day after Sunday 8pm refresh)
 * EXPECTED IMPACT: 45% open rate, 15% click-through rate
 */

// Load environment variables
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

// Initialize clients
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://unkpogyhhjbvxxjvmxlt.supabase.co',
  process.env.SUPABASE_SERVICE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Main digest sender job
 */
async function sendWeeklyDigests() {
  console.log('\n📧 Oracle Email Digest Sender - Starting...');
  console.log(`Time: ${new Date().toISOString()}`);

  try {
    // Step 1: Find users due for digest
    const eligibleUsers = await findEligibleUsers();
    console.log(`📊 Found ${eligibleUsers.length} users due for digest`);

    if (eligibleUsers.length === 0) {
      console.log('✅ No digests to send - job complete');
      return;
    }

    // Step 2: Send digest to each user
    let successCount = 0;
    let failCount = 0;

    for (const user of eligibleUsers) {
      try {
        await sendDigestToUser(user);
        successCount++;
        console.log(`✅ [${successCount}/${eligibleUsers.length}] Sent digest to ${user.email}`);
      } catch (error) {
        failCount++;
        console.error(`❌ Failed to send digest to ${user.email}:`, error.message);
      }

      // Rate limiting: 1 second between emails
      await sleep(1000);
    }

    // Step 3: Summary
    console.log('\n📊 Digest Sending Complete:');
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    console.log(`   📬 Total emails sent: ${successCount}`);

  } catch (error) {
    console.error('❌ Digest sender job failed:', error);
    throw error;
  }
}

/**
 * Find users eligible for digest
 * Criteria:
 * - oracle_digest_schedule.enabled = true
 * - next_scheduled_at <= now OR last_sent_at is null
 * - Has completed Oracle session
 */
async function findEligibleUsers() {
  const now = new Date();

  // Query users with digest schedule
  const { data: schedules, error: scheduleError } = await supabase
    .from('oracle_digest_schedule')
    .select(`
      user_id,
      frequency,
      enabled,
      include_insights,
      include_actions,
      include_market_updates,
      include_score_tracking,
      last_sent_at,
      next_scheduled_at
    `)
    .eq('enabled', true)
    .or(`next_scheduled_at.lte.${now.toISOString()},last_sent_at.is.null`)
    .limit(200); // Process max 200 per run

  if (scheduleError) {
    throw new Error(`Failed to fetch digest schedules: ${scheduleError.message}`);
  }

  if (!schedules || schedules.length === 0) {
    return [];
  }

  // Get user details and verify they have Oracle sessions
  const eligibleUsers = [];
  
  for (const schedule of schedules) {
    // Fetch user email from auth.users
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(schedule.user_id);
    
    if (userError || !user || !user.email) {
      console.log(`⚠️ Skipping user ${schedule.user_id} - no email found`);
      continue;
    }

    // Check if user has completed Oracle session
    const { data: sessions, error: sessionError } = await supabase
      .from('oracle_sessions')
      .select('id, startup_id, completed_at')
      .eq('user_id', schedule.user_id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1);

    if (sessionError || !sessions || sessions.length === 0) {
      console.log(`⚠️ Skipping user ${user.email} - no completed sessions`);
      continue;
    }

    eligibleUsers.push({
      user_id: schedule.user_id,
      email: user.email,
      session_id: sessions[0].id,
      startup_id: sessions[0].startup_id,
      preferences: {
        include_insights: schedule.include_insights,
        include_actions: schedule.include_actions,
        include_market_updates: schedule.include_market_updates,
        include_score_tracking: schedule.include_score_tracking
      }
    });
  }

  return eligibleUsers;
}

/**
 * Send digest email to a single user
 */
async function sendDigestToUser(user) {
  const { user_id, email, session_id, startup_id, preferences } = user;

  // Step 1: Gather content for email
  const digestContent = await gatherDigestContent(user_id, session_id, startup_id, preferences);

  if (!digestContent.hasContent) {
    console.log(`⚠️ No content for ${email}, skipping digest`);
    return;
  }

  // Step 2: Build HTML email
  const emailHtml = buildEmailHtml(digestContent);

  // Step 3: Send via Resend
  try {
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'Pythh Alerts <alerts@pythh.ai>',
      to: email,
      subject: digestContent.subject,
      html: emailHtml
    });

    if (error) {
      throw new Error(`Resend API error: ${error.message}`);
    }

    console.log(`📧 Email sent to ${email} (Resend ID: ${data.id})`);

    // Step 4: Update digest schedule
    await updateDigestSchedule(user_id);

    // Step 5: Track engagement event
    await supabase
      .from('oracle_engagement_events')
      .insert({
        user_id: user_id,
        session_id: session_id,
        event_type: 'digest_email_sent',
        event_data: { 
          email_id: data.id,
          insight_count: digestContent.insights.length,
          action_count: digestContent.actions.length
        },
        source: 'email_digest',
        event_timestamp: new Date().toISOString()
      });

  } catch (error) {
    console.error(`Failed to send email to ${email}:`, error);
    throw error;
  }
}

/**
 * Gather content for digest email
 */
async function gatherDigestContent(userId, sessionId, startupId, preferences) {
  const content = {
    insights: [],
    actions: [],
    scoreUpdate: null,
    hasContent: false,
    subject: '🔮 Your Weekly Oracle Update'
  };

  // Fetch startup name
  const { data: startup } = await supabase
    .from('startup_uploads')
    .select('name')
    .eq('id', startupId)
    .single();

  content.startupName = startup?.name || 'Your Startup';

  // 1. Fetch recent insights (last 7 days)
  if (preferences.include_insights) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const { data: insights } = await supabase
      .from('oracle_insights')
      .select('id, insight_type, title, content, created_at')
      .eq('user_id', userId)
      .eq('is_dismissed', false)
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(5);

    if (insights && insights.length > 0) {
      content.insights = insights;
      content.hasContent = true;
    }
  }

  // 2. Fetch pending actions (if enabled)
  if (preferences.include_actions) {
    const { data: actions } = await supabase
      .from('oracle_actions')
      .select('id, title, priority, due_date')
      .eq('user_id', userId)
      .in('status', ['pending', 'in_progress'])
      .order('priority', { ascending: false })
      .order('due_date', { ascending: true })
      .limit(3);

    if (actions && actions.length > 0) {
      content.actions = actions;
      content.hasContent = true;
    }
  }

  // 3. Fetch score history (if enabled)
  if (preferences.include_score_tracking) {
    const { data: scoreHistory } = await supabase
      .from('oracle_score_history')
      .select('total_score, recorded_at, milestone')
      .eq('user_id', userId)
      .order('recorded_at', { ascending: false })
      .limit(2);

    if (scoreHistory && scoreHistory.length >= 2) {
      const latest = scoreHistory[0];
      const previous = scoreHistory[1];
      const change = latest.total_score - previous.total_score;
      
      content.scoreUpdate = {
        current: latest.total_score,
        previous: previous.total_score,
        change: change,
        trend: change > 0 ? 'up' : change < 0 ? 'down' : 'stable'
      };
      content.hasContent = true;
    } else if (scoreHistory && scoreHistory.length === 1) {
      content.scoreUpdate = {
        current: scoreHistory[0].total_score,
        trend: 'new'
      };
      content.hasContent = true;
    }
  }

  // Customize subject based on content
  if (content.insights.length > 0) {
    const insightType = content.insights[0].insight_type;
    if (insightType === 'opportunity') {
      content.subject = '💡 New Growth Opportunity Identified';
    } else if (insightType === 'strength') {
      content.subject = '🚀 Your Strengths Are Growing';
    }
  }

  if (content.scoreUpdate && content.scoreUpdate.change > 0) {
    content.subject = `📈 Your Oracle Score Increased to ${content.scoreUpdate.current}`;
  }

  return content;
}

/**
 * Build HTML email from digest content
 */
function buildEmailHtml(content) {
  const { startupName, insights, actions, scoreUpdate } = content;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${content.subject}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background: white;
      border-radius: 8px;
      padding: 32px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 32px;
      padding-bottom: 24px;
      border-bottom: 2px solid #f0f0f0;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      color: #1a1a1a;
    }
    .header p {
      margin: 8px 0 0 0;
      color: #666;
      font-size: 14px;
    }
    .score-badge {
      display: inline-block;
      padding: 12px 24px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-radius: 24px;
      font-size: 20px;
      font-weight: bold;
      margin: 16px 0;
    }
    .score-change {
      font-size: 14px;
      margin-left: 8px;
    }
    .score-change.up { color: #10b981; }
    .score-change.down { color: #ef4444; }
    .section {
      margin: 24px 0;
    }
    .section-title {
      font-size: 18px;
      font-weight: 600;
      color: #1a1a1a;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
    }
    .insight {
      background: #f9fafb;
      border-left: 4px solid #667eea;
      padding: 16px;
      margin-bottom: 12px;
      border-radius: 4px;
    }
    .insight-title {
      font-weight: 600;
      color: #1a1a1a;
      margin-bottom: 8px;
    }
    .insight-content {
      color: #4b5563;
      font-size: 14px;
      line-height: 1.5;
    }
    .insight-type {
      display: inline-block;
      padding: 2px 8px;
      background: #667eea;
      color: white;
      border-radius: 12px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    .action-item {
      padding: 12px 16px;
      background: #fffbeb;
      border-left: 4px solid #f59e0b;
      margin-bottom: 8px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .action-title {
      font-weight: 500;
      color: #1a1a1a;
    }
    .action-priority {
      font-size: 12px;
      padding: 4px 8px;
      border-radius: 4px;
      font-weight: 600;
    }
    .priority-high { background: #fee2e2; color: #dc2626; }
    .priority-medium { background: #fef3c7; color: #d97706; }
    .priority-low { background: #dbeafe; color: #2563eb; }
    .cta-button {
      display: inline-block;
      padding: 14px 32px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      text-align: center;
      margin: 24px 0;
    }
    .footer {
      text-align: center;
      margin-top: 32px;
      padding-top: 24px;
      border-top: 2px solid #f0f0f0;
      color: #6b7280;
      font-size: 13px;
    }
    .footer a {
      color: #667eea;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔮 Your Weekly Oracle Update</h1>
      <p>Fresh insights and guidance for ${startupName}</p>
    </div>

    ${scoreUpdate ? `
    <div class="section" style="text-align: center;">
      <div class="score-badge">
        Oracle Score: ${scoreUpdate.current}/100
        ${scoreUpdate.change ? `<span class="score-change ${scoreUpdate.trend}">${scoreUpdate.change > 0 ? '↑' : '↓'} ${Math.abs(scoreUpdate.change)}</span>` : ''}
      </div>
      ${scoreUpdate.trend === 'up' ? '<p style="color: #10b981; font-weight: 600;">Your fundraising readiness is improving! 🎉</p>' : ''}
    </div>
    ` : ''}

    ${insights.length > 0 ? `
    <div class="section">
      <div class="section-title">💡 Fresh Insights</div>
      ${insights.map(insight => `
        <div class="insight">
          <div class="insight-type">${insight.insight_type}</div>
          <div class="insight-title">${insight.title}</div>
          <div class="insight-content">${insight.content.substring(0, 200)}${insight.content.length > 200 ? '...' : ''}</div>
        </div>
      `).join('')}
    </div>
    ` : ''}

    ${actions.length > 0 ? `
    <div class="section">
      <div class="section-title">✅ Action Items</div>
      ${actions.map(action => `
        <div class="action-item">
          <div class="action-title">${action.title}</div>
          <div class="action-priority priority-${action.priority}">${action.priority.toUpperCase()}</div>
        </div>
      `).join('')}
    </div>
    ` : ''}

    <div style="text-align: center;">
      <a href="${process.env.APP_URL || 'https://hot-honey.fly.dev'}/app/oracle/dashboard" class="cta-button">
        View Full Dashboard →
      </a>
    </div>

    <div class="footer">
      <p>You're receiving this because you completed the Oracle coaching wizard.</p>
      <p><a href="${process.env.APP_URL || 'https://hot-honey.fly.dev'}/app/settings/notifications">Manage email preferences</a></p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Update digest schedule after sending
 */
async function updateDigestSchedule(userId) {
  const now = new Date();
  
  // Calculate next scheduled time (7 days from now)
  const nextScheduled = new Date(now);
  nextScheduled.setDate(nextScheduled.getDate() + 7);

  await supabase
    .from('oracle_digest_schedule')
    .update({
      last_sent_at: now.toISOString(),
      next_scheduled_at: nextScheduled.toISOString()
    })
    .eq('user_id', userId);
}

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run if called directly
if (require.main === module) {
  sendWeeklyDigests()
    .then(() => {
      console.log('✅ Digest sending complete');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Digest sending failed:', error);
      process.exit(1);
    });
}

module.exports = { sendWeeklyDigests };
