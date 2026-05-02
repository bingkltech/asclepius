import React, { useState, useEffect, useMemo } from 'react';
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
  FolderGit2,
  Server,
  Cloud,
  Laptop,
  CircleDashed,
  Loader2,
  ChevronRight,
  MoreVertical,
  Plus,
  UserPlus,
  Send,
  MessageSquare,
  AlertTriangle,
  ArrowRight,
  Shield,
  BookOpen,
  Database
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
import { LeadAgent } from './agents/LeadAgent';
import type { PipelineTask, ExecutionPlan, AgentConfig, AgentSkill, ModelProvider, TaskStatus } from './types/pipeline';

type AgentRole = 'Architect' | 'UI/UX Expert' | 'Dev Expert' | 'QA Reviewer' | 'God-Agent' | 'Data Scientist' | 'Security Auditor';
type Worker = { 
  id: string; 
  name: string; 
  role: AgentRole; 
  type: 'Cloud' | 'Local'; 
  status: 'idle' | 'busy' | 'offline'; 
  avatarColor: string;
  endpoint?: string;
  token?: string;
  systemPrompt?: string;
};
type TaskPhase = 'Planning' | 'Design' | 'Implementation' | 'Review';
type PlannedTask = {
  id: string;
  title: string;
  phase: TaskPhase;
  assigneeId: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
};

import fleetConfig from './config/fleet.json';

const initialAgents: Worker[] = fleetConfig as Worker[];

export default function App() {
  const [activeTab, setActiveTab] = usePersistentState('asclepius_active_tab', 'projects');
  
  // Project State
  type Project = { id: string; name: string; localPath: string; assignedWorkerIds: string[]; activeBranch?: string };
  const [projects, setProjects] = usePersistentState<Project[]>('asclepius_projects_list_v4', [
    { id: 'p1', name: 'Mandelbrot Explorer', localPath: 'F:\\012A_Github\\mandelbrot', assignedWorkerIds: ['w1', 'w2', 'w3', 'w4', 'w5'], activeBranch: 'main' }
  ]);
  const [activeProjectId, setActiveProjectId] = usePersistentState<string | null>('asclepius_active_project_v4', 'p1');

  // Dynamic Git Branches State
  type GitBranchData = { name: string; timeAgo: string };
  const [projectBranches, setProjectBranches] = useState<GitBranchData[]>([{ name: 'main', timeAgo: 'just now' }]);
  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
  const [branchSearchQuery, setBranchSearchQuery] = useState('');
  
  useEffect(() => {
    const activeProject = projects.find(p => p.id === activeProjectId);
    if (activeProject && activeProject.localPath) {
      fetch('/api/get-branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cwd: activeProject.localPath })
      })
      .then(res => res.json())
      .then(data => {
        if (data.error || data.stderr) {
          console.warn("[Asclepius] Git branch fetch warning:", data.error || data.stderr);
        }
        
        if (data.branches && data.branches.length > 0) {
          const formattedBranches = data.branches.map((b: string) => ({ name: b, timeAgo: '' }));
          setProjectBranches(formattedBranches);
        } else {
          console.warn("[Asclepius] No branches found. Are you sure this is a valid git repository?", activeProject.localPath);
        }
      })
      .catch(console.error);
    }
  }, [activeProjectId]); // Fetch branches when the active project changes

  // New Project Form State
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectTarget, setNewProjectTarget] = useState('');
  const [newProjectRunGraphify, setNewProjectRunGraphify] = useState(true);

  const handleCreateProject = () => {
    if (!newProjectName || !newProjectTarget) return;
    const newId = 'p' + Date.now();
    setProjects([...projects, { id: newId, name: newProjectName, localPath: newProjectTarget, assignedWorkerIds: [], activeBranch: 'main' }]);
    setActiveProjectId(newId);
    setNewProjectName('');
    setNewProjectTarget('');
    setNewProjectRunGraphify(true);
  };

  // Connection State
  const [isConnected, setIsConnected] = usePersistentState('asclepius_is_connected', false);
  const [repoName, setRepoName] = usePersistentState('asclepius_repo_name', '');
  const [localPath, setLocalPath] = usePersistentState('asclepius_local_path', '');
  
  // Agent State
  const [workers, setWorkers] = usePersistentState<Worker[]>('asclepius_agents_v4', initialAgents);
  const [configuringWorkerId, setConfiguringWorkerId] = usePersistentState<string | null>('asclepius_configuring_agent_v4', 'a0');
  const [isAddingWorker, setIsAddingWorker] = usePersistentState('asclepius_is_adding_worker', false);
  const [workerDirectives, setWorkerDirectives] = usePersistentState<Record<string, string>>('asclepius_worker_directives', {});
  const [workerConnections, setWorkerConnections] = usePersistentState<Record<string, boolean>>('asclepius_worker_connections', { 'w3': false });

  // Add Worker Form State
  const [newWorkerName, setNewWorkerName] = usePersistentState('asclepius_new_worker_name', '');
  const [newWorkerRole, setNewWorkerRole] = usePersistentState<AgentRole>('asclepius_new_worker_role', 'Dev Expert');
  const [newWorkerSystemPrompt, setNewWorkerSystemPrompt] = usePersistentState('asclepius_new_worker_prompt', '');

  // Execution State
  const [plannedTasks, setPlannedTasks] = usePersistentState<PlannedTask[]>('asclepius_planned_tasks', []);
  const [isPlanning, setIsPlanning] = usePersistentState('asclepius_is_planning', false);
  const [pipelineLogs, setPipelineLogs] = usePersistentState<{timeString: string, message: string, type: 'info'|'success'|'error'|'warning'}[]>('asclepius_pipeline_logs', [
    { timeString: new Date().toLocaleTimeString(), message: 'System initialized. Awaiting fleet authentication...', type: 'info' }
  ]);

  // Lead Agent Orchestration State (v5)
  const [leadAgentChatInput, setLeadAgentChatInput] = useState('');
  const [leadAgentChatHistory, setLeadAgentChatHistory] = usePersistentState<{role: 'user'|'agent'; message: string; timestamp: number}[]>('asclepius_lead_chat_v5', []);
  const [dagTasks, setDagTasks] = usePersistentState<PipelineTask[]>('asclepius_dag_tasks_v5', []);
  const [isDecomposing, setIsDecomposing] = useState(false);

  // God Agent Universal Config State
  const [godAgentConfig, setGodAgentConfig] = usePersistentState('asclepius_god_agent_config_v1', {
    intelligenceEngine: 'google_jules',
    googleApiKey: '',
    anthropicApiKey: '',
    openaiApiKey: '',
    ollamaEndpoint: 'http://localhost:11434',
    ollamaModel: 'llama3'
  });

  // Knowledge Assets State (Skill Seekers)
  const [agentKnowledgeAssets, setAgentKnowledgeAssets] = usePersistentState<Record<string, string[]>>('asclepius_agent_knowledge_v5', {});
  const [newSkillUrl, setNewSkillUrl] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  const handleScanProject = async (workerId: string) => {
    if (!activeProjectMemo) return;
    setIsScanning(true);
    try {
      const result = await SkillSeekersBridge.createFromProject(activeProjectMemo.localPath);
      if (result.success) {
        const skillPath = `${result.outputPath}/SKILL.md`;
        setAgentKnowledgeAssets(prev => ({
          ...prev,
          [workerId]: Array.from(new Set([...(prev[workerId] || []), skillPath]))
        }));
        alert('Project scan complete! Knowledge asset attached.');
      } else {
        alert('Scan failed: ' + result.message);
      }
    } catch (err: any) {
      alert('Error during scan: ' + err.message);
    } finally {
      setIsScanning(false);
    }
  };

  const toggleWorkerConnection = (workerId: string) => {
    const isCurrentlyConnected = workerConnections[workerId];
    const worker = workers.find(w => w.id === workerId);
    
    if (!isCurrentlyConnected) {
      setPipelineLogs(prev => [...prev, { timeString: new Date().toLocaleTimeString(), message: `Initiating handshake with ${worker?.name} at ${worker?.endpoint}...`, type: 'info' }]);
      setTimeout(() => {
        setPipelineLogs(prev => [...prev, { timeString: new Date().toLocaleTimeString(), message: `Successfully authenticated ${worker?.name}. API connection established.`, type: 'success' }]);
        setWorkerConnections(p => ({ ...p, [workerId]: true }));
      }, 600);
    } else {
      setPipelineLogs(prev => [...prev, { timeString: new Date().toLocaleTimeString(), message: `Terminated connection with ${worker?.name}.`, type: 'warning' }]);
      setWorkerConnections(p => ({ ...p, [workerId]: false }));
    }
  };

  const handleAddWorker = () => {
    if (!newWorkerName) return;
    const colors = ['bg-purple-500', 'bg-pink-500', 'bg-emerald-500', 'bg-blue-500', 'bg-amber-500', 'bg-teal-500', 'bg-red-500', 'bg-indigo-500'];
    const newWorker: Worker = {
      id: 'a' + Date.now(),
      name: newWorkerName,
      role: newWorkerRole,
      type: 'Cloud',
      status: 'idle',
      avatarColor: colors[Math.floor(Math.random() * colors.length)],
      systemPrompt: newWorkerSystemPrompt
    };
    setWorkers([...workers, newWorker]);
    setIsAddingWorker(false);
    setConfiguringWorkerId(newWorker.id);
    setNewWorkerName('');
    setNewWorkerSystemPrompt('');
  };

  const handleUpdateWorker = (id: string, field: keyof Worker, value: string) => {
    setWorkers(workers.map(w => w.id === id ? { ...w, [field]: value } : w));
  };

  const handleDirectiveChange = (id: string, directive: string) => {
    setWorkerDirectives(prev => ({ ...prev, [id]: directive }));
  };

  const handleGeneratePlan = (workerId: string) => {
    setIsPlanning(true);
    const activeWorker = workers.find(w => w.id === workerId);
    setPipelineLogs(prev => [...prev, { timeString: new Date().toLocaleTimeString(), message: `Dispatching payload to ${activeWorker?.name}...`, type: 'info' }]);

    setTimeout(() => {
      setPipelineLogs(prev => [...prev, { timeString: new Date().toLocaleTimeString(), message: `Received structured plan from ${activeWorker?.name}. Pipeline execution halted for review.`, type: 'success' }]);
      setPlannedTasks([
        { id: 't1', title: `Initialize workspace context`, phase: 'Planning', assigneeId: workerId, status: 'completed' },
        { id: 't2', title: `Execute primary directive`, phase: 'Implementation', assigneeId: workerId, status: 'in-progress' },
        { id: 't3', title: `Validate output`, phase: 'Review', assigneeId: workerId, status: 'pending' },
      ]);
      setIsPlanning(false);
    }, 1500);
  };

  // ── Lead Agent Chat Handler ──
  const handleLeadAgentChat = async () => {
    if (!leadAgentChatInput.trim() || isDecomposing) return;
    const directive = leadAgentChatInput.trim();
    setLeadAgentChatInput('');
    setIsDecomposing(true);

    // Add user message to chat
    setLeadAgentChatHistory(prev => [...prev, { role: 'user', message: directive, timestamp: Date.now() }]);
    setPipelineLogs(prev => [...prev, { timeString: new Date().toLocaleTimeString(), message: `[COO] Directive issued: "${directive.substring(0, 80)}..."`, type: 'info' }]);

    const activeProject = projects.find(p => p.id === activeProjectId);
    if (!activeProject) {
      setLeadAgentChatHistory(prev => [...prev, { role: 'agent', message: 'No active project selected. Please select a project first.', timestamp: Date.now() }]);
      setIsDecomposing(false);
      return;
    }

    // Find the lead agent (first worker with God-Agent role, or fallback to first connected worker)
    const leadWorker = workers.find(w => w.role === 'God-Agent' && workerConnections[w.id]) || workers.find(w => workerConnections[w.id]);
    if (!leadWorker) {
      setLeadAgentChatHistory(prev => [...prev, { role: 'agent', message: 'No authenticated agent available. Please authenticate at least one agent to act as Lead.', timestamp: Date.now() }]);
      setIsDecomposing(false);
      return;
    }

    // Build a minimal AgentConfig for the LeadAgent from the Worker
    const leadConfig: AgentConfig = {
      id: leadWorker.id,
      name: leadWorker.name,
      role: leadWorker.role,
      type: leadWorker.type === 'Cloud' ? 'cloud' : 'local',
      status: 'idle',
      avatarColor: leadWorker.avatarColor,
      skills: ['orchestration', 'architecture'],
      isLeadAgent: true,
      model: {
        provider: (leadWorker.endpoint?.includes('jules') ? 'google_jules' : 
                   leadWorker.endpoint?.includes('generativelanguage') ? 'google_gemini' :
                   leadWorker.endpoint?.includes('anthropic') ? 'anthropic' :
                   leadWorker.endpoint?.includes('openai') ? 'openai' :
                   leadWorker.endpoint?.includes('localhost:11434') ? 'local_ollama' : 'custom') as ModelProvider,
        modelId: 'default',
        endpoint: leadWorker.endpoint || '',
        apiKey: leadWorker.token || '',
        temperature: 0.3,
        maxTokens: 8192,
        systemPrompt: `You are ${leadWorker.name}, the Lead Agent orchestrator of the Asclepius system. You decompose directives into actionable development tasks.`
      }
    };

    // Build AgentConfig array for the team
    const teamConfigs: AgentConfig[] = workers
      .filter(w => activeProject.assignedWorkerIds.includes(w.id))
      .map(w => ({
        id: w.id,
        name: w.name,
        role: w.role,
        type: w.type === 'Cloud' ? 'cloud' as const : 'local' as const,
        status: 'idle' as const,
        avatarColor: w.avatarColor,
        skills: (
          w.role === 'Architect' ? ['architecture', 'fullstack'] :
          w.role === 'UI/UX Expert' ? ['frontend', 'documentation'] :
          w.role === 'Dev Expert' ? ['fullstack', 'backend'] :
          w.role === 'QA Reviewer' ? ['qa_testing', 'code_review'] :
          w.role === 'God-Agent' ? ['orchestration', 'architecture'] :
          w.role === 'Security Auditor' ? ['security'] :
          ['fullstack']
        ) as AgentSkill[],
        model: {
          provider: 'custom' as ModelProvider,
          modelId: 'default',
          endpoint: w.endpoint || '',
          apiKey: w.token || '',
        }
      }));

    setLeadAgentChatHistory(prev => [...prev, { role: 'agent', message: `Scanning workspace at ${activeProject.localPath}...`, timestamp: Date.now() }]);

    try {
      const lead = new LeadAgent(leadConfig, activeProject.localPath, activeProject.activeBranch || 'main');
      const tasks = await lead.decompose(directive, teamConfigs);
      const assigned = LeadAgent.autoAssign(tasks, teamConfigs);

      setDagTasks(assigned);
      setPipelineLogs(prev => [...prev, { timeString: new Date().toLocaleTimeString(), message: `[LeadAgent] Generated ${assigned.length} tasks from directive.`, type: 'success' }]);

      const summary = assigned.map((t, i) => {
        const agent = workers.find(w => w.id === t.assignedAgentId);
        return `${i + 1}. ${t.goal} → ${agent?.name || 'Unassigned'} [${t.status}]`;
      }).join('\n');

      setLeadAgentChatHistory(prev => [...prev, { 
        role: 'agent', 
        message: `Decomposed into ${assigned.length} tasks:\n${summary}`, 
        timestamp: Date.now() 
      }]);
    } catch (err: any) {
      setLeadAgentChatHistory(prev => [...prev, { role: 'agent', message: `Error: ${err.message}`, timestamp: Date.now() }]);
      setPipelineLogs(prev => [...prev, { timeString: new Date().toLocaleTimeString(), message: `[LeadAgent] Decomposition failed: ${err.message}`, type: 'error' }]);
    } finally {
      setIsDecomposing(false);
    }
  };

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: Zap, locked: true },
    { id: "fleet", label: "Agent Fleet", icon: Users, locked: false },
    { id: "projects", label: "Projects", icon: FolderGit2, locked: false },
    { id: "scheduler", label: "Task Scheduler", icon: Clock, locked: true },
    { id: "sandbox", label: "Sandbox", icon: Boxes, locked: true },
    { id: "chronicle", label: "Chronicle", icon: Brain, locked: true },
    { id: "logs", label: "System Logs", icon: Terminal, locked: true },
    { id: "settings", label: "Settings", icon: Settings, locked: true },
  ];

  // Performance optimization: Memoize active project to prevent O(N * M) lookups during worker mapping/filtering
  const activeProjectMemo = useMemo(() => projects.find(p => p.id === activeProjectId), [projects, activeProjectId]);
  const activeProjectWorkerIds = useMemo(() => new Set(activeProjectMemo?.assignedWorkerIds || []), [activeProjectMemo]);

  // Performance optimization: Memoize workers into a Map for O(1) lookups during rendering
  const workersMap = useMemo(() => new Map(workers.map(w => [w.id, w])), [workers]);

  const activeWorkerConfig = configuringWorkerId ? workersMap.get(configuringWorkerId) : undefined;
  const activeDirective = activeWorkerConfig ? (workerDirectives[activeWorkerConfig.id] || '') : '';
  const isWorkerConnected = activeWorkerConfig ? !!workerConnections[activeWorkerConfig.id] : false;

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

        <div className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto custom-scrollbar">
          <div className="px-3 mb-3">
            <span className="text-[9px] uppercase tracking-[0.2em] font-semibold text-zinc-600">
              Navigation
            </span>
          </div>
          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <div key={item.id}>
                <button
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
                  {item.locked ? (
                    <Lock className="w-3 h-3 text-zinc-700" />
                  ) : item.id === 'projects' ? (
                    <ChevronRight className={cn("w-4 h-4 text-zinc-500 transition-transform", isActive && "rotate-90")} />
                  ) : null}
                </button>
                {isActive && item.id === 'projects' && (
                  <div className="pl-9 pr-3 py-1.5 space-y-0.5 mb-2 mt-1">
                    {projects.map(p => (
                      <button 
                        key={p.id} 
                        onClick={() => setActiveProjectId(p.id)} 
                        className={cn("w-full text-left truncate text-xs py-1.5 px-2 rounded-md transition-colors", activeProjectId === p.id ? "text-violet-300 bg-violet-500/10 font-medium" : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50")}
                      >
                        {p.name}
                      </button>
                    ))}
                    <button 
                      onClick={() => setActiveProjectId('new')} 
                      className={cn("w-full text-left text-xs py-1.5 px-2 rounded-md transition-colors flex items-center gap-1.5", activeProjectId === 'new' ? "text-emerald-400 bg-emerald-500/10 font-medium" : "text-emerald-500/80 hover:text-emerald-400 hover:bg-emerald-500/10")}
                    >
                      <Plus className="w-3 h-3" /> Add Project
                    </button>
                  </div>
                )}
              </div>
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
            <span className="text-xs font-semibold text-violet-400">
               {activeTab === 'projects' ? (activeProjectId ? 'Project Orchestrator' : 'Projects Portfolio') : 'Dashboard'}
            </span>
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
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {activeTab === 'projects' && (!activeProjectId || activeProjectId === 'new') ? (
            <div className="flex-1 flex flex-col items-center justify-center h-[90%]">
              {activeProjectId === 'new' ? (
                <div className="w-full max-w-md bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-6 shadow-2xl">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <FolderGit2 className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-zinc-100 tracking-tight">Initialize New Project</h2>
                      <p className="text-xs text-zinc-500">Prepare the battlespace for your AI fleet.</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-1.5">Project Name</label>
                      <input 
                        type="text" 
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        placeholder="e.g. AlgoTrade Navigator" 
                        className="w-full bg-zinc-950/50 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all placeholder:text-zinc-700"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-1.5">Absolute Local Workspace Path</label>
                      <input 
                        type="text" 
                        value={newProjectTarget}
                        onChange={(e) => setNewProjectTarget(e.target.value)}
                        placeholder="e.g. F:\012A_Github\my-app" 
                        className="w-full bg-zinc-950/50 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all placeholder:text-zinc-700"
                      />
                    </div>
                    
                    <div className="pt-2">
                      <label className="flex items-start gap-3 cursor-pointer group">
                        <div className="relative flex items-center justify-center mt-0.5">
                          <input 
                            type="checkbox" 
                            checked={newProjectRunGraphify}
                            onChange={(e) => setNewProjectRunGraphify(e.target.checked)}
                            className="peer sr-only" 
                          />
                          <div className="w-4 h-4 rounded border border-zinc-700 bg-zinc-950 peer-checked:bg-emerald-500 peer-checked:border-emerald-500 transition-all flex items-center justify-center">
                             <CheckCircle2 className="w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                          </div>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-zinc-300 group-hover:text-zinc-100 transition-colors">Run Graphify Architecture Scan</span>
                          <span className="text-[10px] text-zinc-500 leading-tight mt-1">Automatically extract AST and generate Knowledge Graph (GRAPH_REPORT.md) on import to drastically reduce God-Agent token consumption.</span>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="mt-8 pt-4 border-t border-zinc-800/80 flex justify-end gap-3">
                    <Button variant="ghost" onClick={() => setActiveProjectId(null)} className="text-zinc-400">Cancel</Button>
                    <Button onClick={handleCreateProject} disabled={!newProjectName || !newProjectTarget} className="bg-emerald-500 hover:bg-emerald-600 text-emerald-950 font-semibold shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                      Initialize Project
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-zinc-500">
                   <FolderGit2 className="w-16 h-16 mb-4 opacity-20" />
                   <h2 className="text-lg font-semibold text-zinc-300 mb-2">Projects Portfolio</h2>
                   <p className="text-sm">Select a project from the sidebar to open its Orchestrator Command Center.</p>
                </div>
              )}
            </div>
          ) : activeTab === 'projects' && activeProjectId && activeProjectId !== 'new' ? (
          <>
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 h-full min-h-[600px] max-w-7xl mx-auto">
            
            {/* LEFT COLUMN: Task Table + Lead Agent Chat */}
            <div className="col-span-1 xl:col-span-5 flex flex-col gap-3">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-zinc-50">Execution Plan</h2>
                  <p className="text-xs text-zinc-400">{dagTasks.length > 0 ? `${dagTasks.length} tasks • ${dagTasks.filter(t => t.status === 'completed').length} completed` : 'Issue a directive to the Lead Agent below.'}</p>
                </div>
                {dagTasks.length > 0 && (
                  <Button variant="ghost" size="sm" className="text-zinc-500 hover:text-zinc-300" onClick={() => setDagTasks([])}>
                    Clear
                  </Button>
                )}
              </div>

              {/* DAG Task Table */}
              <div className="flex-1 bg-zinc-900/50 border border-zinc-800/80 rounded-xl overflow-hidden flex flex-col shadow-inner min-h-[300px]">
                {dagTasks.length === 0 && !isDecomposing ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 p-8 text-center">
                    <Boxes className="w-12 h-12 mb-4 opacity-20" />
                    <p className="text-sm">No active execution plan.</p>
                    <p className="text-xs mt-2">Use the Lead Agent chat below to issue a directive.</p>
                  </div>
                ) : isDecomposing && dagTasks.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 p-8 text-center">
                    <Loader2 className="w-10 h-10 mb-4 animate-spin text-violet-500" />
                    <p className="text-sm font-medium text-zinc-300">Lead Agent is thinking...</p>
                    <p className="text-xs mt-2">Scanning workspace and decomposing directive into tasks.</p>
                  </div>
                ) : (
                  <div className="p-3 space-y-2 overflow-y-auto custom-scrollbar flex-1">
                    {dagTasks.map((task, idx) => {
                      const assignee = task.assignedAgentId ? workersMap.get(task.assignedAgentId) : undefined;
                      const statusConfig: Record<string, { icon: any; color: string; bg: string; border: string }> = {
                        blocked:   { icon: Lock,          color: 'text-zinc-600',   bg: 'bg-zinc-900',        border: 'border-zinc-800' },
                        pending:   { icon: CircleDashed,  color: 'text-amber-500',  bg: 'bg-[#09090b]',      border: 'border-zinc-800 hover:border-zinc-700' },
                        assigned:  { icon: ArrowRight,    color: 'text-blue-400',   bg: 'bg-blue-500/5',     border: 'border-blue-500/20' },
                        working:   { icon: Loader2,       color: 'text-violet-400', bg: 'bg-violet-500/10',  border: 'border-violet-500/40' },
                        in_review: { icon: Search,        color: 'text-cyan-400',   bg: 'bg-cyan-500/10',    border: 'border-cyan-500/30' },
                        revision:  { icon: AlertTriangle, color: 'text-amber-400',  bg: 'bg-amber-500/10',   border: 'border-amber-500/30' },
                        completed: { icon: CheckCircle2,  color: 'text-emerald-500',bg: 'bg-zinc-900',       border: 'border-zinc-800' },
                        failed:    { icon: AlertTriangle, color: 'text-red-400',    bg: 'bg-red-500/10',     border: 'border-red-500/30' },
                        cancelled: { icon: CircleDashed,  color: 'text-zinc-600',   bg: 'bg-zinc-900',       border: 'border-zinc-800' },
                      };
                      const sc = statusConfig[task.status] || statusConfig.pending;
                      const StatusIcon = sc.icon;
                      const priorityColors: Record<string, string> = {
                        critical: 'bg-red-500/20 text-red-400 border-red-500/30',
                        high: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
                        medium: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
                        low: 'bg-zinc-800 text-zinc-500 border-zinc-700',
                      };
                      const isWorking = task.status === 'working';

                      return (
                        <div key={task.id} className={cn(
                          "p-3 rounded-lg border flex items-start gap-3 transition-all cursor-pointer",
                          sc.bg, sc.border,
                          isWorking && "shadow-[0_0_15px_rgba(139,92,246,0.1)]",
                          task.status === 'completed' && "opacity-60"
                        )}>
                          <div className="flex flex-col items-center gap-1 pt-0.5">
                            <span className="text-[9px] font-mono text-zinc-600">#{idx + 1}</span>
                            <StatusIcon className={cn("w-4 h-4 shrink-0", sc.color, isWorking && "animate-spin")} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn("text-sm font-medium", task.status === 'completed' ? "text-zinc-400 line-through" : "text-zinc-200")}>{task.goal}</p>
                            {task.description && <p className="text-[10px] text-zinc-500 mt-0.5 line-clamp-2">{task.description}</p>}
                            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                              {/* Priority badge */}
                              <span className={cn("px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border", priorityColors[task.priority] || priorityColors.medium)}>
                                {task.priority}
                              </span>
                              {/* Skills */}
                              {task.requiredSkills?.slice(0, 2).map(s => (
                                <span key={s} className="px-1.5 py-0.5 rounded text-[8px] text-zinc-500 bg-zinc-800/50 border border-zinc-700/50">{s}</span>
                              ))}
                              {/* Dependencies indicator */}
                              {task.dependencies?.length > 0 && (
                                <span className="px-1.5 py-0.5 rounded text-[8px] text-zinc-500 bg-zinc-800/50 border border-zinc-700/50">
                                  ⬅ {task.dependencies.length} dep{task.dependencies.length > 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                          </div>
                          {/* Assignee */}
                          {assignee && (
                            <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded-md shrink-0 border", isWorking ? "bg-violet-500/20 border-violet-500/30" : "bg-zinc-800 border-transparent")}>
                              <div className={cn("w-2 h-2 rounded-full", assignee.avatarColor)} />
                              <span className={cn("text-[9px] font-semibold uppercase tracking-wider", isWorking ? "text-violet-300" : "text-zinc-400")}>{assignee.name}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Lead Agent Chat */}
              <div className="bg-[#09090b] border border-zinc-800 rounded-xl overflow-hidden flex flex-col shadow-sm shrink-0">
                <div className="bg-zinc-900 border-b border-zinc-800 px-3 py-2 flex items-center gap-2">
                  <MessageSquare className="w-3.5 h-3.5 text-violet-400" />
                  <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider">Lead Agent</span>
                  {isDecomposing && (
                    <div className="flex items-center gap-1.5 ml-auto">
                      <Loader2 className="w-3 h-3 text-violet-400 animate-spin" />
                      <span className="text-[9px] text-violet-400">Processing...</span>
                    </div>
                  )}
                </div>
                
                {/* Chat history (compact) */}
                {leadAgentChatHistory.length > 0 && (
                  <div className="max-h-[120px] overflow-y-auto custom-scrollbar p-2 space-y-1.5 border-b border-zinc-800/50">
                    {leadAgentChatHistory.slice(-6).map((msg, i) => (
                      <div key={i} className={cn("flex gap-2 text-[11px]", msg.role === 'user' ? "justify-end" : "")}>
                        {msg.role === 'agent' && <Brain className="w-3 h-3 text-violet-400 shrink-0 mt-0.5" />}
                        <span className={cn(
                          "rounded-md px-2 py-1 max-w-[90%] whitespace-pre-wrap",
                          msg.role === 'user'
                            ? "bg-violet-500/20 text-violet-200 border border-violet-500/20"
                            : "bg-zinc-800/50 text-zinc-300 border border-zinc-700/30"
                        )}>{msg.message}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Chat input */}
                <div className="p-2 flex items-center gap-2">
                  <input
                    type="text"
                    value={leadAgentChatInput}
                    onChange={(e) => setLeadAgentChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleLeadAgentChat(); }}}
                    placeholder="Issue a directive to the Lead Agent..."
                    disabled={isDecomposing}
                    className="flex-1 bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-xs text-zinc-200 outline-none focus:border-violet-500/50 placeholder:text-zinc-600 transition-colors disabled:opacity-50"
                  />
                  <button
                    onClick={handleLeadAgentChat}
                    disabled={isDecomposing || !leadAgentChatInput.trim()}
                    className="p-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Configuration & Monitor */}
            <div className="col-span-1 xl:col-span-7 flex flex-col gap-6">
              
              {/* GitHub Synchronization Center */}
              <div className="bg-[#09090b] border border-zinc-800 rounded-xl p-4 shadow-sm relative shrink-0">
                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500/50 rounded-l-xl" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 pl-1">
                    <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                      <GitBranch className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="text-sm font-bold text-zinc-100">{activeProjectMemo?.name || 'Project'}</h3>
                        <div className="relative flex items-center">
                          <button 
                            onClick={() => setIsBranchDropdownOpen(!isBranchDropdownOpen)}
                            className="px-2 py-0.5 bg-zinc-800 text-zinc-300 text-[10px] font-mono rounded border border-zinc-700 outline-none hover:border-zinc-500 hover:text-zinc-100 focus:border-indigo-500 transition-colors cursor-pointer flex items-center gap-1.5"
                          >
                            <GitBranch className="w-3 h-3 text-zinc-400" />
                            {activeProjectMemo?.activeBranch || 'main'}
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn("transition-transform", isBranchDropdownOpen ? "rotate-180" : "")}><polyline points="6 9 12 15 18 9"></polyline></svg>
                          </button>
                          
                          {isBranchDropdownOpen && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setIsBranchDropdownOpen(false)} />
                              <div className="absolute top-full left-0 mt-1 w-80 bg-[#1e1e24] border border-zinc-700 rounded-lg shadow-[0_8px_30px_rgb(0,0,0,0.4)] z-50 overflow-hidden flex flex-col font-sans">
                                <div className="px-3 py-2 border-b border-zinc-700 bg-[#25252d]">
                                  <div className="relative">
                                    <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400" />
                                    <input 
                                      type="text" 
                                      placeholder="Filter branches" 
                                      value={branchSearchQuery}
                                      onChange={(e) => setBranchSearchQuery(e.target.value)}
                                      className="w-full bg-[#1e1e24] border border-zinc-600 rounded text-xs px-7 py-1.5 text-zinc-200 outline-none focus:border-indigo-500 placeholder:text-zinc-500" 
                                    />
                                  </div>
                                </div>
                                <div className="max-h-64 overflow-y-auto custom-scrollbar flex flex-col py-1 bg-[#1e1e24]">
                                  {/* Filtered Branches Logic */}
                                  {(() => {
                                    const filtered = projectBranches.filter(b => b.name.toLowerCase().includes(branchSearchQuery.toLowerCase()));
                                    const defaults = filtered.filter(b => b.name === 'main' || b.name === 'master' || b.name === 'origin/main');
                                    const others = filtered.filter(b => !(b.name === 'main' || b.name === 'master' || b.name === 'origin/main'));
                                    
                                    return (
                                      <>
                                        {defaults.length > 0 && (
                                          <>
                                            <div className="px-3 py-1.5 text-[11px] font-semibold text-zinc-400">Default branch</div>
                                            {defaults.map(branch => (
                                              <button 
                                                key={branch.name}
                                                onClick={() => {
                                                  setProjects(projects.map(p => p.id === activeProjectId ? { ...p, activeBranch: branch.name } : p));
                                                  setIsBranchDropdownOpen(false);
                                                  setBranchSearchQuery('');
                                                }}
                                                className="flex items-center justify-between px-3 py-1.5 hover:bg-indigo-500/10 text-left transition-colors group"
                                              >
                                                <div className="flex items-center gap-2">
                                                  <GitBranch className="w-3.5 h-3.5 text-zinc-500 group-hover:text-indigo-400" />
                                                  <span className="text-xs text-zinc-300 group-hover:text-zinc-100">{branch.name}</span>
                                                </div>
                                                <span className="text-[10px] text-zinc-500">{branch.timeAgo}</span>
                                              </button>
                                            ))}
                                          </>
                                        )}
                                        
                                        {others.length > 0 && (
                                          <>
                                            <div className="px-3 py-1.5 mt-1 border-t border-zinc-700/50 text-[11px] font-semibold text-zinc-400">Other branches</div>
                                            {others.map(branch => (
                                              <button 
                                                key={branch.name}
                                                onClick={() => {
                                                  setProjects(projects.map(p => p.id === activeProjectId ? { ...p, activeBranch: branch.name } : p));
                                                  setIsBranchDropdownOpen(false);
                                                  setBranchSearchQuery('');
                                                }}
                                                className="flex items-center justify-between px-3 py-1.5 hover:bg-indigo-500/10 text-left transition-colors group"
                                              >
                                                <div className="flex items-center gap-2">
                                                  {(activeProjectMemo?.activeBranch === branch.name) ? (
                                                    <CheckCircle2 className="w-3.5 h-3.5 text-zinc-100" />
                                                  ) : (
                                                    <GitBranch className="w-3.5 h-3.5 text-zinc-500 group-hover:text-indigo-400" />
                                                  )}
                                                  <span className="text-xs text-zinc-300 group-hover:text-zinc-100">{branch.name}</span>
                                                </div>
                                                <span className="text-[10px] text-zinc-500">{branch.timeAgo}</span>
                                              </button>
                                            ))}
                                          </>
                                        )}
                                        
                                        {filtered.length === 0 && (
                                          <div className="px-3 py-4 flex flex-col items-center gap-3">
                                            <span className="text-xs text-zinc-500">No branches match "{branchSearchQuery}"</span>
                                            <button 
                                              onClick={() => {
                                                setProjects(projects.map(p => p.id === activeProjectId ? { ...p, activeBranch: branchSearchQuery } : p));
                                                setIsBranchDropdownOpen(false);
                                                setBranchSearchQuery('');
                                              }}
                                              className="px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-xs font-semibold rounded border border-indigo-500/30 transition-colors w-full flex justify-center items-center gap-2"
                                            >
                                              <GitBranch className="w-3.5 h-3.5" />
                                              Use branch '{branchSearchQuery}'
                                            </button>
                                          </div>
                                        )}
                                      </>
                                    );
                                  })()}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-zinc-500 truncate max-w-sm font-mono">
                        {activeProjectMemo?.localPath}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2">
                       <span className="relative flex h-2 w-2">
                         <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                         <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                       </span>
                       <span className="text-[10px] text-amber-500/90 uppercase tracking-wider font-semibold">3 Local Agent Modifications</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          const project = activeProjectMemo;
                          if (project?.localPath) {
                            fetch('/api/run-command', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ command: 'start "" github .', cwd: project.localPath })
                            }).then(res => {
                              if (!res.ok) alert("Failed to connect to Asclepius Terminal Backend. Did you restart the Vite server?");
                            }).catch(err => {
                              alert("Terminal Backend Offline!\n\nYou must completely stop the server (Ctrl+C) and run 'npm run dev' again so the new terminal bridge plugin can load.");
                            });
                          }
                        }}
                        className="h-7 text-xs border-zinc-700 hover:bg-zinc-800 text-zinc-300 flex items-center gap-1.5"
                      >
                        Open in GitHub Desktop
                      </Button>
                      <Button size="sm" className="h-7 text-xs bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 shadow-[0_0_10px_rgba(79,70,229,0.3)]">
                        <GitBranch className="w-3 h-3" /> Agent PR
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Active Fleet Section */}
              <div className="bg-[#09090b] border border-zinc-800 rounded-xl p-4 shadow-sm relative shrink-0">
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/50" />
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-blue-400" />
                    <h3 className="text-sm font-semibold text-zinc-100">Project Team ({activeProjectMemo?.assignedWorkerIds.length || 0})</h3>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setIsAddingWorker(true)} className="h-7 text-xs text-blue-400 hover:bg-blue-500/10 transition-colors">
                    <UserPlus className="w-3 h-3 mr-1" /> Recruit Worker
                  </Button>
                </div>
                
                {/* Scalable worker tags container */}
                <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto pr-2 custom-scrollbar">
                  {workers.filter(w => activeProjectWorkerIds.has(w.id)).map(worker => (
                    <div key={worker.id} 
                         onClick={() => { setConfiguringWorkerId(worker.id); setIsAddingWorker(false); }}
                         className={cn("group flex items-center gap-2 bg-zinc-900 border rounded-lg pr-3 pl-1 py-1 cursor-pointer transition-all", 
                                       configuringWorkerId === worker.id && !isAddingWorker ? "border-violet-500 bg-violet-500/10" : "border-zinc-800/80 hover:border-zinc-600 hover:bg-zinc-800")}>
                      <div className="relative">
                        <div className={cn("w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold text-white shadow-sm", worker.avatarColor)}>
                          {worker.name.charAt(0)}
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-zinc-900 rounded-full flex items-center justify-center group-hover:bg-zinc-800 transition-colors">
                          <div className={cn("w-1.5 h-1.5 rounded-full", worker.type === 'Cloud' ? 'bg-blue-400' : 'bg-emerald-400')} />
                        </div>
                      </div>
                      <div className="flex flex-col justify-center">
                        <span className="text-xs font-semibold text-zinc-200 leading-tight">{worker.name}</span>
                        <span className="text-[8px] text-zinc-500 tracking-wider uppercase leading-tight">{worker.role}</span>
                      </div>
                    </div>
                  ))}
                  {(!activeProjectMemo?.assignedWorkerIds.length) && !isAddingWorker && (
                    <div className="w-full text-center py-2 text-xs text-zinc-500">
                      No workers assigned yet.
                    </div>
                  )}
                </div>
              </div>

              {/* Dynamic Panel: Recruit Worker OR Worker Config & Directive */}
              {isAddingWorker ? (
                <div className="bg-zinc-900 border border-blue-500/50 rounded-xl p-5 shadow-sm flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex items-center gap-2 mb-2">
                    <UserPlus className="w-5 h-5 text-blue-400" />
                    <div>
                      <h3 className="text-sm font-bold text-zinc-100">Recruit Worker from Roster</h3>
                      <p className="text-[10px] text-zinc-500">Assign pre-configured agents to this project team.</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                    {workers.filter(w => !activeProjectWorkerIds.has(w.id)).length === 0 ? (
                      <p className="text-xs text-zinc-500 italic py-4 text-center">All available workers are already on this project.</p>
                    ) : (
                      workers.filter(w => !activeProjectWorkerIds.has(w.id)).map(w => (
                        <div key={w.id} className="flex items-center justify-between p-3 border border-zinc-800/80 rounded-lg hover:bg-zinc-800/50 transition-colors">
                           <div className="flex items-center gap-3">
                             <div className={cn("w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold text-white", w.avatarColor)}>
                                {w.name.charAt(0)}
                             </div>
                             <div className="flex flex-col">
                               <span className="text-sm font-semibold text-zinc-200">{w.name}</span>
                               <span className="text-[10px] text-zinc-500 tracking-wider uppercase">{w.role}</span>
                             </div>
                           </div>
                           <Button 
                             size="sm" 
                             onClick={() => {
                               setProjects(projects.map(p => p.id === activeProjectId ? { ...p, assignedWorkerIds: [...p.assignedWorkerIds, w.id] } : p));
                               setIsAddingWorker(false);
                             }} 
                             className="h-7 text-xs bg-blue-600 hover:bg-blue-500 text-white"
                           >
                             Assign
                           </Button>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="flex justify-between items-center mt-2 pt-4 border-t border-zinc-800">
                    <p className="text-xs text-zinc-500">Need a new persona? Create them in the Agent Fleet tab.</p>
                    <Button variant="ghost" size="sm" onClick={() => setIsAddingWorker(false)} className="text-zinc-400 h-8">Cancel</Button>
                  </div>
                </div>
              ) : activeWorkerConfig && activeProjectWorkerIds.has(activeWorkerConfig.id) ? (
                <div className={cn("bg-zinc-900 border rounded-xl p-5 shadow-sm transition-all flex flex-col flex-1", isWorkerConnected ? "border-violet-500/30" : "border-zinc-800/80")}>
                  <div className="flex items-center justify-between mb-4 border-b border-zinc-800 pb-3">
                    <div className="flex items-center gap-3">
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shadow-sm", activeWorkerConfig.avatarColor)}>
                        {activeWorkerConfig.name.charAt(0)}
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                           <input 
                             type="text"
                             value={activeWorkerConfig.name}
                             onChange={(e) => handleUpdateWorker(activeWorkerConfig.id, 'name', e.target.value)}
                             className="bg-transparent border-b border-zinc-700 hover:border-zinc-500 focus:border-violet-500 focus:outline-none transition-colors w-[140px] px-1 -ml-1 truncate"
                           />
                           Configuration
                           {isWorkerConnected && <span className="text-[9px] font-bold uppercase tracking-wider text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded border border-violet-500/20">Connected</span>}
                        </h4>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{activeWorkerConfig.role} • {activeWorkerConfig.type}</p>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      onClick={() => toggleWorkerConnection(activeWorkerConfig.id)} 
                      className={cn("h-7 text-xs", isWorkerConnected ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-300" : "bg-violet-600 hover:bg-violet-500 text-white")}
                    >
                       {isWorkerConnected ? "Disconnect" : "Authenticate"}
                    </Button>
                  </div>
                  
                  {/* Connection Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">API Endpoint</label>
                      <input 
                        type="text" 
                        value={activeWorkerConfig.endpoint || ''} 
                        onChange={(e) => handleUpdateWorker(activeWorkerConfig.id, 'endpoint', e.target.value)} 
                        placeholder="https://api..." 
                        disabled={isWorkerConnected}
                        className={cn("w-full h-8 bg-[#09090b] border border-zinc-800 rounded px-3 text-xs text-zinc-300 focus:outline-none transition-colors", isWorkerConnected ? "opacity-50 cursor-not-allowed" : "focus:border-violet-500/50")} 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">Auth Token / Google API Key</label>
                      <input 
                        type="password" 
                        value={activeWorkerConfig.token || ''} 
                        onChange={(e) => handleUpdateWorker(activeWorkerConfig.id, 'token', e.target.value)} 
                        placeholder="••••••••••••" 
                        disabled={isWorkerConnected}
                        className={cn("w-full h-8 bg-[#09090b] border border-zinc-800 rounded px-3 text-xs text-zinc-300 focus:outline-none transition-colors", isWorkerConnected ? "opacity-50 cursor-not-allowed" : "focus:border-violet-500/50")} 
                      />
                    </div>
                  </div>

                  {/* Independent Project Directive */}
                  <div className="flex flex-col flex-1 relative mt-2">
                    {!isWorkerConnected && <div className="absolute inset-0 z-10 bg-[#09090b]/40 backdrop-blur-[1px] cursor-not-allowed rounded-lg flex items-center justify-center border border-zinc-800/50"><span className="bg-zinc-900 px-3 py-1 rounded text-xs text-zinc-400 border border-zinc-800"><Lock className="w-3 h-3 inline mr-1" /> Authenticate to assign directive</span></div>}
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[10px] font-bold text-violet-400 uppercase tracking-[0.1em]">Worker Directive (Task)</label>
                    </div>
                    <textarea 
                      className="w-full flex-1 min-h-[120px] bg-[#09090b] border border-zinc-800 rounded-lg p-3 text-sm text-zinc-200 resize-none font-mono focus:outline-none focus:border-violet-500/50 transition-all custom-scrollbar"
                      placeholder={`Assign a specific task for ${activeWorkerConfig.name}...`}
                      value={activeDirective}
                      onChange={(e) => handleDirectiveChange(activeWorkerConfig.id, e.target.value)}
                      disabled={!isWorkerConnected}
                    />
                    <div className="mt-4 flex items-center justify-between">
                      <p className="text-[10px] text-zinc-500">
                        Task generation runs exclusively for this worker.
                      </p>
                      <div className="flex gap-2">
                        <Button 
                          onClick={() => handleGeneratePlan(activeWorkerConfig.id)}
                          disabled={!isWorkerConnected || isPlanning || !activeDirective.trim()}
                          className="bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-semibold text-xs h-8"
                        >
                          {isPlanning ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : <Brain className="w-3 h-3 mr-1.5" />}
                          Generate Plan
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 shadow-sm flex flex-col items-center justify-center flex-1 text-zinc-500">
                  <TerminalSquare className="w-10 h-10 mb-3 opacity-20" />
                  <p className="text-sm">Select a worker from the fleet to configure their tasks.</p>
                </div>
              )}
              
            </div>
          </div>

          {/* Pipeline Monitor Console */}
          <div className="mt-6 bg-[#09090b] border border-zinc-800 rounded-xl overflow-hidden shadow-sm flex flex-col shrink-0 w-full mb-6">
            <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TerminalSquare className="w-4 h-4 text-zinc-400" />
                <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Pipeline Execution Monitor</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-mono text-zinc-500">Live Telemetry</span>
              </div>
            </div>
            <div className="h-[140px] overflow-y-auto p-4 custom-scrollbar font-mono text-xs space-y-1.5 flex flex-col-reverse">
              <div className="space-y-1.5 flex flex-col">
                {pipelineLogs.map((log, i) => (
                  <div key={i} className="flex items-start gap-3 transition-all animate-in fade-in slide-in-from-left-2">
                    <span className="text-zinc-600 shrink-0">[{log.timeString}]</span>
                    <span className={cn(
                      log.type === 'success' ? 'text-emerald-400' :
                      log.type === 'error' ? 'text-red-400' :
                      log.type === 'warning' ? 'text-amber-400' :
                      'text-zinc-300'
                    )}>{log.message}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          </>
          ) : activeTab === 'fleet' ? (
            <div className="max-w-6xl mx-auto h-full flex flex-col">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Agent Fleet Forge</h1>
                  <p className="text-sm text-zinc-500 mt-1">Configure your AI workforce, define personas, and manage API credentials.</p>
                </div>
                <Button onClick={() => { setConfiguringWorkerId('new'); setNewWorkerName(''); setNewWorkerRole('Dev Expert'); setNewWorkerEndpoint(''); setNewWorkerToken(''); }} className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                  <UserPlus className="w-4 h-4 mr-2" /> Forge New Persona
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 flex-1 min-h-[500px]">
                {/* Left Panel: Global Roster */}
                <div className="col-span-1 md:col-span-4 flex flex-col gap-3">
                  <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest pl-1 mb-1">Global Roster ({workers.length})</h2>
                  <div className="flex flex-col gap-2 overflow-y-auto pr-2 custom-scrollbar max-h-[600px]">
                    {workers.map(worker => (
                      <div 
                        key={worker.id}
                        onClick={() => setConfiguringWorkerId(worker.id)}
                        className={cn("p-4 border rounded-xl cursor-pointer transition-all flex items-center gap-4", configuringWorkerId === worker.id ? "bg-zinc-800/80 border-emerald-500/50 shadow-sm" : "bg-zinc-900/50 border-zinc-800/80 hover:bg-zinc-800/50 hover:border-zinc-700")}
                      >
                        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold text-white shadow-sm shrink-0", worker.avatarColor)}>
                          {worker.name.charAt(0)}
                        </div>
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className="text-sm font-bold text-zinc-200 truncate">{worker.name}</span>
                          <span className="text-[10px] text-zinc-400 uppercase tracking-wider truncate">{worker.role}</span>
                        </div>
                        <div className={cn("px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider shrink-0 border", worker.type === 'Cloud' ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20")}>
                          {worker.type}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right Panel: Configuration */}
                <div className="col-span-1 md:col-span-8 bg-zinc-900 border border-zinc-800/80 rounded-xl p-8 shadow-sm h-fit">
                  {configuringWorkerId === 'new' ? (
                    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-right-4">
                      <div className="border-b border-zinc-800 pb-4 mb-2">
                        <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                           <UserPlus className="w-5 h-5 text-emerald-400" />
                           Register New Agent Persona
                        </h2>
                        <p className="text-xs text-zinc-500 mt-1">This agent will be available globally to recruit into any project team.</p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Agent Name</label>
                          <input type="text" value={newWorkerName} onChange={e => setNewWorkerName(e.target.value)} placeholder="e.g. Hephaestus" className="w-full h-10 bg-[#09090b] border border-zinc-800 rounded-lg px-3 text-sm text-zinc-200 focus:border-emerald-500/50 outline-none transition-colors" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Specialized Role</label>
                          <select value={newWorkerRole} onChange={(e) => setNewWorkerRole(e.target.value as AgentRole)} className="w-full h-10 bg-[#09090b] border border-zinc-800 rounded-lg px-3 text-sm text-zinc-200 focus:border-emerald-500/50 outline-none transition-colors">
                            <option value="Architect">Architect</option>
                            <option value="UI/UX Expert">UI/UX Expert</option>
                            <option value="Dev Expert">Dev Expert</option>
                            <option value="QA Reviewer">QA Reviewer</option>
                            <option value="Data Scientist">Data Scientist</option>
                            <option value="Security Auditor">Security Auditor</option>
                          </select>
                        </div>
                        <div className="space-y-2 col-span-2">
                          <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">System Persona Prompt</label>
                          <textarea value={newWorkerSystemPrompt} onChange={e => setNewWorkerSystemPrompt(e.target.value)} placeholder="You are an expert Frontend Developer. Your primary framework is React and TailwindCSS..." className="w-full h-24 bg-[#09090b] border border-zinc-800 rounded-lg p-3 text-sm text-zinc-200 focus:border-emerald-500/50 outline-none transition-colors resize-none" />
                        </div>
                      </div>
                      
                      <div className="flex justify-end gap-3 mt-4 pt-6 border-t border-zinc-800">
                        <Button variant="ghost" onClick={() => setConfiguringWorkerId(workers[0]?.id || null)} className="text-zinc-400">Cancel</Button>
                        <Button onClick={handleAddWorker} disabled={!newWorkerName} className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20">Finalize & Add to Roster</Button>
                      </div>
                    </div>
                  ) : configuringWorkerId ? (
                    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-right-4">
                      {(() => {
                         const worker = configuringWorkerId ? workersMap.get(configuringWorkerId) : undefined;
                         if (!worker) return null;
                         return (
                           <>
                             <div className="flex items-center gap-4 border-b border-zinc-800 pb-6 mb-2">
                               <div className={cn("w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-bold text-white shadow-md", worker.avatarColor)}>
                                 {worker.name.charAt(0)}
                               </div>
                               <div className="flex-1">
                                 <h2 className="text-2xl font-bold text-zinc-100 flex items-center gap-3">
                                   <input 
                                     type="text"
                                     value={worker.name}
                                     onChange={(e) => handleUpdateWorker(worker.id, 'name', e.target.value)}
                                     className="bg-transparent border-b border-transparent hover:border-zinc-700 focus:border-emerald-500 focus:outline-none transition-colors w-[200px]"
                                   />
                                 </h2>
                                 <div className="flex items-center gap-2 mt-1">
                                   <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{worker.role}</span>
                                   <span className="text-zinc-700">•</span>
                                   <span className="text-xs font-medium text-zinc-500">{worker.type} Engine</span>
                                 </div>
                               </div>
                               {/* Agent Class Badge */}
                               <div className={cn("px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border shrink-0",
                                 worker.role === 'Architect' ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                                 worker.role === 'UI/UX Expert' ? "bg-pink-500/10 text-pink-400 border-pink-500/20" :
                                 worker.role === 'Dev Expert' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                                 worker.role === 'QA Reviewer' ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" :
                                 worker.role === 'God-Agent' ? "bg-violet-500/10 text-violet-400 border-violet-500/20" :
                                 "bg-zinc-800 text-zinc-400 border-zinc-700"
                               )}>
                                 {worker.role === 'Architect' ? 'ArchitectAgent' :
                                  worker.role === 'UI/UX Expert' ? 'FrontendAgent' :
                                  worker.role === 'Dev Expert' ? 'BackendAgent' :
                                  worker.role === 'QA Reviewer' ? 'QAAgent' :
                                  worker.role === 'God-Agent' ? 'LeadAgent' : 'BaseAgent'}
                               </div>
                             </div>

                             {worker.role === 'God-Agent' ? (
                               <div className="space-y-8 mt-6">
                                 {/* PREMIUM GOD AGENT PANEL */}
                                 <div className="bg-gradient-to-br from-violet-900/20 to-blue-900/10 border border-violet-500/30 rounded-xl p-6 shadow-[0_0_30px_rgba(139,92,246,0.05)] relative overflow-hidden">
                                   <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-blue-500" />
                                   
                                   <div className="flex items-center gap-3 mb-6">
                                     <Brain className="w-5 h-5 text-violet-400" />
                                     <h3 className="text-lg font-bold text-zinc-100 tracking-tight">Core Intelligence Engine</h3>
                                   </div>

                                   <div className="space-y-4">
                                     <label className="text-[11px] font-bold text-violet-300 uppercase tracking-wider block">Select Active Brain</label>
                                     <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                       {[
                                         { id: 'google_jules', name: 'Jules API', icon: Cloud },
                                         { id: 'anthropic', name: 'Claude 3.5', icon: Brain },
                                         { id: 'openai', name: 'GPT-4o', icon: Brain },
                                         { id: 'local_ollama', name: 'Local Ollama', icon: Database }
                                       ].map(provider => (
                                         <button
                                           key={provider.id}
                                           onClick={() => setGodAgentConfig({...godAgentConfig, intelligenceEngine: provider.id})}
                                           className={cn(
                                             "flex flex-col items-center justify-center p-3 rounded-lg border transition-all gap-2",
                                             godAgentConfig.intelligenceEngine === provider.id
                                               ? "bg-violet-500/20 border-violet-400 text-violet-100 shadow-[0_0_15px_rgba(139,92,246,0.2)]"
                                               : "bg-[#09090b] border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
                                           )}
                                         >
                                           <provider.icon className="w-5 h-5" />
                                           <span className="text-xs font-medium">{provider.name}</span>
                                         </button>
                                       ))}
                                     </div>
                                   </div>

                                   <div className="mt-8 pt-6 border-t border-violet-500/20 space-y-6">
                                     <div className="flex items-center gap-3 mb-4">
                                       <Lock className="w-4 h-4 text-violet-400" />
                                       <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-widest">API Credentials Vault</h3>
                                     </div>

                                     {godAgentConfig.intelligenceEngine === 'google_jules' && (
                                       <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
                                         <div className="space-y-1.5">
                                           <label className="text-[10px] font-medium text-zinc-400">Google Gemini API Key / Jules Token</label>
                                           <input type="password" value={godAgentConfig.googleApiKey} onChange={e => setGodAgentConfig({...godAgentConfig, googleApiKey: e.target.value})} className="w-full h-10 bg-[#09090b] border border-zinc-800 rounded-lg px-3 text-sm text-zinc-200 focus:border-violet-500/50 outline-none" placeholder="AIzaSy..." />
                                         </div>
                                       </div>
                                     )}

                                     {godAgentConfig.intelligenceEngine === 'anthropic' && (
                                       <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
                                         <div className="space-y-1.5">
                                           <label className="text-[10px] font-medium text-zinc-400">Anthropic API Key</label>
                                           <input type="password" value={godAgentConfig.anthropicApiKey} onChange={e => setGodAgentConfig({...godAgentConfig, anthropicApiKey: e.target.value})} className="w-full h-10 bg-[#09090b] border border-zinc-800 rounded-lg px-3 text-sm text-zinc-200 focus:border-violet-500/50 outline-none" placeholder="sk-ant-..." />
                                         </div>
                                       </div>
                                     )}

                                     {godAgentConfig.intelligenceEngine === 'openai' && (
                                       <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
                                         <div className="space-y-1.5">
                                           <label className="text-[10px] font-medium text-zinc-400">OpenAI API Key</label>
                                           <input type="password" value={godAgentConfig.openaiApiKey} onChange={e => setGodAgentConfig({...godAgentConfig, openaiApiKey: e.target.value})} className="w-full h-10 bg-[#09090b] border border-zinc-800 rounded-lg px-3 text-sm text-zinc-200 focus:border-violet-500/50 outline-none" placeholder="sk-..." />
                                         </div>
                                       </div>
                                     )}

                                     {godAgentConfig.intelligenceEngine === 'local_ollama' && (
                                       <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-2">
                                         <div className="space-y-1.5">
                                           <label className="text-[10px] font-medium text-zinc-400">Ollama Local Endpoint</label>
                                           <input type="text" value={godAgentConfig.ollamaEndpoint} onChange={e => setGodAgentConfig({...godAgentConfig, ollamaEndpoint: e.target.value})} className="w-full h-10 bg-[#09090b] border border-zinc-800 rounded-lg px-3 text-sm text-zinc-200 focus:border-violet-500/50 outline-none" placeholder="http://localhost:11434" />
                                         </div>
                                         <div className="space-y-1.5">
                                           <label className="text-[10px] font-medium text-zinc-400">Model Name</label>
                                           <input type="text" value={godAgentConfig.ollamaModel} onChange={e => setGodAgentConfig({...godAgentConfig, ollamaModel: e.target.value})} className="w-full h-10 bg-[#09090b] border border-zinc-800 rounded-lg px-3 text-sm text-zinc-200 focus:border-violet-500/50 outline-none" placeholder="llama3" />
                                         </div>
                                       </div>
                                     )}
                                   </div>
                                 </div>
                               </div>
                             ) : (
                               /* STANDARD WORKER CONFIGURATION */
                               <>
                                 {/* Skills Tags */}
                             <div className="mb-4">
                               <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 block">Agent Skills</label>
                               <div className="flex flex-wrap gap-1.5">
                                 {(worker.role === 'Architect' ? ['architecture', 'fullstack'] :
                                   worker.role === 'UI/UX Expert' ? ['frontend', 'documentation'] :
                                   worker.role === 'Dev Expert' ? ['fullstack', 'backend'] :
                                   worker.role === 'QA Reviewer' ? ['qa_testing', 'code_review'] :
                                   worker.role === 'God-Agent' ? ['orchestration', 'architecture'] :
                                   worker.role === 'Security Auditor' ? ['security', 'code_review'] :
                                   ['fullstack']
                                 ).map(skill => (
                                   <span key={skill} className="px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-800 text-zinc-300 border border-zinc-700/50">{skill}</span>
                                 ))}
                               </div>
                             </div>
                             
                             <div className="grid grid-cols-1 gap-6">
                               <div className="space-y-2">
                                 <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                                   <Server className="w-3 h-3" /> Connection Endpoint
                                 </label>
                                 <input 
                                   type="text" 
                                   value={worker.endpoint} 
                                   onChange={e => handleUpdateWorker(worker.id, 'endpoint', e.target.value)} 
                                   className="w-full h-10 bg-[#09090b] border border-zinc-800 rounded-lg px-3 text-sm text-zinc-200 focus:border-emerald-500/50 outline-none transition-colors" 
                                 />
                               </div>
                               <div className="space-y-2">
                                 <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                                   <Lock className="w-3 h-3" /> API Key / Auth Token
                                 </label>
                                 <input 
                                   type="password" 
                                   value={worker.token} 
                                   onChange={e => handleUpdateWorker(worker.id, 'token', e.target.value)} 
                                   placeholder="••••••••••••" 
                                   className="w-full h-10 bg-[#09090b] border border-zinc-800 rounded-lg px-3 text-sm text-zinc-200 focus:border-emerald-500/50 outline-none transition-colors" 
                                 />
                               </div>
                               
                               <div className="pt-4 border-t border-zinc-800/80">
                                 <label className="flex items-start gap-3 cursor-pointer group">
                                   <div className="relative flex items-center justify-center mt-0.5">
                                     <input type="checkbox" defaultChecked={true} className="peer sr-only" />
                                     <div className="w-4 h-4 rounded border border-zinc-700 bg-zinc-950 peer-checked:bg-emerald-500 peer-checked:border-emerald-500 transition-all flex items-center justify-center">
                                        <CheckCircle2 className="w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                                     </div>
                                   </div>
                                   <div className="flex flex-col">
                                     <span className="text-sm font-medium text-zinc-300 group-hover:text-zinc-100 transition-colors">Graphify Architecture Access</span>
                                     <span className="text-[10px] text-zinc-500 leading-tight mt-1">Allow this agent to query the compiled Knowledge Graph for cross-file context.</span>
                                   </div>
                                 </label>
                               </div>
                             </div>
                           </>
                         )}

                         {worker.role !== 'God-Agent' && (
                               <>
                                 {/* Knowledge Assets (Skill Seekers) */}
                                 <div className="pt-4 border-t border-zinc-800/80">
                                   <div className="flex items-center justify-between mb-3">
                                     <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                                       <BookOpen className="w-3 h-3" /> Knowledge Assets
                                     </label>
                                     <span className="text-[9px] text-zinc-600">{(agentKnowledgeAssets[worker.id] || []).length} attached</span>
                                   </div>
                                   
                                   {/* Attached skills list */}
                                   <div className="space-y-1.5 mb-3">
                                     {(agentKnowledgeAssets[worker.id] || []).length === 0 ? (
                                       <p className="text-[10px] text-zinc-600 italic py-2">No knowledge assets attached. Add framework docs to boost this agent's expertise.</p>
                                     ) : (
                                       (agentKnowledgeAssets[worker.id] || []).map((path, i) => {
                                         const name = path.split('/').pop() || path;
                                         return (
                                           <div key={i} className="flex items-center justify-between px-3 py-2 bg-[#09090b] border border-zinc-800 rounded-lg group">
                                             <div className="flex items-center gap-2">
                                               <BookOpen className="w-3 h-3 text-violet-400" />
                                               <span className="text-xs text-zinc-300 truncate max-w-[250px]">{name}</span>
                                             </div>
                                             <button 
                                               onClick={() => setAgentKnowledgeAssets(prev => ({
                                                 ...prev, 
                                                 [worker.id]: (prev[worker.id] || []).filter((_, idx) => idx !== i)
                                               }))}
                                               className="text-zinc-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                             >
                                               <CircleDashed className="w-3 h-3" />
                                             </button>
                                           </div>
                                         );
                                       })
                                     )}
                                   </div>

                                   {/* Add new skill */}
                                   <div className="flex gap-2">
                                     <input
                                       type="text"
                                       value={newSkillUrl}
                                       onChange={e => setNewSkillUrl(e.target.value)}
                                       placeholder="Skill path or docs URL..."
                                       className="flex-1 h-8 bg-[#09090b] border border-zinc-800 rounded-lg px-3 text-xs text-zinc-200 focus:border-violet-500/50 outline-none transition-colors placeholder:text-zinc-700"
                                     />
                                     <Button
                                       size="sm"
                                       disabled={!newSkillUrl.trim()}
                                       onClick={() => {
                                         if (!newSkillUrl.trim()) return;
                                         setAgentKnowledgeAssets(prev => ({
                                           ...prev,
                                           [worker.id]: [...(prev[worker.id] || []), newSkillUrl.trim()]
                                         }));
                                         setNewSkillUrl('');
                                       }}
                                       className="h-8 text-xs bg-violet-600 hover:bg-violet-500 text-white"
                                     >
                                       <Plus className="w-3 h-3 mr-1" /> Attach
                                     </Button>
                                   </div>
                                   
                                   <div className="mt-3 pt-3 border-t border-zinc-800/40">
                                     <Button
                                       variant="outline"
                                       size="sm"
                                       disabled={isScanning || !activeProjectMemo}
                                       onClick={() => handleScanProject(worker.id)}
                                       className="w-full h-8 text-[11px] bg-emerald-500/5 hover:bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                     >
                                       <Zap className={`w-3 h-3 mr-1.5 ${isScanning ? 'animate-pulse' : ''}`} />
                                       {isScanning ? 'Analyzing Codebase...' : 'Scan Project Knowledge'}
                                     </Button>
                                     <p className="text-[9px] text-zinc-600 mt-1.5 text-center italic">Automatically extract architecture, patterns, and APIs from local source.</p>
                                   </div>
                                 </div>
                               </>
                             )}

                             <div className="flex justify-between mt-8 pt-6 border-t border-zinc-800">
                               {worker.role !== 'God-Agent' ? (
                                 <Button variant="ghost" onClick={() => setWorkers(workers.filter(w => w.id !== worker.id))} className="text-red-400 hover:text-red-300 hover:bg-red-500/10">Delete Persona</Button>
                               ) : (
                                 <div className="flex items-center gap-2 text-violet-400 text-xs font-bold uppercase tracking-widest px-4">
                                   <Shield className="w-4 h-4" /> Protected Core System
                                 </div>
                               )}
                               <div className="text-xs text-zinc-500 italic flex items-center">Changes saved automatically via PersistentState</div>
                             </div>
                           </>
                         );
                      })()}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-500">
                       <Users className="w-12 h-12 mb-4 opacity-20" />
                       <p className="text-sm">Select an agent persona to configure.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
