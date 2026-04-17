/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from "react";
import { Agent, LLMProvider, AgentSkill, SKILL_LEVEL_NAMES, SKILL_CATEGORY_COLORS, SkillCategory } from "@/src/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Activity,
  ShieldAlert,
  Zap,
  Brain,
  Settings2,
  Cpu,
  History,
  Search,
  GripVertical,
  Crown,
  Sparkles,
  Signal,
  Heart,
  Star,
  Pause,
  Play,
  Trash2,
  Shield,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ChatMessage } from "@/src/types";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { AgentConfig } from "./AgentConfig";

interface AgentCardProps {
  agent: Agent;
  onUpdateAgent?: (agent: Agent) => void;
  messages?: ChatMessage[];
  onDragStart?: (e: React.DragEvent, agentId: string) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent, agentId: string) => void;
  isDragging?: boolean;
  isDragOver?: boolean;
  onPause?: (agentId: string) => void;
  onResume?: (agentId: string) => void;
  onTerminate?: (agentId: string) => void;
}

const statusConfig: Record<
  string,
  { icon: React.ReactNode; color: string; bg: string; label: string }
> = {
  idle: {
    icon: <Signal className="w-3 h-3" />,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    label: "Online",
  },
  working: {
    icon: <Zap className="w-3 h-3" />,
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
    label: "Working",
  },
  healing: {
    icon: <ShieldAlert className="w-3 h-3" />,
    color: "text-rose-400",
    bg: "bg-rose-500/10 border-rose-500/20",
    label: "Healing",
  },
  learning: {
    icon: <Brain className="w-3 h-3" />,
    color: "text-sky-400",
    bg: "bg-sky-500/10 border-sky-500/20",
    label: "Learning",
  },
  error: {
    icon: <ShieldAlert className="w-3 h-3" />,
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/20",
    label: "Error",
  },
  paused: {
    icon: <Pause className="w-3 h-3" />,
    color: "text-zinc-400",
    bg: "bg-zinc-500/10 border-zinc-500/20",
    label: "Paused",
  },
};

const skillCategoryBg: Record<SkillCategory, string> = {
  engineering: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  analysis: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  operations: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  security: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  creative: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  meta: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
};

// ─── Heartbeat Sparkline Component ───
function HeartbeatSparkline({ history, status }: { history: Agent["heartbeat"]["history"]; status: Agent["heartbeat"]["status"] }) {
  if (history.length < 2) return null;

  const maxResp = Math.max(...history.map((h) => h.responseTime), 1);
  const width = 120;
  const height = 20;
  const points = history.map((h, i) => {
    const x = (i / (history.length - 1)) * width;
    const y = height - (h.responseTime / maxResp) * (height - 2) - 1;
    return `${x},${y}`;
  });

  const lineColor =
    status === "alive"
      ? "stroke-emerald-400"
      : status === "degraded"
      ? "stroke-amber-400"
      : status === "unresponsive"
      ? "stroke-rose-400"
      : "stroke-red-500";

  const dotColor =
    status === "alive"
      ? "fill-emerald-400"
      : status === "degraded"
      ? "fill-amber-400"
      : status === "unresponsive"
      ? "fill-rose-400"
      : "fill-red-500";

  return (
    <svg width={width} height={height} className="shrink-0">
      <polyline
        points={points.join(" ")}
        fill="none"
        className={cn(lineColor, "opacity-60")}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Missed beat indicators */}
      {history.map((h, i) => {
        if (!h.healthy) {
          const x = (i / (history.length - 1)) * width;
          return (
            <circle key={i} cx={x} cy={height / 2} r="2" className="fill-rose-500" />
          );
        }
        return null;
      })}
      {/* Latest point */}
      {history.length > 0 && (
        <circle
          cx={width}
          cy={
            height -
            (history[history.length - 1].responseTime / maxResp) *
              (height - 2) -
            1
          }
          r="2.5"
          className={cn(dotColor, "animate-pulse")}
        />
      )}
    </svg>
  );
}

// ─── Skill Level Stars ───
function SkillStars({ level }: { level: number }) {
  return (
    <div className="flex gap-[1px]">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(
            "w-2.5 h-2.5",
            i <= level
              ? "fill-amber-400 text-amber-400"
              : "fill-none text-muted-foreground/20"
          )}
        />
      ))}
    </div>
  );
}

export const AgentCard: React.FC<AgentCardProps> = ({
  agent,
  onUpdateAgent,
  messages = [],
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  isDragging = false,
  isDragOver = false,
  onPause,
  onResume,
  onTerminate,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = React.useState(false);
  const [isSkillsExpanded, setIsSkillsExpanded] = React.useState(false);
  const [historySearch, setHistorySearch] = React.useState("");

  const [editCapabilities, setEditCapabilities] = React.useState(
    agent.capabilities.join(", ")
  );
  const [editProvider, setEditProvider] = React.useState<LLMProvider>(
    agent.provider || "gemini"
  );
  const [editModel, setEditModel] = React.useState(agent.model || "");

  const isGod = agent.id === "god";
  const isPaused = agent.status === "paused";
  const status = statusConfig[agent.status] || statusConfig.idle;

  const handleSave = () => {
    if (onUpdateAgent) {
      onUpdateAgent({
        ...agent,
        capabilities: editCapabilities.split(",").map((c) => c.trim()).filter(Boolean),
        provider: editProvider,
        model: editModel,
      });
    }
    setIsOpen(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      draggable
      onDragStart={(e) => onDragStart?.(e as unknown as React.DragEvent, agent.id)}
      onDragOver={(e) => onDragOver?.(e as unknown as React.DragEvent)}
      onDragEnd={(e) => onDragEnd?.(e as unknown as React.DragEvent)}
      onDrop={(e) => onDrop?.(e as unknown as React.DragEvent, agent.id)}
      className={cn(
        "transition-all duration-200",
        isDragging && "agent-card-dragging",
        isDragOver && "agent-card-drag-over",
        isPaused && "opacity-50 grayscale-[40%]"
      )}
    >
      <div
        className={cn(
          "gradient-border rounded-xl overflow-hidden bg-card/90 backdrop-blur-sm transition-all duration-300 group hover:bg-card",
          isGod && "god-glow"
        )}
      >
        {/* Top accent bar */}
        <div
          className={cn(
            "h-[2px] w-full",
            isPaused
              ? "bg-gradient-to-r from-zinc-500/0 via-zinc-500/40 to-zinc-500/0"
              : isGod
              ? "bg-gradient-to-r from-amber-500/0 via-amber-400 to-amber-500/0"
              : "bg-gradient-to-r from-violet-500/0 via-violet-500/60 to-violet-500/0"
          )}
        />

        {/* Card Header */}
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors shrink-0">
                <GripVertical className="w-4 h-4" />
              </div>

              {/* Avatar */}
              <div
                className={cn(
                  "relative w-9 h-9 rounded-lg flex items-center justify-center shrink-0 shadow-lg",
                  isGod
                    ? "bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/20"
                    : "bg-gradient-to-br from-violet-500/15 to-blue-500/10 border border-violet-500/15"
                )}
              >
                {isGod ? (
                  <Crown className="w-4 h-4 text-amber-400" />
                ) : (
                  <Cpu className="w-4 h-4 text-violet-400" />
                )}
                {/* Status indicator */}
                <div
                  className={cn(
                    "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card",
                    isPaused
                      ? "bg-zinc-500"
                      : agent.status === "idle"
                      ? "bg-emerald-400"
                      : agent.status === "working"
                      ? "bg-amber-400 status-dot-pulse"
                      : agent.status === "learning"
                      ? "bg-sky-400 status-dot-pulse"
                      : agent.status === "healing"
                      ? "bg-rose-400 status-dot-pulse"
                      : "bg-red-500"
                  )}
                />
              </div>

              {/* Name & Role */}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3
                    className={cn(
                      "text-sm font-semibold truncate",
                      isGod && "text-amber-200"
                    )}
                  >
                    {agent.name}
                  </h3>
                  {isGod && <Sparkles className="w-3 h-3 text-amber-400/80 shrink-0" />}
                  {agent.isProtected && (
                    <Shield className="w-3 h-3 text-sky-400/60 shrink-0" />
                  )}
                  {agent.createdBy === "god" && (
                    <Badge variant="outline" className="text-[7px] h-3.5 px-1 bg-violet-500/10 text-violet-400 border-violet-500/20">
                      SPAWNED
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground truncate">
                  {agent.role}
                </p>
              </div>
            </div>

            {/* Status Badge */}
            <Badge
              variant="outline"
              className={cn(
                "shrink-0 text-[9px] h-5 px-1.5 uppercase font-semibold tracking-wider border",
                status.bg,
                status.color
              )}
            >
              <span className="mr-1">{status.icon}</span>
              {status.label}
            </Badge>
          </div>
        </div>

        {/* ─── Heartbeat Row ─── */}
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Heart
                className={cn(
                  "w-3.5 h-3.5 shrink-0",
                  agent.heartbeat.status === "alive"
                    ? "text-emerald-400 heartbeat-pulse"
                    : agent.heartbeat.status === "degraded"
                    ? "text-amber-400"
                    : agent.heartbeat.status === "unresponsive"
                    ? "text-rose-400"
                    : "text-red-500"
                )}
              />
              <span className="text-[9px] font-mono text-muted-foreground/50">
                {agent.heartbeat.avgResponseTime > 0
                  ? `${agent.heartbeat.avgResponseTime}ms`
                  : "—"}
              </span>
            </div>
            <HeartbeatSparkline
              history={agent.heartbeat.history}
              status={agent.heartbeat.status}
            />
            <Badge
              variant="outline"
              className={cn(
                "text-[8px] h-4 px-1.5 border font-mono shrink-0",
                agent.heartbeat.uptimePercent >= 99
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : agent.heartbeat.uptimePercent >= 95
                  ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                  : "bg-rose-500/10 text-rose-400 border-rose-500/20"
              )}
            >
              {agent.heartbeat.uptimePercent}% ↑
            </Badge>
          </div>
        </div>

        {/* Metrics Row */}
        <div className="px-4 pb-3">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "CPU", value: `${agent.metrics.cpu}%`, warn: agent.metrics.cpu > 70 },
              {
                label: "MEM",
                value: `${(agent.metrics.memory / 1024).toFixed(1)}G`,
                warn: agent.metrics.memory > 3500,
              },
              {
                label: "LAT",
                value: `${agent.metrics.latency}ms`,
                warn: agent.metrics.latency > 200,
              },
            ].map((metric) => (
              <div key={metric.label} className="bg-secondary/40 rounded-lg px-2.5 py-1.5 text-center">
                <div className="text-[8px] uppercase tracking-widest text-muted-foreground/60 font-medium">
                  {metric.label}
                </div>
                <div
                  className={cn(
                    "text-xs font-mono font-semibold mt-0.5",
                    metric.warn ? "text-amber-400" : "text-foreground/80"
                  )}
                >
                  {metric.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Health Bar */}
        <div className="px-4 pb-3">
          <div className="flex justify-between text-[9px] uppercase tracking-widest text-muted-foreground/50 font-medium mb-1.5">
            <span>Health</span>
            <span className={cn(agent.health < 50 ? "text-rose-400" : "text-emerald-400")}>
              {agent.health}%
            </span>
          </div>
          <div className="h-1 w-full bg-secondary/60 rounded-full overflow-hidden">
            <motion.div
              className={cn(
                "h-full rounded-full",
                agent.health > 70
                  ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                  : agent.health > 40
                  ? "bg-gradient-to-r from-amber-500 to-amber-400"
                  : "bg-gradient-to-r from-rose-500 to-rose-400"
              )}
              initial={{ width: 0 }}
              animate={{ width: `${agent.health}%` }}
              transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </div>

        {/* Last Action */}
        <div className="px-4 pb-3">
          <p className="text-[11px] text-muted-foreground/60 truncate font-mono">
            <span className="text-muted-foreground/30 mr-1.5">›</span>
            {agent.lastAction}
          </p>
        </div>

        {/* AI Engine */}
        <div className="px-4 pb-3 flex items-center gap-2">
          <Badge
            variant="secondary"
            className={cn(
              "text-[9px] h-5 px-1.5 font-semibold",
              agent.provider === "gemini"
                ? "bg-blue-500/10 text-blue-400 border border-blue-500/15"
                : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/15"
            )}
          >
            {agent.provider === "ollama" ? "Ollama" : "Gemini"}
          </Badge>
          <span className="text-[10px] text-muted-foreground/50 font-mono truncate">
            {agent.model || "Default"}
          </span>
          {agent.julesConfig?.enabled && (
            <div className="flex items-center gap-1.5 ml-auto">
              <div className="relative flex h-2 w-2">
                <span
                  className={cn(
                    "animate-ping absolute inline-flex h-full w-full rounded-full opacity-60",
                    agent.julesConfig.status === "connected"
                      ? "bg-emerald-400"
                      : agent.julesConfig.status === "syncing"
                      ? "bg-amber-400"
                      : "bg-red-400"
                  )}
                />
                <span
                  className={cn(
                    "relative inline-flex rounded-full h-2 w-2",
                    agent.julesConfig.status === "connected"
                      ? "bg-emerald-400"
                      : agent.julesConfig.status === "syncing"
                      ? "bg-amber-400"
                      : "bg-red-400"
                  )}
                />
              </div>
              <span className="text-[9px] text-muted-foreground/40 font-mono">
                Jules
              </span>
            </div>
          )}
        </div>

        {/* ─── Skills Section ─── */}
        <div className="px-4 pb-3">
          <button
            onClick={() => setIsSkillsExpanded(!isSkillsExpanded)}
            className="flex items-center justify-between w-full text-left group/skills"
          >
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-muted-foreground/40" />
              <span className="text-[9px] uppercase tracking-widest font-semibold text-muted-foreground/50">
                Skills
              </span>
              <Badge variant="outline" className="text-[8px] h-4 px-1 bg-secondary/30 border-border/30 text-muted-foreground/40">
                {agent.skills.length}
              </Badge>
            </div>
            {isSkillsExpanded ? (
              <ChevronUp className="w-3 h-3 text-muted-foreground/30" />
            ) : (
              <ChevronDown className="w-3 h-3 text-muted-foreground/30" />
            )}
          </button>

          {/* Compact skills (always visible) */}
          {!isSkillsExpanded && (
            <div className="flex flex-wrap gap-1 mt-2">
              {agent.skills.slice(0, 4).map((skill) => (
                <Badge
                  key={skill.id}
                  variant="outline"
                  className={cn(
                    "text-[8px] py-0 h-4 px-1.5 border font-normal",
                    skillCategoryBg[skill.category]
                  )}
                >
                  {skill.name} <span className="ml-1 opacity-60">L{skill.level}</span>
                </Badge>
              ))}
              {agent.skills.length > 4 && (
                <Badge variant="outline" className="text-[8px] py-0 h-4 px-1.5 bg-secondary/20 border-border/50 text-muted-foreground/40">
                  +{agent.skills.length - 4}
                </Badge>
              )}
            </div>
          )}

          {/* Expanded skills */}
          <AnimatePresence>
            {isSkillsExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <div className="space-y-2 mt-2.5">
                  {agent.skills.map((skill) => (
                    <div
                      key={skill.id}
                      className="flex items-center gap-2.5 py-1 px-2 rounded-lg bg-secondary/20 hover:bg-secondary/30 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-medium text-foreground/80 truncate">
                            {skill.name}
                          </span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[7px] h-3.5 px-1 border shrink-0",
                              skillCategoryBg[skill.category]
                            )}
                          >
                            {skill.category}
                          </Badge>
                        </div>
                        {/* XP Progress Bar */}
                        {skill.level < 5 && (
                          <div className="flex items-center gap-2 mt-1">
                            <div className="h-[3px] flex-1 bg-secondary/40 rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all duration-500",
                                  skill.category === "meta"
                                    ? "bg-gradient-to-r from-yellow-500 to-yellow-400"
                                    : "bg-gradient-to-r from-violet-500 to-violet-400"
                                )}
                                style={{
                                  width: `${skill.xpToNext > 0 ? (skill.xp / skill.xpToNext) * 100 : 100}%`,
                                }}
                              />
                            </div>
                            <span className="text-[8px] text-muted-foreground/30 font-mono shrink-0">
                              {skill.xp}/{skill.xpToNext}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-0.5">
                        <SkillStars level={skill.level} />
                        <span className="text-[7px] text-muted-foreground/30 uppercase">
                          {SKILL_LEVEL_NAMES[skill.level]}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Actions Footer */}
        <div className="px-4 pb-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
            <DialogTrigger
              render={
                <button className="flex items-center gap-1.5 px-2.5 h-7 rounded-md text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors">
                  <History className="w-3 h-3" />
                  History
                </button>
              }
            />
            <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col bg-card border-border/50">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-sm">
                  <History className="w-4 h-4 text-primary" />
                  {agent.name} — History Log
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Review commands and responses specific to this agent.
                </DialogDescription>
              </DialogHeader>
              <div className="relative my-2">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search interactions..."
                  className="pl-8 bg-secondary/30 border-border/50"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                />
              </div>
              <div className="flex-1 overflow-y-auto pr-4 space-y-3">
                {messages
                  .filter((m) => m.targetAgentId === agent.id)
                  .filter((m) =>
                    m.content.toLowerCase().includes(historySearch.toLowerCase())
                  )
                  .map((msg, i) => (
                    <div
                      key={i}
                      className={cn(
                        "p-3 rounded-lg border",
                        msg.role === "user"
                          ? "bg-secondary/20 border-border/30 ml-8"
                          : "bg-primary/5 border-primary/10 mr-8"
                      )}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                          {msg.sender}
                        </span>
                        <span className="text-[9px] text-muted-foreground/40">
                          {msg.timestamp}
                        </span>
                      </div>
                      <div className="text-xs">
                        {msg.role === "user" ? (
                          <span className="text-foreground/80">{msg.content}</span>
                        ) : (
                          <div className="prose prose-invert max-w-none prose-sm prose-p:leading-relaxed prose-pre:bg-secondary/30 prose-pre:border prose-pre:border-border/30">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                {messages.filter((m) => m.targetAgentId === agent.id).length === 0 && (
                  <div className="text-center py-12 text-muted-foreground/40 text-xs">
                    No interactions recorded for this agent yet.
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {onUpdateAgent && (
            <>
              <button 
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-1.5 px-2.5 h-7 rounded-md text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
              >
                <Settings2 className="w-3 h-3" />
                Config
              </button>
              <AgentConfig
                agent={agent}
                onSave={onUpdateAgent}
                open={isOpen}
                onOpenChange={setIsOpen}
              />
            </>
          )}

          {/* Pause / Resume / Terminate */}
          <div className="ml-auto flex items-center gap-1">
            {isPaused && onResume ? (
              <button
                onClick={() => onResume(agent.id)}
                className="flex items-center gap-1 px-2 h-7 rounded-md text-[10px] font-medium text-emerald-400 hover:bg-emerald-500/10 transition-colors"
              >
                <Play className="w-3 h-3" />
                Resume
              </button>
            ) : onPause && !isGod ? (
              <button
                onClick={() => onPause(agent.id)}
                aria-label="Pause agent"
                className="flex items-center gap-1 px-2 h-7 rounded-md text-[10px] font-medium text-muted-foreground hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
              >
                <Pause className="w-3 h-3" />
              </button>
            ) : null}
            {onTerminate && !agent.isProtected && (
              <button
                onClick={() => onTerminate(agent.id)}
                aria-label="Terminate agent"
                className="flex items-center gap-1 px-2 h-7 rounded-md text-[10px] font-medium text-muted-foreground/30 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
