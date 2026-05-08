// ═══════════════════════════════════════════════════════════════════
// SwarmDispatcher — Parallel Task Execution with Resource Gating
// ═══════════════════════════════════════════════════════════════════
// Phase 3 Integration from ruflo (ruvnet/ruflo)
// Adapted from: v3/src/coordination/application/SwarmCoordinator.ts
//
// What this gives us:
//   - Independent tasks execute in parallel (not sequentially)
//   - ResourceGovernor-gated concurrency (no CPU/GPU overload)
//   - Agent metrics tracking (success rate, execution time)
//   - Event-driven execution with structured logging
//
// Key difference from ruflo's SwarmCoordinator:
//   - Respects Article II: Does NOT conflate Brains and Hands
//   - Uses Asclepius's existing BaseAgent.execute() interface
//   - Integrates with ResourceGovernor for adaptive throttling
//   - No EventEmitter dependency — pure async/await
//
// Constitutional Compliance:
//   - Article II: Dispatches to existing Brain/Hand agents, doesn't create new ones
//   - Article V: Enforces concurrency caps and DAG ordering

import type { PipelineTask } from '../types/pipeline';
import { BaseAgent } from '../agents/BaseAgent';
import { ResourceGovernor } from './ResourceGovernor';

// ─── Types ──────────────────────────────────────────────────────────

export interface SwarmResult {
  taskId: string;
  status: 'completed' | 'failed';
  output?: string;
  error?: string;
  duration: number;
  agentName: string;
}

export interface AgentMetrics {
  agentId: string;
  agentName: string;
  tasksCompleted: number;
  tasksFailed: number;
  totalExecutionMs: number;
  averageExecutionMs: number;
  successRate: number;
}

export interface SwarmDispatchOptions {
  /** Maximum concurrent tasks (auto-detected from ResourceGovernor if not set) */
  maxConcurrency?: number;
  /** Maximum retries per task before marking as failed */
  maxRetries?: number;
  /** Callback for real-time progress updates */
  onProgress?: (completed: number, total: number, result: SwarmResult) => void;
  /** Callback for status updates */
  onStatusChange?: (status: string, detail: string) => void;
}

// ─── SwarmDispatcher ────────────────────────────────────────────────

export class SwarmDispatcher {
  private metrics: Map<string, AgentMetrics> = new Map();

  /**
   * Execute multiple independent tasks in parallel with ResourceGovernor gating.
   * 
   * IMPORTANT: Only pass tasks with NO unresolved dependencies.
   * The caller (LeadAgent.tick) is responsible for DAG ordering.
   */
  async dispatchParallel(
    tasks: PipelineTask[],
    agents: Map<string, BaseAgent>,
    options: SwarmDispatchOptions = {}
  ): Promise<SwarmResult[]> {
    const governor = ResourceGovernor.getInstance();
    const maxConcurrency = options.maxConcurrency || this.getAdaptiveConcurrency(governor);
    const maxRetries = options.maxRetries || 3;

    console.log(`[SwarmDispatcher] Dispatching ${tasks.length} tasks (max ${maxConcurrency} concurrent)`);

    const results: SwarmResult[] = [];
    const pending = [...tasks];
    const inFlight = new Set<string>();

    while (pending.length > 0 || inFlight.size > 0) {
      // Fill up to maxConcurrency slots
      const toDispatch: PipelineTask[] = [];
      while (pending.length > 0 && inFlight.size + toDispatch.length < maxConcurrency) {
        toDispatch.push(pending.shift()!);
      }

      if (toDispatch.length > 0) {
        // Launch parallel batch
        const batchPromises = toDispatch.map(task => {
          inFlight.add(task.id);
          return this.executeWithRetry(task, agents, maxRetries, governor, options)
            .then(result => {
              inFlight.delete(task.id);
              results.push(result);
              options.onProgress?.(results.length, tasks.length, result);
              return result;
            });
        });

        // Wait for at least one to complete before filling more slots
        await Promise.race(batchPromises);

        // Wait for remaining in this batch if no more pending
        if (pending.length === 0) {
          await Promise.all(batchPromises);
        }
      } else {
        // All dispatched, wait for remaining in-flight tasks
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    this.logSwarmSummary(results);
    return results;
  }

  /**
   * Execute a single task with retry logic and metrics tracking.
   */
  private async executeWithRetry(
    task: PipelineTask,
    agents: Map<string, BaseAgent>,
    maxRetries: number,
    governor: ResourceGovernor,
    options: SwarmDispatchOptions
  ): Promise<SwarmResult> {
    const agent = task.assignedAgentId ? agents.get(task.assignedAgentId) : null;
    
    if (!agent) {
      return {
        taskId: task.id,
        status: 'failed',
        error: `No agent assigned or found for task "${task.goal}"`,
        duration: 0,
        agentName: 'Unassigned',
      };
    }

    const agentName = agent.config.name;
    let lastError = '';
    const originalDescription = task.description || '';

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Wait for system cooldown before each attempt
        await governor.waitForCooldown(`[Swarm:${agentName}]`);

        if (attempt > 0) {
          options.onStatusChange?.('Self-Healing', `[${agentName}] Retrying (${attempt}/${maxRetries})`);
          task.description = `[PREVIOUS ATTEMPT FAILED. ERROR: ${lastError}]. Please analyze this error and try a different approach.\n\n${originalDescription}`;
        } else {
          options.onStatusChange?.('Working', `[${agentName}] ${task.goal}`);
        }

        const startTime = Date.now();
        const result = await agent.execute(task);
        const duration = Date.now() - startTime;

        // Restore pristine description after success
        task.description = originalDescription;
        task.output = result;
        task.status = 'completed';
        task.logs.push(`[${new Date().toISOString()}] Completed (attempt ${attempt + 1}, ${duration}ms)`);

        // Update metrics
        this.updateMetrics(agent.config.id, agentName, true, duration);

        // Inter-task cooldown
        await governor.interTaskCooldown(`[Swarm:${agentName}]`);

        return {
          taskId: task.id,
          status: 'completed',
          output: result,
          duration,
          agentName,
        };
      } catch (err: any) {
        lastError = err.message || JSON.stringify(err);
        console.error(`[SwarmDispatcher] ${agentName} failed attempt ${attempt + 1}: ${lastError}`);
        task.logs.push(`[${new Date().toISOString()}] Failed attempt ${attempt + 1}: ${lastError}`);
      }
    }

    // All retries exhausted
    task.status = 'failed';
    task.description = originalDescription;
    this.updateMetrics(agent.config.id, agentName, false, 0);

    return {
      taskId: task.id,
      status: 'failed',
      error: `Failed after ${maxRetries} retries. Last error: ${lastError}`,
      duration: 0,
      agentName,
    };
  }

  /**
   * Determine adaptive concurrency based on system resources.
   */
  private getAdaptiveConcurrency(governor: ResourceGovernor): number {
    // Use ResourceGovernor's throttle level to determine safe concurrency
    // Since all our agents use Ollama, and Ollama handles one request at a time,
    // concurrency > 1 only helps when tasks DON'T use LLM (e.g., lint, build)
    // For LLM tasks, we queue them but can overlap non-LLM work
    try {
      const ctxSize = governor.getAdaptiveContextSize();
      if (ctxSize <= 4096) return 1;   // System under heavy pressure
      if (ctxSize <= 8192) return 2;   // Moderate pressure
      return 3;                         // System is cool
    } catch {
      return 1; // Conservative default
    }
  }

  /**
   * Update per-agent performance metrics.
   */
  private updateMetrics(agentId: string, agentName: string, success: boolean, durationMs: number): void {
    let metrics = this.metrics.get(agentId);
    if (!metrics) {
      metrics = {
        agentId,
        agentName,
        tasksCompleted: 0,
        tasksFailed: 0,
        totalExecutionMs: 0,
        averageExecutionMs: 0,
        successRate: 1.0,
      };
      this.metrics.set(agentId, metrics);
    }

    if (success) {
      metrics.tasksCompleted++;
      metrics.totalExecutionMs += durationMs;
    } else {
      metrics.tasksFailed++;
    }

    const total = metrics.tasksCompleted + metrics.tasksFailed;
    metrics.successRate = total > 0 ? metrics.tasksCompleted / total : 0;
    metrics.averageExecutionMs = metrics.tasksCompleted > 0
      ? metrics.totalExecutionMs / metrics.tasksCompleted
      : 0;
  }

  /**
   * Get all agent metrics.
   */
  getMetrics(): AgentMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Log a summary of the swarm execution.
   */
  private logSwarmSummary(results: SwarmResult[]): void {
    const completed = results.filter(r => r.status === 'completed').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

    console.log(`\n[SwarmDispatcher] ═══ Swarm Summary ═══`);
    console.log(`  ✅ Completed: ${completed}/${results.length}`);
    console.log(`  ❌ Failed: ${failed}/${results.length}`);
    console.log(`  ⏱️  Total execution: ${Math.round(totalDuration / 1000)}s`);
    
    const metricsList = this.getMetrics();
    if (metricsList.length > 0) {
      console.log(`  📊 Agent Performance:`);
      for (const m of metricsList) {
        console.log(`     ${m.agentName}: ${m.tasksCompleted}✅ ${m.tasksFailed}❌ (${(m.successRate * 100).toFixed(0)}% success, avg ${Math.round(m.averageExecutionMs / 1000)}s)`);
      }
    }
    console.log(`[SwarmDispatcher] ════════════════════\n`);
  }
}
