// ═══════════════════════════════════════════════════════════════════
// BaseAgent — The Foundation Every Agent Extends
// ═══════════════════════════════════════════════════════════════════
// Provides: LLM calling, tool access, context gathering.
// Each specialized agent overrides: systemPrompt, gatherContext, execute.

import type { AgentConfig, ModelConfig, PipelineTask } from '../types/pipeline';
import { TerminalBridge } from '../tools/TerminalBridge';

// ─── Multi-Provider LLM Abstraction ─────────────────────────────────

export async function callLLM(model: ModelConfig, messages: { role: string; content: string }[]): Promise<string> {
  const { provider, endpoint, apiKey, modelId, temperature, maxTokens, systemPrompt } = model;

  const allMessages = systemPrompt
    ? [{ role: 'system', content: systemPrompt }, ...messages]
    : messages;

  switch (provider) {
    case 'google_gemini': {
      const res = await fetch(`${endpoint}/v1beta/models/${modelId}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: allMessages.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
          })),
          generationConfig: { temperature: temperature ?? 0.3, maxOutputTokens: maxTokens ?? 8192 },
        }),
      });
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '[No response from Gemini]';
    }

    case 'anthropic': {
      const sysMsg = allMessages.find(m => m.role === 'system')?.content;
      const nonSys = allMessages.filter(m => m.role !== 'system');
      const res = await fetch(endpoint || 'https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: modelId, max_tokens: maxTokens ?? 8192, temperature: temperature ?? 0.3,
          system: sysMsg,
          messages: nonSys.map(m => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      return data.content?.[0]?.text ?? '[No response from Claude]';
    }

    case 'openai': {
      const res = await fetch(endpoint || 'https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: modelId, temperature: temperature ?? 0.3, max_tokens: maxTokens ?? 8192, messages: allMessages,
        }),
      });
      const data = await res.json();
      return data.choices?.[0]?.message?.content ?? '[No response from OpenAI]';
    }

    case 'local_ollama': {
      const res = await fetch(endpoint || 'http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelId, messages: allMessages, stream: false,
          options: { temperature: temperature ?? 0.3 },
        }),
      });
      const data = await res.json();
      return data.message?.content ?? '[No response from Ollama]';
    }

    default: {
      // Custom endpoint — assume OpenAI-compatible shape
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: modelId, temperature: temperature ?? 0.3, max_tokens: maxTokens ?? 8192, messages: allMessages,
        }),
      });
      const data = await res.json();
      return data.choices?.[0]?.message?.content ?? data.content?.[0]?.text ?? '[No response]';
    }
  }
}

// ─── BaseAgent Class ────────────────────────────────────────────────

export abstract class BaseAgent {
  readonly config: AgentConfig;
  protected projectPath: string;
  protected branch: string;

  constructor(config: AgentConfig, projectPath: string, branch: string = 'main') {
    this.config = config;
    this.projectPath = projectPath;
    this.branch = branch;
  }

  /** The agent's identity prompt. Each specialization overrides this. */
  abstract get systemPrompt(): string;

  /** What file extensions this agent cares about when gathering context. */
  abstract get relevantExtensions(): string[];

  /**
   * Gather project context relevant to this agent's specialty.
   * Frontend agents read .tsx/.css, Backend agents read .ts/.py, etc.
   */
  async gatherContext(): Promise<string> {
    const tag = `[${this.config.name}]`;
    console.log(`${tag} Scanning workspace: ${this.projectPath}`);

    try {
      const files = await TerminalBridge.listDir(this.projectPath);
      const filtered = files.filter(f =>
        !f.name.startsWith('.') &&
        f.name !== 'node_modules' &&
        f.name !== 'dist' &&
        f.name !== '.git'
      );

      const tree = filtered.map(f => `${f.isDirectory ? '📁' : '📄'} ${f.name}`).join('\n');
      const parts: string[] = [`PROJECT STRUCTURE:\n${tree}`];

      // Read package.json for tech stack context
      if (files.find(f => f.name === 'package.json')) {
        const pkg = await TerminalBridge.readFile(`${this.projectPath}/package.json`);
        parts.push(`\npackage.json:\n${pkg}`);
      }

      // Subclass-specific: scan for relevant files in src/
      if (files.find(f => f.name === 'src' && f.isDirectory)) {
        const srcFiles = await TerminalBridge.listDir(`${this.projectPath}/src`);
        const relevant = srcFiles.filter(f => 
          this.relevantExtensions.some(ext => f.name.endsWith(ext)) || f.isDirectory
        );
        if (relevant.length > 0) {
          parts.push(`\nRelevant source files:\n${relevant.map(f => `  ${f.isDirectory ? '📁' : '📄'} ${f.name}`).join('\n')}`);
        }
      }

      // ── Load Project-Specific Skill (if exists) ──
      try {
        const asclepiusDir = files.find(f => f.name === '.asclepius' && f.isDirectory);
        if (asclepiusDir) {
          const skillFiles = await TerminalBridge.listDir(`${this.projectPath}/.asclepius/skills`);
          const mainSkill = skillFiles.find(f => f.name === 'SKILL.md' || f.name.endsWith('.skill.md'));
          if (mainSkill) {
            const content = await TerminalBridge.readFile(`${this.projectPath}/.asclepius/skills/${mainSkill.name}`);
            // Cap at 6000 chars to leave room for other context
            parts.push(`\nPROJECT KNOWLEDGE (${mainSkill.name}):\n${content.substring(0, 6000)}`);
            console.log(`${tag} Loaded project skill: ${mainSkill.name}`);
          }
        }
      } catch { /* no project skill yet — that's fine */ }

      // ── Load Agent's Knowledge Assets (Global Skills) ──
      if (this.config.knowledgeAssets?.length) {
        for (const assetPath of this.config.knowledgeAssets) {
          try {
            const content = await TerminalBridge.readFile(assetPath);
            const assetName = assetPath.split('/').pop() || assetPath;
            // Cap each asset to 4000 chars
            parts.push(`\nFRAMEWORK KNOWLEDGE (${assetName}):\n${content.substring(0, 4000)}`);
            console.log(`${tag} Loaded knowledge asset: ${assetName}`);
          } catch (err: any) {
            console.warn(`${tag} Failed to load asset ${assetPath}: ${err.message}`);
          }
        }
      }

      return parts.join('\n\n');
    } catch (err: any) {
      console.warn(`${tag} Context scan failed: ${err.message}`);
      return 'Unable to read project structure.';
    }
  }

  /**
   * Execute a task. Each specialized agent implements its own logic.
   * Returns the LLM's response text.
   */
  async execute(task: PipelineTask): Promise<string> {
    const context = await this.gatherContext();
    const model: ModelConfig = {
      ...this.config.model,
      systemPrompt: this.systemPrompt,
    };

    const prompt = this.buildPrompt(task, context);
    return await callLLM(model, [{ role: 'user', content: prompt }]);
  }

  /** Build the execution prompt. Agents can override for custom formatting. */
  protected buildPrompt(task: PipelineTask, context: string): string {
    return `You are ${this.config.name}, a ${this.config.role}.

TASK: ${task.goal}
${task.description ? `\nDETAILS: ${task.description}` : ''}
${task.targetFiles?.length ? `\nFOCUS FILES: ${task.targetFiles.join(', ')}` : ''}

PROJECT CONTEXT:
${context}

TARGET BRANCH: ${task.targetBranch || this.branch}

Complete this task. Provide the exact code changes needed.`;
  }

  /** Helper to call this agent's LLM with an arbitrary prompt. */
  async ask(prompt: string): Promise<string> {
    const model: ModelConfig = {
      ...this.config.model,
      systemPrompt: this.systemPrompt,
    };
    return await callLLM(model, [{ role: 'user', content: prompt }]);
  }
}
