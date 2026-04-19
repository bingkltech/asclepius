import React, { useState } from "react";
import { TerminalSquare, Play, Plus, Server, Code2, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LLMSettings, Agent, Project, SandboxRun } from "../types";

interface GodOrchestratorProps {
  settings: LLMSettings;
  godAgent: Agent;
  projects: Project[];
  sandboxRuns: SandboxRun[];
}

export function GodOrchestrator({ settings, godAgent, projects, sandboxRuns }: GodOrchestratorProps) {
  const [projectGoal, setProjectGoal] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const activeProject = projects.find(p => p.status === 'active') || projects[0];

  const handleCreateProject = () => {
    if (!projectGoal.trim()) return;
    setIsProcessing(true);
    // In a real implementation, this would trigger the God-Agent to break down the goal.
    setTimeout(() => {
      setIsProcessing(false);
      setProjectGoal("");
    }, 2000);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="mb-6 space-y-1 flex-none">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Server className="w-6 h-6 text-violet-400" />
          God-Agent Orchestrator
        </h1>
        <p className="text-sm text-muted-foreground/70">
          Define project goals and monitor autonomous cloud workers executing tasks in parallel.
        </p>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        {/* Left Column: Command & Orchestration */}
        <div className="flex flex-col w-1/3 min-w-[300px] gap-6">
          <div className="gradient-border rounded-xl bg-card/80 p-5 flex flex-col gap-4">
            <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
              New Project Goal
            </h3>
            <div className="space-y-4">
              <textarea
                value={projectGoal}
                onChange={(e) => setProjectGoal(e.target.value)}
                placeholder="E.g., Build a complete authentication system with JWT..."
                className="w-full h-32 bg-secondary/30 rounded-md border border-border/50 p-3 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/50 resize-none"
              />
              <Button 
                onClick={handleCreateProject}
                disabled={!projectGoal.trim() || isProcessing}
                className="w-full bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-900/20"
              >
                {isProcessing ? "Decomposing Tasks..." : "Orchestrate Project"}
                {!isProcessing && <Play className="w-4 h-4 ml-2" />}
              </Button>
            </div>
          </div>

          <div className="gradient-border rounded-xl bg-card/80 p-5 flex-1 flex flex-col min-h-0">
             <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground mb-4">
              Cloud Worker Pool (Jules)
            </h3>
            <ScrollArea className="flex-1 -mx-2 px-2">
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-secondary/20 border border-border/50 rounded-lg p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Cpu className="w-5 h-5 text-sky-400" />
                      <div>
                        <div className="text-xs font-semibold">Jules Worker {i}</div>
                        <div className="text-[10px] text-muted-foreground">Account {i} • {i === 1 ? 'Working' : 'Idle'}</div>
                      </div>
                    </div>
                    {i === 1 && (
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Right Column: Execution Pipeline */}
        <div className="gradient-border rounded-xl bg-card/80 flex flex-col flex-1 min-w-0">
          <div className="p-4 border-b border-border/50 flex items-center gap-3 bg-secondary/10">
            <Code2 className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-sm font-semibold">Active Project: {activeProject?.name || "None"}</h2>
              <p className="text-[10px] text-muted-foreground">Delivery Pipeline Status</p>
            </div>
          </div>
          
          <ScrollArea className="flex-1 p-4">
            {activeProject ? (
              <div className="space-y-4">
                {activeProject.goals.map((goal, idx) => (
                  <div key={goal.id} className="border border-border/50 rounded-lg p-4 bg-background/50 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-violet-500 to-sky-500" />
                    <div className="flex items-center justify-between mb-2 pl-2">
                      <span className="text-xs font-semibold text-foreground/80">{goal.description}</span>
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{goal.status}</span>
                    </div>
                    <div className="pl-2">
                      <div className="h-1.5 w-full bg-secondary/40 rounded-full overflow-hidden mt-3">
                        <div
                          className="h-full bg-gradient-to-r from-violet-500 to-sky-400 rounded-full transition-all duration-700"
                          style={{ width: `${goal.progress}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-2 text-[9px] text-muted-foreground/60">
                        <span>Assigned to: Jules-{idx + 1}</span>
                        <span>{goal.progress}% complete</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground/40 space-y-4">
                <TerminalSquare className="w-12 h-12" />
                <p className="text-sm">No active project in pipeline.</p>
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
