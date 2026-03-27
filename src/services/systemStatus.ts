/**
 * [pyth] ai - SYSTEM STATUS SERVICE (Frontend)
 * 
 * Fetches real-time system status from the database
 * for the Agent Dashboard.
 */

import { supabase } from '../lib/supabase';

export interface ServiceStatus {
  name: string;
  status: 'running' | 'stopped' | 'error' | 'unknown';
  lastRun: string | null;
  runsToday: number;
  successRate: number;
  message?: string;
}

export interface SystemStatus {
  overall: 'healthy' | 'warning' | 'critical' | 'unknown';
  lastUpdated: string;
  
  services: {
    aiAgent: ServiceStatus;
    watchdog: ServiceStatus;
    scraper: ServiceStatus;
    godScoring: ServiceStatus;
    matchingEngine: ServiceStatus;
    investorEnrichment: ServiceStatus;
  };
  
  metrics: {
    totalStartups: number;
    totalInvestors: number;
    totalMatches: number;
    avgGODScore: number;
    newStartupsToday: number;
    newInvestorsToday: number;
    newMatchesToday: number;
  };
  
  issues: string[];
}

export interface AgentLog {
  id: string;
  type: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  status: string;
  created_at: string;
}

export interface DailyReport {
  id: string;
  date: string;
  stats: {
    totalStartups: number;
    approvedStartups: number;
    totalInvestors: number;
    totalMatches: number;
    avgGODScore: number;
    newStartupsToday: number;
    newInvestorsToday: number;
    newMatchesToday: number;
    issues: string[];
  };
  created_at: string;
}

// Helper to get today's start
function getTodayStart(): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.toISOString();
}

// Helper to get service status from logs
async function getServiceStatusFromLogs(logType: string, thresholdMinutes: number): Promise<ServiceStatus> {
  const now = new Date();
  const todayISO = getTodayStart();
  
  // Get last run
  const { data: lastRunData } = await (supabase.from as any)('ai_logs')
    .select('created_at, status')
    .eq('type', logType)
    .order('created_at', { ascending: false })
    .limit(1);

  const lastRun = lastRunData?.[0] as { created_at: string; status: string } | undefined;

  // Count runs today
  const { count: runsToday } = await (supabase.from as any)('ai_logs')
    .select('*', { count: 'exact', head: true })
    .eq('type', logType)
    .gte('created_at', todayISO);

  // Count successful runs today
  const { count: successToday } = await (supabase.from as any)('ai_logs')
    .select('*', { count: 'exact', head: true })
    .eq('type', logType)
    .eq('status', 'success')
    .gte('created_at', todayISO);

  const successRate = (runsToday && runsToday > 0) 
    ? Math.round((successToday || 0) / runsToday * 100) 
    : 100;

  // Determine status
  let status: 'running' | 'stopped' | 'error' | 'unknown' = 'unknown';
  let message = '';
  
  if (!lastRun) {
    status = 'unknown';
    message = 'No runs recorded';
  } else {
    const lastRunTime = new Date(lastRun.created_at);
    const minutesSinceLastRun = (now.getTime() - lastRunTime.getTime()) / (1000 * 60);
    
    if (minutesSinceLastRun <= thresholdMinutes) {
      status = lastRun.status === 'success' ? 'running' : 'error';
      message = `Last run ${Math.round(minutesSinceLastRun)} min ago`;
    } else {
      status = 'stopped';
      message = `No run in ${Math.round(minutesSinceLastRun)} min`;
    }
  }

  return {
    name: logType,
    status,
    lastRun: lastRun?.created_at || null,
    runsToday: runsToday || 0,
    successRate,
    message
  };
}

// Get GOD scoring status
async function getGODScoringStatus(): Promise<ServiceStatus> {
  // Check startups with scores
  const { count: withScores } = await supabase
    .from('startup_uploads')
    .select('*', { count: 'exact', head: true })
    .not('total_god_score', 'is', null);

  // Check startups without scores
  const { count: withoutScores } = await supabase
    .from('startup_uploads')
    .select('*', { count: 'exact', head: true })
    .is('total_god_score', null)
    .eq('status', 'approved');

  // Get average score
  const { data: scores } = await supabase
    .from('startup_uploads')
    .select('total_god_score')
    .not('total_god_score', 'is', null)
    .limit(500);

  const avgScore = scores && scores.length > 0
    ? scores.reduce((sum, s) => sum + ((s.total_god_score as number) || 0), 0) / scores.length
    : 0;

  // Determine status
  let status: 'running' | 'stopped' | 'error' | 'unknown' = 'running';
  let message = `${withScores || 0} scored, avg ${Math.round(avgScore)}`;

  if ((withoutScores || 0) > 20) {
    status = 'error';
    message = `${withoutScores} startups missing scores`;
  } else if (avgScore < 30 && (withScores || 0) > 0) {
    status = 'error';
    message = `Low average score: ${Math.round(avgScore)}`;
  }

  const total = (withScores || 0) + (withoutScores || 0);
  return {
    name: 'GOD Scoring',
    status,
    lastRun: new Date().toISOString(),
    runsToday: 0,
    successRate: total > 0 ? Math.round((withScores || 0) / total * 100) : 100,
    message
  };
}

// Get matching engine status
async function getMatchingEngineStatus(): Promise<ServiceStatus> {
  const todayISO = getTodayStart();

  // Count total matches
  const { count: totalMatches } = await supabase
    .from('startup_investor_matches')
    .select('*', { count: 'exact', head: true });

  // Count matches today
  const { count: matchesToday } = await supabase
    .from('startup_investor_matches')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', todayISO);

  // Get average match score
  const { data: recentMatches } = await supabase
    .from('startup_investor_matches')
    .select('match_score')
    .order('created_at', { ascending: false })
    .limit(100);

  const avgScore = recentMatches && recentMatches.length > 0
    ? recentMatches.reduce((sum, m) => sum + ((m.match_score as number) || 0), 0) / recentMatches.length
    : 0;

  // Determine status
  let status: 'running' | 'stopped' | 'error' | 'unknown' = 'running';
  let message = `${totalMatches || 0} total, ${matchesToday || 0} today`;

  if ((totalMatches || 0) === 0) {
    status = 'error';
    message = 'No matches in database';
  } else if (avgScore < 40 && avgScore > 0) {
    status = 'error';
    message = `Low match quality: ${Math.round(avgScore)}%`;
  }

  return {
    name: 'Matching Engine',
    status,
    lastRun: new Date().toISOString(),
    runsToday: matchesToday || 0,
    successRate: Math.round(avgScore),
    message
  };
}

/** PostgREST returns max 1000 rows — paginate so dashboard avg GOD matches full approved set. */
const GOD_SCORE_PAGE = 1000;

async function fetchAllApprovedGodScoresForAvg(): Promise<{ total_god_score: number | null }[]> {
  const all: { total_god_score: number | null }[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('startup_uploads')
      .select('total_god_score')
      .eq('status', 'approved')
      .not('total_god_score', 'is', null)
      .order('id', { ascending: true })
      .range(from, from + GOD_SCORE_PAGE - 1);
    if (error) {
      console.warn('fetchAllApprovedGodScoresForAvg:', error.message);
      break;
    }
    if (!data?.length) break;
    all.push(...data);
    if (data.length < GOD_SCORE_PAGE) break;
    from += GOD_SCORE_PAGE;
  }
  return all;
}

// Get system metrics
async function getMetrics(): Promise<SystemStatus['metrics']> {
  const todayISO = getTodayStart();

  const [
    totalStartupsRes,
    totalInvestorsRes,
    totalMatchesRes,
    newStartupsRes,
    newInvestorsRes,
    newMatchesRes,
  ] = await Promise.all([
    supabase.from('startup_uploads').select('*', { count: 'exact', head: true }),
    supabase.from('investors').select('*', { count: 'exact', head: true }),
    supabase.from('startup_investor_matches').select('*', { count: 'exact', head: true }),
    supabase.from('startup_uploads').select('*', { count: 'exact', head: true }).gte('created_at', todayISO),
    supabase.from('investors').select('*', { count: 'exact', head: true }).gte('created_at', todayISO),
    supabase.from('startup_investor_matches').select('*', { count: 'exact', head: true }).gte('created_at', todayISO),
  ]);

  const scores = await fetchAllApprovedGodScoresForAvg();
  const avgGODScore = scores.length > 0
    ? scores.reduce((sum, s) => sum + ((s.total_god_score as number) || 0), 0) / scores.length
    : 0;

  return {
    totalStartups: totalStartupsRes.count || 0,
    totalInvestors: totalInvestorsRes.count || 0,
    totalMatches: totalMatchesRes.count || 0,
    avgGODScore: Math.round(avgGODScore),
    newStartupsToday: newStartupsRes.count || 0,
    newInvestorsToday: newInvestorsRes.count || 0,
    newMatchesToday: newMatchesRes.count || 0
  };
}

/**
 * Get complete system status
 */
export async function getSystemStatus(): Promise<SystemStatus> {
  const now = new Date();
  
  // Fetch all service statuses in parallel
  const [
    aiAgent,
    watchdog,
    scraper,
    godScoring,
    matchingEngine,
    investorEnrichment,
    metrics
  ] = await Promise.all([
    getServiceStatusFromLogs('agent_report', 60),
    getServiceStatusFromLogs('watchdog', 10),
    getServiceStatusFromLogs('scraper', 30),
    getGODScoringStatus(),
    getMatchingEngineStatus(),
    getServiceStatusFromLogs('enrichment', 60),
    getMetrics()
  ]);

  const status: SystemStatus = {
    overall: 'unknown',
    lastUpdated: now.toISOString(),
    services: {
      aiAgent: { ...aiAgent, name: 'AI Agent' },
      watchdog: { ...watchdog, name: 'Watchdog' },
      scraper: { ...scraper, name: 'RSS Scraper' },
      godScoring,
      matchingEngine,
      investorEnrichment: { ...investorEnrichment, name: 'Investor Enrichment' }
    },
    metrics,
    issues: []
  };

  // Calculate overall status
  const services = Object.values(status.services);
  const errorCount = services.filter(s => s.status === 'error').length;
  const runningCount = services.filter(s => s.status === 'running').length;
  
  if (errorCount >= 2) {
    status.overall = 'critical';
  } else if (errorCount >= 1 || runningCount < 3) {
    status.overall = 'warning';
  } else if (runningCount >= 3) {
    status.overall = 'healthy';
  }

  // Gather issues
  if (metrics.avgGODScore < 40 && metrics.totalStartups > 0) {
    status.issues.push('Average GOD score is below 40');
  }
  if (godScoring.status === 'error') {
    status.issues.push(godScoring.message || 'GOD scoring issues');
  }
  if (matchingEngine.status === 'error') {
    status.issues.push(matchingEngine.message || 'Matching engine issues');
  }
  if (aiAgent.status === 'stopped') {
    status.issues.push('AI Agent has not run recently');
  }
  if (watchdog.status === 'stopped') {
    status.issues.push('Watchdog monitoring is inactive');
  }

  return status;
}

/**
 * Get recent agent logs
 */
export async function getAgentLogs(limit: number = 50): Promise<AgentLog[]> {
  const { data } = await (supabase.from as any)('ai_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  
  return (data || []) as unknown as AgentLog[];
}

/**
 * Get agent history by type
 */
export async function getAgentHistory(type?: string, limit: number = 100): Promise<AgentLog[]> {
  let query = (supabase.from as any)('ai_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (type) {
    query = query.eq('type', type);
  }
  
  const { data } = await query;
  return (data || []) as unknown as AgentLog[];
}

/**
 * Get daily reports
 */
export async function getDailyReports(limit: number = 7): Promise<DailyReport[]> {
  const { data } = await (supabase.from as any)('ai_logs')
    .select('*')
    .eq('type', 'daily_report')
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (!data) return [];
  
  return (data as any[]).map((log: any) => ({
    id: log.id,
    date: (log.input as { date?: string })?.date || '',
    stats: log.output as DailyReport['stats'],
    created_at: log.created_at || ''
  }));
}

/**
 * Get watchdog health reports
 */
export async function getWatchdogReports(limit: number = 20): Promise<AgentLog[]> {
  const { data } = await (supabase.from as any)('ai_logs')
    .select('*')
    .eq('type', 'watchdog')
    .order('created_at', { ascending: false })
    .limit(limit);
  
  return (data || []) as unknown as AgentLog[];
}

/**
 * Get agent escalations
 */
export async function getEscalations(limit: number = 20): Promise<AgentLog[]> {
  const { data } = await (supabase.from as any)('ai_logs')
    .select('*')
    .eq('type', 'agent_escalation')
    .order('created_at', { ascending: false })
    .limit(limit);
  
  return (data || []) as unknown as AgentLog[];
}
