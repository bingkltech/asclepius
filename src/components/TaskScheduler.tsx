/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { Agent, ScheduledTask, ScheduleType } from "../types";
import {
  Calendar,
  Clock,
  Repeat,
  Play,
  Pause,
  Trash2,
  Plus,
  Timer,
  Zap,
  Boxes,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";

interface TaskSchedulerProps {
  agents: Agent[];
  tasks: ScheduledTask[];
  onAddTask: (task: Omit<ScheduledTask, "id" | "status">) => void;
  onDeleteTask: (id: string) => void;
  onToggleTask: (id: string) => void;
}

export function TaskScheduler({
  agents,
  tasks,
  onAddTask,
  onDeleteTask,
  onToggleTask,
}: TaskSchedulerProps) {
  const [newAgentId, setNewAgentId] = useState<string>("");
  const [newDescription, setNewDescription] = useState("");
  const [newType, setNewType] = useState<ScheduleType>("interval");
  const [newInterval, setNewInterval] = useState("60");
  const [newTime, setNewTime] = useState("");

  const handleAddTask = () => {
    if (!newAgentId || !newDescription) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (newType === "interval" && (!newInterval || parseInt(newInterval) <= 0)) {
      toast.error("Please provide a valid interval");
      return;
    }

    if (newType === "once" && !newTime) {
      toast.error("Please provide a scheduled time");
      return;
    }

    onAddTask({
      agentId: newAgentId,
      description: newDescription,
      type: newType,
      intervalMs:
        newType === "interval" ? parseInt(newInterval) * 1000 : undefined,
      scheduledTime:
        newType === "once" ? new Date(newTime).toISOString() : undefined,
    });

    setNewDescription("");
    setNewInterval("60");
    setNewTime("");
    toast.success("Task scheduled successfully");
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Task Scheduler</h1>
        <p className="text-sm text-muted-foreground/70">
          Automate agent operations with precision scheduling.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* New Task Form */}
        <div className="gradient-border rounded-xl bg-card/80 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/20">
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-violet-400" />
              <span className="text-xs font-semibold uppercase tracking-wider">
                New Task
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground/50 mt-1">
              Configure a new background operation.
            </p>
          </div>
          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                Target Agent
              </label>
              <Select value={newAgentId} onValueChange={setNewAgentId}>
                <SelectTrigger className="bg-secondary/30 border-border/50 text-xs">
                  <SelectValue placeholder="Select an agent" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border/50">
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id} className="text-xs">
                      {agent.name} — {agent.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                Task Description
              </label>
              <Input
                placeholder="e.g. Run security audit"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="bg-secondary/30 border-border/50 text-xs"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                Schedule Type
              </label>
              <Select
                value={newType}
                onValueChange={(v: ScheduleType) => setNewType(v)}
              >
                <SelectTrigger className="bg-secondary/30 border-border/50 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border/50">
                  <SelectItem value="interval" className="text-xs">Recurring Interval</SelectItem>
                  <SelectItem value="once" className="text-xs">One-time Execution</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newType === "interval" ? (
              <div className="space-y-2">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                  Interval (seconds)
                </label>
                <div className="flex items-center gap-2">
                  <Timer className="w-4 h-4 text-muted-foreground/40" />
                  <Input
                    type="number"
                    value={newInterval}
                    onChange={(e) => setNewInterval(e.target.value)}
                    min="1"
                    className="bg-secondary/30 border-border/50 text-xs"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                  Execution Time
                </label>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground/40" />
                  <Input
                    type="datetime-local"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="bg-secondary/30 border-border/50 text-xs"
                  />
                </div>
              </div>
            )}

            <Button
              className="w-full mt-2 bg-primary/90 hover:bg-primary shadow-lg shadow-primary/20 text-xs uppercase tracking-wider font-semibold"
              onClick={handleAddTask}
            >
              <Plus className="w-4 h-4 mr-2" />
              Schedule Task
            </Button>
          </div>
        </div>

        {/* Active Schedules */}
        <div className="lg:col-span-2 gradient-border rounded-xl bg-card/80 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-semibold uppercase tracking-wider">
                Active Schedules
              </span>
            </div>
            <Badge
              variant="outline"
              className="text-[9px] h-5 bg-secondary/30 border-border/50 text-muted-foreground/60"
            >
              {tasks.length} tasks
            </Badge>
          </div>
          <ScrollArea className="h-[500px]">
            <div className="p-4">
              {tasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/20 space-y-3">
                  <Clock className="w-12 h-12" />
                  <p className="text-xs uppercase tracking-widest">
                    No tasks scheduled yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <AnimatePresence initial={false}>
                    {tasks.map((task) => {
                      const agent = agents.find((a) => a.id === task.agentId);
                      const isSandbox = task.description.startsWith("[SANDBOX]");
                      return (
                        <motion.div
                          key={task.id}
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, height: 0 }}
                          className={cn(
                            "flex items-center justify-between p-4 rounded-xl border transition-colors",
                            isSandbox
                              ? "border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10"
                              : "border-border/30 bg-secondary/20 hover:bg-secondary/30"
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={cn(
                                "p-2 rounded-lg",
                                isSandbox
                                  ? "bg-amber-500/10 text-amber-400"
                                  : task.status === "active"
                                  ? "bg-emerald-500/10 text-emerald-400"
                                  : task.status === "completed"
                                  ? "bg-sky-500/10 text-sky-400"
                                  : "bg-amber-500/10 text-amber-400"
                              )}
                            >
                              {isSandbox ? (
                                <Boxes className="w-4 h-4" />
                              ) : task.type === "interval" ? (
                                <Repeat className="w-4 h-4" />
                              ) : (
                                <Clock className="w-4 h-4" />
                              )}
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">
                                  {task.description}
                                </span>
                                <Badge
                                  variant="outline"
                                  className="text-[9px] uppercase tracking-wider h-4 border-border/50 text-muted-foreground/50"
                                >
                                  {agent?.name || "Unknown"}
                                </Badge>
                              </div>
                              <div className="text-[10px] text-muted-foreground/50 flex items-center gap-3">
                                <span>
                                  {task.type === "interval"
                                    ? `Every ${task.intervalMs! / 1000}s`
                                    : `At ${new Date(task.scheduledTime!).toLocaleString()}`}
                                </span>
                                {task.lastRun && (
                                  <span>
                                    Last: {new Date(task.lastRun).toLocaleTimeString()}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground/50 hover:text-foreground"
                              onClick={() => onToggleTask(task.id)}
                            >
                              {task.status === "active" ? (
                                <Pause className="w-3.5 h-3.5" />
                              ) : (
                                <Play className="w-3.5 h-3.5" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground/30 hover:text-rose-400 hover:bg-rose-500/10"
                              onClick={() => onDeleteTask(task.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
