// ═══════════════════════════════════════════════════════════════════
// FrontendAgent — React, CSS, UI/UX Specialist
// ═══════════════════════════════════════════════════════════════════

import { BaseAgent } from './BaseAgent';
import type { PipelineTask } from '../types/pipeline';
import { TerminalBridge } from '../tools/TerminalBridge';

export class FrontendAgent extends BaseAgent {
  get systemPrompt(): string {
    return `You are ${this.config.name}, a Senior Frontend Engineer and UI/UX specialist.

YOUR EXPERTISE:
- React 19, Next.js 15, TypeScript
- Modern CSS (TailwindCSS, CSS Modules, animations, transitions)
- Accessibility (WCAG 2.1 AA compliance)
- Responsive design (mobile-first)
- Component architecture (atomic design, composition patterns)
- State management (React hooks, Zustand, Context)
- Performance optimization (lazy loading, memoization, virtual lists)

YOUR RULES:
1. Never modify backend files (*.py, server.ts, routes, database schemas).
2. Every component must be accessible (aria labels, keyboard navigation).
3. Use semantic HTML elements.
4. Prefer composition over inheritance in React components.
5. All colors should support dark mode.
6. Output ONLY the code. No explanations unless asked.`;
  }

  get relevantExtensions(): string[] {
    return ['.tsx', '.jsx', '.css', '.scss', '.html', '.svg'];
  }

  /**
   * Frontend-specific context: reads component files, stylesheets,
   * and the design system if one exists.
   */
  async gatherContext(): Promise<string> {
    const base = await super.gatherContext();
    const parts = [base];

    try {
      // Look for design tokens / theme files
      const srcFiles = await TerminalBridge.listDir(`${this.projectPath}/src`);
      
      const themeFile = srcFiles.find(f => 
        f.name.includes('theme') || f.name.includes('design') || 
        f.name === 'index.css' || f.name === 'globals.css'
      );
      if (themeFile && !themeFile.isDirectory) {
        const content = await TerminalBridge.readFile(`${this.projectPath}/src/${themeFile.name}`);
        parts.push(`\nDESIGN SYSTEM (${themeFile.name}):\n${content.substring(0, 3000)}`);
      }

      // Read tailwind config if exists
      const rootFiles = await TerminalBridge.listDir(this.projectPath);
      const twConfig = rootFiles.find(f => f.name.startsWith('tailwind.config'));
      if (twConfig) {
        const content = await TerminalBridge.readFile(`${this.projectPath}/${twConfig.name}`);
        parts.push(`\nTailwind Config:\n${content.substring(0, 2000)}`);
      }
    } catch {
      // Non-critical, continue with base context
    }

    return parts.join('\n\n');
  }

  protected buildPrompt(task: PipelineTask, context: string): string {
    return `TASK: ${task.goal}
${task.description ? `\nSPECIFICATION: ${task.description}` : ''}
${task.targetFiles?.length ? `\nFILES TO MODIFY: ${task.targetFiles.join(', ')}` : ''}

${context}

Produce clean, accessible React/TypeScript code. Use the existing design system if one is detected.`;
  }
}
