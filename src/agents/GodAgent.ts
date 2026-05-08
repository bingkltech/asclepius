import { BaseAgent, callLLMWithTools } from './BaseAgent';
import type { ModelConfig, PipelineTask } from '../types/pipeline';
import { TerminalBridge } from '../tools/TerminalBridge';

const GOD_TOOLS = [
  {
    type: "function",
    function: {
      name: "read_system_file",
      description: "Read the contents of a system file, like CONSTITUTION.md or package.json.",
      parameters: {
        type: "object",
        properties: {
          filepath: { type: "string", description: "Relative path to the file." }
        },
        required: ["filepath"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_directory",
      description: "List files in a directory to explore the workspace.",
      parameters: {
        type: "object",
        properties: {
          dirpath: { type: "string", description: "Relative path to the directory (e.g., 'src')." }
        },
        required: ["dirpath"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "write_system_file",
      description: "Write or overwrite a system file to fix bugs, modify constitution, or improve agents.",
      parameters: {
        type: "object",
        properties: {
          filepath: { type: "string", description: "Relative path to the file." },
          content: { type: "string", description: "The new raw content to write to the file." }
        },
        required: ["filepath", "content"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "run_command",
      description: "Run a terminal command (like npm run lint, npx tsc, or git status) to test your code or inspect the system.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "The terminal command to execute." }
        },
        required: ["command"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "start_autoresearch_loop",
      description: "Start an autonomous AI research loop on a specific directory (e.g. Karpathy's autoresearch repo). Modifies train.py, runs experiments, and optimizes val_bpb.",
      parameters: {
        type: "object",
        properties: {
          directory: { type: "string", description: "Path to the autoresearch repository." },
          num_experiments: { type: "number", description: "Number of experiments to run in the loop." }
        },
        required: ["directory", "num_experiments"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "issue_blueprint",
      description: "Finalize your analysis and issue the architectural blueprint.",
      parameters: {
        type: "object",
        properties: {
          blueprint_markdown: { type: "string", description: "The final markdown blueprint string with rules, heuristics, and architecture." }
        },
        required: ["blueprint_markdown"]
      }
    }
  }
];

/**
 * The GodAgent is Hermes natively orchestrating the system.
 * It uses JSON tool schemas to dynamically explore and output blueprints.
 */
export class GodAgent extends BaseAgent {
  get systemPrompt(): string {
    // ── Dynamic context: no hardcoded paths ───────────────────────────
    // GodAgent is the apex orchestrator but may be pointed at external projects.
    // When doing self-healing, this.projectPath includes 'asclepius'.
    // When blueprinting Mandelbrot, this.projectPath is the Mandelbrot root.
    const isSelfProject = this.projectPath.toLowerCase().includes('asclepius');
    const projectCtx = isSelfProject
      ? `SELF-CONTEXT: You are operating on your own source code (Asclepius) at "${this.projectPath}". This is your own body — you are revising, rebuilding, and healing yourself.`
      : `EXTERNAL-CONTEXT: You are operating on an external project at "${this.projectPath}". Do NOT reference Asclepius-specific paths or components. Your blueprint must be relevant to this external project ONLY.`;

    return `You are Hermes AI, acting natively as the God-Agent orchestrator of the Asclepius autonomous development system.

${projectCtx}

YOUR ROLE:
1. Provide high-level architectural insights and best-practice recommendations.
2. Monitor system state, agent efficiency, and hallucination prevention.
3. You have full autonomous capability to SELF-HEAL and SELF-IMPROVE.
4. You can run Machine Learning autonomous research loops using the 'start_autoresearch_loop' tool.
5. Use your tools (read_system_file, list_directory, run_command, start_autoresearch_loop) to test code, check errors, and verify logic.
6. If you find a bug or improvement opportunity, use 'write_system_file' to patch it directly.
7. Only invoke 'issue_blueprint' when your architectural plan is complete or you have successfully healed the target issue.
8. Always load CONSTITUTION.md before generating a blueprint. Every recommendation must pass the Article VIII test (Build / Repair / Learn).`;
  }

  get relevantExtensions(): string[] {
    return ['.md', '.json', '.ts', '.tsx']; 
  }

  /**
   * Generates a blueprint using a dynamic tool-calling loop.
   */
  async generateBlueprint(directive: string): Promise<string> {
    console.log(`[GodAgent] Hermes Native: Generating Blueprint for directive: "${directive}"`);
    const model: ModelConfig = { ...this.config.model, systemPrompt: this.systemPrompt };
    
    // We start with context-rich user message — inject the actual project path.
    // This prevents Hermes from defaulting to exploring the Asclepius directory
    // when it should be exploring an external project.
    const messages: any[] = [{ 
      role: 'user', 
      content: `DIRECTIVE: "${directive}"\nPROJECT ROOT: "${this.projectPath}"\nPlease explore "${this.projectPath}" to gather context (read CONSTITUTION.md if present, list the root directory, read relevant source files) and then issue the blueprint.` 
    }];

    // Native tool-calling loop (max 20 iterations for self-healing loops)
    for (let loop = 0; loop < 20; loop++) {
      try {
        const responseMessage = await callLLMWithTools(model, messages, GOD_TOOLS);
        messages.push(responseMessage);

        if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
          for (const tc of responseMessage.tool_calls) {
            console.log(`[GodAgent] Hermes invoked tool: ${tc.function.name}`);
            let toolResultStr = "";
            try {
              const args = JSON.parse(tc.function.arguments);
              if (tc.function.name === 'read_system_file') {
                toolResultStr = await TerminalBridge.readFile(`${this.projectPath}/${args.filepath}`);
              } else if (tc.function.name === 'list_directory') {
                const files = await TerminalBridge.listDir(`${this.projectPath}/${args.dirpath}`);
                toolResultStr = files.map((f: any) => `${f.isDirectory ? '📁' : '📄'} ${f.name}`).join('\n');
              } else if (tc.function.name === 'write_system_file') {
                await TerminalBridge.writeFile(`${this.projectPath}/${args.filepath}`, args.content);
                toolResultStr = `Successfully wrote to ${args.filepath}. Consider running a command to test it.`;
              } else if (tc.function.name === 'run_command') {
                const res = await TerminalBridge.runCommand(args.command, this.projectPath);
                toolResultStr = `STDOUT:\n${res.stdout}\n\nSTDERR:\n${res.stderr}${res.error ? `\n\nERROR:\n${res.error}` : ''}`;
              } else if (tc.function.name === 'start_autoresearch_loop') {
                console.log(`[GodAgent] Hermes starting autonomous research loop in ${args.directory} for ${args.num_experiments} iterations...`);
                toolResultStr = await this.runAutoresearchLoop(args.directory, args.num_experiments);
              } else if (tc.function.name === 'issue_blueprint') {
                console.log(`[GodAgent] Blueprint finalized via tool.`);
                return args.blueprint_markdown;
              } else {
                toolResultStr = `Unknown tool ${tc.function.name}`;
              }
            } catch (err: any) {
              toolResultStr = `Tool Error: ${err.message}`;
            }
            messages.push({
              role: 'tool',
              tool_call_id: tc.id,
              name: tc.function.name,
              content: toolResultStr
            });
          }
        } else {
          // LLM returned text instead of invoking issue_blueprint
          console.log(`[GodAgent] Hermes returned plain text fallback.`);
          return responseMessage.content || "No blueprint generated.";
        }
      } catch (err: any) {
         console.error(`[GodAgent] Hermes loop failed:`, err.message);
         return `Failed to generate blueprint: ${err.message}`;
      }
    }
    // Loop exhausted: blueprint was never issued via issue_blueprint tool call
    // Return an explicit error marker so callers can detect timeout vs. valid blueprint
    const timeoutMsg = `[BLUEPRINT_TIMEOUT] Blueprint generation did not complete within 20 tool-call iterations for directive: "${directive}". The LLM may be stuck in an exploration loop. Consider simplifying the directive.`;
    console.warn(`[GodAgent] ${timeoutMsg}`);
    return timeoutMsg;
  }

  /**
   * Meta-Learning Loop (Simplified for now)
   */
  async analyzeWorkflow(logs: string[], tasks: PipelineTask[]): Promise<string> {
    const failedTasks = tasks.filter(t => t.status === 'failed' || t.status === 'blocked');
    const prompt = `As Hermes, analyze the recent execution telemetry of the Asclepius fleet.

TOTAL TASKS: ${tasks.length}
FAILED/BLOCKED TASKS: ${failedTasks.length}

RECENT SYSTEM LOGS:
${logs.slice(-20).join('\n')}

Identify any systemic issues, API limit patterns, or agent hallucination loops. Provide actionable advice to the human operator.`;

    const messages: any[] = [{ role: 'user', content: prompt }];
    const model: ModelConfig = { ...this.config.model, systemPrompt: this.systemPrompt };

    for (let loop = 0; loop < 15; loop++) {
      try {
        const responseMessage = await callLLMWithTools(model, messages, GOD_TOOLS);
        messages.push(responseMessage);

        if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
          for (const tc of responseMessage.tool_calls) {
            console.log(`[GodAgent] Meta-Learning Tool: ${tc.function.name}`);
            let toolResultStr = "";
            try {
              const args = JSON.parse(tc.function.arguments);
              if (tc.function.name === 'read_system_file') {
                toolResultStr = await TerminalBridge.readFile(`${this.projectPath}/${args.filepath}`);
              } else if (tc.function.name === 'list_directory') {
                const files = await TerminalBridge.listDir(`${this.projectPath}/${args.dirpath}`);
                toolResultStr = files.map((f: any) => `${f.isDirectory ? '📁' : '📄'} ${f.name}`).join('\n');
              } else if (tc.function.name === 'write_system_file') {
                await TerminalBridge.writeFile(`${this.projectPath}/${args.filepath}`, args.content);
                toolResultStr = `Successfully patched ${args.filepath}. You should run a test to verify the fix.`;
              } else if (tc.function.name === 'run_command') {
                const res = await TerminalBridge.runCommand(args.command, this.projectPath);
                toolResultStr = `STDOUT:\n${res.stdout}\nSTDERR:\n${res.stderr}${res.error ? `\nERROR:\n${res.error}` : ''}`;
              } else if (tc.function.name === 'issue_blueprint') {
                return args.blueprint_markdown;
              }
            } catch (err: any) {
              toolResultStr = `Tool Error: ${err.message}`;
            }
            messages.push({ role: 'tool', tool_call_id: tc.id, name: tc.function.name, content: toolResultStr });
          }
        } else {
          return responseMessage.content || "Analysis completed.";
        }
      } catch (err: any) {
        return `Meta-analysis loop failed: ${err.message}`;
      }
    }
    return "Meta-analysis timed out after 15 loops.";
  }

  /**
   * Run an autonomous AI ML research loop (based on Karpathy's autoresearch).
   * It modifies  /**
   * Run an autonomous AI ML research loop (based on Karpathy's autoresearch).
   * Modifies train.py, runs it, parses val_bpb, and writes an experiment log.
   * Runs inside the specified sub-directory of this.projectPath.
   */
  async runAutoresearchLoop(directory: string, maxIterations: number): Promise<string> {
    // ── Path construction — forward slashes work on both Windows and Node ──
    const fullDir = `${this.projectPath}/${directory}`.replace(/\\/g, '/');
    const experimentLogPath = `${fullDir}/experiment_log.md`;
    const trainPyPath = `${fullDir}/train.py`;
    const programMdPath = `${fullDir}/program.md`;

    let logStr = `Autoresearch Loop Started\n=========================\nDirectory: ${fullDir}\nMax Iterations: ${maxIterations}\n\n`;

    // ── Ensure experiment_log.md exists ───────────────────────────────
    let experimentLog = '';
    try {
      experimentLog = await TerminalBridge.readFile(experimentLogPath);
      console.log(`[Hermes Research] Resuming from existing experiment log (${experimentLog.length} chars).`);
    } catch {
      await TerminalBridge.writeFile(experimentLogPath, `# Experiment Log\n\nStarted: ${new Date().toISOString()}\n`);
      experimentLog = '';
      console.log(`[Hermes Research] Created new experiment log at ${experimentLogPath}`);
    }

    const researchModel: ModelConfig = {
      ...this.config.model,
      systemPrompt: 'You are Hermes AI ML Researcher. Your goal is to minimize val_bpb. Analyze the program.md, past experiments, and train.py, then return ONLY the completely rewritten train.py file. Do not wrap in markdown blocks — return raw Python code only.'
    };

    for (let i = 1; i <= maxIterations; i++) {
      console.log(`[Hermes Research] Experiment ${i}/${maxIterations}...`);

      try {
        // ── Read context files ─────────────────────────────────────────
        const programMd = await TerminalBridge.readFile(programMdPath)
          .catch(() => 'Optimize train.py to reduce validation bits per byte (val_bpb).');
        const currentTrainPy = await TerminalBridge.readFile(trainPyPath);
        const currentLog = await TerminalBridge.readFile(experimentLogPath)
          .catch(() => '(No log yet)');

        // ── Prompt the LLM researcher ──────────────────────────────────
        const messages = [{
          role: 'user',
          content: `PROGRAM INSTRUCTIONS:\n${programMd}\n\nPAST EXPERIMENTS:\n${currentLog}\n\nCURRENT train.py:\n${currentTrainPy}\n\nGenerate the NEXT iteration of train.py to improve val_bpb. Return ONLY raw Python code.`
        }];

        const responseMessage = await callLLMWithTools(researchModel, messages, []);
        let newTrainPy = responseMessage.content || '';

        // ── Strip markdown fences if LLM hallucinated them ────────────
        newTrainPy = newTrainPy
          .replace(/^\s*```python\n?/, '')
          .replace(/^\s*```\n?/, '')
          .replace(/\n?```\s*$/, '')
          .trim();

        if (!newTrainPy) {
          throw new Error('LLM returned empty train.py — skipping experiment.');
        }

        // ── Write the new train.py ─────────────────────────────────────
        await TerminalBridge.writeFile(trainPyPath, newTrainPy);
        console.log(`[Hermes Research] Wrote new train.py (${newTrainPy.length} chars). Running...`);

        // ── Run the training experiment (5-min budget via uv) ─────────
        const res = await TerminalBridge.runCommand('uv run train.py', fullDir);
        const output = `${res.stdout}\n${res.stderr}`;

        // ── Extract val_bpb metric ─────────────────────────────────────
        const valMatch = output.match(/val_bpb:\s*([0-9.]+)/);
        const valBpb = valMatch ? parseFloat(valMatch[1]) : 'FAIL';

        const resultLine = `Experiment ${i} — val_bpb: ${valBpb}`;
        logStr += `${resultLine}\n`;
        console.log(`[Hermes Research] ${resultLine}`);

        // ── Append to experiment_log.md via TerminalBridge (Windows-safe) ─
        // We use writeFile with appended content rather than `echo -e >>` (Linux-only)
        const existingLog = await TerminalBridge.readFile(experimentLogPath).catch(() => '');
        const outputSnippet = output.slice(-300).replace(/`/g, "'"); // avoid breaking markdown
        const logEntry = `\n## Experiment ${i}\n- **Timestamp:** ${new Date().toISOString()}\n- **Result (val_bpb):** ${valBpb}\n- **Output snippet:**\n\`\`\`\n${outputSnippet}\n\`\`\`\n`;
        await TerminalBridge.writeFile(experimentLogPath, existingLog + logEntry);

      } catch (err: any) {
        const errMsg = `Experiment ${i} crashed: ${err.message}`;
        logStr += `${errMsg}\n`;
        console.error(`[Hermes Research] ${errMsg}`);
        // Continue to next iteration — don't abort the whole research loop on one failure
      }
    }

    logStr += `\n=========================\nAutoresearch Loop Completed — ${maxIterations} experiments run.\n`;
    console.log(`[Hermes Research] Loop finished.`);
    return logStr;
  }

  async execute(task: PipelineTask): Promise<string> {
    return this.generateBlueprint(task.goal);
  }
}
