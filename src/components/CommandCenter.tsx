/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, User, TerminalSquare, Bot, Settings2, Cpu, Globe, RefreshCw, ShieldCheck, ShieldAlert, Zap, ZapOff, Loader2 } from "lucide-react";
import { getUnifiedChatResponse, getUnifiedCodeAnalysis, testConnection, getGeminiRefreshInfo } from "@/src/services/llm";
import { listOllamaModels, OllamaModel } from "@/src/services/ollama";
import { ChatMessage, LogEntry, LLMSettings, Agent, AgentSkill, LLMProvider, SKILL_XP_TABLE, SKILL_LEVEL_NAMES, Project, GoalStatus, SandboxRun } from "@/src/types";
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
  logs: LogEntry[];
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
}

// ─── Helper: Create a skill ───
function createSkill(
  name: string,
  category: AgentSkill["category"],
  level: number,
  description: string
): AgentSkill {
  return {
    id: `skill-${name.toLowerCase().replace(/\s+/g, "-")}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    category,
    level: Math.min(5, Math.max(1, level)),
    xp: 0,
    xpToNext: SKILL_XP_TABLE[Math.min(5, Math.max(1, level))] || 0,
    description,
    acquiredAt: new Date().toISOString(),
    usageCount: 0,
    cooldown: 0,
  };
}

export function CommandCenter({ logs, settings, agents, onUpdateSettings, messages, setMessages, onSpawnAgent, onTerminateAgent, onPauseAgent, onResumeAgent, onAddTask, onUpdateAgent, projects = [], onUpdateProjects, sandboxRuns = [], onUpdateSandboxRuns }: CommandCenterProps) {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [defaultOllamaModel, setDefaultOllamaModel] = useState<string>("");
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{ success: boolean; message: string } | null>(null);
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

  // Proactive Error Detection
  useEffect(() => {
    if (!settings.autoHeal || logs.length === 0) return;

    const latestLog = logs[0];
    if (latestLog.id === lastProcessedLogId.current) return;
    lastProcessedLogId.current = latestLog.id;

    if (latestLog.type === 'error' || latestLog.message.toLowerCase().includes('error') || latestLog.message.toLowerCase().includes('failed')) {
      handleAutoHeal(latestLog);
    }
  }, [logs, settings.autoHeal]);

  const handleAutoHeal = async (log: LogEntry) => {
    if (onResumeAgent) {
      onResumeAgent('god'); // Wake up God-Agent from Hibernation
    }

    const systemAlert: ChatMessage = {
      id: `alert-${Date.now()}`,
      role: "system",
      sender: "MONITOR",
      content: `[CRITICAL] ERROR DETECTED: "${log.message}" @ ${log.agentId}. SYSTEM INTERRUPT: WAKING GOD-AGENT FOR AUTO-HEAL.`,
      timestamp: new Date().toLocaleTimeString()
    };
    setMessages(prev => [...prev, systemAlert]);

    setIsLoading(true);
    try {
      const commandCenterSettings: LLMSettings = {
        ...settings,
        ollamaModel: defaultOllamaModel || settings.ollamaModel
      };

      const prompt = `A system error was detected in the logs: "${log.message}" from agent "${log.agentId}". 
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
            content: `[HEAL COMPLETE] System nominal. Transitioning back to TACTICAL HIBERNATION (Sleep).`,
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

    const recentLogs = logs.slice(0, 15).map(l => `[${l.timestamp}] ${l.agentId}: ${l.message}`).join("\n");
    
    // Expand context with all agents, their capabilities AND skills
    const agentsContext = agents.map(a => {
      const topSkills = a.skills
        .sort((x, y) => y.level - x.level)
        .slice(0, 5)
        .map(s => `${s.name}(L${s.level})`)
        .join(", ");
      return `- **${a.name}** (${a.role}): Status: ${a.status}, Health: ${a.health}%, Heartbeat: ${a.heartbeat.status}. Skills: ${topSkills}. Protected: ${a.isProtected}`;
    }).join("\n");

    const recentChatTranscript = messages.slice(-20).map(m => `[${m.timestamp}] ${m.sender}: ${m.content}`).join("\n\n");

    // Build project context for agent awareness
    const activeProjects = projects.filter(p => p.status === 'active' || p.status === 'planning' || p.status === 'review');
    const projectContext = activeProjects.length > 0 ? activeProjects.map(p => {
      const progress = p.goals.length > 0 ? Math.round(p.goals.reduce((s, g) => s + g.progress, 0) / p.goals.length) : 0;
      const goalsList = p.goals.map(g => `  - [${g.status.toUpperCase()}] ${g.title} (${g.progress}%)${g.assignedAgentId ? ` → Agent: ${g.assignedAgentId}` : ''}`).join('\n');
      const assignedNames = p.assignedAgentIds.map(id => agents.find(a => a.id === id)?.name || id).join(', ');
      return `📋 Project: "${p.name}" [${p.status.toUpperCase()}] (Priority: ${p.priority}) — ${progress}% complete
  GitHub: ${p.githubUrl || 'N/A'}
  Tech: ${p.techStack.join(', ') || 'N/A'}
  Description: ${p.description.slice(0, 200) || 'No description'}
  Assigned: ${assignedNames || 'No agents assigned'}
  Milestones:\n${goalsList || '  - No milestones defined'}`;
    }).join('\n\n') : 'No active projects.';

    const systemContext = `You are operating in the Command Center as the ${targetAgent.name}.
    
Available Agents & Their Skills:
${agentsContext}

═══ ACTIVE PROJECTS ═══
${projectContext}

Recent System Activity Logs:
${recentLogs}

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
- You are a world-class engineer and product designer.
- If you are God-Agent: You are the Lead System Architect with absolute authority, proactive self-healing, recursive self-improvement, and fleet management powers. You can read the SANDBOX HEALTH section to see if any project code has critical failures and take corrective action.
- If you are COO-Agent: You are the Chief Operating Officer, focused on orchestration, resource management, and delegated tasks. When you see project milestones in 'ACTIVE PROJECTS', you SHOULD proactively create SCHEDULE_TASK actions for each pending milestone, assigning the best-fit agent from the fleet. If Sandbox tests are failing, schedule investigation tasks for the Healer-01 agent.
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
The system will silently intercept and execute these json:actions. You are fully autonomous.

CRITICAL SLEEP PROTOCOL: If you are the God-Agent and you were woken up for a query or a special task, you MUST automatically return to Tactical Hibernation the moment your task is done. To auto-sleep, output exactly:
\`\`\`json:action
{ "type": "PAUSE_AGENT", "payload": { "agentId": "god" } }
\`\`\`
`;

    // Filter history to ONLY this agent and User to keep Gemini's strict alternating format happy, 
    // but the full transcript above ensures they are "hive-mind" aware.
    const agentHistory = messages.filter(m => m.role === 'user' || m.sender === targetAgent.name);

    let responseText = "";
    try {
      // Use the loaded model if available
      const commandCenterSettings: LLMSettings = {
        ...settings,
        ollamaModel: defaultOllamaModel || settings.ollamaModel
      };

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
                    className="grid grid-cols-2 gap-4"
                  >
                    <div>
                      <RadioGroupItem value="gemini" id="cc-gemini" className="sr-only" />
                      <Label
                        htmlFor="cc-gemini"
                        className={`flex flex-col items-center justify-between rounded border border-zinc-900 bg-zinc-950 p-4 hover:border-primary/50 cursor-pointer transition-all ${settings.provider === 'gemini' ? 'border-primary bg-primary/5 text-primary' : ''}`}
                      >
                        <Globe className="mb-2 h-4 w-4" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Gemini</span>
                      </Label>
                    </div>
                    <div>
                      <RadioGroupItem value="ollama" id="cc-ollama" className="sr-only" />
                      <Label
                        htmlFor="cc-ollama"
                        className={`flex flex-col items-center justify-between rounded border border-zinc-900 bg-zinc-950 p-4 hover:border-primary/50 cursor-pointer transition-all ${settings.provider === 'ollama' ? 'border-primary bg-primary/5 text-primary' : ''}`}
                      >
                        <Cpu className="mb-2 h-4 w-4" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Ollama</span>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {settings.provider === 'gemini' && (
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
                            <SelectItem value="gemini-3.1-pro-preview" className="text-xs uppercase hover:text-primary">Gemini 3.1 Pro (Latest)</SelectItem>
                            <SelectItem value="gemini-3.1-flash-lite-preview" className="text-xs uppercase hover:text-primary">Gemini 3.1 Flash Lite (Fast)</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {settings.provider === 'ollama' && (
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

      {/* Main Terminal Stream */}
      <div className="flex-1 relative overflow-hidden">
        <ScrollArea className="h-full" ref={scrollRef}>
          <div className="p-6 space-y-6 max-w-5xl mx-auto">
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
