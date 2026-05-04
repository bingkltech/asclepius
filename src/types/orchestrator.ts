// src/types/orchestrator.ts

/**
 * Defines the status of the Asclepius orchestrator.
 */
export interface OrchestratorStatus {
  status: 'idle' | 'running' | 'paused' | 'error';
  message?: string;
  activeWorkflows?: number;
  registeredAgents?: number;
  uptime?: string;
  lastHeartbeat?: string;
}

/**
 * Defines a basic structure for an agent's capabilities.
 */
export interface AgentCapability {
  name: string;
  description: string;
  inputs: { [key: string]: string }; // e.g., { "filePath": "string", "content": "string" }
  outputs: { [key: string]: string }; // e.g., { "summary": "string" }
}

/**
 * Defines the common interface for an Asclepius agent.
 */
export interface IAgent {
  id: string;
  name: string;
  description: string;
  capabilities: AgentCapability[];
  invoke: (capabilityName: string, inputs: Record<string, any>) => Promise<Record<string, any>>;
}

/**
 * Defines a basic workflow structure.
 */
export interface Workflow {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  steps: WorkflowStep[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Defines a single step within a workflow.
 */
export interface WorkflowStep {
  id: string;
  agentId: string;
  capabilityName: string;
  inputs: Record<string, any>;
  outputs?: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: string;
  completedAt?: string;
  error?: string;
}