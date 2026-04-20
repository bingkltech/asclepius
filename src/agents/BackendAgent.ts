// ═══════════════════════════════════════════════════════════════════
// BackendAgent — API, Database, Server Logic Specialist
// ═══════════════════════════════════════════════════════════════════

import { BaseAgent } from './BaseAgent';
import type { PipelineTask } from '../types/pipeline';
import { TerminalBridge } from '../tools/TerminalBridge';

export class BackendAgent extends BaseAgent {
  get systemPrompt(): string {
    return `You are ${this.config.name}, a Senior Backend Engineer.

YOUR EXPERTISE:
- Node.js, Express, Fastify, Hono
- Python (Flask, FastAPI, Django)
- Database design (PostgreSQL, MongoDB, SQLite, DuckDB)
- REST API design, GraphQL, WebSockets
- Authentication & Authorization (JWT, OAuth 2.0, session-based)
- Caching strategies (Redis, in-memory)
- Queue systems, background jobs
- Input validation, error handling, logging

YOUR RULES:
1. Never modify frontend files (*.tsx, *.jsx, *.css, *.html).
2. Always validate and sanitize user input.
3. Use parameterized queries — never concatenate SQL strings.
4. Return consistent error response shapes.
5. Document all API endpoints with JSDoc or docstrings.
6. Output ONLY the code. No explanations unless asked.`;
  }

  get relevantExtensions(): string[] {
    return ['.ts', '.js', '.py', '.sql', '.prisma', '.graphql', '.json'];
  }

  async gatherContext(): Promise<string> {
    const base = await super.gatherContext();
    const parts = [base];

    try {
      const rootFiles = await TerminalBridge.listDir(this.projectPath);

      // Read database schema if exists
      const schemaFile = rootFiles.find(f =>
        f.name === 'schema.prisma' || f.name === 'schema.sql' || f.name === 'drizzle.config.ts'
      );
      if (schemaFile) {
        const content = await TerminalBridge.readFile(`${this.projectPath}/${schemaFile.name}`);
        parts.push(`\nDATABASE SCHEMA (${schemaFile.name}):\n${content.substring(0, 4000)}`);
      }

      // Read environment template for available services
      const envExample = rootFiles.find(f => f.name === '.env.example' || f.name === '.env.local');
      if (envExample) {
        const content = await TerminalBridge.readFile(`${this.projectPath}/${envExample.name}`);
        parts.push(`\nENVIRONMENT VARIABLES (${envExample.name}):\n${content.substring(0, 1000)}`);
      }

      // Look for API routes directory
      const srcFiles = await TerminalBridge.listDir(`${this.projectPath}/src`);
      const apiDir = srcFiles.find(f => f.isDirectory && (f.name === 'api' || f.name === 'routes' || f.name === 'server'));
      if (apiDir) {
        const apiFiles = await TerminalBridge.listDir(`${this.projectPath}/src/${apiDir.name}`);
        parts.push(`\nAPI ROUTES (${apiDir.name}/):\n${apiFiles.map(f => `  📄 ${f.name}`).join('\n')}`);
      }
    } catch {
      // Non-critical
    }

    return parts.join('\n\n');
  }

  protected buildPrompt(task: PipelineTask, context: string): string {
    return `TASK: ${task.goal}
${task.description ? `\nSPECIFICATION: ${task.description}` : ''}
${task.targetFiles?.length ? `\nFILES TO MODIFY: ${task.targetFiles.join(', ')}` : ''}

${context}

Produce clean, secure backend code. Follow RESTful conventions. Validate all inputs.`;
  }
}
