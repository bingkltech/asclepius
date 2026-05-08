import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { exec } from 'child_process'
import fs from 'fs'
import path from 'path'

// ── Shared Security Helpers ────────────────────────────────────────
const SAFE_WORKSPACE_ROOTS = [
  'F:\\012A_Github\\',
  'F:\\012D_TRADE\\',
  'C:\\Users\\likha\\',
];

function isPathInWorkspace(filePath: string): boolean {
  const normalized = path.normalize(filePath);
  return SAFE_WORKSPACE_ROOTS.some(root =>
    normalized.toLowerCase().startsWith(root.toLowerCase())
  );
}

const asclepiusBackendPlugin = () => {
  // Rate-limiter state: tracks timestamps of recent run-command calls
  let commandTimestamps: number[] = [];

  return {
    name: 'asclepius-backend',
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        if (req.url === '/api/get-branches' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: any) => { body += chunk.toString(); });
          req.on('end', () => {
            try {
              const { cwd } = JSON.parse(body);
              const gitPath = path.join(cwd, '.git');
              const branches = new Set<string>();
              
              if (!fs.existsSync(gitPath)) {
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({ error: 'Not a git repository' }));
              }

              // 1. Read unpacked local heads
              const headsPath = path.join(gitPath, 'refs', 'heads');
              if (fs.existsSync(headsPath)) {
                const readDirRecursive = (dir: string, prefix = '') => {
                  const files = fs.readdirSync(dir, { withFileTypes: true });
                  for (const file of files) {
                    if (file.isDirectory()) {
                      readDirRecursive(path.join(dir, file.name), `${prefix}${file.name}/`);
                    } else {
                      branches.add(`${prefix}${file.name}`);
                    }
                  }
                };
                readDirRecursive(headsPath);
              }

              // 2. Read unpacked remotes
              const remotesPath = path.join(gitPath, 'refs', 'remotes');
              if (fs.existsSync(remotesPath)) {
                const readDirRecursive = (dir: string, prefix = '') => {
                  const files = fs.readdirSync(dir, { withFileTypes: true });
                  for (const file of files) {
                    if (file.isDirectory()) {
                      readDirRecursive(path.join(dir, file.name), `${prefix}${file.name}/`);
                    } else {
                      branches.add(`origin/${prefix}${file.name}`); // simplify remote display
                    }
                  }
                };
                // Just scan the origin folder or whatever remote folders exist
                const remotes = fs.readdirSync(remotesPath, { withFileTypes: true });
                for (const remote of remotes) {
                  if (remote.isDirectory()) {
                     readDirRecursive(path.join(remotesPath, remote.name), `${remote.name}/`);
                  }
                }
              }

              // 3. Read packed-refs
              const packedRefsPath = path.join(gitPath, 'packed-refs');
              if (fs.existsSync(packedRefsPath)) {
                const content = fs.readFileSync(packedRefsPath, 'utf8');
                const lines = content.split('\n');
                for (const line of lines) {
                  if (!line.startsWith('#') && !line.startsWith('^')) {
                    const parts = line.split(' ');
                    if (parts.length === 2) {
                      const ref = parts[1].trim();
                      if (ref.startsWith('refs/heads/')) {
                        branches.add(ref.replace('refs/heads/', ''));
                      } else if (ref.startsWith('refs/remotes/')) {
                        branches.add(ref.replace('refs/remotes/', ''));
                      }
                    }
                  }
                }
              }
              
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ branches: Array.from(branches) }));
            } catch (e: any) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: e.message }));
            }
          });
          return;
        }

        if (req.url === '/api/read-file' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: any) => { body += chunk.toString(); });
          req.on('end', () => {
            try {
              const { filePath } = JSON.parse(body);
              if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf8');
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ content }));
              } else {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: 'File not found' }));
              }
            } catch (e: any) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: e.message }));
            }
          });
          return;
        }

        if (req.url === '/api/write-file' && req.method === 'POST') {
          // ── Security: localhost-only ───────────────────────────────
          const writeAddr = req.socket?.remoteAddress ?? '';
          const writeIsLocal = writeAddr === '127.0.0.1' || writeAddr === '::1' || writeAddr === '::ffff:127.0.0.1';
          if (!writeIsLocal) {
            res.statusCode = 403;
            return res.end(JSON.stringify({ error: 'Forbidden: write-file is localhost-only' }));
          }
          let body = '';
          req.on('data', (chunk: any) => { body += chunk.toString(); });
          req.on('end', () => {
            try {
              const { filePath, content } = JSON.parse(body);

              // ── Security: path traversal guard ────────────────────
              // Block any write outside of known workspace roots.
              // Prevents agents from writing to system directories.
              if (!isPathInWorkspace(filePath)) {
                console.warn(`[AsclepiusBackend] BLOCKED write outside workspace: "${filePath}"`);
                res.statusCode = 403;
                return res.end(JSON.stringify({
                  error: `Write path not permitted: "${filePath}". Must be within a workspace root.`
                }));
              }

              const dir = path.dirname(filePath);
              if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
              fs.writeFileSync(filePath, content, 'utf8');
              console.log(`[AsclepiusBackend] ✅ Wrote file: "${filePath}" (${content.length} bytes)`);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true }));
            } catch (e: any) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: e.message }));
            }
          });
          return;
        }

        if (req.url === '/api/list-dir' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: any) => { body += chunk.toString(); });
          req.on('end', () => {
            try {
              const { dirPath } = JSON.parse(body);
              if (fs.existsSync(dirPath)) {
                const files = fs.readdirSync(dirPath, { withFileTypes: true });
                const tree = files.map(f => ({ name: f.name, isDirectory: f.isDirectory() }));
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ files: tree }));
              } else {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: 'Directory not found' }));
              }
            } catch (e: any) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: e.message }));
            }
          });
          return;
        }

        if (req.url === '/api/run-command' && req.method === 'POST') {
          // ── Security: localhost-only origin guard ─────────────────
          const remoteAddr = req.socket?.remoteAddress ?? '';
          const isLocal = remoteAddr === '127.0.0.1' || remoteAddr === '::1' || remoteAddr === '::ffff:127.0.0.1';
          if (!isLocal) {
            res.statusCode = 403;
            return res.end(JSON.stringify({ error: 'Forbidden: run-command is localhost-only' }));
          }

          // ── Security: rate limiter (max 20 commands per minute) ───
          const now = Date.now();
          commandTimestamps = commandTimestamps.filter((t: number) => now - t < 60_000);
          if (commandTimestamps.length >= 20) {
            res.statusCode = 429;
            return res.end(JSON.stringify({ error: 'Rate limit: max 20 commands/min exceeded' }));
          }
          commandTimestamps.push(now);

          let body = '';
          req.on('data', (chunk: any) => { body += chunk.toString(); });
          req.on('end', () => {
            try {
              const { command, cwd } = JSON.parse(body);

              // ── Security: command allowlist ───────────────────────
              // Only permit known, safe base commands used by the agent pipeline.
              // Arguments are NOT validated here — allowlist covers the base command only.
              const ALLOWED_COMMAND_PREFIXES = [
                'git fetch', 'git branch', 'git checkout', 'git status',
                'git rebase', 'git merge', 'git log', 'git diff',
                'npx tsc', 'tsc',
                'npm run test', 'npm run lint', 'npm run build', 'npm run dev',
                'npx vitest', 'vitest',
                'npx playwright', 'playwright',
                'uv run',
                'node -e',
                'echo ',  // safe — used for writing to log files
              ];
              const trimmed = command.trim();
              const isAllowed = ALLOWED_COMMAND_PREFIXES.some(prefix =>
                trimmed.toLowerCase().startsWith(prefix.toLowerCase())
              );
              if (!isAllowed) {
                console.warn(`[AsclepiusBackend] BLOCKED command (not in allowlist): "${trimmed}"`);
                res.statusCode = 403;
                return res.end(JSON.stringify({
                  error: `Command not permitted: "${trimmed.substring(0, 80)}". Only git, tsc, npm, vitest, uv, playwright commands are allowed.`
                }));
              }

              // ── Security: cwd workspace boundary guard ─────────────
              // Uses shared isPathInWorkspace() — same roots as write-file guard.
              const normalizedCwd = path.normalize(cwd || '');
              if (!isPathInWorkspace(normalizedCwd)) {
                console.warn(`[AsclepiusBackend] BLOCKED cwd (outside workspace): "${normalizedCwd}"`);
                res.statusCode = 403;
                return res.end(JSON.stringify({
                  error: `Working directory not permitted: "${normalizedCwd}". Must be within a known workspace root.`
                }));
              }

              console.log(`[AsclepiusBackend] ✅ Executing: "${trimmed}" in "${normalizedCwd}"`);
              exec(trimmed, { cwd: normalizedCwd, shell: 'powershell.exe', timeout: 120_000 }, (error, stdout, stderr) => {
                if (error) console.error(`[AsclepiusBackend] Exec Error:`, error.message);
                if (stderr) console.error(`[AsclepiusBackend] Exec Stderr:`, stderr.slice(0, 500));
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: error?.message ?? null, stdout, stderr }));
              });
            } catch (e: any) {
              console.error(`[AsclepiusBackend] JSON parse error:`, e.message);
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Invalid request body' }));
            }
          });
          return;
        }
        next();
      });
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    asclepiusBackendPlugin()
  ],
  server: {
    proxy: {
      '/jules-api': {
        target: 'https://jules.googleapis.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/jules-api/, '')
      }
    }
  }
})
