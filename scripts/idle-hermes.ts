import { GodAgent } from '../src/agents/GodAgent';
import { OllamaManager } from '../src/tools/OllamaManager';
import { TerminalBridge } from '../src/tools/TerminalBridge';
import type { AgentConfig } from '../src/types/pipeline';

const SLEEP_MS = 5 * 60 * 1000; // 5 minutes

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runIdleLoop() {
  console.log('🤖 [Idle Hermes] Waking up to scan codebase...');

  const bestModel = await OllamaManager.selectBestModel(undefined, 'high');
  console.log(`🤖 [Idle Hermes] Selected optimal Ollama model: ${bestModel}`);

  const config: AgentConfig = {
    id: 'hermes-idle',
    name: 'Hermes Auto-Healer',
    role: 'God-Agent',
    skills: ['architecture', 'self-healing'],
    model: {
      provider: 'local_ollama',
      modelId: bestModel,
      endpoint: 'http://localhost:11434/api/chat',
      apiKey: 'none'
    }
  };

  const projectPath = process.cwd();
  const hermes = new GodAgent(config, projectPath, 'main');

  while (true) {
    try {
      console.log('🤖 [Idle Hermes] Scanning src/ for target files...');
      
      // Get all TS/TSX files
      const srcFiles = await TerminalBridge.listDir(`${projectPath}/src`);
      const targetFiles = srcFiles
        .filter(f => !f.isDirectory && (f.name.endsWith('.ts') || f.name.endsWith('.tsx')))
        .map(f => `src/${f.name}`);

      if (targetFiles.length === 0) {
        console.log('🤖 [Idle Hermes] No files found to improve. Sleeping...');
      } else {
        // Pick a random file to analyze
        const randomFile = targetFiles[Math.floor(Math.random() * targetFiles.length)];
        console.log(`🤖 [Idle Hermes] Selected ${randomFile} for auto-improvement.`);

        const directive = `Read ${randomFile} and CONSTITUTION.md. Evaluate the code quality, readability, and adherence to our constitution.
If it is perfect, do nothing. 
If it can be improved, use 'write_system_file' to patch EXACTLY ONE function to make it better. 
Then run 'npm run lint' via 'run_command' to ensure you didn't break the syntax.`;

        console.log(`🤖 [Idle Hermes] Dispatching directive to native tool loop...`);
        const result = await hermes.generateBlueprint(directive);
        console.log(`🤖 [Idle Hermes] Improvement Cycle Complete:\n${result}\n`);
      }

    } catch (err: any) {
      console.error(`🤖 [Idle Hermes] Error during cycle: ${err.message}`);
    }

    console.log(`🤖 [Idle Hermes] Going to sleep for 5 minutes...`);
    await sleep(SLEEP_MS);
  }
}

// Start the daemon
runIdleLoop().catch(console.error);
