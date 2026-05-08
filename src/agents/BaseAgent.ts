// ═══════════════════════════════════════════════════════════════════
// BaseAgent — The Foundation Every Agent Extends
// ═══════════════════════════════════════════════════════════════════
// Provides: LLM calling, tool access, context gathering.
// Each specialized agent overrides: systemPrompt, gatherContext, execute.

import type { AgentConfig, ModelConfig, PipelineTask } from '../types/pipeline';
import { TerminalBridge } from '../tools/TerminalBridge';
import { OllamaManager } from '../tools/OllamaManager';
import { ResourceGovernor } from '../tools/ResourceGovernor';
import { CommonSenseGate } from '../tools/CommonSenseGate';

// ─── Multi-Provider LLM Abstraction ─────────────────────────────────

export async function callLLM(model: ModelConfig, messages: { role: string; content: string }[], allowFallback: boolean = true): Promise<string> {
  if (!allowFallback) {
    return await _callLLMDirect(model, messages);
  }

  const chain = model.fallbackChain ? [model.provider, ...model.fallbackChain.filter(p => p !== model.provider)] : [model.provider, 'local_ollama' as any];
  let lastError: Error | null = null;

  for (const provider of chain) {
    try {
      // Reconstruct model config for the fallback
      const fallbackModel: ModelConfig = { ...model, provider: provider as any };
      
      // Setup sensible defaults for Ollama if not explicitly provided
      if (provider === 'local_ollama' && !model.endpoint?.includes('localhost')) {
        fallbackModel.endpoint = 'http://localhost:11434/api/chat';
        fallbackModel.modelId = await OllamaManager.selectBestModel('http://localhost:11434', fallbackModel.complexity);
      }

      if (provider !== model.provider) {
         console.warn(`[callLLM] Primary failed. Cascading to "${provider}"...`);
      }
      
      const result = await _callLLMDirect(fallbackModel, messages);
      return result;
    } catch (err: any) {
      console.warn(`[callLLM] Provider "${provider}" failed: ${err.message}`);
      lastError = err;
    }
  }

  throw new Error(`All providers in fallback chain failed. Last error: ${lastError?.message}`);
}

// ─── Multi-Provider Tool Calling Abstraction ────────────────────────

export async function callLLMWithTools(model: ModelConfig, messages: any[], tools: any[], allowFallback: boolean = true): Promise<any> {
  if (!allowFallback) {
    return await _callLLMWithToolsDirect(model, messages, tools);
  }

  const chain = model.fallbackChain ? [model.provider, ...model.fallbackChain.filter(p => p !== model.provider)] : [model.provider, 'local_ollama' as any];
  let lastError: Error | null = null;

  for (const provider of chain) {
    try {
      const fallbackModel: ModelConfig = { ...model, provider: provider as any };
      
      if (provider === 'local_ollama' && !model.endpoint?.includes('localhost')) {
        fallbackModel.endpoint = 'http://localhost:11434/v1/chat/completions';
        fallbackModel.modelId = await OllamaManager.selectBestModel('http://localhost:11434', fallbackModel.complexity);
      }

      if (provider !== model.provider) {
         console.warn(`[callLLMWithTools] Primary failed. Cascading to "${provider}"...`);
      }
      
      return await _callLLMWithToolsDirect(fallbackModel, messages, tools);
    } catch (err: any) {
      console.warn(`[callLLMWithTools] Provider "${provider}" failed: ${err.message}`);
      lastError = err;
    }
  }

  throw new Error(`All tool providers in fallback chain failed. Last error: ${lastError?.message}`);
}

async function _callLLMWithToolsDirect(model: ModelConfig, messages: any[], tools: any[]): Promise<any> {
  const { provider, endpoint, apiKey, modelId, temperature, maxTokens, systemPrompt } = model;

  const allMessages = systemPrompt
    ? [{ role: 'system', content: systemPrompt }, ...messages]
    : messages;

  let targetUrl: string;
  let headers: Record<string, string> = {};
  let payload: any;

  // We primarily support OpenAI-compatible tool schemas
  targetUrl = endpoint || 'http://localhost:11434/v1/chat/completions';
  if (provider === 'openai' || provider === 'local_ollama' || provider === 'cloud_ollama' || provider === 'custom' || provider === 'google_jules') {
    if (provider === 'openai') {
      targetUrl = endpoint || 'https://api.openai.com/v1/chat/completions';
    } else if (provider === 'local_ollama') {
      targetUrl = endpoint ? endpoint.replace('/api/chat', '/v1/chat/completions') : 'http://localhost:11434/v1/chat/completions';
    } else if (provider === 'cloud_ollama') {
      targetUrl = endpoint || 'http://cloud-ollama-node:11434/v1/chat/completions';
    }
    
    headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
    payload = { 
      model: modelId, 
      temperature: temperature ?? 0.3, 
      max_tokens: maxTokens ?? 8192, 
      messages: allMessages,
      tools: tools
    };
    if (provider === 'local_ollama' || provider === 'cloud_ollama') {
      // Adaptive context: shrinks under CPU/GPU pressure to prevent freezes
      const governor = ResourceGovernor.getInstance();
      const ctxSize = governor.getAdaptiveContextSize();
      payload.options = { num_ctx: ctxSize };
      console.log(`[callLLMWithTools] Adaptive Ollama context: ${ctxSize} tokens`);
    }
  } else {
     throw new Error(`[callLLMWithTools] Provider ${provider} tool-calling logic not implemented.`);
  }

  console.log(`[_callLLMWithToolsDirect] ${provider} → ${targetUrl} with ${tools.length} tools`);
  const isNode = typeof window === 'undefined';
  // Adaptive timeout: shrinks under system pressure to release GPU faster
  const governorTools = ResourceGovernor.getInstance();
  const toolsTimeoutMs = governorTools.getAdaptiveLLMTimeout();
  const signal = AbortSignal.timeout(toolsTimeoutMs);
  console.log(`[callLLMWithTools] Adaptive timeout: ${Math.round(toolsTimeoutMs / 1000)}s`);
  
  const res = await OllamaManager.enqueue(async () => {
    if (isNode) {
      return fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(payload),
        signal
      });
    } else {
      return fetch('/api/llm-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUrl, headers, payload }),
        signal
      });
    }
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Proxy ${res.status}: ${errText}`);
  }

  const data = await res.json();
  if (data.error) {
    throw new Error(typeof data.error === 'string' ? data.error : data.error.message || JSON.stringify(data.error));
  }

  return data.choices?.[0]?.message ?? {};
}

/** Direct LLM call to a single provider — no retry logic */
async function _callLLMDirect(model: ModelConfig, messages: { role: string; content: string }[]): Promise<string> {
  const { provider, endpoint, apiKey, modelId, temperature, maxTokens, systemPrompt } = model;

  const allMessages = systemPrompt
    ? [{ role: 'system', content: systemPrompt }, ...messages]
    : messages;

  let targetUrl: string;
  let headers: Record<string, string> = {};
  let payload: any;

  switch (provider) {
    case 'google_gemini': {
      targetUrl = `${endpoint}/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
      payload = {
        contents: allMessages.map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
        generationConfig: { temperature: temperature ?? 0.3, maxOutputTokens: maxTokens ?? 8192 },
      };
      break;
    }
    case 'anthropic': {
      targetUrl = endpoint || 'https://api.anthropic.com/v1/messages';
      headers = { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
      const sysMsg = allMessages.find(m => m.role === 'system')?.content;
      const nonSys = allMessages.filter(m => m.role !== 'system');
      payload = {
        model: modelId, max_tokens: maxTokens ?? 8192, temperature: temperature ?? 0.3,
        system: sysMsg,
        messages: nonSys.map(m => ({ role: m.role, content: m.content })),
      };
      break;
    }
    case 'openai': {
      targetUrl = endpoint || 'https://api.openai.com/v1/chat/completions';
      headers = { Authorization: `Bearer ${apiKey}` };
      payload = { model: modelId, temperature: temperature ?? 0.3, max_tokens: maxTokens ?? 8192, messages: allMessages };
      break;
    }
    case 'local_ollama':
    case 'cloud_ollama': {
      const isCloud = provider === 'cloud_ollama';
      targetUrl = endpoint || (isCloud ? 'http://cloud-ollama-node:11434/api/chat' : 'http://localhost:11434/api/chat');
      // Stretch context window: default 32k, or user-defined via env
      // Adaptive context: shrinks under CPU/GPU pressure to prevent freezes
      const governor = ResourceGovernor.getInstance();
      const ctxSize = governor.getAdaptiveContextSize();
      console.log(`[callLLM] Adaptive Ollama context: ${ctxSize} tokens`);
      payload = { model: modelId, messages: allMessages, stream: false, options: { temperature: temperature ?? 0.3, num_ctx: ctxSize, num_predict: maxTokens ?? 8192 } };
      break;
    }
    default: {
      targetUrl = endpoint;
      headers = { Authorization: `Bearer ${apiKey}` };
      payload = { model: modelId, temperature: temperature ?? 0.3, max_tokens: maxTokens ?? 8192, messages: allMessages };
      break;
    }
  }

  console.log(`[callLLM] ${provider} → ${targetUrl}`);
  const isNode = typeof window === 'undefined';
  // Adaptive timeout: shrinks under system pressure to release GPU faster
  const governorDirect = ResourceGovernor.getInstance();
  const timeoutMsDirect = governorDirect.getAdaptiveLLMTimeout();
  const signal = AbortSignal.timeout(timeoutMsDirect);
  console.log(`[callLLM] Adaptive timeout: ${Math.round(timeoutMsDirect / 1000)}s`);
  
  const res = await OllamaManager.enqueue(async () => {
    if (isNode) {
      return fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(payload),
        signal
      });
    } else {
      return fetch('/api/llm-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUrl, headers, payload }),
        signal
      });
    }
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Proxy ${res.status}: ${errText}`);
  }

  const data = await res.json();

  // Detect API-level errors (quota, auth, rate-limit)
  if (data.error) {
    throw new Error(typeof data.error === 'string' ? data.error : data.error.message || JSON.stringify(data.error));
  }

  switch (provider) {
    case 'google_gemini':
      return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '[No response from Gemini]';
    case 'anthropic':
      return data.content?.[0]?.text ?? '[No response from Claude]';
    case 'openai':
      return data.choices?.[0]?.message?.content ?? '[No response from OpenAI]';
    case 'local_ollama':
      return data.message?.content ?? '[No response from Ollama]';
    default:
      return data.choices?.[0]?.message?.content ?? data.content?.[0]?.text ?? data.message?.content ?? '[No response]';
  }
}

// ─── BaseAgent Class ────────────────────────────────────────────────

export abstract class BaseAgent {
  readonly config: AgentConfig;
  protected projectPath: string;
  protected branch: string;

  // ── Shared CommonSenseGate singleton ───────────────────────────────
  // One gate instance for all agents — shared staleness log and wired memory.
  // Agents never instantiate their own gate (that would defeat deduplication).
  protected static gate: CommonSenseGate = new CommonSenseGate();

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
    // ── CommonSenseGate Evaluation ─────────────────────────────────
    // The gate is the FIRST thing evaluated — before context scan, before LLM call.
    // REJECT/SKIP return immediately with no token spend.
    const gateResult = await BaseAgent.gate.evaluate(task.goal, {
      type: 'task',
      projectPath: this.projectPath,
      targetFiles: task.targetFiles,
      agentSkills: this.config.skills,
    });

    if (gateResult.finalVerdict === 'REJECT') {
      const reason = gateResult.results.find(r => r.verdict === 'REJECT')?.reason ?? 'Unknown reason';
      const msg = `[CommonSenseGate] REJECTED: ${reason}`;
      console.warn(`[${this.config.name}] ${msg}`);
      return msg; // Surface the rejection as task output — not a thrown error
    }

    if (gateResult.finalVerdict === 'SKIP') {
      const reason = gateResult.results.find(r => r.verdict === 'SKIP')?.reason ?? 'Already done';
      const msg = `[CommonSenseGate] SKIPPED: ${reason}`;
      console.log(`[${this.config.name}] ${msg}`);
      return msg;
    }

    // ── Context + Prompt ───────────────────────────────────────────
    const context = await this.gatherContext();
    const model: ModelConfig = { ...this.config.model, systemPrompt: this.systemPrompt };

    // Inject CAUTION warning and enriched memory context into the prompt
    const cautionPrefix = gateResult.finalVerdict === 'CAUTION'
      ? `[CommonSenseGate] ⚠️ CAUTION: ${gateResult.results.filter(r => r.verdict === 'CAUTION').map(r => r.reason).join('; ')}\n\n`
      : '';
    const memoryContext = gateResult.enrichedContext
      ? `\n\n${gateResult.enrichedContext}`
      : '';

    const prompt = this.buildPrompt(task, context + memoryContext);
    const finalPrompt = cautionPrefix ? cautionPrefix + prompt : prompt;
    const response = await callLLM(model, [{ role: 'user', content: finalPrompt }], true);

    let filesWritten = 0;

    // 1. Try parsing <file path="...">...</file> blocks (robust regex)
    const fileRegex = /<file\s+(?:path|name)=["']?([^"'>]+)["']?>([\s\S]*?)<\/file>/gi;
    let match;
    while ((match = fileRegex.exec(response)) !== null) {
      const relativePath = match[1];
      let content = match[2].trim();
      // Remove accidental markdown backticks inside the tag
      content = content.replace(/^```[\w]*\n/, '').replace(/\n```$/, '');

      const absolutePath = `${this.projectPath}/${relativePath}`;
      try {
        await TerminalBridge.writeFile(absolutePath, content);
        console.log(`[BaseAgent] Wrote XML tag file to ${absolutePath}`);
        filesWritten++;
      } catch (err: any) {
        console.error(`[BaseAgent] Failed to write ${absolutePath}:`, err.message);
      }
    }

    // 2. If no XML tags were found, fallback to parsing markdown code blocks with filename headers
    if (filesWritten === 0) {
      // Matches `filepath.ext` followed by ```code```
      const mdRegex = /(?:`|\*\*|_)?([a-zA-Z0-9_\-\/\\]+\.[a-zA-Z0-9]+)(?:`|\*\*|_)?\s*:\s*\n*```[a-zA-Z]*\n([\s\S]*?)```/g;
      while ((match = mdRegex.exec(response)) !== null) {
        const relativePath = match[1];
        const content = match[2].trim();
        const absolutePath = `${this.projectPath}/${relativePath}`;
        try {
          await TerminalBridge.writeFile(absolutePath, content);
          console.log(`[BaseAgent] Wrote Markdown block file to ${absolutePath}`);
          filesWritten++;
        } catch (err: any) {
          console.error(`[BaseAgent] Failed to write ${absolutePath}:`, err.message);
        }
      }
    }

    if (filesWritten === 0 && task.targetFiles && task.targetFiles.length === 1) {
       // 3. Absolute fallback: If exactly one target file was specified and we found a single code block
       const singleBlockMatch = response.match(/```[a-zA-Z]*\n([\s\S]*?)```/);
       if (singleBlockMatch) {
         const absolutePath = `${this.projectPath}/${task.targetFiles[0]}`;
         try {
           await TerminalBridge.writeFile(absolutePath, singleBlockMatch[1].trim());
           console.log(`[BaseAgent] Wrote single fallback block to ${absolutePath}`);
           filesWritten++;
         } catch (err) {}
       }
    }

    // ── Record success in Gate + MemoryBridge ──────────────────────
    // This prevents duplicate execution and builds the learning memory.
    if (filesWritten > 0 || response.length > 50) {
      await BaseAgent.gate.recordSuccess(this.config.id, task.goal, response);
    }

    if (filesWritten > 0) {
      return `[Auto-Write] Successfully generated and wrote ${filesWritten} file(s) to disk.\n\n` + response;
    }

    return response;
  }

  /** Build the execution prompt. Agents can override for custom formatting. */
  protected buildPrompt(task: PipelineTask, context: string): string {
    // ── Token Budget Enforcement ─────────────────────────────────────────
    // The model's maxTokens field applies to OUTPUT, not total context window.
    // We budget the INPUT separately. Rule: total prompt ≤ CONTEXT_WINDOW_CHARS.
    // Default: 24,000 chars ≈ 6,000 tokens — safe for most 8k+ context models.
    // Ollama models (4k-8k ctx): the ResourceGovernor already throttles ctx size.
    const contextWindowChars = (this.config.model.maxTokens ?? 8192) * 3; // 3 chars/token (conservative)

    // The "static frame" — parts that never get truncated no matter what:
    //   identity (≈80 chars) + task goal (≤500) + description (≤800) +
    //   target files (≤200) + branch (≤50) + output format instructions (≈600)
    const STATIC_FRAME_CHARS = 2500;
    const contextBudget = contextWindowChars - STATIC_FRAME_CHARS;

    const safeContext = this.enforceTokenBudget(context, contextBudget, 'PROJECT CONTEXT');

    return `You are ${this.config.name}, a ${this.config.role}.

TASK: ${task.goal}
${task.description ? `\nDETAILS: ${task.description.substring(0, 800)}` : ''}
${task.targetFiles?.length ? `\nFOCUS FILES: ${task.targetFiles.join(', ')}` : ''}

PROJECT CONTEXT:
${safeContext}

TARGET BRANCH: ${task.targetBranch || this.branch}

Complete this task. 
CRITICAL: To actually save the code, you MUST format your output exactly like this:
<file path="src/components/MyComponent.tsx">
export const MyComponent = () => {
  return <div>Hello</div>;
};
</file>

You can create or update multiple files by providing multiple <file> blocks.
DO NOT wrap the code inside the <file> tags with markdown backticks (\`\`\`). Just put the raw code directly inside the tags.`;
  }

  /**
   * Enforce a character budget on any large string before it enters a prompt.
   *
   * Strategy:
   *   - If content fits within budget: return as-is.
   *   - If content overflows: keep the HEAD (most structurally important — file
   *     tree, package.json), then append a TAIL snippet (most recent context),
   *     then add a visible truncation banner.
   *
   * Why head+tail instead of just head?
   *   For long dependency handoff reports, the most relevant work is at the END.
   *   Head+tail gives the LLM both the directory structure AND the latest output.
   *
   * @param content   The raw string to potentially truncate.
   * @param budget    Max character count allowed.
   * @param label     Human-readable label for the truncation banner (e.g., 'PROJECT CONTEXT').
   */
  protected enforceTokenBudget(content: string, budget: number, label: string = 'CONTENT'): string {
    if (content.length <= budget) return content;

    // Reserve some budget for the truncation banner itself
    const BANNER_CHARS = 200;
    const usable = budget - BANNER_CHARS;

    if (usable <= 0) {
      return `[${label} TRUNCATED — budget too small (${budget} chars)]`;
    }

    // Split budget: 70% head (structural info), 30% tail (recent output)
    const headChars = Math.floor(usable * 0.7);
    const tailChars = usable - headChars;

    const head = content.substring(0, headChars);
    const tail = content.substring(content.length - tailChars);

    const truncatedBytes = content.length - usable;
    const truncatedTokensEst = Math.round(truncatedBytes / 4);

    return `${head}

... [⚠️ ${label} TRUNCATED: ${truncatedBytes.toLocaleString()} chars (~${truncatedTokensEst.toLocaleString()} tokens) omitted to stay within context budget. Work with what is available above and below.] ...

${tail}`;
  }

  /** Helper to call this agent's LLM with an arbitrary prompt. */
  async ask(prompt: string): Promise<string> {
    const model: ModelConfig = {
      ...this.config.model,
      systemPrompt: this.systemPrompt,
    };
    return await callLLM(model, [{ role: 'user', content: prompt }], true);
  }
}
