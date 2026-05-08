// ═══════════════════════════════════════════════════════════════════
// LeadAgent.validateDAG — Unit Tests
// ═══════════════════════════════════════════════════════════════════
// Tests the Kahn's algorithm cycle detection. Pure static function —
// no LLM calls, no mocks required. All tests are synchronous.
//
// Run: npm test
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { LeadAgent } from '../LeadAgent';
import type { PipelineTask } from '../../types/pipeline';

// ─── Minimal task factory ────────────────────────────────────────────
// Constructs a PipelineTask with only the fields validateDAG uses.
function makeTask(id: string, goal: string, dependencies: string[]): PipelineTask {
  return {
    id,
    goal,
    dependencies,
    assignedAgentId: null,
    requiredSkills: [],
    status: 'pending',
    priority: 'medium',
    targetBranch: 'main',
    logs: [],
    createdAt: Date.now(),
    revisionCount: 0,
  };
}

// ─── Test Suite ──────────────────────────────────────────────────────

describe('LeadAgent.validateDAG', () => {

  // ── Valid DAGs (should return null) ──────────────────────────────

  it('returns null for an empty task list', () => {
    expect(LeadAgent.validateDAG([])).toBeNull();
  });

  it('returns null for a single task with no dependencies', () => {
    const tasks = [makeTask('t1', 'Bootstrap project', [])];
    expect(LeadAgent.validateDAG(tasks)).toBeNull();
  });

  it('returns null for a valid linear chain: A → B → C', () => {
    const tasks = [
      makeTask('t1', 'Create DB schema', []),
      makeTask('t2', 'Build API endpoints', ['t1']),
      makeTask('t3', 'Build UI components', ['t2']),
    ];
    expect(LeadAgent.validateDAG(tasks)).toBeNull();
  });

  it('returns null for parallel tasks with no dependencies', () => {
    const tasks = [
      makeTask('t1', 'Create DB schema', []),
      makeTask('t2', 'Set up CI/CD', []),
      makeTask('t3', 'Write README', []),
    ];
    expect(LeadAgent.validateDAG(tasks)).toBeNull();
  });

  it('returns null for a valid diamond DAG: A → B, A → C, B → D, C → D', () => {
    // Classic diamond — two parallel paths merging at D
    const tasks = [
      makeTask('t1', 'Foundation', []),
      makeTask('t2', 'Branch left', ['t1']),
      makeTask('t3', 'Branch right', ['t1']),
      makeTask('t4', 'Merge & deploy', ['t2', 't3']),
    ];
    expect(LeadAgent.validateDAG(tasks)).toBeNull();
  });

  it('returns null for a fan-out: one task feeds many', () => {
    const tasks = [
      makeTask('t1', 'Initialize repo', []),
      makeTask('t2', 'Backend work', ['t1']),
      makeTask('t3', 'Frontend work', ['t1']),
      makeTask('t4', 'DevOps work', ['t1']),
    ];
    expect(LeadAgent.validateDAG(tasks)).toBeNull();
  });

  // ── Cycle Detection (should return a non-null error string) ──────

  it('detects a direct 2-node cycle: A → B → A', () => {
    const tasks = [
      makeTask('t1', 'Build auth API', ['t2']),  // t1 depends on t2
      makeTask('t2', 'Build login UI', ['t1']),  // t2 depends on t1 — CYCLE
    ];
    const result = LeadAgent.validateDAG(tasks);
    expect(result).not.toBeNull();
    expect(result).toContain('Circular dependency');
  });

  it('detects a self-loop: A → A', () => {
    const tasks = [
      makeTask('t1', 'Refactor everything', ['t1']),  // self-referential — CYCLE
    ];
    const result = LeadAgent.validateDAG(tasks);
    expect(result).not.toBeNull();
    expect(result).toContain('Circular dependency');
  });

  it('detects a 3-node cycle: A → B → C → A', () => {
    const tasks = [
      makeTask('t1', 'Task A', ['t3']),  // A depends on C
      makeTask('t2', 'Task B', ['t1']),  // B depends on A
      makeTask('t3', 'Task C', ['t2']),  // C depends on B — CYCLE: A→B→C→A
    ];
    const result = LeadAgent.validateDAG(tasks);
    expect(result).not.toBeNull();
    expect(result).toContain('Circular dependency');
    expect(result).toContain('3'); // All 3 nodes are in the cycle
  });

  it('detects a cycle embedded in an otherwise valid DAG', () => {
    // t1 → t2 is fine, but t3 ⟺ t4 is a cycle
    const tasks = [
      makeTask('t1', 'Setup environment', []),
      makeTask('t2', 'Build core module', ['t1']),
      makeTask('t3', 'Build plugin A', ['t4']),   // cycle start
      makeTask('t4', 'Build plugin B', ['t3']),   // cycle end
    ];
    const result = LeadAgent.validateDAG(tasks);
    expect(result).not.toBeNull();
    expect(result).toContain('Circular dependency');
  });

  // ── Ghost Reference Detection ─────────────────────────────────────

  it('detects a dependency referencing a non-existent task ID', () => {
    const tasks = [
      makeTask('t1', 'Deploy to production', ['t_does_not_exist']),
    ];
    const result = LeadAgent.validateDAG(tasks);
    expect(result).not.toBeNull();
    // Should name the missing ID in the error
    expect(result).toContain('t_does_not_exist');
  });

  it('detects a ghost ref even when other deps are valid', () => {
    const tasks = [
      makeTask('t1', 'Foundation', []),
      makeTask('t2', 'Build feature', ['t1', 'ghost_id']),  // one valid, one ghost
    ];
    const result = LeadAgent.validateDAG(tasks);
    expect(result).not.toBeNull();
    expect(result).toContain('ghost_id');
  });

  // ── Error Message Quality ─────────────────────────────────────────

  it('error message includes the goal name of cycled tasks', () => {
    const tasks = [
      makeTask('t1', 'Build auth API', ['t2']),
      makeTask('t2', 'Build login UI', ['t1']),
    ];
    const result = LeadAgent.validateDAG(tasks);
    // The error should name the tasks so engineers can debug the LLM hallucination
    expect(result).toMatch(/Build auth API|Build login UI/);
  });
});
