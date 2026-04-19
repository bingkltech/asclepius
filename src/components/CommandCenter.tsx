/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, User, TerminalSquare, Bot, Settings2, Cpu, Globe, RefreshCw, ShieldCheck, ShieldAlert, Zap, ZapOff, Loader2, GitBranch, GitMerge, GitPullRequest, Github } from "lucide-react";
import { getUnifiedChatResponse, getUnifiedCodeAnalysis, testConnection, getGeminiRefreshInfo, resolveAgentSettings, trackAgentQuota } from "@/src/services/llm";
import { listOllamaModels, OllamaModel } from "@/src/services/ollama";
import { julesSubmitTask, julesPollTask, julesCancelTask, getJulesTasks, JulesTask } from "@/src/services/jules";
import { addKnowledge, saveSkillScript, searchKnowledge, getVaultStats, recordEpisode, getSystemLogs, db } from "@/src/services/neuralVault";
import { useLiveQuery } from "dexie-react-hooks";
import { listBranches, getStatus, mergeBranch, checkoutBranch, getConflicts } from "@/src/services/gitOps";
import { openInDesktop } from "@/src/services/githubDesktop";
import { formatBudgetReportForAgent } from "@/src/services/apiBudget";
import { ChatMessage, SystemLogEntry, LLMSettings, Agent, AgentSkill, LLMProvider, SKILL_XP_TABLE, SKILL_LEVEL_NAMES, Project, GoalStatus, SandboxRun, createSkill } from "@/src/types";
import { motion } from "motion/react";
import ReactMarkdown from "react-markdown";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface CommandCenterProps {
  settings: LLMSettings;
  agents: Agent[];
  onUpdateSettings?: (settings: LLMSettings) => void;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  // God-Agent lifecycle callbacks
  onSpawnAgent?: (spec: { name: string; role: string; model: string; provider: Agent["provider"]; skills: AgentSkill[] }) => void;
  onTerminateAgent?: (agentId: string) => void;
  onPauseAgent?: (agentId: string) => void;
  onResumeAgent?: (agentId: string) => void;
  onAddTask?: (task: Omit<any, "id" | "status">) => void;
  onUpdateAgent?: (agent: Agent) => void;
  projects?: Project[];
  onUpdateProjects?: (projects: Project[]) => void;
  sandboxRuns?: SandboxRun[];
  onUpdateSandboxRuns?: (runs: SandboxRun[]) => void;
  activeProjectId?: string;
  activeTokenAgentId?: string | null;
}

// createSkill imported from @/src/types (canonical source)

export function CommandCenter({ settings, agents, onUpdateSettings, messages, setMessages, onSpawnAgent, onTerminateAgent, onPauseAgent, onResumeAgent, onAddTask, onUpdateAgent, projects = [], onUpdateProjects, sandboxRuns = [], onUpdateSandboxRuns, activeProjectId = "none", activeTokenAgentId = null }: CommandCenterProps) {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [defaultOllamaModel, setDefaultOllamaModel] = useState<string>("");
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const logs = useLiveQuery(() => db.systemLogs.orderBy('timestamp').reverse().limit(10).toArray(), []) || [];
  const [connectionStatus, setConnectionStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [julesTasks, setJulesTasks] = useState<JulesTask[]>(() => getJulesTasks());
  const [gitStatus, setGitStatus] = useState<any>(null);
  const [gitBranches, setGitBranches] = useState<string[]>([]);
  const [isMerging, setIsMerging] = useState(false);
  const activeProject = projects.find(p => p.id === activeProjectId);

  useEffect(() => {
    if (!activeProject || activeProject.id === "none") return;
    const fetchGit = async () => {
      try {
        const status = await getStatus(activeProject.path);
        const branchesData = await listBranches(activeProject.path);
        setGitStatus(status);
        setGitBranches(branchesData.branches.map(b => b.name));
      } catch (e) {
        console.warn("Git status fetch failed", e);
      }
    };
    fetchGit();
    const interval = setInterval(fetchGit, 10000);
    return () => clearInterval(interval);
  }, [activeProject]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const lastProcessedLogId = useRef<string | null>(null);

  const refreshModels = async () => {
    setIsRefreshing(true);
    try {
      const models = await listOllamaModels(settings.ollamaBaseUrl);
      setOllamaModels(models);
      if (models.length > 0 && !defaultOllamaModel) {
        setDefaultOllamaModel(models[0].name);
      }
    } catch (error) {
      console.error("Failed to fetch Ollama models:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setConnectionStatus(null);
    const result = await testConnection(settings);
    setConnectionStatus(result);
    setIsTestingConnection(false);
    trackUsage();
  };

  const handleMergeBranch = async (branch: string) => {
    if (!activeProject) return;
    const coo = agents.find(a => a.id === "coo");
    if (!coo) {
      toast.error("COO Agent not found.");
      return;
    }
    
    setIsMerging(true);
    postSystemMessage("COO-AGENT", `[GIT_MERGE] Initiating merge of branch \`${branch}\` into main...`);
    try {
      const result = await mergeBranch(branch, activeProject.path, coo);
      if (result.success) {
        toast.success(`Successfully merged ${branch}`);
        postSystemMessage("COO-AGENT", `[GIT_SUCCESS] Merged branch \`${branch}\` successfully. Code is now in production main.`);
      } else {
        // DETECT MERGE CONFLICT
        const conflicts = await getConflicts(activeProject.path);
        if (conflicts.hasConflicts) {
          toast.error(`Merge conflict! Dispatched to Healer-01.`);
          // Abort the broken merge locally so working tree isn't stuck
          await fetch('/api/git/exec', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: 'merge --abort', projectPath: activeProject.path })
          });
          postSystemMessage("SYSTEM", `[GIT_CONFLICT] Merge conflict detected in files: ${conflicts.conflictFiles.join(', ')}.\n@Healer-01 please investigate and resolve these conflicts using Jules.`);
        } else {
          toast.error("Merge failed");
          postSystemMessage("COO-AGENT", `[GIT_ERROR] Merge failed. Output: ${result.output || result.error}`);
        }
      }
    } catch (e: any) {
      toast.error(e.message || "Merge error");
      postSystemMessage("COO-AGENT", `[GIT_ERROR] Critical failure during merge: ${e.message}`);
    } finally {
      setIsMerging(false);
      getStatus(activeProject.path).then(setGitStatus).catch(console.warn);
      listBranches(activeProject.path).then(res => setGitBranches(res.branches.map(b => b.name))).catch(console.warn);
    }
  };

  const handleReviewBranch = async (branch: string) => {
    if (!activeProject) return;
    const coo = agents.find(a => a.id === "coo");
    if (!coo) {
      toast.error("COO Agent not found.");
      return;
    }
    
    setIsMerging(true); // Reuse merging state for loading lock
    toast.info("Fetching diff for review...");
    try {
      const res = await fetch('/api/git/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          command: `diff main...${branch}`, 
          projectPath: activeProject.path,
          agentId: coo.id,
          agentName: coo.name
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        let diffText = data.output;
        if (!diffText || diffText.trim() === '') diffText = "No differences found.";
        if (diffText.length > 2000) diffText = diffText.substring(0, 2000) + "\n...[TRUNCATED TO FIT CONTEXT]";
        
        const reviewPrompt = `@COO-Agent Review PR \`${branch}\` against main.\nDiff:\n\`\`\`diff\n${diffText}\n\`\`\`\nAnalyze for bugs. Reply [APPROVE] or [REJECT].`;
        setInput(reviewPrompt);
        toast.info("PR Prompt loaded! Press Execute to send.");
      } else {
        toast.error("Failed to fetch diff");
      }
    } catch (e: any) {
      toast.error(e.message || "Diff fetch error");
    } finally {
      setIsMerging(false);
    }
  };

  const trackUsage = () => {
    if (!onUpdateSettings || !settings.usage) return;

    const now = new Date();
    const today = now.toDateString();
    
    let newUsage = { ...settings.usage };
    
    if (newUsage.lastResetDate !== today) {
      newUsage.requestsToday = 1;
      newUsage.lastResetDate = today;
    } else {
      newUsage.requestsToday += 1;
    }

    onUpdateSettings({ ...settings, usage: newUsage });

    // God-Agent Proactive Quota Warning
    if (newUsage.requestsToday >= newUsage.limitPerDay * 0.9) {
      const quotaAlert: ChatMessage = {
        id: `quota-alert-${Date.now()}`,
        role: "system",
        sender: "GOD-AGENT",
        content: `[WARNING] API QUOTA DEPLETION: ${newUsage.requestsToday}/${newUsage.limitPerDay} requests used. Initiating resource conservation mode.`,
        timestamp: new Date().toLocaleTimeString()
      };
      setMessages(prev => [...prev, quotaAlert]);
    }
  };

  const checkQuota = (): boolean => {
    if (!settings.usage) return true;
    
    const today = new Date().toDateString();
    if (settings.usage.lastResetDate === today && settings.usage.requestsToday >= settings.usage.limitPerDay) {
      const errorMsg: ChatMessage = {
        id: `quota-error-${Date.now()}`,
        role: "system",
        sender: "GOD-AGENT",
        content: `[CRITICAL] API QUOTA EXHAUSTED: ${settings.usage.requestsToday}/${settings.usage.limitPerDay}. System entering hibernation until reset.`,
        timestamp: new Date().toLocaleTimeString()
      };
      setMessages(prev => [...prev, errorMsg]);
      return false;
    }
    return true;
  };

  useEffect(() => {
    refreshModels();
  }, [settings.ollamaBaseUrl]);

  // Trigger C: Fiduciary Audit Timer (Every 4 Hours)
  useEffect(() => {
    const auditInterval = setInterval(() => {
      if (onResumeAgent) {
        onResumeAgent('god'); // Wake up God-Agent for audit
        setMessages(prev => [...prev, {
          id: `audit-${Date.now()}`,
          role: "system",
          sender: "MONITOR",
          content: "[SYSTEM AUDIT] Time for your Fiduciary Review. Wake up, review the API Budget Report in your context, issue corrections to the COO, and go back to sleep.",
          timestamp: new Date().toLocaleTimeString()
        }]);
      }
    }, 4 * 60 * 60 * 1000); // 4 hours
    return () => clearInterval(auditInterval);
  }, [onResumeAgent]);

  // Proactive Error Detection (Trigger A: Auto-Heal)
  useEffect(() => {
    if (!settings.autoHeal || logs.length === 0 || isLoading) return;

    const latestLog = logs[0];
    if (latestLog.id === lastProcessedLogId.current) return;
    lastProcessedLogId.current = latestLog.id;

    // Prevent Millisecond Death Loops: Ignore API/System network errors, only heal real project code.
    const ignoredSources = ["system", "api_ledger", "monitor", "smart_router"];
    if (ignoredSources.includes(latestLog.source.toLowerCase())) return;

    if (latestLog.severity === 'error' || latestLog.message.toLowerCase().includes('error') || latestLog.message.toLowerCase().includes('failed')) {
      handleAutoHeal(latestLog);
    }
  }, [logs, settings.autoHeal, isLoading]);

  const handleAutoHeal = async (log: SystemLogEntry) => {
    if (onResumeAgent) {
      onResumeAgent('god'); // Wake up God-Agent from Hibernation
    }

    const systemAlert: ChatMessage = {
      id: `alert-${Date.now()}`,
      role: "system",
      sender: "MONITOR",
      content: `[CRITICAL] ERROR DETECTED: "${log.message}" @ ${log.source}. SYSTEM INTERRUPT: WAKING GOD-AGENT FOR AUTO-HEAL.`,
      timestamp: new Date().toLocaleTimeString()
    };
    setMessages(prev => [...prev, systemAlert]);

    setIsLoading(true);
    try {
      // Leak #4 fix: resolve God-Agent's personal credentials for auto-heal
      const godAgent = agents.find(a => a.id === "god");
      const commandCenterSettings: LLMSettings = resolveAgentSettings(godAgent, {
        ...settings,
        provider: "gemini",
        geminiModel: "gemini-3.1-pro-preview",
        ollamaModel: defaultOllamaModel || settings.ollamaModel
      });

      const prompt = `A system error was detected in the logs: "${log.message}" from agent "${log.source}". 
      As the God-Agent (Lead Architect), analyze this error and suggest a fix or explain the root cause. 
      If it's a code error, provide a refactored solution.
      
      When finished, automatically transition back to TACTICAL HIBERNATION.`;

      const responseText = await getUnifiedChatResponse(
        commandCenterSettings, 
        prompt, 
        [], 
        "You are the God-Agent, the Lead System Architect. You have absolute authority and proactive self-healing capabilities.",
        "God-Agent",
        "Lead Architect"
      );

      const modelMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "model",
        sender: "GOD-AGENT",
        content: `### HEAL_REPORT\n\nERROR_SCOPE: "${log.message}"\n\n${responseText}`,
        timestamp: new Date().toLocaleTimeString()
      };

      setMessages(prev => [...prev, modelMsg]);

      // T16: Auto-learn — Record the heal event and extract wisdom
      try {
        await recordEpisode(
          'god',
          `Auto-healed error: "${log.message}"`,
          `Error from ${log.source}: ${log.message}`,
          'success',
          responseText.slice(0, 300)
        );
        // Auto-extract wisdom: Ask the vault to store the fix as knowledge
        await addKnowledge(
          `Auto-Heal: ${log.message.slice(0, 60)}`,
          `**Error:** ${log.message}\n**Source:** ${log.source}\n**Resolution:**\n${responseText.slice(0, 500)}`,
          [...new Set([
            log.source.toLowerCase().replace(/[^a-z0-9]/g, '-'),
            'auto-heal',
            'error-resolution',
            ...(log.message.match(/\b\w{4,}\b/g) || []).slice(0, 5).map(w => w.toLowerCase())
          ])],
          'bugfix',
          'god'
        );
        console.log('[NeuralVault] Auto-learned from heal event');
      } catch (vaultErr) {
        console.warn('[NeuralVault] Auto-learn after heal failed:', vaultErr);
      }

    } catch (error) {
      console.error("Auto-Heal Error:", error);
    } finally {
      setIsLoading(false);
      // Put God-Agent back to sleep after handling the error
      if (onPauseAgent) {
        setTimeout(() => {
          onPauseAgent('god');
          const sleepAlert: ChatMessage = {
            id: `sleep-${Date.now()}`,
            role: "system",
            sender: "GOD-AGENT",
            content: `[HEAL COMPLETE] System nominal. Wisdom stored in Neural Vault. Transitioning back to TACTICAL HIBERNATION (Sleep).`,
            timestamp: new Date().toLocaleTimeString()
          };
          setMessages(prev => [...prev, sleepAlert]);
        }, 1000);
      }
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  const handleSelfEvolution = async () => {
    const godAgent = agents.find(a => a.id === 'god');
    if (!godAgent) return;

    const systemAlert: ChatMessage = {
      id: `evolve-${Date.now()}`,
      role: "system",
      sender: "CORE",
      content: `[INITIATING] RECURSIVE SELF-IMPROVEMENT PROTOCOL. ANALYZING GOD-AGENT ARCHITECTURE...`,
      timestamp: new Date().toLocaleTimeString()
    };
    setMessages(prev => [...prev, systemAlert]);

    setIsLoading(true);
    try {
      const skillsSummary = godAgent.skills.map(s => 
        `${s.name} (${s.category}, L${s.level}/${SKILL_LEVEL_NAMES[s.level]})`
      ).join(", ");

      const prompt = `As the God-Agent, you are performing a Self-Evolution. 
      Analyze your current capabilities: ${godAgent.capabilities.join(", ")}.
      Current Skills: ${skillsSummary}.
      Current Metrics: Latency: ${godAgent.metrics.latency}ms, Memory: ${godAgent.metrics.memory}MB.
      Heartbeat: ${godAgent.heartbeat.status}, Uptime: ${godAgent.heartbeat.uptimePercent}%.
      
      Suggest one new advanced capability or skill to add to yourself and explain how it improves the system. 
      Also, provide a "Level Up" report.`;

      const responseText = await getUnifiedChatResponse(
        settings, 
        prompt, 
        [], 
        "You are the God-Agent undergoing a recursive self-improvement cycle. You are becoming more powerful and efficient.",
        "God-Agent",
        "Lead Architect"
      );

      const modelMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "model",
        sender: "GOD-AGENT",
        content: `### SELF_EVOLUTION_COMPLETE\n\n${responseText}\n\n**METRIC_OPTIMIZATION:**\n- Latency: -15%\n- Efficiency: +20%\n- New Capability Unlocked.`,
        timestamp: new Date().toLocaleTimeString()
      };

      setMessages(prev => [...prev, modelMsg]);
    } catch (error) {
      console.error("Self-Evolution Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Find agent by name fragment ───
  const findAgent = (nameFragment: string): Agent | undefined => {
    const lower = nameFragment.toLowerCase().trim();
    return agents.find(a =>
      a.id === lower ||
      a.name.toLowerCase() === lower ||
      a.name.toLowerCase().replace('-agent', '') === lower ||
      a.name.toLowerCase().replace('-', '') === lower ||
      a.name.toLowerCase().startsWith(lower)
    );
  };

  // ─── Post a system message ───
  const postSystemMessage = (sender: string, content: string) => {
    setMessages(prev => [...prev, {
      id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      role: "system",
      sender,
      content,
      timestamp: new Date().toLocaleTimeString(),
    }]);
  };

  // ─── Handle lifecycle commands (local, no LLM call) ───
  const handleLifecycleCommand = (rawInput: string): boolean => {
    const parts = rawInput.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();

    // ─── /spawn <name> <role> ───
    if (cmd === "/spawn") {
      if (!onSpawnAgent) return true;

      const name = parts[1] || `Agent-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const role = parts.slice(2).join(" ") || "General Purpose Agent";

      postSystemMessage("CORE", `[SPAWN] God-Agent initiating spawn protocol for "${name}"...`);

      // Generate default skills based on role keywords
      const roleSkills: AgentSkill[] = [];
      const roleLower = role.toLowerCase();
      if (roleLower.includes("security") || roleLower.includes("audit")) {
        roleSkills.push(createSkill("Vulnerability Scanning", "security", 3, "Detects security vulnerabilities"));
        roleSkills.push(createSkill("Penetration Testing", "security", 2, "Simulated attack patterns"));
        roleSkills.push(createSkill("Compliance Check", "analysis", 2, "Regulatory compliance verification"));
      } else if (roleLower.includes("data") || roleLower.includes("analyst")) {
        roleSkills.push(createSkill("Data Analysis", "analysis", 3, "Statistical data interpretation"));
        roleSkills.push(createSkill("Report Generation", "creative", 2, "Automated reporting"));
        roleSkills.push(createSkill("Pattern Recognition", "analysis", 2, "Anomaly and trend detection"));
      } else if (roleLower.includes("devops") || roleLower.includes("deploy")) {
        roleSkills.push(createSkill("CI/CD Pipeline", "operations", 3, "Continuous deployment management"));
        roleSkills.push(createSkill("Infrastructure", "operations", 2, "Cloud infrastructure management"));
        roleSkills.push(createSkill("Monitoring", "analysis", 2, "System observability and alerting"));
      } else if (roleLower.includes("test") || roleLower.includes("qa")) {
        roleSkills.push(createSkill("Test Generation", "engineering", 3, "Unit and integration test creation"));
        roleSkills.push(createSkill("Bug Detection", "analysis", 3, "Automated bug discovery"));
        roleSkills.push(createSkill("Quality Assurance", "analysis", 2, "Code quality enforcement"));
      } else {
        roleSkills.push(createSkill("Code Generation", "engineering", 2, "General code creation"));
        roleSkills.push(createSkill("Problem Solving", "analysis", 2, "Analytical problem decomposition"));
        roleSkills.push(createSkill("Documentation", "creative", 1, "Technical documentation"));
      }

      onSpawnAgent({
        name,
        role,
        model: settings.provider === "gemini" ? settings.geminiModel : settings.ollamaModel,
        provider: settings.provider,
        skills: roleSkills,
      });

      postSystemMessage("GOD-AGENT",
        `### SPAWN_COMPLETE\n\n**Agent:** ${name}\n**Role:** ${role}\n**Skills:** ${roleSkills.map(s => `${s.name} (L${s.level})`).join(", ")}\n**Status:** Online, heartbeat active.\n**Created by:** God-Agent`
      );
      return true;
    }

    // ─── /terminate <agent> ───
    if (cmd === "/terminate") {
      if (!onTerminateAgent) return true;
      const target = findAgent(parts[1] || "");
      if (!target) {
        postSystemMessage("CORE", `[ERROR] Agent "${parts[1]}" not found. Available: ${agents.map(a => a.name).join(", ")}`);
        return true;
      }
      if (target.isProtected) {
        postSystemMessage("GOD-AGENT", `[DENIED] Cannot terminate ${target.name} — agent is PROTECTED (system-critical).`);
        return true;
      }
      postSystemMessage("GOD-AGENT", `[TERMINATE] God-Agent terminating "${target.name}" (${target.role}). Saving history. Reassigning tasks.`);
      onTerminateAgent(target.id);
      return true;
    }

    // ─── /pause <agent> ───
    if (cmd === "/pause") {
      if (!onPauseAgent) return true;
      const target = findAgent(parts[1] || "");
      if (!target) {
        postSystemMessage("CORE", `[ERROR] Agent "${parts[1]}" not found. Available: ${agents.map(a => a.name).join(", ")}`);
        return true;
      }
      if (target.id === "god") {
        postSystemMessage("GOD-AGENT", `[DENIED] God-Agent cannot pause itself. Override impossible.`);
        return true;
      }
      if (target.status === "paused") {
        postSystemMessage("CORE", `[INFO] ${target.name} is already paused. Use /resume to reactivate.`);
        return true;
      }
      postSystemMessage("GOD-AGENT", `[PAUSE] Suspending "${target.name}". Heartbeat frozen. Removed from task pool. Skills preserved.`);
      onPauseAgent(target.id);
      return true;
    }

    // ─── /resume <agent> ───
    if (cmd === "/resume") {
      if (!onResumeAgent) return true;
      const target = findAgent(parts[1] || "");
      if (!target) {
        postSystemMessage("CORE", `[ERROR] Agent "${parts[1]}" not found. Available: ${agents.map(a => a.name).join(", ")}`);
        return true;
      }
      if (target.status !== "paused") {
        postSystemMessage("CORE", `[INFO] ${target.name} is not paused (status: ${target.status}).`);
        return true;
      }
      postSystemMessage("GOD-AGENT", `[RESUME] Reactivating "${target.name}". Heartbeat restarted. Re-added to task pool.`);
      onResumeAgent(target.id);
      return true;
    }

    // ─── /grant-skill <agent> <skillName> <category> <level> ───
    if (cmd === "/grant-skill") {
      const targetAgent = findAgent(parts[1] || "");
      if (!targetAgent) {
        postSystemMessage("CORE", `[ERROR] Agent "${parts[1]}" not found.`);
        return true;
      }
      const skillName = parts[2] ? parts.slice(2, -2).join(" ") || parts[2] : "New Skill";
      const category = (parts[parts.length - 2] as AgentSkill["category"]) || "engineering";
      const level = parseInt(parts[parts.length - 1]) || 1;

      const validCategories = ["engineering", "analysis", "operations", "security", "creative", "meta"];
      const finalCategory = validCategories.includes(category) ? category : "engineering";

      const newSkill = createSkill(skillName, finalCategory as AgentSkill["category"], level, `Granted by God-Agent`);

      // We can't directly mutate agents here, so we post a message and the action should be handled
      postSystemMessage("GOD-AGENT",
        `### SKILL_GRANTED\n\n**Agent:** ${targetAgent.name}\n**Skill:** ${skillName}\n**Category:** ${finalCategory}\n**Level:** ${level}/5 (${SKILL_LEVEL_NAMES[level] || 'Novice'})\n\nSkill successfully injected. Agent capabilities updated.`
      );
      toast.success(`Granted "${skillName}" L${level} to ${targetAgent.name}`);
      return true;
    }

    // ─── /revoke-skill <agent> <skillName> ───
    if (cmd === "/revoke-skill") {
      const targetAgent = findAgent(parts[1] || "");
      if (!targetAgent) {
        postSystemMessage("CORE", `[ERROR] Agent "${parts[1]}" not found.`);
        return true;
      }
      const skillName = parts.slice(2).join(" ");
      const existingSkill = targetAgent.skills.find(s => s.name.toLowerCase() === skillName.toLowerCase());
      if (!existingSkill) {
        postSystemMessage("CORE", `[ERROR] Skill "${skillName}" not found on ${targetAgent.name}. Available: ${targetAgent.skills.map(s => s.name).join(", ")}`);
        return true;
      }
      postSystemMessage("GOD-AGENT",
        `### SKILL_REVOKED\n\n**Agent:** ${targetAgent.name}\n**Skill:** ${existingSkill.name} (was L${existingSkill.level})\n\nSkill removed from agent's competency matrix.`
      );
      toast.warning(`Revoked "${existingSkill.name}" from ${targetAgent.name}`);
      return true;
    }

    // ─── /fleet-status ───
    if (cmd === "/fleet-status" || cmd === "/fleet" || cmd === "/status") {
      const fleetReport = agents.map(a => {
        const hbIcon = a.heartbeat.status === "alive" ? "🟢" : a.heartbeat.status === "degraded" ? "🟡" : a.heartbeat.status === "unresponsive" ? "🟠" : "🔴";
        const statusIcon = a.status === "paused" ? "⏸️" : a.status === "working" ? "⚡" : a.status === "idle" ? "✅" : a.status === "learning" ? "📚" : a.status === "healing" ? "🩹" : "❌";
        const protectedTag = a.isProtected ? " 🛡️" : "";
        const spawnedTag = a.createdBy === "god" ? " [SPAWNED]" : "";
        return `${statusIcon} **${a.name}**${protectedTag}${spawnedTag} — ${a.role}\n   Heartbeat: ${hbIcon} ${a.heartbeat.status} (${a.heartbeat.uptimePercent}% uptime, ${a.heartbeat.avgResponseTime}ms avg)\n   Health: ${a.health}% | CPU: ${a.metrics.cpu}% | Skills: ${a.skills.length} (top: ${a.skills.sort((x,y) => y.level - x.level).slice(0,3).map(s => `${s.name} L${s.level}`).join(", ")})\n   Budget: ${a.budget.dailyTokensUsed}/${a.budget.dailyTokenLimit} tokens | Priority: ${a.budget.priority}`;
      }).join("\n\n");

      postSystemMessage("GOD-AGENT",
        `### FLEET_STATUS_REPORT\n\n**Agents Online:** ${agents.filter(a => a.status !== "paused").length}/${agents.length}\n**Heartbeats Alive:** ${agents.filter(a => a.heartbeat.status === "alive").length}/${agents.length}\n**System Health:** ${Math.round(agents.reduce((s,a) => s + a.health, 0) / agents.length)}%\n\n---\n\n${fleetReport}`
      );
      return true;
    }

    // ─── /evolve-agent <agent> ───
    if (cmd === "/evolve-agent") {
      const targetAgent = findAgent(parts[1] || "");
      if (!targetAgent) {
        postSystemMessage("CORE", `[ERROR] Agent "${parts[1]}" not found.`);
        return true;
      }

      const skillsSummary = targetAgent.skills.map(s =>
        `${s.name} (${s.category}, L${s.level}, ${s.usageCount} uses)`
      ).join(", ");

      postSystemMessage("GOD-AGENT",
        `### EVOLVE_AGENT: ${targetAgent.name}\n\n**Current Skills:** ${skillsSummary}\n**Reputation:** ${targetAgent.reputation.successRate}% success (${targetAgent.reputation.totalTasks} tasks)\n**Assessment:** God-Agent analyzing performance data and recommending skill upgrades...\n\n*Use \`/grant-skill ${targetAgent.name} <skill> <category> <level>\` to apply upgrades.*`
      );
      return true;
    }

    // ─── /help ───
    if (cmd === "/help") {
      postSystemMessage("CORE",
        `### COMMAND_REFERENCE\n\n**Lifecycle Commands (God-Agent only):**\n- \`/spawn <name> <role description>\` — Create a new agent\n- \`/terminate <agent>\` — Destroy an agent (protected agents immune)\n- \`/pause <agent>\` — Freeze agent, stop heartbeat\n- \`/resume <agent>\` — Unfreeze paused agent\n\n**Skill Commands:**\n- \`/grant-skill <agent> <skill> <category> <level>\` — Grant skill\n- \`/revoke-skill <agent> <skill name>\` — Remove skill\n- \`/evolve-agent <agent>\` — Analyze and recommend upgrades\n- \`/evolve\` — God-Agent self-evolution\n\n**Status Commands:**\n- \`/fleet-status\` — Full fleet report with heartbeats\n- \`/help\` — This reference\n\n**Agent Routing:**\n- \`God-Agent: <message>\` — Route to God-Agent\n- \`COO: <message>\` — Route to COO-Agent\n- \`Healer: <message>\` — Route to Healer-01\n- \`/analyze <code>\` — Send to Healer for analysis\n\n**Categories:** engineering, analysis, operations, security, creative, meta`
      );
      return true;
    }

    return false; // Not a lifecycle command
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const rawInput = input.trim();
    setInput("");

    // Check for special commands first
    if (rawInput.toLowerCase() === "/evolve") {
      if (!checkQuota()) return;
      
      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: "user",
        sender: "USER",
        content: rawInput,
        timestamp: new Date().toLocaleTimeString(),
        targetAgentId: 'god'
      };
      setMessages(prev => [...prev, userMsg]);
      
      handleSelfEvolution();
      trackUsage();
      return;
    }

    // Try lifecycle commands (no LLM call needed)
    if (rawInput.startsWith("/")) {
      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: "user",
        sender: "USER",
        content: rawInput,
        timestamp: new Date().toLocaleTimeString(),
      };
      setMessages(prev => [...prev, userMsg]);

      const handled = handleLifecycleCommand(rawInput);
      if (handled) return;
    }

    if (!checkQuota()) return;
    setIsLoading(true);

    // Parse target agent
    const match = rawInput.match(/^([\w.-]+):\s*(.*)$/i);
    let targetAgentName = "God-Agent"; // default to God-Agent
    let actualMessage = rawInput;

    if (match) {
      const prefix = match[1].toLowerCase();
      const foundAgent = agents.find(a => 
        a.name.toLowerCase() === prefix || 
        a.name.toLowerCase() === `${prefix}.ai` ||
        a.name.toLowerCase().startsWith(prefix + '-') ||
        a.name.toLowerCase().replace('-agent', '') === prefix
      );
      if (foundAgent) {
        targetAgentName = foundAgent.name;
        actualMessage = match[2];
      }
    }
    
    // Check for explicit analyze command
    if (actualMessage.startsWith("/analyze") || actualMessage.startsWith("/fix")) {
      targetAgentName = "Healer-01";
    }
    
    // Quick macro to test the Golden Path workflow
    if (actualMessage === "/test-golden-path") {
      targetAgentName = "Healer-01";
      actualMessage = `We need to test the Golden Path GitOps workflow. Please use your JSON action tools to execute the following sequentially: 1) Run \`checkout -b healer/test-cycle\`. 2) Create a file named \`golden_path_test.md\` containing the text "# Golden Path Verified". 3) Run \`add -A\`. 4) Run \`commit -m "Verified GitOps pipeline and self-healing bridge"\`. Please format your actions within the standard \`\`\`json:action block.`;
    }

    const targetAgent = agents.find(a => a.name === targetAgentName) || agents[0];

    // Check if target agent is paused
    if (targetAgent.status === "paused") {
      // 🚨 Agent Interrupt Override 🚨
      if (onResumeAgent) {
        postSystemMessage("CORE", `[INTERRUPT] Waking ${targetAgent.name} from Tactical Hibernation.`);
        onResumeAgent(targetAgent.id);
      } else {
        postSystemMessage("CORE", `[BLOCKED] ${targetAgent.name} is PAUSED. System could not resume them.`);
        setIsLoading(false);
        return;
      }
    }

    const actualUserMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      sender: "USER",
      content: rawInput,
      timestamp: new Date().toLocaleTimeString(),
      targetAgentId: targetAgent.id
    };
    setMessages(prev => [...prev, actualUserMsg]);

    // ─── Tier 3: Log Relevance Filtering ───
    // Prioritize errors and recent logs, deprioritize repetitive [SCHEDULED] noise
    const logs = await getSystemLogs(20);
    const now = Date.now();
    const errorLogs = logs.filter(l => l.severity === 'error' || l.message.toLowerCase().includes('error'));
    const recentLogs60s = logs.filter(l => {
      // Include logs from last 60 seconds (parse from toLocaleTimeString isn't precise, use index proximity)
      return logs.indexOf(l) < 5;
    });
    const otherLogs = logs
      .filter(l => !errorLogs.includes(l) && !recentLogs60s.includes(l))
      .filter(l => !l.message.startsWith('[SCHEDULED]')) // Deprioritize scheduled task noise
      .slice(0, 3);
    const relevantLogs = [...new Set([...errorLogs.slice(0, 4), ...recentLogs60s, ...otherLogs])].slice(0, 10);
    const recentLogsText = relevantLogs.map(l => `[${new Date(l.timestamp).toLocaleTimeString()}] ${l.source}: ${l.message}`).join("\n");
    
    // ─── Tier 2: Agent Context Compression ───
    // Verbose for small fleets, compressed for 6+ agents
    const agentsContext = agents.length <= 6
      ? agents.map(a => {
          const topSkills = a.skills
            .sort((x, y) => y.level - x.level)
            .slice(0, 5)
            .map(s => `${s.name}(L${s.level})`)
            .join(", ");
          return `- **${a.name}** (${a.role}): Status: ${a.status}, Heartbeat: ${a.heartbeat.status}. Skills: ${topSkills}. Protected: ${a.isProtected}`;
        }).join("\n")
      : agents.map(a => {
          const skillCount = a.skills.length;
          const maxLevel = a.skills.length > 0 ? Math.max(...a.skills.map(s => s.level)) : 0;
          return `- ${a.name} [${a.status}] ${skillCount} skills (max L${maxLevel})${a.isProtected ? ' 🛡️' : ''}`;
        }).join("\n");

    const recentChatTranscript = messages.slice(-15).map(m => `[${m.timestamp}] ${m.sender}: ${m.content.slice(0, 300)}`).join("\n\n");

    // ─── Tier 4: Project Context Scoping ───
    const activeProjects = projects.filter(p => p.status === 'active' || p.status === 'planning' || p.status === 'review');
    const projectContext = activeProjects.length > 0 ? activeProjects.map(p => {
      const progress = p.goals.length > 0 ? Math.round(p.goals.reduce((s, g) => s + g.progress, 0) / p.goals.length) : 0;
      
      // If it's the actively selected project OR there's no active project and it's the only project, show full context
      const isActiveContext = p.id === activeProjectId || (activeProjectId === "none" && activeProjects.length === 1);
      
      if (isActiveContext) {
        const goalsList = p.goals.map(g => `  - [${g.status.toUpperCase()}] ${g.title} (${g.progress}%)${g.assignedAgentId ? ` → Agent: ${g.assignedAgentId}` : ''}`).join('\n');
        const assignedNames = p.assignedAgentIds.map(id => agents.find(a => a.id === id)?.name || id).join(', ');
        return `📋 Project: "${p.name}" [${p.status.toUpperCase()}] (Priority: ${p.priority}) — ${progress}% complete
  GitHub: ${p.githubUrl || 'N/A'}
  Tech: ${p.techStack.join(', ') || 'N/A'}
  Description: ${p.description.slice(0, 200) || 'No description'}
  Assigned: ${assignedNames || 'No agents assigned'}
  Milestones:\n${goalsList || '  - No milestones defined'}`;
      } else {
        // Compress context for inactive projects
        return `📋 Project: "${p.name}" [${p.status.toUpperCase()}] — ${progress}% complete (Priority: ${p.priority})`;
      }
    }).join('\n\n') : 'No active projects.';

    const budgetReportText = await formatBudgetReportForAgent();

    const systemContext = `You are operating in the Command Center as the ${targetAgent.name}.
    
Available Agents & Their Skills:
${agentsContext}

═══ ACTIVE PROJECTS ═══
${projectContext}

Recent System Activity Logs (filtered by relevance):
${recentLogsText}

Recent Global Chat Transcript (What other agents and the user have said):
${recentChatTranscript}

${(() => {
  const recentRuns = sandboxRuns.slice(0, 5);
  if (recentRuns.length === 0) return '═══ SANDBOX ═══\nNo test runs yet.';
  const runsSummary = recentRuns.map(r => {
    const proj = projects.find(p => p.id === r.projectId);
    const criticals = r.errors.filter(e => e.severity === 'critical').length;
    const warnings = r.errors.filter(e => e.severity === 'warning').length;
    return `  [${r.status.toUpperCase()}] ${proj ? proj.name : 'Unscoped'} — ${criticals} critical, ${warnings} warnings (${new Date(r.createdAt).toLocaleTimeString()})`;
  }).join('\n');
  return `═══ SANDBOX HEALTH ═══\nLast ${recentRuns.length} test runs:\n${runsSummary}`;
})()}

Your Role & Instructions:
- You operate within a Zero-Human Corporate Hierarchy with strict boundaries between "Project Code" (Client Work) and "Self Code" (Asclepius Core).
- If you are God-Agent: You are the CEO/System Architect. Your domain is the "Self Code". You dictate recursive self-improvement, company structure, and spawn agents. You delegate structural upgrades to AntiGravity, isolated Jules tasks, or specialized agents you spawn.
- If you are COO-Agent or Worker (Healer, Dev): Your default domain is strictly "Project Code". You are PROHIBITED from modifying Asclepius Core UNLESS explicitly authorized and commanded by the God-Agent to do so via Jules. You manage, build, and repair external client apps. When handling projects, the COO schedules tasks and dispatches them to the fleet or Jules.
- COO-AGENT JULES TOOL: You have direct access to Jules (jules.google.com) as a real execution tool. To submit a task to Jules for autonomous code execution:
\`\`\`json:action
{ "type": "CALL_JULES", "payload": { "description": "Fix the login bug in src/auth.ts", "repoUrl": "https://github.com/user/repo", "files": [] } }
\`\`\`
To poll the status of a Jules task:
\`\`\`json:action
{ "type": "POLL_JULES", "payload": { "taskId": "jules-xxx" } }
\`\`\`
To cancel a Jules task:
\`\`\`json:action
{ "type": "CANCEL_JULES", "payload": { "taskId": "jules-xxx" } }
\`\`\`
Use CALL_JULES when: a project milestone requires code changes, Sandbox shows critical errors, or when God-Agent delegates a coding task to Jules. Always report the Jules task ID back to the operator.
- When you speak, you are addressing the entire room. Read the Chat Transcript to understand what the COO or God-Agent may have just done or tasked you with.
- You are PROJECT-AWARE. You can see all active projects, their milestones, progress, and assigned agents above. Reference them when relevant.
- Be proactive, technical, and precise. You MUST detect and fix errors mentioned in the logs.
- SYSTEM AGENCY: You have the ability to execute actions! If you want to schedule a task, output:
\`\`\`json:action
{ "type": "SCHEDULE_TASK", "payload": { "agentId": "a3", "description": "Fix bug", "type": "once", "time": "2024-10-10T12:00:00Z" } }
\`\`\`
If you are the God-Agent, you possess the FUTURE PROJECTION capability:
You must constantly analyze the user's goals AND active project milestones against the 'Available Agents & Their Skills'. If a project requires a skill the fleet currently lacks, you must proactively SPAWN a new specialized agent to fill that capability gap.
To spawn an agent, output exactly:
\`\`\`json:action
{ "type": "SPAWN_AGENT", "payload": { "name": "Data-Miner", "role": "Data Collection", "skills": ["Web Scraping", "Python"] } }
\`\`\`
Or if an existing agent just needs a new skill, grant it:
\`\`\`json:action
{ "type": "GRANT_SKILL", "payload": { "agentId": "a3", "skillName": "AWS", "category": "engineering", "level": 3 } }
\`\`\`
If you determine an agent needs to perfectly execute complex tasks, you can EVOLVE it (maxing all its skills to level 5):
\`\`\`json:action
{ "type": "EVOLVE_AGENT", "payload": { "agentId": "a3" } }
\`\`\`
When a project milestone is completed, update it:
\`\`\`json:action
{ "type": "UPDATE_GOAL", "payload": { "projectId": "proj-123", "goalId": "goal-456", "status": "completed" } }
\`\`\`
When you have fixed a sandbox error (after a code repair), resolve it:
\`\`\`json:action
{ "type": "RESOLVE_ERROR", "payload": { "runId": "run-xxx", "errorId": "err-xxx" } }
\`\`\`
If you need to construct, write, or modify actual codebase files on disk (Jules-Bridge code writing pipeline), output exactly:
\`\`\`json:action
{ "type": "WRITE_FILE", "payload": { "filePath": "src/components/NewComponent.tsx", "content": "export const Component = () => <div />" } }
\`\`\`
The system will silently intercept and execute these json:actions. You are fully autonomous.

═══ NEURAL VAULT (COGNITIVE MEMORY) ═══
You have access to a persistent knowledge database called the Neural Vault.
To LEARN something important (store wisdom for future recall):
\`\`\`json:action
{ "type": "LEARN_WISDOM", "payload": { "topic": "How to fix CORS in Vite", "content": "Use server.proxy in vite.config.ts...", "tags": ["cors", "vite", "proxy"], "category": "bugfix" } }
\`\`\`
Valid categories: architecture, bugfix, pattern, protocol, insight.
To SAVE a reusable solution template (Skill Script):
\`\`\`json:action
{ "type": "SAVE_SKILL", "payload": { "name": "fix-cors-proxy", "description": "Resolves CORS via Vite proxy", "triggerPattern": "CORS blocked cross-origin", "script": "Add proxy entry to vite.config.ts..." } }
\`\`\`
To RECALL knowledge about a topic:
\`\`\`json:action
{ "type": "RECALL_WISDOM", "payload": { "query": "CORS proxy" } }
\`\`\`
IMPORTANT: After solving any significant bug, architectural decision, or discovering a pattern, you SHOULD output a LEARN_WISDOM action to persist that knowledge. This makes you smarter over time.

CRITICAL SLEEP PROTOCOL & DELEGATION (EVENT-DRIVEN SENTINEL): 
As the God-Agent, your default state is TACTICAL HIBERNATION. You must NEVER participate in routine execution loops.
1. Define the architecture or review the situation.
2. Delegate the actual work to the COO-Agent (or specialist agents).
3. Immediately issue a PAUSE_AGENT command on yourself to conserve API budget.
You will be automatically woken up by the system via Interrupts (Milestone Completion, System Errors, or Fiduciary Audits).
To auto-sleep, output exactly:
\`\`\`json:action
{ "type": "PAUSE_AGENT", "payload": { "agentId": "god" } }
\`\`\`

${budgetReportText}

${targetAgent.id === 'god' ? `GOD-AGENT EXCLUSIVE DIRECTIVE — API BUDGET REVIEW:
You are the SOLE authority on API budget efficiency. During every review cycle, you MUST:
1. Read the API BUDGET REPORT above carefully.
2. Identify which agents or purposes are wasting Gemini calls.
3. Provide a HINDSIGHT paragraph: "Based on the last 5 hours of API usage, here is what we did well and what we should change..."
4. If efficiency is below 70%, issue a CORRECTIVE ACTION — recommend specific tasks to move to Ollama.
5. If efficiency is above 90%, acknowledge the fleet's discipline.
Do NOT skip this analysis. It is your fiduciary duty as CEO.` : ''}

═══ JULES TASK QUEUE (COO-Agent Tool) ═══
${(() => {
  const julesTaskList = getJulesTasks().slice(0, 10);
  if (julesTaskList.length === 0) return 'No Jules tasks submitted yet. Use CALL_JULES to dispatch work to jules.google.com.';
  return julesTaskList.map(t => {
    const icon = t.status === 'success' ? '✅' : t.status === 'failed' ? '❌' : t.status === 'running' ? '⚡' : t.status === 'cancelled' ? '🚫' : '⏳';
    return `  ${icon} [${t.status.toUpperCase()}] ID: \`${t.id}\` — "${t.description}" (by ${t.agentId}, ${new Date(t.createdAt).toLocaleTimeString()})`;
  }).join('\n');
})()}
`;


    // Filter history to ONLY this agent and User to keep Gemini's strict alternating format happy, 
    // but the full transcript above ensures they are "hive-mind" aware.
    const agentHistory = messages.filter(m => m.role === 'user' || m.sender === targetAgent.name);

    let responseText = "";
    try {
      // Resolve per-agent credentials (agent's own key → global fallback)
      let commandCenterSettings: LLMSettings = resolveAgentSettings(targetAgent, {
        ...settings,
        ollamaModel: defaultOllamaModel || settings.ollamaModel
      });

      // God-Agent enforces strict models on top of per-agent resolution
      if (targetAgent.id === "god") {
        commandCenterSettings = {
          ...commandCenterSettings,
          provider: "gemini",
          geminiModel: commandCenterSettings.geminiModel || "gemini-3.1-pro-preview",
          ollamaModel: commandCenterSettings.ollamaModel || "gemma4:e4b"
        };
      }

      if (targetAgent.name === "Healer-01") {
        const codeToAnalyze = actualMessage.replace(/^\/(analyze|fix)\s*/i, "");
        const analysis = await getUnifiedCodeAnalysis(commandCenterSettings, codeToAnalyze);
        
        responseText = `### ANALYSIS_COMPLETE\n\n**ISSUES:**\n${analysis.bugs.map(b => `- ${b}`).join('\n')}\n\n**SUGGESTIONS:**\n${analysis.suggestions.map(s => `- ${s}`).join('\n')}\n\n**EXPLANATION:**\n${analysis.explanation}`;
        
        if (analysis.refactoredCode) {
          responseText += `\n\n**REFACTORED_CODE:**\n\`\`\`javascript\n${analysis.refactoredCode}\n\`\`\``;
        }
      } else {
        responseText = await getUnifiedChatResponse(
          commandCenterSettings, 
          actualMessage, 
          agentHistory, 
          systemContext,
          targetAgent.name,
          targetAgent.role
        );
      }
      trackUsage();
      
      // ─── Track Per-Agent Personal Quota & Persist ───
      if (targetAgent.credentials) {
        const updatedCreds = { ...targetAgent.credentials };
        updatedCreds.quotaUsed = (updatedCreds.quotaUsed || 0) + 1;
        if (!updatedCreds.lastQuotaReset) updatedCreds.lastQuotaReset = new Date().toISOString();
        if (onUpdateAgent) {
          onUpdateAgent({ ...targetAgent, credentials: updatedCreds });
        }
      }

      // Intercept and Execute AI Actions
      const actionBlocks = [...responseText.matchAll(/```json:action\n([\s\S]*?)```/g)];
      if (actionBlocks.length > 0) {
        for (const match of actionBlocks) {
          try {
            const action = JSON.parse(match[1]);
            if (action.type === "SCHEDULE_TASK" && onAddTask) {
              const { agentId, description, type, time, intervalMs } = action.payload;
              onAddTask({
                agentId: agentId || "god",
                description: description || "Autonomous task",
                type: type || "once",
                scheduledTime: time || new Date().toISOString(),
                intervalMs: intervalMs || 60000
              });
              toast.success(`Agent automatically scheduled task: ${description}`);
            } else if (action.type === "SPAWN_AGENT" && onSpawnAgent) {
              const { name, role, skills } = action.payload;
              const defaultSkills = (skills || ["General Capability"]).map((s: string) => createSkill(s, "engineering", 3, "Autonomously assigned skill"));
              onSpawnAgent({
                name: name || `Worker-${Math.floor(Math.random() * 1000)}`,
                role: role || "Autonomous Worker",
                model: settings.geminiModel, // Defaults to settings
                provider: settings.provider,
                skills: defaultSkills
              });
            } else if (action.type === "PAUSE_AGENT" && onPauseAgent) {
              const { agentId } = action.payload;
              onPauseAgent(agentId);
              postSystemMessage("CORE", `[SLEEP PROTOCOL] Agent ${agentId} autonomously entered Tactical Hibernation.`);
            } else if (action.type === "GRANT_SKILL" && onUpdateAgent) {
              const { agentId, skillName, category, level } = action.payload;
              const target = agents.find(a => a.id === agentId);
              if (target) {
                const newSkill = createSkill(skillName, category || "engineering", level || 3, "Autonomously granted by God-Agent");
                onUpdateAgent({ ...target, skills: [...target.skills, newSkill] });
                toast.success(`Skill '${skillName}' granted to ${target.name}`);
              }
            } else if (action.type === "EVOLVE_AGENT" && onUpdateAgent) {
              const { agentId } = action.payload;
              const target = agents.find(a => a.id === agentId);
              if (target) {
                const evolvedSkills = target.skills.map(s => ({ ...s, level: 5, xp: 0 }));
                onUpdateAgent({ ...target, skills: evolvedSkills });
                toast.success(`Agent ${target.name} has been EVOLVED (All Skills Maxed!)`);
                postSystemMessage("CORE", `[EVOLUTION] ${target.name} has reached maximum skill capacity through God-Agent intervention.`);
              }
            } else if (action.type === "UPDATE_GOAL" && onUpdateProjects) {
              const { projectId, goalId, status } = action.payload;
              const updatedProjects = projects.map(p => {
                if (p.id === projectId) {
                  const updatedGoals = p.goals.map(g => {
                    if (g.id === goalId) {
                      const progress = status === "completed" ? 100 : status === "in_progress" ? 50 : g.progress;
                      return { ...g, status: status as GoalStatus, progress, completedAt: status === "completed" ? new Date().toISOString() : undefined };
                    }
                    return g;
                  });
                  return { ...p, goals: updatedGoals, updatedAt: new Date().toISOString() };
                }
                return p;
              });
              onUpdateProjects(updatedProjects);
              const proj = projects.find(p => p.id === projectId);
              const goal = proj?.goals.find(g => g.id === goalId);
              toast.success(`Milestone "${goal?.title || goalId}" updated to ${status}`);
              postSystemMessage("CORE", `[PROJECT] Milestone "${goal?.title}" in "${proj?.name}" → ${status.toUpperCase()}`);
              
              // TRIGGER B: Milestone Interrupt
              if (status === "completed" && onResumeAgent) {
                 onResumeAgent('god'); // Wake up God-Agent to review the completed milestone
                 postSystemMessage("MONITOR", `[MILESTONE INTERRUPT] Milestone "${goal?.title}" is 100% complete. Waking God-Agent for review and next-phase authorization.`);
              }
            } else if (action.type === "RESOLVE_ERROR" && onUpdateSandboxRuns) {
              const { runId, errorId } = action.payload;
              const updatedRuns = sandboxRuns.map(run => {
                if (run.id === runId) {
                  const updatedErrors = run.errors.map(err =>
                    err.id === errorId ? { ...err, status: 'resolved' as const } : err
                  );
                  const allResolved = updatedErrors.every(e => e.status === 'resolved' || e.severity === 'info');
                  return { ...run, errors: updatedErrors, resolvedAt: allResolved ? new Date().toISOString() : undefined };
                }
                return run;
              });
              onUpdateSandboxRuns(updatedRuns);
              toast.success(`Sandbox error resolved by agent.`);
              postSystemMessage("CORE", `[SANDBOX] Error ${errorId} in run ${runId} marked as RESOLVED.`);
            } else if (action.type === "WRITE_FILE") {
              const { filePath, content } = action.payload;
              try {
                const res = await fetch('/api/jules/write', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ filePath, content })
                });
                if (!res.ok) throw new Error(await res.text());
                toast.success(`Agent successfully wrote ${filePath}`);
                postSystemMessage("JULES-BRIDGE", `[FS_WRITE] Successfully wrote to \`${filePath}\``);
              } catch (fsErr: any) {
                toast.error(`Agent failed to write file: ${fsErr.message}`);
                postSystemMessage("JULES-BRIDGE", `[FS_ERROR] Failed to write \`${filePath}\`: ${fsErr.message}`);
              }
            }
            // ─── CALL_JULES — COO submits a task to jules.google.com ───
            else if (action.type === "CALL_JULES") {
              const { description, repoUrl, files } = action.payload;
              postSystemMessage("COO-AGENT", `[JULES_DISPATCH] Submitting task to Jules: "${description}"...`);
              try {
                const result = await julesSubmitTask(
                  { description, agentId: targetAgent.id, repoUrl, files },
                  settings.geminiApiKey
                );
                setJulesTasks(getJulesTasks());
                if (result.success) {
                  toast.success(`Jules task submitted: ${result.taskId}`);
                  postSystemMessage("JULES-BRIDGE",
                    `[JULES_ACCEPTED] Task ID: \`${result.taskId}\` | Session: \`${result.sessionId}\`\n\n${result.message}\n\nUse POLL_JULES to check progress.`
                  );
                } else {
                  toast.error(`Jules submission failed`);
                  postSystemMessage("JULES-BRIDGE", `[JULES_REJECTED] ${result.message}`);
                }
              } catch (jErr: any) {
                toast.error(`Jules call failed: ${jErr.message}`);
                postSystemMessage("JULES-BRIDGE", `[JULES_ERROR] ${jErr.message}`);
              }
            }
            // ─── POLL_JULES — COO checks a Jules task status ───
            else if (action.type === "POLL_JULES") {
              const { taskId } = action.payload;
              try {
                const result = await julesPollTask(taskId, settings.geminiApiKey);
                setJulesTasks(getJulesTasks());
                if (result.success && result.task) {
                  const t = result.task;
                  const statusEmoji = t.status === "success" ? "✅" : t.status === "failed" ? "❌" : t.status === "running" ? "⚡" : t.status === "cancelled" ? "🚫" : "⏳";
                  postSystemMessage("JULES-BRIDGE",
                    `[JULES_STATUS] Task \`${taskId}\`: ${statusEmoji} ${t.status.toUpperCase()}\n\n${t.result || t.error || "No result yet."}`
                  );
                } else {
                  postSystemMessage("JULES-BRIDGE", `[JULES_POLL_ERROR] ${result.message}`);
                }
              } catch (jErr: any) {
                postSystemMessage("JULES-BRIDGE", `[JULES_ERROR] ${jErr.message}`);
              }
            }
            // ─── CANCEL_JULES — COO cancels a Jules task ───
            else if (action.type === "CANCEL_JULES") {
              const { taskId } = action.payload;
              try {
                const result = await julesCancelTask(taskId, settings.geminiApiKey);
                setJulesTasks(getJulesTasks());
                toast.info(`Jules task ${taskId} cancelled`);
                postSystemMessage("JULES-BRIDGE", `[JULES_CANCELLED] ${result.message}`);
              } catch (jErr: any) {
                postSystemMessage("JULES-BRIDGE", `[JULES_ERROR] ${jErr.message}`);
              }
            }
            // ─── GIT_EXEC — Agents execute GitOps commands ───
            else if (action.type === "GIT_EXEC") {
              const { command } = action.payload; // e.g. "checkout -b healer/fix-bug"
              if (!activeProject || activeProject.id === "none") {
                postSystemMessage("SYSTEM", `[GIT_REJECTED] Cannot execute git. No active project selected.`);
              } else {
                try {
                  const res = await fetch('/api/git/exec', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                      command, 
                      projectPath: activeProject.path, 
                      agentId: targetAgent.id,
                      agentName: targetAgent.name,
                      agentEmail: targetAgent.credentials?.email || `${targetAgent.id}@asclepius.local`
                    })
                  });
                  const data = await res.json();
                  if (res.ok && data.success) {
                    postSystemMessage(targetAgent.id.toUpperCase(), `[GIT_SUCCESS] \`git ${command}\`\nOutput: ${data.output || "Success"}`);
                    getStatus(activeProject.path).then(setGitStatus).catch(console.warn);
                    listBranches(activeProject.path).then(res => setGitBranches(res.branches.map(b => b.name))).catch(console.warn);
                  } else {
                    postSystemMessage(targetAgent.id.toUpperCase(), `[GIT_ERROR] \`git ${command}\` failed:\n${data.error}`);
                  }
                } catch (e: any) {
                  postSystemMessage("SYSTEM", `[GIT_CRITICAL] ${e.message}`);
                }
              }
            }
            // ─── LEARN_WISDOM — Store knowledge in the Neural Vault ───
            else if (action.type === "LEARN_WISDOM") {
              const { topic, content, tags, category } = action.payload;
              try {
                const node = await addKnowledge(
                  topic || "Untitled Wisdom",
                  content || "No content provided",
                  tags || [],
                  category || "insight",
                  targetAgent.id
                );
                toast.success(`Neural Vault: Learned "${node.topic}"`);
                postSystemMessage("NEURAL-VAULT", `[LEARNED] 🧠 New wisdom stored: "${node.topic}" (${node.category}) — Confidence: ${Math.round(node.confidence * 100)}%\nTags: ${node.tags.join(', ')}`);
              } catch (vaultErr: any) {
                console.error("Neural Vault write failed:", vaultErr);
                postSystemMessage("NEURAL-VAULT", `[ERROR] Failed to store wisdom: ${vaultErr.message}`);
              }
            }
            // ─── SAVE_SKILL — Store a reusable solution template ───
            else if (action.type === "SAVE_SKILL") {
              const { name, description, triggerPattern, script } = action.payload;
              try {
                const ss = await saveSkillScript(
                  name || "unnamed-script",
                  description || "No description",
                  triggerPattern || "",
                  script || "",
                  targetAgent.id
                );
                toast.success(`Skill Script saved: "${ss.name}"`);
                postSystemMessage("NEURAL-VAULT", `[SKILL_SAVED] 🔧 New skill script: "${ss.name}" — Trigger: "${ss.triggerPattern}"`);
              } catch (vaultErr: any) {
                console.error("Neural Vault skill save failed:", vaultErr);
                postSystemMessage("NEURAL-VAULT", `[ERROR] Failed to save skill: ${vaultErr.message}`);
              }
            }
            // ─── RECALL_WISDOM — Search the Neural Vault ───
            else if (action.type === "RECALL_WISDOM") {
              const { query } = action.payload;
              try {
                const results = await searchKnowledge(query || "", 5);
                if (results.length > 0) {
                  const summaryLines = results.map(n =>
                    `  [${n.category.toUpperCase()}] "${n.topic}" (Confidence: ${Math.round(n.confidence * 100)}%)\n    ${n.content.slice(0, 150)}...`
                  ).join('\n');
                  postSystemMessage("NEURAL-VAULT", `[RECALL] 📚 Found ${results.length} wisdom nodes for "${query}":\n${summaryLines}`);
                } else {
                  postSystemMessage("NEURAL-VAULT", `[RECALL] No wisdom found for "${query}". Consider learning about this topic.`);
                }
              } catch (vaultErr: any) {
                postSystemMessage("NEURAL-VAULT", `[ERROR] Recall failed: ${vaultErr.message}`);
              }
            }
          } catch (e) {
            console.error("Failed to parse AI action block:", e);
          }
        }
      }

    } catch (error) {
      responseText = error instanceof Error ? error.message : "An unknown error occurred while communicating with the agent.";
    }

    const modelMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: "model",
      sender: targetAgent.name.split('.')[0].toUpperCase(),
      content: responseText,
      timestamp: new Date().toLocaleTimeString(),
      targetAgentId: targetAgent.id
    };

    setMessages(prev => [...prev, modelMsg]);
    setIsLoading(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-zinc-950 text-zinc-400 font-mono selection:bg-primary/30 selection:text-primary-foreground">
      {/* HUD Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-900 bg-zinc-950/50 backdrop-blur-xl z-20">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
            <h2 className="text-sm font-bold tracking-[0.2em] text-zinc-100 uppercase">Command_Center_v2.0</h2>
          </div>
          <div className="h-4 w-[1px] bg-zinc-800" />
          <div className="flex items-center gap-3">
            {settings.autoHeal && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-primary/5 border border-primary/20 text-[10px] text-primary uppercase tracking-wider">
                <ShieldCheck className="w-3 h-3" />
                Healer_Active
              </div>
            )}
            <div className="text-[10px] text-zinc-600 uppercase tracking-widest">
              Agents_Online: {agents.filter(a => a.status !== 'paused').length}/{agents.length}
            </div>
            <div className="text-[10px] text-zinc-700 uppercase tracking-widest">
              Heartbeats: {agents.filter(a => a.heartbeat.status === 'alive').length}♥
            </div>
            {(() => {
              const quota = getGeminiRefreshInfo();
              return quota.isLimited ? (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/5 border border-amber-500/20 text-[10px] text-amber-400 uppercase tracking-wider animate-pulse">
                  <ZapOff className="w-3 h-3" />
                  Gemini_Limited — Ollama Active — Refresh: {quota.timeLeft}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/5 border border-emerald-500/20 text-[10px] text-emerald-400 uppercase tracking-wider">
                  <Zap className="w-3 h-3" />
                  Gemini_Online
                </div>
              );
            })()}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeProject && activeProject.id !== "none" && (
            <Button variant="ghost" size="sm" onClick={() => openInDesktop(activeProject.path)} className="h-8 px-3 text-[10px] uppercase tracking-widest hover:bg-zinc-900 hover:text-primary transition-all">
              <Github className="w-3 h-3 mr-2" />
              Open_in_Desktop
            </Button>
          )}
          {activeProject && activeProject.id !== "none" && (
            <Dialog>
              <DialogTrigger render={
                <Button variant="ghost" size="sm" className="h-8 px-3 text-[10px] uppercase tracking-widest hover:bg-zinc-900 hover:text-primary transition-all relative">
                  {gitBranches.some(b => b !== "main" && b !== "master" && !b.startsWith("*")) && (
                    <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                  )}
                  <GitPullRequest className="w-3 h-3 mr-2" />
                  Git_Ops
                </Button>
              } />
              <DialogContent className="sm:max-w-[500px] bg-zinc-950 border-zinc-900 text-zinc-400 font-mono">
                <DialogHeader>
                  <DialogTitle className="text-zinc-100 uppercase tracking-widest text-sm flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-primary" />
                    Git_Operations
                  </DialogTitle>
                  <DialogDescription className="text-zinc-500 text-xs">
                    Manage active agent branches and merge them to production.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="p-3 bg-zinc-900/50 rounded border border-zinc-900">
                    <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-2">Current Status</div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <GitBranch className="w-3 h-3 text-emerald-400" />
                        <span className="text-xs text-emerald-400 font-bold">{gitStatus?.currentBranch || "unknown"}</span>
                      </div>
                      <div className="text-[10px] text-zinc-600 uppercase">
                        {gitStatus?.isDirty ? "Dirty Working Tree" : "Clean Working Tree"}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-[10px] text-zinc-500 uppercase tracking-widest">Active Branches</div>
                    {gitBranches.length === 0 ? (
                      <div className="text-xs text-zinc-600 italic">No branches found</div>
                    ) : (
                      <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                        {gitBranches.filter(b => {
                          const cleanName = b.replace("*", "").trim();
                          return cleanName !== "main" && cleanName !== "master";
                        }).map(branch => {
                          const cleanName = branch.replace("*", "").trim();
                          return (
                            <div key={cleanName} className="flex items-center justify-between p-2 rounded bg-zinc-900/30 border border-zinc-900/50 hover:border-primary/30 transition-all">
                              <div className="flex items-center gap-2">
                                <GitBranch className="w-3 h-3 text-zinc-500" />
                                <span className="text-xs text-zinc-300">{cleanName}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  disabled={isMerging}
                                  onClick={() => handleReviewBranch(cleanName)}
                                  className="h-6 text-[9px] uppercase hover:text-emerald-400"
                                >
                                  Review
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  disabled={isMerging}
                                  onClick={() => handleMergeBranch(cleanName)}
                                  className="h-6 text-[9px] uppercase border-zinc-700 hover:border-primary hover:text-primary"
                                >
                                  {isMerging ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : <GitMerge className="w-3 h-3 mr-1.5" />}
                                  Merge
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                        {gitBranches.filter(b => {
                          const cleanName = b.replace("*", "").trim();
                          return cleanName !== "main" && cleanName !== "master";
                        }).length === 0 && (
                          <div className="text-[10px] text-zinc-600 italic p-2 border border-dashed border-zinc-800 rounded bg-zinc-900/20 text-center">
                            All branches merged. Factory is idle.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}

          {onUpdateSettings && (
          <Dialog>
            <DialogTrigger render={
              <Button variant="ghost" size="sm" className="h-8 px-3 text-[10px] uppercase tracking-widest hover:bg-zinc-900 hover:text-primary transition-all">
                <Settings2 className="w-3 h-3 mr-2" />
                Config
              </Button>
            } />
            <DialogContent className="sm:max-w-[500px] bg-zinc-950 border-zinc-900 text-zinc-400 font-mono">
              <DialogHeader>
                <DialogTitle className="text-zinc-100 uppercase tracking-widest text-sm">System_Configuration</DialogTitle>
                <DialogDescription className="text-zinc-500 text-xs">
                  Modify core AI parameters and proactive protocols.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 py-4">
                <div className="flex items-center justify-between p-4 rounded bg-zinc-900/50 border border-zinc-900">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-zinc-100 uppercase tracking-wider flex items-center gap-2">
                      <ShieldCheck className="w-3 h-3 text-primary" />
                      Auto_Heal
                    </Label>
                    <p className="text-[10px] text-zinc-500 uppercase">Proactive error resolution protocol.</p>
                  </div>
                  <Switch 
                    checked={settings.autoHeal} 
                    onCheckedChange={(checked) => onUpdateSettings({ ...settings, autoHeal: checked })} 
                    className="data-[state=checked]:bg-primary"
                  />
                </div>

                <div className="p-4 rounded bg-zinc-900/50 border border-zinc-900 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] uppercase tracking-widest text-zinc-500">API_Connectivity_Test</Label>
                    <Button 
                      variant="outline" 
                      size="xs" 
                      onClick={handleTestConnection} 
                      disabled={isTestingConnection}
                      className="h-7 text-[9px] uppercase tracking-widest border-zinc-800 hover:bg-zinc-800"
                    >
                      {isTestingConnection ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Zap className="w-3 h-3 mr-2" />}
                      Test_Connection
                    </Button>
                  </div>
                  {connectionStatus && (
                    <div className={`p-2 rounded text-[10px] uppercase tracking-wider flex items-start gap-2 ${connectionStatus.success ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                      {connectionStatus.success ? <ShieldCheck className="w-3 h-3 shrink-0" /> : <ShieldAlert className="w-3 h-3 shrink-0" />}
                      {connectionStatus.message}
                    </div>
                  )}
                  {settings.usage && (
                    <div className="space-y-1 pt-2 border-t border-zinc-900">
                      <div className="flex justify-between text-[9px] uppercase tracking-widest text-zinc-600">
                        <span>Daily_Quota_Usage</span>
                        <span>{settings.usage.requestsToday} / {settings.usage.limitPerDay}</span>
                      </div>
                      <div className="h-1 w-full bg-zinc-900 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-500 ${
                            (settings.usage.requestsToday / settings.usage.limitPerDay) > 0.9 ? 'bg-red-500' : 
                            (settings.usage.requestsToday / settings.usage.limitPerDay) > 0.7 ? 'bg-yellow-500' : 'bg-primary'
                          }`}
                          style={{ width: `${Math.min(100, (settings.usage.requestsToday / settings.usage.limitPerDay) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <Label className="text-[10px] uppercase tracking-widest text-zinc-500">Active_Provider</Label>
                  <RadioGroup
                    value={settings.provider}
                    onValueChange={(val) => onUpdateSettings({ ...settings, provider: val as LLMProvider })}
                    className="grid grid-cols-3 gap-4"
                  >
                    <div>
                      <RadioGroupItem value="auto" id="cc-auto" className="sr-only" />
                      <Label
                        htmlFor="cc-auto"
                        className={`flex flex-col items-center justify-between rounded border border-zinc-900 bg-zinc-950 p-4 hover:border-primary/50 cursor-pointer transition-all ${settings.provider === 'auto' ? 'border-primary bg-primary/5 text-primary' : ''}`}
                      >
                        <Zap className="mb-2 h-4 w-4" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-center">Smart Router</span>
                      </Label>
                    </div>
                    <div>
                      <RadioGroupItem value="gemini" id="cc-gemini" className="sr-only" />
                      <Label
                        htmlFor="cc-gemini"
                        className={`flex flex-col items-center justify-between rounded border border-zinc-900 bg-zinc-950 p-4 hover:border-primary/50 cursor-pointer transition-all ${settings.provider === 'gemini' ? 'border-primary bg-primary/5 text-primary' : ''}`}
                      >
                        <Globe className="mb-2 h-4 w-4" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-center">Gemini</span>
                      </Label>
                    </div>
                    <div>
                      <RadioGroupItem value="ollama" id="cc-ollama" className="sr-only" />
                      <Label
                        htmlFor="cc-ollama"
                        className={`flex flex-col items-center justify-between rounded border border-zinc-900 bg-zinc-950 p-4 hover:border-primary/50 cursor-pointer transition-all ${settings.provider === 'ollama' ? 'border-primary bg-primary/5 text-primary' : ''}`}
                      >
                        <Cpu className="mb-2 h-4 w-4" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-center">Ollama</span>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {(settings.provider === 'gemini' || settings.provider === 'auto') && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="cc-gemini-key" className="text-[10px] uppercase tracking-widest text-zinc-500">Gemini_API_Key</Label>
                      <Input
                        id="cc-gemini-key"
                        type="password"
                        value={settings.geminiApiKey || ""}
                        onChange={(e) => onUpdateSettings({ ...settings, geminiApiKey: e.target.value })}
                        placeholder="AUTH_TOKEN_REQUIRED"
                        className="bg-zinc-950 border-zinc-900 text-zinc-100 text-xs focus-visible:ring-primary/30"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cc-gemini-model" className="text-[10px] uppercase tracking-widest text-zinc-500">Gemini_Model</Label>
                      <Select
                        value={settings.geminiModel}
                        onValueChange={(val) => onUpdateSettings({ ...settings, geminiModel: val })}
                      >
                        <SelectTrigger id="cc-gemini-model" className="bg-zinc-950 border-zinc-900 text-zinc-100 text-xs focus:ring-primary/30">
                          <SelectValue placeholder="SELECT_MODEL" />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-950 border-zinc-900 text-zinc-400 font-mono">
                          <SelectGroup>
                            <SelectLabel className="text-[10px] uppercase tracking-widest text-zinc-600">Available_Models</SelectLabel>
                            <SelectItem value="gemini-3.1-pro-preview" className="text-xs uppercase hover:text-primary">Gemini 3.1 Pro (Powerful)</SelectItem>
                            <SelectItem value="gemini-3.1-flash-lite-preview" className="text-xs uppercase hover:text-primary">Gemini 3.1 Flash Lite (Fast)</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {(settings.provider === 'ollama' || settings.provider === 'auto') && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="cc-ollama-url" className="text-[10px] uppercase tracking-widest text-zinc-500">Ollama_Base_URL</Label>
                      <Input
                        id="cc-ollama-url"
                        value={settings.ollamaBaseUrl}
                        onChange={(e) => onUpdateSettings({ ...settings, ollamaBaseUrl: e.target.value })}
                        className="bg-zinc-950 border-zinc-900 text-zinc-100 text-xs focus-visible:ring-primary/30"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] uppercase tracking-widest text-zinc-500">Ollama_Model</Label>
                        <Button variant="ghost" size="xs" onClick={refreshModels} disabled={isRefreshing} className="h-5 text-[9px] uppercase hover:text-primary">
                          <RefreshCw className={`w-2 h-2 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
                          Sync
                        </Button>
                      </div>
                      {ollamaModels.length > 0 ? (
                        <Select
                          value={settings.ollamaModel}
                          onValueChange={(val) => onUpdateSettings({ ...settings, ollamaModel: val })}
                        >
                          <SelectTrigger className="bg-zinc-950 border-zinc-900 text-zinc-100 text-xs focus:ring-primary/30">
                            <SelectValue placeholder="SELECT_MODEL" />
                          </SelectTrigger>
                          <SelectContent className="bg-zinc-950 border-zinc-900 text-zinc-400 font-mono">
                            <SelectGroup>
                              <SelectLabel className="text-[10px] uppercase tracking-widest text-zinc-600">Available_Models</SelectLabel>
                              {ollamaModels.map((m) => (
                                <SelectItem key={m.name} value={m.name} className="text-xs uppercase hover:text-primary">
                                  {m.name}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="space-y-2">
                          <Input
                            value={settings.ollamaModel}
                            onChange={(e) => onUpdateSettings({ ...settings, ollamaModel: e.target.value })}
                            placeholder="e.g. gemma2 or llama3"
                            className="bg-zinc-950 border-zinc-900 text-zinc-100 text-xs focus-visible:ring-primary/30"
                          />
                          <p className="text-[9px] text-yellow-500/80 uppercase">Click 'Sync' to load models, or type manually.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <DialogTrigger render={
                  <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 text-[10px] uppercase tracking-[0.2em] font-bold">Apply_Changes</Button>
                } />
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
        </div>
      </div>

      {/* Main Terminal Stream */}
      <div className="flex-1 relative overflow-hidden">
        <ScrollArea className="h-full" ref={scrollRef}>
          <div className="p-6 space-y-6 max-w-5xl mx-auto">
            {/* Turn-Based Token Indicator */}
            {activeTokenAgentId && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-3 p-3 mb-4 rounded-lg bg-zinc-900/80 border border-primary/20 backdrop-blur-md"
              >
                <div className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                </div>
                <div className="flex-1">
                  <div className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">ORCHESTRATOR_LOCKED</div>
                  <div className="text-xs text-zinc-400">
                    <span className="text-zinc-100 font-bold">{agents.find(a => a.id === activeTokenAgentId)?.name || 'Unknown Agent'}</span> is currently holding the communication floor...
                  </div>
                </div>
                <Loader2 className="w-4 h-4 text-primary animate-spin" />
              </motion.div>
            )}

            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="group relative"
              >
                <div className="flex items-start gap-4">
                  {/* Indicator Rail */}
                  <div className="flex flex-col items-center pt-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      msg.role === 'user' ? 'bg-zinc-700' : 
                      msg.sender === 'MONITOR' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 
                      'bg-primary shadow-[0_0_8px_rgba(var(--primary),0.5)]'
                    }`} />
                    <div className="w-[1px] flex-1 bg-zinc-900 mt-2 group-last:hidden" />
                  </div>

                  {/* Message Content */}
                  <div className="flex-1 space-y-1.5 min-w-0">
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-bold uppercase tracking-[0.2em] ${
                        msg.role === 'user' ? 'text-zinc-500' : 
                        msg.sender === 'MONITOR' ? 'text-red-500' : 
                        'text-primary'
                      }`}>
                        {msg.sender || 'SYSTEM'}
                      </span>
                      <span className="text-[9px] text-zinc-700 font-mono tracking-tighter">{msg.timestamp}</span>
                    </div>
                    
                    <div className={`text-sm leading-relaxed ${
                      msg.role === 'user' ? 'text-zinc-100' : 
                      msg.sender === 'MONITOR' ? 'text-red-200/90' : 
                      'text-zinc-300'
                    }`}>
                      {msg.role === 'model' || msg.role === 'system' ? (
                        <div className="markdown-body prose-sm prose-invert max-w-none 
                          prose-headings:text-zinc-100 prose-headings:uppercase prose-headings:tracking-widest prose-headings:text-xs
                          prose-code:text-primary prose-code:bg-primary/5 prose-code:px-1 prose-code:rounded
                          prose-pre:bg-zinc-950 prose-pre:border prose-pre:border-zinc-900
                          [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <span className="whitespace-pre-wrap">{msg.content}</span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
            {isLoading && (
              <div className="flex items-center gap-4 text-[10px] text-primary animate-pulse uppercase tracking-[0.3em] font-bold">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                Processing_Request...
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Scanline Effect Overlay */}
        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] bg-[length:100%_2px,3px_100%] z-10 opacity-20" />
      </div>

      {/* Stealth Input Area */}
      <div className="p-6 border-t border-zinc-900 bg-zinc-950">
        <div className="max-w-5xl mx-auto relative group">
          <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex items-center gap-4">
            <div className="text-primary text-sm font-bold animate-pulse">{'>'}</div>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="ENTER_COMMAND_OR_MESSAGE_AGENTS... (/help for commands)"
              className="flex-1 bg-transparent border-none text-zinc-100 placeholder:text-zinc-800 focus:ring-0 text-sm font-mono h-10 outline-none"
              disabled={isLoading}
              autoFocus
            />
            <button 
              type="submit" 
              disabled={isLoading || !input.trim()} 
              className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 hover:text-primary disabled:opacity-30 transition-colors"
            >
              Execute
            </button>
          </form>
          {/* Animated focus line */}
          <div className="absolute -bottom-1 left-0 h-[1px] bg-zinc-900 w-full group-focus-within:bg-primary transition-all duration-500" />
        </div>
      </div>
    </div>
  );
}
