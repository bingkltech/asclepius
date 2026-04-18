/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Neural Vault — The God-Agent's Cognitive Knowledge Service
 * 
 * This service manages the three-tiered memory system:
 *   Layer 1: Working Memory (handled by chat context — not stored here)
 *   Layer 2: Episodic Memory (structured event records)
 *   Layer 3: Semantic Memory (distilled wisdom nodes)
 * 
 * Plus the Voyager-pattern Skill Scripts for autonomous re-application.
 * 
 * Storage: Dexie.js (IndexedDB wrapper) for persistence
 * Search: FlexSearch for full-text semantic retrieval
 * 
 * @see NEURAL_VAULT.md for architecture details
 */

import Dexie, { type EntityTable } from 'dexie';
import FlexSearch from 'flexsearch';
import type { KnowledgeNode, EpisodicEvent, SkillScript, NeuralVaultStats, KnowledgeCategory } from '@/src/types';

// ─── Database Schema ───

class NeuralVaultDB extends Dexie {
  knowledge!: EntityTable<KnowledgeNode, 'id'>;
  episodes!: EntityTable<EpisodicEvent, 'id'>;
  skillScripts!: EntityTable<SkillScript, 'id'>;

  constructor() {
    super('AsclepiusNeuralVault');

    this.version(1).stores({
      // Indexed fields for fast querying
      knowledge: 'id, topic, category, confidence, createdBy, createdAt, lastAccessedAt, accessCount, *tags',
      episodes: 'id, agentId, outcome, timestamp, knowledgeNodeId',
      skillScripts: 'id, name, successRate, timesUsed, createdBy, createdAt',
    });
  }
}

// ─── Singleton Instance ───
const db = new NeuralVaultDB();

// ─── FlexSearch Index (Rebuilt on load for semantic search) ───
const knowledgeIndex = new FlexSearch.Index({
  tokenize: 'forward',
  resolution: 9,
});

const skillIndex = new FlexSearch.Index({
  tokenize: 'forward',
  resolution: 9,
});

let indexBuilt = false;

/**
 * Rebuilds the FlexSearch in-memory index from the database.
 * Called once on app load and after major writes.
 */
async function rebuildSearchIndex(): Promise<void> {
  const allKnowledge = await db.knowledge.toArray();
  for (const node of allKnowledge) {
    knowledgeIndex.add(
      node.id as any,
      `${node.topic} ${node.content} ${node.tags.join(' ')}`
    );
  }

  const allScripts = await db.skillScripts.toArray();
  for (const script of allScripts) {
    skillIndex.add(
      script.id as any,
      `${script.name} ${script.description} ${script.triggerPattern}`
    );
  }

  indexBuilt = true;
  console.log(`[NeuralVault] Search index built: ${allKnowledge.length} knowledge nodes, ${allScripts.length} skill scripts`);
}

// ─── WRITE PATH ───

/**
 * T5: Adds a new Wisdom Node to the Semantic Memory (Layer 3).
 * 
 * Called when:
 *   - God-Agent outputs a LEARN_WISDOM action
 *   - Auto-learn triggers after solving an error
 *   - User manually contributes knowledge
 */
export async function addKnowledge(
  topic: string,
  content: string,
  tags: string[],
  category: KnowledgeCategory,
  createdBy: string,
  connections: string[] = [],
): Promise<KnowledgeNode> {
  const node: KnowledgeNode = {
    id: `kn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    topic,
    content,
    tags: tags.map(t => t.toLowerCase()),
    category,
    confidence: 0.8, // New knowledge starts at 80% confidence
    connections,
    createdBy,
    createdAt: new Date().toISOString(),
    lastAccessedAt: new Date().toISOString(),
    accessCount: 0,
    validated: false,
  };

  await db.knowledge.add(node);

  // Update search index
  knowledgeIndex.add(
    node.id as any,
    `${node.topic} ${node.content} ${node.tags.join(' ')}`
  );

  console.log(`[NeuralVault] Learned: "${topic}" by ${createdBy}`);
  return node;
}

/**
 * T6: Records an action and its outcome in Episodic Memory (Layer 2).
 * 
 * Called after every Sequential Orchestrator turn completes.
 * This is the "training data" for pattern recognition.
 */
export async function recordEpisode(
  agentId: string,
  action: string,
  context: string,
  outcome: EpisodicEvent['outcome'],
  lessonsLearned: string,
  knowledgeNodeId?: string,
): Promise<EpisodicEvent> {
  const episode: EpisodicEvent = {
    id: `ep-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    agentId,
    action,
    context,
    outcome,
    lessonsLearned,
    knowledgeNodeId,
    timestamp: new Date().toISOString(),
  };

  await db.episodes.add(episode);
  return episode;
}

/**
 * T7: Saves a reusable solution template (Voyager Pattern).
 * 
 * When the God-Agent solves a problem, it can generate a SkillScript
 * that can be automatically re-applied when a similar problem is detected.
 */
export async function saveSkillScript(
  name: string,
  description: string,
  triggerPattern: string,
  script: string,
  createdBy: string,
): Promise<SkillScript> {
  const skillScript: SkillScript = {
    id: `ss-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    description,
    triggerPattern,
    script,
    successRate: 100, // Starts at 100%, decreases on failures
    timesUsed: 0,
    createdBy,
    createdAt: new Date().toISOString(),
  };

  await db.skillScripts.add(skillScript);

  // Update search index
  skillIndex.add(
    skillScript.id as any,
    `${skillScript.name} ${skillScript.description} ${skillScript.triggerPattern}`
  );

  console.log(`[NeuralVault] Skill Script saved: "${name}"`);
  return skillScript;
}

// ─── READ PATH ───

/**
 * T9: Full-text search across the Knowledge Library.
 * 
 * Uses FlexSearch for semantic-ish matching. Returns nodes sorted
 * by relevance score × confidence.
 */
export async function searchKnowledge(query: string, limit: number = 5): Promise<KnowledgeNode[]> {
  if (!indexBuilt) await rebuildSearchIndex();

  const resultIds = knowledgeIndex.search(query, limit * 2); // Over-fetch for confidence filtering
  if (resultIds.length === 0) return [];

  const nodes = await db.knowledge
    .where('id')
    .anyOf(resultIds.map(String))
    .toArray();

  // Sort by confidence (highest first) and take top N
  return nodes
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, limit);
}

/**
 * T10: Context-aware retrieval — the "Weapon" function.
 * 
 * Given a task description or error message, this function:
 * 1. Searches for relevant Knowledge Nodes
 * 2. Searches for matching Skill Scripts
 * 3. Returns a formatted context block ready for LLM injection
 * 
 * This is called by the Sequential Orchestrator before each agent turn.
 */
export async function getRelevantWisdom(
  taskContext: string,
  maxNodes: number = 3,
): Promise<{ wisdomBlock: string; nodes: KnowledgeNode[]; scripts: SkillScript[] }> {
  if (!indexBuilt) await rebuildSearchIndex();

  // Search knowledge
  const knowledgeIds = knowledgeIndex.search(taskContext, maxNodes * 2);
  let nodes: KnowledgeNode[] = [];
  if (knowledgeIds.length > 0) {
    nodes = await db.knowledge
      .where('id')
      .anyOf(knowledgeIds.map(String))
      .toArray();
    nodes = nodes
      .filter(n => n.confidence >= 0.3) // Only use knowledge above 30% confidence
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, maxNodes);

    // Update access stats for retrieved nodes
    for (const node of nodes) {
      await db.knowledge.update(node.id, {
        lastAccessedAt: new Date().toISOString(),
        accessCount: node.accessCount + 1,
      });
    }
  }

  // Search skill scripts
  const scriptIds = skillIndex.search(taskContext, 2);
  let scripts: SkillScript[] = [];
  if (scriptIds.length > 0) {
    scripts = await db.skillScripts
      .where('id')
      .anyOf(scriptIds.map(String))
      .toArray();
    scripts = scripts.filter(s => s.successRate >= 50); // Only use scripts with >50% success
  }

  // Build the wisdom injection block
  let wisdomBlock = '';
  if (nodes.length > 0 || scripts.length > 0) {
    wisdomBlock = '\n\n--- NEURAL VAULT: RELEVANT WISDOM ---\n';

    if (nodes.length > 0) {
      wisdomBlock += '\n📚 KNOWLEDGE NODES:\n';
      for (const node of nodes) {
        wisdomBlock += `\n[${node.category.toUpperCase()}] "${node.topic}" (Confidence: ${Math.round(node.confidence * 100)}%)\n`;
        wisdomBlock += `${node.content}\n`;
        wisdomBlock += `Tags: ${node.tags.join(', ')} | Used ${node.accessCount} times\n`;
      }
    }

    if (scripts.length > 0) {
      wisdomBlock += '\n🔧 APPLICABLE SKILL SCRIPTS:\n';
      for (const script of scripts) {
        wisdomBlock += `\n"${script.name}" — ${script.description}\n`;
        wisdomBlock += `Success Rate: ${script.successRate}% | Used ${script.timesUsed} times\n`;
        wisdomBlock += `Solution:\n${script.script}\n`;
      }
    }

    wisdomBlock += '\n--- END NEURAL VAULT ---\n';
  }

  return { wisdomBlock, nodes, scripts };
}

/**
 * Finds a matching SkillScript for a given error/task context.
 * Used by the auto-heal system to find pre-built solutions.
 */
export async function findSkillScript(context: string): Promise<SkillScript | null> {
  if (!indexBuilt) await rebuildSearchIndex();

  const resultIds = skillIndex.search(context, 1);
  if (resultIds.length === 0) return null;

  const script = await db.skillScripts.get(String(resultIds[0]));
  if (script && script.successRate >= 50) {
    // Record usage
    await db.skillScripts.update(script.id, {
      timesUsed: script.timesUsed + 1,
      lastUsedAt: new Date().toISOString(),
    });
    return script;
  }
  return null;
}

/**
 * Updates a SkillScript's success rate after use.
 */
export async function updateSkillScriptOutcome(
  scriptId: string,
  succeeded: boolean,
): Promise<void> {
  const script = await db.skillScripts.get(scriptId);
  if (!script) return;

  const totalAttempts = script.timesUsed;
  const currentSuccesses = Math.round((script.successRate / 100) * (totalAttempts - 1));
  const newSuccesses = succeeded ? currentSuccesses + 1 : currentSuccesses;
  const newRate = Math.round((newSuccesses / totalAttempts) * 100);

  await db.skillScripts.update(scriptId, { successRate: newRate });
}

// ─── CURATION PATH ───

/**
 * T17: Confidence decay — Old unvalidated knowledge loses trust.
 * 
 * Called periodically (e.g., daily). Knowledge that hasn't been accessed
 * or validated decays slowly, keeping the library "fresh."
 */
export async function applyConfidenceDecay(
  decayRate: number = 0.02, // 2% per cycle
  minConfidence: number = 0.1,
): Promise<number> {
  const allNodes = await db.knowledge.toArray();
  let decayedCount = 0;

  for (const node of allNodes) {
    if (!node.validated && node.confidence > minConfidence) {
      const daysSinceAccess = (Date.now() - new Date(node.lastAccessedAt).getTime()) / (1000 * 60 * 60 * 24);
      
      // Only decay if not accessed in the last 7 days
      if (daysSinceAccess > 7) {
        const newConfidence = Math.max(minConfidence, node.confidence - decayRate);
        await db.knowledge.update(node.id, { confidence: newConfidence });
        decayedCount++;
      }
    }
  }

  if (decayedCount > 0) {
    console.log(`[NeuralVault] Confidence decay applied to ${decayedCount} nodes`);
  }
  return decayedCount;
}

/**
 * Validates a knowledge node (marks it as confirmed correct).
 * Validated nodes are immune to confidence decay.
 */
export async function validateKnowledge(nodeId: string): Promise<void> {
  await db.knowledge.update(nodeId, {
    validated: true,
    confidence: Math.min(1.0, (await db.knowledge.get(nodeId))?.confidence ?? 0.8 + 0.1),
  });
}

/**
 * Creates a connection between two knowledge nodes.
 * This builds the "neural graph" of related concepts.
 */
export async function connectKnowledge(nodeIdA: string, nodeIdB: string): Promise<void> {
  const nodeA = await db.knowledge.get(nodeIdA);
  const nodeB = await db.knowledge.get(nodeIdB);
  if (!nodeA || !nodeB) return;

  if (!nodeA.connections.includes(nodeIdB)) {
    await db.knowledge.update(nodeIdA, { connections: [...nodeA.connections, nodeIdB] });
  }
  if (!nodeB.connections.includes(nodeIdA)) {
    await db.knowledge.update(nodeIdB, { connections: [...nodeB.connections, nodeIdA] });
  }
}

// ─── STATS & DASHBOARD ───

/**
 * T15: Returns aggregated stats for the Dashboard display.
 */
export async function getVaultStats(): Promise<NeuralVaultStats> {
  const allKnowledge = await db.knowledge.toArray();
  const totalEpisodes = await db.episodes.count();
  const totalSkillScripts = await db.skillScripts.count();

  const avgConfidence = allKnowledge.length > 0
    ? allKnowledge.reduce((sum, n) => sum + n.confidence, 0) / allKnowledge.length
    : 0;

  // Top categories
  const categoryCounts: Record<string, number> = {};
  for (const node of allKnowledge) {
    categoryCounts[node.category] = (categoryCounts[node.category] || 0) + 1;
  }
  const topCategories = Object.entries(categoryCounts)
    .map(([category, count]) => ({ category: category as KnowledgeCategory, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Most accessed topic
  const sortedByAccess = [...allKnowledge].sort((a, b) => b.accessCount - a.accessCount);
  const mostAccessedTopic = sortedByAccess.length > 0 ? sortedByAccess[0].topic : null;

  // Last learned
  const sortedByCreation = [...allKnowledge].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const lastLearnedAt = sortedByCreation.length > 0 ? sortedByCreation[0].createdAt : null;

  return {
    totalKnowledge: allKnowledge.length,
    totalEpisodes,
    totalSkillScripts,
    avgConfidence: Math.round(avgConfidence * 100),
    topCategories,
    lastLearnedAt,
    mostAccessedTopic,
  };
}

/**
 * Returns all knowledge nodes for the Chronicle UI.
 */
export async function getAllKnowledge(): Promise<KnowledgeNode[]> {
  return db.knowledge.orderBy('createdAt').reverse().toArray();
}

/**
 * Returns all episodes for a specific agent.
 */
export async function getAgentEpisodes(agentId: string, limit: number = 20): Promise<EpisodicEvent[]> {
  return db.episodes
    .where('agentId')
    .equals(agentId)
    .reverse()
    .sortBy('timestamp')
    .then(episodes => episodes.slice(0, limit));
}

/**
 * Returns all skill scripts.
 */
export async function getAllSkillScripts(): Promise<SkillScript[]> {
  return db.skillScripts.orderBy('createdAt').reverse().toArray();
}

/**
 * Deletes a knowledge node (for curation).
 */
export async function deleteKnowledge(nodeId: string): Promise<void> {
  await db.knowledge.delete(nodeId);
  // Remove from connections of other nodes
  const allNodes = await db.knowledge.toArray();
  for (const node of allNodes) {
    if (node.connections.includes(nodeId)) {
      await db.knowledge.update(node.id, {
        connections: node.connections.filter(id => id !== nodeId),
      });
    }
  }
}

// ─── INITIALIZATION ───

/**
 * Initialize the Neural Vault. Called once on app startup.
 * Rebuilds the search index from persisted IndexedDB data.
 */
export async function initializeNeuralVault(): Promise<NeuralVaultStats> {
  try {
    await rebuildSearchIndex();
    const stats = await getVaultStats();
    console.log(`[NeuralVault] Initialized. ${stats.totalKnowledge} knowledge nodes, ${stats.totalEpisodes} episodes, ${stats.totalSkillScripts} scripts.`);
    return stats;
  } catch (error) {
    console.error('[NeuralVault] Initialization failed:', error);
    return {
      totalKnowledge: 0,
      totalEpisodes: 0,
      totalSkillScripts: 0,
      avgConfidence: 0,
      topCategories: [],
      lastLearnedAt: null,
      mostAccessedTopic: null,
    };
  }
}
