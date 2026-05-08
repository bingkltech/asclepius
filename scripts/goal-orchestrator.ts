import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

import { GodAgent } from '../src/agents/GodAgent';
import { LeadAgent } from '../src/agents/LeadAgent';
import { BaseAgent } from '../src/agents/BaseAgent';
import { OllamaManager } from '../src/tools/OllamaManager';
import { TerminalBridge } from '../src/tools/TerminalBridge';
import { ResourceGovernor } from '../src/tools/ResourceGovernor';
import { MemoryBridge } from '../src/tools/MemoryBridge';
import { GOAPPlanner } from '../src/tools/GOAPPlanner';
import { SwarmDispatcher } from '../src/tools/SwarmDispatcher';
import { APIDiscovery } from '../src/tools/APIDiscovery';
import { GraphKnowledge } from '../src/tools/GraphKnowledge';
import { CommonSenseGate } from '../src/tools/CommonSenseGate';
import type { AgentConfig, PipelineTask, AgentSkill } from '../src/types/pipeline';

const SLEEP_MS = 30 * 1000; // Check every 30 seconds
const GOALS_FILE = path.join(process.cwd(), 'GOALS.md');
const SOUL_FILE = path.join(process.cwd(), 'SOUL.md');
const MISSION_FILE = path.join(process.cwd(), 'MISSION.md');
const STATUS_FILE = path.join(process.cwd(), '.hermes-status.json');

function setStatus(state: string, details: string = '', model: string = '', dutyIndex: number = -1) {
  fs.writeFileSync(STATUS_FILE, JSON.stringify({ state, details, model, dutyIndex, timestamp: Date.now() }));
}

// ─── Dynamic Helper Agent ──────────────────────────────────────────
class DynamicHelperAgent extends BaseAgent {
  get systemPrompt(): string {
    return this.config.model.systemPrompt || `You are ${this.config.name}, a specialized ${this.config.role}.`;
  }

  get relevantExtensions(): string[] {
    return ['.ts', '.tsx', '.js', '.json', '.md', '.css', '.html', '.txt'];
  }
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function readPendingGoal(): Promise<{ fullText: string; goalText: string; lineIndex: number; file: string } | null> {
  const goalFiles = [GOALS_FILE];
  // Add all *.goals.md files in the current directory
  const cwdFiles = fs.readdirSync(process.cwd());
  for (const f of cwdFiles) {
    if (f.endsWith('.goals.md')) {
      goalFiles.push(path.join(process.cwd(), f));
    }
  }

  for (const file of goalFiles) {
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');

    // ── New structured format: find ### GOAL-NNN blocks with Status: PENDING ──
    for (let i = 0; i < lines.length; i++) {
      const goalHeader = lines[i].match(/^### (GOAL-\d+):\s*(.+)/);
      if (goalHeader) {
        // Scan the block for Status: PENDING and extract metadata
        let goalId = goalHeader[1];
        let goalTitle = goalHeader[2].trim();
        let project = '';
        let successCriteria = '';
        let scope = '';
        let isPending = false;

        for (let j = i + 1; j < Math.min(i + 12, lines.length); j++) {
          const line = lines[j].trim();
          if (line.startsWith('### GOAL-')) break; // Next goal block
          if (line.startsWith('- **Status:** PENDING')) isPending = true;
          const projMatch = line.match(/^- \*\*Project:\*\*\s*(.+)/);
          if (projMatch) project = projMatch[1].trim();
          const successMatch = line.match(/^- \*\*Success:\*\*\s*(.+)/);
          if (successMatch) successCriteria = successMatch[1].trim();
          const scopeMatch = line.match(/^- \*\*Scope:\*\*\s*(.+)/);
          if (scopeMatch) scope = scopeMatch[1].trim();
        }

        if (isPending) {
          // If the file is 'projectname.goals.md', use the projectname as the project if none is specified!
          if (!project && file.endsWith('.goals.md')) {
             project = path.join(process.cwd(), path.basename(file).replace('.goals.md', ''));
          }
          // Compose a rich goal text with all metadata
          let goalText = `[Project: ${project || process.cwd()}] ${goalTitle}`;
          if (successCriteria) goalText += ` | SUCCESS CRITERIA: ${successCriteria}`;
          if (scope) goalText += ` | SCOPE: ${scope}`;
          return { fullText: content, goalText, lineIndex: i, file };
        }
      }
    }

    // ── Legacy flat format fallback: - [ ] task ──
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/^- \[ \] (.+)/);
      if (match) {
        let project = '';
        if (file.endsWith('.goals.md')) {
             project = path.join(process.cwd(), path.basename(file).replace('.goals.md', ''));
        }
        let goalText = match[1].trim();
        if (project) goalText = `[Project: ${project}] ${goalText}`;
        return { fullText: content, goalText, lineIndex: i, file };
      }
    }
  }
  return null;
}

function loadIdentityContext(): string {
  const parts: string[] = [];

  // Load SOUL.md — Identity + Values only (common sense is in code, not prose)
  if (fs.existsSync(SOUL_FILE)) {
    const soul = fs.readFileSync(SOUL_FILE, 'utf-8');
    const valuesMatch = soul.match(/## Values[\s\S]*?(?=\n## |$)/i);
    if (valuesMatch) parts.push(valuesMatch[0].slice(0, 1500));
  }

  // Load MISSION.md — current mission statement
  if (fs.existsSync(MISSION_FILE)) {
    const mission = fs.readFileSync(MISSION_FILE, 'utf-8');
    const missionMatch = mission.match(/## Current Mission[\s\S]*?(?=\n## |$)/i);
    if (missionMatch) parts.push(missionMatch[0].slice(0, 800));
  }

  return parts.length > 0 ? parts.join('\n\n') : '';
}

async function scanAgencyRoster(): Promise<string[]> {
  const skillsDir = 'C:\\Users\\likha\\.gemini\\antigravity\\skills';
  try {
    const items = fs.readdirSync(skillsDir);
    return items.filter(i => i.startsWith('agency-'));
  } catch (err) {
    console.warn(`[God Agent] Could not read skills directory at ${skillsDir}`);
    return [];
  }
}

function markGoalCompleted(fullText: string, lineIndex: number, filePath: string = GOALS_FILE) {
  if (lineIndex < 0) return; // Prevent overwriting for continuous internal goals
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  // Handle structured format
  if (lines[lineIndex]?.startsWith('### GOAL-')) {
    for (let j = lineIndex + 1; j < Math.min(lineIndex + 12, lines.length); j++) {
      if (lines[j].includes('**Status:** PENDING')) {
        lines[j] = lines[j].replace('PENDING', '✅ COMPLETED');
        break;
      }
    }
  } else {
    // Legacy format
    lines[lineIndex] = lines[lineIndex].replace('- [ ]', '- [x]');
  }
  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
}

function markGoalFailed(fullText: string, lineIndex: number, filePath: string = GOALS_FILE) {
  if (lineIndex < 0) return; // Prevent overwriting for continuous internal goals
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  // Handle structured format
  if (lines[lineIndex]?.startsWith('### GOAL-')) {
    for (let j = lineIndex + 1; j < Math.min(lineIndex + 12, lines.length); j++) {
      if (lines[j].includes('**Status:** PENDING')) {
        lines[j] = lines[j].replace('PENDING', '❌ FAILED');
        break;
      }
    }
  } else {
    // Legacy format
    lines[lineIndex] = lines[lineIndex].replace('- [ ]', '- [FAILED]');
  }
  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
}

// ─── OODA Loop: Observation Types ──────────────────────────────────

interface Observation {
  type: 'compile_error' | 'untested_tool' | 'stale_doc' | 'dead_dependency' | 'ollama_health' | 'proposed_goal' | 'curiosity_gap';
  severity: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  successCriteria: string;
  scope: string;
}

// ─── OODA: Phase 1 — OBSERVE ───────────────────────────────────────
// Scan the codebase for REAL problems. No LLM needed — pure heuristics.

async function observe(projectPath: string): Promise<Observation[]> {
  const observations: Observation[] = [];
  console.log(`\n👁️ [OODA:Observe] Scanning codebase for real problems...`);

  // 1. Compilation health
  try {
    const tscResult = await TerminalBridge.runCommand('npx tsc --noEmit 2>&1', projectPath);
    const output = tscResult.stdout + tscResult.stderr;
    if (output.includes('error TS')) {
      const errorCount = (output.match(/error TS/g) || []).length;
      observations.push({
        type: 'compile_error', severity: 'high',
        title: `Fix ${errorCount} TypeScript compilation error(s)`,
        detail: output.slice(0, 500),
        successCriteria: '`npx tsc --noEmit` exits with 0 errors',
        scope: 'Files referenced in tsc error output'
      });
    }
  } catch { /* tsc not available */ }

  // 2. Untested tools
  try {
    const toolsDir = path.join(projectPath, 'src', 'tools');
    const testsDir = path.join(toolsDir, '__tests__');
    if (fs.existsSync(toolsDir)) {
      const tools = fs.readdirSync(toolsDir).filter(f => f.endsWith('.ts') && !f.startsWith('index'));
      const tests = fs.existsSync(testsDir) ? fs.readdirSync(testsDir) : [];
      const untested = tools.filter(t => !tests.some(test => test.includes(t.replace('.ts', ''))));
      if (untested.length > 0) {
        const target = untested[0];
        observations.push({
          type: 'untested_tool', severity: 'medium',
          title: `Write unit test for ${target}`,
          detail: `${untested.length} tools lack tests. Starting with: ${target}`,
          successCriteria: `vitest run passes with at least one test for ${target}`,
          scope: `src/tools/${target} and src/tools/__tests__/${target.replace('.ts', '.test.ts')}`
        });
      }
    }
  } catch { /* skip */ }

  // 3. Check for PROPOSED goals needing auto-promotion
  try {
    if (fs.existsSync(GOALS_FILE)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const proposedCount = (content.match(/Status:\s*PROPOSED/g) || []).length;
      if (proposedCount > 0) {
        observations.push({
          type: 'proposed_goal', severity: 'low',
          title: `${proposedCount} PROPOSED goal(s) awaiting promotion`,
          detail: `Found ${proposedCount} goal(s) with Status: PROPOSED`,
          successCriteria: 'Size S goals promoted to PENDING',
          scope: 'GOALS.md'
        });
      }
    }
  } catch { /* skip */ }

  // 4. Ollama health
  try {
    const ollamaResult = await TerminalBridge.runCommand('curl -s http://localhost:11434/api/tags', projectPath);
    if (!ollamaResult.stdout.includes('models')) {
      observations.push({
        type: 'ollama_health', severity: 'high',
        title: 'Ollama is not responding',
        detail: 'localhost:11434/api/tags did not return model list',
        successCriteria: 'Ollama API responds with model list',
        scope: 'System infrastructure'
      });
    }
  } catch { /* skip */ }

  // 5. The Curiosity Drive (Epistemic Foraging)
  // If the system is perfectly healthy, find something to learn to improve the codebase.
  if (observations.length === 0) {
    try {
      const toolsDir = path.join(projectPath, 'src', 'tools');
      if (fs.existsSync(toolsDir)) {
        const tools = fs.readdirSync(toolsDir).filter(f => f.endsWith('.ts'));
        if (tools.length > 0) {
          const randomTool = tools[Math.floor(Math.random() * tools.length)];
          observations.push({
            type: 'curiosity_gap', severity: 'low',
            title: `Deep-dive research into ${randomTool}`,
            detail: `The system is perfectly healthy. Triggering Curiosity Drive to study ${randomTool} for potential architectural improvements or hidden edge cases.`,
            successCriteria: `Write a 200-word research summary about ${randomTool} to a new file in the 'knowledge/curiosity' directory.`,
            scope: `src/tools/${randomTool}`
          });
        }
      }
    } catch { /* skip */ }
  }

  console.log(`👁️ [OODA:Observe] Found ${observations.length} observation(s): ${observations.map(o => `[${o.severity}] ${o.title}`).join(', ') || 'all clear'}`);
  return observations;
}

// ─── OODA: Phase 2 — PROPOSE ───────────────────────────────────────
// Write new goals to GOALS.md based on observations.

function proposeGoal(obs: Observation): string | null {
  if (!fs.existsSync(GOALS_FILE)) return null;
  const content = fs.readFileSync(filePath, 'utf-8');

  // Don't propose duplicates
  if (content.includes(obs.title)) {
    console.log(`🧭 [OODA:Propose] Skipped — "${obs.title}" already exists in GOALS.md`);
    return null;
  }

  // Generate next ID
  const existingIds = content.match(/GOAL-(\d+)/g) || [];
  const maxId = existingIds.reduce((max, id) => {
    const num = parseInt(id.replace('GOAL-', ''), 10);
    return num > max ? num : max;
  }, 0);
  const nextId = `GOAL-${String(maxId + 1).padStart(3, '0')}`;

  // Size S auto-promotes to PENDING
  const goalBlock = [
    '', `### ${nextId}: [Hermes] ${obs.title}`,
    `- **Size:** S`, `- **Project:** asclepius`,
    `- **Success:** ${obs.successCriteria}`,
    `- **Scope:** ${obs.scope}`,
    `- **Status:** PENDING`,
    `- **Origin:** Hermes OODA observation at ${new Date().toISOString()}`,
  ].join('\n');

  const insertPoint = content.indexOf('\n## Completed Goals');
  if (insertPoint > 0) {
    fs.writeFileSync(filePath, content.slice(0, insertPoint) + goalBlock + '\n' + content.slice(insertPoint), 'utf-8');
  } else {
    fs.appendFileSync(GOALS_FILE, goalBlock + '\n');
  }

  console.log(`📝 [OODA:Propose] Created ${nextId}: "${obs.title}" [PENDING]`);
  return nextId;
}

// ─── OODA: Phase 3 — VERIFY ───────────────────────────────────────
// After execution, check if the work actually succeeded.

async function verify(projectPath: string, goalText: string): Promise<{ passed: boolean; evidence: string }> {
  console.log(`🔍 [OODA:Verify] Checking if the work actually succeeded...`);

  try {
    const tscResult = await TerminalBridge.runCommand('npx tsc --noEmit 2>&1', projectPath);
    const output = tscResult.stdout + tscResult.stderr;
    if (output.includes('error TS')) {
      const errorCount = (output.match(/error TS/g) || []).length;
      console.log(`🔍 [OODA:Verify] FAILED — ${errorCount} TypeScript errors after execution`);
      return { passed: false, evidence: `tsc found ${errorCount} errors: ${output.slice(0, 300)}` };
    }
  } catch (err: any) {
    return { passed: false, evidence: `tsc check failed: ${err.message}` };
  }

  if (goalText.toLowerCase().includes('test')) {
    try {
      const testResult = await TerminalBridge.runCommand('npx vitest run 2>&1', projectPath);
      const output = testResult.stdout + testResult.stderr;
      if (output.includes('FAIL')) {
        console.log(`🔍 [OODA:Verify] FAILED — tests did not pass`);
        return { passed: false, evidence: `vitest failed: ${output.slice(0, 300)}` };
      }
    } catch { /* vitest not available */ }
  }

  console.log(`🔍 [OODA:Verify] PASSED — project compiles clean`);
  return { passed: true, evidence: 'tsc --noEmit: 0 errors' };
}

// ─── OODA: Phase 4 — REFLECT ──────────────────────────────────────
// Record structured lessons after execution.

async function reflect(
  gate: CommonSenseGate, goalText: string, success: boolean, evidence: string
): Promise<void> {
  console.log(`💭 [OODA:Reflect] Recording ${success ? 'success' : 'failure'}...`);
  const result = JSON.stringify({
    success, evidence, timestamp: Date.now(),
    lesson: success
      ? `Goal "${goalText.slice(0, 60)}" completed successfully.`
      : `Goal "${goalText.slice(0, 60)}" failed. Evidence: ${evidence.slice(0, 200)}.`
  });
  await gate.recordSuccess('hermes', goalText, result);
}

async function runGoalOrchestrator() {
  console.log('🤖 [God Agent] Awakening... Initializing Goal-Driven Agency.');
  setStatus('Booting', 'Initializing Goal-Driven Agency...');

  // ── Resource Governor: Initialize CPU/Memory/GPU protection ──
  const governor = ResourceGovernor.getInstance();
  governor.lowerOllamaPriority();
  const bootSnap = await governor.snapshot();
  console.log(`🛡️ [ResourceGovernor] Boot Snapshot: ${ResourceGovernor.formatSnapshot(bootSnap)}`);

  const bestModel = await OllamaManager.selectBestModel(undefined, 'high');
  console.log(`🤖 [God Agent] Selected optimal offline Ollama model (High Tier): ${bestModel}`);
  setStatus('Booting', `Model: ${bestModel}`, bestModel);

  // ── Ruflo Integration: Initialize Persistent Memory ──
  const memory = MemoryBridge.getInstance({
    storagePath: path.join(process.cwd(), '.asclepius'),
    ollamaEndpoint: 'http://localhost:11434',
    embeddingModel: 'nomic-embed-text',
    maxEntries: 5000,
  });
  await memory.initialize();
  const memStats = memory.getStats();
  console.log(`🧠 [MemoryBridge] Initialized — ${memStats.total} memories loaded from disk.`);

  // ── Ruflo Integration: GOAP Planner & Swarm Dispatcher ──
  const goapPlanner = new GOAPPlanner();
  const swarmDispatcher = new SwarmDispatcher();
  console.log(`🎯 [GOAPPlanner] Ready — ${goapPlanner.emptyState() ? 'A* search active' : 'error'}.`);
  console.log(`🐝 [SwarmDispatcher] Ready — parallel execution enabled.`);

  // ── Phase 4: API Arsenal & Knowledge Graph ──
  const apiDiscovery = new APIDiscovery();
  try {
    const apiStats = await apiDiscovery.initialize();
    console.log(`🔌 [APIDiscovery] Arsenal loaded — ${apiStats.totalEntries} APIs across ${apiStats.categories} categories.`);
  } catch (err: any) {
    console.warn(`🔌 [APIDiscovery] Initialization skipped: ${err.message}`);
  }

  const graphKnowledge = new GraphKnowledge();
  const graphReady = await graphKnowledge.initialize();
  if (graphReady) {
    console.log(`🕸️ [GraphKnowledge] Graphify bridge ready — knowledge graph queries enabled.`);
  } else {
    console.warn(`🕸️ [GraphKnowledge] Graphify not available — graph features disabled.`);
  }

  // ── Phase 5: Common Sense Gate & Identity Kernel ──
  const commonSenseGate = new CommonSenseGate();
  commonSenseGate.wire({ memory, apiDiscovery, graphKnowledge });
  console.log(`🧭 [CommonSense] Central driver initialized — 5 rules, ${memory ? '✓' : '✗'} memory, ${apiDiscovery ? '✓' : '✗'} API, ${graphKnowledge ? '✓' : '✗'} graph.`);

  const identityContext = loadIdentityContext();
  if (identityContext) {
    const valueCount = (identityContext.match(/### \d+\./g) || []).length;
    console.log(`🧬 [Soul] Loaded — ${valueCount} values.`);
  } else {
    console.warn(`🧬 [Soul] SOUL.md not found — operating without identity context.`);
  }

  const projectPath = process.cwd();
  
  // ── Ollama-Only Mode ──
  // All intelligence runs on local Ollama models. No cloud APIs.
  // The OllamaManager dynamically selects the best model per complexity tier.
  const omniModelConfig = {
    provider: 'local_ollama' as const,
    modelId: bestModel,
    endpoint: 'http://localhost:11434/api/chat',
    apiKey: 'none',
    fallbackChain: ['local_ollama'] as any[],
    complexity: 'medium' as const
  };

  // The Creator (God Agent)
  const godConfig: AgentConfig = {
    id: 'god-creator',
    name: 'Hermes (The Creator)',
    role: 'God-Agent',
    category: 'brain',
    type: 'local',
    status: 'idle',
    avatarColor: 'bg-yellow-500',
    skills: ['architecture'],
    model: { ...omniModelConfig, complexity: 'high' }
  };
  const godAgent = new GodAgent(godConfig, projectPath, 'main');

  while (true) {
    try {
      let pendingGoal = await readPendingGoal();

      if (!pendingGoal) {
         // ── OODA: Observe → Orient → Decide → Act ──
         // Instead of a hardcoded duty roster, Hermes scans the codebase
         // for REAL problems and either proposes a goal or acts directly.
         setStatus('Observing', 'OODA: Scanning codebase for problems...');
         const observations = await observe(projectPath);

         if (observations.length > 0) {
           // Orient: Sort by severity (high → medium → low)
           const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
           observations.sort((a, b) => (severityOrder[a.severity] || 2) - (severityOrder[b.severity] || 2));
           const topObs = observations[0];

           // Decide: Propose remaining observations as goals for future cycles
           for (const obs of observations.slice(1)) {
             proposeGoal(obs);
           }

           // Act: Convert the top observation into an immediate task
           console.log(`\n🎯 [OODA:Decide] Acting on: [${topObs.severity}] ${topObs.title}`);
           pendingGoal = {
             fullText: '',
             goalText: `[Project: ${process.cwd()}] [OODA:${topObs.type}] ${topObs.title}. Success criteria: ${topObs.successCriteria}. Scope: ${topObs.scope}. Detail: ${topObs.detail}`,
             lineIndex: -1
           };
         } else {
           console.log(`\n✅ [OODA:Observe] Codebase is clean. No problems found. Sleeping...`);
           setStatus('Idle', 'OODA: No problems detected. All clear.');
         }
       }

      if (pendingGoal) {
        // ── Phase 5: Common Sense Evaluation ──
        const goalType = pendingGoal.lineIndex < 0 ? 'duty' : 'goal';
        const csEvaluation = await commonSenseGate.evaluate(pendingGoal.goalText, {
          type: goalType as any,
          projectPath: process.cwd(),
        });

        console.log(CommonSenseGate.formatEvaluation(csEvaluation));

        if (csEvaluation.finalVerdict === 'REJECT') {
          console.log(`🚫 [CommonSense] Goal REJECTED — skipping this cycle.`);
          if (pendingGoal.lineIndex >= 0) {
            markGoalFailed(pendingGoal.fullText, pendingGoal.lineIndex, pendingGoal.file);
          }
          setStatus('Idle', 'Goal rejected by Common Sense Gate');
          await sleep(SLEEP_MS);
          continue;
        }

        if (csEvaluation.finalVerdict === 'SKIP') {
          console.log(`⏭️ [CommonSense] Goal SKIPPED — already completed or stale.`);
          setStatus('Idle', 'Goal skipped by Common Sense Gate');
          await sleep(SLEEP_MS);
          continue;
        }

        // ── Resource Gate: Wait for system to be cool enough before working ──
        const preGoalSnap = await governor.snapshot();
        console.log(`🛡️ [ResourceGovernor] Pre-Goal: ${ResourceGovernor.formatSnapshot(preGoalSnap)}`);
        await governor.waitForCooldown('[God Agent]');

        setStatus('Analyzing', `Goal: ${pendingGoal.goalText}`);
        console.log(`\n======================================================`);
        console.log(`🎯 [God Agent] Discovered New Goal: "${pendingGoal.goalText}"`);
        console.log(`======================================================\n`);

        // ── Inject Identity Context into God Agent ──
        if (identityContext) {
          godAgent.config.model.systemPrompt = `${identityContext}\n\n${godAgent.config.model.systemPrompt || ''}`;
        }

        // Extract Project Path from Goal (e.g., "[Project: F:\012A_Github\mandelbrot] Fix UI")
        let currentProjectPath = process.cwd();
        let actualGoalText = pendingGoal.goalText;
        const projectMatch = pendingGoal.goalText.match(/\[Project:\s*([^\]]+)\]/i);
        if (projectMatch) {
          currentProjectPath = projectMatch[1].trim();
          actualGoalText = pendingGoal.goalText.replace(projectMatch[0], '').trim();
          console.log(`📂 [God Agent] Goal targets external workspace: ${currentProjectPath}`);
        }

        // 1. God Agent determines the team
        console.log(`🤖 [God Agent] Analyzing goal and designing the team...`);
        const availableRoster = await scanAgencyRoster();
        const rosterContext = availableRoster.length > 0 ? `Available Specialized Agency Profiles:\n${availableRoster.join(', ')}\nPick 1-3 profiles from this list that best fit the goal.` : 'No agency profiles found. Create generic ones.';

        const teamPrompt = `Analyze this goal: "${actualGoalText}". 
        CRITICAL CONTEXT: You are modifying a software project located at ${currentProjectPath}.
        
        ${rosterContext}
        
        Return ONLY a JSON array of agent objects with: 
        - name (Agent Name)
        - role (Agent Role)
        - agencyId (The exact folder name from the list above, or null if generic)
        - skills (array of strings from: architecture, frontend, backend, fullstack, devops, qa_testing, code_review, documentation, security, data_engineering)
        - systemPrompt (A brief 1-sentence summary of what they will do).`;
        
        const teamRaw = await godAgent.ask(teamPrompt);
        const jsonMatch = teamRaw.match(/\[[\s\S]*\]/);
        let teamConfigs: any[] = [];
        if (jsonMatch) {
          try {
             teamConfigs = JSON.parse(jsonMatch[0]);
          } catch (e) {
             console.warn(`[God Agent] Failed to parse team json, generating default helper.`);
             teamConfigs = [{ name: 'HelperBot', role: 'Fullstack Dev', skills: ['fullstack'], systemPrompt: 'You are a versatile developer.', agencyId: null }];
          }
        } else {
             teamConfigs = [{ name: 'HelperBot', role: 'Fullstack Dev', skills: ['fullstack'], systemPrompt: 'You are a versatile developer.', agencyId: null }];
        }

        const helpers: DynamicHelperAgent[] = [];
        for (let i = 0; i < teamConfigs.length; i++) {
           const cfg = teamConfigs[i];
           let finalPrompt = cfg.systemPrompt;

           // ── Agency Importer (with Anti-Freeze Truncation) ──
           if (cfg.agencyId && availableRoster.includes(cfg.agencyId)) {
             try {
               const skillPath = `C:\\Users\\likha\\.gemini\\antigravity\\skills\\${cfg.agencyId}\\SKILL.md`;
               const skillData = fs.readFileSync(skillPath, 'utf-8');
               // Truncate to ~4000 characters to prevent Local Ollama CPU/Memory freeze
               const truncatedSkill = skillData.substring(0, 4000);
               finalPrompt = `You are loaded with the ${cfg.agencyId} skill profile.\n\n=== SPECIALIZED SKILL PROFILE ===\n${truncatedSkill}\n\n=== MISSION ===\nYou are modifying the Asclepius orchestrator source code.`;
               console.log(`   → Loaded specialized skill: ${cfg.agencyId}`);
             } catch (err) {
               console.warn(`   → Failed to load skill ${cfg.agencyId}, using default prompt.`);
             }
           }

           console.log(`   → Spawning ${cfg.name} (${cfg.role})`);
           const helper = new DynamicHelperAgent({
             id: `helper-${i}`,
             name: cfg.name,
             role: cfg.role,
             category: 'hand',
             type: 'local',
             status: 'idle',
             avatarColor: 'bg-blue-500',
             skills: cfg.skills || ['fullstack'],
             model: {
               ...omniModelConfig,
               systemPrompt: finalPrompt
             }
           }, currentProjectPath, 'main');
           helpers.push(helper);
        }

        // 2. Spawn COO (Lead Agent)
        setStatus('Planning', 'Athena is decomposing the goal...');
        console.log(`\n👔 [COO] Spawning Lead Agent to decompose task...`);
        const cooConfig: AgentConfig = {
          id: 'coo-lead',
          name: 'Athena (COO)',
          role: 'Lead Architect',
          category: 'brain',
          type: 'local',
          status: 'idle',
          avatarColor: 'bg-purple-500',
          skills: ['orchestration', 'architecture'],
          isLeadAgent: true,
          model: { ...omniModelConfig, complexity: 'high' }
        };
        const coo = new LeadAgent(cooConfig, currentProjectPath, 'main');

        // 3. COO Decomposes Goal (GOAP-First, LLM-Fallback)
        const agentConfigs = helpers.map(h => h.config);
        let tasks: PipelineTask[];

        // Try GOAP A* decomposition first
        const goalState = GOAPPlanner.inferGoalState(actualGoalText);
        const goapActions = goapPlanner.plan(goapPlanner.emptyState(), goalState);

        if (goapActions.length > 0) {
          console.log(`🎯 [GOAPPlanner] A* found plan with ${goapActions.length} actions.`);
          tasks = goapPlanner.toPipelineTasks(goapActions, 'main');
        } else {
          console.log(`🎯 [GOAPPlanner] No plan found — falling back to LLM decomposition.`);
          tasks = await coo.decompose(actualGoalText, agentConfigs);
        }
        
        // 4. COO Assigns Tasks
        LeadAgent.autoAssign(tasks, agentConfigs);

        console.log(`\n👔 [COO] Decomposed goal into ${tasks.length} tasks:`);
        tasks.forEach(t => {
          const assignedName = helpers.find(h => h.config.id === t.assignedAgentId)?.config.name || 'Unassigned';
          console.log(`   - [${t.status}] ${t.goal} (Assigned to: ${assignedName})`);
        });

        // Disk persistence for DAG state
        const dagPath = path.join(process.cwd(), '.asclepius', 'dag-tasks.json');
        const saveDag = () => {
          if (!fs.existsSync(path.dirname(dagPath))) fs.mkdirSync(path.dirname(dagPath), { recursive: true });
          fs.writeFileSync(dagPath, JSON.stringify(tasks, null, 2));
        };
        saveDag();

        // 5. Execution Loop (Removed 10-tick limit)
        let allDone = false;

        while (!allDone) {
          let madeProgress = false;

          for (const task of tasks) {
            if (task.status === 'pending') {
              const helper = helpers.find(h => h.config.id === task.assignedAgentId);
              if (helper) {
                // ── CommonSenseGate: Single-pass context enrichment ──
                try {
                  const taskEval = await commonSenseGate.evaluate(task.goal, {
                    type: 'task',
                    projectPath: currentProjectPath,
                  });
                  if (taskEval.enrichedContext) {
                    task.description = `${task.description || ''}\n${taskEval.enrichedContext}`;
                    console.log(`🧭 [CommonSense] Enriched task with ${taskEval.enrichedContext.length} chars of context.`);
                  }
                } catch (err: any) {
                  console.warn(`🧭 [CommonSense] Task enrichment skipped: ${err.message}`);
                }

                setStatus('Working', `[${helper.config.name}] ${task.goal}`);
                console.log(`\n⚡ [${helper.config.name}] Executing task: "${task.goal}"`);
                task.status = 'working';
                saveDag();
                
                const MAX_RETRIES = 3;
                let attempt = 0;
                let success = false;
                let lastError = '';

                // We keep a pristine copy of the description so we don't corrupt it on retry
                const originalDescription = task.description || '';

                while (attempt < MAX_RETRIES && !success) {
                  try {
                     if (attempt > 0) {
                       setStatus('Self-Healing', `[${helper.config.name}] Retrying task (Attempt ${attempt}/${MAX_RETRIES})`);
                       console.log(`\n🔧 [${helper.config.name}] Self-Healing Attempt ${attempt}...`);
                       // Clean error passing without infinite appending
                       task.description = `[PREVIOUS ATTEMPT FAILED. ERROR: ${lastError}]. Please analyze this error, find a way to fix it, and try a different approach.\n\n${originalDescription}`;
                     }
                     const result = await helper.execute(task);
                     console.log(`✅ [${helper.config.name}] Task complete.`);
                     
                     // ── Inter-task breathing room ──
                     await governor.interTaskCooldown(`[${helper.config.name}]`);
                     
                     // Restore pristine description after success
                     task.description = originalDescription;
                     task.output = result; // DAG Memory Bus
                     task.status = 'completed';
                     task.logs.push(`[${new Date().toISOString()}] Completed successfully on attempt ${attempt + 1}`);
                     success = true;
                     madeProgress = true;

                     // ── Ruflo Integration: Store Success in Memory ──
                     try {
                       await memory.storeTaskResult(helper.config.id, task.goal, result, 'completed');
                     } catch (memErr: any) {
                       console.warn(`🧠 [MemoryBridge] Store failed: ${memErr.message}`);
                     }

                     saveDag();
                  } catch (err: any) {
                     lastError = err.message || JSON.stringify(err);
                     console.error(`❌ [${helper.config.name}] Task failed: ${lastError}`);
                     task.logs.push(`[${new Date().toISOString()}] Failed attempt ${attempt + 1}: ${lastError}`);
                     attempt++;
                  }
                }

                if (!success) {
                  console.error(`🚨 [${helper.config.name}] Task officially failed after ${MAX_RETRIES} retries.`);
                  task.status = 'failed';
                  task.description = originalDescription; // Restore pristine state
                  saveDag();

                  // ── Ruflo Integration: Store Failure in Memory ──
                  try {
                    await memory.storeTaskResult(helper.config.id, task.goal, lastError, 'failed');
                  } catch (memErr: any) {
                    console.warn(`🧠 [MemoryBridge] Failure store failed: ${memErr.message}`);
                  }
                }
              } else {
                console.log(`⚠️ Warning: Task "${task.goal}" has no valid helper assigned. Failing task.`);
                task.status = 'failed';
                task.logs.push(`[${new Date().toISOString()}] Failed: No valid helper assigned.`);
                madeProgress = true;
                saveDag();
              }
            }
          }

          // Tick DAG to unlock dependencies
          LeadAgent.tick({ tasks, status: 'active' } as any, agentConfigs);
          allDone = tasks.every(t => t.status === 'completed' || t.status === 'failed' || t.status === 'cancelled');

          if (!madeProgress && !allDone) {
             console.log(`⚠️ DAG deadlocked or tasks failed. Cancelling remaining blocked tasks.`);
             tasks.filter(t => t.status === 'blocked').forEach(t => {
                 t.status = 'cancelled';
                 t.logs.push(`[${new Date().toISOString()}] Cancelled due to dependency failure or deadlock.`);
             });
             saveDag();
             allDone = true; // Exit loop since we cancelled the rest
          }
        }

        // 6. Complete Goal
        const hasFailed = tasks.some((t: PipelineTask) => t.status === 'failed' || t.status === 'cancelled');
        if (hasFailed) {
          console.log(`\n🚨 [God Agent] Tasks failed permanently. Marking goal as FAILED.`);
          markGoalFailed(pendingGoal.fullText, pendingGoal.lineIndex, pendingGoal.file);
          setStatus('Error', 'Goal failed due to task errors.');
          // OODA: Reflect on failure
          await reflect(commonSenseGate, pendingGoal.goalText, false, 'Tasks failed during execution');
        } else {
          // OODA: Verify — don't trust the agent's word, check with compiler
          const verification = await verify(projectPath, pendingGoal.goalText);

          if (verification.passed) {
            console.log(`\n🎉 [God Agent] All tasks complete and VERIFIED. Goal finished.`);
            markGoalCompleted(pendingGoal.fullText, pendingGoal.lineIndex, pendingGoal.file);
          } else {
            console.log(`\n⚠️ [God Agent] Tasks ran but verification FAILED: ${verification.evidence}`);
            markGoalFailed(pendingGoal.fullText, pendingGoal.lineIndex, pendingGoal.file);
          }

          // OODA: Reflect — record lessons regardless of outcome
          await reflect(commonSenseGate, pendingGoal.goalText, verification.passed, verification.evidence);
        }

      } else {
         setStatus('Sleeping', 'Waiting for new goals...');
      }
    } catch (err: any) {
      console.error(`🤖 [God Agent] Error during cycle: ${err.message}`);
      setStatus('Error', err.message);
    }

    await sleep(SLEEP_MS);
  }
}

runGoalOrchestrator().catch(console.error);

