/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { getUnifiedCodeAnalysis, resolveAgentSettings } from "@/src/services/llm";
import { CodeAnalysis, LLMSettings, Project, SandboxRun, SandboxError as SandboxErrorType, Agent, awardAgentXP } from "@/src/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sparkles,
  Bug,
  Lightbulb,
  Loader2,
  Play,
  RotateCcw,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FolderGit2,
  History,
  ChevronDown,
  Zap,
  XCircle,
  Info,
  ListTodo,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SandboxProps {
  settings: LLMSettings;
  projects?: Project[];
  agents?: Agent[];
  sandboxRuns?: SandboxRun[];
  onUpdateRuns?: (runs: SandboxRun[]) => void;
  onCreateTask?: (task: { agentId: string; description: string; type: string }) => void;
  onPostSystemMessage?: (sender: string, content: string) => void;
  selectedProjectId?: string;
  onSelectProject?: (id: string) => void;
  onUpdateAgent?: (agent: Agent) => void;
}

const SEVERITY_CONFIG: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  critical: { icon: <XCircle className="w-3.5 h-3.5" />, color: "text-rose-400", bg: "bg-rose-500/10 border-rose-500/20" },
  warning: { icon: <AlertTriangle className="w-3.5 h-3.5" />, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
  info: { icon: <Info className="w-3.5 h-3.5" />, color: "text-sky-400", bg: "bg-sky-500/10 border-sky-500/20" },
};

export function Sandbox({ settings, projects = [], agents = [], sandboxRuns = [], onUpdateRuns, onCreateTask, onPostSystemMessage, selectedProjectId = "none", onSelectProject, onUpdateAgent }: SandboxProps) {
  const [code, setCode] = useState(`function calculateTotal(items) {
  let total = 0;
  for (var i = 0; i < items.length; i++) {
    total += items[i].price;
  }
  return total;
}`);
  const handleSetSelectedProjectId = (id: string) => {
    if (onSelectProject) {
      onSelectProject(id);
    }
  };
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentRun, setCurrentRun] = useState<SandboxRun | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showRoutingModal, setShowRoutingModal] = useState(false);
  const [pendingTasks, setPendingTasks] = useState<{ error: SandboxErrorType, agentId: string }[]>([]);

  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const projectRuns = sandboxRuns.filter(r => selectedProjectId === "none" ? !r.projectId : r.projectId === selectedProjectId);

  const parseErrors = (analysis: CodeAnalysis): SandboxErrorType[] => {
    const errors: SandboxErrorType[] = [];
    if (analysis.bugs) {
      analysis.bugs.forEach((bug, i) => {
        if (bug && bug !== "Failed to analyze code") {
          const lineMatch = bug.match(/line\s*(\d+)/i);
          const colMatch = bug.match(/col(?:umn)?\s*(\d+)/i);
          const fileMatch = bug.match(/(?:in|at|file)\s+['"]?([\w./-]+\.\w+)['"]?/i) || bug.match(/\[([\w./-]+\.\w+)\]/);
          errors.push({
            id: `err-${Date.now()}-${i}`,
            message: bug,
            severity: bug.toLowerCase().includes("security") || bug.toLowerCase().includes("vulnerab") ? "critical" : "warning",
            line: lineMatch ? parseInt(lineMatch[1]) : undefined,
            column: colMatch ? parseInt(colMatch[1]) : undefined,
            filePath: fileMatch ? fileMatch[1] : undefined,
            status: "open",
          });
        }
      });
    }
    if (analysis.suggestions) {
      analysis.suggestions.forEach((sug, i) => {
        if (sug) {
          const lineMatch = sug.match(/line\s*(\d+)/i);
          const colMatch = sug.match(/col(?:umn)?\s*(\d+)/i);
          const fileMatch = sug.match(/(?:in|at|file)\s+['"]?([\w./-]+\.\w+)['"]?/i) || sug.match(/\[([\w./-]+\.\w+)\]/);
          errors.push({
            id: `info-${Date.now()}-${i}`,
            message: sug,
            severity: "info",
            line: lineMatch ? parseInt(lineMatch[1]) : undefined,
            column: colMatch ? parseInt(colMatch[1]) : undefined,
            filePath: fileMatch ? fileMatch[1] : undefined,
            status: "open",
          });
        }
      });
    }
    return errors;
  };

  const handleAnalyze = async () => {
    if (!code.trim()) {
      toast.error("Paste some code to analyze.");
      return;
    }

    setIsAnalyzing(true);
    const runId = `run-${Date.now()}`;
    const run: SandboxRun = {
      id: runId,
      projectId: selectedProjectId !== "none" ? selectedProjectId : undefined,
      code,
      status: "running",
      output: [
        "Initializing analysis environment...",
        `Provider: ${settings.provider === "gemini" ? `Gemini (${settings.geminiModel})` : `Ollama (${settings.ollamaModel})`}`,
        selectedProject ? `Project context: ${selectedProject.name}` : "No project scope.",
        "Sending code to AI for deep analysis...",
      ],
      errors: [],
      createdAt: new Date().toISOString(),
    };
    setCurrentRun(run);

    try {
      // Leak #6 fix: Use Healer-01's personal credentials for analysis
      const healerAgent = agents.find(a => a.id === "a3" || a.name === "Healer-01");
      const analysisSettings = resolveAgentSettings(healerAgent, settings);
      const analysis = await getUnifiedCodeAnalysis(analysisSettings, code);
      const errors = parseErrors(analysis);
      const hasCritical = errors.some(e => e.severity === "critical");
      const hasWarning = errors.some(e => e.severity === "warning");

      const completedRun: SandboxRun = {
        ...run,
        status: hasCritical ? "error" : hasWarning ? "warning" : "success",
        analysis,
        errors,
        output: [
          ...run.output,
          "───────────────────────────────",
          `Analysis complete: ${errors.filter(e => e.severity === "critical").length} critical, ${errors.filter(e => e.severity === "warning").length} warnings, ${errors.filter(e => e.severity === "info").length} suggestions`,
          ...(analysis.bugs || []).map(b => `✗ BUG: ${b}`),
          ...(analysis.suggestions || []).map(s => `→ SUGGESTION: ${s}`),
          "───────────────────────────────",
          hasCritical ? "⚠ CRITICAL ISSUES DETECTED. Review required." : hasWarning ? "⚡ Warnings found. Improvements recommended." : "✓ All checks passed. Code looks clean.",
        ],
      };

      setCurrentRun(completedRun);
      if (onUpdateRuns) {
        onUpdateRuns([completedRun, ...sandboxRuns].slice(0, 50));
      }

      // ─── Grant XP & Update Reputation for the analyzing agent ───
      if (healerAgent && onUpdateAgent) {
        const xpGained = hasCritical ? 150 : hasWarning ? 100 : 50;
        const { updatedAgent, levelUps } = awardAgentXP(healerAgent, "analysis", xpGained);
        
        // Reputation: analysis itself is always a "successful task"
        const newTotal = (updatedAgent.reputation.totalTasks || 0) + 1;
        const newRate = Math.round(((newTotal - (updatedAgent.reputation.failedTasks || 0)) / newTotal) * 100);
        const reputationAgent = {
          ...updatedAgent,
          reputation: {
            ...updatedAgent.reputation,
            totalTasks: newTotal,
            successRate: newRate,
            trend: (newRate >= updatedAgent.reputation.successRate ? "improving" : "stable") as "improving" | "stable" | "declining",
          },
        };
        onUpdateAgent(reputationAgent);
        
        levelUps.forEach(msg => {
          toast.success(`Level Up! ${reputationAgent.name}: ${msg}`);
          if (onPostSystemMessage) onPostSystemMessage("SYSTEM", `🎉 **LEVEL UP:** ${reputationAgent.name} - ${msg}`);
        });
      }

      // Post event to Command Center
      if (onPostSystemMessage) {
        const critCount = errors.filter(e => e.severity === "critical").length;
        const warnCount = errors.filter(e => e.severity === "warning").length;
        const projLabel = selectedProject ? ` in **${selectedProject.name}**` : "";
        if (hasCritical) {
          onPostSystemMessage("SANDBOX", `[CRITICAL] Analysis detected **${critCount} critical** and **${warnCount} warning(s)**${projLabel}. Immediate resolution required.`);
        } else if (hasWarning) {
          onPostSystemMessage("SANDBOX", `[WARNING] Analysis found **${warnCount} warning(s)**${projLabel}. Review recommended.`);
        } else {
          onPostSystemMessage("SANDBOX", `[PASS] Code analysis passed with 0 issues${projLabel}. ✓`);
        }
      }

      if (hasCritical) {
        toast.error(`Analysis found ${errors.filter(e => e.severity === "critical").length} critical issues.`);
      } else if (hasWarning) {
        toast.warning(`Analysis found ${errors.filter(e => e.severity === "warning").length} warnings.`);
      } else {
        toast.success("Code analysis passed. No issues found.");
      }
    } catch (error) {
      const failedRun: SandboxRun = {
        ...run,
        status: "error",
        output: [...run.output, `✗ Analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`],
        errors: [],
      };
      setCurrentRun(failedRun);
      if (onUpdateRuns) {
        onUpdateRuns([failedRun, ...sandboxRuns].slice(0, 50));
      }
      toast.error("Analysis failed. Check your provider connection.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ─── Smart Agent Routing: find best-fit agent for an error ───
  const findBestAgent = (error: SandboxErrorType): string => {
    // Priority: security errors → security-skilled agents, bugs → analysis/engineering agents
    const isSecurity = error.message.toLowerCase().match(/security|vulnerab|inject|xss|auth|csrf/);
    const isBug = error.message.toLowerCase().match(/bug|error|crash|null|undefined|type/);
    const isPerformance = error.message.toLowerCase().match(/performance|slow|memory|leak|optimi/);

    // Score each agent based on skill match
    let bestAgent = "god"; // fallback
    let bestScore = -1;

    agents.forEach(a => {
      if (a.status === "paused" || a.id === "god") return; // Don't burden God with grunt work

      // Token Budget Constraint (Hard Block)
      if (a.budget && a.budget.dailyTokenLimit > 0) {
        const utilRatio = a.budget.dailyTokensUsed / a.budget.dailyTokenLimit;
        if (utilRatio >= 1 && a.budget.overage === "block") return; // Skip agent if fully exhausted
      }

      let score = 0;
      a.skills.forEach(s => {
        const cat = s.category;
        const name = s.name.toLowerCase();
        if (isSecurity && (cat === "security" || name.includes("security") || name.includes("vulnerab"))) score += s.level * 3;
        if (isBug && (cat === "analysis" || name.includes("bug") || name.includes("detect") || name.includes("repair"))) score += s.level * 3;
        if (isBug && cat === "engineering") score += s.level * 2;
        if (isPerformance && (name.includes("performance") || name.includes("optimi"))) score += s.level * 3;
        // General capability bonus
        if (cat === "engineering" || cat === "analysis") score += s.level;
      });

      // Token Budget Heuristic (Soft Penalty)
      if (a.budget && a.budget.dailyTokenLimit > 0) {
        const utilRatio = Math.min(1, a.budget.dailyTokensUsed / a.budget.dailyTokenLimit);
        // Deprioritize agents that are close to their limits (up to 50% score penalty)
        score = score * (1 - (utilRatio * 0.5));
      }

      if (score > bestScore) {
        bestScore = score;
        bestAgent = a.id;
      }
    });
    return bestAgent;
  };

  const handlePreviewTasks = () => {
    if (!currentRun || !onCreateTask) return;
    const actionableErrors = currentRun.errors.filter(e => e.severity === "critical" || e.severity === "warning");
    if (actionableErrors.length === 0) {
      toast.info("No actionable errors to create tasks from.");
      return;
    }
    const tasks = actionableErrors.map(err => ({
      error: err,
      agentId: findBestAgent(err)
    }));
    setPendingTasks(tasks);
    setShowRoutingModal(true);
  };

  const handleConfirmTasks = () => {
    const assignmentSummary: string[] = [];
    pendingTasks.forEach(({ error, agentId }) => {
      const bestAgentName = agents.find(a => a.id === agentId)?.name || agentId;
      onCreateTask!({
        agentId: agentId,
        description: `[SANDBOX] Fix: ${error.message}${selectedProject ? ` (Project: ${selectedProject.name})` : ""}`,
        type: "once",
      });
      assignmentSummary.push(`• **${error.severity.toUpperCase()}** → ${bestAgentName}: ${error.message.slice(0, 60)}`);
    });

    if (onPostSystemMessage) {
      onPostSystemMessage("SANDBOX", `[MANUAL-TASK] ${pendingTasks.length} resolution task(s) overridden and routed:\n${assignmentSummary.join("\n")}`);
    }
    toast.success(`${pendingTasks.length} resolution task(s) successfully routed.`);
    setShowRoutingModal(false);
  };

  const reset = () => {
    setCurrentRun(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Sandbox</h1>
          <p className="text-sm text-muted-foreground/70">
            Test, analyze, and harden your project code with AI-powered review.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Project selector */}
            <Select value={selectedProjectId} onValueChange={handleSetSelectedProjectId}>
            <SelectTrigger className="w-[220px] h-9 text-xs bg-secondary/30 border-border/50">
              <FolderGit2 className="w-3.5 h-3.5 mr-2 text-violet-400" />
              <span className="truncate">
                {selectedProjectId === "none" || !selectedProject
                  ? "No project scope"
                  : selectedProject.name}
              </span>
            </SelectTrigger>
            <SelectContent className="bg-card border-border/50">
              <SelectItem value="none" className="text-xs">No project scope</SelectItem>
              {projects.filter(p => p.status !== 'archived').map(p => (
                <SelectItem key={p.id} value={p.id} className="text-xs">
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={() => setShowHistory(!showHistory)} className="h-9 border-border/50 bg-secondary/30">
            <History className="w-3.5 h-3.5 mr-2" />
            History
            {projectRuns.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-[8px] h-4 px-1 bg-violet-500/10 text-violet-400 border-0">{projectRuns.length}</Badge>
            )}
          </Button>
        </div>
      </div>

      {/* Selected project context bar */}
      {selectedProject && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-violet-500/20 bg-violet-500/5">
          <FolderGit2 className="w-4 h-4 text-violet-400" />
          <span className="text-xs font-semibold text-violet-300">{selectedProject.name}</span>
          <span className="text-[10px] text-muted-foreground/40">—</span>
          <div className="flex flex-wrap gap-1">
            {selectedProject.techStack.map(t => (
              <Badge key={t} variant="secondary" className="text-[7px] h-3.5 px-1 bg-violet-500/10 text-violet-400 border-0">{t}</Badge>
            ))}
          </div>
          <span className="text-[10px] text-muted-foreground/40 ml-auto">{selectedProject.goals.length} milestones</span>
        </motion.div>
      )}

      {/* Main workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 h-[calc(100vh-16rem)]">
        {/* Code Editor — 3 cols */}
        <div className="lg:col-span-3 gradient-border rounded-xl overflow-hidden bg-card/80 flex flex-col">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/20 bg-card/60">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
              </div>
              <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/50 ml-1">
                Source Code
              </span>
              {currentRun && (
                <Badge variant="outline" className={cn("text-[8px] h-4 border", currentRun.status === "success" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : currentRun.status === "error" ? "bg-rose-500/10 text-rose-400 border-rose-500/20" : currentRun.status === "warning" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-sky-500/10 text-sky-400 border-sky-500/20")}>
                  {currentRun.status}
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={reset} disabled={isAnalyzing} className="h-7 text-[10px] uppercase tracking-wider text-muted-foreground/50 hover:text-foreground">
                <RotateCcw className="w-3 h-3 mr-1.5" />
                Reset
              </Button>
              <Button size="sm" onClick={handleAnalyze} disabled={isAnalyzing} className="h-7 text-[10px] uppercase tracking-wider font-semibold bg-primary/90 hover:bg-primary shadow-lg shadow-primary/20">
                {isAnalyzing ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1.5" />}
                Analyze
              </Button>
            </div>
          </div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full flex-1 p-4 font-mono text-sm bg-[hsl(228,16%,5%)] text-emerald-300/80 resize-none focus:outline-none leading-relaxed placeholder:text-muted-foreground/20"
            spellCheck={false}
            placeholder="Paste your code here for AI-powered analysis..."
          />
          {/* Terminal output */}
          {currentRun && currentRun.output.length > 0 && (
            <div className="border-t border-border/20 bg-[hsl(228,16%,4%)] max-h-[200px] overflow-y-auto p-3 space-y-0.5">
              <AnimatePresence initial={false}>
                {currentRun.output.map((line, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className={cn(
                      "text-[11px] font-mono leading-relaxed",
                      line.startsWith("✓") ? "text-emerald-400" :
                      line.startsWith("✗") ? "text-rose-400" :
                      line.startsWith("→") ? "text-sky-400" :
                      line.startsWith("⚠") ? "text-amber-400" :
                      line.startsWith("───") ? "text-zinc-700" :
                      "text-zinc-500"
                    )}
                  >
                    <span className="text-zinc-700 mr-2">$</span>
                    {line}
                  </motion.div>
                ))}
              </AnimatePresence>
              {isAnalyzing && (
                <div className="flex items-center gap-2 text-sky-400/70 text-[11px]">
                  <span className="text-zinc-700 mr-2">$</span>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Processing...
                </div>
              )}
            </div>
          )}
        </div>

        {/* Analysis Panel — 2 cols */}
        <div className="lg:col-span-2 space-y-4 overflow-y-auto">
          {/* Errors & Suggestions */}
          {currentRun?.analysis ? (
            <>
              {/* Errors card */}
              {currentRun.errors.filter(e => e.severity !== "info").length > 0 && (
                <div className="gradient-border rounded-xl bg-card/80 overflow-hidden">
                  <div className="px-4 py-3 border-b border-border/20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bug className="w-4 h-4 text-rose-400" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                        Issues ({currentRun.errors.filter(e => e.severity !== "info").length})
                      </span>
                    </div>
                    {onCreateTask && (
                      <Button size="sm" variant="outline" onClick={handlePreviewTasks} className="h-6 text-[9px] uppercase tracking-wider border-amber-500/20 text-amber-400 hover:bg-amber-500/10">
                        <ListTodo className="w-3 h-3 mr-1" />
                        Preview & Route Tasks
                      </Button>
                    )}
                  </div>
                  <div className="p-3 space-y-2">
                    {currentRun.errors.filter(e => e.severity !== "info").map(err => (
                      <div key={err.id} className={cn("flex items-start gap-2.5 p-3 rounded-lg border", SEVERITY_CONFIG[err.severity].bg)}>
                        <div className={cn("mt-0.5", SEVERITY_CONFIG[err.severity].color)}>
                          {SEVERITY_CONFIG[err.severity].icon}
                        </div>
                        <div className="space-y-1 flex-1">
                          <p className="text-xs leading-relaxed">{err.message}</p>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={cn("text-[7px] h-3.5 border", SEVERITY_CONFIG[err.severity].bg, SEVERITY_CONFIG[err.severity].color)}>
                              {err.severity}
                            </Badge>
                            {err.filePath && (
                              <span className="text-[9px] text-muted-foreground/40 font-mono truncate max-w-[120px]">{err.filePath}</span>
                            )}
                            {(err.line || err.column) && (
                              <span className="text-[9px] text-muted-foreground/40 font-mono">
                                Line {err.line || '?'}{err.column ? `:${err.column}` : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggestions card */}
              {currentRun.errors.filter(e => e.severity === "info").length > 0 && (
                <div className="gradient-border rounded-xl bg-card/80 overflow-hidden">
                  <div className="px-4 py-3 border-b border-border/20">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-sky-400" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                        Suggestions ({currentRun.errors.filter(e => e.severity === "info").length})
                      </span>
                    </div>
                  </div>
                  <div className="p-3 space-y-2">
                    {currentRun.errors.filter(e => e.severity === "info").map(sug => (
                      <div key={sug.id} className="flex items-start gap-2.5 p-3 rounded-lg border bg-sky-500/5 border-sky-500/15">
                        <Lightbulb className="w-3.5 h-3.5 text-sky-400 mt-0.5 shrink-0" />
                        <p className="text-xs leading-relaxed text-muted-foreground/70">{sug.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI explanation */}
              {currentRun.analysis.explanation && (
                <div className="gradient-border rounded-xl bg-card/80 overflow-hidden">
                  <div className="px-4 py-3 border-b border-border/20">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-violet-400" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">AI Explanation</span>
                    </div>
                  </div>
                  <div className="p-4">
                    <p className="text-xs leading-relaxed text-muted-foreground/70">{currentRun.analysis.explanation}</p>
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="gradient-border rounded-xl bg-card/80 overflow-hidden p-4">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Critical", count: currentRun.errors.filter(e => e.severity === "critical").length, color: "text-rose-400" },
                    { label: "Warnings", count: currentRun.errors.filter(e => e.severity === "warning").length, color: "text-amber-400" },
                    { label: "Suggestions", count: currentRun.errors.filter(e => e.severity === "info").length, color: "text-sky-400" },
                  ].map(stat => (
                    <div key={stat.label} className="text-center space-y-1">
                      <div className={cn("text-lg font-bold", stat.color)}>{stat.count}</div>
                      <div className="text-[9px] uppercase tracking-widest text-muted-foreground/40">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            /* Empty state */
            <div className="gradient-border rounded-xl bg-card/80 overflow-hidden h-full flex flex-col items-center justify-center text-muted-foreground/20 space-y-4 p-8">
              <Sparkles className="w-12 h-12" />
              <div className="text-center space-y-1">
                <p className="text-xs uppercase tracking-widest font-semibold">Ready for Analysis</p>
                <p className="text-[10px] text-muted-foreground/30 max-w-[200px]">Paste your code and click Analyze to run AI-powered review.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Run History */}
      <AnimatePresence>
        {showHistory && projectRuns.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="gradient-border rounded-xl bg-card/80 overflow-hidden"
          >
            <div className="px-5 py-3 border-b border-border/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-muted-foreground/50" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Run History</span>
              </div>
              <span className="text-[10px] text-muted-foreground/40">{projectRuns.length} runs</span>
            </div>
            <ScrollArea className="max-h-[250px]">
              <div className="p-3 space-y-1.5">
                {projectRuns.map(run => {
                  const criticalCount = run.errors.filter(e => e.severity === "critical").length;
                  const warnCount = run.errors.filter(e => e.severity === "warning").length;
                  return (
                    <div
                      key={run.id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border/20 bg-secondary/10 hover:bg-secondary/20 transition-colors cursor-pointer"
                      onClick={() => setCurrentRun(run)}
                    >
                      {run.status === "success" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : run.status === "error" ? (
                        <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      )}
                      <div className="flex-1 space-y-0.5">
                        <div className="text-xs font-medium">
                          Run {run.id.replace("run-", "").slice(-6)}
                          {run.projectId && (
                            <span className="text-muted-foreground/30 ml-2">
                              {projects.find(p => p.id === run.projectId)?.name}
                            </span>
                          )}
                        </div>
                        <div className="text-[9px] text-muted-foreground/40">
                          {criticalCount > 0 && <span className="text-rose-400">{criticalCount} critical</span>}
                          {warnCount > 0 && <span className="text-amber-400 ml-2">{warnCount} warnings</span>}
                          {criticalCount === 0 && warnCount === 0 && <span className="text-emerald-400">Clean</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground/30">
                        <Clock className="w-3 h-3" />
                        {new Date(run.createdAt).toLocaleTimeString()}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Manual Routing Override Modal */}
      <Dialog open={showRoutingModal} onOpenChange={setShowRoutingModal}>
        <DialogContent className="sm:max-w-[600px] bg-card/95 backdrop-blur-xl border-border/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Boxes className="w-5 h-5 text-amber-400" />
              Manual Routing Override
            </DialogTitle>
            <DialogDescription>
              Review and override the AI's suggested task routing before dispatching to the fleet.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            {pendingTasks.map((task, index) => (
              <div key={task.error.id} className="flex flex-col gap-2 p-3 rounded-lg border border-border/30 bg-secondary/10">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={cn("text-[8px] h-4 border", SEVERITY_CONFIG[task.error.severity].bg, SEVERITY_CONFIG[task.error.severity].color)}>
                        {task.error.severity}
                      </Badge>
                      <span className="text-xs font-mono text-muted-foreground line-clamp-1">{task.error.message}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border/20">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/60 shrink-0">Assign to:</span>
                  <Select
                    value={task.agentId}
                    onValueChange={(val) => {
                      const newTasks = [...pendingTasks];
                      newTasks[index].agentId = val;
                      setPendingTasks(newTasks);
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs bg-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {agents.filter(a => a.status !== "paused").map(a => (
                        <SelectItem key={a.id} value={a.id}>
                          <div className="flex items-center gap-2">
                            <div className={cn("w-1.5 h-1.5 rounded-full", a.status === 'working' ? 'bg-amber-400' : 'bg-emerald-400')} />
                            {a.name} <span className="text-muted-foreground ml-1">({a.role})</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter className="border-t border-border/20 pt-4">
            <Button variant="ghost" onClick={() => setShowRoutingModal(false)}>Cancel</Button>
            <Button onClick={handleConfirmTasks} className="bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20">
              Confirm & Dispatch Tasks
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
