// ═══════════════════════════════════════════════════════════════════
// ArchitectAgent — System Design & Planning Specialist
// ═══════════════════════════════════════════════════════════════════

import { BaseAgent } from './BaseAgent';
import type { PipelineTask } from '../types/pipeline';
import { TerminalBridge } from '../tools/TerminalBridge';

export class ArchitectAgent extends BaseAgent {
  get systemPrompt(): string {
    return `You are ${this.config.name}, a Principal Software Architect.

YOUR EXPERTISE:
- System design (monolith, microservices, serverless, edge)
- File/folder structure planning
- Technology selection & trade-off analysis
- API contract design (OpenAPI, gRPC, GraphQL schemas)
- Data modeling (ER diagrams, document schemas)
- Performance architecture (caching layers, CDN, load balancing)
- Security architecture (OWASP, zero-trust, least privilege)
- CI/CD pipeline design

YOUR RULES:
1. Think in systems, not individual files.
2. Every decision must have a documented trade-off rationale.
3. Prefer simplicity over cleverness.
4. Design for extensibility — don't over-engineer, but leave clear hooks.
5. Output structured plans (markdown, diagrams, file trees) not raw code.
6. When you DO produce code, it should be interfaces/types/contracts — not implementations.`;
  }

  get relevantExtensions(): string[] {
    return ['.ts', '.json', '.yaml', '.yml', '.md', '.toml'];
  }

  async gatherContext(): Promise<string> {
    const base = await super.gatherContext();
    const parts = [base];

    try {
      const rootFiles = await TerminalBridge.listDir(this.projectPath);

      // Read architecture docs if they exist
      const archDoc = rootFiles.find(f =>
        f.name.toLowerCase().includes('architecture') ||
        f.name.toLowerCase().includes('design') ||
        f.name === 'AGENTS.md'
      );
      if (archDoc) {
        const content = await TerminalBridge.readFile(`${this.projectPath}/${archDoc.name}`);
        parts.push(`\nARCHITECTURE DOCUMENT (${archDoc.name}):\n${content.substring(0, 4000)}`);
      }

      // Read tsconfig for project configuration
      const tsConfig = rootFiles.find(f => f.name === 'tsconfig.json');
      if (tsConfig) {
        const content = await TerminalBridge.readFile(`${this.projectPath}/${tsConfig.name}`);
        parts.push(`\ntsconfig.json:\n${content}`);
      }

      // Deep scan: list ALL directories to understand the project shape
      const allDirs = rootFiles.filter(f => f.isDirectory && !f.name.startsWith('.') && f.name !== 'node_modules');
      for (const dir of allDirs.slice(0, 5)) {
        try {
          const children = await TerminalBridge.listDir(`${this.projectPath}/${dir.name}`);
          parts.push(`\n📁 ${dir.name}/:\n${children.slice(0, 15).map(c => `  ${c.isDirectory ? '📁' : '📄'} ${c.name}`).join('\n')}`);
        } catch { /* skip unreadable dirs */ }
      }
    } catch {
      // Non-critical
    }

    return parts.join('\n\n');
  }

  protected buildPrompt(task: PipelineTask, context: string): string {
    return `ARCHITECTURAL TASK: ${task.goal}
${task.description ? `\nREQUIREMENTS: ${task.description}` : ''}

${context}

Produce an architectural plan. Include:
1. High-level approach
2. File structure changes
3. Interface/type definitions
4. Key trade-off decisions
5. Risks and mitigations`;
  }
}
