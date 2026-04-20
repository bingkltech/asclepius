// ═══════════════════════════════════════════════════════════════════
// Asclepius Pipeline Types — v5 Architecture
// The foundational type system for the Agent-In-Charge orchestrator.
// Designed for DAG-based task execution with configurable skills & models.
// ═══════════════════════════════════════════════════════════════════

// ─── Agent Skill Taxonomy ───────────────────────────────────────────
// Each Agent-In-Charge declares what it can do. The Lead Agent uses
// these skills to decide WHO gets assigned WHAT.

export type AgentSkill =
  | 'architecture'      // System design, file structure planning
  | 'frontend'          // React, CSS, UI components
  | 'backend'           // APIs, server logic, databases
  | 'fullstack'         // Both frontend and backend
  | 'devops'            // CI/CD, deployment, Docker
  | 'qa_testing'        // Unit tests, integration tests, E2E
  | 'code_review'       // PR review, style enforcement
  | 'documentation'     // README, API docs, comments
  | 'security'          // Auth, encryption, vulnerability scanning
  | 'data_engineering'  // Schemas, migrations, ETL
  | 'orchestration';    // Task decomposition, planning (Lead Agent only)

// ─── Model Provider Configuration ───────────────────────────────────
// Every agent can be backed by a different LLM provider + model.
// This gives you full flexibility to mix Claude, Gemini, GPT, local models, etc.

export type ModelProvider =
  | 'google_jules'      // Jules Cloud API (GitHub-integrated)
  | 'google_gemini'     // Gemini API direct
  | 'anthropic'         // Claude API
  | 'openai'            // GPT-4, o1, etc.
  | 'local_ollama'      // Local Ollama instance
  | 'local_lmstudio'    // Local LM Studio
  | 'custom';           // User-defined endpoint

export interface ModelConfig {
  provider: ModelProvider;
  modelId: string;               // e.g. 'gemini-2.5-pro', 'claude-sonnet-4', 'gpt-4o'
  endpoint: string;              // API endpoint URL
  apiKey: string;                // Auth token (encrypted at rest)
  temperature?: number;          // 0.0 - 2.0
  maxTokens?: number;            // Response length cap
  systemPrompt?: string;         // Agent personality / role injection
}

// ─── Agent Configuration ────────────────────────────────────────────
// The complete definition of an Agent-In-Charge.
// Each agent is a configurable unit with skills, a backing model,
// and operational parameters.

export type AgentType = 'local' | 'cloud' | 'hybrid';
export type AgentStatus = 'idle' | 'working' | 'reviewing' | 'offline' | 'error';

export interface AgentConfig {
  id: string;
  name: string;                  // Display name (e.g. "Athena")
  role: string;                  // Human-readable role (e.g. "Architect")
  type: AgentType;
  status: AgentStatus;
  avatarColor: string;           // Tailwind class for UI display

  // ── Capabilities ──
  skills: AgentSkill[];          // What this agent can do
  isLeadAgent?: boolean;         // Can this agent decompose & distribute tasks?

  // ── Model Backbone ──
  model: ModelConfig;            // The LLM powering this agent

  // ── Execution Constraints ──
  maxConcurrentTasks?: number;   // How many tasks can run in parallel (default: 1)
  canWriteFiles?: boolean;       // Permission to use /api/write-file (safety gate)
  canExecuteCommands?: boolean;  // Permission to use /api/run-command (safety gate)

  // ── Knowledge Assets (Skill Seekers) ──
  knowledgeAssets?: string[];    // Paths to .skill.md files (pre-built knowledge)

  // ── Future Expansion ──
  sandboxAccess?: boolean;       // Can access a sandboxed test environment (LATER)
  sandboxConfig?: {              // Configuration for sandbox (LATER)
    type: 'docker' | 'local_venv' | 'browser';
    image?: string;
    port?: number;
  };
}

// ─── Pipeline Task (DAG Node) ───────────────────────────────────────
// Each task is a node in a Directed Acyclic Graph.
// Tasks declare their dependencies so the orchestrator knows
// the correct execution order.

export type TaskStatus =
  | 'blocked'           // Waiting on dependencies
  | 'pending'           // Ready to be assigned
  | 'assigned'          // Assigned to an agent, not yet started
  | 'working'           // Agent is actively executing
  | 'in_review'         // Work done, awaiting QA/review
  | 'revision'          // QA found issues, sent back to agent
  | 'completed'         // Fully done and validated
  | 'failed'            // Unrecoverable error
  | 'cancelled';        // Manually cancelled by COO

export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

export interface PipelineTask {
  id: string;
  goal: string;                  // What needs to be done (natural language)
  description?: string;          // Detailed technical specification
  
  // ── Assignment ──
  assignedAgentId: string | null;
  requiredSkills: AgentSkill[];  // Skills needed to complete this task

  // ── DAG Edges ──
  dependencies: string[];        // Task IDs that must complete before this one starts
  
  // ── Status ──
  status: TaskStatus;
  priority: TaskPriority;
  
  // ── Git Context ──
  targetBranch?: string;         // Which branch this task operates on
  targetFiles?: string[];        // Specific files this task will touch (for conflict detection)
  
  // ── Telemetry ──
  logs: string[];
  createdAt: number;             // Unix timestamp
  startedAt?: number;
  completedAt?: number;
  estimatedMinutes?: number;     // Lead Agent's time estimate
  
  // ── Review Loop ──
  reviewNotes?: string;          // QA feedback if status is 'revision'
  reviewerId?: string;           // Agent who reviewed this task
  revisionCount?: number;        // How many times this was sent back
}

// ─── Execution Plan ─────────────────────────────────────────────────
// The top-level container for a set of tasks generated by the Lead Agent.
// This is what gets displayed in the left panel "Task Table".

export interface ExecutionPlan {
  id: string;
  title: string;                 // e.g. "Build Authentication Module"
  directive: string;             // The original COO instruction
  projectId: string;             // Which project this plan belongs to
  branch: string;                // Target branch for all tasks
  
  tasks: PipelineTask[];         // The DAG of tasks
  
  status: 'planning' | 'active' | 'paused' | 'completed' | 'failed';
  createdAt: number;
  completedAt?: number;
  
  // ── Lead Agent Metadata ──
  generatedBy: string;           // Agent ID of the Lead Agent who created this plan
  contextFiles?: string[];       // Files the Lead Agent read to create this plan
}

// ─── Project State (v5) ─────────────────────────────────────────────
// Enhanced project state that connects everything together.

export interface ProjectState {
  id: string;
  name: string;
  repoTarget: string;            // GitHub URL or local path
  localPath: string;             // Absolute local workspace path
  activeBranch: string;
  
  agents: AgentConfig[];         // The team assigned to this project
  plans: ExecutionPlan[];        // All execution plans (current + history)
  activePlanId?: string;         // Currently running plan
}

// ─── Legacy Compatibility ───────────────────────────────────────────
// Keep the old JulesWorker type alive for backward compatibility
// during the transition period. Will be deprecated.

/** @deprecated Use AgentConfig instead */
export interface JulesWorker {
  id: string;
  alias: string;
  endpoint: string;
  token: string;
  status: 'idle' | 'working' | 'offline';
}
