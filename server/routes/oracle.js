// --- FILE: server/routes/oracle.js ---
// Oracle API endpoints - Session management, Actions, Insights

const express = require('express');
const router = express.Router();
const { getSupabaseClient } = require('../lib/supabaseClient');
const OpenAI = require('openai');
const { extractInferenceData } = require('../../lib/inference-extractor');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper function to get authenticated user
async function getAuthenticatedUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.slice(7);
  const supabase = getSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    return null;
  }
  
  return user;
}

// ============================================================
// ORACLE SESSIONS - Wizard Progress Tracking
// ============================================================

/**
 * GET /api/oracle/sessions
 * List all sessions for authenticated user
 */
router.get('/sessions', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const supabase = getSupabaseClient();
    const { status, startup_id } = req.query;

    let query = supabase
      .from('oracle_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('last_updated_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (startup_id) {
      query = query.eq('startup_id', startup_id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Oracle Sessions] List error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ sessions: data || [] });
  } catch (error) {
    console.error('[Oracle Sessions] List error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/oracle/sessions/:id
 * Get single session by ID
 */
router.get('/sessions/:id', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('oracle_sessions')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Session not found' });
      }
      console.error('[Oracle Sessions] Get error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ session: data });
  } catch (error) {
    console.error('[Oracle Sessions] Get error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/oracle/sessions
 * Create new wizard session
 */
router.post('/sessions', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { startup_id } = req.body;

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('oracle_sessions')
      .insert({
        user_id: user.id,
        startup_id: startup_id || null,
        status: 'in_progress',
        current_step: 1,
        progress_percentage: 0
      })
      .select()
      .single();

    if (error) {
      console.error('[Oracle Sessions] Create error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.status(201).json({ session: data });
  } catch (error) {
    console.error('[Oracle Sessions] Create error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/oracle/sessions/:id
 * Update session (wizard step data, signal score, etc.)
 */
router.put('/sessions/:id', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const supabase = getSupabaseClient();
    const { 
      current_step,
      step_1_stage, 
      step_2_problem, 
      step_3_solution,
      step_4_traction,
      step_5_team,
      step_6_pitch,
      step_7_vision,
      step_8_market,
      signal_score,
      strengths,
      weaknesses,
      recommendations,
      status
    } = req.body;

    // Build update object with only provided fields
    const updates = {};
    if (current_step !== undefined) updates.current_step = current_step;
    if (step_1_stage !== undefined) updates.step_1_stage = step_1_stage;
    if (step_2_problem !== undefined) updates.step_2_problem = step_2_problem;
    if (step_3_solution !== undefined) updates.step_3_solution = step_3_solution;
    if (step_4_traction !== undefined) updates.step_4_traction = step_4_traction;
    if (step_5_team !== undefined) updates.step_5_team = step_5_team;
    if (step_6_pitch !== undefined) updates.step_6_pitch = step_6_pitch;
    if (step_7_vision !== undefined) updates.step_7_vision = step_7_vision;
    if (step_8_market !== undefined) updates.step_8_market = step_8_market;
    if (signal_score !== undefined) updates.signal_score = signal_score;
    if (strengths !== undefined) updates.strengths = strengths;
    if (weaknesses !== undefined) updates.weaknesses = weaknesses;
    if (recommendations !== undefined) updates.recommendations = recommendations;
    if (status !== undefined) {
      updates.status = status;
      if (status === 'completed') {
        updates.completed_at = new Date().toISOString();
      }
    }

    const { data, error } = await supabase
      .from('oracle_sessions')
      .update(updates)
      .eq('id', req.params.id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('[Oracle Sessions] Update error:', error);
      return res.status(500).json({ error: error.message });
    }

    if (!data) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ session: data });
  } catch (error) {
    console.error('[Oracle Sessions] Update error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/oracle/sessions/:id
 * Delete session
 */
router.delete('/sessions/:id', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('oracle_sessions')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', user.id);

    if (error) {
      console.error('[Oracle Sessions] Delete error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[Oracle Sessions] Delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// ORACLE ACTIONS - Task Management
// ============================================================

/**
 * GET /api/oracle/actions
 * List actions for authenticated user
 */
router.get('/actions', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const supabase = getSupabaseClient();
    const { status, startup_id, session_id, priority } = req.query;

    let query = supabase
      .from('oracle_actions')
      .select('*')
      .eq('user_id', user.id);

    if (status) {
      query = query.eq('status', status);
    }

    if (startup_id) {
      query = query.eq('startup_id', startup_id);
    }

    if (session_id) {
      query = query.eq('session_id', session_id);
    }

    if (priority) {
      query = query.eq('priority', priority);
    }

    // Sort by priority and due date
    query = query.order('display_order', { ascending: true });

    const { data, error } = await query;

    if (error) {
      console.error('[Oracle Actions] List error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ actions: data || [] });
  } catch (error) {
    console.error('[Oracle Actions] List error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/oracle/actions/:id
 * Get single action
 */
router.get('/actions/:id', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('oracle_actions')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Action not found' });
      }
      console.error('[Oracle Actions] Get error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ action: data });
  } catch (error) {
    console.error('[Oracle Actions] Get error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/oracle/actions
 * Create new action
 */
router.post('/actions', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      startup_id,
      session_id,
      title,
      description,
      category,
      priority = 'medium',
      impact_score,
      effort_estimate,
      assigned_to,
      due_date,
      notes
    } = req.body;

    if (!title || !category) {
      return res.status(400).json({ error: 'Title and category are required' });
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('oracle_actions')
      .insert({
        user_id: user.id,
        startup_id: startup_id || null,
        session_id: session_id || null,
        title,
        description: description || null,
        category,
        status: 'pending',
        priority,
        impact_score: impact_score || null,
        effort_estimate: effort_estimate || null,
        assigned_to: assigned_to || null,
        due_date: due_date || null,
        notes: notes || null
      })
      .select()
      .single();

    if (error) {
      console.error('[Oracle Actions] Create error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.status(201).json({ action: data });
  } catch (error) {
    console.error('[Oracle Actions] Create error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/oracle/actions/:id
 * Update action
 */
router.put('/actions/:id', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const supabase = getSupabaseClient();
    const {
      title,
      description,
      status,
      priority,
      impact_score,
      effort_estimate,
      assigned_to,
      due_date,
      blocked_reason,
      notes,
      display_order
    } = req.body;

    // Build update object with only provided fields
    const updates = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (status !== undefined) updates.status = status;
    if (priority !== undefined) updates.priority = priority;
    if (impact_score !== undefined) updates.impact_score = impact_score;
    if (effort_estimate !== undefined) updates.effort_estimate = effort_estimate;
    if (assigned_to !== undefined) updates.assigned_to = assigned_to;
    if (due_date !== undefined) updates.due_date = due_date;
    if (blocked_reason !== undefined) updates.blocked_reason = blocked_reason;
    if (notes !== undefined) updates.notes = notes;
    if (display_order !== undefined) updates.display_order = display_order;

    const { data, error } = await supabase
      .from('oracle_actions')
      .update(updates)
      .eq('id', req.params.id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('[Oracle Actions] Update error:', error);
      return res.status(500).json({ error: error.message });
    }

    if (!data) {
      return res.status(404).json({ error: 'Action not found' });
    }

    res.json({ action: data });
  } catch (error) {
    console.error('[Oracle Actions] Update error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/oracle/actions/:id
 * Delete action
 */
router.delete('/actions/:id', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('oracle_actions')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', user.id);

    if (error) {
      console.error('[Oracle Actions] Delete error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[Oracle Actions] Delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// ORACLE INSIGHTS - AI Coaching & Recommendations
// ============================================================

/**
 * GET /api/oracle/insights
 * List insights for authenticated user
 */
router.get('/insights', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const supabase = getSupabaseClient();
    const { insight_type, startup_id, session_id, dismissed } = req.query;

    let query = supabase
      .from('oracle_insights')
      .select('*')
      .eq('user_id', user.id);

    if (insight_type) {
      query = query.eq('insight_type', insight_type);
    }

    if (startup_id) {
      query = query.eq('startup_id', startup_id);
    }

    if (session_id) {
      query = query.eq('session_id', session_id);
    }

    if (dismissed !== undefined) {
      query = query.eq('is_dismissed', dismissed === 'true');
    } else {
      // Default: only show non-dismissed
      query = query.eq('is_dismissed', false);
    }

    // Sort by pinned first, then severity, then created date
    query = query.order('is_pinned', { ascending: false })
                 .order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('[Oracle Insights] List error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ insights: data || [] });
  } catch (error) {
    console.error('[Oracle Insights] List error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/oracle/insights/:id
 * Get single insight
 */
router.get('/insights/:id', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('oracle_insights')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Insight not found' });
      }
      console.error('[Oracle Insights] Get error:', error);
      return res.status(500).json({ error: error.message });
    }

    // Mark as viewed
    await supabase
      .from('oracle_insights')
      .update({ viewed_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('user_id', user.id);

    res.json({ insight: data });
  } catch (error) {
    console.error('[Oracle Insights] Get error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/oracle/insights
 * Create new insight (typically from AI generation)
 */
router.post('/insights', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      startup_id,
      session_id,
      insight_type,
      title,
      content,
      confidence,
      severity,
      category,
      source = 'oracle_ai',
      model_version,
      related_action_id
    } = req.body;

    if (!insight_type || !title || !content) {
      return res.status(400).json({ 
        error: 'insight_type, title, and content are required' 
      });
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('oracle_insights')
      .insert({
        user_id: user.id,
        startup_id: startup_id || null,
        session_id: session_id || null,
        insight_type,
        title,
        content,
        confidence: confidence || null,
        severity: severity || null,
        category: category || null,
        source,
        model_version: model_version || null,
        related_action_id: related_action_id || null
      })
      .select()
      .single();

    if (error) {
      console.error('[Oracle Insights] Create error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.status(201).json({ insight: data });
  } catch (error) {
    console.error('[Oracle Insights] Create error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/oracle/insights/:id
 * Update insight (dismiss, pin, link action)
 */
router.put('/insights/:id', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const supabase = getSupabaseClient();
    const {
      is_dismissed,
      is_pinned,
      acted_on,
      related_action_id,
      display_order
    } = req.body;

    // Build update object with only provided fields
    const updates = {};
    if (is_dismissed !== undefined) updates.is_dismissed = is_dismissed;
    if (is_pinned !== undefined) updates.is_pinned = is_pinned;
    if (acted_on !== undefined) updates.acted_on = acted_on;
    if (related_action_id !== undefined) updates.related_action_id = related_action_id;
    if (display_order !== undefined) updates.display_order = display_order;

    const { data, error } = await supabase
      .from('oracle_insights')
      .update(updates)
      .eq('id', req.params.id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('[Oracle Insights] Update error:', error);
      return res.status(500).json({ error: error.message });
    }

    if (!data) {
      return res.status(404).json({ error: 'Insight not found' });
    }

    res.json({ insight: data });
  } catch (error) {
    console.error('[Oracle Insights] Update error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/oracle/insights/:id
 * Delete insight
 */
router.delete('/insights/:id', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('oracle_insights')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', user.id);

    if (error) {
      console.error('[Oracle Insights] Delete error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[Oracle Insights] Delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// AI INSIGHT GENERATION
// ============================================================

/**
 * POST /api/oracle/insights/generate
 * Generate AI-powered insights for a session
 * Uses INFERENCE first (free, fast), falls back to OpenAI if needed
 * Body: { session_id, startup_id, context? }
 */
router.post('/insights/generate', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { session_id, startup_id, context } = req.body;

    if (!session_id || !startup_id) {
      return res.status(400).json({ error: 'session_id and startup_id are required' });
    }

    // Fetch session data to analyze
    const supabase = getSupabaseClient();
    const { data: session, error: sessionError } = await supabase
      .from('oracle_sessions')
      .select('*')
      .eq('id', session_id)
      .eq('user_id', user.id)
      .single();

    if (sessionError || !session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Fetch startup data from startup_uploads table
    const { data: startup, error: startupError } = await supabase
      .from('startup_uploads')
      .select('name, industry, stage, team_size, total_god_score, problem, solution, value_proposition, team, traction, website, extracted_data')
      .eq('id', startup_id)
      .single();

    if (startupError || !startup) {
      return res.status(404).json({ error: 'Startup not found' });
    }

    // ========================================================================
    // PHASE 1: INFERENCE ENGINE (Free, Fast)
    // ========================================================================
    console.log('[Oracle AI] Phase 1: Running inference engine...');
    
    const inferenceInsights = [];
    
    // Build text corpus for inference
    const textCorpus = [
      startup.problem,
      startup.solution,
      startup.value_proposition,
      startup.team,
      startup.traction,
      JSON.stringify(session.wizard_data || {})
    ].filter(Boolean).join(' ');

    // Run inference extraction
    const inferenceData = extractInferenceData(textCorpus, startup.website || '');
    
    // Generate insights from inference data
    
    // 1. Team signals
    if (inferenceData.team_signals && inferenceData.team_signals.length > 0) {
      inferenceInsights.push({
        type: 'strength',
        title: 'Strong team credentials',
        description: `Team shows ${inferenceData.team_signals.length} strong signals: ${inferenceData.team_signals.slice(0, 2).join(', ')}. This credibility helps with fundraising and customer trust.`,
        confidence: 0.8,
        priority: 'high',
        action_items: [
          'Highlight team credentials in pitch deck',
          'Leverage founder networks for warm intros'
        ]
      });
    } else if (startup.team_size < 3) {
      inferenceInsights.push({
        type: 'team_gap',
        title: 'Small team size',
        description: `With only ${startup.team_size || 1} team members, consider adding complementary skills. Most successful startups have 2-3 co-founders with diverse expertise.`,
        confidence: 0.75,
        priority: 'medium',
        action_items: [
          'Identify skill gaps in current team',
          'Consider adding technical/business co-founder'
        ]
      });
    }

    // 2. Execution signals
    if (inferenceData.execution_signals && inferenceData.execution_signals.length > 0) {
      inferenceInsights.push({
        type: 'strength',
        title: 'Execution momentum detected',
        description: `Strong execution signals found: ${inferenceData.execution_signals.slice(0, 2).join(', ')}. This demonstrates product-market validation and operational capability.`,
        confidence: 0.85,
        priority: 'high',
        action_items: [
          'Document these milestones in pitch',
          'Use as proof points in investor conversations'
        ]
      });
    }

    // 3. Traction analysis
    if (inferenceData.has_revenue) {
      inferenceInsights.push({
        type: 'strength',
        title: 'Revenue generating',
        description: 'Company has achieved revenue, indicating product-market fit and willingness to pay. This dramatically improves fundraising odds.',
        confidence: 0.9,
        priority: 'high',
        action_items: [
          'Calculate and track MRR/ARR metrics',
          'Measure customer acquisition cost (CAC) and lifetime value (LTV)'
        ]
      });
    } else if (inferenceData.has_customers) {
      inferenceInsights.push({
        type: 'traction_gap',
        title: 'Revenue opportunity',
        description: 'You have customers but no clear revenue signal. Consider monetization strategy to strengthen fundraising position.',
        confidence: 0.75,
        priority: 'high',
        action_items: [
          'Test pricing with current customers',
          'Build case studies from successful users'
        ]
      });
    } else {
      inferenceInsights.push({
        type: 'traction_gap',
        title: 'Need early traction',
        description: 'No clear customer or revenue signals detected. Focus on acquiring 10-20 beta users with measurable engagement before serious fundraising.',
        confidence: 0.8,
        priority: 'critical',
        action_items: [
          'Launch beta program with clear success metrics',
          'Build waitlist and gather pre-launch interest'
        ]
      });
    }

    // 4. GOD Score analysis
    if (startup.total_god_score) {
      if (startup.total_god_score >= 70) {
        inferenceInsights.push({
          type: 'strength',
          title: 'Strong overall profile',
          description: `GOD Score of ${startup.total_god_score}/100 puts you in top tier. This profile should attract quality investors. Focus on targeting the right VCs for your sector.`,
          confidence: 0.85,
          priority: 'high',
          action_items: [
            'Research VCs with portfolio matches',
            'Seek warm introductions from existing portfolio founders'
          ]
        });
      } else if (startup.total_god_score < 50) {
        inferenceInsights.push({
          type: 'weakness',
          title: 'Profile needs strengthening',
          description: `GOD Score of ${startup.total_god_score}/100 indicates key gaps. Focus on strengthening weakest areas before approaching top-tier investors.`,
          confidence: 0.8,
          priority: 'high',
          action_items: [
            'Identify lowest GOD score component',
            'Set 30-day goals to improve weakest metric'
          ]
        });
      }
    }

    // 5. Funding analysis
    if (inferenceData.funding_amount && inferenceData.funding_amount > 0) {
      inferenceInsights.push({
        type: 'strength',
        title: 'Prior funding secured',
        description: `Previous funding of ~$${(inferenceData.funding_amount / 1000000).toFixed(1)}M shows investor validation and de-risks next round.`,
        confidence: 0.85,
        priority: 'medium',
        action_items: [
          'Showcase existing investor credibility',
          'Highlight progress since last round'
        ]
      });
    }

    console.log(`[Oracle AI] Phase 1 complete: Generated ${inferenceInsights.length} inference-based insights`);

    // ========================================================================
    // PHASE 2: OpenAI Enhancement (Only if needed)
    // ========================================================================
    let aiInsights = [];
    
    // Only call OpenAI if:
    // - We have rich wizard data that inference can't fully analyze
    // - User explicitly requested deep analysis (via context param)
    // - We got fewer than 3 insights from inference
    const shouldCallOpenAI = (
      (session.wizard_data && Object.keys(session.wizard_data).length > 5) ||
      context?.includes('deep') ||
      inferenceInsights.length < 3
    );

    if (shouldCallOpenAI && process.env.OPENAI_API_KEY) {
      console.log('[Oracle AI] Phase 2: Calling OpenAI for deep analysis...');
      
      const wizardContext = {
        startup_name: startup.name,
        industry: startup.industry,
        stage: startup.stage || session.stage,
        team_size: startup.team_size,
        god_score: startup.total_god_score,
        current_step: session.current_step,
        progress: session.progress_percentage,
        problem: startup.problem,
        solution: startup.solution,
        value_prop: startup.value_proposition,
        team: startup.team,
        traction: startup.traction,
        wizard_data: session.wizard_data,
        additional_context: context,
        inference_signals: {
          team: inferenceData.team_signals,
          execution: inferenceData.execution_signals,
          has_customers: inferenceData.has_customers,
          has_revenue: inferenceData.has_revenue,
        }
      };

      const prompt = `You are the Oracle - an elite startup advisor. Analyze this startup and provide 2-3 ADDITIONAL insights beyond basic patterns.

STARTUP PROFILE:
Name: ${wizardContext.startup_name}
Stage: ${wizardContext.stage}
GOD Score: ${wizardContext.god_score}/100

WIZARD DATA: ${JSON.stringify(wizardContext.wizard_data || {}, null, 2)}

INFERENCE ALREADY DETECTED:
- Team signals: ${inferenceData.team_signals?.length || 0}
- Execution signals: ${inferenceData.execution_signals?.length || 0}
- Has customers: ${inferenceData.has_customers ? 'Yes' : 'No'}
- Has revenue: ${inferenceData.has_revenue ? 'Yes' : 'No'}

Provide 2-3 DEEPER insights focusing on:
- Strategic positioning and market timing
- Hidden risks or opportunities in wizard responses
- Specific tactical advice based on stage and data quality

JSON format:
{
  "insights": [
    {
      "type": "opportunity|recommendation|risk|market_insight|product_insight|go_to_market",
      "title": "Brief title",
      "description": "2-3 specific sentences",
      "confidence": 0.0-1.0,
      "priority": "high|medium|low",
      "action_items": ["Action 1", "Action 2"]
    }
  ]
}`;

      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: 'You are an elite startup advisor. Return valid JSON only.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 1500,
        });

        const responseText = completion.choices[0].message.content.trim();
        const jsonMatch = responseText.match(/```json\n?([\s\S]*?)\n?```/);
        const jsonText = jsonMatch ? jsonMatch[1] : responseText;
        const parsedResponse = JSON.parse(jsonText);
        
        aiInsights = parsedResponse.insights || [];
        console.log(`[Oracle AI] Phase 2 complete: Generated ${aiInsights.length} AI-enhanced insights`);
      } catch (aiError) {
        console.warn('[Oracle AI] OpenAI call failed, continuing with inference only:', aiError.message);
      }
    } else {
      console.log('[Oracle AI] Phase 2 skipped: Inference provided sufficient insights');
    }

    // ========================================================================
    // PHASE 3: Save to Database
    // ========================================================================
    const allInsights = [...inferenceInsights, ...aiInsights];
    
    const insightsToCreate = allInsights.map(insight => ({
      user_id: user.id,
      session_id: session_id,
      startup_id: startup_id,
      insight_type: insight.type,
      title: insight.title,
      description: insight.description,
      confidence: insight.confidence,
      priority: insight.priority,
      action_items: insight.action_items,
      metadata: {
        generated_by: aiInsights.includes(insight) ? 'openai' : 'inference',
        model: aiInsights.includes(insight) ? 'gpt-4o' : 'inference-engine',
        wizard_step: session.current_step,
        god_score: startup.total_god_score,
        inference_signals: {
          team: inferenceData.team_signals?.length || 0,
          execution: inferenceData.execution_signals?.length || 0,
        }
      }
    }));

    const { data: createdInsights, error: insertError } = await supabase
      .from('oracle_insights')
      .insert(insightsToCreate)
      .select();

    if (insertError) {
      console.error('[Oracle AI] Insert error:', insertError);
      return res.status(500).json({ error: insertError.message });
    }

    console.log(`[Oracle AI] ✅ Success: ${inferenceInsights.length} inference + ${aiInsights.length} AI = ${createdInsights.length} total insights`);

    res.json({
      success: true,
      insights: createdInsights,
      count: createdInsights.length,
      breakdown: {
        inference: inferenceInsights.length,
        ai: aiInsights.length
      }
    });

  } catch (error) {
    console.error('[Oracle AI] Generation error:', error);
    res.status(500).json({
      error: error.message,
      details: error.response?.data || error.stack
    });
  }
});

module.exports = router;
