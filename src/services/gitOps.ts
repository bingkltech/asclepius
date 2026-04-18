/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * GitOps Service — Golden Path Phase 2
 * Frontend service for agent-driven Git operations.
 * All operations route through the secure /api/git/* backend endpoints.
 *
 * Key design: Every commit automatically injects the agent's sovereign identity
 * (name + email) so GitHub shows the correct author on each commit.
 */

import type { Agent } from '@/src/types';
import { toast } from 'sonner';

// ─── Types ───

export interface GitStatus {
  branch: string;
  isDirty: boolean;
  dirtyFiles: { status: string; file: string }[];
  lastCommit: { hash: string; author: string; message: string; date: string } | null;
  remoteUrl: string | null;
}

export interface GitBranch {
  name: string;
  hash: string;
  message: string;
  author: string;
  isCurrent: boolean;
}

export interface GitExecResult {
  success: boolean;
  output?: string;
  error?: string;
}

// ─── Core API Wrapper ───

async function gitFetch<T>(endpoint: string, body: Record<string, any>): Promise<T> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Git operation failed (${res.status})`);
  }
  return data;
}

// ─── Helper: Extract agent identity for git config ───

function getAgentIdentity(agent: Agent): { agentId: string; agentName: string; agentEmail: string } {
  return {
    agentId: agent.id,
    agentName: agent.name,
    agentEmail: agent.credentials?.email || `${agent.id}@asclepius.local`,
  };
}

// ─── 2.1: Typed wrapper for /api/git/exec ───

export async function execGitCommand(
  command: string,
  projectPath: string,
  agent?: Agent
): Promise<GitExecResult> {
  const identity = agent ? getAgentIdentity(agent) : {};
  return gitFetch<GitExecResult>('/api/git/exec', {
    command,
    projectPath,
    ...identity,
  });
}

// ─── 2.2: Create a new branch for a task ───

export async function createBranch(
  agent: Agent,
  branchName: string,
  projectPath: string
): Promise<GitExecResult> {
  // Sanitize branch name: replace spaces with dashes, lowercase
  const safeBranch = `${agent.name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}/${branchName.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;

  // Create and checkout the new branch
  const result = await execGitCommand(`checkout -b ${safeBranch}`, projectPath, agent);

  if (result.success) {
    console.log(`[GitOps] ${agent.name} created branch: ${safeBranch}`);
    toast.success(`Agent ${agent.name} created branch: ${safeBranch}`);
  }

  return { ...result, output: result.output || safeBranch };
}

// ─── 2.3: Commit as a specific agent (with identity injection) ───

export async function commitAsAgent(
  agent: Agent,
  message: string,
  projectPath: string,
  addAll: boolean = true
): Promise<GitExecResult> {
  // Stage all changes if requested
  if (addAll) {
    const addResult = await execGitCommand('add -A', projectPath, agent);
    if (!addResult.success) {
      return { success: false, error: `Failed to stage files: ${addResult.error}` };
    }
  }

  // Commit with agent identity (identity injection happens server-side via agentName/agentEmail)
  const result = await execGitCommand(`commit -m "${message.replace(/"/g, '\\"')}"`, projectPath, agent);

  if (result.success) {
    console.log(`[GitOps] ${agent.name} committed: "${message}"`);
    toast.success(`Agent ${agent.name} committed: "${message}"`);
  }

  return result;
}

// ─── 2.4: Get repository status ───

export async function getStatus(projectPath: string): Promise<GitStatus> {
  return gitFetch<GitStatus>('/api/git/status', { projectPath });
}

// ─── 2.5: List all branches ───

export async function listBranches(projectPath: string): Promise<{ branches: GitBranch[]; current: string }> {
  return gitFetch<{ branches: GitBranch[]; current: string }>('/api/git/branches', { projectPath });
}

// ─── 2.6: Checkout an existing branch ───

export async function checkoutBranch(
  branchName: string,
  projectPath: string,
  agent?: Agent
): Promise<GitExecResult> {
  const result = await execGitCommand(`checkout ${branchName}`, projectPath, agent);
  if (result.success) {
    console.log(`[GitOps] Checked out branch: ${branchName}`);
  }
  return result;
}

// ─── 2.7: Merge a branch into the current branch (COO-only) ───

export async function mergeBranch(
  sourceBranch: string,
  projectPath: string,
  agent: Agent
): Promise<GitExecResult> {
  // Permission guard: only agents with git_merge skill should call this
  const hasMergeSkill = agent.skills?.some(s => s.name.toLowerCase().includes('git_merge'));
  if (!hasMergeSkill) {
    console.warn(`[GitOps] BLOCKED: ${agent.name} attempted merge without git_merge skill`);
    return { success: false, error: `${agent.name} does not have merge permissions (requires git_merge skill)` };
  }

  const result = await execGitCommand(`merge ${sourceBranch} --no-ff -m "Merge ${sourceBranch} [approved by ${agent.name}]"`, projectPath, agent);

  if (result.success) {
    console.log(`[GitOps] ${agent.name} merged ${sourceBranch} into current branch`);
  }

  return result;
}

// ─── 2.8: Detect merge conflicts ───

export async function getConflicts(projectPath: string): Promise<{ hasConflicts: boolean; conflictFiles: string[] }> {
  try {
    const status = await getStatus(projectPath);
    const conflictFiles = status.dirtyFiles
      .filter(f => f.status === 'UU' || f.status === 'AA' || f.status === 'DD')
      .map(f => f.file);
    return { hasConflicts: conflictFiles.length > 0, conflictFiles };
  } catch {
    return { hasConflicts: false, conflictFiles: [] };
  }
}

// ─── Push & Pull (wrappers for Phase 3 endpoints) ───

export async function pushBranch(
  projectPath: string,
  branch?: string,
  remote?: string
): Promise<GitExecResult> {
  return gitFetch<GitExecResult>('/api/git/push', {
    projectPath,
    branch: branch || '',
    remote: remote || 'origin',
  });
}

export async function pullBranch(
  projectPath: string,
  branch?: string,
  remote?: string
): Promise<GitExecResult> {
  return gitFetch<GitExecResult>('/api/git/pull', {
    projectPath,
    branch: branch || '',
    remote: remote || 'origin',
  });
}

// ─── High-Level: Full "Golden Path" commit cycle for an agent ───

export async function goldenPathCommit(
  agent: Agent,
  taskName: string,
  commitMessage: string,
  projectPath: string
): Promise<{ branch: string; committed: boolean; pushed: boolean; error?: string }> {
  try {
    // Step 1: Create a task branch
    const branchResult = await createBranch(agent, taskName, projectPath);
    if (!branchResult.success) {
      return { branch: '', committed: false, pushed: false, error: `Branch creation failed: ${branchResult.error}` };
    }
    const branchName = branchResult.output || '';

    // Step 2: Stage and commit
    const commitResult = await commitAsAgent(agent, commitMessage, projectPath);
    if (!commitResult.success) {
      return { branch: branchName, committed: false, pushed: false, error: `Commit failed: ${commitResult.error}` };
    }

    // Step 3: Push to remote
    const pushResult = await pushBranch(projectPath, branchName);

    return {
      branch: branchName,
      committed: true,
      pushed: pushResult.success,
      error: pushResult.success ? undefined : `Push failed: ${pushResult.error}`,
    };
  } catch (err: any) {
    return { branch: '', committed: false, pushed: false, error: err.message };
  }
}
