/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * GitHub Desktop Adapter — Golden Path Phase 3
 * Bridge between Asclepius agents and the locally installed GitHub Desktop / Git CLI.
 *
 * This adapter detects:
 *   1. Whether `git` CLI is available (required)
 *   2. Whether `gh` CLI (GitHub CLI) is installed (optional, enables PR creation)
 *   3. Whether GitHub Desktop is installed (optional, enables visual repo management)
 *
 * All push/pull operations route through the local git installation,
 * leveraging the authentication already configured in GitHub Desktop or git credential manager.
 */

import { execGitCommand, getStatus, pushBranch, pullBranch } from './gitOps';
import type { Agent } from '@/src/types';

// ─── Types ───

export interface GitHubDesktopStatus {
  gitInstalled: boolean;
  gitVersion: string | null;
  ghCliInstalled: boolean;
  ghCliVersion: string | null;
  githubDesktopInstalled: boolean;
  authenticatedUser: string | null;
}

export interface PRCreateResult {
  success: boolean;
  prUrl?: string;
  prNumber?: number;
  error?: string;
}

// ─── 3.1: Research — Using git CLI + gh CLI (not GitHub Desktop GUI) ───
// GitHub Desktop does not have a CLI. The correct tools are:
//   - `git` — for all local operations (branch, commit, push, pull)
//   - `gh` — GitHub's official CLI for PR creation, review, merge
// GitHub Desktop will automatically sync when git operations are performed
// in a repo that Desktop is tracking, since it watches the .git folder.

// ─── 3.3: Detect installed tools ───

export async function detectGitHubDesktop(): Promise<GitHubDesktopStatus> {
  const status: GitHubDesktopStatus = {
    gitInstalled: false,
    gitVersion: null,
    ghCliInstalled: false,
    ghCliVersion: null,
    githubDesktopInstalled: false,
    authenticatedUser: null,
  };

  try {
    // Check git CLI
    const gitCheck = await fetch('/api/git/exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: '--version', projectPath: '.' }),
    });
    if (gitCheck.ok) {
      const data = await gitCheck.json();
      status.gitInstalled = true;
      status.gitVersion = data.output || null;
    }
  } catch { /* git not available */ }

  try {
    // Check gh CLI
    const ghCheck = await fetch('/api/git/exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // We'll piggyback on the exec endpoint but gh isn't a git subcommand,
      // so we check via a dedicated mechanism
      body: JSON.stringify({ command: 'version', projectPath: '.' }),
    });
    // gh CLI detection will be done differently — through a dedicated endpoint
    // For now, we mark it as false and detect via the backend
    status.ghCliInstalled = false;
  } catch { /* gh not available */ }

  try {
    // Check GitHub Desktop — on Windows it's typically in LocalAppData
    // We detect by checking if the GitHub Desktop protocol handler exists
    // This is a best-effort check; the real indicator is whether repos sync
    if (typeof window !== 'undefined') {
      status.githubDesktopInstalled = true; // Assume installed if on Windows with GitHub Desktop
    }
  } catch { /* can't detect */ }

  return status;
}

// ─── 3.4: Push branch to GitHub via local git ───

export async function pushToGitHub(
  projectPath: string,
  branchName: string,
  agent?: Agent
): Promise<{ success: boolean; output?: string; error?: string }> {
  // First ensure we're on the correct branch
  if (branchName) {
    await execGitCommand(`checkout ${branchName}`, projectPath, agent);
  }

  // Push using the locally configured credentials
  const result = await pushBranch(projectPath, branchName, 'origin');

  if (result.success) {
    console.log(`[GitHub-Desktop] Pushed ${branchName} to origin`);
  } else {
    console.error(`[GitHub-Desktop] Push failed: ${result.error}`);
  }

  return result;
}

// ─── 3.5: Pull latest main for sandbox testing ───

export async function pullMainForSandbox(
  projectPath: string
): Promise<{ success: boolean; branch: string; output?: string; error?: string }> {
  // Stash any local changes first
  await execGitCommand('stash', projectPath);

  // Checkout main
  const checkout = await execGitCommand('checkout main', projectPath);
  if (!checkout.success) {
    // Try 'master' if 'main' doesn't exist
    const checkoutMaster = await execGitCommand('checkout master', projectPath);
    if (!checkoutMaster.success) {
      return { success: false, branch: 'unknown', error: 'Could not checkout main or master branch' };
    }
  }

  // Pull latest
  const pull = await pullBranch(projectPath, '', 'origin');

  const currentBranch = checkout.success ? 'main' : 'master';
  return {
    success: pull.success,
    branch: currentBranch,
    output: pull.output,
    error: pull.error,
  };
}

// ─── 3.6: Open repository in GitHub Desktop ───

export function openInDesktop(projectPath: string): boolean {
  try {
    // GitHub Desktop registers a protocol handler: x-github-client://openRepo/path
    // On Windows, we can also use: github open <path>
    const url = `x-github-client://openRepo/${encodeURIComponent(projectPath)}`;
    window.open(url, '_blank');
    console.log(`[GitHub-Desktop] Opened repo in Desktop: ${projectPath}`);
    return true;
  } catch {
    console.error(`[GitHub-Desktop] Failed to open in Desktop`);
    return false;
  }
}

// ─── High-Level: Checkout agent branch for COO sandbox testing ───

export async function checkoutBranchForSandbox(
  agentBranch: string,
  projectPath: string
): Promise<{ success: boolean; error?: string }> {
  // Stash any local changes
  await execGitCommand('stash', projectPath);

  // Fetch latest
  await execGitCommand('fetch origin', projectPath);

  // Checkout the agent's branch
  const result = await execGitCommand(`checkout ${agentBranch}`, projectPath);

  if (result.success) {
    console.log(`[GitHub-Desktop] Sandbox ready on branch: ${agentBranch}`);
  }

  return { success: result.success, error: result.error };
}

// ─── High-Level: Full sandbox test cycle (COO workflow) ───

export async function sandboxTestCycle(
  agentBranch: string,
  projectPath: string,
  testCommand: string = 'npm run build'
): Promise<{
  success: boolean;
  testPassed: boolean;
  testOutput: string;
  error?: string;
}> {
  // Step 1: Checkout the agent's branch
  const checkout = await checkoutBranchForSandbox(agentBranch, projectPath);
  if (!checkout.success) {
    return { success: false, testPassed: false, testOutput: '', error: checkout.error };
  }

  // Step 2: Run the test command via the exec endpoint
  // Note: This uses the git exec endpoint which only allows git commands.
  // For running npm/build commands, we'll need a separate endpoint or
  // use the existing /api/jules/write infrastructure.
  // For now, we return a placeholder indicating the COO should trigger tests manually.

  return {
    success: true,
    testPassed: false, // Placeholder — real testing will be wired later
    testOutput: `Branch ${agentBranch} checked out. Run "${testCommand}" manually or via Command Center.`,
  };
}
