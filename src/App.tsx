/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Sidebar } from "./components/Sidebar";
import { AgentCard } from "./components/AgentCard";
import { LogViewer } from "./components/LogViewer";
import { Sandbox } from "./components/Sandbox";
import { CommandCenter } from "./components/CommandCenter";
import { ProjectsPage } from "./components/ProjectsPage";
import { Chronicle } from "./components/Chronicle";
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
  createSkill,
  createHeartbeat,
  awardAgentXP,
  CORE_GIT_SKILLS,
} from "./types";
import { getUnifiedChatResponse, resolveAgentSettings } from "./services/llm";
import { initializeNeuralVault, getRelevantWisdom, recordEpisode, getVaultStats, applyConfidenceDecay, recordSystemLog, db } from "./services/neuralVault";
import { useLiveQuery } from "dexie-react-hooks";
import type { NeuralVaultStats } from "./types";
import { TaskScheduler } from "./components/TaskScheduler";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { loadSettingsFromFile, saveSettingsToFile } from "./services/settingsPersistence";
import { detectGitHubDesktop, GitHubDesktopStatus } from "./services/githubDesktop";
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
  KeyRound,
  Brain,
  Github,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "motion/react";
import { secureGetItem, secureSetItem } from "@/src/lib/crypto";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// createSkill and createHeartbeat imported from ./types (canonical source)

// ─── INITIAL AGENTS with full heartbeat, skills, budget, reputation, sovereign identity ───
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
      "Agent Synthesis",
      "Project Incubation",
      "Vector Exploration",
    ],
    skills: [
      createSkill("System Architecture", "engineering", 5, "Designs entire system architectures end-to-end", 0),
      createSkill("Self-Healing", "meta", 5, "Autonomous error detection and autonomous repair", 0),
      createSkill("Self-Evolution", "meta", 5, "Recursive capability and skill improvement", 0),
      createSkill("Code Generation", "engineering", 5, "Full-stack code generation in any language", 0),
      createSkill("Agent Orchestration", "operations", 5, "Commands, coordinates, spawns, and terminates agents", 0),
      createSkill("Agent Synthesis", "meta", 5, "Constructs new specialized worker agents dynamically", 0),
      createSkill("Project Incubation", "operations", 5, "Launches target projects and orchestrates pipelines", 0),
      createSkill("Vector Exploration", "analysis", 5, "Identifies new architectural vectors and operational frontiers", 0),
      createSkill("Quota Guardian", "operations", 4, "API quota monitoring, warning, and enforcement"),
      createSkill("UI/UX Design", "creative", 4, "Interface design and user experience optimization"),
      createSkill("Security Audit", "security", 3, "Vulnerability detection and security hardening"),
      CORE_GIT_SKILLS.merge,
      CORE_GIT_SKILLS.push,
      CORE_GIT_SKILLS.pull,
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
    credentials: {
      email: "asclepius.god.agent@gmail.com",
      isAuthenticated: false,
      authStatus: "unauthenticated",
      google: { scopes: [], quotaUsed: 0 },
      github: { scope: [], isConnected: false },
      geminiModel: "gemini-3.1-pro-preview",
      ollamaModel: "gemma4:e4b",
      ollamaBaseUrl: "http://localhost:11434",
      quotaUsed: 0,
      quotaLimit: 1500,
      lastQuotaReset: new Date().toISOString(),
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
      CORE_GIT_SKILLS.merge,
      CORE_GIT_SKILLS.push,
      CORE_GIT_SKILLS.pull,
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
    credentials: {
      email: "asclepius.coo.agent@gmail.com",
      isAuthenticated: false,
      authStatus: "unauthenticated",
      google: { scopes: [], quotaUsed: 0 },
      github: { scope: [], isConnected: false },
      geminiModel: "gemini-3.1-flash-lite-preview",
      ollamaModel: "gemma4:e4b",
      ollamaBaseUrl: "http://localhost:11434",
      quotaUsed: 0,
      quotaLimit: 1500,
      lastQuotaReset: new Date().toISOString(),
    },
    createdBy: "system",
    isProtected: true, // COO is protected — God can pause but not terminate
  },
  {
    id: "a2",
    name: "Jules-Bridge",
    role: "Auth Orchestrator & Connection Health Monitor",
    status: "working",
    lastAction: "Monitoring fleet auth sessions",
    health: 95,
    capabilities: ["Auth Orchestration", "Token Management", "Connection Health"],
    skills: [
      createSkill("Auth Orchestration", "operations", 5, "OAuth lifecycle management for all fleet identities"),
      createSkill("Token Management", "security", 4, "Secure token storage, refresh, and rotation"),
      createSkill("Session Monitoring", "operations", 4, "Cloud connection health tracking and alerting"),
      createSkill("API Integration", "engineering", 3, "REST/WebSocket API connections and management"),
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
    credentials: {
      email: "asclepius.jules.bridge@gmail.com",
      isAuthenticated: false,
      authStatus: "unauthenticated",
      google: { scopes: [], quotaUsed: 0 },
      github: { scope: [], isConnected: false },
      geminiModel: "gemini-3.1-flash-lite-preview",
      ollamaModel: "gemma4:e4b",
      ollamaBaseUrl: "http://localhost:11434",
      quotaUsed: 0,
      quotaLimit: 1500,
      lastQuotaReset: new Date().toISOString(),
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
      CORE_GIT_SKILLS.create_branch,
      CORE_GIT_SKILLS.commit,
      CORE_GIT_SKILLS.push,
      CORE_GIT_SKILLS.pull,
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
    credentials: {
      email: "asclepius.healer.01@gmail.com",
      isAuthenticated: false,
      authStatus: "unauthenticated",
      google: { scopes: [], quotaUsed: 0 },
      github: { scope: [], isConnected: false },
      geminiModel: "gemini-3.1-pro-preview",
      ollamaModel: "gemma4:e4b",
      ollamaBaseUrl: "http://localhost:11434",
      quotaUsed: 0,
      quotaLimit: 1500,
      lastQuotaReset: new Date().toISOString(),
    },
    createdBy: "system",
    isProtected: false,
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem("asclepius_active_tab") || "dashboard");
  const [agents, setAgents] = useState<Agent[]>(() => {
    const cached = secureGetItem<Agent[]>("asclepius_agents", INITIAL_AGENTS);
    // ─── Migration: Hydrate cached agents with Sovereign Identity fields (Article II) ───
    // Agents saved before the identity system was added won't have authStatus, google, github.
    // This migration ensures they get the new fields without requiring a localStorage clear.
    const initialEmailMap = new Map(INITIAL_AGENTS.map(a => [a.id, a.credentials?.email]));
    return cached.map(agent => {
      const creds = agent.credentials;
      if (creds && typeof (creds as any).authStatus === 'undefined') {
        return {
          ...agent,
          credentials: {
            ...creds,
            email: creds.email || initialEmailMap.get(agent.id),
            isAuthenticated: false,
            authStatus: 'unauthenticated' as const,
            google: (creds as any).google || { scopes: [], quotaUsed: 0 },
            github: (creds as any).github || { scope: [], isConnected: false },
          },
        };
      }
      return agent;
    });
  });
  
  // ─── Sequential Orchestration State ───
  // activeTokenAgentId: Holds the ID of the agent currently "talking" or "thinking".
  // Only one agent can have the token at a time, ensuring sequential, non-exploding CPU usage.
  const [activeTokenAgentId, setActiveTokenAgentId] = useState<string | null>(null);
  
  // ─── Neural Vault Stats (for Dashboard display) ───
  const [vaultStats, setVaultStats] = useState<NeuralVaultStats>({
    totalKnowledge: 0, totalEpisodes: 0, totalSkillScripts: 0,
    avgConfidence: 0, topCategories: [], lastLearnedAt: null, mostAccessedTopic: null,
  });
  
  const [agentOrder, setAgentOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem("asclepius_agent_order");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return INITIAL_AGENTS.map((a) => a.id);
  });
  
  const logs = useLiveQuery(() => db.systemLogs.orderBy('timestamp').reverse().limit(15).toArray(), []) || [];

  const [activeProjectId, setActiveProjectId] = useState<string>("none");
  const [searchQuery, setSearchQuery] = useState("");
  const [draggedAgentId, setDraggedAgentId] = useState<string | null>(null);
  const [dragOverAgentId, setDragOverAgentId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [gitHubStatus, setGitHubStatus] = useState<GitHubDesktopStatus | null>(null);

  useEffect(() => {
    detectGitHubDesktop().then(setGitHubStatus);
  }, []);

  const [llmSettings, setLlmSettings] = useState<LLMSettings>(() => secureGetItem<LLMSettings>("antigravity_llm_settings", {
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
  }));

  // LLM settings change rarely — no debounce needed, but avoid re-encrypting on every render
  const prevLlmRef = useRef(llmSettings);
  useEffect(() => {
    if (prevLlmRef.current !== llmSettings) {
      prevLlmRef.current = llmSettings;
      secureSetItem("antigravity_llm_settings", llmSettings);
    }
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

  // ─── Debounced Persistence Sync ───
  // Instead of writing on every state change (which fires every 5s from heartbeat),
  // we debounce all persistence writes to a 2-second window.
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileSettingsSavedRef = useRef(false);
  useEffect(() => {
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      // Local persistence (browser)
      secureSetItem("asclepius_agents", agents);
      localStorage.setItem("asclepius_agent_order", JSON.stringify(agentOrder));
      localStorage.setItem("asclepius_messages", JSON.stringify(commandMessages.slice(-100)));
      localStorage.setItem("asclepius_tasks", JSON.stringify(scheduledTasks));
      localStorage.setItem("asclepius_active_tab", activeTab);

      // File persistence (encrypted on disk) — saves critical settings
      saveSettingsToFile({
        llmSettings,
        agents,
        agentOrder,
        activeTab,
        version: 1,
        savedAt: new Date().toISOString(),
      }).then(ok => {
        if (ok && !fileSettingsSavedRef.current) {
          fileSettingsSavedRef.current = true;
          console.log('[Settings] Initial file save complete');
        }
      });
    }, 2000);
    return () => { if (persistTimerRef.current) clearTimeout(persistTimerRef.current); };
  }, [agents, agentOrder, commandMessages, scheduledTasks, activeTab, llmSettings]);

  // ─── Boot: Load settings from encrypted file ───
  const [fileSettingsLoaded, setFileSettingsLoaded] = useState(false);
  useEffect(() => {
    if (fileSettingsLoaded) return;
    loadSettingsFromFile().then((persisted) => {
      if (persisted) {
        // Hydrate LLM settings (API keys, models, provider)
        if (persisted.llmSettings) {
          setLlmSettings(prev => ({
            ...prev,
            ...persisted.llmSettings,
            // Preserve runtime-only fields
            usage: prev.usage,
          }));
        }
        // Hydrate agents (credentials, skills, budgets) — with identity migration
        if (persisted.agents && persisted.agents.length > 0) {
          const initialEmailMap = new Map(INITIAL_AGENTS.map(a => [a.id, a.credentials?.email]));
          setAgents(persisted.agents.map((agent: Agent) => {
            const creds = agent.credentials;
            if (creds && typeof (creds as any).authStatus === 'undefined') {
              return {
                ...agent,
                credentials: {
                  ...creds,
                  email: creds.email || initialEmailMap.get(agent.id),
                  isAuthenticated: false,
                  authStatus: 'unauthenticated' as const,
                  google: (creds as any).google || { scopes: [], quotaUsed: 0 },
                  github: (creds as any).github || { scope: [], isConnected: false },
                },
              };
            }
            return agent;
          }));
        }
        // Hydrate agent order
        if (persisted.agentOrder && persisted.agentOrder.length > 0) {
          setAgentOrder(persisted.agentOrder);
        }
        toast.success('Settings loaded from asclepius.config.enc');
        console.log(`[Settings] Hydrated from file (saved ${persisted.savedAt})`);
      }
      setFileSettingsLoaded(true);
    });
  }, [fileSettingsLoaded]);

  // ─── Projects State ───
  const [projects, setProjects] = useState<Project[]>(() => {
    
    const defaultProjects: Project[] = [
      {
        id: "proj-asclepius-core",
        name: "Asclepius Core",
        description: "Recursive self-improvement project for the Asclepius autonomous agency.",
        path: "F:/012A_Github/asclepius",
        status: "active",
        githubUrl: "https://github.com/BinqQarenYu/asclepius",
        assignedAgentIds: ["god", "coo"],
        techStack: ["React", "TypeScript", "Vite"],
        priority: "critical",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        goals: [
          { id: "g1", title: "Maintain System Health", description: "Ensure 0 UI crashes", status: "in_progress", progress: 85, createdAt: new Date().toISOString() },
          { id: "g2", title: "Expand Agent Capabilities", description: "Add advanced JSON tools", status: "pending", progress: 10, createdAt: new Date().toISOString() }
        ]
      },
      {
        id: "proj-mandelbrot",
        name: "Mandelbrot Explorer",
        description: "Interactive WebGL-accelerated Mandelbrot fractal viewer with deep zoom capabilities.",
        path: "F:/012A_Github/mandelbrot",
        status: "active",
        githubUrl: "https://github.com/BinqQarenYu/mandelbrot",
        assignedAgentIds: ["coo", "a3"],
        techStack: ["React", "WebGL", "TypeScript"],
        priority: "high",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        goals: [
          { id: "m1", title: "Initialize Sandbox Repository", description: "Setup the project folder and config", status: "pending", progress: 0, createdAt: new Date().toISOString() },
          { id: "m2", title: "Implement WebGL Shader", description: "Write the raw fragment shader for the fractal", status: "pending", progress: 0, createdAt: new Date().toISOString() }
        ]
      }
    ];

    const saved = localStorage.getItem("asclepius_projects");
    if (saved) {
      try { 
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed) && parsed.length > 0) {
          // Sanitize old data to prevent crashes
          const sanitized = parsed.map(p => ({
            ...p,
            techStack: p.techStack || [],
            priority: p.priority || "medium",
            assignedAgentIds: p.assignedAgentIds || [],
            githubUrl: p.githubUrl || p.repoUrl || "",
            goals: p.goals || []
          }));
          // If Mandelbrot is missing from their local storage, inject it!
          if (!sanitized.find((p: Project) => p.id === "proj-mandelbrot")) {
            return [...sanitized, defaultProjects[1]];
          }
          return sanitized;
        }
      } catch (e) { /* ignore */ }
    }
    
    // Self-Healing Protocol: Inject default projects
    return defaultProjects;
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
    // Stage 0: Fleet Identity Initialization — validate all agent credentials on boot
    agents.forEach((agent) => {
      const hasCreds = !!agent.credentials?.geminiApiKey;
      const identity = agent.credentials?.email || "unprovisioned";
      const provider = hasCreds ? "personal-key" : (agent.provider || "global-fallback");
      recordSystemLog({
        severity: "info",
        category: "system",
        source: agent.name,
        sourceId: agent.id,
        message: `[FLEET BOOT] Identity: ${identity} | Provider: ${provider} | Status: ${agent.status === "paused" ? "HIBERNATING" : "ONLINE"}`,
      });
    });

    // ─── Neural Vault Initialization ───
    initializeNeuralVault().then((stats) => {
      setVaultStats(stats);
      recordSystemLog({
        severity: "info",
        category: "system",
        source: "God-Agent",
        sourceId: "god",
        message: `[NEURAL VAULT] Initialized: ${stats.totalKnowledge} knowledge nodes, ${stats.totalEpisodes} episodes, ${stats.totalSkillScripts} skill scripts. Avg confidence: ${stats.avgConfidence}%`,
      });
    });

    // Stage 1: Boot initialization sweep
    const bootTimer = setTimeout(() => {
      setCommandMessages((prev) => [
        ...prev,
        {
          id: `boot-${Date.now()}`,
          role: "system",
          sender: "GOD-AGENT",
          content: `[SYSTEM BOOT] Fleet initialized: ${agents.length} agents online. ${agents.filter(a => a.credentials?.geminiApiKey).length} with personal API keys, ${agents.filter(a => !a.credentials?.geminiApiKey).length} using global fallback. Executing Lookback sweep...`,
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
    // Initial GitHub Desktop detection
    detectGitHubDesktop().then(status => {
      setGitHubStatus(status);
      if (status.githubDesktopInstalled) {
        console.log("[App] GitHub Desktop bridge active");
      }
    });

    return () => {
      clearTimeout(bootTimer);
      clearInterval(hibernationCycle);
    };
  }, []);

  // ─── Unified Agent Tick Engine ───
  // PERF: Consolidates heartbeat (was 3s), recovery watchdog (was 15s), and
  // health regen (was 30s) into ONE interval. This reduces from 3 separate
  // setAgents calls to 1, cutting React re-renders by ~66%.
  const unifiedTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickCountRef = useRef(0);
  const isTabVisibleRef = useRef(true);

  // Pause all heavy work when tab is hidden (saves CPU when user switches tabs)
  useEffect(() => {
    const handleVisibility = () => {
      isTabVisibleRef.current = document.visibilityState === "visible";
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  useEffect(() => {
    unifiedTickRef.current = setInterval(() => {
      // Skip heavy processing when tab is hidden — saves CPU
      if (!isTabVisibleRef.current) return;

      tickCountRef.current += 1;
      const tickNum = tickCountRef.current;
      const now = Date.now();
      const nowISO = new Date().toISOString(); // Create ONCE, reuse
      const nowTime = new Date().toLocaleTimeString();

      setAgents((prev) => {
        let hasDeadAgents = false;
        const deadNames: string[] = [];

        const updated = prev.map((agent) => {
          // ─── Skip paused agents entirely ───
          if (agent.status === "paused") return agent;

          let a = agent;

          // ═══ HEARTBEAT (every tick = 5s) ═══
          const hb = agent.heartbeat;
          const baseResponse = agent.id === "god" ? 8 : agent.id === "coo" ? 25 : 15 + Math.random() * 40;
          const responseTime = Math.round(baseResponse + Math.random() * 15);
          const isHealthy = Math.random() > 0.02; // 2% miss chance

          if (isHealthy) {
            const entry = { timestamp: nowISO, responseTime, healthy: true };
            // Avoid intermediate array: push + pop instead of spread + slice
            const newHistory = hb.history.length >= 20
              ? [...hb.history.slice(1), entry]
              : [...hb.history, entry];

            const avgResp = Math.round(
              newHistory.reduce((s, e) => s + e.responseTime, 0) / newHistory.length
            );
            const healthyBeats = newHistory.filter((e) => e.healthy).length;
            const uptime = Math.round((healthyBeats / newHistory.length) * 1000) / 10;

            a = {
              ...a,
              heartbeat: {
                ...hb,
                lastBeat: nowISO,
                missedBeats: 0,
                status: "alive" as const,
                avgResponseTime: avgResp,
                uptimePercent: uptime,
                history: newHistory,
              },
            };
          } else {
            const newMissed = hb.missedBeats + 1;
            const newStatus: typeof hb.status =
              newMissed >= hb.maxMissed ? "dead" :
              newMissed >= 2 ? "unresponsive" :
              "degraded";

            const entry = { timestamp: nowISO, responseTime: 0, healthy: false };
            const newHistory = hb.history.length >= 20
              ? [...hb.history.slice(1), entry]
              : [...hb.history, entry];
            const healthyBeats = newHistory.filter((e) => e.healthy).length;
            const uptime = Math.round((healthyBeats / newHistory.length) * 1000) / 10;

            a = {
              ...a,
              heartbeat: {
                ...hb,
                missedBeats: newMissed,
                status: newStatus,
                uptimePercent: uptime,
                history: newHistory,
              },
              health: newStatus === "dead" ? Math.max(0, a.health - 25) :
                      newStatus === "unresponsive" ? Math.max(10, a.health - 10) :
                      a.health,
            };

            if (newStatus === "dead") {
              hasDeadAgents = true;
              deadNames.push(a.name);
            }
          }

          // ═══ RECOVERY (every 3rd tick = ~15s) ═══
          if (tickNum % 3 === 0 && a.heartbeat.status === "dead") {
            a = {
              ...a,
              status: "idle" as const,
              lastAction: "Recovered from heartbeat failure",
              health: Math.min(100, a.health + 50),
              heartbeat: {
                ...a.heartbeat,
                missedBeats: 0,
                status: "alive" as const,
                lastBeat: nowISO,
              },
            };
          }

          // ═══ HEALTH REGEN + QUOTA RESET (every 6th tick = ~30s) ═══
          if (tickNum % 6 === 0) {
            // Passive regen
            if (a.heartbeat.status === "alive" && a.health < 100) {
              a = { ...a, health: Math.min(100, a.health + 5) };
            }
            // Daily quota reset
            if (a.credentials?.lastQuotaReset) {
              const lastReset = new Date(a.credentials.lastQuotaReset).toDateString();
              const today = new Date().toDateString();
              if (lastReset !== today) {
                a = {
                  ...a,
                  credentials: { ...a.credentials, quotaUsed: 0, lastQuotaReset: nowISO },
                };
              }
            }
          }

          return a;
        });

        // ═══ Recovery logging (outside the map to avoid nested setState) ═══
        if (hasDeadAgents && tickNum % 3 === 0) {
          deadNames.forEach((name) => {
            recordSystemLog({
              severity: "error",
              category: "agent_action",
              source: name,
              sourceId: agents.find(a => a.name === name)?.id || name,
              message: `[AUTO-RECOVERY] Agent heartbeat was DEAD. Automatic restart executed.`,
            });

            setCommandMessages((prevMsgs) => [...prevMsgs, {
              id: `recovery-alert-${name}-${now}`,
              role: "system" as const,
              sender: "WATCHDOG",
              content: `⚠️ **AUTO-RECOVERY:** ${name} was detected DEAD. Heartbeat reset executed.`,
              timestamp: nowTime,
            }]);
          });
        }

        return updated;
      });
    }, 5000); // Unified tick: 5 seconds

    // T17: Neural Vault confidence decay — runs every ~30 minutes (360 ticks × 5s)
    const decayInterval = setInterval(async () => {
      if (!isTabVisibleRef.current) return;
      try {
        const decayedCount = await applyConfidenceDecay(0.02, 0.1);
        if (decayedCount > 0) {
          const stats = await getVaultStats();
          setVaultStats(stats);
        }
      } catch (e) {
        console.warn('[NeuralVault] Confidence decay failed:', e);
      }
    }, 1800000); // 30 minutes

    return () => {
      if (unifiedTickRef.current) clearInterval(unifiedTickRef.current);
      clearInterval(decayInterval);
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

  // NOTE: Task execution logic has been migrated to the Sequential Agent Orchestrator
  // (executeSequentialTurn). The old independent timer is no longer needed.

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

      recordSystemLog({
        severity: "info",
        category: "system",
        source: "God-Agent",
        sourceId: "god",
        message: `[SPAWN] Created agent "${spec.name}" (${spec.role}) with ${spec.skills.length} skills`,
      });
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

      recordSystemLog({
        severity: "warning",
        category: "system",
        source: "God-Agent",
        sourceId: "god",
        message: `[TERMINATE] Agent "${target.name}" terminated. Reason: No longer needed.`,
      });
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

  // ─── Sequential Agent Orchestrator (The "One-at-a-time" Engine) ───
  // PERF: This is the brain of the sequential system. Instead of multiple intervals 
  // fighting for the CPU, this ONE loop manages the "Communication Token".
  // It alternates between executing Scheduled Tasks and random Simulation Activities.
  //
  // ⚡ KILL SWITCH: Caps autonomous LLM calls to prevent API quota drain.
  // The counter resets when the human sends a message in the Command Center.
  const autonomousCallCountRef = useRef(0);
  const lastCallResetRef = useRef(Date.now());
  const MAX_AUTONOMOUS_CALLS_PER_HOUR = 10;
  const SIM_COOLDOWN_MS = 60000; // Simulation activity: once per minute max
  const lastSimTimeRef = useRef(0);
  const agentsRef = useRef(agents);
  const activeTokenRef = useRef(activeTokenAgentId);
  const scheduledTasksRef = useRef(scheduledTasks);

  // Keep refs in sync with state (avoids useEffect dependency cascade)
  useEffect(() => { agentsRef.current = agents; }, [agents]);
  useEffect(() => { activeTokenRef.current = activeTokenAgentId; }, [activeTokenAgentId]);
  useEffect(() => { scheduledTasksRef.current = scheduledTasks; }, [scheduledTasks]);

  useEffect(() => {
    const orchestratorInterval = setInterval(async () => {
      // 1. Skip if tab is hidden or an agent is already holding the token
      if (!isTabVisibleRef.current || activeTokenRef.current) return;

      // 2. KILL SWITCH: Reset counter every hour, enforce cap
      const now = Date.now();
      if (now - lastCallResetRef.current > 3600000) {
        autonomousCallCountRef.current = 0;
        lastCallResetRef.current = now;
      }
      if (autonomousCallCountRef.current >= MAX_AUTONOMOUS_CALLS_PER_HOUR) {
        // Silently skip — waiting for human input or hourly reset
        return;
      }

      const nowDate = new Date();

      // 3. CHECK FOR DUE TASKS (Priority 1)
      const currentTasks = scheduledTasksRef.current;
      const dueTask = currentTasks.find(t => 
        t.status === "active" && new Date(t.scheduledTime) <= nowDate
      );

      if (dueTask) {
        const currentAgents = agentsRef.current;
        const agent = currentAgents.find(a => a.id === dueTask.agentId);
        if (agent && agent.status !== "paused") {
          autonomousCallCountRef.current += 1;
          console.log(`[KILL_SWITCH] Autonomous call ${autonomousCallCountRef.current}/${MAX_AUTONOMOUS_CALLS_PER_HOUR} (task: ${dueTask.description})`);
          await executeSequentialTurn(agent, "task", dueTask);
          return; // Wait for next tick after turn completes
        }
      }

      // 4. SIMULATION ACTIVITY — Once per minute max, no LLM calls
      if (now - lastSimTimeRef.current > SIM_COOLDOWN_MS) {
        const currentAgents = agentsRef.current;
        const activeAgents = currentAgents.filter(a => a.status !== "paused" && a.id !== "god");
        if (activeAgents.length > 0) {
          const randomAgent = activeAgents[Math.floor(Math.random() * activeAgents.length)];
          lastSimTimeRef.current = now;
          await executeSequentialTurn(randomAgent, "sim");
        }
      }
    }, 5000); // Check for work every 5 seconds

    return () => clearInterval(orchestratorInterval);
  }, [llmSettings]); // ← FIXED: Only re-create interval when LLM settings change, NOT on agent status changes

  /**
   * executeSequentialTurn: The atomic "turn" logic.
   * Grabs token -> Performs work (LLM or Task) -> Releases token.
   */
  const executeSequentialTurn = async (agent: Agent, type: "task" | "sim", task?: ScheduledTask) => {
    // A. Grab the Token
    setActiveTokenAgentId(agent.id);
    
    // B. Mark Agent as Working
    setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, status: "working" as const } : a));

    try {
      if (type === "task" && task) {
        // --- REAL TASK EXECUTION ---
        const taskDescription = task.description;
        
        // T11: Inject relevant wisdom from the Neural Vault before LLM call
        let wisdomInjection = '';
        try {
          const { wisdomBlock } = await getRelevantWisdom(taskDescription, 3);
          wisdomInjection = wisdomBlock;
        } catch (e) {
          console.warn('[NeuralVault] Wisdom retrieval failed, continuing without:', e);
        }

        const systemPrompt = `You are ${agent.name} (${agent.role}). You have been assigned this task: "${taskDescription}". 
        Execute it professionally. If it involves code, provide a logic summary. Stay in character.
        ${wisdomInjection}
        After completing this task, if you learned something valuable, output a LEARN_WISDOM action to store it in the Neural Vault.`;

        // Resolve credentials
        const settings = resolveAgentSettings(agent, llmSettings);
        
        // Call LLM (The "Thinking" time)
        const response = await getUnifiedChatResponse(
          settings,
          `Perform task: ${taskDescription}`,
          [],
          systemPrompt,
          agent.name,
          agent.role
        );

        // Update Logs & Messages
        recordSystemLog({
          severity: "info",
          category: "agent_action",
          source: agent.name,
          sourceId: agent.id,
          message: `[TASK_COMPLETE] ${taskDescription}: ${response.slice(0, 100)}...`,
        });
        
        postSystemMessage(agent.name, `### TASK_COMPLETE: ${taskDescription}\n\n${response}`);

        // Award XP & Update Reputation
        const category = taskDescription.toLowerCase().includes("bug") ? "engineering" : "operations";
        const { updatedAgent } = awardAgentXP(agent, category as any, 100);
        handleUpdateAgent({
          ...updatedAgent,
          lastAction: `Completed task: ${taskDescription}`,
          status: "idle",
          reputation: {
            ...updatedAgent.reputation,
            totalTasks: (updatedAgent.reputation.totalTasks || 0) + 1,
            successRate: Math.min(100, updatedAgent.reputation.successRate + 1)
          }
        });

        // Delete/Reschedule task
        if (task.type === "once") {
          handleDeleteTask(task.id);
        } else {
          // Handle interval rescheduling...
          const nextTime = new Date(Date.now() + (task.intervalMs || 60000)).toISOString();
          setScheduledTasks(prev => prev.map(t => t.id === task.id ? { ...t, scheduledTime: nextTime } : t));
        }

        // T11: Record episode in Neural Vault (Episodic Memory)
        try {
          await recordEpisode(
            agent.id,
            `Completed task: ${taskDescription}`,
            taskDescription,
            'success',
            response.slice(0, 200)
          );
          // Refresh vault stats for dashboard
          const stats = await getVaultStats();
          setVaultStats(stats);
        } catch (e) {
          console.warn('[NeuralVault] Episode recording failed:', e);
        }

      } else {
        // --- SIMULATION TURN ---
        const actionTemplates = [
          "Optimizing system health metrics", "Analyzing code patterns", "Scanning for security vulnerabilities",
          "Reviewing communication logs", "Optimizing memory allocation", "Running diagnostic checks"
        ];
        const action = actionTemplates[Math.floor(Math.random() * actionTemplates.length)];

        // Simulate thinking time (1.5s - 3s) for simulation activities
        await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1500));

        setAgents(prev => prev.map(a => a.id === agent.id ? { 
          ...a, 
          status: "idle", 
          lastAction: action,
          metrics: {
            ...a.metrics,
            cpu: Math.max(1, Math.min(100, a.metrics.cpu + (Math.random() * 4 - 2))),
            memory: Math.max(100, Math.min(4096, a.metrics.memory + (Math.random() * 20 - 10)))
          }
        } : a));
      }
    } catch (error) {
      console.error(`Orchestrator error for ${agent.name}:`, error);
      postSystemMessage("SYSTEM", `⚠️ [ERROR] ${agent.name} failed turn execution: ${error instanceof Error ? error.message : "Timeout"}`);
      setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, status: "error" as const } : a));

      // T18: Record failure episode — the system learns from mistakes too
      try {
        await recordEpisode(
          agent.id,
          `Failed: ${type === 'task' && task ? task.description : 'simulation'}`,
          `Agent ${agent.name} encountered an error during ${type} execution`,
          'failure',
          error instanceof Error ? error.message : 'Unknown error'
        );
        const stats = await getVaultStats();
        setVaultStats(stats);
      } catch (e) {
        console.warn('[NeuralVault] Failure episode recording failed:', e);
      }
    } finally {
      // C. Cooldown (Breathing Room) before releasing token
      setTimeout(() => {
        setActiveTokenAgentId(null);
      }, 2000); // 2s gap between agents talking
    }
  };

  // Stat cards data — Leak #1 fix: compute health from live signals, not static field
  const activeAgentsCount = agents.filter((a) => a.status === "working").length;
  const avgHealth = Math.round(
    agents.reduce((sum, a) => {
      // Weighted: 60% heartbeat uptime + 40% reputation success rate
      const uptime = a.heartbeat.uptimePercent || 100;
      const reputation = a.reputation.successRate || 100;
      return sum + (uptime * 0.6 + reputation * 0.4);
    }, 0) / agents.length
  );
  const avgLatency = Math.round(
    agents.reduce((sum, a) => sum + a.metrics.latency, 0) / agents.length
  );
  const aliveHeartbeats = agents.filter((a) => a.heartbeat.status === "alive").length;
  const fleetQuotaUsed = agents.reduce((sum, a) => sum + (a.credentials?.quotaUsed || 0), 0);
  const fleetQuotaTotal = agents.reduce((sum, a) => sum + (a.credentials?.quotaLimit || 1500), 0);

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
                {
                  label: "Fleet Quota",
                  value: `${fleetQuotaUsed}/${fleetQuotaTotal}`,
                  sub: `${agents.length} agents × free tier`,
                  subColor: fleetQuotaUsed / fleetQuotaTotal > 0.9 ? "text-rose-400" : "text-sky-400",
                  icon: KeyRound,
                  gradient: "from-sky-500/10 to-sky-500/0",
                  iconColor: "text-sky-400",
                  hasBar: true,
                  barValue: Math.min(100, Math.round((fleetQuotaUsed / fleetQuotaTotal) * 100)),
                },
                {
                  label: "Neural Vault",
                  value: vaultStats.totalKnowledge.toString(),
                  sub: `${vaultStats.avgConfidence}% avg trust · ${vaultStats.totalEpisodes} episodes`,
                  subColor: vaultStats.totalKnowledge > 0 ? "text-violet-400" : "text-muted-foreground/40",
                  icon: Brain,
                  gradient: "from-violet-500/10 to-violet-500/0",
                  iconColor: "text-violet-400",
                  hasBar: true,
                  barValue: vaultStats.avgConfidence,
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
                        const logEvents = logs.map((l, i) => ({
                          id: l.id,
                          time: new Date(l.timestamp).toLocaleTimeString(),
                          sender: l.source,
                          message: l.message,
                          type: l.severity === 'error' ? 'error' as const : 'log' as const,
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
            activeProjectId={activeProjectId}
            activeTokenAgentId={activeTokenAgentId}
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
            selectedProjectId={activeProjectId}
            onSelectProject={setActiveProjectId}
            onUpdateAgent={handleUpdateAgent}
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
            <LogViewer />
          </div>
        );
      case "chronicle":
        return (
          <Chronicle
            vaultStats={vaultStats}
            onStatsUpdate={setVaultStats}
          />
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

              {/* GitHub Desktop Status */}
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  gitHubStatus?.githubDesktopInstalled ? "bg-emerald-400 status-dot-pulse" : "bg-zinc-500"
                )} />
                <span className="text-[10px] font-medium text-muted-foreground/60 flex items-center gap-1">
                  <Github className="w-3 h-3" />
                  {gitHubStatus?.githubDesktopInstalled ? "Desktop Linked" : "Git Ready"}
                </span>
              </div>

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
