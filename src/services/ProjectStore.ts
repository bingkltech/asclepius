// ═══════════════════════════════════════════════════════════════════
// ProjectStore — Per-Project Persistent Storage
// ═══════════════════════════════════════════════════════════════════
// Saves conversations, DAG tasks, and settings as JSON files inside
// each project's .asclepius/ directory. Data survives across branches
// and sessions because it lives in the filesystem, not localStorage.
//
// File structure per project:
//   {projectPath}/.asclepius/
//     ├── settings.json        # Project-level settings (team, branch configs)
//     ├── conversations.json   # Full Lead Agent chat history
//     └── dag-tasks.json       # Current and historical DAG task state

import { TerminalBridge } from '../tools/TerminalBridge';

// ─── Types ──────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'agent';
  message: string;
  timestamp: number;
}

export interface ProjectSettings {
  assignedWorkerIds: string[];
  activeBranch: string;
  lastOpenedAt: number;
  godAgentEngine?: string;
  notes?: string;
}

export interface ProjectStoreData {
  conversations: ChatMessage[];
  dagTasks: any[];
  settings: ProjectSettings;
}

// ─── Core Store ─────────────────────────────────────────────────────

export class ProjectStore {
  private static readonly DIR = '.asclepius';

  private static basePath(projectPath: string): string {
    // Normalize path separators
    const normalized = projectPath.replace(/\\/g, '/');
    return `${normalized}/${ProjectStore.DIR}`;
  }

  // ── Ensure the .asclepius directory exists ──
  private static async ensureDir(projectPath: string): Promise<void> {
    const base = ProjectStore.basePath(projectPath);
    try {
      await TerminalBridge.listDir(base);
    } catch {
      // Directory doesn't exist — create it by writing a marker file
      await TerminalBridge.writeFile(`${base}/.asclepius-init`, JSON.stringify({ createdAt: Date.now() }));
    }
  }

  // ── Generic read/write helpers ──

  private static async readJSON<T>(projectPath: string, filename: string, fallback: T): Promise<T> {
    try {
      const filePath = `${ProjectStore.basePath(projectPath)}/${filename}`;
      const raw = await TerminalBridge.readFile(filePath);
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  private static async writeJSON(projectPath: string, filename: string, data: any): Promise<void> {
    await ProjectStore.ensureDir(projectPath);
    const filePath = `${ProjectStore.basePath(projectPath)}/${filename}`;
    await TerminalBridge.writeFile(filePath, JSON.stringify(data, null, 2));
  }

  // ── Conversations ──

  static async loadConversations(projectPath: string): Promise<ChatMessage[]> {
    return ProjectStore.readJSON<ChatMessage[]>(projectPath, 'conversations.json', []);
  }

  static async saveConversations(projectPath: string, messages: ChatMessage[]): Promise<void> {
    await ProjectStore.writeJSON(projectPath, 'conversations.json', messages);
  }

  // ── DAG Tasks ──

  static async loadDagTasks(projectPath: string): Promise<any[]> {
    return ProjectStore.readJSON<any[]>(projectPath, 'dag-tasks.json', []);
  }

  static async saveDagTasks(projectPath: string, tasks: any[]): Promise<void> {
    await ProjectStore.writeJSON(projectPath, 'dag-tasks.json', tasks);
  }

  // ── Settings ──

  static async loadSettings(projectPath: string): Promise<ProjectSettings> {
    return ProjectStore.readJSON<ProjectSettings>(projectPath, 'settings.json', {
      assignedWorkerIds: [],
      activeBranch: 'main',
      lastOpenedAt: Date.now(),
    });
  }

  static async saveSettings(projectPath: string, settings: ProjectSettings): Promise<void> {
    await ProjectStore.writeJSON(projectPath, 'settings.json', {
      ...settings,
      lastOpenedAt: Date.now(),
    });
  }

  // ── Load Everything ──

  static async loadAll(projectPath: string): Promise<ProjectStoreData> {
    const [conversations, dagTasks, settings] = await Promise.all([
      ProjectStore.loadConversations(projectPath),
      ProjectStore.loadDagTasks(projectPath),
      ProjectStore.loadSettings(projectPath),
    ]);
    return { conversations, dagTasks, settings };
  }

  // ── Save Everything ──

  static async saveAll(projectPath: string, data: Partial<ProjectStoreData>): Promise<void> {
    const promises: Promise<void>[] = [];
    if (data.conversations) promises.push(ProjectStore.saveConversations(projectPath, data.conversations));
    if (data.dagTasks) promises.push(ProjectStore.saveDagTasks(projectPath, data.dagTasks));
    if (data.settings) promises.push(ProjectStore.saveSettings(projectPath, data.settings));
    await Promise.all(promises);
  }
}
