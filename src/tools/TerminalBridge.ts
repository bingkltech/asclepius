// ═══════════════════════════════════════════════════════════════════
// TerminalBridge — Dual-Mode Filesystem Access
// ═══════════════════════════════════════════════════════════════════
// BROWSER MODE: Routes through Vite middleware endpoints.
// NODE.JS MODE: Uses native fs and child_process directly.
// This ensures the background daemon can operate without Vite.

const isNode = typeof window === 'undefined';

// Lazy-load Node.js modules only in daemon mode
let _fs: typeof import('fs') | null = null;
let _path: typeof import('path') | null = null;
let _execSync: typeof import('child_process').execSync | null = null;

if (isNode) {
  // Dynamic imports resolved at module load in Node
  _fs = await import('fs');
  _path = await import('path');
  const cp = await import('child_process');
  _execSync = cp.execSync;
}

export class TerminalBridge {
  // ─── List Directory ───────────────────────────────────────────────
  static async listDir(dirPath: string): Promise<{ name: string; isDirectory: boolean }[]> {
    if (isNode && _fs) {
      if (!_fs.existsSync(dirPath)) throw new Error(`[TerminalBridge] Directory not found: ${dirPath}`);
      const entries = _fs.readdirSync(dirPath, { withFileTypes: true });
      return entries.map(e => ({ name: e.name, isDirectory: e.isDirectory() }));
    }
    // Browser mode: use Vite proxy
    const res = await fetch('/api/list-dir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dirPath }),
    });
    if (!res.ok) throw new Error(`[TerminalBridge] list-dir failed: ${res.statusText}`);
    const data = await res.json();
    return data.files ?? [];
  }

  // ─── Read File ────────────────────────────────────────────────────
  static async readFile(filePath: string): Promise<string> {
    if (isNode && _fs) {
      if (!_fs.existsSync(filePath)) throw new Error(`[TerminalBridge] File not found: ${filePath}`);
      return _fs.readFileSync(filePath, 'utf-8');
    }
    const res = await fetch('/api/read-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath }),
    });
    if (!res.ok) throw new Error(`[TerminalBridge] read-file failed: ${res.statusText}`);
    const data = await res.json();
    return data.content ?? '';
  }

  // ─── Write File ───────────────────────────────────────────────────
  static async writeFile(filePath: string, content: string): Promise<void> {
    if (isNode && _fs && _path) {
      const dir = _path.dirname(filePath);
      if (!_fs.existsSync(dir)) _fs.mkdirSync(dir, { recursive: true });
      _fs.writeFileSync(filePath, content, 'utf-8');
      return;
    }
    const res = await fetch('/api/write-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath, content }),
    });
    if (!res.ok) throw new Error(`[TerminalBridge] write-file failed: ${res.statusText}`);
  }

  // ─── Run Command ──────────────────────────────────────────────────
  static async runCommand(command: string, cwd: string): Promise<{ stdout: string; stderr: string; error?: string }> {
    if (isNode && _execSync) {
      try {
        const stdout = _execSync(command, { cwd, encoding: 'utf-8', timeout: 60000, shell: 'powershell.exe' });
        return { stdout: stdout || '', stderr: '' };
      } catch (err: any) {
        return { stdout: err.stdout || '', stderr: err.stderr || '', error: err.message };
      }
    }
    const res = await fetch('/api/run-command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, cwd }),
    });
    if (!res.ok) throw new Error(`[TerminalBridge] run-command failed: ${res.statusText}`);
    return await res.json();
  }

  // ─── Get Git Branches ─────────────────────────────────────────────
  static async getBranches(cwd: string): Promise<string[]> {
    if (isNode && _execSync) {
      try {
        const stdout = _execSync('git branch -a', { cwd, encoding: 'utf-8', timeout: 10000 });
        return stdout.split('\n').map(b => b.trim().replace(/^\* /, '')).filter(Boolean);
      } catch {
        return ['main'];
      }
    }
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
