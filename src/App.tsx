/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Sidebar } from "./components/Sidebar";
import { AgentCard } from "./components/AgentCard";
import { LogViewer } from "./components/LogViewer";
import { Sandbox } from "./components/Sandbox";
import { CommandCenter } from "./components/CommandCenter";
import { ProjectsPage } from "./components/ProjectsPage";
import { Settings as SettingsPage } from "./components/Settings";
import {
  Agent,
  AgentSkill,
  AgentHeartbeat,
  LogEntry,
  Project,
  LLMSettings,
  ScheduledTask,
  SandboxRun,
  ChatMessage,
  SKILL_XP_TABLE,
} from "./types";
import { generateAgentAction } from "./services/gemini";
import { TaskScheduler } from "./components/TaskScheduler";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import {
  LayoutDashboard,
  Users,
  Code2,
  Terminal,
  Plus,
  Search,
  Activity,
  CheckCircle2,
  AlertCircle,
  Clock,
  Eye,
  ShieldAlert,
  Crown,
  Zap,
  TrendingUp,
  Cpu,
  Heart,
  FolderGit2,
  Boxes,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "motion/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// ─── Helper: Create a default heartbeat config ───
function createHeartbeat(interval = 10000, maxMissed = 3): AgentHeartbeat {
  return {
    interval,
    lastBeat: new Date().toISOString(),
    missedBeats: 0,
    maxMissed,
    status: "alive",
    avgResponseTime: 0,
    uptimePercent: 100,
    history: [],
  };
}

// ─── Helper: Create a skill ───
function createSkill(
  name: string,
  category: AgentSkill["category"],
  level: number,
  description: string,
  xp = 0
): AgentSkill {
  return {
    id: `skill-${name.toLowerCase().replace(/\s+/g, "-")}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    category,
    level: Math.min(5, Math.max(1, level)),
    xp,
    xpToNext: SKILL_XP_TABLE[Math.min(5, Math.max(1, level))] || 0,
    description,
    acquiredAt: new Date().toISOString(),
    usageCount: 0,
    cooldown: 0,
  };
}

// ─── INITIAL AGENTS with full heartbeat, skills, budget, reputation ───
const INITIAL_AGENTS: Agent[] = [
  {
    id: "god",
    name: "God-Agent",
    role: "Lead Architect & Expert Engineer",
    status: "idle",
    lastAction: "System oversight active. Ready for high-level commands.",
    health: 100,
    capabilities: [
      "Full-Stack Development",
      "UI/UX Design",
      "Code Generation",
      "System Architecture",
      "Proactive Self-Healing",
      "Recursive Self-Improvement",
      "API Quota Management",
    ],
    skills: [
      createSkill("System Architecture", "engineering", 5, "Designs entire system architectures end-to-end", 0),
      createSkill("Self-Healing", "meta", 5, "Autonomous error detection and autonomous repair", 0),
      createSkill("Self-Evolution", "meta", 5, "Recursive capability and skill improvement", 0),
      createSkill("Code Generation", "engineering", 5, "Full-stack code generation in any language", 0),
      createSkill("Agent Orchestration", "operations", 5, "Commands, coordinates, spawns, and terminates agents", 0),
      createSkill("Quota Guardian", "operations", 4, "API quota monitoring, warning, and enforcement"),
      createSkill("UI/UX Design", "creative", 4, "Interface design and user experience optimization"),
      createSkill("Security Audit", "security", 3, "Vulnerability detection and security hardening"),
    ],
    heartbeat: createHeartbeat(5000, 5), // Faster heartbeat, higher tolerance
    budget: { dailyTokenLimit: 500000, dailyTokensUsed: 0, priority: "critical", overage: "allow" },
    reputation: { successRate: 100, totalTasks: 0, failedTasks: 0, trend: "stable" },
    metrics: { cpu: 2, memory: 4096, latency: 5 },
    provider: "gemini",
    model: "gemini-3.1-pro-preview",
    julesConfig: {
      enabled: true,
      endpoint: "wss://jules.google.com/api/v1/sandbox/god",
      status: "connected",
    },
    createdBy: "system",
    isProtected: true,
  },
  {
    id: "coo",
    name: "COO-Agent",
    role: "Chief Operating Officer",
    status: "idle",
    lastAction: "Orchestrating agent workflows",
    health: 100,
    capabilities: [
      "Orchestration",
      "Task Scheduling",
      "Resource Management",
      "System Analysis",
    ],
    skills: [
      createSkill("Task Scheduling", "operations", 4, "Automated task planning and execution"),
      createSkill("Resource Management", "operations", 4, "CPU/Memory/API allocation and optimization"),
      createSkill("Workflow Design", "operations", 3, "Agent pipeline construction and optimization"),
      createSkill("System Monitoring", "analysis", 3, "Health check, metric tracking, and anomaly detection"),
      createSkill("Report Generation", "creative", 2, "Status reports, summaries, and dashboards"),
    ],
    heartbeat: createHeartbeat(10000, 3),
    budget: { dailyTokenLimit: 200000, dailyTokensUsed: 0, priority: "high", overage: "warn" },
    reputation: { successRate: 100, totalTasks: 0, failedTasks: 0, trend: "stable" },
    metrics: { cpu: 5, memory: 2048, latency: 15 },
    provider: "ollama",
    model: "gemma4",
    julesConfig: {
      enabled: true,
      endpoint: "wss://jules.google.com/api/v1/sandbox/coo",
      status: "connected",
    },
    createdBy: "system",
    isProtected: true, // COO is protected — God can pause but not terminate
  },
  {
    id: "a2",
    name: "Jules-Bridge",
    role: "Platform Connector",
    status: "working",
    lastAction: "Syncing with jules.google",
    health: 95,
    capabilities: ["API Integration", "Sandbox Management"],
    skills: [
      createSkill("API Integration", "engineering", 4, "REST/WebSocket API connections and management"),
      createSkill("Sandbox Sync", "operations", 4, "Jules platform synchronization and session management"),
      createSkill("Session Management", "operations", 3, "WebSocket session lifecycle and reconnection"),
      createSkill("Data Serialization", "engineering", 2, "Request/response transformation and validation"),
    ],
    heartbeat: createHeartbeat(10000, 3),
    budget: { dailyTokenLimit: 100000, dailyTokensUsed: 0, priority: "normal", overage: "block" },
    reputation: { successRate: 95, totalTasks: 0, failedTasks: 0, trend: "stable" },
    metrics: { cpu: 45, memory: 512, latency: 120 },
    provider: "gemini",
    model: "gemini-3.1-flash-lite-preview",
    julesConfig: {
      enabled: true,
      endpoint: "wss://jules.google.com/api/v1/sandbox/bridge",
      status: "syncing",
    },
    createdBy: "system",
    isProtected: false,
  },
  {
    id: "a3",
    name: "Healer-01",
    role: "Code Repair Specialist",
    status: "learning",
    lastAction: "Analyzing bug patterns",
    health: 100,
    capabilities: ["Code Analysis", "Refactoring", "Bug Detection"],
    skills: [
      createSkill("Bug Detection", "analysis", 5, "Finds bugs, logic errors, and edge cases in code"),
      createSkill("Code Refactoring", "engineering", 4, "Restructures code for readability, performance, DRY"),
      createSkill("Security Scanning", "security", 4, "Detects vulnerabilities: XSS, injection, auth flaws"),
      createSkill("Performance Analysis", "analysis", 3, "Identifies bottlenecks and optimization opportunities"),
      createSkill("Test Generation", "engineering", 3, "Creates unit, integration, and e2e test suites"),
      createSkill("Documentation", "creative", 2, "Generates code documentation and API references"),
    ],
    heartbeat: createHeartbeat(10000, 3),
    budget: { dailyTokenLimit: 200000, dailyTokensUsed: 0, priority: "high", overage: "warn" },
    reputation: { successRate: 100, totalTasks: 0, failedTasks: 0, trend: "stable" },
    metrics: { cpu: 8, memory: 1024, latency: 30 },
    provider: "gemini",
    model: "gemini-3.1-pro-preview",
    julesConfig: {
      enabled: true,
      endpoint: "wss://jules.google.com/api/v1/sandbox/healer",
      status: "connected",
    },
    createdBy: "system",
    isProtected: false,
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [agents, setAgents] = useState<Agent[]>(() => {
    const saved = localStorage.getItem("asclepius_agents");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return INITIAL_AGENTS;
  });
  const [agentOrder, setAgentOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem("asclepius_agent_order");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return INITIAL_AGENTS.map((a) => a.id);
  });
  const [logs, setLogs] = useState<LogEntry[]>(() => {
    const saved = localStorage.getItem("asclepius_logs");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return [];
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [draggedAgentId, setDraggedAgentId] = useState<string | null>(null);
  const [dragOverAgentId, setDragOverAgentId] = useState<string | null>(null);
  const [llmSettings, setLlmSettings] = useState<LLMSettings>(() => {
    const saved = localStorage.getItem("antigravity_llm_settings");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return {
      provider: "gemini",
      ollamaBaseUrl: "http://localhost:11434",
      ollamaModel: "gemma4:e4b",
      geminiModel: "gemini-3.1-pro-preview",
      autoHeal: true,
      geminiApiKey: process.env.GEMINI_API_KEY || "",
      usage: {
        requestsToday: 0,
        lastResetDate: new Date().toDateString(),
        limitPerDay: 1500,
      },
    };
  });

  useEffect(() => {
    localStorage.setItem("antigravity_llm_settings", JSON.stringify(llmSettings));
  }, [llmSettings]);

  const [commandMessages, setCommandMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem("asclepius_messages");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return [
      {
        id: "init",
        role: "system",
        sender: "CORE",
        content:
          "COMMAND CENTER ONLINE. GOD-AGENT & COO-AGENT STANDING BY. \n\n**PROTOCOLS:**\n- GOD-MODE: `God-Agent: [COMMAND]` (Absolute Authority)\n- OPS-MODE: `COO-Agent: [COMMAND]` (Orchestration)\n- EVOLUTION: `/evolve` (Recursive Self-Improvement)\n- DIAGNOSTIC: `/analyze [CODE]`\n- LIFECYCLE: `/spawn`, `/terminate`, `/pause`, `/resume`\n- SKILLS: `/grant-skill`, `/revoke-skill`, `/evolve-agent`\n\nSYSTEM STATUS: NOMINAL. ALL HEARTBEATS ALIVE.",
        timestamp: new Date().toLocaleTimeString(),
      },
    ];
  });
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTask[]>(() => {
    const saved = localStorage.getItem("asclepius_tasks");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return [];
  });

  // ─── Persistence Sync ───
  useEffect(() => { localStorage.setItem("asclepius_agents", JSON.stringify(agents)); }, [agents]);
  useEffect(() => { localStorage.setItem("asclepius_agent_order", JSON.stringify(agentOrder)); }, [agentOrder]);
  useEffect(() => { localStorage.setItem("asclepius_logs", JSON.stringify(logs.slice(0, 100))); }, [logs]); // Cap log persistence
  useEffect(() => { localStorage.setItem("asclepius_messages", JSON.stringify(commandMessages.slice(-100))); }, [commandMessages]); // Keep last 100
  useEffect(() => { localStorage.setItem("asclepius_tasks", JSON.stringify(scheduledTasks)); }, [scheduledTasks]);

  // ─── Projects State ───
  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem("asclepius_projects");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return [];
  });
  useEffect(() => { localStorage.setItem("asclepius_projects", JSON.stringify(projects)); }, [projects]);

  // ─── Sandbox Runs State ───
  const [sandboxRuns, setSandboxRuns] = useState<SandboxRun[]>(() => {
    const saved = localStorage.getItem("asclepius_sandbox_runs");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return [];
  });
  useEffect(() => { localStorage.setItem("asclepius_sandbox_runs", JSON.stringify(sandboxRuns.slice(0, 50))); }, [sandboxRuns]);

  // ─── God-Agent Boot Sequence & Tactical Hibernation ───
  useEffect(() => {
    // Stage 1: Boot initialization sweep
    const bootTimer = setTimeout(() => {
      setCommandMessages((prev) => [
        ...prev,
        {
          id: `boot-${Date.now()}`,
          role: "system",
          sender: "GOD-AGENT",
          content: "[SYSTEM BOOT] Executing Lookback sweep: Evaluating 3 metrics, all active skills, and node heartbeat status. Core systems nominal.",
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);

      // Stage 2: Delegate to COO & Hibernate God-Agent
      setTimeout(() => {
        setCommandMessages((prev) => [
          ...prev,
          {
            id: `hibernate-${Date.now()}`,
            role: "system",
            sender: "GOD-AGENT",
            content: "[ORCHESTRATION] Master delegation passed to COO-Agent. Transitioning God-Agent to TACTICAL HIBERNATION (Awaiting Interrupts) to conserve resources.",
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);

        setAgents((prev) =>
          prev.map((a) => {
            if (a.id === "god") {
              return { ...a, status: "paused", lastAction: "Tactical Hibernation" };
            }
            if (a.id === "coo" && a.status === "paused") {
              return { ...a, status: "working", lastAction: "Overseeing operations" };
            }
            return a;
          })
        );
      }, 4000); // Hibernate 4 seconds after sweep
    }, 2000); // Initial sweep 2 seconds after load

    // Stage 3: Mandatory 5-Hour Cycle Check-In
    const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;
    const hibernationCycle = setInterval(() => {
      // 1. Wake God-Agent
      setAgents((prev) =>
        prev.map((a) => a.id === "god" ? { ...a, status: "working", lastAction: "Scheduled 5-Hour System Audit" } : a)
      );

      setCommandMessages((prev) => [
        ...prev,
        {
          id: `audit-wake-${Date.now()}`,
          role: "system",
          sender: "GOD-AGENT",
          content: "[MANDATORY WAKE] 5-Hour Hibernation cycle expired. God-Agent executing scheduled systemic Lookback...",
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);

      // 2. Perform mock audit & push back to sleep
      setTimeout(() => {
        setCommandMessages((prev) => [
          ...prev,
          {
            id: `audit-sleep-${Date.now()}`,
            role: "system",
            sender: "GOD-AGENT",
            content: "[AUDIT COMPLETE] No critical anomalies detected in the last 5 hours. God-Agent returning to Tactical Hibernation.",
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
        setAgents((prev) =>
          prev.map((a) => a.id === "god" ? { ...a, status: "paused", lastAction: "Tactical Hibernation" } : a)
        );
      }, 3000); // Audit takes 3 seconds
    }, FIVE_HOURS_MS);

    return () => {
      clearTimeout(bootTimer);
      clearInterval(hibernationCycle);
    };
  }, []);

  // ─── Heartbeat Engine ───
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    heartbeatRef.current = setInterval(() => {
      const now = Date.now();

      setAgents((prev) =>
        prev.map((agent) => {
          // Don't beat paused or terminated agents
          if (agent.status === "paused") return agent;

          const hb = { ...agent.heartbeat };
          const lastBeatTime = new Date(hb.lastBeat).getTime();
          const elapsed = now - lastBeatTime;

          // Simulate a heartbeat response (randomized response time)
          const baseResponse = agent.id === "god" ? 8 : agent.id === "coo" ? 25 : 15 + Math.random() * 40;
          const responseTime = Math.round(baseResponse + Math.random() * 15);
          const isHealthy = Math.random() > 0.02; // 2% chance of a missed beat

          if (isHealthy) {
            // Successful beat
            const entry = {
              timestamp: new Date().toISOString(),
              responseTime,
              healthy: true,
            };
            const newHistory = [...hb.history, entry].slice(-20); // Keep last 20

            // Calculate rolling average
            const avgResp = Math.round(
              newHistory.reduce((s, e) => s + e.responseTime, 0) / newHistory.length
            );

            // Calculate uptime
            const totalBeats = newHistory.length;
            const healthyBeats = newHistory.filter((e) => e.healthy).length;
            const uptime = totalBeats > 0 ? Math.round((healthyBeats / totalBeats) * 1000) / 10 : 100;

            return {
              ...agent,
              heartbeat: {
                ...hb,
                lastBeat: new Date().toISOString(),
                missedBeats: 0,
                status: "alive",
                avgResponseTime: avgResp,
                uptimePercent: uptime,
                history: newHistory,
              },
            };
          } else {
            // Missed beat
            const newMissed = hb.missedBeats + 1;
            let newStatus = hb.status;

            if (newMissed >= hb.maxMissed) {
              newStatus = "dead";
            } else if (newMissed >= 2) {
              newStatus = "unresponsive";
            } else if (newMissed >= 1) {
              newStatus = "degraded";
            }

            const entry = {
              timestamp: new Date().toISOString(),
              responseTime: 0,
              healthy: false,
            };
            const newHistory = [...hb.history, entry].slice(-20);

            const totalBeats = newHistory.length;
            const healthyBeats = newHistory.filter((e) => e.healthy).length;
            const uptime = totalBeats > 0 ? Math.round((healthyBeats / totalBeats) * 1000) / 10 : 100;

            return {
              ...agent,
              heartbeat: {
                ...hb,
                missedBeats: newMissed,
                status: newStatus,
                uptimePercent: uptime,
                history: newHistory,
              },
            };
          }
        })
      );
    }, 3000); // Global heartbeat tick every 3s

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, []);

  // ─── Drag & Drop ───
  const handleDragStart = useCallback(
    (e: React.DragEvent, agentId: string) => {
      setDraggedAgentId(agentId);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", agentId);
    },
    []
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedAgentId(null);
    setDragOverAgentId(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetId: string) => {
      e.preventDefault();
      const sourceId = e.dataTransfer.getData("text/plain");
      if (sourceId === targetId) return;

      setAgentOrder((prev) => {
        const newOrder = [...prev];
        const sourceIdx = newOrder.indexOf(sourceId);
        const targetIdx = newOrder.indexOf(targetId);
        if (sourceIdx === -1 || targetIdx === -1) return prev;
        newOrder.splice(sourceIdx, 1);
        newOrder.splice(targetIdx, 0, sourceId);
        return newOrder;
      });

      setDraggedAgentId(null);
      setDragOverAgentId(null);
    },
    []
  );

  const handleDragEnter = useCallback(
    (agentId: string) => {
      if (draggedAgentId && agentId !== draggedAgentId) {
        setDragOverAgentId(agentId);
      }
    },
    [draggedAgentId]
  );

  // Get ordered agents
  const orderedAgents = agentOrder
    .map((id) => agents.find((a) => a.id === id))
    .filter(Boolean) as Agent[];

  // Filter agents by search
  const filteredAgents = searchQuery
    ? orderedAgents.filter(
        (a) =>
          a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          a.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
          a.capabilities.some((c) =>
            c.toLowerCase().includes(searchQuery.toLowerCase())
          ) ||
          a.skills.some((s) =>
            s.name.toLowerCase().includes(searchQuery.toLowerCase())
          )
      )
    : orderedAgents;

  // Task Scheduler Logic
  useEffect(() => {
    const interval = setInterval(async () => {
      const now = new Date();

      for (const task of scheduledTasks) {
        if (task.status !== "active") continue;

        let shouldRun = false;
        if (task.type === "interval") {
          const lastRunTime = task.lastRun
            ? new Date(task.lastRun).getTime()
            : 0;
          if (now.getTime() - lastRunTime >= (task.intervalMs || 60000)) {
            shouldRun = true;
          }
        } else if (task.type === "once") {
          const scheduledTime = new Date(task.scheduledTime!).getTime();
          if (now.getTime() >= scheduledTime && !task.lastRun) {
            shouldRun = true;
          }
        }

        if (shouldRun) {
          const agent = agents.find((a) => a.id === task.agentId);
          if (agent) {
            const action = await generateAgentAction(
              agent.name,
              `Scheduled Task: ${task.description}`
            );

            const newLog: LogEntry = {
              id: Math.random().toString(36).substr(2, 9),
              timestamp: new Date().toLocaleTimeString(),
              agentId: agent.name,
              message: `[SCHEDULED] ${action}`,
              type: "info",
            };

            setLogs((prev) => [newLog, ...prev].slice(0, 50));

            setScheduledTasks((prev) =>
              prev.map((t) =>
                t.id === task.id
                  ? {
                      ...t,
                      lastRun: now.toISOString(),
                      status: t.type === "once" ? "completed" : "active",
                    }
                  : t
              )
            );

            // Auto-resolve sandbox errors when [SANDBOX] fix tasks complete
            if (task.type === "once" && task.description.startsWith("[SANDBOX]")) {
              setSandboxRuns((prevRuns) =>
                prevRuns.map((run) => ({
                  ...run,
                  errors: run.errors.map((err) => {
                    if (
                      err.status === "open" &&
                      task.description.includes(err.message.slice(0, 40))
                    ) {
                      return { ...err, status: "resolved" as const };
                    }
                    return err;
                  }),
                }))
              );
            }

            toast.info(`Scheduled Task: ${agent.name} - ${task.description}`);
          }
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [scheduledTasks, agents]);

  const handleAddTask = (taskData: Omit<ScheduledTask, "id" | "status">) => {
    const newTask: ScheduledTask = {
      ...taskData,
      id: Math.random().toString(36).substr(2, 9),
      status: "active",
    };
    setScheduledTasks((prev) => [...prev, newTask]);
  };

  const handleDeleteTask = (id: string) => {
    setScheduledTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleToggleTask = (id: string) => {
    setScheduledTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, status: t.status === "active" ? "paused" : "active" }
          : t
      )
    );
  };

  // ─── Post system message to Command Center ───
  const postSystemMessage = useCallback((sender: string, content: string) => {
    setCommandMessages((prev) => [
      ...prev,
      {
        id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        role: "system" as const,
        sender,
        content,
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);
  }, []);

  const handleUpdateAgent = (updatedAgent: Agent) => {
    setAgents((prev) =>
      prev.map((a) => (a.id === updatedAgent.id ? updatedAgent : a))
    );
  };

  // ─── God-Agent: Spawn a new agent ───
  const handleSpawnAgent = useCallback(
    (spec: {
      name: string;
      role: string;
      model: string;
      provider: Agent["provider"];
      skills: AgentSkill[];
    }) => {
      const newId = `spawned-${Math.random().toString(36).slice(2, 8)}`;
      const newAgent: Agent = {
        id: newId,
        name: spec.name,
        role: spec.role,
        status: "idle",
        lastAction: `Spawned by God-Agent. Initializing...`,
        health: 100,
        capabilities: spec.skills.map((s) => s.name),
        skills: spec.skills,
        heartbeat: createHeartbeat(10000, 3),
        budget: {
          dailyTokenLimit: 50000,
          dailyTokensUsed: 0,
          priority: "low",
          overage: "block",
        },
        reputation: { successRate: 100, totalTasks: 0, failedTasks: 0, trend: "stable" },
        metrics: { cpu: 5, memory: 512, latency: 50 },
        provider: spec.provider || "gemini",
        model: spec.model,
        julesConfig: {
          enabled: true,
          endpoint: `wss://jules.google.com/api/v1/sandbox/${newId}`,
          status: "connected",
        },
        createdBy: "god",
        isProtected: false,
      };

      setAgents((prev) => [...prev, newAgent]);
      setAgentOrder((prev) => [...prev, newId]);

      const newLog: LogEntry = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toLocaleTimeString(),
        agentId: "God-Agent",
        message: `[SPAWN] Created agent "${spec.name}" (${spec.role}) with ${spec.skills.length} skills`,
        type: "success",
      };
      setLogs((prev) => [newLog, ...prev].slice(0, 50));
      toast.success(`God-Agent spawned: ${spec.name}`);
    },
    []
  );

  // ─── God-Agent: Terminate an agent ───
  const handleTerminateAgent = useCallback(
    (agentId: string) => {
      const target = agents.find((a) => a.id === agentId);
      if (!target) return;
      if (target.isProtected) {
        toast.error(`Cannot terminate ${target.name} — agent is protected.`);
        return;
      }

      setAgents((prev) => prev.filter((a) => a.id !== agentId));
      setAgentOrder((prev) => prev.filter((id) => id !== agentId));

      const newLog: LogEntry = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toLocaleTimeString(),
        agentId: "God-Agent",
        message: `[TERMINATE] Agent "${target.name}" terminated. Reason: No longer needed.`,
        type: "warning",
      };
      setLogs((prev) => [newLog, ...prev].slice(0, 50));
      toast.warning(`God-Agent terminated: ${target.name}`);
    },
    [agents]
  );

  // ─── God-Agent: Pause/Resume an agent ───
  const handlePauseAgent = useCallback(
    (agentId: string) => {
      setAgents((prev) =>
        prev.map((a) => (a.id === agentId ? { ...a, status: "paused" as const } : a))
      );
      const target = agents.find((a) => a.id === agentId);
      toast.info(`God-Agent paused: ${target?.name}`);
    },
    [agents]
  );

  const handleResumeAgent = useCallback(
    (agentId: string) => {
      setAgents((prev) =>
        prev.map((a) =>
          a.id === agentId
            ? { ...a, status: "idle" as const, heartbeat: { ...a.heartbeat, missedBeats: 0, status: "alive" as const } }
            : a
        )
      );
      const target = agents.find((a) => a.id === agentId);
      toast.success(`God-Agent resumed: ${target?.name}`);
    },
    [agents]
  );

  // Simulate agent activity
  useEffect(() => {
    const interval = setInterval(async () => {
      const activeAgents = agents.filter((a) => a.status !== "paused");
      if (activeAgents.length === 0) return;

      const randomAgent =
        activeAgents[Math.floor(Math.random() * activeAgents.length)];

      const statuses: Agent["status"][] = ["idle", "working", "learning"];
      const newStatus =
        statuses[Math.floor(Math.random() * statuses.length)];

      const action = await generateAgentAction(
        randomAgent.name,
        `Agent is currently ${newStatus}.`
      );

      const newLog: LogEntry = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toLocaleTimeString(),
        agentId: randomAgent.name,
        message: action,
        type: newStatus === "working" ? "info" : "success",
      };

      setLogs((prev) => [newLog, ...prev].slice(0, 50));

      setAgents((prev) =>
        prev.map((a) => {
          if (a.status === "paused") return a; // Don't touch paused agents

          const newCpu = Math.max(1, Math.min(100, a.metrics.cpu + (Math.random() * 10 - 5)));
          const newMem = Math.max(100, Math.min(4096, a.metrics.memory + (Math.random() * 50 - 25)));
          const newLat = Math.max(5, Math.min(500, a.metrics.latency + (Math.random() * 20 - 10)));

          if (a.id === randomAgent.id) {
            return {
              ...a,
              status: newStatus,
              lastAction: action,
              metrics: {
                cpu: Math.round(newCpu),
                memory: Math.round(newMem),
                latency: Math.round(newLat),
              },
            };
          }
          return {
            ...a,
            metrics: {
              cpu: Math.round(newCpu),
              memory: Math.round(newMem),
              latency: Math.round(newLat),
            },
          };
        })
      );

      if (Math.random() > 0.9) {
        toast.info(`${randomAgent.name}: ${action}`);
      }
    }, 8000);

    return () => clearInterval(interval);
  }, [agents]);

  // Stat cards data
  const activeAgentsCount = agents.filter((a) => a.status === "working").length;
  const avgHealth = Math.round(
    agents.reduce((sum, a) => sum + a.health, 0) / agents.length
  );
  const avgLatency = Math.round(
    agents.reduce((sum, a) => sum + a.metrics.latency, 0) / agents.length
  );
  const aliveHeartbeats = agents.filter((a) => a.heartbeat.status === "alive").length;

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return (
          <div className="space-y-6">
            {/* Page Title */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h1 className="text-2xl font-bold tracking-tight">
                  System Overview
                </h1>
                <p className="text-sm text-muted-foreground/70">
                  Real-time status of your autonomous agent network.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative w-56">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground/40" />
                  <Input
                    type="search"
                    placeholder="Search agents / skills..."
                    className="pl-8 h-9 bg-secondary/30 border-border/50 text-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button
                  size="sm"
                  className="h-9 bg-primary/90 hover:bg-primary shadow-lg shadow-primary/20"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Deploy Agent
                </Button>
              </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                {
                  label: "Active Agents",
                  value: agents.length.toString(),
                  sub: `${activeAgentsCount} working`,
                  subColor: "text-emerald-400",
                  icon: Users,
                  gradient: "from-violet-500/10 to-violet-500/0",
                  iconColor: "text-violet-400",
                },
                {
                  label: "Tasks Completed",
                  value: agents.reduce((s, a) => s + a.reputation.totalTasks, 0).toString(),
                  sub: "+12% from last hour",
                  subColor: "text-emerald-400",
                  icon: CheckCircle2,
                  gradient: "from-emerald-500/10 to-emerald-500/0",
                  iconColor: "text-emerald-400",
                },
                {
                  label: "System Health",
                  value: `${avgHealth}%`,
                  sub: "All systems nominal",
                  subColor: "text-emerald-400",
                  icon: Activity,
                  gradient: "from-sky-500/10 to-sky-500/0",
                  iconColor: "text-sky-400",
                  hasBar: true,
                  barValue: avgHealth,
                },
                {
                  label: "Heartbeats",
                  value: `${aliveHeartbeats}/${agents.length}`,
                  sub: aliveHeartbeats === agents.length ? "All agents alive" : `${agents.length - aliveHeartbeats} degraded`,
                  subColor: aliveHeartbeats === agents.length ? "text-emerald-400" : "text-amber-400",
                  icon: Heart,
                  gradient: "from-rose-500/10 to-rose-500/0",
                  iconColor: "text-rose-400",
                },
                {
                  label: "Avg Latency",
                  value: `${avgLatency}ms`,
                  sub: "Across all agents",
                  subColor: "text-muted-foreground/50",
                  icon: Zap,
                  gradient: "from-amber-500/10 to-amber-500/0",
                  iconColor: "text-amber-400",
                },
                {
                  label: "Projects",
                  value: projects.filter(p => p.status === 'active' || p.status === 'planning').length.toString(),
                  sub: `${projects.filter(p => p.status === 'completed').length} completed`,
                  subColor: "text-emerald-400",
                  icon: FolderGit2,
                  gradient: "from-violet-500/10 to-violet-500/0",
                  iconColor: "text-violet-400",
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className={cn(
                    "stat-card gradient-border rounded-xl bg-card/80 p-4",
                    `bg-gradient-to-br ${stat.gradient}`
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/50">
                      {stat.label}
                    </span>
                    <stat.icon className={cn("w-4 h-4", stat.iconColor)} />
                  </div>
                  <div className="text-2xl font-bold tracking-tight">
                    {stat.value}
                  </div>
                  {stat.hasBar && (
                    <div className="h-1 w-full bg-secondary/40 rounded-full mt-2 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-1000"
                        style={{ width: `${stat.barValue}%` }}
                      />
                    </div>
                  )}
                  <p className={cn("text-[10px] mt-1.5 flex items-center gap-1", stat.subColor)}>
                    {stat.sub}
                  </p>
                </div>
              ))}
            </div>

            {/* Active Projects Strip */}
            {projects.filter(p => p.status === 'active' || p.status === 'planning').length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FolderGit2 className="w-4 h-4 text-violet-400" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Active Projects</span>
                  </div>
                  <button onClick={() => setActiveTab("projects")} className="text-[10px] text-sky-400 hover:text-sky-300 transition-colors uppercase tracking-wider">
                    View All →
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {projects.filter(p => p.status === 'active' || p.status === 'planning').slice(0, 4).map(p => {
                    const prog = p.goals.length > 0 ? Math.round(p.goals.reduce((s, g) => s + g.progress, 0) / p.goals.length) : 0;
                    const doneGoals = p.goals.filter(g => g.status === "completed").length;
                    // Sandbox health for this project
                    const projRuns = sandboxRuns.filter(r => r.projectId === p.id);
                    const lastRun = projRuns[0];
                    const activeErrors = lastRun ? lastRun.errors.filter(e => e.status === "open" && e.severity !== "info").length : 0;
                    const hasRuns = projRuns.length > 0;
                    return (
                      <div
                        key={p.id}
                        className="gradient-border rounded-xl bg-card/80 p-4 space-y-3 cursor-pointer hover:bg-card/90 transition-all"
                        onClick={() => setActiveTab("projects")}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <FolderGit2 className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                            <span className="text-xs font-semibold truncate">{p.name}</span>
                          </div>
                          {hasRuns && (
                            <div className={cn("flex items-center gap-1 text-[8px] font-semibold shrink-0", activeErrors > 0 ? "text-rose-400" : "text-emerald-400")}>
                              {activeErrors > 0 ? <XCircle className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
                              {activeErrors > 0 ? `${activeErrors}` : "✓"}
                            </div>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[8px] uppercase tracking-widest text-muted-foreground/40">
                            <span>{doneGoals}/{p.goals.length} milestones</span>
                            <span className="text-foreground/60">{prog}%</span>
                          </div>
                          <div className="h-1 w-full bg-secondary/40 rounded-full overflow-hidden">
                            <div
                              className={cn("h-full rounded-full transition-all duration-700", prog === 100 ? "bg-emerald-400" : "bg-gradient-to-r from-violet-500 to-sky-400")}
                              style={{ width: `${prog}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Agent cards - 2 columns */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground/50" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                      Agent Fleet
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground/40 italic">
                    Drag to reorder
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredAgents.map((agent) => (
                    <div key={agent.id} onDragEnter={() => handleDragEnter(agent.id)}>
                      <AgentCard
                        agent={agent}
                        onUpdateAgent={handleUpdateAgent}
                        messages={commandMessages}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDragEnd={handleDragEnd}
                        onDrop={handleDrop}
                        isDragging={draggedAgentId === agent.id}
                        isDragOver={dragOverAgentId === agent.id}
                        onPause={handlePauseAgent}
                        onResume={handleResumeAgent}
                        onTerminate={handleTerminateAgent}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* System Activity Feed - right col */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-muted-foreground/50" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                      System Activity
                    </span>
                  </div>
                  <button onClick={() => setActiveTab("command")} className="text-[9px] text-sky-400 hover:text-sky-300 transition-colors uppercase tracking-wider">
                    Open Terminal →
                  </button>
                </div>
                
                {/* Sandbox Health Summary */}
                {(() => {
                  const totalRuns = sandboxRuns.length;
                  const totalOpen = sandboxRuns.reduce((s, r) => s + r.errors.filter(e => e.status === 'open' && e.severity !== 'info').length, 0);
                  const totalResolved = sandboxRuns.reduce((s, r) => s + r.errors.filter(e => e.status === 'resolved').length, 0);
                  return totalRuns > 0 ? (
                    <div className="gradient-border rounded-xl bg-card/80 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Boxes className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-[9px] uppercase tracking-widest font-semibold text-muted-foreground/40">Sandbox Overview</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="text-center p-2 rounded-lg bg-secondary/20">
                          <div className="text-sm font-bold text-foreground/60">{totalRuns}</div>
                          <div className="text-[7px] uppercase tracking-widest text-muted-foreground/30">Runs</div>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-secondary/20">
                          <div className={cn("text-sm font-bold", totalOpen > 0 ? "text-rose-400" : "text-emerald-400")}>{totalOpen}</div>
                          <div className="text-[7px] uppercase tracking-widest text-muted-foreground/30">Open</div>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-secondary/20">
                          <div className="text-sm font-bold text-emerald-400">{totalResolved}</div>
                          <div className="text-[7px] uppercase tracking-widest text-muted-foreground/30">Fixed</div>
                        </div>
                      </div>
                    </div>
                  ) : null;
                })()}

                {/* Combined Activity Feed */}
                <div className="gradient-border rounded-xl bg-card/80 overflow-hidden">
                  <ScrollArea className="h-[500px]">
                    <div className="p-3 space-y-1.5">
                      {(() => {
                        // Combine command center messages + logs into one timeline
                        const cmdEvents = commandMessages.slice(-30).map(m => ({
                          id: m.id,
                          time: m.timestamp,
                          sender: m.sender,
                          message: m.content.slice(0, 120) + (m.content.length > 120 ? '...' : ''),
                          type: m.sender === 'SANDBOX' ? 'sandbox' as const : m.sender === 'CORE' ? 'system' as const : m.role === 'model' ? 'agent' as const : 'user' as const,
                          sortKey: Date.now() - (30 - commandMessages.slice(-30).indexOf(m)) * 1000,
                        }));
                        const logEvents = logs.slice(0, 15).map((l, i) => ({
                          id: l.id,
                          time: l.timestamp,
                          sender: l.agentId,
                          message: l.message,
                          type: l.type === 'error' ? 'error' as const : 'log' as const,
                          sortKey: Date.now() - i * 1200,
                        }));
                        const allEvents = [...cmdEvents, ...logEvents]
                          .sort((a, b) => b.sortKey - a.sortKey)
                          .slice(0, 30);

                        const colorMap: Record<string, string> = {
                          sandbox: 'text-amber-400',
                          system: 'text-sky-400',
                          agent: 'text-violet-400',
                          user: 'text-foreground/60',
                          error: 'text-rose-400',
                          log: 'text-muted-foreground/40',
                        };
                        const bgMap: Record<string, string> = {
                          sandbox: 'bg-amber-500/5 border-amber-500/10',
                          system: 'bg-sky-500/5 border-sky-500/10',
                          agent: 'bg-violet-500/5 border-violet-500/10',
                          error: 'bg-rose-500/5 border-rose-500/10',
                        };

                        if (allEvents.length === 0) {
                          return (
                            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/20 space-y-2">
                              <Activity className="w-8 h-8" />
                              <p className="text-[9px] uppercase tracking-widest">No activity yet</p>
                            </div>
                          );
                        }

                        return allEvents.map(evt => (
                          <div key={evt.id} className={cn(
                            "flex gap-2 p-2 rounded-lg border border-transparent text-[10px] font-mono transition-colors",
                            bgMap[evt.type] || ''
                          )}>
                            <span className="text-muted-foreground/30 shrink-0 w-[52px]">{evt.time}</span>
                            <span className={cn("font-bold shrink-0 w-[72px] truncate", colorMap[evt.type] || 'text-muted-foreground/40')}>
                              {evt.sender}
                            </span>
                            <span className="text-foreground/50 break-words min-w-0">{evt.message}</span>
                          </div>
                        ));
                      })()}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </div>
          </div>
        );
      case "agents":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h1 className="text-2xl font-bold tracking-tight">Agent Fleet</h1>
                <p className="text-sm text-muted-foreground/70">
                  Manage, configure, and monitor your autonomous agents.
                </p>
              </div>
              <Button
                size="sm"
                className="h-9 bg-primary/90 hover:bg-primary shadow-lg shadow-primary/20"
              >
                <Plus className="w-4 h-4 mr-2" />
                Deploy Agent
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredAgents.map((agent) => (
                <div key={agent.id} onDragEnter={() => handleDragEnter(agent.id)}>
                  <AgentCard
                    agent={agent}
                    onUpdateAgent={handleUpdateAgent}
                    messages={commandMessages}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragEnd={handleDragEnd}
                    onDrop={handleDrop}
                    isDragging={draggedAgentId === agent.id}
                    isDragOver={dragOverAgentId === agent.id}
                    onPause={handlePauseAgent}
                    onResume={handleResumeAgent}
                    onTerminate={handleTerminateAgent}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      case "command":
        return (
          <CommandCenter
            logs={logs}
            settings={llmSettings}
            agents={agents}
            projects={projects}
            onUpdateSettings={setLlmSettings}
            messages={commandMessages}
            setMessages={setCommandMessages}
            onSpawnAgent={handleSpawnAgent}
            onTerminateAgent={handleTerminateAgent}
            onPauseAgent={handlePauseAgent}
            onResumeAgent={handleResumeAgent}
            onAddTask={handleAddTask}
            onUpdateAgent={handleUpdateAgent}
            onUpdateProjects={setProjects}
            sandboxRuns={sandboxRuns}
            onUpdateSandboxRuns={setSandboxRuns}
          />
        );
      case "scheduler":
        return (
          <TaskScheduler
            agents={agents}
            tasks={scheduledTasks}
            onAddTask={handleAddTask}
            onDeleteTask={handleDeleteTask}
            onToggleTask={handleToggleTask}
          />
        );
      case "projects":
        return (
          <ProjectsPage
            projects={projects}
            agents={agents}
            onUpdateProjects={setProjects}
            sandboxRuns={sandboxRuns}
            onNavigateToSandbox={() => setActiveTab("sandbox")}
          />
        );
      case "analyzer":
      case "sandbox":
        return (
          <Sandbox
            settings={llmSettings}
            projects={projects}
            agents={agents}
            sandboxRuns={sandboxRuns}
            onUpdateRuns={setSandboxRuns}
            onCreateTask={handleAddTask}
            onPostSystemMessage={postSystemMessage}
          />
        );
      case "settings":
        return (
          <SettingsPage
            settings={llmSettings}
            onSettingsChange={setLlmSettings}
          />
        );
      case "logs":
        return (
          <div className="h-[calc(100vh-12rem)]">
            <LogViewer logs={logs} />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <TooltipProvider>
      <div className="dark flex h-screen bg-background text-foreground overflow-hidden noise-bg mesh-gradient">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        <main className="flex-1 overflow-y-auto">
          {/* Top Header Bar */}
          <header className="h-14 border-b border-border/30 flex items-center justify-between px-6 bg-card/20 backdrop-blur-xl sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-muted-foreground/50">Project:</span>
              <span className="text-xs font-semibold">Asclepius Core v2.4</span>
            </div>
            <div className="flex items-center gap-4">
              {/* Heartbeat indicator */}
              <div className="flex items-center gap-2">
                <Heart className="w-3.5 h-3.5 text-rose-400 heartbeat-pulse" />
                <span className="text-[10px] font-medium text-muted-foreground/60">
                  {aliveHeartbeats}/{agents.length} Alive
                </span>
              </div>

              {/* Emergency Stop */}
              <Button
                variant="destructive"
                size="sm"
                className="h-7 text-[10px] px-3 font-semibold tracking-wide uppercase shadow-sm shadow-destructive/20"
                onClick={() => {
                  setAgents((prev) => prev.map((a) => ({ ...a, status: "idle" as const })));
                  toast("EMERGENCY STOP", {
                    description: "All agents forced to idle state.",
                    style: {
                      background: "hsl(var(--destructive))",
                      color: "hsl(var(--destructive-foreground))",
                      border: "none",
                    },
                  });
                }}
              >
                <ShieldAlert className="w-3 h-3 mr-1.5 animate-pulse" />
                Stop All
              </Button>

              {/* Status */}
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full status-dot-pulse" />
                <span className="text-[10px] font-medium text-muted-foreground/60">
                  Jules Connected
                </span>
              </div>

              {/* Avatar */}
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500/30 to-blue-500/30 border border-border/50 flex items-center justify-center">
                <span className="text-[10px] font-bold text-foreground/60">A</span>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <div className="p-6 max-w-7xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              >
                {renderContent()}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
        <Toaster
          position="bottom-right"
          theme="dark"
          toastOptions={{
            style: {
              background: "hsl(225 14% 10%)",
              border: "1px solid hsl(225 12% 16%)",
              color: "hsl(210 20% 90%)",
            },
          }}
        />
      </div>
    </TooltipProvider>
  );
}
