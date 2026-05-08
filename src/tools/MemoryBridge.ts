// ═══════════════════════════════════════════════════════════════════
// MemoryBridge — Persistent Vector Memory for Asclepius Agents
// ═══════════════════════════════════════════════════════════════════
// Phase 1 Integration from ruflo (ruvnet/ruflo)
// Adapted from: v3/src/memory/ (AgentDB + HybridBackend pattern)
//
// What this gives us:
//   - Persistent memory across sessions (agents stop being goldfish)
//   - Cosine similarity search over embeddings (sub-ms recall)
//   - Ollama-native embedding generation (no cloud dependencies)
//   - JSON file persistence (no MongoDB/SQLite required)
//
// Constitutional Compliance:
//   - Article II: This is a TOOL (infrastructure), not a Brain or Hand
//   - Article IV: Backend persistence only — dashboard stays localStorage
//   - Article VI: Memory recall is advisory — agents still make own decisions

import fs from 'fs';
import path from 'path';

// ─── Types ──────────────────────────────────────────────────────────

export type MemoryType = 'task' | 'context' | 'event' | 'blueprint' | 'error' | 'learning';

export interface MemoryEntry {
  id: string;
  agentId: string;
  content: string;
  type: MemoryType;
  timestamp: number;
  embedding?: number[];
  metadata?: Record<string, unknown>;
}

export interface MemorySearchResult extends MemoryEntry {
  similarity: number;
}

export interface MemoryQuery {
  agentId?: string;
  type?: MemoryType;
  timeRange?: { start: number; end: number };
  metadata?: Record<string, unknown>;
  limit?: number;
}

export interface MemoryBridgeConfig {
  /** Directory to persist memory files */
  storagePath: string;
  /** Ollama endpoint for embeddings */
  ollamaEndpoint?: string;
  /** Embedding model to use */
  embeddingModel?: string;
  /** Maximum number of memories to retain (LRU eviction) */
  maxEntries?: number;
  /** Embedding dimension (must match model output) */
  dimensions?: number;
}

// ─── MemoryBridge ───────────────────────────────────────────────────

export class MemoryBridge {
  private memories: Map<string, MemoryEntry> = new Map();
  private config: Required<MemoryBridgeConfig>;
  private dirty: boolean = false;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private initialized: boolean = false;

  private static instance: MemoryBridge | null = null;

  constructor(config: MemoryBridgeConfig) {
    this.config = {
      storagePath: config.storagePath,
      ollamaEndpoint: config.ollamaEndpoint || 'http://localhost:11434',
      embeddingModel: config.embeddingModel || 'nomic-embed-text',
      maxEntries: config.maxEntries || 5000,
      dimensions: config.dimensions || 768,
    };
  }

  /** Singleton access for the goal-orchestrator process */
  static getInstance(config?: MemoryBridgeConfig): MemoryBridge {
    if (!MemoryBridge.instance && config) {
      MemoryBridge.instance = new MemoryBridge(config);
    }
    if (!MemoryBridge.instance) {
      throw new Error('[MemoryBridge] Not initialized. Call getInstance(config) first.');
    }
    return MemoryBridge.instance;
  }

  // ─── Lifecycle ──────────────────────────────────────────────────

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Ensure storage directory exists
    const dir = path.dirname(this.getStorageFile());
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Load existing memories from disk
    const filePath = this.getStorageFile();
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const entries: MemoryEntry[] = JSON.parse(raw);
        for (const entry of entries) {
          this.memories.set(entry.id, entry);
        }
        console.log(`[MemoryBridge] Loaded ${this.memories.size} memories from disk.`);
      } catch (err: any) {
        console.warn(`[MemoryBridge] Failed to load memories: ${err.message}. Starting fresh.`);
      }
    }

    this.initialized = true;
  }

  async shutdown(): Promise<void> {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    await this.flush();
    this.initialized = false;
  }

  // ─── Store ──────────────────────────────────────────────────────

  /**
   * Store a memory entry. Optionally generates embeddings via Ollama.
   */
  async store(
    agentId: string,
    content: string,
    type: MemoryType,
    metadata?: Record<string, unknown>,
    skipEmbedding: boolean = false
  ): Promise<MemoryEntry> {
    const entry: MemoryEntry = {
      id: `${type}-${agentId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      agentId,
      content: content.substring(0, 8000), // Cap content to prevent bloat
      type,
      timestamp: Date.now(),
      metadata,
    };

    // Generate embedding if possible
    if (!skipEmbedding) {
      try {
        entry.embedding = await this.generateEmbedding(content);
      } catch (err: any) {
        console.warn(`[MemoryBridge] Embedding failed (storing without): ${err.message}`);
      }
    }

    this.memories.set(entry.id, entry);
    this.scheduleSave();

    // LRU eviction
    if (this.memories.size > this.config.maxEntries) {
      this.evictOldest(this.memories.size - this.config.maxEntries);
    }

    return entry;
  }

  /**
   * Convenience: Store a task result for future recall.
   */
  async storeTaskResult(
    agentId: string,
    goal: string,
    output: string,
    status: 'completed' | 'failed'
  ): Promise<MemoryEntry> {
    const content = `GOAL: ${goal}\nSTATUS: ${status}\nOUTPUT SUMMARY: ${output.substring(0, 2000)}`;
    return this.store(agentId, content, status === 'completed' ? 'task' : 'error', {
      goal,
      status,
      outputLength: output.length,
    });
  }

  /**
   * Convenience: Store a learning insight from meta-analysis.
   */
  async storeLearning(agentId: string, insight: string): Promise<MemoryEntry> {
    return this.store(agentId, insight, 'learning');
  }

  // ─── Search ─────────────────────────────────────────────────────

  /**
   * Semantic search: Find memories similar to the query text.
   * Uses cosine similarity over Ollama embeddings.
   */
  async searchSimilar(queryText: string, topK: number = 5, agentId?: string): Promise<MemorySearchResult[]> {
    let queryEmbedding: number[];
    try {
      queryEmbedding = await this.generateEmbedding(queryText);
    } catch (err: any) {
      console.warn(`[MemoryBridge] Cannot search (embedding failed): ${err.message}`);
      // Fallback to keyword search
      return this.keywordSearch(queryText, topK, agentId);
    }

    const candidates = Array.from(this.memories.values())
      .filter(m => m.embedding && m.embedding.length > 0)
      .filter(m => !agentId || m.agentId === agentId);

    const scored: MemorySearchResult[] = candidates.map(m => ({
      ...m,
      similarity: this.cosineSimilarity(queryEmbedding, m.embedding!),
    }));

    scored.sort((a, b) => b.similarity - a.similarity);
    return scored.slice(0, topK);
  }

  /**
   * Keyword-based fallback search when embeddings are unavailable.
   */
  keywordSearch(queryText: string, topK: number = 5, agentId?: string): MemorySearchResult[] {
    const queryWords = queryText.toLowerCase().split(/\s+/).filter(w => w.length > 3);

    const candidates = Array.from(this.memories.values())
      .filter(m => !agentId || m.agentId === agentId);

    const scored: MemorySearchResult[] = candidates.map(m => {
      const contentLower = m.content.toLowerCase();
      const hits = queryWords.filter(w => contentLower.includes(w)).length;
      return {
        ...m,
        similarity: queryWords.length > 0 ? hits / queryWords.length : 0,
      };
    });

    scored.sort((a, b) => b.similarity - a.similarity);
    return scored.filter(s => s.similarity > 0).slice(0, topK);
  }

  /**
   * Structured query: filter by agentId, type, time range, etc.
   */
  query(query: MemoryQuery): MemoryEntry[] {
    let results = Array.from(this.memories.values());

    if (query.agentId) {
      results = results.filter(m => m.agentId === query.agentId);
    }
    if (query.type) {
      results = results.filter(m => m.type === query.type);
    }
    if (query.timeRange) {
      results = results.filter(
        m => m.timestamp >= query.timeRange!.start && m.timestamp <= query.timeRange!.end
      );
    }
    if (query.metadata) {
      results = results.filter(m => {
        if (!m.metadata) return false;
        return Object.entries(query.metadata!).every(
          ([key, value]) => m.metadata![key] === value
        );
      });
    }

    results.sort((a, b) => b.timestamp - a.timestamp);

    if (query.limit) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  // ─── Context Injection Helper ───────────────────────────────────

  /**
   * Build a context injection string from similar past memories.
   * Designed to be injected directly into agent task descriptions.
   */
  async getContextForTask(taskGoal: string, maxChars: number = 3000): Promise<string> {
    const similar = await this.searchSimilar(taskGoal, 3);
    if (similar.length === 0) return '';

    const parts = similar.map((m, i) => {
      const age = Math.round((Date.now() - m.timestamp) / (1000 * 60 * 60));
      return `[Memory #${i + 1} | ${m.type} | ${age}h ago | sim=${m.similarity.toFixed(2)}]\n${m.content.substring(0, 800)}`;
    });

    const context = `\n=== AGENT MEMORY RECALL ===\n${parts.join('\n---\n')}\n=== END MEMORY ===`;
    return context.substring(0, maxChars);
  }

  // ─── Stats ──────────────────────────────────────────────────────

  getStats(): { total: number; byType: Record<string, number>; byAgent: Record<string, number>; oldestMs: number; newestMs: number } {
    const byType: Record<string, number> = {};
    const byAgent: Record<string, number> = {};
    let oldest = Infinity;
    let newest = 0;

    for (const m of this.memories.values()) {
      byType[m.type] = (byType[m.type] || 0) + 1;
      byAgent[m.agentId] = (byAgent[m.agentId] || 0) + 1;
      if (m.timestamp < oldest) oldest = m.timestamp;
      if (m.timestamp > newest) newest = m.timestamp;
    }

    return {
      total: this.memories.size,
      byType,
      byAgent,
      oldestMs: oldest === Infinity ? 0 : oldest,
      newestMs: newest,
    };
  }

  // ─── Internals ──────────────────────────────────────────────────

  /**
   * Generate embedding via Ollama's /api/embed endpoint.
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    // Truncate to ~500 tokens worth of text for embedding
    const truncated = text.substring(0, 2000);

    const res = await fetch(`${this.config.ollamaEndpoint}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.embeddingModel,
        input: truncated,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      throw new Error(`Ollama embed ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    // Ollama returns { embeddings: [[...]] } for /api/embed
    const embedding = data.embeddings?.[0] || data.embedding;
    if (!embedding || !Array.isArray(embedding)) {
      throw new Error('Invalid embedding response from Ollama');
    }

    return embedding;
  }

  /**
   * Cosine similarity between two vectors.
   * Adapted from ruflo's AgentDBBackend.cosineSimilarity
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * Remove the oldest N entries (LRU eviction).
   */
  private evictOldest(count: number): void {
    const sorted = Array.from(this.memories.values())
      .sort((a, b) => a.timestamp - b.timestamp);

    for (let i = 0; i < count && i < sorted.length; i++) {
      this.memories.delete(sorted[i].id);
    }

    console.log(`[MemoryBridge] Evicted ${count} oldest memories. Size: ${this.memories.size}`);
  }

  /**
   * Schedule a debounced save to disk (10 second cooldown).
   */
  private scheduleSave(): void {
    this.dirty = true;
    if (this.saveTimer) return;

    this.saveTimer = setTimeout(async () => {
      this.saveTimer = null;
      await this.flush();
    }, 10_000);
  }

  /**
   * Flush all memories to disk as JSON.
   */
  async flush(): Promise<void> {
    if (!this.dirty) return;

    const entries = Array.from(this.memories.values());
    const filePath = this.getStorageFile();
    
    try {
      fs.writeFileSync(filePath, JSON.stringify(entries, null, 0)); // Compact JSON
      this.dirty = false;
      console.log(`[MemoryBridge] Flushed ${entries.length} memories to disk.`);
    } catch (err: any) {
      console.error(`[MemoryBridge] Failed to flush: ${err.message}`);
    }
  }

  private getStorageFile(): string {
    return path.join(this.config.storagePath, 'asclepius-memory.json');
  }
}
