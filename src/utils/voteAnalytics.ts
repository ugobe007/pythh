import { supabase } from '../lib/supabase';
import startupData from '../data/startupData';

export interface StartupVoteStats {
  startupId: string; // local startup id (startupData.id)
  totalYesVotes: number;
  totalNoVotes: number;
  recentYesVotes: number; // Last 24 hours
  trendingScore: number;
  lastVoteAt?: string;
}

export interface TrendingStartup {
  startup: any;
  stats: StartupVoteStats;
}

/**
 * Votes table SSOT:
 * - vote (text)
 * - created_at
 * - metadata.startup_local_id
 */
export async function getVoteStats(): Promise<Map<string, StartupVoteStats>> {
  const statsMap = new Map<string, StartupVoteStats>();

  try {
    const { data: votes, error } = await (supabase as any)
      .from('votes')
      .select('vote, created_at, metadata');

    if (error) {
      console.error('Error fetching votes:', error);
      return statsMap;
    }

    if (!votes || votes.length === 0) {
      console.log('No votes found in database');
      return statsMap;
    }

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    votes.forEach((row: any) => {
      const startupId = row?.metadata?.startup_local_id;
      if (!startupId) return;

      const sid = String(startupId);

      if (!statsMap.has(sid)) {
        statsMap.set(sid, {
          startupId: sid,
          totalYesVotes: 0,
          totalNoVotes: 0,
          recentYesVotes: 0,
          trendingScore: 0,
        });
      }

      const stats = statsMap.get(sid)!;

      if (row.vote === 'yes') stats.totalYesVotes++;
      else if (row.vote === 'no') stats.totalNoVotes++;

      const voteDate = new Date(row.created_at);
      if (row.vote === 'yes' && voteDate >= twentyFourHoursAgo) {
        stats.recentYesVotes++;
      }

      if (!stats.lastVoteAt || voteDate > new Date(stats.lastVoteAt)) {
        stats.lastVoteAt = voteDate.toISOString();
      }
    });

    statsMap.forEach((stats) => {
      stats.trendingScore = calculateTrendingScore(stats);
    });

    console.log(`📊 Loaded vote stats for ${statsMap.size} startups`);
    return statsMap;
  } catch (error) {
    console.error('Error in getVoteStats:', error);
    return statsMap;
  }
}

function calculateTrendingScore(stats: StartupVoteStats): number {
  const velocityWeight = 0.7;
  const totalWeight = 0.2;
  const recencyWeight = 0.1;

  const velocityScore = stats.recentYesVotes * 10;
  const totalScore = Math.log10(stats.totalYesVotes + 1) * 20;

  let recencyScore = 0;
  if (stats.lastVoteAt) {
    const hoursSinceLastVote =
      (Date.now() - new Date(stats.lastVoteAt).getTime()) / (1000 * 60 * 60);
    recencyScore = Math.max(0, 100 - hoursSinceLastVote);
  }

  const finalScore =
    velocityScore * velocityWeight +
    totalScore * totalWeight +
    recencyScore * recencyWeight;

  return Math.round(finalScore * 100) / 100;
}

export async function getTrendingStartups(
  limit: number = 10
): Promise<TrendingStartup[]> {
  const statsMap = await getVoteStats();
  const trending: TrendingStartup[] = [];

  statsMap.forEach((stats, startupId) => {
    const startup = startupData.find((s) => s.id.toString() === startupId);
    if (startup) trending.push({ startup, stats });
  });

  trending.sort((a, b) => b.stats.trendingScore - a.stats.trendingScore);
  return trending.slice(0, limit);
}

export async function getTopVotedStartups(
  limit: number = 10
): Promise<TrendingStartup[]> {
  const statsMap = await getVoteStats();
  const top: TrendingStartup[] = [];

  statsMap.forEach((stats, startupId) => {
    const startup = startupData.find((s) => s.id.toString() === startupId);
    if (startup) top.push({ startup, stats });
  });

  top.sort((a, b) => b.stats.totalYesVotes - a.stats.totalYesVotes);
  return top.slice(0, limit);
}

export async function getStartupVoteCount(startupId: string): Promise<number> {
  try {
    const { data, error } = await (supabase as any)
      .from('votes')
      .select('vote, metadata')
      .contains('metadata', { startup_local_id: startupId });

    if (error) {
      console.error('Error fetching vote count:', error);
      return 0;
    }

    return (data ?? []).filter((v: any) => v.vote === 'yes').length;
  } catch (error) {
    console.error('Error in getStartupVoteCount:', error);
    return 0;
  }
}

/**
 * Get recently approved startups from startup_uploads table
 */
export async function getRecentlyApprovedStartups(limit: number = 5): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('startup_uploads')
      .select('*')
      .eq('status', 'approved')
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching approved startups:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getRecentlyApprovedStartups:', error);
    return [];
  }
}
