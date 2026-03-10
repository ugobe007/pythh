/**
 * PYTH AI - NOTIFICATION SERVICE
 * 
 * Sends alerts to Slack and/or Email
 * 
 * Add to .env:
 *   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
 *   RESEND_API_KEY=re_... (get from resend.com)
 *   ALERT_EMAIL=bob@example.com
 */

import dotenv from 'dotenv';
import { Resend } from 'resend';

dotenv.config();

// Guard against missing API key - Resend throws if initialized with empty string
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

export interface Alert {
  level: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  details?: any;
}

export async function sendSlackAlert(alert: Alert): Promise<boolean> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log('⚠️  SLACK_WEBHOOK_URL not set, skipping notification');
    return false;
  }

  const emoji = alert.level === 'critical' ? '🚨' : alert.level === 'warning' ? '⚠️' : 'ℹ️';
  const color = alert.level === 'critical' ? '#FF0000' : alert.level === 'warning' ? '#FFA500' : '#36a64f';

  const payload: any = {
    attachments: [{
      color,
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: `${emoji} ${alert.title}`, emoji: true }
        },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: alert.message }
        },
        {
          type: 'context',
          elements: [
            { type: 'mrkdwn', text: `*Level:* ${alert.level.toUpperCase()}` },
            { type: 'mrkdwn', text: `*Time:* ${new Date().toLocaleString()}` }
          ]
        }
      ]
    }]
  };

  if (alert.details) {
    payload.attachments[0].blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: '```' + JSON.stringify(alert.details, null, 2).slice(0, 500) + '```' }
    });
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return response.ok;
  } catch (err) {
    console.error('Slack notification failed:', err);
    return false;
  }
}

/**
 * Send a daily digest summary
 */
export async function sendDailyDigest(stats: {
  startupsProcessed: number;
  matchesCreated: number;
  errorsEncountered: number;
  fixesApplied: number;
}): Promise<boolean> {
  return sendSlackAlert({
    level: 'info',
    title: 'pyth ai - Daily Digest',
    message: [
      `📊 *Daily Summary*`,
      `• Startups processed: ${stats.startupsProcessed}`,
      `• Matches created: ${stats.matchesCreated}`,
      `• Errors encountered: ${stats.errorsEncountered}`,
      `• Auto-fixes applied: ${stats.fixesApplied}`
    ].join('\n'),
    details: { ...stats, date: new Date().toISOString().split('T')[0] }
  });
}

/**
 * Send system health alert
 */
export async function sendHealthAlert(status: 'healthy' | 'warning' | 'critical', checks: Record<string, boolean>): Promise<boolean> {
  const failedChecks = Object.entries(checks)
    .filter(([_, passed]) => !passed)
    .map(([name]) => name);

  if (status === 'healthy') return true; // Don't spam on healthy status

  return sendSlackAlert({
    level: status,
    title: `pyth ai - System ${status.toUpperCase()}`,
    message: failedChecks.length > 0 
      ? `Failed checks:\n${failedChecks.map(c => `• ${c}`).join('\n')}`
      : 'System experiencing issues',
    details: checks
  });
}

/**
 * Send email alert using Resend
 * Set ADMIN_EMAIL_ENABLED=false to disable (reduces admin email noise)
 */
export async function sendEmailAlert(alert: Alert): Promise<boolean> {
  const toEmail = process.env.ALERT_EMAIL;
  const adminEmailEnabled = process.env.ADMIN_EMAIL_ENABLED;
  const isEnabled = adminEmailEnabled === undefined || adminEmailEnabled === '' ||
    ['true', '1', 'yes'].includes(String(adminEmailEnabled).toLowerCase());

  if (!isEnabled) {
    console.log('⚠️  Admin email disabled (ADMIN_EMAIL_ENABLED=false), skipping:', alert.title);
    return false;
  }
  if (!resend || !toEmail) {
    console.log('⚠️  RESEND_API_KEY or ALERT_EMAIL not set, skipping email');
    return false;
  }

  const emoji = alert.level === 'critical' ? '🚨' : alert.level === 'warning' ? '⚠️' : 'ℹ️';
  
  try {
    const { error } = await resend.emails.send({
      from: 'pyth ai <alerts@resend.dev>', // Use your verified domain later
      to: [toEmail],
      subject: `${emoji} ${alert.title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: ${alert.level === 'critical' ? '#FF4444' : alert.level === 'warning' ? '#FFA500' : '#4CAF50'}; 
                      color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">${emoji} ${alert.title}</h1>
          </div>
          <div style="background: #f5f5f5; padding: 20px; border-radius: 0 0 8px 8px;">
            <p style="font-size: 16px; line-height: 1.6; white-space: pre-wrap;">${alert.message}</p>
            ${alert.details ? `
              <div style="background: #333; color: #0f0; padding: 15px; border-radius: 4px; font-family: monospace; font-size: 12px; overflow-x: auto;">
                <pre style="margin: 0;">${JSON.stringify(alert.details, null, 2)}</pre>
              </div>
            ` : ''}
            <p style="color: #666; font-size: 12px; margin-top: 20px;">
              Level: ${alert.level.toUpperCase()} | Time: ${new Date().toLocaleString()}
            </p>
          </div>
        </div>
      `
    });

    if (error) {
      console.error('Email send failed:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Email notification failed:', err);
    return false;
  }
}

/**
 * Send escalation alert (both Slack and Email)
 */
export async function sendEscalationAlert(issues: string[]): Promise<boolean> {
  const alert: Alert = {
    level: 'critical',
    title: 'pyth ai - Escalation Required',
    message: issues.map(i => `• ${i}`).join('\n'),
    details: { issueCount: issues.length, timestamp: new Date().toISOString() }
  };

  // Send both Slack and Email for escalations
  const [slackResult, emailResult] = await Promise.all([
    sendSlackAlert(alert),
    sendEmailAlert(alert)
  ]);

  return slackResult || emailResult;
}
