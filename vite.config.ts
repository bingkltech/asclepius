import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import fs from 'fs';
import express from 'express';
import { execSync } from 'child_process';

const julesBridgePlugin = () => ({
  name: 'jules-bridge',
  configureServer(server) {
    const app = express();
    app.use(express.json({ limit: '50mb' }));

    // ─── Existing: Write files to disk ───
    app.post('/api/jules/write', async (req, res) => {
      try {
        const { filePath, content } = req.body;
        if (!filePath || !content) {
          return res.status(400).json({ error: 'Missing filePath or content' });
        }

        // Ensure path is within the project directory
        const resolvedPath = path.resolve(__dirname, filePath);
        if (!resolvedPath.startsWith(__dirname)) {
          return res.status(403).json({ error: 'Forbidden path traversal' });
        }

        await fs.promises.mkdir(path.dirname(resolvedPath), { recursive: true });
        await fs.promises.writeFile(resolvedPath, content, 'utf-8');

        console.log(`[Jules-Bridge] Successfully wrote file: ${filePath}`);
        res.json({ success: true, path: filePath });
      } catch (err: any) {
        console.error(`[Jules-Bridge] Error writing file:`, err);
        res.status(500).json({ error: err.message });
      }
    });

    // ─── NEW: Jules API proxy — Submit Task ───
    app.post('/api/jules/submit', async (req, res) => {
      try {
        const { task_description, agent_id, files, repo_url } = req.body;
        const env = loadEnv('development', '.', '');
        const julesApiKey = env.JULES_API_KEY || process.env.JULES_API_KEY || '';

        const response = await fetch('https://jules.google.com/api/v1/tasks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(julesApiKey ? { 'Authorization': `Bearer ${julesApiKey}` } : {}),
          },
          body: JSON.stringify({ task_description, agent_id, files: files || [], repo_url: repo_url || null }),
        });

        const data = await response.json();
        if (!response.ok) {
          return res.status(response.status).json(data);
        }
        console.log(`[Jules-Bridge] Task submitted: ${data.task_id} by ${agent_id}`);
        res.json(data);
      } catch (err: any) {
        console.error(`[Jules-Bridge] Submit error:`, err);
        res.status(503).json({ error: 'Jules API unreachable', detail: err.message });
      }
    });

    // ─── NEW: Jules API proxy — Poll Task Status ───
    app.get('/api/jules/status/:taskId', async (req, res) => {
      try {
        const { taskId } = req.params;
        const env = loadEnv('development', '.', '');
        const julesApiKey = env.JULES_API_KEY || process.env.JULES_API_KEY || '';

        const response = await fetch(`https://jules.google.com/api/v1/tasks/${taskId}`, {
          headers: julesApiKey ? { 'Authorization': `Bearer ${julesApiKey}` } : {},
        });

        const data = await response.json();
        if (!response.ok) return res.status(response.status).json(data);
        res.json(data);
      } catch (err: any) {
        res.status(503).json({ error: 'Jules API unreachable', detail: err.message });
      }
    });

    // ─── NEW: Jules API proxy — Cancel Task ───
    app.post('/api/jules/cancel/:taskId', async (req, res) => {
      try {
        const { taskId } = req.params;
        const env = loadEnv('development', '.', '');
        const julesApiKey = env.JULES_API_KEY || process.env.JULES_API_KEY || '';

        const response = await fetch(`https://jules.google.com/api/v1/tasks/${taskId}/cancel`, {
          method: 'POST',
          headers: julesApiKey ? { 'Authorization': `Bearer ${julesApiKey}` } : {},
        });

        const data = await response.json();
        res.status(response.ok ? 200 : response.status).json(data);
      } catch (err: any) {
        res.status(503).json({ error: 'Jules API unreachable', detail: err.message });
      }
    });

    // ─── NEW: Agent Local File System Write ───
    app.post('/api/jules/write', async (req, res) => {
      try {
        const { filePath, content } = req.body;
        if (!filePath || typeof content !== 'string') {
          return res.status(400).json({ error: 'Invalid payload: Requires filePath and content strings.' });
        }
        
        // Prevent path traversal
        const resolvedPath = path.resolve(__dirname, filePath);
        if (!resolvedPath.startsWith(__dirname)) {
          return res.status(403).json({ error: 'Forbidden: Path traversal detected.' });
        }

        const dir = path.dirname(resolvedPath);
        if (!fs.existsSync(dir)) {
          await fs.promises.mkdir(dir, { recursive: true });
        }

        await fs.promises.writeFile(resolvedPath, content, 'utf-8');
        res.json({ success: true, filePath });
      } catch (err: any) {
        console.error(`[FS_WRITE] Error writing file:`, err);
        res.status(500).json({ error: 'Failed to write file', detail: err.message });
      }
    });

    // ─── Settings Persistence — Encrypted config file ───
    const SETTINGS_FILE = path.resolve(__dirname, 'asclepius.config.enc');
    const SETTINGS_KEY = 'asclepius-local-secure-key-2026'; // Same key as crypto.ts

    app.get('/api/settings', async (_req, res) => {
      try {
        const CryptoJS = (await import('crypto-js')).default;
        if (!fs.existsSync(SETTINGS_FILE)) {
          return res.json({ exists: false, data: null });
        }
        const encrypted = await fs.promises.readFile(SETTINGS_FILE, 'utf-8');
        const decryptedBytes = CryptoJS.AES.decrypt(encrypted, SETTINGS_KEY);
        const decryptedText = decryptedBytes.toString(CryptoJS.enc.Utf8);
        if (!decryptedText) {
          return res.status(500).json({ error: 'Decryption failed — corrupt file or wrong key' });
        }
        const data = JSON.parse(decryptedText);
        console.log(`[Settings] Loaded config from asclepius.config.enc`);
        res.json({ exists: true, data });
      } catch (err: any) {
        console.error(`[Settings] Read error:`, err);
        res.status(500).json({ error: err.message });
      }
    });

    app.post('/api/settings', async (req, res) => {
      try {
        const CryptoJS = (await import('crypto-js')).default;
        const { data } = req.body;
        if (!data) {
          return res.status(400).json({ error: 'Missing data payload' });
        }
        const jsonString = JSON.stringify(data, null, 2);
        const encrypted = CryptoJS.AES.encrypt(jsonString, SETTINGS_KEY).toString();
        await fs.promises.writeFile(SETTINGS_FILE, encrypted, 'utf-8');

        // Ensure .gitignore has the config file
        const gitignorePath = path.resolve(__dirname, '.gitignore');
        if (fs.existsSync(gitignorePath)) {
          const gitignore = await fs.promises.readFile(gitignorePath, 'utf-8');
          if (!gitignore.includes('asclepius.config.enc')) {
            await fs.promises.appendFile(gitignorePath, '\n# Encrypted settings (API keys)\nasclepius.config.enc\n');
            console.log(`[Settings] Added asclepius.config.enc to .gitignore`);
          }
        }

        console.log(`[Settings] Saved config to asclepius.config.enc (${encrypted.length} bytes encrypted)`);
        res.json({ success: true, size: encrypted.length });
      } catch (err: any) {
        console.error(`[Settings] Write error:`, err);
        res.status(500).json({ error: err.message });
      }
    });

    // ═══════════════════════════════════════════════════════════════
    // ─── GOLDEN PATH: Git Operations API (Phase 1) ───
    // Secure, whitelisted git command execution for autonomous agents.
    // ═══════════════════════════════════════════════════════════════

    // Whitelist of allowed git subcommands to prevent arbitrary shell injection
    const GIT_ALLOWED_COMMANDS = [
      'status', 'branch', 'checkout', 'add', 'commit', 'merge',
      'log', 'diff', 'push', 'pull', 'fetch', 'stash', 'config',
      'rev-parse', 'remote', 'reset', 'show',
    ];

    // Helper: validate a project path exists and is a git repo
    const validateGitRepo = (projectPath: string): { valid: boolean; resolved: string; error?: string } => {
      const resolved = path.resolve(projectPath);
      if (!fs.existsSync(resolved)) {
        return { valid: false, resolved, error: `Path does not exist: ${resolved}` };
      }
      if (!fs.existsSync(path.join(resolved, '.git'))) {
        return { valid: false, resolved, error: `Not a git repository: ${resolved}` };
      }
      return { valid: true, resolved };
    };

    // Helper: execute a git command safely
    const execGit = (args: string, cwd: string, env?: Record<string, string>): { success: boolean; output: string; error?: string } => {
      try {
        const output = execSync(`git ${args}`, {
          cwd,
          encoding: 'utf-8',
          timeout: 30000, // 30s max to prevent hanging
          env: { ...process.env, ...env },
        });
        return { success: true, output: output.trim() };
      } catch (err: any) {
        return { success: false, output: '', error: err.stderr?.trim() || err.message };
      }
    };

    // ─── 1.1 & 1.2: /api/git/exec — Execute whitelisted git commands ───
    app.post('/api/git/exec', (req, res) => {
      try {
        const { command, projectPath, agentId, agentName, agentEmail } = req.body;
        if (!command || !projectPath) {
          return res.status(400).json({ error: 'Missing command or projectPath' });
        }

        // Parse and validate the git subcommand
        const parts = command.trim().split(/\s+/);
        const subcommand = parts[0];
        if (!GIT_ALLOWED_COMMANDS.includes(subcommand)) {
          console.warn(`[Git-Bridge] BLOCKED: "${subcommand}" is not whitelisted`);
          return res.status(403).json({ error: `Blocked: "git ${subcommand}" is not an allowed operation` });
        }

        const repo = validateGitRepo(projectPath);
        if (!repo.valid) {
          return res.status(400).json({ error: repo.error });
        }

        // 1.5: Inject agent identity before commits
        if (subcommand === 'commit' && agentName && agentEmail) {
          execGit(`config user.name "${agentName}"`, repo.resolved);
          execGit(`config user.email "${agentEmail}"`, repo.resolved);
          console.log(`[Git-Bridge] Identity set: ${agentName} <${agentEmail}>`);
        }

        const result = execGit(command, repo.resolved);
        console.log(`[Git-Bridge] [${agentId || 'system'}] git ${subcommand}: ${result.success ? 'OK' : 'FAIL'}`);

        if (result.success) {
          res.json({ success: true, output: result.output });
        } else {
          res.status(422).json({ success: false, error: result.error });
        }
      } catch (err: any) {
        console.error(`[Git-Bridge] Exec error:`, err);
        res.status(500).json({ error: err.message });
      }
    });

    // ─── 1.3: /api/git/status — Current branch, dirty files, last commit ───
    app.post('/api/git/status', (req, res) => {
      try {
        const { projectPath } = req.body;
        if (!projectPath) return res.status(400).json({ error: 'Missing projectPath' });

        const repo = validateGitRepo(projectPath);
        if (!repo.valid) return res.status(400).json({ error: repo.error });

        const branch = execGit('rev-parse --abbrev-ref HEAD', repo.resolved);
        const status = execGit('status --porcelain', repo.resolved);
        const lastCommit = execGit('log -1 --pretty=format:"%h|%an|%s|%ci"', repo.resolved);
        const remoteUrl = execGit('remote get-url origin', repo.resolved);

        const dirtyFiles = status.output
          ? status.output.split('\n').map(line => ({
              status: line.substring(0, 2).trim(),
              file: line.substring(3),
            }))
          : [];

        let commit = null;
        if (lastCommit.success && lastCommit.output) {
          const [hash, author, message, date] = lastCommit.output.replace(/"/g, '').split('|');
          commit = { hash, author, message, date };
        }

        res.json({
          branch: branch.output || 'unknown',
          isDirty: dirtyFiles.length > 0,
          dirtyFiles,
          lastCommit: commit,
          remoteUrl: remoteUrl.output || null,
        });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    // ─── 1.4: /api/git/branches — List all local branches ───
    app.post('/api/git/branches', (req, res) => {
      try {
        const { projectPath } = req.body;
        if (!projectPath) return res.status(400).json({ error: 'Missing projectPath' });

        const repo = validateGitRepo(projectPath);
        if (!repo.valid) return res.status(400).json({ error: repo.error });

        const result = execGit('branch --format="%(refname:short)|%(objectname:short)|%(subject)|%(authorname)"', repo.resolved);
        const current = execGit('rev-parse --abbrev-ref HEAD', repo.resolved);

        const branches = result.output
          ? result.output.split('\n').filter(Boolean).map(line => {
              const [name, hash, message, author] = line.replace(/"/g, '').split('|');
              return { name, hash, message, author, isCurrent: name === current.output };
            })
          : [];

        res.json({ branches, current: current.output });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    // ─── 3.8: /api/git/push — Push branch to remote ───
    app.post('/api/git/push', (req, res) => {
      try {
        const { projectPath, branch, remote } = req.body;
        if (!projectPath) return res.status(400).json({ error: 'Missing projectPath' });

        const repo = validateGitRepo(projectPath);
        if (!repo.valid) return res.status(400).json({ error: repo.error });

        const targetRemote = remote || 'origin';
        const targetBranch = branch || '';
        const result = execGit(`push ${targetRemote} ${targetBranch}`.trim(), repo.resolved);

        console.log(`[Git-Bridge] Push ${targetBranch || 'current'} to ${targetRemote}: ${result.success ? 'OK' : 'FAIL'}`);
        if (result.success) {
          res.json({ success: true, output: result.output });
        } else {
          res.status(422).json({ success: false, error: result.error });
        }
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    // ─── 3.8: /api/git/pull — Pull from remote ───
    app.post('/api/git/pull', (req, res) => {
      try {
        const { projectPath, branch, remote } = req.body;
        if (!projectPath) return res.status(400).json({ error: 'Missing projectPath' });

        const repo = validateGitRepo(projectPath);
        if (!repo.valid) return res.status(400).json({ error: repo.error });

        const targetRemote = remote || 'origin';
        const targetBranch = branch || '';
        const result = execGit(`pull ${targetRemote} ${targetBranch}`.trim(), repo.resolved);

        console.log(`[Git-Bridge] Pull ${targetBranch || 'current'} from ${targetRemote}: ${result.success ? 'OK' : 'FAIL'}`);
        if (result.success) {
          res.json({ success: true, output: result.output });
        } else {
          res.status(422).json({ success: false, error: result.error });
        }
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    server.middlewares.use(app);
  }
});


export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss(), julesBridgePlugin()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
