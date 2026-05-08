/**
 * GraphKnowledge.ts — The Knowledge Graph Bridge
 *
 * Wraps Graphify's knowledge graph capabilities for Asclepius agents.
 * This tool doesn't re-implement Graphify — it orchestrates the
 * Python CLI via child_process to build, query, and traverse the
 * codebase knowledge graph.
 *
 * Key capabilities:
 *   - Build knowledge graphs from any project directory
 *   - Query the graph with natural language questions
 *   - Find shortest paths between concepts
 *   - Identify "god nodes" (most-connected abstractions)
 *   - Read the GRAPH_REPORT.md for pre-analyzed insights
 *
 * Constitutional compliance:
 *   - TOOL only (not a Brain or Hand)
 *   - Code extraction is local (tree-sitter AST, no API)
 *   - Semantic extraction can use local Ollama
 *   - Dashboard stays stateless
 *
 * @module GraphKnowledge
 */

import { execSync, exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// ─── Types ───────────────────────────────────────────────────────

export interface GraphNode {
  id: string;
  label: string;
  sourceFile?: string;
  sourceLocation?: string;
  community?: number;
  degree?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  relation: string;
  confidence: 'EXTRACTED' | 'INFERRED' | 'AMBIGUOUS';
}

export interface GraphStats {
  nodes: number;
  edges: number;
  communities: number;
  extracted: number;
  inferred: number;
  ambiguous: number;
}

export interface GraphQueryResult {
  question: string;
  traversal: string;
  nodesFound: number;
  content: string;
}

export interface GraphBuildResult {
  success: boolean;
  outputDir: string;
  graphJsonPath: string;
  reportPath: string;
  htmlPath: string;
  stats?: GraphStats;
  error?: string;
}

export interface GodNode {
  rank: number;
  label: string;
  degree: number;
}

export interface SurprisingConnection {
  source: string;
  target: string;
  confidence: string;
  relation: string;
  why: string;
}

// ─── Configuration ───────────────────────────────────────────────

const GRAPHIFY_VENDOR_PATH = 'F:\\012B_Paperclip_DemoWorks\\tools\\graphify-vendor';
const DEFAULT_OUTPUT_DIR = 'graphify-out';

// ─── Core Class ──────────────────────────────────────────────────

export class GraphKnowledge {
  private graphifyAvailable = false;
  private pythonCmd = 'python';

  constructor() {}

  // ─── Initialization ──────────────────────────────────────────

  /**
   * Check if Graphify is available and usable.
   */
  async initialize(): Promise<boolean> {
    console.log('🕸️ [GraphKnowledge] Checking Graphify availability...');

    // Check Python availability
    try {
      execSync(`${this.pythonCmd} --version`, { stdio: 'pipe' });
    } catch {
      try {
        this.pythonCmd = 'python3';
        execSync(`${this.pythonCmd} --version`, { stdio: 'pipe' });
      } catch {
        console.warn('🕸️ [GraphKnowledge] Python not found. Graph features disabled.');
        return false;
      }
    }

    // Check if graphify is installed or available from vendor
    try {
      execSync(`${this.pythonCmd} -c "import graphify"`, {
        stdio: 'pipe',
        env: { ...process.env, PYTHONPATH: GRAPHIFY_VENDOR_PATH },
      });
      this.graphifyAvailable = true;
      console.log('🕸️ [GraphKnowledge] Graphify ready (vendor import).');
    } catch {
      // Try pip-installed version
      try {
        execSync(`${this.pythonCmd} -c "import graphify"`, { stdio: 'pipe' });
        this.graphifyAvailable = true;
        console.log('🕸️ [GraphKnowledge] Graphify ready (pip-installed).');
      } catch {
        console.warn('🕸️ [GraphKnowledge] Graphify not importable. Install with: pip install graphifyy');
        // Still mark as available for CLI commands
        try {
          execSync('graphify --help', { stdio: 'pipe' });
          this.graphifyAvailable = true;
          console.log('🕸️ [GraphKnowledge] Graphify CLI available.');
        } catch {
          console.warn('🕸️ [GraphKnowledge] Graphify CLI not found. Graph features disabled.');
          return false;
        }
      }
    }

    return this.graphifyAvailable;
  }

  // ─── Graph Building ──────────────────────────────────────────

  /**
   * Build a knowledge graph for a project directory.
   * Uses tree-sitter for AST extraction (no API calls for code).
   *
   * @param projectDir - Directory to analyze
   * @param options - Build options
   */
  async buildGraph(
    projectDir: string,
    options: {
      update?: boolean;        // Only re-extract changed files
      noViz?: boolean;        // Skip HTML generation
      mode?: 'normal' | 'deep'; // Deep = more aggressive relationship extraction
      ollamaBackend?: boolean; // Use local Ollama for semantic extraction
    } = {}
  ): Promise<GraphBuildResult> {
    if (!this.graphifyAvailable) {
      return {
        success: false,
        outputDir: '',
        graphJsonPath: '',
        reportPath: '',
        htmlPath: '',
        error: 'Graphify not available',
      };
    }

    const outputDir = path.join(projectDir, DEFAULT_OUTPUT_DIR);
    const graphJsonPath = path.join(outputDir, 'graph.json');
    const reportPath = path.join(outputDir, 'GRAPH_REPORT.md');
    const htmlPath = path.join(outputDir, 'graph.html');

    // Build the graphify extract command
    let cmd = `${this.pythonCmd} -m graphify extract "${projectDir}"`;
    if (options.ollamaBackend) {
      cmd += ' --backend ollama';
    }
    if (options.mode === 'deep') {
      cmd += ' --mode deep';
    }
    if (options.noViz) {
      cmd += ' --no-viz';
    }
    if (options.update) {
      cmd += ' --update';
    }

    console.log(`🕸️ [GraphKnowledge] Building graph for ${projectDir}...`);

    try {
      execSync(cmd, {
        cwd: projectDir,
        stdio: 'pipe',
        timeout: 300000, // 5 min timeout
        env: { ...process.env, PYTHONPATH: GRAPHIFY_VENDOR_PATH },
      });

      // Read stats from graph.json
      let stats: GraphStats | undefined;
      if (fs.existsSync(graphJsonPath)) {
        stats = this.readGraphStats(graphJsonPath);
      }

      console.log(`🕸️ [GraphKnowledge] Graph built: ${stats?.nodes || '?'} nodes, ${stats?.edges || '?'} edges`);

      return {
        success: true,
        outputDir,
        graphJsonPath,
        reportPath,
        htmlPath,
        stats,
      };
    } catch (err: any) {
      console.error(`🕸️ [GraphKnowledge] Build failed: ${err.message}`);
      return {
        success: false,
        outputDir,
        graphJsonPath,
        reportPath,
        htmlPath,
        error: err.message,
      };
    }
  }

  // ─── Graph Querying ──────────────────────────────────────────

  /**
   * Query the knowledge graph with a natural language question.
   * Uses BFS/DFS traversal from matching seed nodes.
   *
   * @param graphPath - Path to graph.json
   * @param question - Natural language query
   * @param options - Query options
   */
  queryGraph(
    graphPath: string,
    question: string,
    options: {
      mode?: 'bfs' | 'dfs';
      depth?: number;
      tokenBudget?: number;
    } = {}
  ): GraphQueryResult | null {
    if (!fs.existsSync(graphPath)) {
      console.warn(`🕸️ [GraphKnowledge] Graph not found: ${graphPath}`);
      return null;
    }

    const mode = options.mode || 'bfs';
    const depth = options.depth || 3;
    const budget = options.tokenBudget || 2000;

    try {
      const script = `
import json, sys
sys.path.insert(0, ${JSON.stringify(GRAPHIFY_VENDOR_PATH)})
from graphify.serve import _load_graph, _query_graph_text
G = _load_graph(${JSON.stringify(graphPath)})
result = _query_graph_text(G, ${JSON.stringify(question)}, mode=${JSON.stringify(mode)}, depth=${depth}, token_budget=${budget})
print(result)
`;
      const result = execSync(`${this.pythonCmd} -c "${script.replace(/"/g, '\\"').replace(/\n/g, ';')}"`, {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 30000,
      }).toString().trim();

      // Parse the header line for metadata
      const lines = result.split('\n');
      const headerMatch = lines[0]?.match(/(\d+) nodes found/);
      const nodesFound = headerMatch ? parseInt(headerMatch[1]) : 0;

      return {
        question,
        traversal: `${mode.toUpperCase()} depth=${depth}`,
        nodesFound,
        content: result,
      };
    } catch (err: any) {
      console.error(`🕸️ [GraphKnowledge] Query failed: ${err.message}`);
      return null;
    }
  }

  // ─── Report Reading ──────────────────────────────────────────

  /**
   * Read the pre-generated GRAPH_REPORT.md for a project.
   * This is the cheapest way to get insights — no query needed.
   */
  readReport(projectDir: string): string | null {
    const reportPath = path.join(projectDir, DEFAULT_OUTPUT_DIR, 'GRAPH_REPORT.md');
    if (!fs.existsSync(reportPath)) {
      return null;
    }
    return fs.readFileSync(reportPath, 'utf-8');
  }

  /**
   * Read the graph.json and extract god nodes, stats, and surprising connections.
   */
  readGraphInsights(graphJsonPath: string): {
    stats: GraphStats;
    godNodes: GodNode[];
    surprises: SurprisingConnection[];
  } | null {
    if (!fs.existsSync(graphJsonPath)) return null;

    try {
      const data = JSON.parse(fs.readFileSync(graphJsonPath, 'utf-8'));
      const nodes = data.nodes || [];
      const edges = data.links || data.edges || [];

      // Stats
      const confidences = edges.map((e: any) => e.confidence || 'EXTRACTED');
      const stats: GraphStats = {
        nodes: nodes.length,
        edges: edges.length,
        communities: new Set(nodes.map((n: any) => n.community).filter((c: any) => c != null)).size,
        extracted: confidences.filter((c: string) => c === 'EXTRACTED').length,
        inferred: confidences.filter((c: string) => c === 'INFERRED').length,
        ambiguous: confidences.filter((c: string) => c === 'AMBIGUOUS').length,
      };

      // God nodes — top 10 by degree
      const degreeMap = new Map<string, number>();
      for (const edge of edges) {
        degreeMap.set(edge.source, (degreeMap.get(edge.source) || 0) + 1);
        degreeMap.set(edge.target, (degreeMap.get(edge.target) || 0) + 1);
      }
      const nodeMap = new Map(nodes.map((n: any) => [n.id, n]));
      const godNodes: GodNode[] = Array.from(degreeMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([id, degree], i) => ({
          rank: i + 1,
          label: (nodeMap.get(id) as any)?.label || id,
          degree,
        }));

      // Surprising connections — cross-community AMBIGUOUS/INFERRED edges
      const nodeCommunity = new Map(nodes.map((n: any) => [n.id, n.community]));
      const surprises: SurprisingConnection[] = edges
        .filter((e: any) => {
          const cA = nodeCommunity.get(e.source);
          const cB = nodeCommunity.get(e.target);
          return cA != null && cB != null && cA !== cB &&
                 (e.confidence === 'AMBIGUOUS' || e.confidence === 'INFERRED');
        })
        .slice(0, 5)
        .map((e: any) => ({
          source: (nodeMap.get(e.source) as any)?.label || e.source,
          target: (nodeMap.get(e.target) as any)?.label || e.target,
          confidence: e.confidence || 'UNKNOWN',
          relation: e.relation || '',
          why: `Bridges community ${nodeCommunity.get(e.source)} → ${nodeCommunity.get(e.target)}`,
        }));

      return { stats, godNodes, surprises };
    } catch (err: any) {
      console.error(`🕸️ [GraphKnowledge] Failed to read graph: ${err.message}`);
      return null;
    }
  }

  // ─── Context Injection ───────────────────────────────────────

  /**
   * Generate context from the knowledge graph for a task.
   * Combines report insights + query results into injectable text.
   */
  getContextForTask(projectDir: string, taskGoal: string): string | null {
    const graphPath = path.join(projectDir, DEFAULT_OUTPUT_DIR, 'graph.json');

    // Try to read pre-built insights
    const insights = this.readGraphInsights(graphPath);
    if (!insights) return null;

    const lines: string[] = [
      '🕸️ [Knowledge Graph] Codebase intelligence:',
      `  Graph: ${insights.stats.nodes} nodes, ${insights.stats.edges} edges, ${insights.stats.communities} communities`,
      '  God nodes (most-connected):',
      ...insights.godNodes.slice(0, 5).map(n => `    ${n.rank}. ${n.label} (${n.degree} connections)`),
    ];

    if (insights.surprises.length > 0) {
      lines.push('  Surprising connections:');
      for (const s of insights.surprises.slice(0, 3)) {
        lines.push(`    ⚡ ${s.source} ↔ ${s.target} [${s.confidence}] — ${s.why}`);
      }
    }

    return lines.join('\n');
  }

  // ─── Utilities ───────────────────────────────────────────────

  /**
   * Check if a project has a pre-built graph.
   */
  hasGraph(projectDir: string): boolean {
    return fs.existsSync(path.join(projectDir, DEFAULT_OUTPUT_DIR, 'graph.json'));
  }

  /**
   * Get the graph.json path for a project.
   */
  getGraphPath(projectDir: string): string {
    return path.join(projectDir, DEFAULT_OUTPUT_DIR, 'graph.json');
  }

  // ─── Private ─────────────────────────────────────────────────

  private readGraphStats(graphJsonPath: string): GraphStats | undefined {
    try {
      const data = JSON.parse(fs.readFileSync(graphJsonPath, 'utf-8'));
      const nodes = data.nodes || [];
      const edges = data.links || data.edges || [];
      const confidences = edges.map((e: any) => e.confidence || 'EXTRACTED');
      return {
        nodes: nodes.length,
        edges: edges.length,
        communities: new Set(nodes.map((n: any) => n.community).filter((c: any) => c != null)).size,
        extracted: confidences.filter((c: string) => c === 'EXTRACTED').length,
        inferred: confidences.filter((c: string) => c === 'INFERRED').length,
        ambiguous: confidences.filter((c: string) => c === 'AMBIGUOUS').length,
      };
    } catch {
      return undefined;
    }
  }
}
