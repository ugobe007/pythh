'use strict';

/**
 * COMMITMENT WIZARD API
 * =====================
 * Mounted at /api/wizard
 *
 * Drives the founder gap-closing loop:
 *   1. GET  /:startupId/gaps           — analyze GOD component scores → ordered task list
 *   2. POST /:startupId/tasks          — bulk-create founder_commitment_tasks
 *   3. PUT  /tasks/:taskId/acknowledge — set deadline + mark acknowledged
 *   4. PUT  /tasks/:taskId/complete    — submit proof + trigger rescore
 *   5. PUT  /tasks/:taskId/skip        — skip a task
 *   6. GET  /:startupId/tasks          — list tasks for a startup
 *   7. POST /:startupId/document       — generate/regenerate commitment doc
 *   8. GET  /:startupId/document       — fetch latest commitment doc
 *   9. GET  /:startupId/outreach-package — generate email drafts for top investors
 */

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ============================================================================
// TASK CATALOG
// Static map of gap → actionable tasks. Each entry is surfaced to the founder
// as a single wizard card. impact_points = approximate GOD point gain if done.
// ============================================================================

const TASK_CATALOG = {
  // ── TEAM ──────────────────────────────────────────────────────────────────
  add_technical_cofounder: {
    component: 'team',
    title: 'Add a technical co-founder',
    description:
      'Investors consistently flag solo non-technical founders as the biggest team risk. A technical co-founder with relevant domain experience is the single highest-impact team signal you can add.',
    impact_points: 18,
    proof_type: 'names_list',
    proof_label: 'Enter their name(s) and LinkedIn URL',
    priority: 1,
  },
  grow_team_to_3: {
    component: 'team',
    title: 'Grow your team to 3+ people',
    description:
      'Teams of 3 or more demonstrate execution capacity. Each additional team member with a relevant background signals commitment and reduces single-point-of-failure risk.',
    impact_points: 8,
    proof_type: 'count',
    proof_label: 'How many people are on your team now?',
    priority: 2,
  },
  add_advisors: {
    component: 'team',
    title: 'Add 2+ domain advisors',
    description:
      'Advisors with credibility in your sector signal that respected people have evaluated and bet on you. Aim for at least one with direct operator experience.',
    impact_points: 6,
    proof_type: 'names_list',
    proof_label: 'Enter advisor names and their background',
    priority: 3,
  },
  document_founder_backgrounds: {
    component: 'team',
    title: 'Document founder backgrounds',
    description:
      'Prior company names, universities, and domain experience are used to compute founder pedigree. Update your profile with all relevant experience.',
    impact_points: 5,
    proof_type: 'text',
    proof_label: 'Describe your founding team\'s relevant experience',
    priority: 4,
  },

  // ── TRACTION ──────────────────────────────────────────────────────────────
  secure_first_customer: {
    component: 'traction',
    title: 'Sign your first paying customer',
    description:
      'A single paying customer is a 14-point GOD score signal. It eliminates the "zero to one" risk that kills most pre-revenue deals. Any dollar amount counts.',
    impact_points: 14,
    proof_type: 'names_list',
    proof_label: 'Company name and what they pay (or letter of intent)',
    priority: 1,
  },
  reach_10_users: {
    component: 'traction',
    title: 'Get 10+ active users or sign-ups',
    description:
      'User count is a proxy for product-market fit signal. Even 10 active users changes how investors read your traction story.',
    impact_points: 10,
    proof_type: 'count',
    proof_label: 'Current active user / sign-up count',
    priority: 2,
  },
  confirm_mrr: {
    component: 'traction',
    title: 'Confirm your monthly recurring revenue',
    description:
      'MRR is the cleanest traction signal in investor due diligence. Even $500/month matters — it proves the transaction is real.',
    impact_points: 12,
    proof_type: 'text',
    proof_label: 'Current MRR (monthly recurring revenue)',
    priority: 3,
  },
  confirm_growth_rate: {
    component: 'traction',
    title: 'Record your month-over-month growth rate',
    description:
      'Growth rate is more important than absolute numbers for early-stage investors. A 20% MoM growth trajectory at $1K MRR beats $10K flat.',
    impact_points: 8,
    proof_type: 'text',
    proof_label: 'Your MoM growth rate (e.g. 15%)',
    priority: 4,
  },
  launch_product: {
    component: 'traction',
    title: 'Launch your product publicly',
    description:
      'A publicly available product signals that you\'ve shipped and are learning from real users. Even a beta launch counts.',
    impact_points: 9,
    proof_type: 'url',
    proof_label: 'Link to your live product or beta sign-up',
    priority: 5,
  },

  // ── MARKET ────────────────────────────────────────────────────────────────
  define_market_size: {
    component: 'market',
    title: 'State your TAM with a credible source',
    description:
      'Market size framing without a source is ignored. A bottom-up or third-party TAM statement with a citation unlocks market score credit.',
    impact_points: 8,
    proof_type: 'text',
    proof_label: 'Your TAM statement + source (e.g. "Gartner: $12B logistics software market by 2026")',
    priority: 1,
  },
  write_why_now: {
    component: 'market',
    title: 'Write your "Why Now" in 2 sentences',
    description:
      'The timing thesis is the most underwritten part of most pitch decks. Investors back trends, not just products. Why is this problem solvable now that it wasn\'t 3 years ago?',
    impact_points: 7,
    proof_type: 'text',
    proof_label: 'Your "Why Now" statement (2 sentences max)',
    priority: 2,
  },
  define_contrarian_view: {
    component: 'market',
    title: 'State your contrarian market insight',
    description:
      'A non-obvious belief about your market — something most people are wrong about — signals deep founder-market fit and differentiated thinking.',
    impact_points: 7,
    proof_type: 'text',
    proof_label: 'What do you believe that most people in your industry don\'t?',
    priority: 3,
  },
  clarify_problem_solution: {
    component: 'market',
    title: 'Sharpen your problem and solution statements',
    description:
      'Problem and solution clarity (100+ characters each) is a direct scoring input. Precise language scores higher than vague positioning.',
    impact_points: 5,
    proof_type: 'text',
    proof_label: 'Problem: [1-2 sentences]. Solution: [1-2 sentences].',
    priority: 4,
  },

  // ── PRODUCT ───────────────────────────────────────────────────────────────
  record_demo: {
    component: 'product',
    title: 'Record a product demo',
    description:
      'A live or recorded demo eliminates the "is this real?" question instantly. Even a 2-minute Loom of your product working changes the conversation.',
    impact_points: 8,
    proof_type: 'url',
    proof_label: 'Link to your product demo (Loom, YouTube, or live URL)',
    priority: 1,
  },
  document_defensibility: {
    component: 'product',
    title: 'Document your defensibility / moat',
    description:
      'What makes your product hard to replicate? Proprietary data, network effects, switching costs, or patents. Name the mechanism specifically.',
    impact_points: 7,
    proof_type: 'text',
    proof_label: 'Your core defensibility mechanism in 1-2 sentences',
    priority: 2,
  },
  describe_solution_depth: {
    component: 'product',
    title: 'Write a detailed solution description',
    description:
      'A solution description with technical depth (50+ characters) signals you have built something real. Describe how it works, not just what it does.',
    impact_points: 6,
    proof_type: 'text',
    proof_label: 'How does your product work? (technical detail encouraged)',
    priority: 3,
  },

  // ── VISION ────────────────────────────────────────────────────────────────
  write_founder_pitch: {
    component: 'vision',
    title: 'Write a 200-word founder pitch',
    description:
      'A clear, personal narrative — your origin story, the problem you\'re obsessed with, and where this goes in 10 years — is the vision signal investors weight most.',
    impact_points: 7,
    proof_type: 'text',
    proof_label: 'Your founder pitch (200+ words)',
    priority: 1,
  },
  articulate_vision_statement: {
    component: 'vision',
    title: 'Write your 10-year vision statement',
    description:
      'Where does your company stand in 10 years if everything goes right? The biggest vision statements — "organize the world\'s information" — score highest.',
    impact_points: 6,
    proof_type: 'text',
    proof_label: 'Your 10-year vision (1-3 sentences)',
    priority: 2,
  },
  describe_fundraising_plan: {
    component: 'vision',
    title: 'Define your fundraising plan',
    description:
      'Raise amount, use of funds, and runway duration. Investors need to know you\'ve thought through capital deployment before they can evaluate fit.',
    impact_points: 5,
    proof_type: 'text',
    proof_label: 'How much are you raising, what for, and how many months of runway?',
    priority: 3,
  },
};

// Component score threshold below which we surface tasks for that component
const TASK_THRESHOLD = 65;

// Max tasks to surface per component in the wizard
const MAX_TASKS_PER_COMPONENT = 3;

// ============================================================================
// HELPERS
// ============================================================================

function validateUuid(id) {
  return UUID_RE.test(id);
}

/**
 * Derive which tasks to show based on GOD component scores.
 * Returns tasks ordered by priority within lowest-scoring components first.
 */
function deriveGapTasks(startup) {
  const components = [
    { key: 'team',     score: startup.team_score     ?? 0 },
    { key: 'traction', score: startup.traction_score ?? 0 },
    { key: 'market',   score: startup.market_score   ?? 0 },
    { key: 'product',  score: startup.product_score  ?? 0 },
    { key: 'vision',   score: startup.vision_score   ?? 0 },
  ];

  // Only surface tasks for components below threshold
  const gapComponents = components
    .filter(c => c.score < TASK_THRESHOLD)
    .sort((a, b) => a.score - b.score); // lowest score first

  const tasks = [];
  for (const comp of gapComponents) {
    const compTasks = Object.entries(TASK_CATALOG)
      .filter(([, t]) => t.component === comp.key)
      .sort(([, a], [, b]) => a.priority - b.priority)
      .slice(0, MAX_TASKS_PER_COMPONENT)
      .map(([task_key, t]) => ({
        task_key,
        component: comp.key,
        component_score: comp.score,
        title: t.title,
        description: t.description,
        impact_points: t.impact_points,
        proof_type: t.proof_type,
        proof_label: t.proof_label,
        priority: t.priority,
      }));
    tasks.push(...compTasks);
  }

  return tasks;
}

/**
 * Generate commitment document content from startup + tasks.
 */
function buildDocumentContent(startup, tasks) {
  const completedTasks = tasks.filter(t => t.status === 'completed');
  const acknowledgedTasks = tasks.filter(t =>
    t.status === 'acknowledged' || t.status === 'in_progress'
  );
  const totalImpact = acknowledgedTasks.reduce((sum, t) => sum + (t.impact_points || 0), 0);
  const totalProvedImpact = completedTasks.reduce((sum, t) => sum + (t.impact_points || 0), 0);
  const projectedScore = Math.min(
    100,
    (startup.total_god_score || 0) + totalImpact
  );

  const stageMap = { 0: 'Pre-Seed', 1: 'Seed', 2: 'Series A', 3: 'Series B' };

  return {
    header: {
      startup_name: startup.name || 'Unnamed Startup',
      website: startup.website || null,
      generated_date: new Date().toISOString(),
      status: completedTasks.length >= tasks.filter(t => t.status !== 'skipped').length && tasks.length > 0
        ? 'active'
        : 'provisional',
    },
    offer: {
      raise_amount: startup.raise_amount || startup.target_raise || null,
      stage: stageMap[startup.stage] || startup.stage || 'Seed',
      sectors: startup.sectors || [],
      what_we_build: startup.pitch || startup.description || startup.tagline || null,
    },
    score_snapshot: {
      total: startup.total_god_score || 0,
      team: startup.team_score || 0,
      traction: startup.traction_score || 0,
      market: startup.market_score || 0,
      product: startup.product_score || 0,
      vision: startup.vision_score || 0,
    },
    projections: {
      projected_score: projectedScore,
      projected_gain: totalImpact,
      proved_gain: totalProvedImpact,
    },
    commitments: tasks
      .filter(t => t.status !== 'skipped')
      .map(t => ({
        task_key: t.task_key,
        component: t.component,
        task: t.title,
        deadline: t.deadline,
        status: t.status,
        impact: `+${t.impact_points || 0} GOD pts`,
        proof: t.proof_data || null,
      })),
    note:
      'This document is provisional. It becomes your investment memo once commitments are marked complete with verified proof.',
  };
}

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /:startupId/gaps
 * Analyze GOD component scores → return ordered task list.
 * Does NOT persist anything — just returns the recommendations.
 */
router.get('/:startupId/gaps', async (req, res) => {
  const { startupId } = req.params;
  if (!validateUuid(startupId)) return res.status(400).json({ error: 'Invalid startup ID' });

  try {
    const { data: startup, error } = await supabase
      .from('startup_uploads')
      .select('id, name, total_god_score, team_score, traction_score, market_score, product_score, vision_score, sectors, stage, website, pitch, description, tagline, raise_amount')
      .eq('id', startupId)
      .maybeSingle();

    if (error || !startup) return res.status(404).json({ error: 'Startup not found' });

    const tasks = deriveGapTasks(startup);

    // Check if any tasks already exist in DB (to mark them)
    const { data: existingTasks } = await supabase
      .from('founder_commitment_tasks')
      .select('task_key, status, deadline, proof_data')
      .eq('startup_id', startupId);

    const existingMap = new Map((existingTasks || []).map(t => [t.task_key, t]));

    const enrichedTasks = tasks.map(t => ({
      ...t,
      existing_status: existingMap.get(t.task_key)?.status || null,
      existing_deadline: existingMap.get(t.task_key)?.deadline || null,
    }));

    return res.json({
      startup_id: startupId,
      god_score: startup.total_god_score,
      score_components: {
        team: startup.team_score,
        traction: startup.traction_score,
        market: startup.market_score,
        product: startup.product_score,
        vision: startup.vision_score,
      },
      gap_tasks: enrichedTasks,
      total_tasks: enrichedTasks.length,
      total_potential_gain: enrichedTasks.reduce((s, t) => s + (t.impact_points || 0), 0),
    });
  } catch (err) {
    console.error('[wizard] gaps error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /:startupId/tasks
 * List all founder_commitment_tasks for a startup.
 */
router.get('/:startupId/tasks', async (req, res) => {
  const { startupId } = req.params;
  if (!validateUuid(startupId)) return res.status(400).json({ error: 'Invalid startup ID' });

  try {
    const { data: tasks, error } = await supabase
      .from('founder_commitment_tasks')
      .select('*')
      .eq('startup_id', startupId)
      .order('priority', { ascending: true });

    if (error) {
      console.error('[wizard] list tasks error:', error);
      return res.status(500).json({ error: 'Failed to load tasks' });
    }

    return res.json({ tasks: tasks || [] });
  } catch (err) {
    console.error('[wizard] list tasks error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /:startupId/tasks
 * Bulk-create tasks from the gap analysis. Idempotent (upsert by task_key).
 * Body: { tasks: [{ task_key, ... }], user_id? }
 */
router.post('/:startupId/tasks', async (req, res) => {
  const { startupId } = req.params;
  if (!validateUuid(startupId)) return res.status(400).json({ error: 'Invalid startup ID' });

  const { tasks: incoming, user_id } = req.body || {};
  if (!Array.isArray(incoming) || incoming.length === 0) {
    return res.status(400).json({ error: 'tasks array is required' });
  }

  try {
    const rows = incoming.map(t => {
      const catalog = TASK_CATALOG[t.task_key] || {};
      return {
        startup_id: startupId,
        user_id: user_id || null,
        component: t.component || catalog.component,
        task_key: t.task_key,
        title: t.title || catalog.title,
        description: t.description || catalog.description,
        impact_points: t.impact_points ?? catalog.impact_points ?? 0,
        proof_type: t.proof_type || catalog.proof_type,
        priority: t.priority ?? catalog.priority ?? 1,
        status: 'pending',
      };
    });

    const { data, error } = await supabase
      .from('founder_commitment_tasks')
      .upsert(rows, { onConflict: 'startup_id,task_key', ignoreDuplicates: true })
      .select();

    if (error) {
      console.error('[wizard] create tasks error:', error);
      return res.status(500).json({ error: 'Failed to create tasks' });
    }

    return res.json({ created: (data || []).length, tasks: data || [] });
  } catch (err) {
    console.error('[wizard] create tasks error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * PUT /tasks/:taskId/acknowledge
 * Mark task as acknowledged + set deadline.
 * Body: { deadline?: ISO string }
 */
router.put('/tasks/:taskId/acknowledge', async (req, res) => {
  const { taskId } = req.params;
  if (!validateUuid(taskId)) return res.status(400).json({ error: 'Invalid task ID' });

  const { deadline } = req.body || {};
  // Default: 2 weeks from now
  const resolvedDeadline = deadline || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const { data, error } = await supabase
      .from('founder_commitment_tasks')
      .update({
        status: 'acknowledged',
        acknowledged_at: new Date().toISOString(),
        deadline: resolvedDeadline,
      })
      .eq('id', taskId)
      .select()
      .maybeSingle();

    if (error || !data) {
      return res.status(404).json({ error: 'Task not found or update failed' });
    }

    return res.json({ ok: true, task: data });
  } catch (err) {
    console.error('[wizard] acknowledge error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * PUT /tasks/:taskId/skip
 * Skip a task.
 */
router.put('/tasks/:taskId/skip', async (req, res) => {
  const { taskId } = req.params;
  if (!validateUuid(taskId)) return res.status(400).json({ error: 'Invalid task ID' });

  try {
    const { data, error } = await supabase
      .from('founder_commitment_tasks')
      .update({ status: 'skipped', skipped_at: new Date().toISOString() })
      .eq('id', taskId)
      .select()
      .maybeSingle();

    if (error || !data) return res.status(404).json({ error: 'Task not found' });
    return res.json({ ok: true, task: data });
  } catch (err) {
    console.error('[wizard] skip error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * PUT /tasks/:taskId/complete
 * Submit proof + mark task completed → triggers GOD rescore.
 * Body: { proof_data: { names?, count?, url?, notes? } }
 */
router.put('/tasks/:taskId/complete', async (req, res) => {
  const { taskId } = req.params;
  if (!validateUuid(taskId)) return res.status(400).json({ error: 'Invalid task ID' });

  const { proof_data } = req.body || {};

  try {
    // Get task to find startup_id
    const { data: task, error: fetchErr } = await supabase
      .from('founder_commitment_tasks')
      .select('*')
      .eq('id', taskId)
      .maybeSingle();

    if (fetchErr || !task) return res.status(404).json({ error: 'Task not found' });

    // Update proof fields in startup_uploads based on task_key
    await applyProofToStartup(task, proof_data);

    // Mark task complete
    const { data: updated, error: updateErr } = await supabase
      .from('founder_commitment_tasks')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        proof_data: proof_data || {},
      })
      .eq('id', taskId)
      .select()
      .maybeSingle();

    if (updateErr) {
      console.error('[wizard] complete error:', updateErr);
      return res.status(500).json({ error: 'Failed to update task' });
    }

    // Trigger GOD rescore in the background (non-blocking)
    triggerRescore(task.startup_id).catch(e =>
      console.warn('[wizard] rescore error after task complete:', e?.message)
    );

    // Check if all non-skipped tasks are now complete → flip document to active
    await maybeUnlockDocument(task.startup_id);

    return res.json({ ok: true, task: updated });
  } catch (err) {
    console.error('[wizard] complete error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * Apply proof data to startup_uploads fields based on task_key.
 * This is what makes the rescore actually reflect founder actions.
 */
async function applyProofToStartup(task, proof_data) {
  if (!proof_data) return;

  const update = {};
  const names = proof_data.names || [];
  const count = parseInt(proof_data.count, 10) || 0;
  const text = proof_data.notes || proof_data.text || '';

  switch (task.task_key) {
    case 'add_technical_cofounder':
      if (names.length > 0) update.has_technical_cofounder = true;
      break;
    case 'grow_team_to_3':
      if (count > 0) update.team_size = count;
      break;
    case 'secure_first_customer':
      if (names.length > 0) {
        update.has_customers = true;
        update.has_revenue = true;
        update.customer_count = names.length;
      }
      break;
    case 'reach_10_users':
      if (count > 0) {
        update.customer_count = count;
        update.has_customers = true;
      }
      break;
    case 'confirm_mrr':
      if (text) {
        const mrrMatch = text.replace(/[$,]/g, '').match(/[\d.]+/);
        if (mrrMatch) {
          update.mrr = parseFloat(mrrMatch[0]);
          update.has_revenue = true;
        }
      }
      break;
    case 'confirm_growth_rate':
      if (text) {
        const rateMatch = text.replace(/%/g, '').match(/[\d.]+/);
        if (rateMatch) update.growth_rate_monthly = parseFloat(rateMatch[0]);
      }
      break;
    case 'launch_product':
      if (proof_data.url) update.is_launched = true;
      break;
    case 'record_demo':
      if (proof_data.url) update.has_demo = true;
      break;
    case 'write_founder_pitch':
    case 'articulate_vision_statement':
      if (text && text.length > 50) update.pitch = text;
      break;
    case 'define_market_size':
    case 'clarify_problem_solution':
    case 'write_why_now':
    case 'define_contrarian_view':
    case 'describe_solution_depth':
    case 'document_defensibility':
    case 'describe_fundraising_plan':
    case 'document_founder_backgrounds':
    case 'add_advisors':
      // These update extracted_data fields which feed into scoring
      if (text || names.length) {
        const extractedUpdate = {};
        if (task.task_key === 'write_why_now') extractedUpdate.why_now = text;
        if (task.task_key === 'define_contrarian_view') extractedUpdate.contrarian_belief = text;
        if (task.task_key === 'define_market_size') extractedUpdate.market_size = text;
        if (task.task_key === 'articulate_vision_statement') extractedUpdate.vision_statement = text;
        if (task.task_key === 'document_defensibility') extractedUpdate.defensibility = 'high';
        if (task.task_key === 'describe_solution_depth') extractedUpdate.product_description = text;
        if (task.task_key === 'add_advisors' && names.length) extractedUpdate.advisors = names;

        if (Object.keys(extractedUpdate).length > 0) {
          // Merge into existing extracted_data
          const { data: current } = await supabase
            .from('startup_uploads')
            .select('extracted_data')
            .eq('id', task.startup_id)
            .maybeSingle();

          const existing = (current?.extracted_data && typeof current.extracted_data === 'object')
            ? current.extracted_data
            : {};

          update.extracted_data = { ...existing, ...extractedUpdate };
        }
      }
      break;
    default:
      break;
  }

  if (Object.keys(update).length > 0) {
    const { error } = await supabase
      .from('startup_uploads')
      .update(update)
      .eq('id', task.startup_id);
    if (error) console.warn('[wizard] applyProofToStartup error:', error.message);
  }
}

async function triggerRescore(startupId) {
  const baseUrl = process.env.INTERNAL_API_URL || `http://localhost:${process.env.PORT || 3002}`;
  const res = await fetch(`${baseUrl}/api/instant/rescore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ startup_id: startupId }),
  });
  return res.json();
}

async function maybeUnlockDocument(startupId) {
  const { data: tasks } = await supabase
    .from('founder_commitment_tasks')
    .select('status')
    .eq('startup_id', startupId);

  if (!tasks || tasks.length === 0) return;

  const active = tasks.filter(t => t.status !== 'skipped');
  const allDone = active.every(t => t.status === 'completed');
  if (!allDone) return;

  // Flip all provisional documents for this startup to active
  await supabase
    .from('commitment_documents')
    .update({ is_provisional: false })
    .eq('startup_id', startupId)
    .eq('is_provisional', true);
}

/**
 * POST /:startupId/document
 * Generate (or regenerate) a commitment document from current task state.
 */
router.post('/:startupId/document', async (req, res) => {
  const { startupId } = req.params;
  if (!validateUuid(startupId)) return res.status(400).json({ error: 'Invalid startup ID' });

  try {
    const [{ data: startup }, { data: tasks }] = await Promise.all([
      supabase
        .from('startup_uploads')
        .select('id, name, website, sectors, stage, pitch, description, tagline, raise_amount, total_god_score, team_score, traction_score, market_score, product_score, vision_score')
        .eq('id', startupId)
        .maybeSingle(),
      supabase
        .from('founder_commitment_tasks')
        .select('*')
        .eq('startup_id', startupId)
        .order('priority', { ascending: true }),
    ]);

    if (!startup) return res.status(404).json({ error: 'Startup not found' });

    // Get next version number
    const { data: existing } = await supabase
      .from('commitment_documents')
      .select('version')
      .eq('startup_id', startupId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    const version = (existing?.version || 0) + 1;
    const content = buildDocumentContent(startup, tasks || []);

    const completedTasks = (tasks || []).filter(t => t.status === 'completed');
    const activeTasks = (tasks || []).filter(t => t.status !== 'skipped');
    const isProvisional = activeTasks.length === 0 || completedTasks.length < activeTasks.length;

    const { data: doc, error: insertErr } = await supabase
      .from('commitment_documents')
      .insert({
        startup_id: startupId,
        version,
        is_provisional: isProvisional,
        god_snapshot: {
          total: startup.total_god_score,
          team: startup.team_score,
          traction: startup.traction_score,
          market: startup.market_score,
          product: startup.product_score,
          vision: startup.vision_score,
        },
        tasks_snapshot: (tasks || []).map(t => ({
          task_key: t.task_key,
          title: t.title,
          component: t.component,
          deadline: t.deadline,
          status: t.status,
          proof_data: t.proof_data,
          impact_points: t.impact_points,
        })),
        content,
      })
      .select()
      .single();

    if (insertErr) {
      console.error('[wizard] generate doc error:', insertErr);
      return res.status(500).json({ error: 'Failed to generate document' });
    }

    return res.json({ ok: true, document: doc });
  } catch (err) {
    console.error('[wizard] generate doc error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /:startupId/document
 * Return the latest commitment document.
 */
router.get('/:startupId/document', async (req, res) => {
  const { startupId } = req.params;
  if (!validateUuid(startupId)) return res.status(400).json({ error: 'Invalid startup ID' });

  try {
    const { data: doc, error } = await supabase
      .from('commitment_documents')
      .select('*')
      .eq('startup_id', startupId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[wizard] fetch doc error:', error);
      return res.status(500).json({ error: 'Failed to fetch document' });
    }

    if (!doc) return res.status(404).json({ error: 'No document generated yet' });

    return res.json({ document: doc });
  } catch (err) {
    console.error('[wizard] fetch doc error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /:startupId/outreach-package
 * Generate outreach package: top investor matches + LLM email drafts.
 * Returns investor list + draft email content for each.
 */
router.get('/:startupId/outreach-package', async (req, res) => {
  const { startupId } = req.params;
  if (!validateUuid(startupId)) return res.status(400).json({ error: 'Invalid startup ID' });

  try {
    // Fetch startup + latest doc
    const [{ data: startup }, { data: doc }] = await Promise.all([
      supabase
        .from('startup_uploads')
        .select('id, name, website, sectors, stage, pitch, description, tagline, total_god_score, team_score, traction_score, market_score, product_score, vision_score')
        .eq('id', startupId)
        .maybeSingle(),
      supabase
        .from('commitment_documents')
        .select('content, is_provisional')
        .eq('startup_id', startupId)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (!startup) return res.status(404).json({ error: 'Startup not found' });

    // Fetch top matched investors
    const { data: matchRows } = await supabase
      .from('startup_investor_matches')
      .select(`
        investor_id, match_score, why_you_match,
        investors ( id, name, firm, title, sectors, stage, linkedin_url, twitter_url, photo_url, investor_tier )
      `)
      .eq('startup_id', startupId)
      .order('match_score', { ascending: false })
      .limit(30);

    // Dedupe by firm — keep top partner per firm
    const firmSeen = new Set();
    const topMatches = [];
    for (const row of (matchRows || [])) {
      const investor = Array.isArray(row.investors) ? row.investors[0] : row.investors;
      if (!investor) continue;
      const firmKey = (investor.firm || investor.name || '').toLowerCase().trim();
      if (firmSeen.has(firmKey)) continue;
      firmSeen.add(firmKey);
      topMatches.push({ ...row, investor });
      if (topMatches.length >= 5) break;
    }

    if (topMatches.length === 0) {
      return res.json({
        startup_id: startupId,
        is_provisional: doc?.is_provisional ?? true,
        investors: [],
        email_drafts: [],
        memo_markdown: null,
        message: 'No investor matches found yet. Complete the wizard and try again.',
      });
    }

    // Build outreach emails (one per investor — using existing template logic)
    const emailDrafts = topMatches.map(match => {
      const inv = match.investor;
      const startupName = startup.name || 'our startup';
      const sector = (startup.sectors || [])[0] || 'tech';
      const stage = startup.stage ? { 0: 'pre-seed', 1: 'seed', 2: 'Series A' }[startup.stage] || 'early-stage' : 'early-stage';
      const godScore = startup.total_god_score || '—';
      const raise = doc?.content?.offer?.raise_amount;
      const raiseStr = raise ? ` We're raising $${Number(raise).toLocaleString()}.` : '';
      const matchWhy = match.why_you_match || `Your portfolio and thesis align closely with ${startupName}`;

      return {
        investor_id: inv.id,
        investor_name: inv.name,
        investor_firm: inv.firm,
        investor_title: inv.title,
        investor_linkedin: inv.linkedin_url,
        match_score: match.match_score,
        subject: `${startupName} — ${stage} in ${sector} | Investor Introduction`,
        body: buildColdEmail(startup, inv, doc, match, { stage, sector, raiseStr, godScore }),
      };
    });

    // Build investment memo markdown
    const memoMarkdown = buildInvestmentMemo(startup, doc, topMatches);

    return res.json({
      startup_id: startupId,
      is_provisional: doc?.is_provisional ?? true,
      investors: topMatches.map(m => ({
        id: m.investor.id,
        name: m.investor.name,
        firm: m.investor.firm,
        title: m.investor.title,
        match_score: m.match_score,
        why_you_match: m.why_you_match,
        linkedin_url: m.investor.linkedin_url,
      })),
      email_drafts: emailDrafts,
      memo_markdown: memoMarkdown,
    });
  } catch (err) {
    console.error('[wizard] outreach-package error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

function buildColdEmail(startup, investor, doc, match, { stage, sector, raiseStr, godScore }) {
  const name = startup.name || 'our company';
  const pitch = startup.pitch || startup.description || startup.tagline || `building in ${sector}`;
  const commitments = doc?.content?.commitments || [];
  const completedCount = commitments.filter(c => c.status === 'completed').length;
  const acknowledgedCount = commitments.filter(c => c.status === 'acknowledged').length;
  const progressLine = (completedCount + acknowledgedCount) > 0
    ? `We've completed ${completedCount} verified milestones and committed to ${acknowledgedCount} more with specific deadlines.`
    : '';

  return `Hi ${investor.name || 'there'},

I'm reaching out because ${investor.firm || 'your firm'} has a strong track record in ${sector}, and I believe ${name} is directly aligned with your thesis.

${pitch.substring(0, 250)}${pitch.length > 250 ? '...' : ''}

We're ${stage} and${raiseStr} Our pythh investor readiness score is ${godScore}/100, placing us in the top tier of our cohort.${progressLine ? ' ' + progressLine : ''}

${match.why_you_match ? `Why we match: ${match.why_you_match}` : ''}

I'd love a 20-minute call to share more. I've attached a brief investment memo below.

Best,
[Your Name]
${startup.website || ''}`.trim();
}

function buildInvestmentMemo(startup, doc, topMatches) {
  const content = doc?.content || {};
  const scores = content.score_snapshot || {};
  const offer = content.offer || {};
  const commitments = content.commitments || [];
  const activeCommitments = commitments.filter(c => c.status !== 'skipped');

  const stageLabel = offer.stage || 'Seed';
  const sectors = (offer.sectors || []).join(', ') || 'Technology';

  return `# ${startup.name || 'Investment Memo'}
${startup.website ? `**Website:** ${startup.website}` : ''}
**Stage:** ${stageLabel} | **Sector:** ${sectors}${offer.raise_amount ? ` | **Raise:** $${Number(offer.raise_amount).toLocaleString()}` : ''}
**Generated:** ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

---

## Company Summary

${offer.what_we_build || startup.description || startup.pitch || '*No description provided.*'}

---

## Investor Readiness Score

| Component | Score |
|-----------|-------|
| Team | ${scores.team || 0}/100 |
| Traction | ${scores.traction || 0}/100 |
| Market | ${scores.market || 0}/100 |
| Product | ${scores.product || 0}/100 |
| Vision | ${scores.vision || 0}/100 |
| **GOD Total** | **${scores.total || 0}/100** |

---

## Commitments & Milestones

${activeCommitments.length === 0
  ? '*No commitments recorded yet.*'
  : activeCommitments.map(c =>
      `- **${c.task}** *(${c.component})* — ${c.status === 'completed' ? '✓ Completed' : `Deadline: ${c.deadline ? new Date(c.deadline).toLocaleDateString() : 'TBD'}`} | Impact: ${c.impact}`
    ).join('\n')
}

---

## Top Investor Matches

${topMatches.map((m, i) =>
  `${i + 1}. **${m.investor.name}** @ ${m.investor.firm || '—'} | Match: ${m.match_score}/100`
).join('\n')}

---

*This memo was generated by pythh.ai and reflects the founder's current investor readiness profile and committed milestones.*`;
}

module.exports = router;
