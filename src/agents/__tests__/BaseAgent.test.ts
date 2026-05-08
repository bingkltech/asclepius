// ═══════════════════════════════════════════════════════════════════
// BaseAgent.enforceTokenBudget — Unit Tests
// ═══════════════════════════════════════════════════════════════════
// Tests the token budget enforcement method.
// We instantiate a minimal concrete subclass since BaseAgent is abstract.
// No LLM calls, no mocks, no network — pure string logic.
//
// Run: npm test
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { BaseAgent } from '../BaseAgent';
import type { PipelineTask } from '../../types/pipeline';

// ─── Minimal concrete subclass ───────────────────────────────────────
// BaseAgent is abstract — we need a concrete class to test protected methods.
// This is the standard pattern for testing abstract classes in TypeScript.
class TestAgent extends BaseAgent {
  get systemPrompt(): string { return 'Test agent system prompt.'; }
  get relevantExtensions(): string[] { return ['.ts']; }

  // Expose protected method for testing
  public testEnforceTokenBudget(content: string, budget: number, label?: string): string {
    return this.enforceTokenBudget(content, budget, label);
  }
}

// ─── Minimal AgentConfig ─────────────────────────────────────────────
const mockConfig = {
  id: 'test-agent',
  name: 'TestAgent',
  role: 'Dev Expert' as const,
  skills: ['fullstack' as const],
  status: 'idle' as const,
  isLeadAgent: false,
  model: {
    provider: 'local_ollama' as const,
    modelId: 'llama3',
    temperature: 0.3,
    maxTokens: 8192,
  },
};

const agent = new TestAgent(mockConfig as any, 'F:/test-project', 'main');

// ─── Test Suite ──────────────────────────────────────────────────────

describe('BaseAgent.enforceTokenBudget', () => {

  // ── Pass-through (no truncation needed) ──────────────────────────

  it('returns content unchanged when it fits within budget', () => {
    const content = 'Hello world';
    expect(agent.testEnforceTokenBudget(content, 1000)).toBe(content);
  });

  it('returns content unchanged when it is exactly the budget length', () => {
    const content = 'A'.repeat(1000);
    expect(agent.testEnforceTokenBudget(content, 1000)).toBe(content);
  });

  it('returns content unchanged for empty string', () => {
    expect(agent.testEnforceTokenBudget('', 1000)).toBe('');
  });

  // ── Truncation behavior ───────────────────────────────────────────

  it('truncates content that exceeds budget', () => {
    const content = 'A'.repeat(10000);
    const result = agent.testEnforceTokenBudget(content, 500);
    expect(result.length).toBeLessThan(content.length);
  });

  it('truncated result fits within roughly the budget size', () => {
    const content = 'X'.repeat(50000);
    const budget = 5000;
    const result = agent.testEnforceTokenBudget(content, budget);
    // Allow 10% overage for the banner text
    expect(result.length).toBeLessThanOrEqual(budget * 1.1);
  });

  it('includes the TRUNCATED banner when truncation occurs', () => {
    const content = 'A'.repeat(10000);
    const result = agent.testEnforceTokenBudget(content, 500, 'PROJECT CONTEXT');
    expect(result).toContain('TRUNCATED');
    expect(result).toContain('PROJECT CONTEXT');
  });

  it('includes estimated token count in the truncation banner', () => {
    const content = 'B'.repeat(10000);
    const result = agent.testEnforceTokenBudget(content, 1000);
    // Should mention token estimate
    expect(result).toMatch(/\d+.*token/i);
  });

  // ── Head + Tail strategy ──────────────────────────────────────────

  it('preserves the start (head) of the content', () => {
    const head = 'START_MARKER: important file tree here';
    const middle = 'M'.repeat(50000);
    const tail = 'END: recent task output';
    const content = head + middle + tail;

    const result = agent.testEnforceTokenBudget(content, 2000);
    expect(result).toContain('START_MARKER');
  });

  it('preserves the end (tail) of the content', () => {
    const head = 'START: file tree';
    const middle = 'M'.repeat(50000);
    const tail = 'END_MARKER: most recent handoff report here';
    const content = head + middle + tail;

    const result = agent.testEnforceTokenBudget(content, 2000);
    expect(result).toContain('END_MARKER');
  });

  it('drops the middle when truncated (head+tail strategy)', () => {
    // Build content where the PURE MIDDLE section is far enough from both ends
    // that it must fall in the dropped zone when budget = 500.
    // Budget 500 → usable ≈ 300 → head ≈ 210 chars, tail ≈ 90 chars.
    // We put a unique marker 10,000 chars into a 50,000 char middle. 
    // That marker is well beyond the head window (210 chars) and far from tail.
    const head = 'HEAD_CONTENT'; // 12 chars
    const markerPosition = 10_000; // put the marker 10k into the middle
    const middlePrefix = 'M'.repeat(markerPosition);
    const dropMarker = 'THIS_UNIQUE_MARKER_MUST_BE_DROPPED'; // unique, won't appear in head or tail
    const middleSuffix = 'M'.repeat(40_000 - dropMarker.length);
    const tail = 'TAIL_CONTENT';
    const content = head + middlePrefix + dropMarker + middleSuffix + tail;

    const result = agent.testEnforceTokenBudget(content, 500);

    // Head and tail should be present
    expect(result).toContain('HEAD_CONTENT');
    expect(result).toContain('TAIL_CONTENT');
    // The deep-middle unique marker must be gone
    expect(result).not.toContain('THIS_UNIQUE_MARKER_MUST_BE_DROPPED');
  });

  // ── Custom label ──────────────────────────────────────────────────

  it('uses default label CONTENT when no label provided', () => {
    const content = 'Z'.repeat(5000);
    const result = agent.testEnforceTokenBudget(content, 500);
    expect(result).toContain('CONTENT TRUNCATED');
  });

  it('uses the provided custom label in the banner', () => {
    const content = 'Z'.repeat(5000);
    const result = agent.testEnforceTokenBudget(content, 500, 'DEPENDENCY HANDOFF');
    expect(result).toContain('DEPENDENCY HANDOFF TRUNCATED');
  });

  // ── Edge: tiny budget ─────────────────────────────────────────────

  it('handles a budget of zero gracefully', () => {
    const content = 'anything';
    // Should not throw — should return some fallback message
    expect(() => agent.testEnforceTokenBudget(content, 0)).not.toThrow();
    const result = agent.testEnforceTokenBudget(content, 0);
    expect(result).toContain('TRUNCATED');
  });

  it('handles a budget of 1 gracefully', () => {
    const content = 'some content that is too long';
    expect(() => agent.testEnforceTokenBudget(content, 1)).not.toThrow();
  });
});
