/**
 * CommonSenseGate.ts — The Central Driver
 *
 * THE single authority that stands between intent and execution.
 * Everything flows through this gate. It does NOT duplicate logic
 * from other tools — it CONSUMES them as dependencies.
 *
 * Responsibilities:
 *   1. JUDGE: Should this goal/task/duty execute? (5 rules)
 *   2. ENRICH: Gather all relevant context in one pass (memory, APIs, graph)
 *   3. TRACK: Record outcomes to prevent future duplication
 *
 * What this is NOT:
 *   - NOT a separate memory store (uses MemoryBridge)
 *   - NOT a separate search engine (uses APIDiscovery)
 *   - NOT a separate graph reader (uses GraphKnowledge)
 *   - NOT a parallel module — it is THE gate
 *
 * @module CommonSenseGate
 */

import * as fs from 'fs';
import * as path from 'path';

// Import dependencies — CommonSenseGate consumes, never reimplements
import type { MemoryBridge } from './MemoryBridge';
import type { APIDiscovery } from './APIDiscovery';
import type { GraphKnowledge } from './GraphKnowledge';

// ─── Types ───────────────────────────────────────────────────────

export type GateVerdict = 'ALLOW' | 'SKIP' | 'REJECT' | 'CAUTION';

export interface GateResult {
  verdict: GateVerdict;
  rule: string;
  reason: string;
}

export interface GateEvaluation {
  finalVerdict: GateVerdict;
  results: GateResult[];
  /** Pre-gathered context string to inject into the task. Null if nothing relevant. */
  enrichedContext: string | null;
}

export interface GateContext {
  type: 'goal' | 'task' | 'duty';
  projectPath?: string;
  targetFiles?: string[];
  agentSkills?: string[];
}

// ─── Configuration ───────────────────────────────────────────────

const STALENESS_WINDOW_MS = 5 * 60 * 1000;  // 5 minutes
const MAX_VERBS_PER_GOAL = 2;
const HIGH_RISK_IMPORT_THRESHOLD = 5;

const COMPOUND_MARKERS = [
  ' AND ', ' ALSO ', ' ADDITIONALLY ', ' FURTHERMORE ',
  ' PLUS ', ' AS WELL AS ', ' MOREOVER ',
  ' and also ', ' and then ', ' and additionally ',
];

const SCOPE_VIOLATION_PATTERNS = [
  /redesign.*AND.*fix/i,
  /fix.*AND.*redesign/i,
  /search.*AND.*create/i,
  /execute.*internal duties/i,
  /do everything/i,
  /fix all/i,
  /improve everything/i,
];

// ─── Core Class ──────────────────────────────────────────────────

export class CommonSenseGate {
  /**
   * Execution fingerprints: goalHash → last success timestamp.
   * This is the ONLY local state. File-level staleness is checked
   * against the real filesystem, and memory dedup delegates to MemoryBridge.
   */
  private executionLog: Map<string, number> = new Map();

  // Dependencies — injected, never reimplemented
  private memory: MemoryBridge | null = null;
  private apiDiscovery: APIDiscovery | null = null;
  private graphKnowledge: GraphKnowledge | null = null;

  constructor() {}

  /**
   * Wire in the tools this gate consumes.
   * Called once at boot. Any tool can be null (graceful degradation).
   */
  wire(deps: {
    memory?: MemoryBridge;
    apiDiscovery?: APIDiscovery;
    graphKnowledge?: GraphKnowledge;
  }): void {
    if (deps.memory) this.memory = deps.memory;
    if (deps.apiDiscovery) this.apiDiscovery = deps.apiDiscovery;
    if (deps.graphKnowledge) this.graphKnowledge = deps.graphKnowledge;
  }

  // ─── The Single Entry Point ──────────────────────────────────

  /**
   * JUDGE + ENRICH in one call.
   *
   * Returns a verdict (ALLOW/SKIP/REJECT/CAUTION) AND the pre-gathered
   * context string. The orchestrator does NOT need to call MemoryBridge,
   * APIDiscovery, or GraphKnowledge separately — this gate does it all.
   */
  async evaluate(text: string, context: GateContext = { type: 'goal' }): Promise<GateEvaluation> {
    const results: GateResult[] = [];

    // ── JUDGE ──────────────────────────────────────────────────

    // Rule 1: Staleness — don't redo unchanged work
    results.push(this.checkStaleness(text, context));

    // Rule 2: Scope Sanity — reject compound/vague goals
    results.push(this.checkScopeSanity(text, context));

    // Rule 3: Capability Match — flag skill mismatches
    results.push(this.checkCapabilityMatch(text, context));

    // Rule 4: Risk Assessment — warn on high-impact files
    results.push(this.checkRiskAssessment(context));

    // Rule 5: Memory Dedup — delegate to MemoryBridge (no local reimplementation)
    results.push(await this.checkMemoryDedup(text));

    // Compute verdict
    const hasReject = results.some(r => r.verdict === 'REJECT');
    const hasSkip = results.some(r => r.verdict === 'SKIP');
    const hasCaution = results.some(r => r.verdict === 'CAUTION');

    let finalVerdict: GateVerdict = 'ALLOW';
    if (hasReject) finalVerdict = 'REJECT';
    else if (hasSkip) finalVerdict = 'SKIP';
    else if (hasCaution) finalVerdict = 'CAUTION';

    // ── ENRICH (only if we're proceeding) ──────────────────────

    let enrichedContext: string | null = null;

    if (finalVerdict !== 'REJECT' && finalVerdict !== 'SKIP') {
      enrichedContext = await this.gatherContext(text, context);
    }

    return { finalVerdict, results, enrichedContext };
  }

  // ─── Success Recording ───────────────────────────────────────

  /**
   * Record a successful execution. Delegates to MemoryBridge if wired.
   * Updates local staleness log.
   */
  async recordSuccess(agentId: string, goalText: string, result: string): Promise<void> {
    // Local staleness tracking (lightweight — just a timestamp)
    this.executionLog.set(this.hashGoal(goalText), Date.now());

    // Delegate persistence to MemoryBridge (the one true memory)
    if (this.memory) {
      try {
        await this.memory.storeTaskResult(agentId, goalText, result, 'completed');
      } catch { /* MemoryBridge handles its own errors */ }
    }
  }

  // ─── JUDGMENT RULES ──────────────────────────────────────────

  private checkStaleness(text: string, context: GateContext): GateResult {
    const lastExec = this.executionLog.get(this.hashGoal(text));
    if (!lastExec) {
      return { verdict: 'ALLOW', rule: 'Staleness', reason: 'First execution.' };
    }

    const elapsed = Date.now() - lastExec;
    if (elapsed < STALENESS_WINDOW_MS) {
      // Check if target files actually changed
      if (context.targetFiles && context.projectPath) {
        const anyChanged = context.targetFiles.some(f => {
          try {
            const fullPath = path.join(context.projectPath!, f);
            return fs.existsSync(fullPath) && fs.statSync(fullPath).mtimeMs > lastExec;
          } catch { return true; } // If we can't check, assume changed
        });
        if (!anyChanged) {
          return {
            verdict: 'SKIP',
            rule: 'Staleness',
            reason: `Completed ${Math.round(elapsed / 1000)}s ago — target files unchanged.`,
          };
        }
      } else {
        // No target files specified — use pure time-based check
        return {
          verdict: 'SKIP',
          rule: 'Staleness',
          reason: `Completed ${Math.round(elapsed / 1000)}s ago — too soon to re-execute.`,
        };
      }
    }

    return { verdict: 'ALLOW', rule: 'Staleness', reason: 'Sufficient time elapsed or files changed.' };
  }

  private checkScopeSanity(text: string, context: GateContext): GateResult {
    if (context.type !== 'goal') {
      return { verdict: 'ALLOW', rule: 'Scope', reason: 'Tasks and duties are pre-decomposed.' };
    }

    const upperText = text.toUpperCase();
    const foundMarkers = COMPOUND_MARKERS.filter(m => upperText.includes(m.toUpperCase()));

    if (foundMarkers.length >= MAX_VERBS_PER_GOAL) {
      return {
        verdict: 'REJECT',
        rule: 'Scope',
        reason: `${foundMarkers.length + 1} independent objectives found. One goal, one outcome.`,
      };
    }

    for (const pattern of SCOPE_VIOLATION_PATTERNS) {
      if (pattern.test(text)) {
        return {
          verdict: 'REJECT',
          rule: 'Scope',
          reason: 'Matches a known violation pattern — too vague or compound.',
        };
      }
    }

    const verbs = text.match(/\b(fix|create|build|write|add|remove|delete|update|redesign|refactor|search|scan|deploy|test|review|analyze)\b/gi);
    if (verbs && verbs.length > 3) {
      return {
        verdict: 'CAUTION',
        rule: 'Scope',
        reason: `${verbs.length} action verbs detected (${verbs.slice(0, 4).join(', ')}…). May be too broad.`,
      };
    }

    return { verdict: 'ALLOW', rule: 'Scope', reason: 'Focused and actionable.' };
  }

  private checkCapabilityMatch(text: string, context: GateContext): GateResult {
    if (!context.agentSkills || context.agentSkills.length === 0) {
      return { verdict: 'ALLOW', rule: 'Capability', reason: 'No skill constraints.' };
    }

    const textLower = text.toLowerCase();
    const requirements: Array<{ keywords: string[]; skill: string }> = [
      { keywords: ['rust', 'cargo', '.rs'], skill: 'rust' },
      { keywords: ['python', 'pip', '.py'], skill: 'python' },
      { keywords: ['react', 'tsx', 'jsx', 'component'], skill: 'frontend' },
      { keywords: ['docker', 'kubernetes', 'k8s'], skill: 'devops' },
      { keywords: ['database', 'sql', 'postgres'], skill: 'data_engineering' },
      { keywords: ['security', 'vulnerability', 'cve'], skill: 'security' },
      { keywords: ['test', 'vitest', 'jest', 'spec'], skill: 'qa_testing' },
    ];

    const missing = requirements
      .filter(r => r.keywords.some(kw => textLower.includes(kw)))
      .filter(r => !context.agentSkills!.some(s => s.toLowerCase().includes(r.skill)))
      .map(r => r.skill);

    if (missing.length > 0) {
      return {
        verdict: 'CAUTION',
        rule: 'Capability',
        reason: `Requires ${missing.join(', ')} — not in available agent skills.`,
      };
    }

    return { verdict: 'ALLOW', rule: 'Capability', reason: 'Skills match.' };
  }

  private checkRiskAssessment(context: GateContext): GateResult {
    if (!context.targetFiles || !context.projectPath) {
      return { verdict: 'ALLOW', rule: 'Risk', reason: 'No target files to assess.' };
    }

    const coreFiles = ['index.ts', 'App.tsx', 'main.tsx', 'package.json', 'tsconfig.json', 'goal-orchestrator.ts'];
    const riskyTargets = context.targetFiles.filter(f => coreFiles.some(c => f.includes(c)));

    if (riskyTargets.length > 0) {
      return {
        verdict: 'CAUTION',
        rule: 'Risk',
        reason: `Core files targeted: ${riskyTargets.join(', ')}. Verify with tsc after modification.`,
      };
    }

    return { verdict: 'ALLOW', rule: 'Risk', reason: 'Low-risk targets.' };
  }

  private async checkMemoryDedup(text: string): Promise<GateResult> {
    if (!this.memory) {
      return { verdict: 'ALLOW', rule: 'Dedup', reason: 'No memory wired.' };
    }

    // Delegate similarity search to MemoryBridge — the one true memory.
    // No local reimplementation of text similarity or embedding search.
    try {
      const similar = await this.memory.getContextForTask(text);
      if (similar && similar.includes('completed') && similar.includes('SUCCESS')) {
        return {
          verdict: 'SKIP',
          rule: 'Dedup',
          reason: 'MemoryBridge found a recent successful match for this goal.',
        };
      }
    } catch { /* Memory unavailable — proceed */ }

    return { verdict: 'ALLOW', rule: 'Dedup', reason: 'No duplicates in memory.' };
  }

  // ─── CONTEXT GATHERING (one pass, no duplication) ────────────

  /**
   * Gather ALL relevant context from ALL wired tools in a single pass.
   * The orchestrator calls this ONCE — not three separate try/catch blocks.
   */
  private async gatherContext(text: string, context: GateContext): Promise<string | null> {
    const parts: string[] = [];

    // 1. Memory context (via MemoryBridge — not reimplemented here)
    if (this.memory) {
      try {
        const memCtx = await this.memory.getContextForTask(text);
        if (memCtx) parts.push(memCtx);
      } catch { /* graceful */ }
    }

    // 2. API suggestions (via APIDiscovery — not reimplemented here)
    if (this.apiDiscovery) {
      try {
        const apiCtx = this.apiDiscovery.getContextForTask(text);
        if (apiCtx) parts.push(apiCtx);
      } catch { /* graceful */ }
    }

    // 3. Graph intelligence (via GraphKnowledge — not reimplemented here)
    if (this.graphKnowledge && context.projectPath) {
      try {
        const graphCtx = this.graphKnowledge.getContextForTask(context.projectPath, text);
        if (graphCtx) parts.push(graphCtx);
      } catch { /* graceful */ }
    }

    return parts.length > 0 ? parts.join('\n') : null;
  }

  // ─── Formatting ──────────────────────────────────────────────

  static formatEvaluation(eval_: GateEvaluation): string {
    const icon = { 'ALLOW': '✅', 'SKIP': '⏭️', 'REJECT': '🚫', 'CAUTION': '⚠️' }[eval_.finalVerdict];
    const passed = eval_.results.filter(r => r.verdict === 'ALLOW').length;
    const lines = [`${icon} [CommonSense] ${eval_.finalVerdict} (${passed}/${eval_.results.length} passed)`];

    for (const r of eval_.results) {
      if (r.verdict !== 'ALLOW') {
        lines.push(`  ${r.rule}: ${r.verdict} — ${r.reason}`);
      }
    }
    if (eval_.enrichedContext) {
      lines.push(`  📎 Context gathered: ${eval_.enrichedContext.length} chars from ${eval_.enrichedContext.split('\n').filter(l => l.startsWith('🧠') || l.startsWith('🔌') || l.startsWith('🕸️')).length || '?'} sources`);
    }

    return lines.join('\n');
  }

  // ─── Private ─────────────────────────────────────────────────

  private hashGoal(text: string): string {
    let hash = 0;
    const norm = text.toLowerCase().replace(/\[project:\s*[^\]]+\]/gi, '').replace(/[^a-z0-9]/g, '');
    for (let i = 0; i < norm.length; i++) {
      hash = ((hash << 5) - hash) + norm.charCodeAt(i);
      hash = hash & hash;
    }
    return `g${Math.abs(hash).toString(36)}`;
  }
}
