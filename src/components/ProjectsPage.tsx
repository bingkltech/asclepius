/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { Project, ProjectGoal, ProjectStatus, ProjectPriority, GoalStatus, Agent, SandboxRun } from "../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  FolderGit2,
  Target,
  Github,
  Users,
  ChevronRight,
  ArrowLeft,
  Trash2,
  Edit3,
  CheckCircle2,
  Circle,
  Loader2,
  AlertTriangle,
  Layers,
  Clock,
  Zap,
  X,
  Beaker,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";

interface ProjectsPageProps {
  projects: Project[];
  agents: Agent[];
  onUpdateProjects: (projects: Project[]) => void;
  sandboxRuns?: SandboxRun[];
  onNavigateToSandbox?: () => void;
}

const STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string; bg: string }> = {
  planning: { label: "Planning", color: "text-sky-400", bg: "bg-sky-500/10 border-sky-500/20" },
  active: { label: "Active", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  paused: { label: "Paused", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
  review: { label: "Review", color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20" },
  completed: { label: "Completed", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  archived: { label: "Archived", color: "text-zinc-400", bg: "bg-zinc-500/10 border-zinc-500/20" },
};

const PRIORITY_CONFIG: Record<ProjectPriority, { label: string; color: string }> = {
  low: { label: "Low", color: "text-zinc-400" },
  medium: { label: "Medium", color: "text-sky-400" },
  high: { label: "High", color: "text-amber-400" },
  critical: { label: "Critical", color: "text-rose-400" },
};

const GOAL_ICONS: Record<GoalStatus, React.ReactNode> = {
  pending: <Circle className="w-3.5 h-3.5 text-zinc-500" />,
  in_progress: <Loader2 className="w-3.5 h-3.5 text-sky-400 animate-spin" />,
  completed: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
  blocked: <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />,
};

export function ProjectsPage({ projects, agents, onUpdateProjects, sandboxRuns = [], onNavigateToSandbox }: ProjectsPageProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Create form state
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newGithubUrl, setNewGithubUrl] = useState("");
  const [newPriority, setNewPriority] = useState<ProjectPriority>("medium");
  const [newTechStack, setNewTechStack] = useState("");

  // Goal form state
  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [newGoalDescription, setNewGoalDescription] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  const handleCreateProject = () => {
    if (!newName.trim()) {
      toast.error("Project name is required.");
      return;
    }
    const project: Project = {
      id: `proj-${Date.now()}`,
      name: newName.trim(),
      description: newDescription.trim(),
      path: newGithubUrl.trim() ? `F:/012A_Github/${newName.trim().toLowerCase().replace(/\s+/g, '-')}` : "./",
      goals: [],
      githubUrl: newGithubUrl.trim(),
      status: "planning",
      assignedAgentIds: [],
      techStack: newTechStack.split(",").map(s => s.trim()).filter(Boolean),
      priority: newPriority,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onUpdateProjects([...projects, project]);
    setNewName("");
    setNewDescription("");
    setNewGithubUrl("");
    setNewTechStack("");
    setNewPriority("medium");
    setShowCreateForm(false);
    setSelectedProjectId(project.id);
    toast.success(`Project "${project.name}" created.`);
  };

  const handleDeleteProject = (id: string) => {
    onUpdateProjects(projects.filter(p => p.id !== id));
    if (selectedProjectId === id) setSelectedProjectId(null);
    toast.success("Project deleted.");
  };

  const handleUpdateProject = (updated: Project) => {
    onUpdateProjects(projects.map(p => p.id === updated.id ? { ...updated, updatedAt: new Date().toISOString() } : p));
  };

  const handleAddGoal = () => {
    if (!selectedProject || !newGoalTitle.trim()) return;
    const goal: ProjectGoal = {
      id: `goal-${Date.now()}`,
      title: newGoalTitle.trim(),
      description: newGoalDescription.trim(),
      status: "pending",
      progress: 0,
      createdAt: new Date().toISOString(),
    };
    handleUpdateProject({ ...selectedProject, goals: [...selectedProject.goals, goal] });
    setNewGoalTitle("");
    setNewGoalDescription("");
    toast.success(`Goal added: "${goal.title}"`);
  };

  const handleUpdateGoalStatus = (goalId: string, status: GoalStatus) => {
    if (!selectedProject) return;
    const goals = selectedProject.goals.map(g => {
      if (g.id === goalId) {
        const progress = status === "completed" ? 100 : status === "in_progress" ? 50 : status === "blocked" ? g.progress : 0;
        return { ...g, status, progress, completedAt: status === "completed" ? new Date().toISOString() : undefined };
      }
      return g;
    });
    handleUpdateProject({ ...selectedProject, goals });
  };

  const handleDeleteGoal = (goalId: string) => {
    if (!selectedProject) return;
    handleUpdateProject({ ...selectedProject, goals: selectedProject.goals.filter(g => g.id !== goalId) });
  };

  const handleSyncGithub = async () => {
    if (!selectedProject?.githubUrl) return;
    
    // Parse repo from URL (e.g. https://github.com/BinqQarenYu/asclepius -> BinqQarenYu/asclepius)
    const match = selectedProject.githubUrl.match(/github\.com\/([^\/]+\/[^\/]+)/);
    if (!match) {
      toast.error("Invalid GitHub URL format. Must be a github.com repository.");
      return;
    }
    const repo = match[1].replace(/\/$/, "");
    
    setIsSyncing(true);
    try {
      const res = await fetch(`https://api.github.com/repos/${repo}/issues?state=all&per_page=30`);
      if (!res.ok) throw new Error(`API returned ${res.status}`);
      const issues = await res.json();
      
      let syncedCount = 0;
      const newGoals = [...selectedProject.goals];
      
      issues.forEach((issue: any) => {
        if (!issue.pull_request) { // Skip PRs, only want issues
          const existingGoal = newGoals.find(g => g.id === `github-${issue.number}`);
          if (!existingGoal) {
            newGoals.push({
              id: `github-${issue.number}`,
              title: `[#${issue.number}] ${issue.title}`,
              description: issue.body ? issue.body.slice(0, 100) + '...' : 'Imported from GitHub',
              status: issue.state === 'closed' ? 'completed' : 'pending',
              progress: issue.state === 'closed' ? 100 : 0,
              createdAt: issue.created_at,
              completedAt: issue.closed_at || undefined,
            });
            syncedCount++;
          }
        }
      });
      
      if (syncedCount > 0) {
        handleUpdateProject({ ...selectedProject, goals: newGoals });
        toast.success(`Synced ${syncedCount} new issue(s) from GitHub.`);
      } else {
        toast.info("No new issues found to sync.");
      }
    } catch (error) {
      toast.error(`GitHub Sync failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAssignAgent = (agentId: string) => {
    if (!selectedProject) return;
    if (selectedProject.assignedAgentIds.includes(agentId)) return;
    handleUpdateProject({ ...selectedProject, assignedAgentIds: [...selectedProject.assignedAgentIds, agentId] });
    const agent = agents.find(a => a.id === agentId);
    toast.success(`${agent?.name || agentId} assigned to project.`);
  };

  const handleUnassignAgent = (agentId: string) => {
    if (!selectedProject) return;
    handleUpdateProject({ ...selectedProject, assignedAgentIds: selectedProject.assignedAgentIds.filter(id => id !== agentId) });
  };

  const getProjectProgress = (p: Project) => {
    if (p.goals.length === 0) return 0;
    return Math.round(p.goals.reduce((sum, g) => sum + g.progress, 0) / p.goals.length);
  };

  // ─── Detail View ───
  if (selectedProject) {
    const progress = getProjectProgress(selectedProject);
    const completedGoals = selectedProject.goals.filter(g => g.status === "completed").length;
    const assignedAgents = agents.filter(a => selectedProject.assignedAgentIds.includes(a.id));
    const unassignedAgents = agents.filter(a => !selectedProject.assignedAgentIds.includes(a.id));

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setSelectedProjectId(null)} className="h-8 px-2 text-muted-foreground/60 hover:text-foreground">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <div className="h-5 w-[1px] bg-border/30" />
          <div className="flex-1">
            <h1 className="text-xl font-bold tracking-tight">{selectedProject.name}</h1>
            <p className="text-[11px] text-muted-foreground/50 mt-0.5">{selectedProject.description || "No description set."}</p>
          </div>
          <Select value={selectedProject.status} onValueChange={(v: ProjectStatus) => handleUpdateProject({ ...selectedProject, status: v })}>
            <SelectTrigger className="w-[140px] h-8 text-xs bg-secondary/30 border-border/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border/50">
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <SelectItem key={key} value={key} className="text-xs">{cfg.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Meta bar */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={cn("text-[9px] h-5 border", STATUS_CONFIG[selectedProject.status].bg, STATUS_CONFIG[selectedProject.status].color)}>
            {STATUS_CONFIG[selectedProject.status].label}
          </Badge>
          <Badge variant="outline" className={cn("text-[9px] h-5 border-border/30", PRIORITY_CONFIG[selectedProject.priority].color)}>
            {PRIORITY_CONFIG[selectedProject.priority].label} Priority
          </Badge>
          {selectedProject.techStack.map(t => (
            <Badge key={t} variant="secondary" className="text-[8px] h-4 px-1.5 bg-violet-500/10 text-violet-400 border-0">{t}</Badge>
          ))}
          {selectedProject.githubUrl && (
            <a href={selectedProject.githubUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] text-sky-400 hover:text-sky-300 transition-colors">
              <Github className="w-3 h-3" />
              {selectedProject.githubUrl.replace(/^https?:\/\/(www\.)?github\.com\//, "")}
            </a>
          )}
        </div>

        {/* Progress bar */}
        <div className="gradient-border rounded-xl bg-card/80 overflow-hidden p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/50">Overall Progress</span>
            <span className="text-sm font-bold text-foreground">{progress}%</span>
          </div>
          <div className="h-2 w-full bg-secondary/40 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-violet-500 to-emerald-400 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
          <div className="text-[10px] text-muted-foreground/40">
            {completedGoals} of {selectedProject.goals.length} milestones completed
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Milestones column */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-muted-foreground/50" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Milestones</span>
              </div>
              <div className="flex items-center gap-2">
                {selectedProject.githubUrl && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={handleSyncGithub} 
                    disabled={isSyncing}
                    className="h-6 text-[9px] uppercase tracking-wider border-sky-500/20 text-sky-400 hover:bg-sky-500/10"
                  >
                    {isSyncing ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Github className="w-3 h-3 mr-1" />}
                    Sync Issues
                  </Button>
                )}
                <Badge variant="outline" className="text-[9px] h-5 bg-secondary/30 border-border/50 text-muted-foreground/60">
                  {selectedProject.goals.length} goals
                </Badge>
              </div>
            </div>

            {/* Add goal form */}
            <div className="gradient-border rounded-xl bg-card/80 overflow-hidden p-4 space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="New milestone title..."
                  value={newGoalTitle}
                  onChange={e => setNewGoalTitle(e.target.value)}
                  className="bg-secondary/30 border-border/50 text-xs flex-1"
                  onKeyDown={e => e.key === "Enter" && handleAddGoal()}
                />
                <Button size="sm" onClick={handleAddGoal} className="h-9 bg-primary/90 hover:bg-primary shadow-lg shadow-primary/20">
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add
                </Button>
              </div>
              <Input
                placeholder="Description (optional)..."
                value={newGoalDescription}
                onChange={e => setNewGoalDescription(e.target.value)}
                className="bg-secondary/30 border-border/50 text-xs"
              />
            </div>

            {/* Goals list */}
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                <AnimatePresence initial={false}>
                  {selectedProject.goals.map(goal => (
                    <motion.div
                      key={goal.id}
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-center gap-3 p-4 rounded-xl border border-border/30 bg-secondary/10 hover:bg-secondary/20 transition-colors group"
                    >
                      <button onClick={() => {
                        const next: GoalStatus = goal.status === "pending" ? "in_progress" : goal.status === "in_progress" ? "completed" : goal.status === "completed" ? "pending" : "pending";
                        handleUpdateGoalStatus(goal.id, next);
                      }}>
                        {GOAL_ICONS[goal.status]}
                      </button>
                      <div className="flex-1 space-y-0.5">
                        <div className={cn("text-sm font-medium", goal.status === "completed" && "line-through text-muted-foreground/40")}>
                          {goal.title}
                        </div>
                        {goal.description && (
                          <div className="text-[10px] text-muted-foreground/40">{goal.description}</div>
                        )}
                      </div>
                      <Select value={goal.status} onValueChange={(v: GoalStatus) => handleUpdateGoalStatus(goal.id, v)}>
                        <SelectTrigger className="w-[120px] h-7 text-[10px] bg-secondary/30 border-border/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border/50">
                          <SelectItem value="pending" className="text-xs">Pending</SelectItem>
                          <SelectItem value="in_progress" className="text-xs">In Progress</SelectItem>
                          <SelectItem value="completed" className="text-xs">Completed</SelectItem>
                          <SelectItem value="blocked" className="text-xs">Blocked</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground/20 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDeleteGoal(goal.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {selectedProject.goals.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/20 space-y-3">
                    <Target className="w-10 h-10" />
                    <p className="text-xs uppercase tracking-widest">No milestones yet. Add one above.</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Agents column */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground/50" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Assigned Agents</span>
            </div>

            <div className="gradient-border rounded-xl bg-card/80 overflow-hidden">
              <div className="p-4 space-y-3">
                {assignedAgents.length > 0 ? (
                  assignedAgents.map(agent => (
                    <div key={agent.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/20 border border-border/20 group">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full", agent.status === "paused" ? "bg-amber-400" : "bg-emerald-400")} />
                        <div>
                          <div className="text-xs font-semibold">{agent.name}</div>
                          <div className="text-[9px] text-muted-foreground/40">{agent.role}</div>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground/20 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleUnassignAgent(agent.id)}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-muted-foreground/20">
                    <Users className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-[10px] uppercase tracking-widest">No agents assigned</p>
                  </div>
                )}
              </div>
              {unassignedAgents.length > 0 && (
                <div className="px-4 pb-4">
                  <Select onValueChange={handleAssignAgent}>
                    <SelectTrigger className="w-full h-8 text-xs bg-secondary/30 border-border/50">
                      <SelectValue placeholder="+ Assign an agent..." />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border/50">
                      {unassignedAgents.map(a => (
                        <SelectItem key={a.id} value={a.id} className="text-xs">{a.name} — {a.role}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Quick Info */}
            <div className="gradient-border rounded-xl bg-card/80 overflow-hidden p-4 space-y-4">
              <div className="text-[9px] uppercase tracking-widest font-semibold text-muted-foreground/40">Project Info</div>
              {[
                { label: "Created", value: new Date(selectedProject.createdAt).toLocaleDateString(), icon: Clock },
                { label: "Updated", value: new Date(selectedProject.updatedAt).toLocaleDateString(), icon: Edit3 },
                { label: "Stack", value: selectedProject.techStack.join(", ") || "—", icon: Layers },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <item.icon className="w-3.5 h-3.5 text-muted-foreground/30" />
                    <span className="text-[10px] text-muted-foreground/50">{item.label}</span>
                  </div>
                  <span className="text-[10px] text-foreground/60 font-mono">{item.value}</span>
                </div>
              ))}
            </div>

            {/* Project Health Card */}
            {(() => {
              const runs = sandboxRuns.filter(r => r.projectId === selectedProject.id);
              const totalRuns = runs.length;
              const passedRuns = runs.filter(r => r.status === "success").length;
              const failedRuns = runs.filter(r => r.status === "error").length;
              const lastRun = runs[0];
              const activeErrors = lastRun ? lastRun.errors.filter(e => e.status === "open" && e.severity !== "info").length : 0;
              return (
                <div className="gradient-border rounded-xl bg-card/80 overflow-hidden">
                  <div className="px-4 py-3 border-b border-border/20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Beaker className="w-3.5 h-3.5 text-muted-foreground/50" />
                      <span className="text-[9px] uppercase tracking-widest font-semibold text-muted-foreground/40">Project Health</span>
                    </div>
                    {onNavigateToSandbox && (
                      <button onClick={onNavigateToSandbox} className="text-[9px] text-sky-400 hover:text-sky-300 transition-colors uppercase tracking-wider">
                        Open Sandbox →
                      </button>
                    )}
                  </div>
                  <div className="p-4 space-y-3">
                    {totalRuns > 0 ? (
                      <>
                        <div className="flex items-center gap-2">
                          {activeErrors > 0 ? (
                            <XCircle className="w-4 h-4 text-rose-400" />
                          ) : (
                            <ShieldCheck className="w-4 h-4 text-emerald-400" />
                          )}
                          <span className={cn("text-xs font-semibold", activeErrors > 0 ? "text-rose-400" : "text-emerald-400")}>
                            {activeErrors > 0 ? `${activeErrors} active errors` : "All clear"}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { label: "Runs", value: totalRuns, color: "text-foreground/60" },
                            { label: "Passed", value: passedRuns, color: "text-emerald-400" },
                            { label: "Failed", value: failedRuns, color: "text-rose-400" },
                          ].map(s => (
                            <div key={s.label} className="text-center p-2 rounded-lg bg-secondary/20">
                              <div className={cn("text-sm font-bold", s.color)}>{s.value}</div>
                              <div className="text-[8px] uppercase tracking-widest text-muted-foreground/30">{s.label}</div>
                            </div>
                          ))}
                        </div>
                        {lastRun && (
                          <div className="text-[9px] text-muted-foreground/30">
                            Last test: {new Date(lastRun.createdAt).toLocaleString()}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-3 text-muted-foreground/20">
                        <Beaker className="w-6 h-6 mx-auto mb-1" />
                        <p className="text-[9px] uppercase tracking-widest">No tests run yet</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    );
  }

  // ─── List View ───
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground/70">
            Define your vision. The autonomous fleet will execute it.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreateForm(true)} className="h-9 bg-primary/90 hover:bg-primary shadow-lg shadow-primary/20">
          <Plus className="w-4 h-4 mr-2" />
          New Project
        </Button>
      </div>

      {/* Create Form */}
      <AnimatePresence>
        {showCreateForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="gradient-border rounded-xl bg-card/80 overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-border/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderGit2 className="w-4 h-4 text-violet-400" />
                <span className="text-xs font-semibold uppercase tracking-wider">Create New Project</span>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground/30 hover:text-foreground" onClick={() => setShowCreateForm(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Project Name *</label>
                  <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. CryptoTrader Dashboard" className="bg-secondary/30 border-border/50 text-xs" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">GitHub URL</label>
                  <Input value={newGithubUrl} onChange={e => setNewGithubUrl(e.target.value)} placeholder="https://github.com/user/repo" className="bg-secondary/30 border-border/50 text-xs" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Description / README</label>
                <textarea
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  placeholder="Describe what this project is, what it aims to achieve, and the key technical requirements..."
                  rows={4}
                  className="w-full bg-secondary/30 border border-border/50 rounded-md text-xs p-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground/30"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Tech Stack (comma-separated)</label>
                  <Input value={newTechStack} onChange={e => setNewTechStack(e.target.value)} placeholder="React, TypeScript, DuckDB" className="bg-secondary/30 border-border/50 text-xs" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Priority</label>
                  <Select value={newPriority} onValueChange={(v: ProjectPriority) => setNewPriority(v)}>
                    <SelectTrigger className="bg-secondary/30 border-border/50 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border/50">
                      <SelectItem value="low" className="text-xs">Low</SelectItem>
                      <SelectItem value="medium" className="text-xs">Medium</SelectItem>
                      <SelectItem value="high" className="text-xs">High</SelectItem>
                      <SelectItem value="critical" className="text-xs">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleCreateProject} className="w-full h-10 bg-primary/90 hover:bg-primary shadow-lg shadow-primary/20 text-xs uppercase tracking-wider font-semibold">
                <Zap className="w-3.5 h-3.5 mr-2" />
                Initialize Project
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Project Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <AnimatePresence initial={false}>
          {projects.map(project => {
            const progress = getProjectProgress(project);
            const completedGoals = project.goals.filter(g => g.status === "completed").length;
            const assignedCount = project.assignedAgentIds.length;

            // Health badge from sandbox runs
            const projRuns = sandboxRuns.filter(r => r.projectId === project.id);
            const lastRun = projRuns[0];
            const activeErrors = lastRun ? lastRun.errors.filter(e => e.status === "open" && e.severity !== "info").length : 0;
            const hasRuns = projRuns.length > 0;

            return (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="gradient-border rounded-xl bg-card/80 overflow-hidden cursor-pointer hover:bg-card/90 transition-all group"
                onClick={() => setSelectedProjectId(project.id)}
              >
                <div className="p-5 space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2">
                        <FolderGit2 className="w-4 h-4 text-violet-400" />
                        <h3 className="text-sm font-semibold truncate">{project.name}</h3>
                      </div>
                      <p className="text-[10px] text-muted-foreground/40 line-clamp-2 leading-relaxed">
                        {project.description || "No description."}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/20 group-hover:text-muted-foreground/50 transition-colors mt-1 shrink-0" />
                  </div>

                  {/* Status + Priority + Health Badge */}
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn("text-[8px] h-4 border", STATUS_CONFIG[project.status].bg, STATUS_CONFIG[project.status].color)}>
                      {STATUS_CONFIG[project.status].label}
                    </Badge>
                    <Badge variant="outline" className={cn("text-[8px] h-4 border-border/30", PRIORITY_CONFIG[project.priority].color)}>
                      {PRIORITY_CONFIG[project.priority].label}
                    </Badge>
                    {hasRuns && (
                      <Badge variant="outline" className={cn("text-[8px] h-4 border gap-0.5", activeErrors > 0 ? "bg-rose-500/10 border-rose-500/20 text-rose-400" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400")}>
                        {activeErrors > 0 ? <XCircle className="w-2.5 h-2.5" /> : <ShieldCheck className="w-2.5 h-2.5" />}
                        {activeErrors > 0 ? `${activeErrors} err` : "Clean"}
                      </Badge>
                    )}
                  </div>

                  {/* Tech tags */}
                  {project.techStack.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {project.techStack.slice(0, 4).map(t => (
                        <Badge key={t} variant="secondary" className="text-[7px] h-3.5 px-1 bg-violet-500/10 text-violet-400 border-0">{t}</Badge>
                      ))}
                      {project.techStack.length > 4 && (
                        <Badge variant="secondary" className="text-[7px] h-3.5 px-1 bg-secondary/40 text-muted-foreground/40 border-0">+{project.techStack.length - 4}</Badge>
                      )}
                    </div>
                  )}

                  {/* Progress */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-[9px] uppercase tracking-widest font-semibold text-muted-foreground/40">
                      <span>{completedGoals}/{project.goals.length} milestones</span>
                      <span className="text-foreground/60">{progress}%</span>
                    </div>
                    <div className="h-1 w-full bg-secondary/40 rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all duration-700", progress === 100 ? "bg-emerald-400" : "bg-gradient-to-r from-violet-500 to-sky-400")}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/40">
                      <Users className="w-3 h-3" />
                      {assignedCount} agent{assignedCount !== 1 ? "s" : ""}
                    </div>
                    {project.githubUrl && (
                      <Github className="w-3.5 h-3.5 text-muted-foreground/20" />
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground/20 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => { e.stopPropagation(); handleDeleteProject(project.id); }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Empty state */}
      {projects.length === 0 && !showCreateForm && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/20 space-y-4">
          <FolderGit2 className="w-16 h-16" />
          <div className="text-center space-y-1">
            <p className="text-xs uppercase tracking-widest font-semibold">No projects yet</p>
            <p className="text-[10px] text-muted-foreground/30">Create your first project to begin orchestrating autonomous development.</p>
          </div>
          <Button size="sm" onClick={() => setShowCreateForm(true)} className="bg-primary/90 hover:bg-primary shadow-lg shadow-primary/20">
            <Plus className="w-3.5 h-3.5 mr-2" />
            Create First Project
          </Button>
        </div>
      )}
    </div>
  );
}
