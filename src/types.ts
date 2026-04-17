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

// ─── Agent Identity & Credentials ───
// Each agent can have its own Google identity, API key, and model preferences.
// This enables true workforce isolation: per-agent quota, per-agent failover.
export interface AgentCredentials {
  email?: string;              // Gmail identity (e.g., "asclepius.god.agent@gmail.com")
  geminiApiKey?: string;       // This agent's personal Gemini API key
  ollamaBaseUrl?: string;      // Can point to different Ollama instances/ports
  ollamaModel?: string;        // Preferred local model for this agent
  geminiModel?: string;        // Preferred cloud model for this agent
  julesSessionId?: string;     // This agent's personal Jules sandbox session
  quotaUsed?: number;          // Per-agent daily usage tracker
  quotaLimit?: number;         // Per-agent daily limit (default: 1500 free tier)
  lastQuotaReset?: string;     // ISO timestamp of last quota reset
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

// ─── Log Entry ───
export interface LogEntry {
  id: string;
  timestamp: string;
  agentId: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

// ─── Code Analysis ───
export interface CodeAnalysis {
  bugs: string[];
  suggestions: string[];
  explanation: string;
  refactoredCode?: string;
}

// ─── LLM Provider ───
export type LLMProvider = 'gemini' | 'ollama';

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
