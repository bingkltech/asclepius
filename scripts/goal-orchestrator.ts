import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

import { GodAgent } from '../src/agents/GodAgent';
import { LeadAgent } from '../src/agents/LeadAgent';
import { BaseAgent } from '../src/agents/BaseAgent';
import { OllamaManager } from '../src/tools/OllamaManager';
import { TerminalBridge } from '../src/tools/TerminalBridge';
import type { AgentConfig, PipelineTask, AgentSkill } from '../src/types/pipeline';

const SLEEP_MS = 30 * 1000; // Check every 30 seconds
const GOALS_FILE = path.join(process.cwd(), 'GOALS.md');
const STATUS_FILE = path.join(process.cwd(), '.hermes-status.json');

function setStatus(state: string, details: string = '') {
  fs.writeFileSync(STATUS_FILE, JSON.stringify({ state, details, timestamp: Date.now() }));
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

async function readPendingGoal(): Promise<{ fullText: string; goalText: string; lineIndex: number } | null> {
  if (!fs.existsSync(GOALS_FILE)) return null;
  const content = fs.readFileSync(GOALS_FILE, 'utf-8');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^- \[ \] (.+)/);
    if (match) {
      return { fullText: content, goalText: match[1].trim(), lineIndex: i };
    }
  }
  return null;
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

function markGoalCompleted(fullText: string, lineIndex: number) {
  const lines = fullText.split('\n');
  lines[lineIndex] = lines[lineIndex].replace('- [ ]', '- [x]');
  fs.writeFileSync(GOALS_FILE, lines.join('\n'), 'utf-8');
}

function markGoalFailed(fullText: string, lineIndex: number) {
  const lines = fullText.split('\n');
  lines[lineIndex] = lines[lineIndex].replace('- [ ]', '- [FAILED]');
  fs.writeFileSync(GOALS_FILE, lines.join('\n'), 'utf-8');
}

async function runGoalOrchestrator() {
  console.log('🤖 [God Agent] Awakening... Initializing Goal-Driven Agency.');
  setStatus('Booting', 'Initializing Goal-Driven Agency...');

  const bestModel = await OllamaManager.selectBestModel();
  console.log(`🤖 [God Agent] Selected optimal offline Ollama model: ${bestModel}`);

  const projectPath = process.cwd();
  
  // Omni-Provider configuration using API Vault design
  const omniModelConfig = {
    provider: 'google_gemini' as const,
    modelId: 'gemini-2.5-flash',
    endpoint: 'https://generativelanguage.googleapis.com',
    apiKey: process.env.GEMINI_API_KEY || 'none',
    fallbackChain: ['google_gemini', 'cloud_ollama', 'local_ollama'] as any[]
  };

  // The Creator (God Agent)
  const godConfig: AgentConfig = {
    id: 'god-creator',
    name: 'Hermes (The Creator)',
    role: 'God-Agent',
    category: 'brain',
    type: 'cloud',
    status: 'idle',
    avatarColor: 'bg-yellow-500',
    skills: ['architecture'],
    model: omniModelConfig
  };
  const godAgent = new GodAgent(godConfig, projectPath, 'main');

  while (true) {
    try {
      const pendingGoal = await readPendingGoal();

      if (pendingGoal) {
        setStatus('Analyzing', `Goal: ${pendingGoal.goalText}`);
        console.log(`\n======================================================`);
        console.log(`🎯 [God Agent] Discovered New Goal: "${pendingGoal.goalText}"`);
        console.log(`======================================================\n`);

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
             category: 'seat',
             type: 'cloud',
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
          type: 'cloud',
          status: 'idle',
          avatarColor: 'bg-purple-500',
          skills: ['orchestration', 'architecture'],
          isLeadAgent: true,
          model: omniModelConfig
        };
        const coo = new LeadAgent(cooConfig, currentProjectPath, 'main');

        // 3. COO Decomposes Goal
        const agentConfigs = helpers.map(h => h.config);
        const tasks = await coo.decompose(actualGoalText, agentConfigs);
        
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
                     
                     // Restore pristine description after success
                     task.description = originalDescription;
                     task.output = result; // DAG Memory Bus
                     task.status = 'completed';
                     task.logs.push(`[${new Date().toISOString()}] Completed successfully on attempt ${attempt + 1}`);
                     success = true;
                     madeProgress = true;
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
          console.log(`\n🚨 [God Agent] Tasks failed permanently. Marking goal as FAILED to prevent infinite loop.`);
          markGoalFailed(pendingGoal.fullText, pendingGoal.lineIndex);
          setStatus('Error', 'Goal failed due to task errors.');
        } else {
          console.log(`\n🎉 [God Agent] All tasks complete. Marking goal as finished.`);
          markGoalCompleted(pendingGoal.fullText, pendingGoal.lineIndex);
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
