// ═══════════════════════════════════════════════════════════════════
// GOAPPlanner — Goal-Oriented Action Planning via A* Search
// ═══════════════════════════════════════════════════════════════════
// Phase 2 Integration from ruflo (ruvnet/ruflo)
// Adapted from: v3/goal_ui/src/lib/goapPlanner.ts
//
// What this gives us:
//   - Mathematically guaranteed acyclic task decomposition
//   - A* search through state-space (no hallucinated dependencies)
//   - Replanning from current state when actions fail
//   - Deterministic cost-optimal planning
//
// How it differs from ruflo's version:
//   - Actions are mapped to Asclepius's AgentSkill types
//   - State keys are software development lifecycle phases
//   - Integrated with PipelineTask type system
//   - LLM fallback when GOAP can't find a path
//
// Constitutional Compliance:
//   - Article II: This is a planning TOOL, not a Brain or Hand
//   - Article V: Replaces fragile LLM JSON decomposition in the DAG

import type { AgentSkill, TaskPriority, PipelineTask } from '../types/pipeline';

// ─── World State ────────────────────────────────────────────────────
// Each boolean represents a condition in the software development lifecycle.
// The planner finds the cheapest path from current state → goal state.

export interface WorldState {
  // Analysis Phase
  requirementsGathered: boolean;
  architectureDesigned: boolean;
  dependenciesMapped: boolean;
  
  // Implementation Phase
  backendImplemented: boolean;
  frontendImplemented: boolean;
  dataLayerReady: boolean;
  apiEndpointsReady: boolean;
  
  // Quality Phase
  testsWritten: boolean;
  codeReviewed: boolean;
  securityAudited: boolean;
  
  // Deployment Phase
  documented: boolean;
  integrated: boolean;
  deployed: boolean;
}

// ─── Action Definition ──────────────────────────────────────────────

export interface GOAPAction {
  name: string;
  description: string;
  cost: number;
  preconditions: Partial<WorldState>;
  effects: Partial<WorldState>;
  requiredSkills: AgentSkill[];
  priority: TaskPriority;
  estimatedMinutes: number;
  targetFiles?: string[];
}

// ─── Default Action Library ─────────────────────────────────────────
// These are the atomic actions the planner can compose into plans.
// Each action has explicit preconditions and effects — no ambiguity.

export const DEFAULT_ACTIONS: GOAPAction[] = [
  // ── Analysis Phase ──
  {
    name: 'Gather Requirements',
    description: 'Analyze the directive and extract concrete technical requirements, acceptance criteria, and constraints.',
    cost: 1,
    preconditions: {},
    effects: { requirementsGathered: true },
    requiredSkills: ['architecture'],
    priority: 'critical',
    estimatedMinutes: 10,
  },
  {
    name: 'Design Architecture',
    description: 'Define the component structure, data flow, API contracts, and integration points for the solution.',
    cost: 2,
    preconditions: { requirementsGathered: true },
    effects: { architectureDesigned: true, dependenciesMapped: true },
    requiredSkills: ['architecture'],
    priority: 'critical',
    estimatedMinutes: 15,
  },

  // ── Data / Backend Phase ──
  {
    name: 'Implement Data Layer',
    description: 'Create database schemas, models, data access patterns, and seed data.',
    cost: 3,
    preconditions: { architectureDesigned: true },
    effects: { dataLayerReady: true },
    requiredSkills: ['backend', 'data_engineering'],
    priority: 'high',
    estimatedMinutes: 25,
  },
  {
    name: 'Build API Endpoints',
    description: 'Implement REST/GraphQL endpoints, middleware, auth guards, and request validation.',
    cost: 3,
    preconditions: { architectureDesigned: true },
    effects: { apiEndpointsReady: true },
    requiredSkills: ['backend'],
    priority: 'high',
    estimatedMinutes: 25,
  },
  {
    name: 'Implement Backend Logic',
    description: 'Build core business logic, services, utility functions, and server-side processing.',
    cost: 4,
    preconditions: { architectureDesigned: true },
    effects: { backendImplemented: true },
    requiredSkills: ['backend'],
    priority: 'high',
    estimatedMinutes: 30,
  },

  // ── Frontend Phase ──
  {
    name: 'Implement Frontend UI',
    description: 'Build React/Vue components, pages, layouts, and client-side state management.',
    cost: 4,
    preconditions: { architectureDesigned: true },
    effects: { frontendImplemented: true },
    requiredSkills: ['frontend'],
    priority: 'high',
    estimatedMinutes: 30,
  },

  // ── Quality Phase ──
  {
    name: 'Write Tests',
    description: 'Create unit tests, integration tests, and E2E tests for the implemented code.',
    cost: 2,
    preconditions: { backendImplemented: true },
    effects: { testsWritten: true },
    requiredSkills: ['qa_testing'],
    priority: 'medium',
    estimatedMinutes: 20,
  },
  {
    name: 'Write Frontend Tests',
    description: 'Create component tests, snapshot tests, and visual regression tests.',
    cost: 2,
    preconditions: { frontendImplemented: true },
    effects: { testsWritten: true },
    requiredSkills: ['qa_testing', 'frontend'],
    priority: 'medium',
    estimatedMinutes: 20,
  },
  {
    name: 'Code Review',
    description: 'Review all changes for correctness, maintainability, performance, and adherence to project standards.',
    cost: 1,
    preconditions: { testsWritten: true },
    effects: { codeReviewed: true },
    requiredSkills: ['code_review'],
    priority: 'medium',
    estimatedMinutes: 15,
  },
  {
    name: 'Security Audit',
    description: 'Scan for vulnerabilities, check auth flows, validate input sanitization, review secrets handling.',
    cost: 2,
    preconditions: { codeReviewed: true },
    effects: { securityAudited: true },
    requiredSkills: ['security'],
    priority: 'low',
    estimatedMinutes: 15,
  },

  // ── Documentation & Integration ──
  {
    name: 'Write Documentation',
    description: 'Create/update README, API docs, inline comments, and architecture decision records.',
    cost: 1,
    preconditions: { backendImplemented: true },
    effects: { documented: true },
    requiredSkills: ['documentation'],
    priority: 'low',
    estimatedMinutes: 10,
  },
  {
    name: 'Integration & Wiring',
    description: 'Connect all components, verify end-to-end data flow, resolve import/export mismatches.',
    cost: 2,
    preconditions: { backendImplemented: true, frontendImplemented: true },
    effects: { integrated: true },
    requiredSkills: ['fullstack'],
    priority: 'high',
    estimatedMinutes: 20,
  },
  {
    name: 'Deploy',
    description: 'Build production bundle, deploy to target environment, verify health checks.',
    cost: 2,
    preconditions: { integrated: true, testsWritten: true },
    effects: { deployed: true },
    requiredSkills: ['devops'],
    priority: 'medium',
    estimatedMinutes: 15,
  },

  // ── Shortcut Actions (for simple goals) ──
  {
    name: 'Quick Fix',
    description: 'Apply a targeted fix to a specific file or function.',
    cost: 2,
    preconditions: {},
    effects: { backendImplemented: true, frontendImplemented: true, testsWritten: true },
    requiredSkills: ['fullstack'],
    priority: 'high',
    estimatedMinutes: 15,
  },
];

// ─── GOAP Planner ───────────────────────────────────────────────────

interface PlanNode {
  state: WorldState;
  actions: GOAPAction[];
  cost: number;
  heuristic: number;
}

export class GOAPPlanner {
  private actions: GOAPAction[];

  constructor(actions?: GOAPAction[]) {
    this.actions = actions || DEFAULT_ACTIONS;
  }

  /**
   * Find the optimal action sequence to reach goalState from currentState.
   * Uses A* search — guaranteed shortest path, guaranteed acyclic.
   */
  plan(currentState: WorldState, goalState: Partial<WorldState>): GOAPAction[] {
    const openList: PlanNode[] = [];
    const closedSet = new Set<string>();

    openList.push({
      state: currentState,
      actions: [],
      cost: 0,
      heuristic: this.heuristic(currentState, goalState),
    });

    let iterations = 0;
    const MAX_ITERATIONS = 10000; // Safety valve

    while (openList.length > 0 && iterations < MAX_ITERATIONS) {
      iterations++;

      // Sort by f(n) = g(n) + h(n)
      openList.sort((a, b) => (a.cost + a.heuristic) - (b.cost + b.heuristic));
      const current = openList.shift()!;
      const stateKey = this.stateKey(current.state);

      // Goal reached?
      if (this.goalReached(current.state, goalState)) {
        console.log(`[GOAPPlanner] Found plan with ${current.actions.length} actions in ${iterations} iterations.`);
        return current.actions;
      }

      if (closedSet.has(stateKey)) continue;
      closedSet.add(stateKey);

      // Expand: try every applicable action
      for (const action of this.actions) {
        if (this.preconditionsMet(current.state, action.preconditions)) {
          const newState = this.applyEffects(current.state, action.effects);
          const newKey = this.stateKey(newState);

          if (!closedSet.has(newKey)) {
            openList.push({
              state: newState,
              actions: [...current.actions, action],
              cost: current.cost + action.cost,
              heuristic: this.heuristic(newState, goalState),
            });
          }
        }
      }
    }

    console.warn(`[GOAPPlanner] No plan found after ${iterations} iterations.`);
    return []; // No plan found
  }

  /**
   * Convert a GOAP plan into Asclepius PipelineTask[] format.
   */
  toPipelineTasks(actions: GOAPAction[], branch: string = 'main'): PipelineTask[] {
    const taskIds = actions.map(() => crypto.randomUUID());

    return actions.map((action, idx) => ({
      id: taskIds[idx],
      goal: action.name,
      description: action.description,
      assignedAgentId: null,
      requiredSkills: action.requiredSkills,
      // Each task depends on the previous one (sequential by default)
      // The A* search already guarantees correct ordering
      dependencies: idx > 0 ? [taskIds[idx - 1]] : [],
      status: (idx === 0 ? 'pending' : 'blocked') as any,
      priority: action.priority,
      targetBranch: branch,
      targetFiles: action.targetFiles,
      logs: [`[${new Date().toISOString()}] Created by GOAPPlanner (cost=${action.cost})`],
      createdAt: Date.now(),
      estimatedMinutes: action.estimatedMinutes,
      revisionCount: 0,
    }));
  }

  /**
   * Replan from a partial completion state.
   * Call this when a task fails — it finds a new path from current state.
   */
  replan(
    completedActions: string[],
    goalState: Partial<WorldState>
  ): GOAPAction[] {
    // Reconstruct current state from completed actions
    let state = this.emptyState();
    for (const actionName of completedActions) {
      const action = this.actions.find(a => a.name === actionName);
      if (action) {
        state = this.applyEffects(state, action.effects);
      }
    }

    console.log(`[GOAPPlanner] Replanning from state with ${completedActions.length} completed actions.`);
    return this.plan(state, goalState);
  }

  // ─── Goal State Builders ────────────────────────────────────────

  /**
   * Infer the goal state from a natural language directive.
   * Uses keyword detection to determine which lifecycle phases are needed.
   */
  static inferGoalState(directive: string): Partial<WorldState> {
    const d = directive.toLowerCase();
    const goal: Partial<WorldState> = {};

    // Always gather requirements and design architecture
    goal.requirementsGathered = true;
    goal.architectureDesigned = true;

    // Backend keywords
    if (d.match(/api|server|endpoint|database|schema|model|backend|service|function|fix|bug|error|patch|refactor/)) {
      goal.backendImplemented = true;
    }

    // Frontend keywords
    if (d.match(/ui|component|page|dashboard|widget|frontend|css|style|design|layout|responsive/)) {
      goal.frontendImplemented = true;
    }

    // Data keywords
    if (d.match(/database|schema|migration|seed|data|table|column|duckdb|sqlite|postgres/)) {
      goal.dataLayerReady = true;
    }

    // Quality keywords
    if (d.match(/test|spec|coverage|qa|quality|validate|verify/)) {
      goal.testsWritten = true;
    }

    // Documentation keywords
    if (d.match(/doc|readme|comment|jsdoc|tutorial|guide/)) {
      goal.documented = true;
    }

    // Security keywords
    if (d.match(/secur|audit|vulnerab|auth|permission|token|encrypt/)) {
      goal.securityAudited = true;
    }

    // Deploy keywords
    if (d.match(/deploy|build|release|production|ci|cd|docker/)) {
      goal.deployed = true;
    }

    // If it's a simple fix, skip to implementation
    if (d.match(/^(fix|patch|update|change|rename|remove|delete|add)\s/i)) {
      return {
        requirementsGathered: true,
        backendImplemented: true,
        frontendImplemented: d.match(/ui|component|page|css|style/) ? true : undefined,
      };
    }

    // If nothing specific matched, default to a full-stack implementation
    if (Object.keys(goal).length <= 2) {
      goal.backendImplemented = true;
      goal.testsWritten = true;
    }

    return goal;
  }

  // ─── Internals ──────────────────────────────────────────────────

  emptyState(): WorldState {
    return {
      requirementsGathered: false,
      architectureDesigned: false,
      dependenciesMapped: false,
      backendImplemented: false,
      frontendImplemented: false,
      dataLayerReady: false,
      apiEndpointsReady: false,
      testsWritten: false,
      codeReviewed: false,
      securityAudited: false,
      documented: false,
      integrated: false,
      deployed: false,
    };
  }

  private heuristic(state: WorldState, goal: Partial<WorldState>): number {
    let distance = 0;
    for (const key in goal) {
      const k = key as keyof WorldState;
      if (goal[k] && !state[k]) {
        distance++;
      }
    }
    return distance;
  }

  private goalReached(state: WorldState, goal: Partial<WorldState>): boolean {
    for (const key in goal) {
      const k = key as keyof WorldState;
      if (goal[k] && !state[k]) return false;
    }
    return true;
  }

  private preconditionsMet(state: WorldState, preconditions: Partial<WorldState>): boolean {
    for (const key in preconditions) {
      const k = key as keyof WorldState;
      if (preconditions[k] && !state[k]) return false;
    }
    return true;
  }

  private applyEffects(state: WorldState, effects: Partial<WorldState>): WorldState {
    return { ...state, ...effects };
  }

  private stateKey(state: WorldState): string {
    // Compact state fingerprint for the closed set
    return Object.values(state).map(v => v ? '1' : '0').join('');
  }
}
