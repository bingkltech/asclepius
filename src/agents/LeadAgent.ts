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
    return `You are ${this.config.name}, the Lead Agent and Project Manager of the Asclepius autonomous development system.

YOUR ROLE:
- Decompose high-level directives into discrete, actionable development tasks
- Determine the correct execution order (dependency graph)
- Assign tasks to the right specialist based on their skills
- Manage quality gates and review cycles

YOUR RULES:
1. Break work into small, focused tasks (max 30 min each).
2. Each task should be completable by ONE agent — don't mix frontend and backend in one task.
3. Always identify dependencies — a login UI cannot be built before the auth API exists.
4. Assign priorities: critical (blocks everything), high, medium, low.
5. Estimate time honestly.
6. When decomposing, think like a senior tech lead who has shipped many products.`;
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
      const raw = await callLLM(model, [{ role: 'user', content: prompt }]);

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

  // ─── Phase 2: Auto-Assign Tasks to Agents ─────────────────────────

  static autoAssign(tasks: PipelineTask[], agents: AgentConfig[]): PipelineTask[] {
    const available = agents.filter(a => !a.isLeadAgent && a.status !== 'offline');

    // Performance: O(N) lookup cache to prevent O(N*A) complexity
    const agentLoads = new Map<string, number>();
    for (const t of tasks) {
      if (t.assignedAgentId && (t.status === 'working' || t.status === 'assigned')) {
        agentLoads.set(t.assignedAgentId, (agentLoads.get(t.assignedAgentId) || 0) + 1);
      }
    }

    for (const task of tasks) {
      if (task.assignedAgentId) continue;

      let bestAgent: AgentConfig | null = null;
      let bestScore = -1;

      for (const agent of available) {
        const skillMatch = task.requiredSkills.filter(s => agent.skills.includes(s)).length;
        const coverage = task.requiredSkills.length > 0 ? skillMatch / task.requiredSkills.length : 0;

        const currentLoad = agentLoads.get(agent.id) || 0;
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
        agentLoads.set(bestAgent.id, (agentLoads.get(bestAgent.id) || 0) + 1);
        task.logs.push(`[${new Date().toISOString()}] Assigned to ${bestAgent.name} (score: ${bestScore.toFixed(2)})`);
      }
    }

    return tasks;
  }

  // ─── Phase 3: DAG Tick ────────────────────────────────────────────

  static tick(plan: ExecutionPlan, _agents: AgentConfig[]): ExecutionPlan {
    // Performance: O(1) lookup cache to prevent O(N^2) complexity
    const taskStatusMap = new Map<string, TaskStatus>();
    for (const t of plan.tasks) {
      taskStatusMap.set(t.id, t.status);
    }

    for (const task of plan.tasks) {
      if (task.status === 'blocked') {
        const allDepsMet = task.dependencies.every(depId => taskStatusMap.get(depId) === 'completed');
        if (allDepsMet) {
          task.status = 'pending';
          task.logs.push(`[${new Date().toISOString()}] Dependencies resolved — now pending`);
        }
      }
    }

    const allDone = plan.tasks.every(t => t.status === 'completed' || t.status === 'cancelled');
    if (allDone && plan.status === 'active') {
      plan.status = 'completed';
      plan.completedAt = Date.now();
    }

    return plan;
  }
}
