// --- FILE: server/routes/oracle.js ---
// Oracle API endpoints - Session management, Actions, Insights

const express = require('express');
const router = express.Router();
const { getSupabaseClient } = require('../lib/supabaseClient');
const OpenAI = require('openai');
const { extractInferenceData } = require('../../lib/inference-extractor');
const { oracleMemory } = require('../lib/oracleMemoryStore');

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
 * Get single session by ID (from memory if available)
 */
router.get('/sessions/:id', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const sessionId = req.params.id;

    // Try memory first
    let memSession = oracleMemory.getSession(sessionId);
    
    if (!memSession) {
      // Load from database and cache in memory
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('oracle_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ error: 'Session not found' });
        }
        console.error('[Oracle Sessions] Get error:', error);
        return res.status(500).json({ error: error.message });
      }

      // Load into memory
      memSession = oracleMemory.loadFromDb(data);
    }

    // Return session data (from memory or freshly loaded)
    res.json({ 
      session: {
        id: memSession.sessionId,
        user_id: memSession.userId,
        startup_id: memSession.startupId,
        current_step: memSession.currentStep,
        progress_percentage: memSession.metadata.progressPercentage,
        status: 'in_progress', // Could be enhanced to store this in memory
        ...memSession.steps,
        signal_score: memSession.computed?.signalScore,
        strengths: memSession.computed?.strengths,
        weaknesses: memSession.computed?.weaknesses,
        recommendations: memSession.computed?.recommendations,
      }
    });
  } catch (error) {
    console.error('[Oracle Sessions] Get error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/oracle/sessions
 * Create new wizard session (saved to DB and memory)
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

    // Initialize in memory for fast access
    oracleMemory.initSession(data.id, user.id, startup_id || null);
    console.log(`[Oracle API] Session ${data.id} created and loaded into memory`);

    res.status(201).json({ session: data });
  } catch (error) {
    console.error('[Oracle Sessions] Create error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/oracle/sessions/:id
 * Update session (writes to memory, persists to DB)
 */
router.put('/sessions/:id', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const sessionId = req.params.id;
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

    // Update memory first (fast, no file paths)
    let memSession = oracleMemory.getSession(sessionId);
    
    if (!memSession) {
      // Load from database if not in memory
      const supabase = getSupabaseClient();
      const { data: sessionData, error: fetchError } = await supabase
        .from('oracle_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .single();

      if (fetchError || !sessionData) {
        return res.status(404).json({ error: 'Session not found' });
      }

      memSession = oracleMemory.loadFromDb(sessionData);
    }

    // Update step data in memory
    if (current_step) {
      const stepData = {};
      if (step_1_stage) Object.assign(stepData, step_1_stage);
      if (step_2_problem) Object.assign(stepData, step_2_problem);
      if (step_3_solution) Object.assign(stepData, step_3_solution);
      if (step_4_traction) Object.assign(stepData, step_4_traction);
      if (step_5_team) Object.assign(stepData, step_5_team);
      if (step_6_pitch) Object.assign(stepData, step_6_pitch);
      if (step_7_vision) Object.assign(stepData, step_7_vision);
      if (step_8_market) Object.assign(stepData, step_8_market);

      oracleMemory.updateStep(sessionId, current_step, stepData);
    }

    // Update computed data in memory
    if (signal_score || strengths || weaknesses || recommendations) {
      oracleMemory.updateComputed(sessionId, {
        signalScore: signal_score,
        strengths,
        weaknesses,
        recommendations,
      });
    }

    // Persist to database
    const dbData = oracleMemory.getSessionForDb(sessionId);
    if (status) dbData.status = status;
    if (status === 'completed') dbData.completed_at = new Date().toISOString();

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('oracle_sessions')
      .update(dbData)
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('[Oracle Sessions] Update error:', error);
      return res.status(500).json({ error: error.message });
    }

    // Mark as saved in memory
    oracleMemory.markSaved(sessionId);
    console.log(`[Oracle API] Session ${sessionId} updated (memory → DB)`);

    res.json({ session: data });
  } catch (error) {
    console.error('[Oracle Sessions] Update error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/oracle/sessions/:id
 * Delete session (from DB and memory)
 */
router.delete('/sessions/:id', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const sessionId = req.params.id;

    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('oracle_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('user_id', user.id);

    if (error) {
      console.error('[Oracle Sessions] Delete error:', error);
      return res.status(500).json({ error: error.message });
    }

    // Clear from memory
    oracleMemory.clearSession(sessionId);
    console.log(`[Oracle API] Session ${sessionId} deleted (DB + memory)`);

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
 * 
 * MEMORY-OPTIMIZED: Reads from memory store, no file path lookups
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

    // GET SESSION FROM MEMORY (no file paths, no DB lookup)
    let session = oracleMemory.getSession(session_id);
    
    if (!session) {
      // Load from database if not in memory
      const supabase = getSupabaseClient();
      const { data: sessionData, error: sessionError } = await supabase
        .from('oracle_sessions')
        .select('*')
        .eq('id', session_id)
        .eq('user_id', user.id)
        .single();

      if (sessionError || !sessionData) {
        return res.status(404).json({ error: 'Session not found' });
      }

      session = oracleMemory.loadFromDb(sessionData);
    }

    // Verify user owns this session
    if (session.userId !== user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    console.log(`[Oracle AI] Using session data from memory (${Object.keys(session.steps).length} fields loaded)`);

    // Fetch startup data from startup_uploads table
    const supabase = getSupabaseClient();
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
    
    // Build text corpus for inference FROM MEMORY (no file paths!)
    const sessionFields = session.steps;
    const textCorpus = [
      startup.problem,
      startup.solution,
      startup.value_proposition,
      startup.team,
      startup.traction,
      sessionFields.problem_statement,
      sessionFields.solution_description,
      sessionFields.elevator_pitch,
      sessionFields.vision_statement,
      JSON.stringify(sessionFields)
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

// ============================================================
// MEMORY STATS - Monitor performance
// ============================================================

/**
 * GET /api/oracle/memory/stats
 * Get memory store statistics
 */
router.get('/memory/stats', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const stats = oracleMemory.getStats();
    const userSessions = oracleMemory.getUserSessions(user.id);

    res.json({
      ...stats,
      yourSessions: userSessions.length,
      yourSessionIds: userSessions.map(s => s.sessionId),
    });
  } catch (error) {
    console.error('[Oracle Memory] Stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/oracle/notifications
 * Fetch user's notifications
 * Query params: limit (default 20), unread_only (default false)
 */
router.get('/notifications', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { limit = 20, unread_only = 'false' } = req.query;
    const supabase = getSupabaseClient();

    let query = supabase
      .from('oracle_notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (unread_only === 'true') {
      query = query.eq('is_read', false);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch notifications: ${error.message}`);
    }

    res.json({ notifications: data || [] });
  } catch (error) {
    console.error('[Oracle Notifications] Fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/oracle/notifications/unread-count
 * Get count of unread notifications
 */
router.get('/notifications/unread-count', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const supabase = getSupabaseClient();

    const { count, error } = await supabase
      .from('oracle_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    if (error) {
      throw new Error(`Failed to count notifications: ${error.message}`);
    }

    res.json({ unreadCount: count || 0 });
  } catch (error) {
    console.error('[Oracle Notifications] Count error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/oracle/notifications/:id/mark-read
 * Mark notification as read
 */
router.put('/notifications/:id/mark-read', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('oracle_notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to mark notification as read: ${error.message}`);
    }

    res.json({ notification: data });
  } catch (error) {
    console.error('[Oracle Notifications] Mark read error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/oracle/notifications/mark-all-read
 * Mark all notifications as read
 */
router.put('/notifications/mark-all-read', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('oracle_notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .eq('is_read', false)
      .select();

    if (error) {
      throw new Error(`Failed to mark all as read: ${error.message}`);
    }

    res.json({ updatedCount: data?.length || 0 });
  } catch (error) {
    console.error('[Oracle Notifications] Mark all read error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// Score History
// ============================================================================

/**
 * GET /api/oracle/score-history
 * Fetch user's score history with stats
 */
router.get('/score-history', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    const { startup_id } = req.query;

    // Build query
    let query = supabase
      .from('oracle_score_history')
      .select('*')
      .eq('user_id', user.id)
      .order('recorded_at', { ascending: true });

    if (startup_id) {
      query = query.eq('startup_id', startup_id);
    }

    const { data: history, error } = await query;

    if (error) {
      console.error('[Oracle Score History] Fetch error:', error);
      return res.status(500).json({ error: error.message });
    }

    // Calculate stats
    let stats = null;
    if (history && history.length > 0) {
      const currentScore = history[history.length - 1].total_score;
      const previousScore = history.length > 1 ? history[history.length - 2].total_score : null;
      const change = previousScore !== null ? currentScore - previousScore : null;

      // Determine trend (last 3 entries)
      let trend = null;
      if (history.length >= 3) {
        const recent = history.slice(-3).map(h => h.total_score);
        const increasing = recent[1] > recent[0] && recent[2] > recent[1];
        const decreasing = recent[1] < recent[0] && recent[2] < recent[1];
        trend = increasing ? 'up' : decreasing ? 'down' : 'stable';
      }

      // Calculate percentile (simplified - compare to all users)
      const { data: allScores } = await supabase
        .from('oracle_score_history')
        .select('total_score')
        .order('recorded_at', { ascending: false })
        .limit(1000);  // Sample for performance

      let percentile = null;
      if (allScores && allScores.length > 0) {
        const scores = allScores.map(s => s.total_score);
        const uniqueScores = [...new Set(scores)].sort((a, b) => b - a);
        const rank = uniqueScores.findIndex(s => s <= currentScore) + 1;
        percentile = Math.round((rank / uniqueScores.length) * 100);
      }

      stats = {
        currentScore,
        previousScore,
        change,
        percentile,
        trend,
      };
    }

    res.json({
      history: history || [],
      stats,
    });
  } catch (error) {
    console.error('[Oracle Score History] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/oracle/score-history
 * Record a new score entry (called after wizard completion or score update)
 */
router.post('/score-history', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    const {
      startup_id,
      session_id,
      total_score,
      breakdown,
      milestone,
      notes,
    } = req.body;

    // Validation
    if (!total_score || total_score < 0 || total_score > 100) {
      return res.status(400).json({ error: 'Invalid total_score (must be 0-100)' });
    }

    // Insert score entry
    const { data, error } = await supabase
      .from('oracle_score_history')
      .insert({
        user_id: user.id,
        startup_id: startup_id || null,
        session_id: session_id || null,
        total_score,
        breakdown: breakdown || null,
        milestone: milestone || null,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) {
      console.error('[Oracle Score History] Insert error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ scoreEntry: data });
  } catch (error) {
    console.error('[Oracle Score History] Create error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// Milestones & Achievements
// ============================================================================

/**
 * GET /api/oracle/milestones
 * Fetch user's milestones (achieved and potential)
 */
router.get('/milestones', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    const { achieved_only = 'false' } = req.query;

    let query = supabase
      .from('oracle_milestones')
      .select('*')
      .eq('user_id', user.id)
      .order('achieved_at', { ascending: false, nullsFirst: false });

    if (achieved_only === 'true') {
      query = query.not('achieved_at', 'is', null);
    }

    const { data: milestones, error } = await query;

    if (error) {
      console.error('[Oracle Milestones] Fetch error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ milestones: milestones || [] });
  } catch (error) {
    console.error('[Oracle Milestones] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/oracle/milestones
 * Award a milestone to the user
 */
router.post('/milestones', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    const {
      milestone_type,
      title,
      description,
      icon,
      reward_text,
      reward_action_url,
    } = req.body;

    // Check if milestone already exists
    const { data: existing } = await supabase
      .from('oracle_milestones')
      .select('id, achieved_at')
      .eq('user_id', user.id)
      .eq('milestone_type', milestone_type)
      .maybeSingle();

    if (existing) {
      // If already achieved, return existing
      if (existing.achieved_at) {
        return res.json({
          milestone: existing,
          alreadyAchieved: true,
        });
      }
      
      // Update to achieved
      const { data: updated, error: updateError } = await supabase
        .from('oracle_milestones')
        .update({
          achieved_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (updateError) {
        console.error('[Oracle Milestones] Update error:', updateError);
        return res.status(500).json({ error: updateError.message });
      }

      return res.json({
        milestone: updated,
        newlyAchieved: true,
      });
    }

    // Create new milestone
    const { data: milestone, error } = await supabase
      .from('oracle_milestones')
      .insert({
        user_id: user.id,
        milestone_type,
        title,
        description: description || null,
        icon: icon || null,
        reward_text: reward_text || null,
        reward_action_url: reward_action_url || null,
        achieved_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('[Oracle Milestones] Create error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({
      milestone,
      newlyAchieved: true,
    });
  } catch (error) {
    console.error('[Oracle Milestones] Award error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/oracle/milestones/:id/celebrate
 * Mark milestone as celebrated (user saw the modal)
 */
router.put('/milestones/:id/celebrate', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    const { id } = req.params;

    const { data, error } = await supabase
      .from('oracle_milestones')
      .update({
        is_celebrated: true,
        celebrated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('[Oracle Milestones] Celebrate error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ milestone: data });
  } catch (error) {
    console.error('[Oracle Milestones] Celebrate error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/oracle/milestones/check
 * Check if user has achieved any new milestones based on current data
 */
router.get('/milestones/check', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    const newMilestones = [];

    // Get current session/action/score data
    const [sessionsResult, actionsResult, scoresResult] = await Promise.all([
      supabase
        .from('oracle_sessions')
        .select('id, status')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .maybeSingle(),
      supabase
        .from('oracle_actions')
        .select('id, status')
        .eq('user_id', user.id)
        .eq('status', 'completed'),
      supabase
        .from('oracle_score_history')
        .select('total_score')
        .eq('user_id', user.id)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const hasCompletedWizard = !!sessionsResult.data;
    const completedActionsCount = actionsResult.data?.length || 0;
    const latestScore = scoresResult.data?.total_score || 0;

    // Check wizard complete
    if (hasCompletedWizard) {
      const milestone = await awardMilestoneIfNew(user.id, {
        milestone_type: 'wizard_complete',
        title: 'Oracle Wizard Complete',
        description: 'You completed the full Oracle assessment',
        icon: '🏆',
        reward_text: 'Unlocked: AI Insights & Weekly Digests',
        reward_action_url: '/app/oracle/dashboard',
      });
      if (milestone) newMilestones.push(milestone);
    }

    // Check 5 actions done
    if (completedActionsCount >= 5) {
      const milestone = await awardMilestoneIfNew(user.id, {
        milestone_type: '5_actions_done',
        title: '5 Actions Completed',
        description: 'You completed 5 recommended actions',
        icon: '🎯',
        reward_text: 'Unlocked: Priority Action Insights',
      });
      if (milestone) newMilestones.push(milestone);
    }

    // Check score milestones
    if (latestScore >= 70) {
      const milestone = await awardMilestoneIfNew(user.id, {
        milestone_type: 'score_70_plus',
        title: 'Fundable Score',
        description: 'Your score reached the "Fundable" threshold',
        icon: '⭐',
        reward_text: 'Unlocked: Investor Matching',
        reward_action_url: '/app/matches',
      });
      if (milestone) newMilestones.push(milestone);
    }

    if (latestScore >= 80) {
      const milestone = await awardMilestoneIfNew(user.id, {
        milestone_type: 'score_80_plus',
        title: 'High Performer',
        description: 'Your score is in the top tier',
        icon: '🌟',
        reward_text: 'Unlocked: Premium Features',
      });
      if (milestone) newMilestones.push(milestone);
    }

    if (latestScore >= 90) {
      const milestone = await awardMilestoneIfNew(user.id, {
        milestone_type: 'score_90_plus',
        title: 'Elite Startup',
        description: 'Your score is exceptional',
        icon: '⚡',
        reward_text: 'Unlocked: VIP Advisor Access',
      });
      if (milestone) newMilestones.push(milestone);
    }

    res.json({
      newMilestones,
      checked: true,
    });
  } catch (error) {
    console.error('[Oracle Milestones] Check error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to award milestone if not already achieved
async function awardMilestoneIfNew(userId, milestoneData) {
  const { data: existing } = await supabase
    .from('oracle_milestones')
    .select('id, achieved_at')
    .eq('user_id', userId)
    .eq('milestone_type', milestoneData.milestone_type)
    .maybeSingle();

  if (existing && existing.achieved_at) {
    return null;  // Already achieved
  }

  if (existing) {
    // Update existing to achieved
    const { data: updated } = await supabase
      .from('oracle_milestones')
      .update({ achieved_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single();
    return updated;
  }

  // Create new
  const { data: newMilestone } = await supabase
    .from('oracle_milestones')
    .insert({
      user_id: userId,
      ...milestoneData,
      achieved_at: new Date().toISOString(),
    })
    .select()
    .single();

  return newMilestone;
}

// ============================================================================
// Email Tracking & Analytics
// ============================================================================

/**
 * GET /api/oracle/email/track/open/:email_send_id
 * 1x1 transparent tracking pixel for email opens
 */
router.get('/email/track/open/:email_send_id', async (req, res) => {
  try {
    const { email_send_id } = req.params;

    // Mark email as opened
    await supabase.rpc('mark_oracle_email_opened', {
      p_email_send_id: email_send_id,
    });

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
 * Click tracking + redirect to destination
 */
router.get('/email/track/click/:email_send_id', async (req, res) => {
  try {
    const { email_send_id } = req.params;
    const { url, type, label } = req.query;

    if (!url) {
      return res.redirect('/app/oracle/dashboard');
    }

    // Record click (non-blocking)
    supabase.rpc('record_oracle_email_click', {
      p_email_send_id: email_send_id,
      p_link_url: url,
      p_link_type: type || null,
      p_link_label: label || null,
    }).catch(err => console.error('[Email Tracking] Click error:', err));

    // Redirect immediately
    res.redirect(url);
  } catch (error) {
    console.error('[Email Tracking] Click tracking error:', error);
    res.redirect(req.query.url || '/app/oracle/dashboard');
  }
});

/**
 * GET /api/oracle/email/analytics
 * Get email engagement analytics for current user
 */
router.get('/email/analytics', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);

    // Fetch email sends
    const { data: sends, error: sendsError } = await supabase
      .from('oracle_email_sends')
      .select('*')
      .eq('user_id', user.id)
      .order('sent_at', { ascending: false })
      .limit(50);

    if (sendsError) throw sendsError;

    // Calculate stats
    const totalSent = sends.length;
    const totalOpened = sends.filter(s => s.opened_at).length;
    const totalClicked = sends.filter(s => s.first_click_at).length;
    const openRate = totalSent > 0 ? (totalOpened / totalSent) * 100 : 0;
    const clickRate = totalSent > 0 ? (totalClicked / totalSent) * 100 : 0;

    // Fetch recent clicks
    const { data: clicks } = await supabase
      .from('oracle_email_clicks')
      .select('*')
      .eq('user_id', user.id)
      .order('clicked_at', { ascending: false })
      .limit(20);

    res.json({
      stats: {
        totalSent,
        totalOpened,
        totalClicked,
        openRate: Math.round(openRate * 10) / 10,
        clickRate: Math.round(clickRate * 10) / 10,
      },
      recentSends: sends.slice(0, 10),
      recentClicks: clicks || [],
    });
  } catch (error) {
    console.error('[Email Analytics] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// Oracle Scribe (Journal)
// ============================================================================

/**
 * GET /api/oracle/scribe/entries
 * Fetch user's journal entries
 */
router.get('/scribe/entries', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    const { startup_id, limit = 50, type, tags } = req.query;

    let query = supabase
      .from('oracle_scribe_entries')
      .select('*')
      .eq('user_id', user.id)
      .order('entry_date', { ascending: false })
      .limit(parseInt(limit));

    if (startup_id) {
      query = query.eq('startup_id', startup_id);
    }

    if (type) {
      query = query.eq('entry_type', type);
    }

    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : [tags];
      query = query.overlaps('tags', tagArray);
    }

    const { data: entries, error } = await query;

    if (error) {
      console.error('[Oracle Scribe] Fetch entries error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ entries: entries || [] });
  } catch (error) {
    console.error('[Oracle Scribe] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/oracle/scribe/entries
 * Create new journal entry
 */
router.post('/scribe/entries', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    const {
      startup_id,
      session_id,
      title,
      content,
      entry_type,
      tags,
      category,
      mood,
      energy_level,
      entry_date,
      is_private,
    } = req.body;

    // Validation
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content required' });
    }

    // Create entry
    const { data: entry, error } = await supabase
      .from('oracle_scribe_entries')
      .insert({
        user_id: user.id,
        startup_id: startup_id || null,
        session_id: session_id || null,
        title,
        content,
        entry_type: entry_type || 'general',
        tags: tags || null,
        category: category || null,
        mood: mood || null,
        energy_level: energy_level || null,
        entry_date: entry_date || new Date().toISOString().split('T')[0],
        is_private: is_private || false,
      })
      .select()
      .single();

    if (error) {
      console.error('[Oracle Scribe] Create entry error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ entry });
  } catch (error) {
    console.error('[Oracle Scribe] Create error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/oracle/scribe/entries/:id
 * Update journal entry
 */
router.put('/scribe/entries/:id', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    const { id } = req.params;
    const {
      title,
      content,
      entry_type,
      tags,
      category,
      mood,
      energy_level,
      is_private,
      is_pinned,
    } = req.body;

    const updates = {};
    if (title !== undefined) updates.title = title;
    if (content !== undefined) updates.content = content;
    if (entry_type !== undefined) updates.entry_type = entry_type;
    if (tags !== undefined) updates.tags = tags;
    if (category !== undefined) updates.category = category;
    if (mood !== undefined) updates.mood = mood;
    if (energy_level !== undefined) updates.energy_level = energy_level;
    if (is_private !== undefined) updates.is_private = is_private;
    if (is_pinned !== undefined) updates.is_pinned = is_pinned;
    updates.updated_at = new Date().toISOString();

    const { data: entry, error } = await supabase
      .from('oracle_scribe_entries')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('[Oracle Scribe] Update entry error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ entry });
  } catch (error) {
    console.error('[Oracle Scribe] Update error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/oracle/scribe/entries/:id
 * Delete journal entry
 */
router.delete('/scribe/entries/:id', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    const { id } = req.params;

    const { error } = await supabase
      .from('oracle_scribe_entries')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('[Oracle Scribe] Delete entry error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ deleted: true });
  } catch (error) {
    console.error('[Oracle Scribe] Delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/oracle/scribe/entries/:id/analyze
 * Analyze journal entry and generate insights/actions
 */
router.post('/scribe/entries/:id/analyze', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    const { id } = req.params;

    // Fetch entry
    const { data: entry, error: entryError } = await supabase
      .from('oracle_scribe_entries')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (entryError || !entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    // Analyze content using inference (similar to oracle insights)
    const { extractInferenceData } = require('../lib/oracleInference');
    
    const inferenceData = extractInferenceData(entry.content);
    const insights = [];
    const actions = [];

    // Generate insights based on entry type and content
    if (entry.entry_type === 'challenge' || entry.mood === 'frustrated' || entry.mood === 'stressed') {
      // Identify challenges and suggest solutions
      insights.push({
        insight_type: 'warning',
        title: 'Challenge Identified',
        description: `Based on your journal entry about "${entry.title}", consider breaking this challenge into smaller, manageable tasks.`,
        priority: 'high',
        is_actionable: true,
        estimated_impact: 4,
      });

      actions.push({
        title: `Address: ${entry.title}`,
        description: 'Break down this challenge and create an action plan',
        priority: 'high',
        estimated_lift: 5,
        category: entry.category || 'general',
      });
    }

    if (entry.entry_type === 'idea' || entry.mood === 'excited') {
      // Capture ideas and suggest next steps
      insights.push({
        insight_type: 'opportunity',
        title: 'Idea Captured',
        description: `Great idea! Consider validating "${entry.title}" with 3-5 potential customers before investing significant resources.`,
        priority: 'medium',
        is_actionable: true,
        estimated_impact: 3,
      });

      actions.push({
        title: `Validate idea: ${entry.title}`,
        description: 'Talk to 3-5 potential customers about this concept',
        priority: 'medium',
        estimated_lift: 3,
        category: 'product',
      });
    }

    if (entry.entry_type === 'progress' || entry.entry_type === 'milestone') {
      // Acknowledge progress and encourage momentum
      insights.push({
        insight_type: 'encouragement',
        title: 'Progress Acknowledged',
        description: `Excellent progress on "${entry.title}"! This momentum is building toward your fundraising goals.`,
        priority: 'low',
        is_actionable: false,
        estimated_impact: 2,
      });
    }

    // Check for action keywords in content
    const actionKeywords = ['need to', 'should', 'must', 'todo', 'action', 'plan to', 'will'];
    const hasActionKeywords = actionKeywords.some(keyword => 
      entry.content.toLowerCase().includes(keyword)
    );

    if (hasActionKeywords) {
      insights.push({
        insight_type: 'action_item',
        title: 'Action Items Detected',
        description: 'Your entry contains potential action items. Review and add them to your Oracle action list.',
        priority: 'medium',
        is_actionable: true,
        estimated_impact: 3,
      });
    }

    // Pattern detection: recurring themes
    const { data: recentEntries } = await supabase
      .from('oracle_scribe_entries')
      .select('title, content, tags, category')
      .eq('user_id', user.id)
      .neq('id', id)
      .order('entry_date', { ascending: false })
      .limit(10);

    if (recentEntries && recentEntries.length > 0) {
      // Check for recurring topics/tags
      const allTags = recentEntries
        .flatMap(e => e.tags || [])
        .concat(entry.tags || []);
      const tagCounts = {};
      allTags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });

      const recurringTags = Object.entries(tagCounts)
        .filter(([tag, count]) => count >= 3)
        .map(([tag]) => tag);

      if (recurringTags.length > 0) {
        insights.push({
          insight_type: 'pattern',
          title: 'Recurring Theme Detected',
          description: `You've journaled multiple times about: ${recurringTags.join(', ')}. This suggests an area worth deeper focus or systematic approach.`,
          priority: 'medium',
          is_actionable: false,
          estimated_impact: 4,
        });
      }
    }

    // Save insights
    const savedInsights = [];
    for (const insight of insights) {
      const { data: savedInsight } = await supabase
        .from('oracle_scribe_insights')
        .insert({
          entry_id: id,
          user_id: user.id,
          ...insight,
        })
        .select()
        .single();

      if (savedInsight) savedInsights.push(savedInsight);
    }

    // Create Oracle actions if actionable
    const createdActions = [];
    for (const action of actions) {
      const { data: createdAction } = await supabase
        .from('oracle_actions')
        .insert({
          user_id: user.id,
          startup_id: entry.startup_id,
          session_id: entry.session_id,
          source: 'scribe',
          ...action,
        })
        .select()
        .single();

      if (createdAction) {
        createdActions.push(createdAction);
        
        // Link insight to action
        if (savedInsights.length > 0) {
          await supabase
            .from('oracle_scribe_insights')
            .update({
              action_created: true,
              action_id: createdAction.id,
            })
            .eq('id', savedInsights[0].id);
        }
      }
    }

    // Generate summary
    const summary = `Analyzed entry and generated ${savedInsights.length} insights and ${createdActions.length} action items. ${
      savedInsights.some(i => i.insight_type === 'warning') ? 'Challenge identified - see recommendations.' : 
      savedInsights.some(i => i.insight_type === 'opportunity') ? 'Opportunity captured - consider next steps.' :
      'Entry processed successfully.'
    }`;

    // Mark entry as analyzed
    await supabase.rpc('mark_scribe_entry_analyzed', {
      p_entry_id: id,
      p_summary: summary,
    });

    res.json({
      insights: savedInsights,
      actions: createdActions,
      summary,
    });
  } catch (error) {
    console.error('[Oracle Scribe] Analyze error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/oracle/scribe/insights/:entry_id
 * Get insights for a specific entry
 */
router.get('/scribe/insights/:entry_id', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    const { entry_id } = req.params;

    const { data: insights, error } = await supabase
      .from('oracle_scribe_insights')
      .select('*')
      .eq('entry_id', entry_id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Oracle Scribe] Fetch insights error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ insights: insights || [] });
  } catch (error) {
    console.error('[Oracle Scribe] Insights error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/oracle/scribe/stats
 * Get journaling statistics and streaks
 */
router.get('/scribe/stats', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);

    const { data: stats, error } = await supabase
      .from('oracle_scribe_stats')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('[Oracle Scribe] Fetch stats error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ stats: stats || {
      current_streak_days: 0,
      longest_streak_days: 0,
      total_entries: 0,
      total_words: 0,
      total_insights_generated: 0,
      total_actions_created: 0,
    }});
  } catch (error) {
    console.error('[Oracle Scribe] Stats error:', error);
    res.status(500).json({ error: error.message });
  }
});


// ============================================================================
// GET /api/oracle/investor-predictions
// ============================================================================
// Returns: ranked list of investors with Oracle "where investing now/next"
// predictions derived from signals[] and focus_areas.trending_themes.
//
// Query params:
//   ?sector=AI/ML       — filter to investors active in this sector
//   ?theme=Climate+Tech — filter to investors tracking this thesis theme
//   ?limit=20           — number of results (default 20, max 100)
// ============================================================================
router.get('/investor-predictions', async (req, res) => {
  try {
    const { sector, theme, limit: limitParam } = req.query;
    const limit = Math.min(parseInt(limitParam) || 20, 100);

    let query = supabase
      .from('investors')
      .select('id, name, firm, sectors, stage, focus_areas, signals, deployment_velocity_index, capital_power_score')
      .not('focus_areas', 'is', null)
      .neq('signals', '[]')
      .order('capital_power_score', { ascending: false, nullsFirst: false })
      .limit(limit * 3); // over-fetch to allow filtering

    const { data: investors, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    if (!investors?.length) {
      return res.json({ predictions: [], total: 0, note: 'No investor signal data yet — backfill is running.' });
    }

    // Build prediction output per investor
    let predictions = investors.map(inv => {
      const fa = inv.focus_areas || {};
      const sigs = Array.isArray(inv.signals) ? inv.signals : [];

      const themeSignals = sigs
        .filter(s => s.type === 'thesis_theme')
        .sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

      const recentDeals = sigs
        .filter(s => s.type === 'recent_deal')
        .map(s => s.company);

      const deploymentStatus = sigs.find(s => s.type === 'deployment_signal');

      return {
        investor_id: inv.id,
        name: inv.name,
        firm: inv.firm,
        // Where they're investing NOW (stated thesis + confirmed by news)
        investing_now: {
          sectors: fa.primary_sectors || inv.sectors || [],
          stages: fa.preferred_stages || (Array.isArray(inv.stage) ? inv.stage : (inv.stage ? [inv.stage] : [])),
          themes: themeSignals.slice(0, 3).map(s => ({ label: s.label, confidence: s.confidence })),
        },
        // Where they're investing NEXT (emerging signals not yet in stated thesis)
        investing_next: {
          trending_themes: fa.trending_themes || [],
          recent_deals: recentDeals.slice(0, 3),
          deployment_signal: deploymentStatus?.label || null,
        },
        // Oracle confidence score
        signal_confidence: Math.min(1.0, (sigs.length / 15)),
        capital_power: inv.capital_power_score,
        velocity: inv.deployment_velocity_index,
        geography: fa.geographic_focus || [],
        avg_check_usd: fa.avg_check_size_usd || null,
      };
    });

    // Apply filters
    if (sector) {
      predictions = predictions.filter(p =>
        p.investing_now.sectors.some(s => s.toLowerCase().includes(sector.toLowerCase()))
      );
    }
    if (theme) {
      predictions = predictions.filter(p =>
        p.investing_next.trending_themes.some(t => t.toLowerCase().includes(theme.toLowerCase())) ||
        p.investing_now.themes.some(t => t.label.toLowerCase().includes(theme.toLowerCase()))
      );
    }

    // Sort by signal confidence desc, then capital power
    predictions.sort((a, b) => (b.signal_confidence - a.signal_confidence) || ((b.capital_power || 0) - (a.capital_power || 0)));

    return res.json({
      predictions: predictions.slice(0, limit),
      total: predictions.length,
      filters: { sector: sector || null, theme: theme || null },
      last_updated: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Oracle] investor-predictions error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
