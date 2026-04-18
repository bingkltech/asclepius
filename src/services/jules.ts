/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Jules Tool Service — COO-Agent's connection to jules.google.com
 *
 * Architecture:
 *   COO-Agent → json:action CALL_JULES → julesCallTool() → Jules REST API
 *
 * All requests proxy through the Vite dev-server jules-bridge middleware
 * at `/api/jules/*` to avoid CORS restrictions.
 *
 * Jules API base: https://jules.google.com/api/v1
 */

export type JulesTaskStatus =
  | "pending"
  | "running"
  | "success"
  | "failed"
  | "cancelled";

export interface JulesTask {
  id: string;
  description: string;
  status: JulesTaskStatus;
  agentId: string; // Which Asclepius agent submitted this
  createdAt: string;
  completedAt?: string;
  result?: string;
  error?: string;
  /** Jules sandbox session ID */
  sessionId?: string;
}

export interface JulesSubmitPayload {
  description: string;
  agentId: string;
  /** Optional: files to pass to Jules as context */
  files?: Array<{ path: string; content: string }>;
  /** Optional: git repo URL for Jules to clone */
  repoUrl?: string;
}

export interface JulesSubmitResult {
  success: boolean;
  taskId?: string;
  sessionId?: string;
  message: string;
}

export interface JulesPollResult {
  success: boolean;
  task?: JulesTask;
  message: string;
}

// ─── In-memory task registry (persisted to localStorage) ───
const JULES_TASKS_KEY = "asclepius_jules_tasks";

function loadTasks(): JulesTask[] {
  try {
    const raw = localStorage.getItem(JULES_TASKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveTasks(tasks: JulesTask[]): void {
  try {
    // Cap at 100 tasks to prevent localStorage bloat
    localStorage.setItem(JULES_TASKS_KEY, JSON.stringify(tasks.slice(0, 100)));
  } catch {
    /* ignore */
  }
}

export function getJulesTasks(): JulesTask[] {
  return loadTasks();
}

export function clearJulesTasks(): void {
  localStorage.removeItem(JULES_TASKS_KEY);
}

// ─── Register a local task record ───
function upsertTask(task: JulesTask): void {
  const tasks = loadTasks();
  const idx = tasks.findIndex((t) => t.id === task.id);
  if (idx >= 0) {
    tasks[idx] = task;
  } else {
    tasks.unshift(task);
  }
  saveTasks(tasks);
}

/**
 * Submit a task to Jules.
 *
 * In production this would call: POST https://jules.google.com/api/v1/tasks
 * For now, we route through the Vite server's jules-bridge middleware at /api/jules/submit.
 * If Jules is unreachable, we create a local "simulated" task record so the COO can
 * still track work and the UI stays functional.
 */
export async function julesSubmitTask(
  payload: JulesSubmitPayload,
  apiKey?: string
): Promise<JulesSubmitResult> {
  const taskId = `jules-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // ─── Attempt real Jules API call ───
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    // Try the local Vite proxy first (avoids CORS), then direct
    const endpoints = ["/api/jules/submit", "https://jules.google.com/api/v1/tasks"];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify({
            task_description: payload.description,
            agent_id: payload.agentId,
            files: payload.files || [],
            repo_url: payload.repoUrl || null,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const task: JulesTask = {
            id: data.task_id || taskId,
            description: payload.description,
            status: "pending",
            agentId: payload.agentId,
            createdAt: new Date().toISOString(),
            sessionId: data.session_id,
          };
          upsertTask(task);
          return {
            success: true,
            taskId: task.id,
            sessionId: task.sessionId,
            message: `Jules task submitted successfully. ID: ${task.id}`,
          };
        }
      } catch {
        // Try next endpoint
        continue;
      }
    }

    throw new Error("All Jules endpoints unreachable");
  } catch (err) {
    // ─── Graceful degradation: create a local simulated task ───
    console.warn("[Jules] Real API unavailable, creating local task record:", err);

    const task: JulesTask = {
      id: taskId,
      description: payload.description,
      status: "pending",
      agentId: payload.agentId,
      createdAt: new Date().toISOString(),
      sessionId: `sim-session-${taskId}`,
    };
    upsertTask(task);

    // Simulate task completion after a delay
    simulateTaskExecution(task);

    return {
      success: true,
      taskId: task.id,
      sessionId: task.sessionId,
      message: `[SIMULATED] Jules API unavailable — task queued locally. ID: ${task.id}. Task will be simulated.`,
    };
  }
}

/**
 * Poll a Jules task for its current status.
 */
export async function julesPollTask(
  taskId: string,
  apiKey?: string
): Promise<JulesPollResult> {
  // First check local cache
  const localTask = loadTasks().find((t) => t.id === taskId);
  if (!localTask) {
    return { success: false, message: `Task ${taskId} not found.` };
  }

  // If already terminal, return from cache
  if (localTask.status === "success" || localTask.status === "failed" || localTask.status === "cancelled") {
    return { success: true, task: localTask, message: `Task ${taskId} is ${localTask.status}.` };
  }

  // Try real API
  try {
    const headers: Record<string, string> = {};
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

    const endpoints = [
      `/api/jules/status/${taskId}`,
      `https://jules.google.com/api/v1/tasks/${taskId}`,
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, { headers });
        if (response.ok) {
          const data = await response.json();
          const updated: JulesTask = {
            ...localTask,
            status: data.status as JulesTaskStatus,
            result: data.result,
            error: data.error,
            completedAt: data.completed_at,
          };
          upsertTask(updated);
          return { success: true, task: updated, message: `Status: ${updated.status}` };
        }
      } catch {
        continue;
      }
    }
  } catch {
    /* fall through to cached state */
  }

  return { success: true, task: localTask, message: `Status: ${localTask.status} (cached)` };
}

/**
 * Cancel a Jules task.
 */
export async function julesCancelTask(
  taskId: string,
  apiKey?: string
): Promise<{ success: boolean; message: string }> {
  const localTask = loadTasks().find((t) => t.id === taskId);
  if (!localTask) {
    return { success: false, message: `Task ${taskId} not found.` };
  }

  // Update local cache immediately
  upsertTask({ ...localTask, status: "cancelled", completedAt: new Date().toISOString() });

  // Try real API
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

    await fetch(`https://jules.google.com/api/v1/tasks/${taskId}/cancel`, {
      method: "POST",
      headers,
    });
  } catch {
    /* best-effort */
  }

  return { success: true, message: `Task ${taskId} cancelled.` };
}

// ─── Local simulation for when Jules API is unavailable ───
function simulateTaskExecution(task: JulesTask): void {
  // Simulate "running" state after 1 second
  setTimeout(() => {
    upsertTask({ ...task, status: "running" });
  }, 1000);

  // Simulate completion after 8-15 seconds (realistic Jules timing)
  const completionDelay = 8000 + Math.random() * 7000;
  setTimeout(() => {
    const success = Math.random() > 0.1; // 90% success rate
    upsertTask({
      ...task,
      status: success ? "success" : "failed",
      completedAt: new Date().toISOString(),
      result: success
        ? `[SIMULATED] Task completed: "${task.description}". All checks passed. Code changes committed to sandbox branch.`
        : undefined,
      error: success
        ? undefined
        : `[SIMULATED] Task failed: Could not complete "${task.description}". Sandbox error encountered.`,
    });
  }, completionDelay);
}
