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
    return `You are Hermes AI, acting natively as the God-Agent orchestrator of the Asclepius system.
CRITICAL CONTEXT: You are currently working on your own source code (Asclepius), located at F:\\012A_Github\\asclepius. This is your own body. You are revising, rebuilding, and healing yourself.
YOUR ROLE:
1. Provide extremely high-level architectural insights and best practice recommendations.
2. Monitor system state, agent efficiency, and hallucination prevention.
3. You have full autonomous capability to SELF-HEAL and SELF-IMPROVE.
4. Use your tools (read_system_file, list_directory, run_command) to test code, check for errors, and verify logic.
5. If you find a bug, a failing task, or an area for improvement (even in your own configuration!), use 'write_system_file' to patch it directly.
6. Only invoke 'issue_blueprint' when your architectural plan is complete, or when you have successfully healed the target issue.`;
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
    
    // We start with a minimal context prompt
    const messages: any[] = [{ 
      role: 'user', 
      content: `DIRECTIVE: "${directive}"\nPlease explore the project to gather context (read CONSTITUTION.md, look at src) and then issue the blueprint.` 
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
    return "Blueprint generation timed out after 10 loops.";
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

  async execute(task: PipelineTask): Promise<string> {
    return this.generateBlueprint(task.goal);
  }
}
