/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// ─── Agent Status ───
export type AgentStatus = 'idle' | 'working' | 'healing' | 'learning' | 'error' | 'paused';

// ─── Agent Metrics ───
export interface AgentMetrics {
  cpu: number;
  memory: number;
  latency: number;
}

// ─── Jules Config ───
export interface JulesConfig {
  enabled: boolean;
  endpoint: string;
  sandboxId?: string;
  status: 'connected' | 'disconnected' | 'syncing';
}

// ─── Heartbeat System ───
export type HeartbeatStatus = 'alive' | 'degraded' | 'unresponsive' | 'dead';

export interface HeartbeatEntry {
  timestamp: string;
  responseTime: number;
  healthy: boolean;
}

export interface AgentHeartbeat {
  interval: number;          // How often the agent beats (ms)
  lastBeat: string;          // ISO timestamp of last beat
  missedBeats: number;       // Consecutive missed beats
  maxMissed: number;         // Threshold before flagging dead
  status: HeartbeatStatus;
  avgResponseTime: number;   // Rolling average (last 20 beats) in ms
  uptimePercent: number;     // % uptime since creation
  history: HeartbeatEntry[]; // Last 20 beats for sparkline
}

// ─── Skills System ───
export type SkillCategory =
  | 'engineering'
  | 'analysis'
  | 'operations'
  | 'security'
  | 'creative'
  | 'meta';

export interface AgentSkill {
  id: string;
  name: string;
  category: SkillCategory;
  level: number;             // 1-5 (Novice → Master)
  xp: number;               // Current XP in this level
  xpToNext: number;          // XP needed to level up
  description: string;
  acquiredAt: string;
  lastUsed?: string;
  usageCount: number;
  cooldown?: number;         // Cooldown between uses (ms), 0 = none
}

// XP thresholds per level
export const SKILL_XP_TABLE: Record<number, number> = {
  1: 100,   // Novice → Apprentice
  2: 300,   // Apprentice → Competent
  3: 600,   // Competent → Expert
  4: 1000,  // Expert → Master
  5: 0,     // Master — no further leveling
};

export const SKILL_LEVEL_NAMES: Record<number, string> = {
  1: 'Novice',
  2: 'Apprentice',
  3: 'Competent',
  4: 'Expert',
  5: 'Master',
};

export const SKILL_CATEGORY_COLORS: Record<SkillCategory, string> = {
  engineering: 'violet',
  analysis: 'sky',
  operations: 'amber',
  security: 'rose',
  creative: 'emerald',
  meta: 'yellow', // God-Agent exclusive
};

// ─── Factory Functions (Canonical Source) ───
// These were previously duplicated in App.tsx and CommandCenter.tsx.
// Always import from here to prevent drift.

export function createSkill(
  name: string,
  category: SkillCategory,
  level: number,
  description: string,
  xp = 0
): AgentSkill {
  const clampedLevel = Math.min(5, Math.max(1, level));
  return {
    id: `skill-${name.toLowerCase().replace(/\s+/g, "-")}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    category,
    level: clampedLevel,
    xp,
    xpToNext: SKILL_XP_TABLE[clampedLevel] || 0,
    description,
    acquiredAt: new Date().toISOString(),
    usageCount: 0,
    cooldown: 0,
  };
}

export function createHeartbeat(
  intervalMs: number = 10000,
  maxMissed: number = 3
): AgentHeartbeat {
  return {
    interval: intervalMs,
    lastBeat: new Date().toISOString(),
    missedBeats: 0,
    maxMissed,
    status: "alive",
    avgResponseTime: 0,
    uptimePercent: 100,
    history: [],
  };
}

export function awardAgentXP(
  agent: Agent,
  category: SkillCategory,
  xpAmount: number
): { updatedAgent: Agent; levelUps: string[] } {
  const levelUps: string[] = [];
  const updatedSkills = agent.skills.map((skill) => {
    if (skill.category !== category || skill.level >= 5) return skill;

    let newXp = skill.xp + xpAmount;
    let newLevel = skill.level;
    let newXpToNext = skill.xpToNext;

    while (newXp >= newXpToNext && newLevel < 5) {
      newXp -= newXpToNext;
      newLevel++;
      newXpToNext = SKILL_XP_TABLE[newLevel] || 0;
      levelUps.push(`${skill.name} leveled up to L${newLevel} (${SKILL_LEVEL_NAMES[newLevel]})!`);
    }

    if (newLevel === 5) {
      newXp = 0; // Max level cap
    }

    return {
      ...skill,
      level: newLevel,
      xp: newXp,
      xpToNext: newXpToNext,
      usageCount: skill.usageCount + 1,
      lastUsed: new Date().toISOString(),
    };
  });

  return {
    updatedAgent: {
      ...agent,
      skills: updatedSkills,
    },
    levelUps,
  };
}

// ─── Golden Path: Git Skills (Phase 4) ───
export const CORE_GIT_SKILLS = {
  create_branch: createSkill("Git Branching", "operations", 4, "Create isolated branches for new tasks"),
  commit: createSkill("Git Commit", "operations", 4, "Commit code changes with sovereign identity"),
  push: createSkill("Git Push", "operations", 4, "Push branches to remote repository"),
  pull: createSkill("Git Pull", "operations", 4, "Pull latest changes from remote repository"),
  merge: createSkill("Git Merge", "operations", 5, "Review and merge branches into main (COO only)"),
};

// ─── Budget System ───
export interface AgentBudget {
  dailyTokenLimit: number;
  dailyTokensUsed: number;
  priority: 'critical' | 'high' | 'normal' | 'low';
  overage: 'block' | 'warn' | 'allow';
}

// ─── Reputation System ───
export interface AgentReputation {
  successRate: number;       // 0-100
  totalTasks: number;
  failedTasks: number;
  trend: 'improving' | 'stable' | 'declining';
}

// ─── Delegation System ───
export type DelegationType =
  | 'api-quota-monitoring'
  | 'agent-health-monitoring'
  | 'task-scheduling'
  | 'resource-allocation'
  | 'log-analysis'
  | 'report-generation';

export interface Delegation {
  id: string;
  taskType: DelegationType;
  delegatedTo: string;       // Agent ID
  delegatedBy: 'god';
  authority: 'full' | 'monitor-only' | 'report-to-god';
  createdAt: string;
}

// ─── Agent Identity & Credentials (Constitution Article II: Sovereign Agent Identity) ───
// Each agent IS a Google Identity. The agent and the account are the same entity.
// Once authenticated via OAuth, the agent gains sovereign access to the Google ecosystem.
export type AuthStatus = 'unauthenticated' | 'authenticating' | 'authenticated' | 'expired' | 'error';

export interface GoogleIdentity {
  accessToken?: string;           // OAuth access token
  refreshToken?: string;          // For autonomous token renewal
  expiresAt?: number;             // Token expiry timestamp (ms since epoch)
  scopes: string[];               // Granted scopes: ['jules', 'gmail', 'drive', etc.]
  quotaUsed: number;              // Daily API calls consumed under this identity
  lastRefreshedAt?: string;       // ISO timestamp of last token refresh
}

export interface GitHubIdentity {
  token?: string;                 // PAT or OAuth token for gh CLI
  username?: string;              // GitHub username linked to this agent
  scope: string[];                // e.g., ["repo", "read:user"]
  isConnected: boolean;           // Whether GitHub auth is active
}

export interface AgentCredentials {
  email?: string;                   // The agent's Gmail identity (e.g., "asclepius.god.agent@gmail.com")
  isAuthenticated: boolean;         // Whether full Google OAuth has been completed
  authStatus: AuthStatus;           // Current authentication state
  authenticatedAt?: string;         // ISO timestamp of last successful OAuth
  google: GoogleIdentity;           // Google ecosystem access (jules, gmail, drive)
  github: GitHubIdentity;           // GitHub ecosystem access (repos, PRs, CLI)
  geminiApiKey?: string;            // This agent's personal Gemini API key
  ollamaBaseUrl?: string;           // Can point to different Ollama instances/ports
  ollamaModel?: string;             // Preferred local model for this agent
  geminiModel?: string;             // Preferred cloud model for this agent
  julesSessionId?: string;          // This agent's personal Jules sandbox session
  quotaUsed?: number;               // Per-agent daily usage tracker (backward compat)
  quotaLimit?: number;              // Per-agent daily limit (default: 1500 free tier)
  lastQuotaReset?: string;          // ISO timestamp of last quota reset
}

// Factory function for creating default credentials
export function createDefaultCredentials(email?: string): AgentCredentials {
  return {
    email,
    isAuthenticated: false,
    authStatus: 'unauthenticated',
    google: {
      scopes: [],
      quotaUsed: 0,
    },
    github: {
      scope: [],
      isConnected: false,
    },
    quotaUsed: 0,
    quotaLimit: 1500,
    lastQuotaReset: new Date().toISOString(),
  };
}

// ─── Core Agent Interface ───
export interface Agent {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  lastAction: string;
  health: number;            // 0-100
  capabilities: string[];    // Broad categories (backward compat)
  skills: AgentSkill[];      // Granular leveled competencies
  heartbeat: AgentHeartbeat; // Liveness monitoring
  budget: AgentBudget;       // Resource allocation
  reputation: AgentReputation; // Performance tracking
  metrics: AgentMetrics;
  provider?: LLMProvider;
  model?: string;
  julesConfig?: JulesConfig;
  credentials?: AgentCredentials; // Per-agent identity, API keys, and model prefs
  createdBy: 'system' | 'god'; // Who spawned this agent
  isProtected: boolean;      // Cannot be terminated (God, COO)
  activeBranch?: string;       // Current Git branch this agent is working on
  delegations?: Delegation[];
}

// ─── Project System ───
export type ProjectStatus = 'planning' | 'active' | 'paused' | 'review' | 'completed' | 'archived';
export type ProjectPriority = 'low' | 'medium' | 'high' | 'critical';
export type GoalStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';

export interface ProjectGoal {
  id: string;
  title: string;
  description: string;
  status: GoalStatus;
  assignedAgentId?: string;
  progress: number;          // 0-100
  createdAt: string;
  completedAt?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;       // The README / what this project IS
  path: string;              // Local filesystem path for Git operations
  goals: ProjectGoal[];      // Measurable milestones
  githubUrl: string;         // Repo coordination point
  status: ProjectStatus;
  assignedAgentIds: string[];// Which agents from the fleet work on this
  techStack: string[];       // Tags: ["React", "TypeScript", "DuckDB"]
  priority: ProjectPriority;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

// ─── System Log Entry (OpenTelemetry Aligned) ───
export interface SystemLogEntry {
  id: string;
  timestamp: string;           // ISO 8601 UTC
  severity: 'debug' | 'info' | 'warning' | 'error' | 'critical';
  category: 'agent_action' | 'api_call' | 'git_event' | 'system' | 'sandbox' | 'error';
  source: string;              // service.name equivalent (agent name or 'system')
  sourceId: string;            // agent ID or 'system'
  message: string;             // Human-readable summary
  projectId?: string;          // Which project this relates to
  correlationId?: string;      // Links related events
  metadata?: Record<string, any>; // Flexible structured data
}

// Keep a backward-compatible alias for now to prevent massive build breaks before refactoring
export type LogEntry = SystemLogEntry;

// ─── API Ledger Types ───
export type CallPurpose = 
  | 'human_command'      // User typed a message
  | 'scheduled_task'     // Orchestrator executed a scheduled task
  | 'sandbox_analysis'   // Sandbox code analysis
  | 'error_fix'          // Error detection/fix
  | 'god_audit'          // God-Agent 3-day review
  | 'simulation'         // Simulation activity (should be rare/free)
  | 'connection_test'    // Test Connection button
  | 'unknown';

export type CallOutcome = 'success' | 'failed_429' | 'failed_error' | 'fallback_ollama';

export interface APICallRecord {
  id: string;
  timestamp: string;
  agentId: string;
  agentName: string;
  provider: 'gemini' | 'ollama';      // Which provider actually handled it
  requestedProvider: 'gemini' | 'ollama' | 'auto';  // What was requested
  routedBy: 'user' | 'smart_router';  // Who decided the provider
  keySource: 'personal' | 'global';   // Agent's own API key vs company credit card
  purpose: CallPurpose;
  outcome: CallOutcome;
  promptLength: number;                // Characters sent
  responseLength: number;              // Characters received
  productive: boolean;                 // Did this call produce deliverable output?
  description: string;                 // Human-readable summary
}

export interface BudgetSummary {
  totalCalls: number;
  geminiCalls: number;
  ollamaCalls: number;
  productiveCalls: number;
  wastedCalls: number;
  failed429Count: number;
  efficiencyScore: number;            // 0-100, percentage of productive calls
  callsByPurpose: Record<string, number>;
  callsByAgent: Record<string, number>;
  periodStart: string;
  periodEnd: string;
  topRecommendation: string;
}

// ─── Code Analysis ───
export interface CodeAnalysis {
  bugs: string[];
  suggestions: string[];
  explanation: string;
  refactoredCode?: string;
}

// ─── LLM Provider ───
export type LLMProvider = 'gemini' | 'ollama' | 'auto';

export interface LLMUsageStats {
  requestsToday: number;
  lastResetDate: string;
  limitPerDay: number;
}

export interface LLMSettings {
  provider: LLMProvider;
  ollamaBaseUrl: string;
  ollamaModel: string;
  geminiModel: string;
  geminiApiKey?: string;
  autoHeal?: boolean;
  usage?: LLMUsageStats;
  _keySource?: 'personal' | 'global'; // Internal metadata for budget tracking
}

// ─── Chat Message ───
export interface ChatMessage {
  id: string;
  role: 'user' | 'model' | 'system';
  sender?: string;
  content: string;
  timestamp: string;
  targetAgentId?: string;
}

// ─── Task Scheduling ───
export type ScheduleType = 'interval' | 'once';

export interface ScheduledTask {
  id: string;
  agentId: string;
  description: string;
  type: ScheduleType;
  intervalMs?: number;
  scheduledTime?: string;
  lastRun?: string;
  status: 'active' | 'paused' | 'completed';
}

// ─── Sandbox System ───
export type SandboxErrorSeverity = 'critical' | 'warning' | 'info';

export interface SandboxError {
  id: string;
  message: string;
  severity: SandboxErrorSeverity;
  line?: number;
  column?: number;
  filePath?: string;
  taskId?: string;
  status: 'open' | 'mitigating' | 'resolved';
}

export interface SandboxRun {
  id: string;
  projectId?: string;
  code: string;
  status: 'running' | 'success' | 'error' | 'warning';
  output: string[];
  analysis?: CodeAnalysis;
  errors: SandboxError[];
  createdAt: string;
  resolvedAt?: string;
}

// ─── Neural Vault (God-Agent Knowledge System) ───

export type KnowledgeCategory = 'architecture' | 'bugfix' | 'pattern' | 'protocol' | 'insight';

/**
 * KnowledgeNode — A single "Wisdom Artifact" in the God-Agent's Semantic Memory.
 * 
 * This is Layer 3 of the Tiered Memory system. It stores distilled concepts,
 * not raw logs. Each node represents a reusable piece of understanding.
 * 
 * Example: Instead of storing 50 logs about CORS errors, the God-Agent
 * creates one KnowledgeNode: "How to solve CORS in Vite via server proxy."
 */
export interface KnowledgeNode {
  id: string;
  topic: string;              // "Vite Proxy Architecture"
  content: string;            // The actual wisdom (markdown)
  tags: string[];             // ["vite", "proxy", "cors", "jules"]
  category: KnowledgeCategory;
  confidence: number;         // 0.0 - 1.0 (decays over time if not validated)
  connections: string[];      // IDs of related nodes (neural graph)
  createdBy: string;          // "god" | "coo" | "healer-01"
  createdAt: string;          // ISO timestamp
  lastAccessedAt: string;     // Updated on every retrieval
  accessCount: number;        // How often this wisdom was used
  validated: boolean;         // Has this been confirmed correct by outcome?
}

/**
 * EpisodicEvent — A single event in the God-Agent's Episodic Memory.
 * 
 * This is Layer 2 of the Tiered Memory system. It stores structured records
 * of actions taken and their outcomes. Used for pattern recognition and 
 * training data for the God-Agent's decision-making.
 */
export interface EpisodicEvent {
  id: string;
  agentId: string;            // Who performed the action
  action: string;             // What was done
  context: string;            // Why it was done (task description, error context)
  outcome: 'success' | 'failure' | 'partial';
  lessonsLearned: string;     // What was extracted from the outcome
  knowledgeNodeId?: string;   // Link to wisdom generated from this episode
  relatedEpisodes?: string[]; // Links to related past episodes
  timestamp: string;
}

/**
 * SkillScript — A reusable solution template (Voyager Pattern).
 * 
 * When the God-Agent solves a problem, it can generate a SkillScript —
 * a template that can be automatically re-applied when a similar problem
 * is detected. This is how the agent "trains" without retraining weights.
 */
export interface SkillScript {
  id: string;
  name: string;               // "fix-cors-proxy"
  description: string;        // "Resolves CORS by adding Vite server proxy"
  triggerPattern: string;     // Keywords/patterns that activate this script
  script: string;             // The actual solution template (code/instructions)
  successRate: number;        // % of times this worked (0-100)
  timesUsed: number;
  createdBy: string;
  createdAt: string;
  lastUsedAt?: string;
}

/**
 * NeuralVaultStats — Aggregated stats for Dashboard display.
 */
export interface NeuralVaultStats {
  totalKnowledge: number;
  totalEpisodes: number;
  totalSkillScripts: number;
  avgConfidence: number;
  topCategories: { category: KnowledgeCategory; count: number }[];
  lastLearnedAt: string | null;
  mostAccessedTopic: string | null;
}
