/**
 * Oracle Memory Store (Node.js)
 * 
 * In-memory storage for Oracle wizard sessions.
 * Eliminates need for complex file paths and database lookups during wizard flow.
 * Data persists in memory until session completes or times out.
 */

class OracleMemoryStore {
  constructor() {
    this.sessions = new Map();
    this.SESSION_TIMEOUT_MS = 4 * 60 * 60 * 1000; // 4 hours
    this.AUTO_CLEANUP_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
    this.startAutoCleanup();
  }

  /**
   * Initialize a new Oracle session in memory
   */
  initSession(sessionId, userId, startupId = null) {
    const session = {
      sessionId,
      userId,
      startupId,
      currentStep: 1,
      steps: {},
      metadata: {
        startedAt: new Date(),
        lastUpdated: new Date(),
        progressPercentage: 0,
        isDirty: false,
      },
      computed: {},
    };

    this.sessions.set(sessionId, session);
    console.log(`[OracleMemory] Session ${sessionId} initialized for user ${userId}`);
    return session;
  }

  /**
   * Load session from database into memory
   */
  loadFromDb(sessionData) {
    const session = {
      sessionId: sessionData.id,
      userId: sessionData.user_id,
      startupId: sessionData.startup_id,
      currentStep: sessionData.current_step || 1,
      steps: {
        // Extract from JSONB fields
        ...(sessionData.step_1_stage || {}),
        ...(sessionData.step_2_problem || {}),
        ...(sessionData.step_3_solution || {}),
        ...(sessionData.step_4_traction || {}),
        ...(sessionData.step_5_team || {}),
        ...(sessionData.step_6_pitch || {}),
        ...(sessionData.step_7_vision || {}),
        ...(sessionData.step_8_market || {}),
      },
      metadata: {
        startedAt: new Date(sessionData.started_at),
        lastUpdated: new Date(sessionData.last_updated_at || sessionData.updated_at),
        progressPercentage: sessionData.progress_percentage || 0,
        isDirty: false,
      },
      computed: {
        signalScore: sessionData.signal_score,
        strengths: sessionData.strengths,
        weaknesses: sessionData.weaknesses,
        recommendations: sessionData.recommendations,
      },
    };

    this.sessions.set(session.sessionId, session);
    console.log(`[OracleMemory] Session ${session.sessionId} loaded from database`);
    return session;
  }

  /**
   * Get session from memory (no database lookup)
   */
  getSession(sessionId) {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return null;
    }

    // Check if session expired
    const age = Date.now() - session.metadata.startedAt.getTime();
    if (age > this.SESSION_TIMEOUT_MS) {
      console.log(`[OracleMemory] Session ${sessionId} expired (${Math.round(age / 60000)}min old)`);
      this.sessions.delete(sessionId);
      return null;
    }

    return session;
  }

  /**
   * Update specific step data in memory
   */
  updateStep(sessionId, stepNumber, stepData) {
    const session = this.getSession(sessionId);
    if (!session) return null;

    // Merge step data
    session.steps = {
      ...session.steps,
      ...stepData,
    };

    // Update metadata
    session.currentStep = Math.max(session.currentStep, stepNumber);
    session.metadata.lastUpdated = new Date();
    session.metadata.isDirty = true;

    // Calculate progress
    const completedSteps = this.countCompletedSteps(session.steps);
    session.metadata.progressPercentage = Math.round((completedSteps / 8) * 100);

    console.log(`[OracleMemory] Session ${sessionId} updated: Step ${stepNumber}, Progress ${session.metadata.progressPercentage}%`);
    return session;
  }

  /**
   * Update computed results (signal score, insights)
   */
  updateComputed(sessionId, computed) {
    const session = this.getSession(sessionId);
    if (!session) return null;

    session.computed = {
      ...session.computed,
      ...computed,
    };

    session.metadata.lastUpdated = new Date();
    session.metadata.isDirty = true;

    console.log(`[OracleMemory] Session ${sessionId} computed data updated`);
    return session;
  }

  /**
   * Mark session as saved (clear dirty flag)
   */
  markSaved(sessionId) {
    const session = this.getSession(sessionId);
    if (session) {
      session.metadata.isDirty = false;
      console.log(`[OracleMemory] Session ${sessionId} marked as saved`);
    }
  }

  /**
   * Get all step data for AI processing (no file paths needed)
   */
  getStepData(sessionId) {
    const session = this.getSession(sessionId);
    return session ? session.steps : null;
  }

  /**
   * Get all data formatted for database persistence
   */
  getSessionForDb(sessionId) {
    const session = this.getSession(sessionId);
    if (!session) return null;

    const { steps, computed, currentStep, metadata } = session;

    return {
      current_step: currentStep,
      progress_percentage: metadata.progressPercentage,
      last_updated_at: metadata.lastUpdated.toISOString(),
      step_1_stage: steps.stage || steps.funding_stage || steps.target_raise ? {
        stage: steps.stage,
        funding_stage: steps.funding_stage,
        target_raise: steps.target_raise,
      } : null,
      step_2_problem: steps.problem_statement ? {
        problem_statement: steps.problem_statement,
        pain_points: steps.pain_points,
        current_solutions: steps.current_solutions,
      } : null,
      step_3_solution: steps.solution_description ? {
        solution_description: steps.solution_description,
        unique_value: steps.unique_value,
        technology_stack: steps.technology_stack,
      } : null,
      step_4_traction: steps.mrr || steps.arr || steps.users || steps.revenue ? {
        mrr: steps.mrr,
        arr: steps.arr,
        users: steps.users,
        revenue: steps.revenue,
        growth_rate: steps.growth_rate,
        key_metrics: steps.key_metrics,
      } : null,
      step_5_team: steps.team_members ? {
        team_members: steps.team_members,
        advisors: steps.advisors,
        team_strengths: steps.team_strengths,
      } : null,
      step_6_pitch: steps.elevator_pitch ? {
        elevator_pitch: steps.elevator_pitch,
        key_differentiators: steps.key_differentiators,
        competitive_advantages: steps.competitive_advantages,
      } : null,
      step_7_vision: steps.vision_statement ? {
        vision_statement: steps.vision_statement,
        five_year_goal: steps.five_year_goal,
        impact_statement: steps.impact_statement,
      } : null,
      step_8_market: steps.market_size || steps.target_market ? {
        market_size: steps.market_size,
        target_market: steps.target_market,
        customer_segments: steps.customer_segments,
        competition: steps.competition,
        market_trends: steps.market_trends,
      } : null,
      signal_score: computed?.signalScore || null,
      strengths: computed?.strengths || null,
      weaknesses: computed?.weaknesses || null,
      recommendations: computed?.recommendations || null,
    };
  }

  /**
   * Clear session from memory (after completion or timeout)
   */
  clearSession(sessionId) {
    const deleted = this.sessions.delete(sessionId);
    if (deleted) {
      console.log(`[OracleMemory] Session ${sessionId} cleared from memory`);
    }
  }

  /**
   * Get all sessions for a user
   */
  getUserSessions(userId) {
    const userSessions = [];
    
    for (const session of this.sessions.values()) {
      if (session.userId === userId) {
        userSessions.push(session);
      }
    }

    return userSessions;
  }

  /**
   * Check if session has unsaved changes
   */
  isDirty(sessionId) {
    const session = this.getSession(sessionId);
    return session?.metadata.isDirty ?? false;
  }

  /**
   * Get memory stats for monitoring
   */
  getStats() {
    const sessions = Array.from(this.sessions.values());
    const now = Date.now();

    return {
      totalSessions: sessions.length,
      activeSessions: sessions.filter(s => !s.metadata.isDirty).length,
      dirtySessions: sessions.filter(s => s.metadata.isDirty).length,
      oldestSession: sessions.length > 0 
        ? Math.round((now - Math.min(...sessions.map(s => s.metadata.startedAt.getTime()))) / 60000)
        : 0,
      memoryUsageMB: (JSON.stringify(Array.from(this.sessions.entries())).length / 1024 / 1024).toFixed(2),
    };
  }

  /**
   * Count completed steps based on presence of data
   */
  countCompletedSteps(steps) {
    let count = 0;
    
    if (steps.stage || steps.funding_stage || steps.target_raise) count++;
    if (steps.problem_statement) count++;
    if (steps.solution_description) count++;
    if (steps.mrr || steps.arr || steps.users || steps.revenue) count++;
    if (steps.team_members && steps.team_members.length > 0) count++;
    if (steps.elevator_pitch) count++;
    if (steps.vision_statement) count++;
    if (steps.market_size || steps.target_market) count++;

    return count;
  }

  /**
   * Auto-cleanup expired sessions
   */
  startAutoCleanup() {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      let cleanedCount = 0;

      for (const [sessionId, session] of this.sessions.entries()) {
        const age = now - session.metadata.startedAt.getTime();
        if (age > this.SESSION_TIMEOUT_MS) {
          this.sessions.delete(sessionId);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        console.log(`[OracleMemory] Auto-cleanup: Removed ${cleanedCount} expired sessions`);
      }

      // Log stats every cleanup cycle
      const stats = this.getStats();
      console.log(`[OracleMemory] Stats: ${stats.totalSessions} sessions, ${stats.memoryUsageMB} MB`);
    }, this.AUTO_CLEANUP_INTERVAL_MS);
  }

  /**
   * Shutdown cleanup timer
   */
  shutdown() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      console.log('[OracleMemory] Shutdown complete');
    }
  }
}

// Singleton instance
const oracleMemory = new OracleMemoryStore();

// Graceful shutdown
process.on('SIGTERM', () => oracleMemory.shutdown());
process.on('SIGINT', () => oracleMemory.shutdown());

module.exports = { oracleMemory };
