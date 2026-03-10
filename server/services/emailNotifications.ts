import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Initialize Resend (or will fallback to console logs if no API key)
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'ugobe07@gmail.com';
const FROM_EMAIL = 'pyth ai <notifications@hotmoneyhoney.com>';

// Set ADMIN_EMAIL_ENABLED=false to disable admin emails (reduces noise)
const isAdminEmailEnabled = () => {
  const v = process.env.ADMIN_EMAIL_ENABLED;
  return v === undefined || v === '' || ['true', '1', 'yes'].includes(String(v).toLowerCase());
};

export class EmailNotificationService {
  /**
   * Send email notification to admin
   */
  private async sendEmail(to: string, subject: string, html: string): Promise<boolean> {
    if (!isAdminEmailEnabled()) {
      console.log(`📧 Admin email disabled (ADMIN_EMAIL_ENABLED=false): ${subject}`);
      return false;
    }
    if (!resend) {
      console.log(`📧 Email notification (no API key configured):`);
      console.log(`To: ${to}`);
      console.log(`Subject: ${subject}`);
      console.log(`Body: ${html.substring(0, 200)}...`);
      return false;
    }

    try {
      const { data, error } = await resend.emails.send({
        from: FROM_EMAIL,
        to: [to],
        subject,
        html,
      });

      if (error) {
        console.error('❌ Error sending email:', error);
        return false;
      }

      console.log(`✅ Email sent successfully:`, data);
      return true;
    } catch (error) {
      console.error('❌ Failed to send email:', error);
      return false;
    }
  }

  /**
   * Notify admin when new startups are pending approval
   */
  async notifyPendingStartups(count: number): Promise<void> {
    if (count === 0) return;

    const subject = `🚀 ${count} New Startup${count > 1 ? 's' : ''} Pending Approval`;
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; border-radius: 10px; text-align: center; }
            .content { background: #f9fafb; padding: 30px; border-radius: 10px; margin-top: 20px; }
            .button { display: inline-block; background: #f59e0b; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">💰 pyth ai</h1>
              <p style="margin: 10px 0 0 0;">Admin Notification</p>
            </div>
            <div class="content">
              <h2>🔔 New Startups Awaiting Review</h2>
              <p>You have <strong>${count} new startup${count > 1 ? 's' : ''}</strong> waiting for approval in the admin dashboard.</p>
              <p>These companies were recently added through:</p>
              <ul>
                <li>RSS News Scraper</li>
                <li>CSV Bulk Upload</li>
                <li>Document Scanner</li>
              </ul>
              <a href="https://pythai.fly.dev/admin/uploads" class="button">Review Pending Startups →</a>
            </div>
            <div class="footer">
              <p>pyth ai - Discover the Next Unicorn 🦄</p>
              <p><a href="https://pythai.fly.dev/admin/dashboard">Admin Dashboard</a></p>
            </div>
          </div>
        </body>
      </html>
    `;

    await this.sendEmail(ADMIN_EMAIL, subject, html);
  }

  /**
   * Send weekly digest to admin with activity summary
   */
  async sendWeeklyDigest(): Promise<void> {
    console.log('📊 Generating weekly digest...');

    try {
      // Get metrics for the past week
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      // Count new startups this week
      // SSOT: Use startup_uploads table (not 'startups')
      const { count: newStartups } = await supabase
        .from('startup_uploads')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', oneWeekAgo.toISOString());

      // Count pending approvals
      const { count: pendingCount } = await supabase
        .from('startup_uploads')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      // Count votes this week
      const { count: votesThisWeek } = await supabase
        .from('votes')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', oneWeekAgo.toISOString());

      // Get top 5 startups by votes
      // SSOT: Use startup_uploads table (not 'startups')
      // Note: votes may be in a separate table or calculated field
      const { data: topStartups } = await supabase
        .from('startup_uploads')
        .select('name, raise_amount')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(5);

      // Count scraper jobs this week
      const { count: scraperJobs } = await supabase
        .from('scraper_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('created_at', oneWeekAgo.toISOString());

      const subject = `📈 Weekly Digest - pyth ai`;
      
      const topStartupsList = topStartups
        ?.map((s, i) => `
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${i + 1}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">${s.name}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">💰 ${s.votes} votes</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${s.raise_amount || 'N/A'}</td>
          </tr>
        `)
        .join('') || '<tr><td colspan="4" style="padding: 10px;">No data yet</td></tr>';

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 700px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 30px; border-radius: 10px; text-align: center; }
              .metrics { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 20px 0; }
              .metric { background: white; padding: 20px; border-radius: 10px; border-left: 4px solid #f59e0b; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
              .metric-value { font-size: 32px; font-weight: bold; color: #f59e0b; }
              .metric-label { color: #666; margin-top: 5px; }
              table { width: 100%; border-collapse: collapse; background: white; border-radius: 10px; overflow: hidden; }
              th { background: #f59e0b; color: white; padding: 12px; text-align: left; }
              .button { display: inline-block; background: #3b82f6; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px; }
              .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">📊 Weekly Activity Digest</h1>
                <p style="margin: 10px 0 0 0;">pyth ai Performance Report</p>
              </div>

              <h2 style="margin-top: 30px;">📈 This Week's Metrics</h2>
              <div class="metrics">
                <div class="metric">
                  <div class="metric-value">${newStartups || 0}</div>
                  <div class="metric-label">New Startups Added</div>
                </div>
                <div class="metric">
                  <div class="metric-value">${votesThisWeek || 0}</div>
                  <div class="metric-label">Total Votes Cast</div>
                </div>
                <div class="metric">
                  <div class="metric-value">${pendingCount || 0}</div>
                  <div class="metric-label">Pending Approvals</div>
                </div>
                <div class="metric">
                  <div class="metric-value">${scraperJobs || 0}</div>
                  <div class="metric-label">Scraper Jobs Run</div>
                </div>
              </div>

              <h2 style="margin-top: 30px;">🏆 Top 5 Trending Startups</h2>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Startup</th>
                    <th>Votes</th>
                    <th>Funding</th>
                  </tr>
                </thead>
                <tbody>
                  ${topStartupsList}
                </tbody>
              </table>

              ${pendingCount && pendingCount > 0 ? `
                <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin-top: 20px; border-radius: 10px;">
                  <h3 style="margin: 0 0 10px 0;">⚠️ Action Required</h3>
                  <p style="margin: 0;">You have <strong>${pendingCount} startup${pendingCount > 1 ? 's' : ''}</strong> waiting for approval.</p>
                  <a href="https://pythai.fly.dev/admin/uploads" class="button" style="background: #f59e0b;">Review Now →</a>
                </div>
              ` : ''}

              <div style="text-align: center; margin-top: 30px;">
                <a href="https://pythai.fly.dev/admin/dashboard" class="button">View Full Dashboard →</a>
              </div>

              <div class="footer">
                <p>pyth ai - Weekly Report</p>
                <p><a href="https://pythai.fly.dev">Visit Site</a> | <a href="https://pythai.fly.dev/admin/analytics">View Analytics</a></p>
              </div>
            </div>
          </body>
        </html>
      `;

      await this.sendEmail(ADMIN_EMAIL, subject, html);
      console.log('✅ Weekly digest sent successfully');
    } catch (error) {
      console.error('❌ Error generating weekly digest:', error);
    }
  }

  /**
   * Notify admin when RSS scraper job completes
   */
  async notifyScraperComplete(jobId: string, companiesFound: number, investor: string): Promise<void> {
    const subject = `✅ RSS Scraper Complete - ${companiesFound} Companies Found`;
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; border-radius: 10px; text-align: center; }
            .content { background: #f0fdf4; padding: 30px; border-radius: 10px; margin-top: 20px; border: 2px solid #10b981; }
            .button { display: inline-block; background: #10b981; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">✅ Scraper Job Complete!</h1>
            </div>
            <div class="content">
              <h2>RSS Scraper Results</h2>
              <p><strong>Investor:</strong> ${investor}</p>
              <p><strong>Companies Found:</strong> ${companiesFound}</p>
              <p><strong>Job ID:</strong> ${jobId}</p>
              <p>All companies have been saved to the pending uploads queue and are ready for your review.</p>
              <a href="https://pythai.fly.dev/admin/uploads" class="button">Review Companies →</a>
            </div>
          </div>
        </body>
      </html>
    `;

    await this.sendEmail(ADMIN_EMAIL, subject, html);
  }
}

// Export singleton
export const emailService = new EmailNotificationService();
