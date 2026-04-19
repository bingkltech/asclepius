import React, { useState } from 'react';
import { usePersistentState } from './hooks/usePersistentState';
import { 
  Zap, 
  TerminalSquare, 
  Settings, 
  Users, 
  Clock, 
  Boxes, 
  Brain, 
  Terminal, 
  Lock,
  Search,
  Code,
  Play,
  CheckCircle2,
  GitBranch,
  FolderGit2
} from "lucide-react";
import { cn } from "./lib/utils";

// Dummy components for the layout
const Button = ({ children, variant = 'default', size = 'default', className, ...props }: any) => {
  const baseStyle = "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50";
  const variants: Record<string, string> = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    ghost: "hover:bg-accent hover:text-accent-foreground",
    outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
  };
  const sizes: Record<string, string> = {
    default: "h-10 px-4 py-2",
    sm: "h-9 rounded-md px-3",
    icon: "h-10 w-10",
  };
  return (
    <button className={cn(baseStyle, variants[variant], sizes[size], className)} {...props}>
      {children}
    </button>
  );
};

import { GodAgent } from './agents/GodAgent';
import type { PipelineTask } from './types/pipeline';

export default function App() {
  const [activeTab, setActiveTab] = usePersistentState('asclepius_active_tab', 'projects');
  
  // Connection State
  const [isConnected, setIsConnected] = usePersistentState('asclepius_is_connected', false);
  const [repoName, setRepoName] = usePersistentState('asclepius_repo_name', '');
  const [localPath, setLocalPath] = usePersistentState('asclepius_local_path', '');
  const [projectDirective, setProjectDirective] = usePersistentState('asclepius_project_directive', 'Build an interactive Mandelbrot Explorer using Vite + React. Ensure zoom and pan capabilities.');

  // Jules Worker State
  const [isJulesConnected, setIsJulesConnected] = usePersistentState('asclepius_jules_connected', false);
  const [julesEndpoint, setJulesEndpoint] = usePersistentState('asclepius_jules_endpoint', 'https://jules.googleapis.com');
  const [julesToken, setJulesToken] = usePersistentState('asclepius_jules_token', '');

  // Execution State
  const [activeTasks, setActiveTasks] = useState<PipelineTask[]>([]);

  const handleInitiatePipeline = async () => {
    // 1. Decompose the goal using the GodAgent logic
    const tasks = GodAgent.decomposeGoal(projectDirective);
    
    // 2. Prepare the task in the UI
    const initialTasks = tasks.map(task => ({
      ...task,
      assignedWorkerId: "jules-alpha",
      status: "dispatched" as const,
      logs: [
        ...task.logs,
        `[System] Assigned to Jules-Alpha`,
        `[System] Sending payload to ${julesEndpoint}...`
      ]
    }));

    setActiveTasks(initialTasks);

    // 3. Actually send the HTTP request to the Jules API
    const targetTask = initialTasks[0];
    const result = await GodAgent.dispatchTask(targetTask, {
      id: "jules-alpha",
      alias: "Jules-Alpha",
      endpoint: julesEndpoint,
      token: julesToken,
      status: "idle"
    }, repoName);

    // 4. Update the UI with the network result
    setActiveTasks(prev => prev.map(t => {
      if (t.id === targetTask.id) {
        return {
          ...t,
          status: result.success ? 'dispatched' : 'failed',
          logs: [
            ...t.logs,
            result.success 
              ? `[Network] SUCCESS: ${result.message}` 
              : `[Network] ERROR: ${result.message} (Target: ${julesEndpoint})`
          ]
        };
      }
      return t;
    }));
  };

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: Zap, locked: true },
    { id: "agents", label: "Agent Fleet", icon: Users, locked: true },
    { id: "projects", label: "Project Orchestrator", icon: FolderGit2, locked: false },
    { id: "scheduler", label: "Task Scheduler", icon: Clock, locked: true },
    { id: "sandbox", label: "Sandbox", icon: Boxes, locked: true },
    { id: "chronicle", label: "Chronicle", icon: Brain, locked: true },
    { id: "logs", label: "System Logs", icon: Terminal, locked: true },
    { id: "settings", label: "Settings", icon: Settings, locked: true },
  ];

  return (
    <div className="dark flex h-screen bg-[#09090b] text-zinc-50 overflow-hidden font-sans">
      {/* Sidebar */}
      <div className="w-[240px] flex flex-col border-r border-zinc-800 bg-[#09090b]">
        <div className="flex items-center gap-3 px-4 h-16 border-b border-zinc-800">
          <div className="relative w-8 h-8 shrink-0">
            <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-violet-500 to-blue-500 opacity-80" />
            <div className="absolute inset-0 rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm tracking-tight">Asclepius</span>
            <span className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 font-medium">
              God-Agent v3
            </span>
          </div>
        </div>

        <div className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
          <div className="px-3 mb-3">
            <span className="text-[9px] uppercase tracking-[0.2em] font-semibold text-zinc-600">
              Navigation
            </span>
          </div>
          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => !item.locked && setActiveTab(item.id)}
                disabled={item.locked}
                className={cn(
                  "w-full flex items-center justify-between rounded-lg px-3 h-9 text-sm transition-all group",
                  isActive
                    ? "bg-violet-500/10 text-violet-400 font-medium"
                    : item.locked
                    ? "text-zinc-600 cursor-not-allowed opacity-50"
                    : "text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800/50"
                )}
              >
                <div className="flex items-center gap-3">
                  <item.icon className={cn("w-[18px] h-[18px] shrink-0", isActive && "text-violet-400")} />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.locked && <Lock className="w-3 h-3 text-zinc-700" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Header */}
        <header className="h-14 border-b border-zinc-800 flex items-center justify-between px-6 bg-[#09090b]/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-zinc-500">Active View:</span>
            <span className="text-xs font-semibold text-violet-400">Project Orchestrator</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">God-Agent Online</span>
            </div>
            <div className="h-4 w-px bg-zinc-800" />
            <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-zinc-50">
              <Code className="w-4 h-4" />
            </Button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-4xl mx-auto space-y-8">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-zinc-50">Project Orchestrator</h1>
              <p className="text-zinc-400 mt-2">
                Connect your GitHub repository to begin the autonomous God-Agent pipeline.
              </p>
            </div>

            {/* GitHub Connection Section */}
            {!isConnected ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-violet-500" />
                <div className="flex flex-col gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <GitBranch className="w-5 h-5 text-zinc-100" />
                      <h2 className="text-lg font-semibold text-zinc-100">Connect GitHub Repository</h2>
                    </div>
                    <p className="text-sm text-zinc-400">
                      The God-Agent uses a <strong>Zero-Auth Pipeline</strong>. Jules (cloud) handles remote pushes using its own credentials. 
                      Asclepius (local) only needs the target repo name and your local sandbox path to run verifications.
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">GitHub Repo Target</label>
                      <input 
                        type="text" 
                        value={repoName}
                        onChange={(e) => setRepoName(e.target.value)}
                        placeholder="e.g., BinqQarenYu/mandelbrot"
                        className="w-full h-10 bg-[#09090b] border border-zinc-800 rounded-lg px-4 text-sm text-zinc-300 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Local Sandbox Path</label>
                      <input 
                        type="text" 
                        value={localPath}
                        onChange={(e) => setLocalPath(e.target.value)}
                        placeholder="e.g., C:\Projects\mandelbrot"
                        className="w-full h-10 bg-[#09090b] border border-zinc-800 rounded-lg px-4 text-sm text-zinc-300 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button 
                      className="bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
                      disabled={!repoName || !localPath}
                      onClick={() => setIsConnected(true)}
                    >
                      Establish Connection
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <div>
                    <div className="text-sm font-medium text-zinc-200">Connected to <span className="font-mono text-emerald-400">{repoName}</span></div>
                    <div className="text-xs text-zinc-500 font-mono">Local Sync: {localPath}</div>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setIsConnected(false)} className="text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800">
                  Disconnect
                </Button>
              </div>
            )}

            {/* Project Goal Input (Requires GitHub Connection first) */}
            <div className={cn("bg-[#09090b] border rounded-xl p-6 shadow-sm relative transition-all", isConnected ? "border-violet-500/30" : "border-zinc-800/50 opacity-50")}>
              {!isConnected && <div className="absolute inset-0 z-10 cursor-not-allowed" title="Connect a GitHub repository first" />}
              <div className="flex items-center justify-between mb-4">
                <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Project Directive</label>
                {!isConnected && <Lock className="w-3 h-3 text-zinc-600" />}
              </div>
              <textarea 
                className="w-full h-32 bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-sm text-zinc-200 resize-none font-mono focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                placeholder="Describe the application you want to build..."
                value={projectDirective}
                onChange={(e) => setProjectDirective(e.target.value)}
                disabled={!isConnected}
              />
              <div className="mt-4 flex justify-end">
                <Button 
                  onClick={handleInitiatePipeline}
                  className="bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-900/20"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Initiate Pipeline
                </Button>
              </div>
            </div>

            {/* Single Jules Worker Configuration */}
            {!isJulesConnected ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
                <div className="flex flex-col gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <TerminalSquare className="w-5 h-5 text-blue-400" />
                      <h2 className="text-lg font-semibold text-zinc-100">Connect Jules Worker (Alpha)</h2>
                    </div>
                    <p className="text-sm text-zinc-400">
                      To begin, we will connect just **one** Jules cloud worker. Enter the API endpoint and the Bearer Auth Token 
                      for your primary `jules.google.com` account.
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Jules API Endpoint</label>
                      <input 
                        type="text" 
                        value={julesEndpoint}
                        onChange={(e) => setJulesEndpoint(e.target.value)}
                        placeholder="https://jules.google.com/api/v1"
                        className="w-full h-10 bg-[#09090b] border border-zinc-800 rounded-lg px-4 text-sm text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Bearer Token / OAuth Cookie</label>
                      <input 
                        type="password" 
                        value={julesToken}
                        onChange={(e) => setJulesToken(e.target.value)}
                        placeholder="Paste auth token here..."
                        className="w-full h-10 bg-[#09090b] border border-zinc-800 rounded-lg px-4 text-sm text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button 
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                      disabled={!julesEndpoint || !julesToken}
                      onClick={() => setIsJulesConnected(true)}
                    >
                      Authenticate Worker
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-blue-400" />
                  <div>
                    <div className="text-sm font-medium text-zinc-200">Worker Connected: <span className="font-mono text-blue-400">Jules-Alpha</span></div>
                    <div className="text-xs text-zinc-500 font-mono">Endpoint: {julesEndpoint}</div>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setIsJulesConnected(false)} className="text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800">
                  Disconnect
                </Button>
              </div>
            )}

            {/* Pipeline Execution Monitor */}
            {activeTasks.length > 0 && (
              <div className="bg-zinc-900 border border-violet-500/50 rounded-xl p-6 shadow-lg shadow-violet-900/10">
                <div className="flex items-center gap-2 mb-6">
                  <Terminal className="w-5 h-5 text-violet-400" />
                  <h2 className="text-lg font-semibold text-zinc-100">Pipeline Execution Monitor</h2>
                </div>
                
                <div className="space-y-4">
                  {activeTasks.map((task) => (
                    <div key={task.id} className="bg-[#09090b] border border-zinc-800 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold text-zinc-200">{task.goal}</span>
                        <span className="text-[10px] uppercase font-bold text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full animate-pulse">
                          {task.status}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="bg-zinc-900 rounded p-2 border border-zinc-800">
                          <span className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Assigned Worker</span>
                          <span className="text-xs font-mono text-blue-400">{task.assignedWorkerId}</span>
                        </div>
                        <div className="bg-zinc-900 rounded p-2 border border-zinc-800">
                          <span className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Target Repository</span>
                          <span className="text-xs font-mono text-emerald-400">{repoName}</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Jules API Payload (Preview)</span>
                        <div className="bg-zinc-950 border border-zinc-800 rounded p-3 overflow-x-auto">
                          <pre className="text-[10px] font-mono text-zinc-400">
{JSON.stringify({
  prompt: task.goal,
  sourceContext: {
    source: `sources/github/${repoName.replace('https://github.com/', '').replace('.git', '')}`,
    githubRepoContext: { startingBranch: "main" }
  },
  automationMode: "AUTO_CREATE_PR",
  title: "Asclepius God-Agent Task"
}, null, 2)}
                          </pre>
                        </div>
                      </div>

                      <div className="mt-4 space-y-1">
                        {task.logs.map((log, i) => (
                          <div key={i} className="text-[10px] font-mono text-zinc-500 flex items-center gap-2">
                            <span className="text-violet-500">{'>'}</span> {log}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}
