// ═══════════════════════════════════════════════════════════════════
// JulesConnector — Jules Cloud API Dispatcher
// ═══════════════════════════════════════════════════════════════════
// This is a TOOL, not an agent. Agents use this tool to dispatch
// tasks to Jules cloud workers via the Google Jules API.

export class JulesConnector {
  /**
   * Dispatch a task to a Jules cloud worker.
   * Jules will create a PR on the target GitHub repository.
   */
  static async dispatch(options: {
    endpoint: string;
    apiKey: string;
    prompt: string;
    repoTarget: string;
    branch: string;
    title?: string;
  }): Promise<{ success: boolean; message: string }> {
    const { endpoint, apiKey, prompt, repoTarget, branch, title } = options;

    try {
      // Route through Vite proxy to avoid CORS
      const proxiedEndpoint = endpoint.replace(
        /^https:\/\/jules\.google(apis)?\.com(\/settings\/api)?/,
        '/jules-api'
      );

      // Normalize repo target to Jules API format
      let repoPath = repoTarget;
      if (repoTarget.includes('github.com')) {
        const parts = repoTarget.split('github.com/')[1].split('/');
        repoPath = `sources/github/${parts[0]}/${parts[1].replace('.git', '')}`;
      } else if (!repoPath.startsWith('sources/')) {
        repoPath = `sources/github/${repoPath}`;
      }

      const res = await fetch(`${proxiedEndpoint}/v1alpha/sessions`, {
        method: 'POST',
        headers: {
          'X-Goog-Api-Key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          sourceContext: {
            source: repoPath,
            githubRepoContext: { startingBranch: branch },
          },
          automationMode: 'AUTO_CREATE_PR',
          title: title || 'Asclepius Agent Task',
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

      return { success: true, message: '200 OK — Jules acknowledged task.' };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }
}
