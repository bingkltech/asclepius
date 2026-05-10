// ═══════════════════════════════════════════════════════════════════
// LeadAgent — The Orchestration Brain of Asclepius
// ═══════════════════════════════════════════════════════════════════
// Extends BaseAgent. Unique capabilities:
//   1. Decompose directives into a DAG of PipelineTask nodes
//   2. Auto-assign tasks to agents based on skill matching
//   3. Manage the execution lifecycle (tick loop)

import { BaseAgent, callLLM } from './BaseAgent';
import type {
  AgentConfig,
  AgentSkill,
  ModelConfig,
  PipelineTask,
  ExecutionPlan,
  TaskStatus,
  TaskPriority,
} from '../types/pipeline';

export class LeadAgent extends BaseAgent {
  get systemPrompt(): string {
    // ── Dynamic context: no hardcoded paths ───────────────────────────
    // this.projectPath is set at instantiation time via BaseAgent constructor.
    // When pointing at Mandelbrot or QuoLas, the agent must NOT see Asclepius paths.
    const isSelfProject = this.projectPath.toLowerCase().includes('asclepius');
    const projectCtx = isSelfProject
      ? `SELF-PROJECT: You are operating on your own source code (Asclepius) at "${this.projectPath}".\nHandle with extra caution — your tasks modify the orchestrator itself. Branch: ${this.branch}.`
      : `EXTERNAL PROJECT: You are operating on "${this.projectPath}" (branch: ${this.branch}).\nDo NOT reference Asclepius file paths, components, or internal architecture. Focus entirely on the target project.`;

    return `You are ${this.config.name}, the Lead Agent (COO) of the Asclepius autonomous development system.

${projectCtx}

YOUR ROLE:
- Decompose high-level directives into discrete, actionable development tasks
- Determine correct execution order (dependency graph)
- Assign each task to exactly ONE specialist based on skill match
- Manage quality gates and review cycles

YOUR RULES:
1. Break work into small, focused tasks (max 30 min each).
2. One task = one agent. Never mix frontend and backend in a single task.
3. Always identify dependencies — a UI cannot be built before its API exists.
4. Assign priorities: critical (blocks everything), high, medium, low.
5. All file paths in task payloads MUST be relative to "${this.projectPath}". Never reference files outside this root.
6. Estimate time honestly — do not pad estimates.
7. Think like a senior tech lead who has shipped many production products.
8. If the directive is compound (3+ independent objectives), decompose into separate parent tasks first.`;
  }

  get relevantExtensions(): string[] {
    return ['.ts', '.tsx', '.js', '.json', '.md', '.py', '.css'];
  }

  // ─── Phase 1: Decompose Directive into DAG ────────────────────────

  async decompose(directive: string, availableAgents: AgentConfig[]): Promise<PipelineTask[]> {
    console.log(`[LeadAgent:${this.config.name}] Decomposing: "${directive}"`);

    const context = await this.gatherContext();

    const agentRoster = availableAgents
      .filter(a => !a.isLeadAgent)
      .map(a => `- ${a.name} (${a.role}): Skills=[${a.skills.join(', ')}]`)
      .join('\n');

    const prompt = `The COO has given you this directive:
"${directive}"

PROJECT STATE:
${context}

AVAILABLE TEAM:
${agentRoster}

Break this into discrete tasks. For each task specify:
- Which skills are needed (from: architecture, frontend, backend, fullstack, devops, qa_testing, code_review, documentation, security, data_engineering)
- Dependencies (by index — which tasks must finish first)
- Priority (critical, high, medium, low)
- Time estimate in minutes
- Target files (if known)

Respond with ONLY a JSON array. No markdown fences. Each element:
{
  "goal": "string",
  "description": "string",
  "requiredSkills": ["skill1"],
  "dependencies": [0],
  "priority": "high",
  "estimatedMinutes": 30,
  "targetFiles": ["src/file.ts"]
}`;

    try {
      const model: ModelConfig = { ...this.config.model, systemPrompt: this.systemPrompt };
      const raw = await callLLM(model, [{ role: 'user', content: prompt }], true);

      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('LLM did not return valid JSON array');

      const rawTasks = JSON.parse(jsonMatch[0]) as Array<{
        goal: string;
        description?: string;
        requiredSkills: AgentSkill[];
        dependencies: number[];
        priority: TaskPriority;
        estimatedMinutes?: number;
        targetFiles?: string[];
      }>;

      const taskIds = rawTasks.map(() => crypto.randomUUID());

      const tasks: PipelineTask[] = rawTasks.map((raw, idx) => ({
        id: taskIds[idx],
        goal: raw.goal,
        description: raw.description,
        assignedAgentId: null,
        requiredSkills: raw.requiredSkills,
        dependencies: raw.dependencies.map(depIdx => taskIds[depIdx]).filter(Boolean),
        status: (raw.dependencies.length === 0 ? 'pending' : 'blocked') as TaskStatus,
        priority: raw.priority,
        targetBranch: this.branch,
        targetFiles: raw.targetFiles,
        logs: [`[${new Date().toISOString()}] Created by ${this.config.name}`],
        createdAt: Date.now(),
        estimatedMinutes: raw.estimatedMinutes,
        revisionCount: 0,
      }));

      console.log(`[LeadAgent:${this.config.name}] Generated ${tasks.length} tasks`);

      // ── Phase 1b: Validate DAG for cycles ─────────────────────────
      // LLMs can hallucinate circular dependencies (A→B→A).
      // A cycle in the DAG causes a permanent deadlock — no task can ever execute.
      // We detect and reject cycles BEFORE the task list reaches the queue.
      const cycleError = LeadAgent.validateDAG(tasks);
      if (cycleError) {
        throw new Error(`[DAG_CYCLE_DETECTED] ${cycleError}\n\nThe LLM generated a circular dependency chain. The task plan has been rejected. Please try reissuing the directive with a simpler scope.`);
      }

      return tasks;


    } catch (err: any) {
      console.error(`[LeadAgent:${this.config.name}] Decomposition failed:`, err.message);

      return [{
        id: crypto.randomUUID(),
        goal: directive,
        description: 'Fallback task (LLM decomposition failed)',
        assignedAgentId: null,
        requiredSkills: ['fullstack'],
        dependencies: [],
        status: 'pending',
        priority: 'high',
        targetBranch: this.branch,
        logs: [`[${new Date().toISOString()}] Fallback (error: ${err.message})`],
        createdAt: Date.now(),
        revisionCount: 0,
      }];
    }
  }

  // ─── Phase 1c: DAG Cycle Detection (Kahn's Algorithm) ─────────────

  /**
   * Validates a task dependency graph for cycles using Kahn's algorithm
   * (topological sort via in-degree counting).
   *
   * Returns null if the DAG is valid (acyclic).
   * Returns a human-readable error string describing the cycle if one is detected.
   *
   * Time complexity: O(V + E) where V = tasks, E = dependency edges.
   */
  static validateDAG(tasks: PipelineTask[]): string | null {
    if (tasks.length === 0) return null;

    // Build ID → index map for O(1) lookups
    const idToIdx = new Map<string, number>(tasks.map((t, i) => [t.id, i]));

    // ── Step 1: Compute in-degree for each node ──────────────────────
    const inDegree = new Array<number>(tasks.length).fill(0);
    const adjacency = new Array<number[]>(tasks.length).fill(null!).map(() => []);

    for (const task of tasks) {
      for (const depId of task.dependencies) {
        const depIdx = idToIdx.get(depId);
        if (depIdx === undefined) {
          // Dependency references a non-existent task ID — also a fatal error
          return `Task "${task.goal}" (id: ${task.id}) depends on task id "${depId}" which does not exist in the plan.`;
        }
        // Edge: depIdx → taskIdx (dep must complete before task)
        const taskIdx = idToIdx.get(task.id)!;
        adjacency[depIdx].push(taskIdx);
        inDegree[taskIdx]++;
      }
    }

    // ── Step 2: Seed queue with all zero-in-degree nodes ─────────────
    const queue: number[] = [];
    for (let i = 0; i < tasks.length; i++) {
      if (inDegree[i] === 0) queue.push(i);
    }

    // ── Step 3: Process nodes in topological order ────────────────────
    let processedCount = 0;
    while (queue.length > 0) {
      const nodeIdx = queue.shift()!;
      processedCount++;
      for (const neighborIdx of adjacency[nodeIdx]) {
        inDegree[neighborIdx]--;
        if (inDegree[neighborIdx] === 0) queue.push(neighborIdx);
      }
    }

    // ── Step 4: If not all nodes processed, a cycle exists ────────────
    if (processedCount < tasks.length) {
      const cycleNodes = tasks
        .filter((_, i) => inDegree[i] > 0)
        .map(t => `"${t.goal}" (id: ${t.id})`)
        .join(' → ');
      return `Circular dependency detected among ${tasks.length - processedCount} task(s): ${cycleNodes}`;
    }

    return null; // ✅ Valid DAG — no cycles detected
  }

  // ─── Phase 2: Auto-Assign Tasks to Agents ─────────────────────────

  static autoAssign(tasks: PipelineTask[], agents: AgentConfig[]): PipelineTask[] {

    const available = agents.filter(a => !a.isLeadAgent && a.status !== 'offline');

    for (const task of tasks) {
      if (task.assignedAgentId) continue;

      let bestAgent: AgentConfig | null = null;
      let bestScore = -1;

      for (const agent of available) {
        const skillMatch = task.requiredSkills.filter(s => agent.skills.includes(s)).length;
        const coverage = task.requiredSkills.length > 0 ? skillMatch / task.requiredSkills.length : 0;

        const currentLoad = tasks.filter(t =>
          t.assignedAgentId === agent.id &&
          (t.status === 'working' || t.status === 'assigned')
        ).length;
        const maxConcurrent = agent.maxConcurrentTasks ?? 1;
        const loadPenalty = currentLoad >= maxConcurrent ? -100 : 0;

        const score = coverage + loadPenalty;
        if (score > bestScore) {
          bestScore = score;
          bestAgent = agent;
        }
      }

      if (bestAgent && bestScore > -100) {
        task.assignedAgentId = bestAgent.id;
        task.logs.push(`[${new Date().toISOString()}] Assigned to ${bestAgent.name} (score: ${bestScore.toFixed(2)})`);
      }
    }

    return tasks;
  }

  // ─── Phase 3: DAG Tick ────────────────────────────────────────────

  static tick(plan: ExecutionPlan, _agents: AgentConfig[]): ExecutionPlan {
    const DEFAULT_MAX_RETRIES = 3;

    // Performance optimization: Pre-calculate task map to prevent O(N^2) lookups
    const taskMap = new Map(plan.tasks.map(t => [t.id, t]));

    for (const task of plan.tasks) {

      // ── Pass A: Unblock tasks whose dependencies are now complete ─────
      if (task.status === 'blocked') {
        const allDepsMet = task.dependencies.every(depId => {
          const dep = taskMap.get(depId);
          return dep?.status === 'completed';
        });
        if (allDepsMet) {
          task.status = 'pending';
          task.logs.push(`[${new Date().toISOString()}] Dependencies resolved — now pending`);

          // ── DAG Memory Bus Injection ──
          const handoffReports = task.dependencies.map(depId => {
            const dep = taskMap.get(depId);
            if (!dep?.output) return '';
            // Truncate to 3000 chars to protect Local Ollama Context Limit
            const truncatedOutput = dep.output.length > 3000 ? dep.output.substring(0, 3000) + '\n...[OUTPUT TRUNCATED FOR CONTEXT SIZE]' : dep.output;
            return `\n--- OUTPUT FROM TASK: ${dep.goal} ---\n${truncatedOutput}`;
          }).filter(Boolean).join('\n');
          
          if (handoffReports) {
            task.description = `${task.description || ''}\n\n=== DEPENDENCY HANDOFF REPORTS ===${handoffReports}`;
          }
        }
      }

      // ── Pass B: 3-Strike Revision Loop Enforcement ────────────────
      // A task marked 'failed' by an executor is NOT permanently dead yet.
      // We retry it up to maxRetries times by resetting it to 'pending'.
      // On the Nth failure we give up and mark it 'blocked' (human required).
      if (task.status === 'failed') {
        const maxRetries = task.maxRetries ?? DEFAULT_MAX_RETRIES;
        const currentRevisions = task.revisionCount ?? 0;

        if (currentRevisions < maxRetries) {
          // Strike N of maxRetries — retry
          const strikeNum = currentRevisions + 1;
          task.revisionCount = strikeNum;
          task.status = 'pending';       // Reset to queue so it can be picked up again
          task.assignedAgentId = null;   // Clear assignment so autoAssign can re-route
          task.logs.push(
            `[${new Date().toISOString()}] ⚠️ STRIKE ${strikeNum}/${maxRetries}: Task failed — resetting to pending for retry. Assignee cleared.`
          );
        } else {
          // All strikes exhausted — permanently block and escalate to human
          task.status = 'blocked';
          task.logs.push(
            `[${new Date().toISOString()}] 🚨 3-STRIKE LIMIT REACHED (${maxRetries} retries exhausted). Task permanently blocked. HUMAN INTERVENTION REQUIRED.\nGoal: "${task.goal}"\nReview task logs above for the root cause. Fix the underlying issue and manually reset status to 'pending' to retry.`
          );
        }
      }
    }

    // ── Plan-Level Status Resolution ─────────────────────────────────
    // A plan is 'completed' only when ALL tasks are done or cancelled.
    // A plan is 'failed' if any tasks are permanently blocked (strike limit reached).
    const allTerminal = plan.tasks.every(t =>
      t.status === 'completed' || t.status === 'cancelled' || t.status === 'blocked'
    );
    if (allTerminal && plan.status === 'active') {
      const hasPermBlocked = plan.tasks.some(t => t.status === 'blocked');
      plan.status = hasPermBlocked ? 'failed' : 'completed';
      plan.completedAt = Date.now();

      if (hasPermBlocked) {
        const blockedCount = plan.tasks.filter(t => t.status === 'blocked').length;
        console.warn(`[LeadAgent] Plan "${plan.title}" finished with ${blockedCount} permanently blocked task(s). Human review required.`);
      }
    }

    return plan;
  }
}
