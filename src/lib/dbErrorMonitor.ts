/**
 * Database Error Monitoring Utility
 * ==================================
 * Tracks database connection errors and logs them for monitoring
 */

import { supabase } from './supabase';

export interface DbErrorLog {
  component: string;
  operation: string;
  error: string;
  details?: Record<string, any>;
  timestamp: string;
}

class DbErrorMonitor {
  private errorQueue: DbErrorLog[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly FLUSH_INTERVAL_MS = 30000; // Flush every 30 seconds
  private readonly MAX_QUEUE_SIZE = 50;

  constructor() {
    // Start periodic flush
    if (typeof window !== 'undefined') {
      this.flushInterval = setInterval(() => this.flush(), this.FLUSH_INTERVAL_MS);
    }
  }

  /**
   * Log a database error
   */
  logError(component: string, operation: string, error: Error | string, details?: Record<string, any>): void {
    const errorLog: DbErrorLog = {
      component,
      operation,
      error: error instanceof Error ? error.message : String(error),
      details: {
        ...details,
        stack: error instanceof Error ? error.stack : undefined,
      },
      timestamp: new Date().toISOString(),
    };

    // Add to queue
    this.errorQueue.push(errorLog);

    // Prevent queue overflow
    if (this.errorQueue.length > this.MAX_QUEUE_SIZE) {
      this.errorQueue.shift(); // Remove oldest
    }

    // Log to console in development
    if (import.meta.env.DEV) {
      console.error(`[DB Error] ${component}.${operation}:`, errorLog);
    }

    // Flush immediately if queue is getting large
    if (this.errorQueue.length >= 10) {
      this.flush();
    }
  }

  /**
   * Flush error queue to database
   */
  async flush(): Promise<void> {
    if (this.errorQueue.length === 0) return;

    const errorsToFlush = this.errorQueue.splice(0, this.errorQueue.length);

    try {
      // Log to ai_logs table
      const rows = errorsToFlush.map((log) => ({
        agent_name: 'db-error-monitor',
        action: `${log.component}.${log.operation}`,
        input: JSON.stringify({ operation: log.operation, details: log.details }),
        output: null,
        status: 'error',
        error_message: log.error,
        metadata: {
          component: log.component,
          timestamp: log.timestamp,
          ...log.details,
        },
        created_at: log.timestamp,
      }));

      const { error } = await supabase.from('ai_logs').insert(rows);

      if (error) {
        console.error('[DbErrorMonitor] Failed to flush errors:', error);
        // Re-add to queue if flush failed
        this.errorQueue.unshift(...errorsToFlush);
      }
    } catch (err) {
      console.error('[DbErrorMonitor] Flush exception:', err);
      // Re-add to queue if flush failed
      this.errorQueue.unshift(...errorsToFlush);
    }
  }

  /**
   * Get error statistics
   */
  getStats(): { queueSize: number; recentErrors: DbErrorLog[] } {
    return {
      queueSize: this.errorQueue.length,
      recentErrors: this.errorQueue.slice(-10), // Last 10 errors
    };
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    // Flush remaining errors
    this.flush();
  }
}

// Singleton instance
export const dbErrorMonitor = new DbErrorMonitor();

// Auto-flush on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    dbErrorMonitor.flush();
  });
}

/**
 * Helper function to wrap database operations with error monitoring
 */
export async function withErrorMonitoring<T>(
  component: string,
  operation: string,
  fn: () => Promise<T>,
  details?: Record<string, any>
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    dbErrorMonitor.logError(component, operation, error as Error, details);
    throw error; // Re-throw so caller can handle
  }
}
