import OpenAI from 'openai';
import { supabase } from '../config/supabase';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { buildMatchFeatureSnapshot } = require('../../lib/matchFeatureSnapshot') as {
  buildMatchFeatureSnapshot: (opts: {
    engine: string;
    phase?: string | null;
    startup: Record<string, unknown>;
    investor: Record<string, unknown>;
    extra?: Record<string, unknown>;
  }) => Record<string, unknown>;
};

function startupRowForSnapshot(startup: any): Record<string, unknown> {
  return {
    id: startup?.id,
    sectors: startup?.sectors,
    stage: startup?.stage,
    total_god_score: startup?.total_god_score,
    team_score: startup?.team_score,
    traction_score: startup?.traction_score,
    market_score: startup?.market_score,
    product_score: startup?.product_score,
    vision_score: startup?.vision_score,
    maturity_level: startup?.maturity_level,
    data_completeness: startup?.data_completeness,
    has_revenue: !!startup?.has_revenue,
    has_customers: !!startup?.has_customers,
    is_launched: !!startup?.is_launched,
    mrr: startup?.mrr,
    arr: startup?.arr,
    customer_count: startup?.customer_count,
    growth_rate_monthly: startup?.growth_rate_monthly,
  };
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface Startup {
  id: string;
  name: string;
  tagline: string;
  description: string;
  stage: string;
  sector: string;
  funding_raised: number;
  target_raise: number;
  location: string;
}

interface Investor {
  id: string;
  name: string;
  firm: string;
  title: string;
  stage: string[]; // SSOT: Database uses 'stage', not 'stage_focus'
  sectors: string[]; // SSOT: Database uses 'sectors', not 'sector_focus'
  geography_focus: string[];
  check_size_min: number;
  check_size_max: number;
  investment_thesis: string;
  bio: string;
  notable_investments: any;
  portfolio_companies: string[];
}

interface MatchResult {
  investor_id: string;
  match_score: number;
  confidence_level: 'high' | 'medium' | 'low';
  reasoning: string;
  fit_analysis: {
    stage_fit: boolean;
    sector_fit: boolean;
    check_size_fit: boolean;
    geography_fit: boolean;
  };
  intro_email_subject: string;
  intro_email_body: string;
  why_you_match: string[];
}

/**
 * Generate investor matches for a startup using AI
 */
export async function generateMatches(
  startupId: string,
  userId: string,
  limit: number = 5,
  startupData?: any // Accept startup data directly if not in database
): Promise<MatchResult[]> {
  try {
    // 1. Check subscription limit
    const canGenerateMatches = await checkMatchLimit(userId);
    if (!canGenerateMatches) {
      throw new Error('Match limit reached. Please upgrade your subscription.');
    }

    // 2. Get startup details (from database OR from provided data)
    let startup;
    
    if (startupData) {
      // Use provided startup data
      startup = startupData;
    } else {
      // SSOT: Use startup_uploads table (not 'startups')
      const { data: dbStartup, error: startupError } = await supabase
        .from('startup_uploads')
        .select('*')
        .eq('id', startupId)
        .single();

      if (startupError || !dbStartup) {
        throw new Error('Startup not found. Please provide startup data.');
      }
      startup = dbStartup;
    }

    // 3. Get all active investors
    const { data: investors, error: investorsError } = await supabase
      .from('investors')
      .select('*')
      .eq('status', 'active');

    if (investorsError || !investors || investors.length === 0) {
      throw new Error('No active investors found');
    }

    // 4. Calculate match scores for each investor
    const matches: MatchResult[] = [];

    for (const investor of investors) {
      const matchResult = await analyzeMatch(startup, investor);
      matches.push(matchResult);
    }

    // 5. Sort by match score and take top N
    const topMatches = matches
      .sort((a, b) => b.match_score - a.match_score)
      .slice(0, limit);

    // 6. Save matches to database
    for (const match of topMatches) {
      const inv = investors.find((i) => i.id === match.investor_id);
      await saveMatch(startupId, userId, match, startup, inv || ({ id: match.investor_id } as Investor));
    }

    // 7. Log activity
    for (const match of topMatches) {
      await logActivity(match.investor_id, startupId, userId, 'match_generated');
    }

    return topMatches;
  } catch (error) {
    console.error('Error generating matches:', error);
    throw error;
  }
}

/**
 * Analyze match quality between startup and investor using AI
 */
async function analyzeMatch(startup: Startup, investor: Investor): Promise<MatchResult> {
  try {
    // Calculate basic fit (with safe null checks)
    const startupStage = ((startup as any).stage || (startup as any).fundingStage || 'seed').toString().toLowerCase();
    const startupSector = ((startup as any).sector || (startup as any).industry || 'technology').toString().toLowerCase();
    const startupRaise = (startup as any).target_raise || (startup as any).raised || (startup as any).fundingAmount || 0;
    
    const fitAnalysis = {
      stage_fit: Array.isArray(investor.stage) && investor.stage.some(s => 
        startupStage.includes(s.toLowerCase()) || s.toLowerCase().includes(startupStage)
      ),
      sector_fit: Array.isArray(investor.sectors) && investor.sectors.some(s => 
        startupSector.includes(s.toLowerCase()) || s.toLowerCase().includes(startupSector)
      ),
      check_size_fit: 
        (!investor.check_size_min || startupRaise >= investor.check_size_min) &&
        (!investor.check_size_max || startupRaise <= investor.check_size_max),
      geography_fit: true, // Simplified for now
    };

    // Generate AI-powered analysis
    const prompt = `You are an expert venture capital analyst. Analyze this startup-investor match:

STARTUP:
- Name: ${startup.name || 'Unnamed Startup'}
- Tagline: ${(startup as any).tagline || (startup as any).description || 'N/A'}
- Description: ${(startup as any).description || (startup as any).tagline || 'N/A'}
- Stage: ${startupStage}
- Sector: ${startupSector}
- Funding Raised: $${((startup as any).funding_raised || (startup as any).raised || 0).toLocaleString()}
- Target Raise: $${startupRaise.toLocaleString()}
- Location: ${(startup as any).location || 'N/A'}

INVESTOR:
- Name: ${investor.name}
- Firm: ${investor.firm}
- Title: ${investor.title}
- Stage Focus: ${investor.stage?.join(', ') || 'N/A'}
- Sector Focus: ${investor.sectors?.join(', ') || 'N/A'}
- Check Size: $${investor.check_size_min?.toLocaleString() || 0} - $${investor.check_size_max?.toLocaleString() || 0}
- Investment Thesis: ${investor.investment_thesis || 'N/A'}
- Notable Investments: ${JSON.stringify(investor.notable_investments || [])}
- Portfolio Companies: ${investor.portfolio_companies?.join(', ') || 'N/A'}

Provide a JSON response with:
1. match_score (0-100): Overall fit score
2. confidence_level: "high", "medium", or "low"
3. reasoning: 2-3 sentences explaining the match quality
4. why_you_match: Array of 3-5 specific bullet points about fit
5. intro_email_subject: Compelling subject line for intro email
6. intro_email_body: Personalized 2-paragraph intro email (use {founder_name} and {investor_name} placeholders)

Focus on: stage alignment, sector expertise, check size fit, portfolio synergies, and thesis alignment.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert VC analyst. Respond only with valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    const aiResponse = JSON.parse(completion.choices[0].message.content || '{}');

    return {
      investor_id: investor.id,
      match_score: aiResponse.match_score || 50,
      confidence_level: aiResponse.confidence_level || 'medium',
      reasoning: aiResponse.reasoning || 'Match analysis unavailable',
      fit_analysis: fitAnalysis,
      intro_email_subject: aiResponse.intro_email_subject || `Introduction: ${startup.name}`,
      intro_email_body: aiResponse.intro_email_body || 'Intro email unavailable',
      why_you_match: aiResponse.why_you_match || ['Stage alignment', 'Sector fit'],
    };
  } catch (error) {
    console.error('Error analyzing match:', error);
    
    // Use safe field extraction for fallback
    const startupStage = ((startup as any).stage || (startup as any).fundingStage || 'seed').toString().toLowerCase();
    const startupSector = ((startup as any).sector || (startup as any).industry || 'technology').toString().toLowerCase();
    const startupRaise = (startup as any).target_raise || (startup as any).raised || (startup as any).fundingAmount || 0;
    
    // Fallback to basic scoring if AI fails
    let basicScore = 0;
    if (investor.stage?.includes(startupStage)) basicScore += 30;
    if (investor.sectors?.some(s => startupSector.includes(s.toLowerCase()))) basicScore += 30;
    if (startupRaise >= (investor.check_size_min || 0) && startupRaise <= (investor.check_size_max || Infinity)) basicScore += 20;
    basicScore += 20; // Base score

    return {
      investor_id: investor.id,
      match_score: basicScore,
      confidence_level: 'low',
      reasoning: 'Basic algorithmic match (AI analysis unavailable)',
      fit_analysis: {
        stage_fit: investor.stage?.includes(startupStage) || false,
        sector_fit: investor.sectors?.some(s => startupSector.includes(s.toLowerCase())) || false,
        check_size_fit: true,
        geography_fit: true,
      },
      intro_email_subject: `Introduction: ${(startup as any).name || 'Unnamed Startup'} x ${investor.firm}`,
      intro_email_body: `Dear ${investor.name},\n\nI'd like to introduce you to ${(startup as any).name || 'Unnamed Startup'}, a ${startupStage} stage ${startupSector} company.\n\nBest regards`,
      why_you_match: ['Stage alignment', 'Sector focus', 'Check size fit'],
    };
  }
}

/**
 * Save match to database
 */
async function saveMatch(
  startupId: string,
  userId: string,
  match: MatchResult,
  startupRow: any,
  investorRow: Investor
): Promise<void> {
  try {
    // Validate UUIDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    if (!uuidRegex.test(startupId)) {
      console.error(`❌ Invalid startup UUID: ${startupId}`);
      throw new Error('Invalid startup ID format');
    }
    
    // Handle userId - might be email or UUID
    let userUuid = userId;
    if (!uuidRegex.test(userId)) {
      // userId is likely an email - use it directly as string
      // The user_id column might accept text, not just UUID
      console.log(`📧 Using email as user_id: ${userId}`);
      userUuid = userId; // Keep as is - Supabase will handle it
    }
    
    const feature_snapshot = buildMatchFeatureSnapshot({
      engine: 'investor_matching_ai',
      startup: startupRowForSnapshot(startupRow),
      investor: {
        id: investorRow.id,
        sectors: investorRow.sectors,
        stage: investorRow.stage,
        check_size_min: investorRow.check_size_min,
        check_size_max: investorRow.check_size_max,
        geography_focus: (investorRow as any).geography_focus,
        investor_score: (investorRow as any).investor_score,
        investor_tier: (investorRow as any).investor_tier,
      },
    });

    const { error } = await supabase.from('startup_investor_matches').insert({
      startup_id: startupId,
      investor_id: match.investor_id,
      user_id: userUuid,
      match_score: match.match_score,
      confidence_level: match.confidence_level,
      reasoning: match.reasoning,
      fit_analysis: match.fit_analysis,
      intro_email_subject: match.intro_email_subject,
      intro_email_body: match.intro_email_body,
      why_you_match: match.why_you_match,
      status: 'suggested',
      feature_snapshot,
    });

    if (error) {
      console.error('❌ Error saving match:', error);
      throw new Error(`Failed to save match: ${error.message}`);
    }
  } catch (error: any) {
    console.error('❌ Error in saveMatch:', error);
    throw error; // Re-throw to be caught by caller
  }
}

/**
 * Check if user has remaining matches in their subscription
 */
async function checkMatchLimit(userId: string): Promise<boolean> {
  try {
    // For testing: Allow first 3 matches for any user
    // Count existing matches for this user
    const { data: matches, error: countError } = await supabase
      .from('startup_investor_matches')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (countError) {
      console.error('Error counting matches:', countError);
      // Allow matches on error (fail open for testing)
      return true;
    }

    // Free tier: 3 matches per user
    const matchCount = matches?.length || 0;
    const freeLimit = 3;
    
    console.log(`User ${userId} has ${matchCount}/${freeLimit} matches`);
    return matchCount < freeLimit;

  } catch (error) {
    console.error('Error in checkMatchLimit:', error);
    // Allow matches on error (fail open for testing)
    return true;
  }
}

/**
 * Log investor activity
 */
async function logActivity(
  investorId: string,
  startupId: string,
  userId: string,
  actionType: string,
  metadata: any = {}
): Promise<void> {
  try {
    await supabase.rpc('log_investor_activity', {
      p_investor_id: investorId,
      p_startup_id: startupId,
      p_user_id: userId,
      p_action_type: actionType,
      p_metadata: metadata,
    });
  } catch (error) {
    console.error('Error logging activity:', error);
  }
}

/**
 * Get matches for a startup
 */
export async function getMatches(
  startupId: string,
  userId: string
): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('startup_investor_matches')
      .select(`
        *,
        investors:investor_id (
          name,
          firm,
          title,
          photo_url,
          linkedin_url,
          stage,
          sectors,
          notable_investments
        )
      `)
      .eq('startup_id', startupId)
      .eq('user_id', userId)
      .order('match_score', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting matches:', error);
    throw error;
  }
}

/**
 * Mark match as viewed
 */
export async function markMatchViewed(matchId: string): Promise<void> {
  try {
    await supabase
      .from('startup_investor_matches')
      .update({ 
        status: 'viewed',
        viewed_at: new Date().toISOString(),
      })
      .eq('id', matchId);
  } catch (error) {
    console.error('Error marking match as viewed:', error);
  }
}

/**
 * Get match dashboard statistics
 */
export async function getMatchDashboardStats(userId?: string): Promise<{
  total: number;
  pending: number;
  inQueue: number;
  contacted: number;
  byInvestorType: { type: string; count: number }[];
  recentMatches: any[];
}> {
  try {
    // Build query base
    let baseQuery = supabase.from('startup_investor_matches').select('*', { count: 'exact' });
    if (userId) baseQuery = baseQuery.eq('user_id', userId);
    
    // Get total matches
    const { count: total } = await baseQuery;

    // Get pending matches (status = 'suggested')
    let pendingQuery = supabase
      .from('startup_investor_matches')
      .select('*', { count: 'exact' })
      .eq('status', 'suggested');
    if (userId) pendingQuery = pendingQuery.eq('user_id', userId);
    const { count: pending } = await pendingQuery;

    // Get in-queue matches (status = 'in_queue')
    let queueQuery = supabase
      .from('startup_investor_matches')
      .select('*', { count: 'exact' })
      .eq('status', 'in_queue');
    if (userId) queueQuery = queueQuery.eq('user_id', userId);
    const { count: inQueue } = await queueQuery;

    // Get contacted matches
    let contactedQuery = supabase
      .from('startup_investor_matches')
      .select('*', { count: 'exact' })
      .eq('status', 'contacted');
    if (userId) contactedQuery = contactedQuery.eq('user_id', userId);
    const { count: contacted } = await contactedQuery;

    // Get counts by investor type (placeholder until column exists)
    const byInvestorType: { type: string; count: number }[] = [];

    // Get recent matches with investor details
    let recentQuery = supabase
      .from('startup_investor_matches')
      .select(`
        *,
        investors:investor_id (
          name,
          firm,
          photo_url
        )
      `)
      .order('created_at', { ascending: false })
      .limit(10);
    if (userId) recentQuery = recentQuery.eq('user_id', userId);
    const { data: recentMatches } = await recentQuery;

    return {
      total: total || 0,
      pending: pending || 0,
      inQueue: inQueue || 0,
      contacted: contacted || 0,
      byInvestorType,
      recentMatches: recentMatches || [],
    };
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    throw error;
  }
}

/**
 * Get pending matches (status = 'suggested')
 */
export async function getPendingMatches(userId?: string, limit: number = 20): Promise<any[]> {
  try {
    let query = supabase
      .from('startup_investor_matches')
      .select(`
        *,
        investors:investor_id (
          id,
          name,
          firm,
          title,
          photo_url,
          linkedin_url,
          stage,
          sectors,
          check_size_min,
          check_size_max
        )
      `)
      .eq('status', 'suggested')
      .order('match_score', { ascending: false })
      .limit(limit);

    if (userId) query = query.eq('user_id', userId);
    
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting pending matches:', error);
    throw error;
  }
}

/**
 * Get queued matches (status = 'viewed')
 */
export async function getQueuedMatches(userId?: string, limit: number = 20): Promise<any[]> {
  try {
    let query = supabase
      .from('startup_investor_matches')
      .select(`
        *,
        investors:investor_id (
          id,
          name,
          firm,
          title,
          photo_url,
          linkedin_url,
          stage,
          sectors,
          check_size_min,
          check_size_max
        )
      `)
      .eq('status', 'in_queue')
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (userId) query = query.eq('user_id', userId);
    
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting queued matches:', error);
    throw error;
  }
}

/**
 * Get AI-powered match suggestions for startups without matches yet
 */
export async function getMatchSuggestions(userId?: string, limit: number = 10): Promise<any[]> {
  try {
    // Get startups that have few or no matches
    const { data: startups, error: startupsError } = await supabase
      .from('startup_uploads')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (startupsError) throw startupsError;
    if (!startups || startups.length === 0) return [];

    // Get investors
    const { data: investors, error: investorsError } = await supabase
      .from('investors')
      .select('*')
      .eq('status', 'active');

    if (investorsError) throw investorsError;
    if (!investors || investors.length === 0) return [];

    // Generate quick suggestions based on basic matching
    const suggestions: any[] = [];

    for (const startup of startups.slice(0, limit)) {
      // Find best matching investors for this startup
      const matchingInvestors = investors
        .map(investor => {
          let score = 0;
          // Safe string conversion for stage and sector
          const rawStage = startup.stage || startup.funding_stage || 'seed';
          const startupStage = (typeof rawStage === 'string' ? rawStage : String(rawStage)).toLowerCase();
          
          const rawSector = startup.sector || startup.industry || '';
          const startupSector = (typeof rawSector === 'string' ? rawSector : String(rawSector)).toLowerCase();

          // Stage fit
          if (investor.stage?.some((s: string) => startupStage.includes(s.toLowerCase()))) {
            score += 40;
          }
          // Sector fit
          if (investor.sectors?.some((s: string) => startupSector.includes(s.toLowerCase()))) {
            score += 40;
          }
          // Check size fit
          const targetRaise = startup.target_raise || startup.funding_amount || 0;
          if (targetRaise >= (investor.check_size_min || 0) && targetRaise <= (investor.check_size_max || Infinity)) {
            score += 20;
          }

          return { investor, score };
        })
        .filter(m => m.score >= 40)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      if (matchingInvestors.length > 0) {
        suggestions.push({
          startup,
          suggestedInvestors: matchingInvestors.map(m => ({
            ...m.investor,
            match_score: m.score,
          })),
        });
      }
    }

    return suggestions.slice(0, limit);
  } catch (error) {
    console.error('Error getting match suggestions:', error);
    throw error;
  }
}

/**
 * Get all matches organized by date (most recent first)
 */
export async function getAllMatches(userId?: string, limit: number = 50): Promise<any[]> {
  try {
    let query = supabase
      .from('startup_investor_matches')
      .select(`
        *,
        investors:investor_id (
          id,
          name,
          firm,
          title,
          photo_url,
          linkedin_url,
          stage,
          sectors,
          check_size_min,
          check_size_max
        ),
        startups:startup_id (
          id,
          name,
          tagline,
          stage
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Group by date
    const grouped = (data || []).reduce((acc: any, match: any) => {
      const date = new Date(match.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(match);
      return acc;
    }, {});

    // Convert to array format
    return Object.entries(grouped).map(([date, matches]) => ({
      date,
      matches,
    }));
  } catch (error) {
    console.error('Error getting all matches:', error);
    throw error;
  }
}

/**
 * Get all investors filtered by type
 */
export async function getInvestorsByType(
  investorType?: 'vc' | 'angel' | 'family_office' | 'corporate' | 'accelerator',
  limit: number = 50
): Promise<any[]> {
  try {
    let query = supabase
      .from('investors')
      .select(`
        id,
        name,
        firm,
        title,
        email,
        linkedin_url,
        twitter_url,
        photo_url,
        stage,
        sectors,
        geography_focus,
        check_size_min,
        check_size_max,
        investment_thesis,
        bio,
        notable_investments,
        portfolio_companies,
        total_investments,
        successful_exits,
        status,
        is_verified,
        created_at,
        updated_at
      `)
      .eq('status', 'active')
      .order('name', { ascending: true })
      .limit(limit);

    // Note: investor_type column needs to be added via SQL migration
    // For now, return all investors regardless of type filter

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting investors by type:', error);
    throw error;
  }
}

/**
 * Update match status
 */
export async function updateMatchStatus(
  matchId: string, 
  status: 'suggested' | 'viewed' | 'contacted' | 'in_queue' | 'passed' | 'intro_requested'
): Promise<void> {
  try {
    const updates: any = { status, updated_at: new Date().toISOString() };
    
    if (status === 'viewed' || status === 'in_queue') {
      updates.viewed_at = new Date().toISOString();
    } else if (status === 'contacted') {
      updates.contacted_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('startup_investor_matches')
      .update(updates)
      .eq('id', matchId);
      
    if (error) throw error;
    console.log(`✅ Match ${matchId} status updated to: ${status}`);
  } catch (error) {
    console.error('Error updating match status:', error);
    throw error;
  }
}
