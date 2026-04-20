// ═══════════════════════════════════════════════════════════════════
// TerminalBridge — Local Filesystem Access via Vite Backend
// ═══════════════════════════════════════════════════════════════════
// This is a TOOL, not an agent. Agents use this tool to interact
// with the local filesystem through the Vite middleware endpoints.

export class TerminalBridge {
  static async listDir(dirPath: string): Promise<{ name: string; isDirectory: boolean }[]> {
    const res = await fetch('/api/list-dir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dirPath }),
    });
    if (!res.ok) throw new Error(`[TerminalBridge] list-dir failed: ${res.statusText}`);
    const data = await res.json();
    return data.files ?? [];
  }

  static async readFile(filePath: string): Promise<string> {
    const res = await fetch('/api/read-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath }),
    });
    if (!res.ok) throw new Error(`[TerminalBridge] read-file failed: ${res.statusText}`);
    const data = await res.json();
    return data.content ?? '';
  }

  static async writeFile(filePath: string, content: string): Promise<void> {
    const res = await fetch('/api/write-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath, content }),
    });
    if (!res.ok) throw new Error(`[TerminalBridge] write-file failed: ${res.statusText}`);
  }

  static async runCommand(command: string, cwd: string): Promise<{ stdout: string; stderr: string; error?: string }> {
    const res = await fetch('/api/run-command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, cwd }),
    });
    if (!res.ok) throw new Error(`[TerminalBridge] run-command failed: ${res.statusText}`);
    return await res.json();
  }

  static async getBranches(cwd: string): Promise<string[]> {
    const res = await fetch('/api/get-branches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cwd }),
    });
    if (!res.ok) throw new Error(`[TerminalBridge] get-branches failed: ${res.statusText}`);
    const data = await res.json();
    return data.branches ?? [];
  }
}
