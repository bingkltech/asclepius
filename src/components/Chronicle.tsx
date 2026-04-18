/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Chronicle — The Neural Vault Knowledge Browser
 * 
 * Visual interface for browsing, searching, and curating the
 * God-Agent's accumulated wisdom. Displays knowledge nodes,
 * episodic events, and skill scripts with confidence indicators.
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Brain,
  Search,
  BookOpen,
  Zap,
  Shield,
  TrendingUp,
  Clock,
  Tag,
  Link2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Database,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getAllKnowledge,
  getAllSkillScripts,
  getAgentEpisodes,
  searchKnowledge,
  deleteKnowledge,
  validateKnowledge,
  getVaultStats,
} from "@/src/services/neuralVault";
import type {
  KnowledgeNode,
  SkillScript,
  EpisodicEvent,
  NeuralVaultStats,
  KnowledgeCategory,
} from "@/src/types";
import ReactMarkdown from "react-markdown";

// ─── Category Styling ───
const categoryConfig: Record<KnowledgeCategory, { color: string; bg: string; icon: React.ReactNode }> = {
  architecture: { color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20", icon: <Database className="w-3 h-3" /> },
  bugfix: { color: "text-rose-400", bg: "bg-rose-500/10 border-rose-500/20", icon: <Shield className="w-3 h-3" /> },
  pattern: { color: "text-sky-400", bg: "bg-sky-500/10 border-sky-500/20", icon: <TrendingUp className="w-3 h-3" /> },
  protocol: { color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", icon: <Zap className="w-3 h-3" /> },
  insight: { color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", icon: <Sparkles className="w-3 h-3" /> },
};

// ─── Confidence Bar Component ───
function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color = pct >= 80 ? "from-emerald-500 to-emerald-400"
    : pct >= 50 ? "from-amber-500 to-amber-400"
    : "from-rose-500 to-rose-400";

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 bg-secondary/40 rounded-full overflow-hidden">
        <motion.div
          className={cn("h-full rounded-full bg-gradient-to-r", color)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <span className={cn(
        "text-[9px] font-mono font-semibold",
        pct >= 80 ? "text-emerald-400" : pct >= 50 ? "text-amber-400" : "text-rose-400"
      )}>
        {pct}%
      </span>
    </div>
  );
}

// ─── Knowledge Node Card ───
function KnowledgeCard({
  node,
  onValidate,
  onDelete,
  isExpanded,
  onToggle,
}: {
  node: KnowledgeNode;
  onValidate: (id: string) => void;
  onDelete: (id: string) => void;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const cat = categoryConfig[node.category];
  const timeAgo = getTimeAgo(node.createdAt);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="gradient-border rounded-xl overflow-hidden bg-card/90 backdrop-blur-sm hover:bg-card transition-all duration-200"
    >
      {/* Accent bar */}
      <div className={cn("h-[2px] w-full bg-gradient-to-r", `${cat.color.replace('text-', 'from-')}/0 via-${cat.color.replace('text-', '')}/60 to-${cat.color.replace('text-', '')}/0`)} />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 cursor-pointer" onClick={onToggle}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <Badge variant="outline" className={cn("text-[8px] h-4 px-1.5 border", cat.bg, cat.color)}>
                {cat.icon}
                <span className="ml-1">{node.category}</span>
              </Badge>
              {node.validated && (
                <Badge variant="outline" className="text-[8px] h-4 px-1.5 bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                  <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" /> Validated
                </Badge>
              )}
            </div>
            <h3 className="text-sm font-semibold text-foreground/90 truncate">{node.topic}</h3>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[9px] text-muted-foreground/40 font-mono">{timeAgo}</div>
            <div className="text-[8px] text-muted-foreground/30 mt-0.5">by {node.createdBy}</div>
          </div>
        </div>

        {/* Confidence */}
        <div className="mt-2">
          <ConfidenceBar confidence={node.confidence} />
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1 mt-2.5">
          {node.tags.slice(0, 6).map((tag) => (
            <Badge key={tag} variant="outline" className="text-[7px] h-3.5 px-1.5 bg-secondary/20 border-border/30 text-muted-foreground/50">
              <Tag className="w-2 h-2 mr-0.5" />{tag}
            </Badge>
          ))}
          {node.tags.length > 6 && (
            <Badge variant="outline" className="text-[7px] h-3.5 px-1.5 bg-secondary/20 border-border/30 text-muted-foreground/30">
              +{node.tags.length - 6}
            </Badge>
          )}
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 mt-2.5 text-[9px] text-muted-foreground/40">
          <span className="flex items-center gap-1"><Eye className="w-2.5 h-2.5" /> {node.accessCount} uses</span>
          {node.connections.length > 0 && (
            <span className="flex items-center gap-1"><Link2 className="w-2.5 h-2.5" /> {node.connections.length} links</span>
          )}
        </div>

        {/* Expanded content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-3 pt-3 border-t border-border/20">
                <div className="prose prose-invert max-w-none prose-sm prose-p:leading-relaxed prose-pre:bg-secondary/30 prose-pre:border prose-pre:border-border/30 text-xs text-muted-foreground/70">
                  <ReactMarkdown>{node.content}</ReactMarkdown>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  {!node.validated && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[9px] text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10"
                      onClick={(e) => { e.stopPropagation(); onValidate(node.id); }}
                    >
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Validate
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[9px] text-rose-400/50 border-rose-500/10 hover:bg-rose-500/10 hover:text-rose-400"
                    onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}
                  >
                    <Trash2 className="w-3 h-3 mr-1" /> Remove
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── Skill Script Card ───
function SkillScriptCard({ script }: { script: SkillScript }) {
  return (
    <div className="gradient-border rounded-xl overflow-hidden bg-card/90 p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-sm font-semibold">{script.name}</span>
          </div>
          <p className="text-[11px] text-muted-foreground/60">{script.description}</p>
        </div>
        <Badge variant="outline" className={cn(
          "text-[9px] h-5 px-2 font-mono",
          script.successRate >= 80 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
            : script.successRate >= 50 ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
            : "bg-rose-500/10 text-rose-400 border-rose-500/20"
        )}>
          {script.successRate}% success
        </Badge>
      </div>
      <div className="flex items-center gap-3 mt-2 text-[9px] text-muted-foreground/40">
        <span>Trigger: "{script.triggerPattern}"</span>
        <span>Used {script.timesUsed}×</span>
        <span>by {script.createdBy}</span>
      </div>
    </div>
  );
}

// ─── Helper ───
function getTimeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Main Chronicle Component ───
interface ChronicleProps {
  vaultStats: NeuralVaultStats;
  onStatsUpdate?: (stats: NeuralVaultStats) => void;
}

export function Chronicle({ vaultStats, onStatsUpdate }: ChronicleProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [knowledgeNodes, setKnowledgeNodes] = useState<KnowledgeNode[]>([]);
  const [skillScripts, setSkillScripts] = useState<SkillScript[]>([]);
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"knowledge" | "scripts">("knowledge");
  const [isSearching, setIsSearching] = useState(false);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [nodes, scripts] = await Promise.all([
      getAllKnowledge(),
      getAllSkillScripts(),
    ]);
    setKnowledgeNodes(nodes);
    setSkillScripts(scripts);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadData();
      return;
    }
    setIsSearching(true);
    const results = await searchKnowledge(searchQuery, 20);
    setKnowledgeNodes(results);
    setIsSearching(false);
  };

  const handleValidate = async (nodeId: string) => {
    await validateKnowledge(nodeId);
    await loadData();
    if (onStatsUpdate) {
      const stats = await getVaultStats();
      onStatsUpdate(stats);
    }
  };

  const handleDelete = async (nodeId: string) => {
    await deleteKnowledge(nodeId);
    await loadData();
    if (onStatsUpdate) {
      const stats = await getVaultStats();
      onStatsUpdate(stats);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
          <Brain className="w-7 h-7 text-primary" />
          Neural Vault
        </h1>
        <p className="text-sm text-muted-foreground/70">
          The God-Agent's cognitive memory — wisdom accumulated through autonomous operations.
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Knowledge", value: vaultStats.totalKnowledge, icon: BookOpen, color: "text-violet-400", gradient: "from-violet-500/10" },
          { label: "Episodes", value: vaultStats.totalEpisodes, icon: Clock, color: "text-sky-400", gradient: "from-sky-500/10" },
          { label: "Scripts", value: vaultStats.totalSkillScripts, icon: Zap, color: "text-amber-400", gradient: "from-amber-500/10" },
          { label: "Avg Trust", value: `${vaultStats.avgConfidence}%`, icon: Shield, color: "text-emerald-400", gradient: "from-emerald-500/10" },
        ].map((stat) => (
          <div key={stat.label} className={cn("gradient-border rounded-xl bg-card/80 p-4 bg-gradient-to-br", stat.gradient, "to-transparent")}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] uppercase tracking-widest font-semibold text-muted-foreground/50">{stat.label}</span>
              <stat.icon className={cn("w-4 h-4", stat.color)} />
            </div>
            <div className="text-xl font-bold tracking-tight">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Search + Tabs */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/50" />
          <Input
            type="search"
            placeholder="Search wisdom..."
            className="pl-9 bg-secondary/30 border-border/50"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
        </div>
        <Button variant="outline" size="sm" onClick={handleSearch} disabled={isSearching} className="h-9">
          <Search className="w-3.5 h-3.5 mr-1.5" />
          Search
        </Button>
      </div>

      {/* View Tabs */}
      <div className="flex items-center gap-1 p-1 bg-secondary/20 rounded-lg w-fit">
        {[
          { key: "knowledge" as const, label: "Knowledge", icon: BookOpen, count: knowledgeNodes.length },
          { key: "scripts" as const, label: "Skill Scripts", icon: Zap, count: skillScripts.length },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveView(tab.key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-all",
              activeView === tab.key
                ? "bg-primary/10 text-primary border border-primary/20"
                : "text-muted-foreground/50 hover:text-muted-foreground"
            )}
          >
            <tab.icon className="w-3 h-3" />
            {tab.label}
            <Badge variant="outline" className="text-[8px] h-4 px-1 ml-1">{tab.count}</Badge>
          </button>
        ))}
      </div>

      {/* Content */}
      <ScrollArea className="h-[calc(100vh-400px)]">
        <AnimatePresence mode="wait">
          {activeView === "knowledge" ? (
            <motion.div
              key="knowledge"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              {knowledgeNodes.length === 0 ? (
                <div className="col-span-2 text-center py-20">
                  <Brain className="w-12 h-12 mx-auto text-muted-foreground/20 mb-4" />
                  <p className="text-muted-foreground/40 text-sm">
                    The Neural Vault is empty. The God-Agent will learn wisdom through solving problems and auto-healing errors.
                  </p>
                </div>
              ) : (
                knowledgeNodes.map((node) => (
                  <KnowledgeCard
                    key={node.id}
                    node={node}
                    onValidate={handleValidate}
                    onDelete={handleDelete}
                    isExpanded={expandedNodeId === node.id}
                    onToggle={() => setExpandedNodeId(expandedNodeId === node.id ? null : node.id)}
                  />
                ))
              )}
            </motion.div>
          ) : (
            <motion.div
              key="scripts"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              {skillScripts.length === 0 ? (
                <div className="col-span-2 text-center py-20">
                  <Zap className="w-12 h-12 mx-auto text-muted-foreground/20 mb-4" />
                  <p className="text-muted-foreground/40 text-sm">
                    No skill scripts yet. The God-Agent creates these when it discovers reusable solutions.
                  </p>
                </div>
              ) : (
                skillScripts.map((script) => (
                  <SkillScriptCard key={script.id} script={script} />
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </ScrollArea>
    </div>
  );
}
