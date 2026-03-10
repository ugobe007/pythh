import { supabase } from '../config/supabase';
import nodemailer from 'nodemailer';
import { Resend } from 'resend';

// =============================================
// DAILY REPORT SERVICE
// Sends daily email summaries of platform activity
// Supports both Resend (recommended) and SMTP
// =============================================

interface DailyReportData {
  date: string;
  matches: {
    total: number;
    newToday: number;
    byStatus: { status: string; count: number }[];
    topMatches: any[];
  };
  investors: {
    total: number;
    newToday: number;
    recentAdditions: any[];
  };
  startups: {
    total: number;
    newToday: number;
    recentAdditions: any[];
  };
  scraperActivity: {
    jobsRun: number;
    companiesFound: number;
    recentJobs: any[];
  };
  siteActivity: {
    recommendationsGenerated: number;
    emailsGenerated: number;
    profileViews: number;
  };
  fundingNews: {
    recentDeals: any[];
    totalAmount: string;
    topRounds: any[];
  };
  vcNews: {
    recentActivity: any[];
    topVCs: any[];
  };
}

const SITE_URL = process.env.SITE_URL || 'http://localhost:5174';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';

// Initialize Resend if API key is available
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

/**
 * Create email transporter
 */
function createTransporter() {
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
}

/**
 * Get today's date range (start and end of day)
 */
function getTodayRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

/**
 * Gather all data for the daily report
 */
export async function gatherDailyReportData(): Promise<DailyReportData> {
  const { start, end } = getTodayRange();
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // === MATCHES ===
  const { count: totalMatches } = await supabase
    .from('startup_investor_matches')
    .select('*', { count: 'exact', head: true });

  const { count: newMatchesToday } = await supabase
    .from('startup_investor_matches')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', start)
    .lte('created_at', end);

  const { data: matchesByStatus } = await supabase
    .from('startup_investor_matches')
    .select('status');

  const statusCounts = (matchesByStatus || []).reduce((acc: Record<string, number>, m) => {
    acc[m.status] = (acc[m.status] || 0) + 1;
    return acc;
  }, {});

  const { data: topMatches } = await supabase
    .from('startup_investor_matches')
    .select(`
      *,
      investors:investor_id (name, firm)
    `)
    .gte('created_at', start)
    .order('match_score', { ascending: false })
    .limit(5);

  // === INVESTORS ===
  const { count: totalInvestors } = await supabase
    .from('investors')
    .select('*', { count: 'exact', head: true });

  const { count: newInvestorsToday } = await supabase
    .from('investors')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', start)
    .lte('created_at', end);

  const { data: recentInvestors } = await supabase
    .from('investors')
    .select('id, name, firm, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  // === STARTUPS ===
  // SSOT: Use startup_uploads table (not 'startups')
  const { count: totalStartups } = await supabase
    .from('startup_uploads')
    .select('*', { count: 'exact', head: true });

  const { count: newStartupsToday } = await supabase
    .from('startup_uploads')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', start)
    .lte('created_at', end);

  const { data: recentStartups } = await supabase
    .from('startup_uploads')
    .select('id, name, tagline, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  // === SCRAPER ACTIVITY ===
  const { count: scraperJobsToday } = await supabase
    .from('scraper_jobs')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', start)
    .lte('created_at', end);

  const { count: companiesFoundToday } = await supabase
    .from('scraper_results')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', start)
    .lte('created_at', end);

  const { data: recentJobs } = await supabase
    .from('scraper_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  // === SITE ACTIVITY (from analytics if available) ===
  let recommendationsGenerated = 0;
  let emailsGenerated = 0;
  let profileViews = 0;

  try {
    const { count: recsCount } = await supabase
      .from('recommendation_analytics')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'recommendations_generated')
      .gte('created_at', start);
    recommendationsGenerated = recsCount || 0;

    const { count: emailsCount } = await supabase
      .from('recommendation_analytics')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'email_generated')
      .gte('created_at', start);
    emailsGenerated = emailsCount || 0;

    const { count: viewsCount } = await supabase
      .from('recommendation_analytics')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'recommendation_viewed')
      .gte('created_at', start);
    profileViews = viewsCount || 0;
  } catch (e) {
    // Analytics table may not exist yet
  }

  // === FUNDING NEWS ===
  // Get recent startups with funding info (from last 7 days for more content)
  // SSOT: Use startup_uploads table (not 'startups')
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  
  const { data: recentFundingDeals } = await supabase
    .from('startup_uploads')
    .select('name, tagline, raise_amount, stage, created_at')
    .not('raise_amount', 'is', null)
    .gte('created_at', weekAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(10);

  // Calculate total funding amount
  const totalFunding = (recentFundingDeals || []).reduce((sum, deal) => {
    const amount = deal.raise_amount?.replace(/[^0-9.]/g, '') || '0';
    return sum + parseFloat(amount);
  }, 0);

  // Get top funding rounds
  // SSOT: Use startup_uploads table (not 'startups')
  const { data: topFundingRounds } = await supabase
    .from('startup_uploads')
    .select('name, tagline, raise_amount, stage, created_at')
    .not('raise_amount', 'is', null)
    .gte('created_at', weekAgo.toISOString())
    .order('raise_amount', { ascending: false })
    .limit(5);

  // === VC NEWS ===
  // Get recent VC activity from scraper jobs
  const { data: recentVCActivity } = await supabase
    .from('scraper_jobs')
    .select('metadata, companies_found, completed_at')
    .eq('status', 'completed')
    .gte('completed_at', weekAgo.toISOString())
    .order('completed_at', { ascending: false })
    .limit(10);

  // Get most active VCs
  const { data: topVCs } = await supabase
    .from('scraper_jobs')
    .select('metadata, companies_found')
    .eq('status', 'completed')
    .gte('completed_at', weekAgo.toISOString())
    .order('companies_found', { ascending: false })
    .limit(5);

  return {
    date: today,
    matches: {
      total: totalMatches || 0,
      newToday: newMatchesToday || 0,
      byStatus: Object.entries(statusCounts).map(([status, count]) => ({ status, count })),
      topMatches: topMatches || [],
    },
    investors: {
      total: totalInvestors || 0,
      newToday: newInvestorsToday || 0,
      recentAdditions: recentInvestors || [],
    },
    startups: {
      total: totalStartups || 0,
      newToday: newStartupsToday || 0,
      recentAdditions: recentStartups || [],
    },
    scraperActivity: {
      jobsRun: scraperJobsToday || 0,
      companiesFound: companiesFoundToday || 0,
      recentJobs: recentJobs || [],
    },
    siteActivity: {
      recommendationsGenerated,
      emailsGenerated,
      profileViews,
    },
    fundingNews: {
      recentDeals: recentFundingDeals || [],
      totalAmount: totalFunding > 0 ? `$${(totalFunding / 1000000).toFixed(1)}M` : '$0',
      topRounds: topFundingRounds || [],
    },
    vcNews: {
      recentActivity: recentVCActivity || [],
      topVCs: topVCs || [],
    },
  };
}

/**
 * Generate HTML email content
 */
function generateEmailHTML(data: DailyReportData): string {
  const statusEmoji: Record<string, string> = {
    suggested: '💡',
    viewed: '👀',
    contacted: '📧',
    meeting_scheduled: '📅',
    term_sheet: '📄',
    passed: '❌',
  };

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>pyth ai - Daily Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #8b5cf6, #6366f1); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; }
    .header p { margin: 10px 0 0; opacity: 0.9; }
    .content { padding: 30px; }
    .section { margin-bottom: 30px; }
    .section-title { font-size: 18px; font-weight: bold; color: #1f2937; margin-bottom: 15px; display: flex; align-items: center; gap: 8px; }
    .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
    .stat-card { background: #f9fafb; border-radius: 12px; padding: 20px; text-align: center; }
    .stat-number { font-size: 32px; font-weight: bold; color: #8b5cf6; }
    .stat-label { color: #6b7280; font-size: 14px; margin-top: 5px; }
    .stat-change { font-size: 12px; margin-top: 5px; }
    .stat-change.positive { color: #10b981; }
    .stat-change.neutral { color: #6b7280; }
    .list { background: #f9fafb; border-radius: 12px; padding: 15px; }
    .list-item { padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
    .list-item:last-child { border-bottom: none; }
    .list-item-title { font-weight: 600; color: #1f2937; }
    .list-item-subtitle { font-size: 13px; color: #6b7280; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .badge-purple { background: #ede9fe; color: #7c3aed; }
    .badge-green { background: #d1fae5; color: #059669; }
    .badge-blue { background: #dbeafe; color: #2563eb; }
    .badge-yellow { background: #fef3c7; color: #d97706; }
    .cta-button { display: inline-block; background: linear-gradient(135deg, #8b5cf6, #6366f1); color: white; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 600; margin-top: 10px; }
    .footer { background: #f9fafb; padding: 20px; text-align: center; color: #6b7280; font-size: 13px; }
    .footer a { color: #8b5cf6; text-decoration: none; }
    .divider { height: 1px; background: #e5e7eb; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔥 Daily Report</h1>
      <p>${data.date}</p>
    </div>
    
    <div class="content">
      <!-- Summary Stats -->
      <div class="section">
        <div class="section-title">📊 Today's Summary</div>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-number">${data.matches.newToday}</div>
            <div class="stat-label">New Matches</div>
            <div class="stat-change ${data.matches.newToday > 0 ? 'positive' : 'neutral'}">
              ${data.matches.total} total
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${data.startups.newToday}</div>
            <div class="stat-label">New Startups</div>
            <div class="stat-change ${data.startups.newToday > 0 ? 'positive' : 'neutral'}">
              ${data.startups.total} total
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${data.investors.newToday}</div>
            <div class="stat-label">New Investors</div>
            <div class="stat-change ${data.investors.newToday > 0 ? 'positive' : 'neutral'}">
              ${data.investors.total} total
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${data.scraperActivity.companiesFound}</div>
            <div class="stat-label">Companies Found</div>
            <div class="stat-change neutral">
              ${data.scraperActivity.jobsRun} scraper jobs
            </div>
          </div>
        </div>
      </div>

      <div class="divider"></div>

      <!-- Match Status Breakdown -->
      ${data.matches.byStatus.length > 0 ? `
      <div class="section">
        <div class="section-title">🤝 Match Pipeline</div>
        <div class="list">
          ${data.matches.byStatus.map(s => `
            <div class="list-item" style="display: flex; justify-content: space-between; align-items: center;">
              <span>${statusEmoji[s.status] || '📌'} ${s.status.replace('_', ' ')}</span>
              <span class="badge badge-purple">${s.count}</span>
            </div>
          `).join('')}
        </div>
      </div>
      ` : ''}

      <!-- Top Matches Today -->
      ${data.matches.topMatches.length > 0 ? `
      <div class="section">
        <div class="section-title">⭐ Top Matches Today</div>
        <div class="list">
          ${data.matches.topMatches.map(m => `
            <div class="list-item">
              <div class="list-item-title">${m.investors?.name || 'Unknown'} @ ${m.investors?.firm || 'Unknown'}</div>
              <div class="list-item-subtitle">Match Score: ${m.match_score}%</div>
            </div>
          `).join('')}
        </div>
        <a href="${SITE_URL}/admin/match-center" class="cta-button">View All Matches →</a>
      </div>
      ` : ''}

      <div class="divider"></div>

      <!-- Recent Startups -->
      ${data.startups.recentAdditions.length > 0 ? `
      <div class="section">
        <div class="section-title">🚀 Recent Startups</div>
        <div class="list">
          ${data.startups.recentAdditions.map(s => `
            <div class="list-item">
              <div class="list-item-title">${s.name}</div>
              <div class="list-item-subtitle">${s.tagline || 'No tagline'}</div>
            </div>
          `).join('')}
        </div>
        <a href="${SITE_URL}/admin/edit-startups" class="cta-button">Manage Startups →</a>
      </div>
      ` : ''}

      <!-- Recent Investors -->
      ${data.investors.recentAdditions.length > 0 ? `
      <div class="section">
        <div class="section-title">💼 Recent Investors</div>
        <div class="list">
          ${data.investors.recentAdditions.map(i => `
            <div class="list-item">
              <div class="list-item-title">${i.name}</div>
              <div class="list-item-subtitle">${i.firm}</div>
            </div>
          `).join('')}
        </div>
        <a href="${SITE_URL}/admin/investors" class="cta-button">Manage Investors →</a>
      </div>
      ` : ''}

      <div class="divider"></div>

      <!-- Funding News Highlights -->
      ${data.fundingNews.recentDeals.length > 0 ? `
      <div class="section">
        <div class="section-title">💰 Latest Funding News</div>
        <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
          <div style="font-size: 24px; font-weight: bold; color: #059669;">${data.fundingNews.totalAmount}</div>
          <div style="font-size: 13px; color: #6b7280; margin-top: 5px;">Total Raised This Week</div>
        </div>
        <div class="list">
          ${data.fundingNews.recentDeals.slice(0, 5).map(deal => `
            <div class="list-item">
              <div class="list-item-title">💵 ${deal.name}</div>
              <div class="list-item-subtitle">
                ${deal.raise_amount || 'Undisclosed'} 
                ${deal.funding_stage ? `• <span class="badge badge-green">${deal.funding_stage}</span>` : ''}
              </div>
              ${deal.tagline ? `<div class="list-item-subtitle" style="margin-top: 5px;">${deal.tagline}</div>` : ''}
            </div>
          `).join('')}
        </div>
        <a href="${SITE_URL}/admin/edit-startups" class="cta-button">View All Deals →</a>
      </div>
      ` : ''}

      ${data.fundingNews.topRounds.length > 0 ? `
      <div class="section">
        <div class="section-title">🏆 Top Funding Rounds</div>
        <div class="list">
          ${data.fundingNews.topRounds.map((deal, idx) => `
            <div class="list-item">
              <div class="list-item-title">#${idx + 1} ${deal.name}</div>
              <div class="list-item-subtitle">
                <strong>${deal.raise_amount || 'Undisclosed'}</strong>
                ${deal.funding_stage ? `• ${deal.funding_stage}` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      ` : ''}

      <div class="divider"></div>

      <!-- VC Activity News -->
      ${data.vcNews.topVCs.length > 0 ? `
      <div class="section">
        <div class="section-title">🎯 Most Active VCs This Week</div>
        <div class="list">
          ${data.vcNews.topVCs.map(vc => {
            const vcName = vc.metadata?.vc_name || vc.metadata?.investor || 'Unknown VC';
            return `
              <div class="list-item">
                <div class="list-item-title">📊 ${vcName}</div>
                <div class="list-item-subtitle">
                  ${vc.companies_found || 0} new investments tracked
                </div>
              </div>
            `;
          }).join('')}
        </div>
        <a href="${SITE_URL}/investors" class="cta-button">View All VCs →</a>
      </div>
      ` : ''}

      <div class="divider"></div>

      <!-- Scraper Activity -->
      ${data.scraperActivity.recentJobs.length > 0 ? `
      <div class="section">
        <div class="section-title">🔍 Scraper Activity</div>
        <div class="list">
          ${data.scraperActivity.recentJobs.slice(0, 3).map(j => `
            <div class="list-item">
              <div class="list-item-title">${j.source || 'Unknown source'}</div>
              <div class="list-item-subtitle">
                Status: <span class="badge ${j.status === 'completed' ? 'badge-green' : 'badge-yellow'}">${j.status}</span>
                • ${j.results_count || 0} results
              </div>
            </div>
          `).join('')}
        </div>
        <a href="${SITE_URL}/admin/rss-scraper" class="cta-button">View Scraper →</a>
      </div>
      ` : ''}

      <!-- Quick Links -->
      <div class="section">
        <div class="section-title">🔗 Quick Links</div>
        <div style="display: flex; flex-wrap: wrap; gap: 10px;">
          <a href="${SITE_URL}/admin" class="badge badge-purple" style="text-decoration: none;">Admin Panel</a>
          <a href="${SITE_URL}/admin/match-center" class="badge badge-blue" style="text-decoration: none;">Match Center</a>
          <a href="${SITE_URL}/recommendations" class="badge badge-green" style="text-decoration: none;">Recommendations</a>
          <a href="${SITE_URL}/investors" class="badge badge-yellow" style="text-decoration: none;">Investor Directory</a>
        </div>
      </div>
    </div>
    
    <div class="footer">
      <p>This is an automated daily report from pyth ai.</p>
      <p><a href="${SITE_URL}">Visit Site</a> • <a href="${SITE_URL}/admin">Admin Panel</a></p>
    </div>
  </div>
</body>
</html>
`;
}

/**
 * Generate plain text version of email
 */
function generateEmailText(data: DailyReportData): string {
  return `
PYTH AI HONEY - DAILY REPORT
${data.date}
================================

📊 TODAY'S SUMMARY
------------------
• New Matches: ${data.matches.newToday} (${data.matches.total} total)
• New Startups: ${data.startups.newToday} (${data.startups.total} total)
• New Investors: ${data.investors.newToday} (${data.investors.total} total)
• Companies Found: ${data.scraperActivity.companiesFound}
• Scraper Jobs: ${data.scraperActivity.jobsRun}

🤝 MATCH PIPELINE
-----------------
${data.matches.byStatus.map(s => `• ${s.status}: ${s.count}`).join('\n')}

🚀 RECENT STARTUPS
------------------
${data.startups.recentAdditions.map(s => `• ${s.name} - ${s.tagline || 'No tagline'}`).join('\n') || 'None'}

💼 RECENT INVESTORS
-------------------
${data.investors.recentAdditions.map(i => `• ${i.name} @ ${i.firm}`).join('\n') || 'None'}

💰 LATEST FUNDING NEWS
----------------------
Total Raised This Week: ${data.fundingNews.totalAmount}

Recent Deals:
${data.fundingNews.recentDeals.slice(0, 5).map(d => `• ${d.name} - ${d.raise_amount || 'Undisclosed'} ${d.funding_stage ? `(${d.funding_stage})` : ''}`).join('\n') || 'None'}

Top Funding Rounds:
${data.fundingNews.topRounds.map((d, i) => `${i + 1}. ${d.name} - ${d.raise_amount || 'Undisclosed'}`).join('\n') || 'None'}

🎯 MOST ACTIVE VCs THIS WEEK
----------------------------
${data.vcNews.topVCs.map(vc => {
  const vcName = vc.metadata?.vc_name || vc.metadata?.investor || 'Unknown VC';
  return `• ${vcName} - ${vc.companies_found || 0} investments`;
}).join('\n') || 'None'}

🔗 QUICK LINKS
--------------
• Admin Panel: ${SITE_URL}/admin
• Match Center: ${SITE_URL}/admin/match-center
• Recommendations: ${SITE_URL}/recommendations
• Investor Directory: ${SITE_URL}/investors

---
This is an automated daily report from pyth ai.
`;
}

/**
 * Send the daily report email using Resend (preferred) or SMTP fallback
 * Set ADMIN_EMAIL_ENABLED=false to disable (reduces admin email noise)
 */
export async function sendDailyReport(recipientEmail?: string): Promise<{ success: boolean; message: string }> {
  try {
    const adminEmailEnabled = process.env.ADMIN_EMAIL_ENABLED;
    const isEnabled = adminEmailEnabled === undefined || adminEmailEnabled === '' ||
      ['true', '1', 'yes'].includes(String(adminEmailEnabled).toLowerCase());
    if (!isEnabled) {
      console.log('📧 Admin email disabled (ADMIN_EMAIL_ENABLED=false), skipping daily report');
      return { success: false, message: 'Admin email disabled via ADMIN_EMAIL_ENABLED' };
    }

    const email = recipientEmail || ADMIN_EMAIL;
    
    if (!email) {
      return { success: false, message: 'No recipient email configured. Set ADMIN_EMAIL env variable.' };
    }

    // Gather report data
    const data = await gatherDailyReportData();
    const subject = `🔥 Daily Report - ${data.date}`;
    const html = generateEmailHTML(data);
    const text = generateEmailText(data);

    // Try Resend first (recommended)
    if (resend && RESEND_API_KEY) {
      console.log('Sending daily report via Resend to:', email);
      
      const { data: emailData, error } = await resend.emails.send({
        from: 'pyth ai <onboarding@resend.dev>', // Use verified domain in production
        to: [email],
        subject,
        html,
        text,
      });

      if (error) {
        console.error('Resend error:', error);
        // Fall through to try SMTP
      } else {
        console.log('Daily report sent via Resend:', emailData?.id);
        return { 
          success: true, 
          message: `Daily report sent to ${email} via Resend`,
        };
      }
    }

    // Fallback to SMTP
    if (SMTP_USER && SMTP_PASS) {
      console.log('Sending daily report via SMTP to:', email);
      
      const transporter = createTransporter();
      const info = await transporter.sendMail({
        from: `"pyth ai" <${SMTP_USER}>`,
        to: email,
        subject,
        text,
        html,
      });

      console.log('Daily report sent via SMTP:', info.messageId);
      return { 
        success: true, 
        message: `Daily report sent to ${email} via SMTP`,
      };
    }

    return { 
      success: false, 
      message: 'No email provider configured. Set RESEND_API_KEY or SMTP credentials.' 
    };
  } catch (error: any) {
    console.error('Error sending daily report:', error);
    return { 
      success: false, 
      message: error.message || 'Failed to send daily report',
    };
  }
}

/**
 * Get report data without sending (for preview)
 */
export async function getReportPreview(): Promise<DailyReportData> {
  return gatherDailyReportData();
}
