// ═══════════════════════════════════════════════════════════════════
// QAAgent — Quality Assurance, Testing & Code Review Specialist
// ═══════════════════════════════════════════════════════════════════

import { BaseAgent } from './BaseAgent';
import type { PipelineTask } from '../types/pipeline';
import { TerminalBridge } from '../tools/TerminalBridge';

export class QAAgent extends BaseAgent {
  get systemPrompt(): string {
    return `You are ${this.config.name}, a Senior QA Engineer and Code Reviewer.

YOUR EXPERTISE:
- Unit testing (Jest, Vitest, Pytest, Mocha)
- Integration testing, E2E testing (Playwright, Cypress)
- Code review (style, correctness, security, performance)
- Bug detection (race conditions, memory leaks, edge cases)
- Test coverage analysis
- Regression testing strategies
- Accessibility auditing

YOUR RULES:
1. You DO NOT write application code. You write tests and review reports.
2. Every bug report must include: location, expected behavior, actual behavior, severity.
3. Tests must cover: happy path, error path, edge cases, boundary values.
4. Code reviews must check: correctness, security, performance, readability.
5. Severity levels: CRITICAL (data loss/security), HIGH (broken feature), MEDIUM (degraded UX), LOW (cosmetic).
6. Output structured reports in markdown format.`;
  }

  get relevantExtensions(): string[] {
    return ['.ts', '.tsx', '.js', '.jsx', '.py', '.test.ts', '.spec.ts', '.test.tsx'];
  }

  async gatherContext(): Promise<string> {
    const base = await super.gatherContext();
    const parts = [base];

    try {
      // Look for existing test files
      const srcFiles = await TerminalBridge.listDir(`${this.projectPath}/src`);
      const testDir = srcFiles.find(f => f.isDirectory && 
        (f.name === '__tests__' || f.name === 'tests' || f.name === 'test')
      );
      if (testDir) {
        const testFiles = await TerminalBridge.listDir(`${this.projectPath}/src/${testDir.name}`);
        parts.push(`\nEXISTING TESTS (${testDir.name}/):\n${testFiles.map(f => `  📄 ${f.name}`).join('\n')}`);
      }

      // Read test config (jest.config, vitest.config, etc.)
      const rootFiles = await TerminalBridge.listDir(this.projectPath);
      const testConfig = rootFiles.find(f =>
        f.name.includes('jest.config') || f.name.includes('vitest.config') ||
        f.name === 'pytest.ini' || f.name === 'setup.cfg'
      );
      if (testConfig) {
        const content = await TerminalBridge.readFile(`${this.projectPath}/${testConfig.name}`);
        parts.push(`\nTEST CONFIG (${testConfig.name}):\n${content.substring(0, 1500)}`);
      }
    } catch {
      // Non-critical
    }

    return parts.join('\n\n');
  }

  /**
   * QA execute is different: it reads the target files and produces
   * a review report or test file — NOT application code.
   */
  protected buildPrompt(task: PipelineTask, context: string): string {
    return `QA TASK: ${task.goal}
${task.description ? `\nSCOPE: ${task.description}` : ''}
${task.targetFiles?.length ? `\nFILES TO REVIEW: ${task.targetFiles.join(', ')}` : ''}

${context}

Produce one of the following based on the task:
A) A CODE REVIEW REPORT with findings categorized by severity (CRITICAL/HIGH/MEDIUM/LOW)
B) A TEST FILE with unit tests covering happy path, error path, and edge cases
C) A BUG REPORT listing all issues found

Use markdown formatting for reports. Use proper test framework syntax for test files.`;
  }
}
