// ═══════════════════════════════════════════════════════════════════
// Agent Registry — Factory & Central Export
// ═══════════════════════════════════════════════════════════════════
// Use createAgent() to instantiate the correct specialized agent
// based on the agent's role configuration.

import type { AgentConfig } from '../types/pipeline';
import { BaseAgent } from './BaseAgent';
import { LeadAgent } from './LeadAgent';
import { FrontendAgent } from './FrontendAgent';
import { BackendAgent } from './BackendAgent';
import { ArchitectAgent } from './ArchitectAgent';
import { QAAgent } from './QAAgent';

// ─── Agent Factory ──────────────────────────────────────────────────
// Maps role strings to the correct agent class.
// When adding new agent types, register them here.

const AGENT_REGISTRY: Record<string, new (config: AgentConfig, path: string, branch?: string) => BaseAgent> = {
  // Lead / Orchestrator
  'God-Agent':       LeadAgent,
  'Lead':            LeadAgent,
  'Orchestrator':    LeadAgent,

  // Specialists
  'Architect':       ArchitectAgent,
  'UI/UX Expert':    FrontendAgent,
  'Frontend':        FrontendAgent,
  'Dev Expert':      BackendAgent,
  'Backend':         BackendAgent,
  'QA Reviewer':     QAAgent,
  'QA':              QAAgent,
  'Security Auditor': QAAgent, // Security reviews use QA patterns (for now)
};

/**
 * Create the correct specialized agent instance for a given config.
 * Falls back to the base role matching, or returns a BackendAgent
 * as the default (fullstack capable).
 */
export function createAgent(
  config: AgentConfig,
  projectPath: string,
  branch: string = 'main'
): BaseAgent {
  const AgentClass = AGENT_REGISTRY[config.role];
  
  if (AgentClass) {
    return new AgentClass(config, projectPath, branch);
  }

  // Fallback: try to match by skills
  if (config.skills.includes('orchestration')) return new LeadAgent(config, projectPath, branch);
  if (config.skills.includes('frontend'))      return new FrontendAgent(config, projectPath, branch);
  if (config.skills.includes('qa_testing'))     return new QAAgent(config, projectPath, branch);
  if (config.skills.includes('architecture'))   return new ArchitectAgent(config, projectPath, branch);

  // Default: Backend (most general-purpose)
  return new BackendAgent(config, projectPath, branch);
}

// ─── Exports ────────────────────────────────────────────────────────

export { BaseAgent } from './BaseAgent';
export { LeadAgent } from './LeadAgent';
export { FrontendAgent } from './FrontendAgent';
export { BackendAgent } from './BackendAgent';
export { ArchitectAgent } from './ArchitectAgent';
export { QAAgent } from './QAAgent';

// Legacy compat
export { GodAgent } from './GodAgent';
