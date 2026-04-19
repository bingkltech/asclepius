import type { PipelineTask, JulesWorker, ProjectState } from '../types/pipeline';

/**
 * The GodAgent is the core orchestrator. 
 * It runs entirely locally, manages state, and dispatches to Jules cloud workers.
 */
export class GodAgent {
  /**
   * Phase 1: Decomposition
   * Takes a high-level directive and breaks it into granular JSON tasks.
   */
  static decomposeGoal(directive: string): PipelineTask[] {
    console.log(`[GodAgent] Decomposing directive: ${directive}`);
    
    // In reality, this would call the local LLM or a cloud LLM to generate the JSON array.
    // For now, we mock the decomposition but pass the exact directive to Jules.
    return [
      {
        id: crypto.randomUUID(),
        goal: directive,
        assignedWorkerId: null,
        status: 'pending',
        logs: ["[System] Task generated from Project Directive"]
      }
    ];
  }

  /**
   * Phase 2: Dispatch
   * Assigns a pending task to an idle worker and sends the HTTP request to the Jules API.
   */
  static async dispatchTask(task: PipelineTask, worker: JulesWorker, repoTarget: string): Promise<{success: boolean, message: string}> {
    console.log(`[GodAgent] Dispatching Task ${task.id} to ${worker.alias}`);
    
    task.assignedWorkerId = worker.id;
    task.status = 'dispatched';
    worker.status = 'working';

    try {
      // Intercept CORS: Route through our local Vite proxy tunnel if targeting jules.*
      const proxiedEndpoint = worker.endpoint.replace(/^https:\/\/jules\.google(apis)?\.com(\/settings\/api)?/, '/jules-api');

      // Parse repo target (e.g., https://github.com/BinqQarenYu/mandelbrot.git -> BinqQarenYu/mandelbrot)
      let repoPath = repoTarget;
      if (repoTarget.includes('github.com')) {
        const parts = repoTarget.split('github.com/')[1].split('/');
        const owner = parts[0];
        const repo = parts[1].replace('.git', '');
        repoPath = `sources/github/${owner}/${repo}`;
      } else if (!repoPath.startsWith('sources/')) {
        repoPath = `sources/github/${repoPath}`;
      }

      const response = await fetch(`${proxiedEndpoint}/v1alpha/sessions`, {
        method: 'POST',
        headers: {
          'X-Goog-Api-Key': worker.token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: task.goal,
          sourceContext: {
            source: repoPath,
            githubRepoContext: { startingBranch: "main" }
          },
          automationMode: "AUTO_CREATE_PR",
          title: "Asclepius God-Agent Task"
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      console.log(`[GodAgent] Payload sent successfully to ${worker.endpoint}`);
      return { success: true, message: `200 OK. Jules worker acknowledged task.` };
    } catch (error: any) {
      console.error(`[GodAgent] Dispatch failed:`, error);
      task.status = 'failed';
      worker.status = 'idle';
      return { success: false, message: error.message || 'Network request failed' };
    }
  }

  /**
   * Phase 3: Local Sync
   * Executes local git commands to pull the branch Jules just pushed.
   */
  static async syncLocalSandbox(localPath: string, branch: string): Promise<void> {
    console.log(`[GodAgent] Running local git sync in ${localPath} for branch ${branch}`);
    // This would trigger a backend IPC call or a local shell execution
    // e.g., `git fetch && git checkout ${branch}`
  }
}
