import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { exec } from 'child_process'
import fs from 'fs'
import path from 'path'

const asclepiusBackendPlugin = () => {
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
          let body = '';
          req.on('data', (chunk: any) => { body += chunk.toString(); });
          req.on('end', () => {
            try {
              const { filePath, content } = JSON.parse(body);
              const dir = path.dirname(filePath);
              if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
              fs.writeFileSync(filePath, content, 'utf8');
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
          let body = '';
          req.on('data', (chunk: any) => { body += chunk.toString(); });
          req.on('end', () => {
            try {
              const { command, cwd } = JSON.parse(body);
              console.log(`[AsclepiusBackend] Executing: ${command} in ${cwd}`);
              exec(command, { cwd, shell: 'powershell.exe' }, (error, stdout, stderr) => {
                if (error) console.error(`[AsclepiusBackend] Exec Error:`, error);
                if (stderr) console.error(`[AsclepiusBackend] Exec Stderr:`, stderr);
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: error?.message, stdout, stderr }));
              });
            } catch (e: any) {
              console.error(`[AsclepiusBackend] JSON parse error:`, e.message, "Body:", body);
              res.statusCode = 400;
              res.end('Invalid request');
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
