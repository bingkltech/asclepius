/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AgentConfig — Full agent configuration panel
 * Allows editing all agent settings: general info, AI engine, heartbeat,
 * skills (add/remove/edit), budget, tools, and capabilities.
 */

import * as React from "react";
import {
  Agent,
  AgentSkill,
  AgentHeartbeat,
  AgentBudget,
  AgentCredentials,
  LLMProvider,
  SkillCategory,
  SKILL_XP_TABLE,
  SKILL_LEVEL_NAMES,
  SKILL_CATEGORY_COLORS,
} from "@/src/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
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
  Settings2,
  User,
  Cpu,
  Globe,
  Heart,
  Sparkles,
  Shield,
  ShieldCheck,
  Wallet,
  Wrench,
  Plus,
  Trash2,
  Star,
  ChevronLeft,
  ChevronRight,
  Save,
  RotateCcw,
  AlertTriangle,
  Crown,
  Clock,
  KeyRound,
  Mail,
  Loader2,
  CheckCircle2,
  ExternalLink,
  ArrowRight,
  RefreshCw,
  Link,
  Unlink,
  LogIn,
} from "lucide-react";
import { testConnection } from "@/src/services/llm";
import { listOllamaModels, OllamaModel } from "@/src/services/ollama";
import { initiateGoogleAuth, buildAuthenticatedCredentials, disconnectGoogleAuth, getAuthStatusDisplay } from "@/src/services/googleAuth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ─── Tab types ───
type ConfigTab = "general" | "engine" | "heartbeat" | "skills" | "budget" | "tools" | "credentials";

interface AgentConfigProps {
  agent: Agent;
  onSave: (updated: Agent) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SKILL_CATEGORIES: SkillCategory[] = [
  "engineering",
  "analysis",
  "operations",
  "security",
  "creative",
  "meta",
];

const skillCategoryBg: Record<SkillCategory, string> = {
  engineering: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  analysis: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  operations: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  security: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  creative: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  meta: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
};

// ─── Skill Stars (editable) ───
function EditableStars({
  level,
  onChange,
}: {
  level: number;
  onChange: (level: number) => void;
}) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          className="p-0.5 hover:scale-125 transition-transform"
        >
          <Star
            className={cn(
              "w-3.5 h-3.5 transition-colors",
              i <= level
                ? "fill-amber-400 text-amber-400"
                : "fill-none text-muted-foreground/20 hover:text-amber-400/40"
            )}
          />
        </button>
      ))}
    </div>
  );
}

// ─── Tab Button ───
function TabButton({
  active,
  icon: Icon,
  label,
  onClick,
  badge,
}: {
  active: boolean;
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  badge?: string | number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all w-full text-left",
        active
          ? "bg-primary/10 text-primary border border-primary/20"
          : "text-muted-foreground/60 hover:text-foreground hover:bg-secondary/40"
      )}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span className="truncate">{label}</span>
      {badge !== undefined && (
        <Badge
          variant="outline"
          className="ml-auto text-[8px] h-4 px-1 bg-secondary/30 border-border/30 shrink-0"
        >
          {badge}
        </Badge>
      )}
    </button>
  );
}

export function AgentConfig({ agent, onSave, open, onOpenChange }: AgentConfigProps) {
  const [tab, setTab] = React.useState<ConfigTab>("general");

  // ─── Editable state (clone of agent) ───
  const [name, setName] = React.useState(agent.name);
  const [role, setRole] = React.useState(agent.role);
  const [isProtected, setIsProtected] = React.useState(agent.isProtected);
  const [provider, setProvider] = React.useState<LLMProvider>(agent.provider || "gemini");
  const [model, setModel] = React.useState(agent.model || "");
  const [julesEnabled, setJulesEnabled] = React.useState(agent.julesConfig?.enabled ?? true);
  const [julesEndpoint, setJulesEndpoint] = React.useState(agent.julesConfig?.endpoint || "");

  // Heartbeat
  const [hbIntervalMin, setHbIntervalMin] = React.useState(
    (agent.heartbeat.interval / 60000).toString()
  );
  const [hbMaxMissed, setHbMaxMissed] = React.useState(agent.heartbeat.maxMissed.toString());

  // Skills
  const [skills, setSkills] = React.useState<AgentSkill[]>(
    JSON.parse(JSON.stringify(agent.skills))
  );
  const [newSkillName, setNewSkillName] = React.useState("");
  const [newSkillCategory, setNewSkillCategory] = React.useState<SkillCategory>("engineering");
  const [newSkillLevel, setNewSkillLevel] = React.useState(1);
  const [newSkillDesc, setNewSkillDesc] = React.useState("");

  // Budget
  const [dailyTokenLimit, setDailyTokenLimit] = React.useState(
    agent.budget.dailyTokenLimit.toString()
  );
  const [budgetPriority, setBudgetPriority] = React.useState(agent.budget.priority);
  const [budgetOverage, setBudgetOverage] = React.useState(agent.budget.overage);

  // Tools / Capabilities
  const [capabilities, setCapabilities] = React.useState<string[]>([...agent.capabilities]);
  const [newCapability, setNewCapability] = React.useState("");

  // Credentials (per-agent identity)
  const [credEmail, setCredEmail] = React.useState(agent.credentials?.email || "");
  const [credGeminiKey, setCredGeminiKey] = React.useState(agent.credentials?.geminiApiKey || "");
  const [credGeminiModel, setCredGeminiModel] = React.useState(agent.credentials?.geminiModel || "");
  const [credOllamaUrl, setCredOllamaUrl] = React.useState(agent.credentials?.ollamaBaseUrl || "");
  const [credOllamaModel, setCredOllamaModel] = React.useState(agent.credentials?.ollamaModel || "");

  // Auth State (Sovereign Identity)
  const [isAuthenticating, setIsAuthenticating] = React.useState(false);

  // Provisioning Wizard
  const [showProvisionWizard, setShowProvisionWizard] = React.useState(false);
  const [wizardStep, setWizardStep] = React.useState(1);
  const [isTestingKey, setIsTestingKey] = React.useState(false);
  const [wizardError, setWizardError] = React.useState("");
  const [position, setPosition] = React.useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = React.useState(false);
  const dragStartPos = React.useRef({ x: 0, y: 0 });

  const [ollamaModels, setOllamaModels] = React.useState<OllamaModel[]>([]);
  const [isRefreshingOllama, setIsRefreshingOllama] = React.useState(false);

  const refreshOllamaModels = async () => {
    setIsRefreshingOllama(true);
    try {
      const models = await listOllamaModels(credOllamaUrl || "http://localhost:11434");
      setOllamaModels(models);
    } catch (err) {
      setOllamaModels([]);
    } finally {
      setIsRefreshingOllama(false);
    }
  };

  React.useEffect(() => {
    if (provider === "ollama") {
      refreshOllamaModels();
    }
  }, [provider, credOllamaUrl]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    setIsDragging(true);
    dragStartPos.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setPosition({ x: e.clientX - dragStartPos.current.x, y: e.clientY - dragStartPos.current.y });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };


  // Reset to agent values when agent changes
  React.useEffect(() => {
    setName(agent.name);
    setRole(agent.role);
    setIsProtected(agent.isProtected);
    setProvider(agent.provider || "gemini");
    setModel(agent.model || "");
    setJulesEnabled(agent.julesConfig?.enabled ?? true);
    setJulesEndpoint(agent.julesConfig?.endpoint || "");
    setHbIntervalMin((agent.heartbeat.interval / 60000).toString());
    setHbMaxMissed(agent.heartbeat.maxMissed.toString());
    setSkills(JSON.parse(JSON.stringify(agent.skills)));
    setDailyTokenLimit(agent.budget.dailyTokenLimit.toString());
    setBudgetPriority(agent.budget.priority);
    setBudgetOverage(agent.budget.overage);
    setCapabilities([...agent.capabilities]);
    setCredEmail(agent.credentials?.email || "");
    setCredGeminiKey(agent.credentials?.geminiApiKey || "");
    setCredGeminiModel(agent.credentials?.geminiModel || "");
    setCredOllamaUrl(agent.credentials?.ollamaBaseUrl || "");
    setCredOllamaModel(agent.credentials?.ollamaModel || "");
  }, [agent, open]);

  const isGod = agent.id === "god";

  // ─── Provisioning Wizard Logic ───
  const handleStartProvisioning = () => {
    setShowProvisionWizard(true);
    setWizardStep(1);
    setWizardError("");
  };

  const handleTestKeyAndComplete = async () => {
    if (!credGeminiKey.trim()) {
      setWizardError("Please enter an API key first.");
      return;
    }
    
    setIsTestingKey(true);
    setWizardError("");
    
    try {
      // Create temporary settings object for validation
      const result = await testConnection({
        provider: "gemini",
        geminiApiKey: credGeminiKey.trim(),
        geminiModel: "gemini-3.1-flash-lite-preview",
        ollamaBaseUrl: "",
        ollamaModel: "",
        autoHeal: false,
        usage: { requestsToday: 0, lastResetDate: new Date().toDateString(), limitPerDay: 1500 }
      });
      
      if (result.success) {
        toast.success("Identity Provisioned Successfully!");
        setWizardStep(3); // Success step
        // Generate a virtual identity if none was provided
        if (!credEmail.trim()) {
          setCredEmail(`${agent.name.toLowerCase().replace(/[^a-z0-9]/g, ".")}.${Math.random().toString(36).slice(2, 6)}@asclepius.local`);
        }
        setTimeout(() => setShowProvisionWizard(false), 2000);
      } else {
        setWizardError(result.message || "Invalid API Key");
      }
    } catch (err) {
      setWizardError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setIsTestingKey(false);
    }
  };

  // ─── Add a new skill ───
  const handleAddSkill = () => {
    if (!newSkillName.trim()) {
      toast.error("Skill name is required");
      return;
    }
    if (skills.some((s) => s.name.toLowerCase() === newSkillName.trim().toLowerCase())) {
      toast.error("Skill already exists");
      return;
    }
    const skill: AgentSkill = {
      id: `skill-${newSkillName.toLowerCase().replace(/\s+/g, "-")}-${Math.random().toString(36).slice(2, 6)}`,
      name: newSkillName.trim(),
      category: newSkillCategory,
      level: newSkillLevel,
      xp: 0,
      xpToNext: SKILL_XP_TABLE[newSkillLevel] || 0,
      description: newSkillDesc.trim() || `${newSkillName} skill`,
      acquiredAt: new Date().toISOString(),
      usageCount: 0,
      cooldown: 0,
    };
    setSkills((prev) => [...prev, skill]);
    setNewSkillName("");
    setNewSkillDesc("");
    setNewSkillLevel(1);
    toast.success(`Added skill: ${skill.name}`);
  };

  // ─── Remove a skill ───
  const handleRemoveSkill = (skillId: string) => {
    setSkills((prev) => prev.filter((s) => s.id !== skillId));
  };

  // ─── Update skill level ───
  const handleSkillLevelChange = (skillId: string, newLevel: number) => {
    setSkills((prev) =>
      prev.map((s) =>
        s.id === skillId
          ? { ...s, level: newLevel, xpToNext: SKILL_XP_TABLE[newLevel] || 0 }
          : s
      )
    );
  };

  // ─── Update skill category ───
  const handleSkillCategoryChange = (skillId: string, cat: SkillCategory) => {
    setSkills((prev) =>
      prev.map((s) => (s.id === skillId ? { ...s, category: cat } : s))
    );
  };

  // ─── Add capability ───
  const handleAddCapability = () => {
    if (!newCapability.trim()) return;
    if (capabilities.includes(newCapability.trim())) {
      toast.error("Capability already exists.");
      return;
    }
    setCapabilities((prev) => [...prev, newCapability.trim()]);
    setNewCapability("");
  };

  // ─── Remove capability ───
  const handleRemoveCapability = (cap: string) => {
    setCapabilities((prev) => prev.filter((c) => c !== cap));
  };

  // ─── Save all ───
  const handleSave = () => {
    const intervalMs = Math.max(5000, parseFloat(hbIntervalMin || "0.5") * 60000);
    const maxMissed = Math.max(1, parseInt(hbMaxMissed || "3"));

    const updated: Agent = {
      ...agent,
      name: name.trim() || agent.name,
      role: role.trim() || agent.role,
      isProtected,
      provider,
      model: model.trim() || agent.model || "",
      julesConfig: agent.julesConfig
        ? {
            ...agent.julesConfig,
            enabled: julesEnabled,
            endpoint: julesEndpoint.trim() || agent.julesConfig.endpoint,
          }
        : undefined,
      heartbeat: {
        ...agent.heartbeat,
        interval: intervalMs,
        maxMissed,
      },
      skills,
      budget: {
        ...agent.budget,
        dailyTokenLimit: Math.max(1000, parseInt(dailyTokenLimit || "50000")),
        priority: budgetPriority,
        overage: budgetOverage,
      },
      capabilities,
      credentials: {
        ...(agent.credentials || { isAuthenticated: false, authStatus: 'unauthenticated' as const, google: { scopes: [], quotaUsed: 0 }, github: { scope: [], isConnected: false } }),
        email: credEmail.trim() || undefined,
        geminiApiKey: credGeminiKey.trim() || undefined,
        geminiModel: credGeminiModel.trim() || undefined,
        ollamaBaseUrl: credOllamaUrl.trim() || undefined,
        ollamaModel: credOllamaModel.trim() || undefined,
        quotaUsed: agent.credentials?.quotaUsed || 0,
        quotaLimit: agent.credentials?.quotaLimit || 1500,
        lastQuotaReset: agent.credentials?.lastQuotaReset || new Date().toISOString(),
      },
    };

    onSave(updated);
    onOpenChange(false);
    toast.success(`${updated.name} configuration saved`);
  };

  // ─── Reset to original ───
  const handleReset = () => {
    setName(agent.name);
    setRole(agent.role);
    setIsProtected(agent.isProtected);
    setProvider(agent.provider || "gemini");
    setModel(agent.model || "");
    setJulesEnabled(agent.julesConfig?.enabled ?? true);
    setJulesEndpoint(agent.julesConfig?.endpoint || "");
    setHbIntervalMin((agent.heartbeat.interval / 60000).toString());
    setHbMaxMissed(agent.heartbeat.maxMissed.toString());
    setSkills(JSON.parse(JSON.stringify(agent.skills)));
    setDailyTokenLimit(agent.budget.dailyTokenLimit.toString());
    setBudgetPriority(agent.budget.priority);
    setBudgetOverage(agent.budget.overage);
    setCapabilities([...agent.capabilities]);
    setCredEmail(agent.credentials?.email || "");
    setCredGeminiKey(agent.credentials?.geminiApiKey || "");
    setCredGeminiModel(agent.credentials?.geminiModel || "");
    setCredOllamaUrl(agent.credentials?.ollamaBaseUrl || "");
    setCredOllamaModel(agent.credentials?.ollamaModel || "");
    toast.info("Reset to current values");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="resize overflow-hidden flex flex-col bg-background/95 backdrop-blur-xl border-border/50 p-0 max-w-none min-w-[600px] min-h-[400px] max-w-[95vw] max-h-[95vh]"
        style={{ transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))` }}>
        {/* Header */}
        <div
          className="px-6 pt-6 pb-4 border-b border-border/20 cursor-move select-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shadow-lg",
                isGod
                  ? "bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/20"
                  : "bg-gradient-to-br from-violet-500/15 to-blue-500/10 border border-violet-500/15"
              )}
            >
              {isGod ? (
                <Crown className="w-5 h-5 text-amber-400" />
              ) : (
                <Cpu className="w-5 h-5 text-violet-400" />
              )}
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                Configure: {agent.name}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground/60">
                {agent.role} — Edit all agent settings below.
              </DialogDescription>
            </div>
            {agent.isProtected && (
              <Badge
                variant="outline"
                className="ml-auto text-[9px] bg-sky-500/10 text-sky-400 border-sky-500/20"
              >
                <Shield className="w-3 h-3 mr-1" />
                PROTECTED
              </Badge>
            )}
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Sidebar Tabs */}
          <div className="w-44 shrink-0 border-r border-border/20 p-3 space-y-1">
            <TabButton
              active={tab === "general"}
              icon={User}
              label="General"
              onClick={() => setTab("general")}
            />
            <TabButton
              active={tab === "engine"}
              icon={Cpu}
              label="AI Engine"
              onClick={() => setTab("engine")}
            />
            <TabButton
              active={tab === "heartbeat"}
              icon={Heart}
              label="Heartbeat"
              onClick={() => setTab("heartbeat")}
            />
            <TabButton
              active={tab === "skills"}
              icon={Sparkles}
              label="Skills"
              onClick={() => setTab("skills")}
              badge={skills.length}
            />
            <TabButton
              active={tab === "budget"}
              icon={Wallet}
              label="Budget"
              onClick={() => setTab("budget")}
            />
            <TabButton
              active={tab === "tools"}
              icon={Wrench}
              label="Tools & Caps"
              onClick={() => setTab("tools")}
              badge={capabilities.length}
            />
            <TabButton
              active={tab === "credentials"}
              icon={KeyRound}
              label="Credentials"
              onClick={() => setTab("credentials")}
              badge={credGeminiKey ? "✓" : undefined}
            />
          </div>

          {/* Content Area */}
          <ScrollArea className="flex-1">
            <div className="p-6">
              {/* ─────────── GENERAL ─────────── */}
              {tab === "general" && (
                <div className="space-y-5">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/50">
                    Agent Identity
                  </h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-widest font-bold text-foreground/90">
                        Agent Name
                      </Label>
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="bg-secondary/30 border-border/50 text-sm"
                        disabled={isGod}
                      />
                      {isGod && (
                        <p className="text-[9px] text-muted-foreground/40 italic">
                          God-Agent name cannot be changed.
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-widest font-bold text-foreground/90">
                        Role / Title
                      </Label>
                      <Input
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        className="bg-secondary/30 border-border/50 text-sm"
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/20 border border-border/20">
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold flex items-center gap-2">
                          <Shield className="w-3.5 h-3.5 text-sky-400" />
                          Protected Agent
                        </Label>
                        <p className="text-[10px] text-muted-foreground/50">
                          Protected agents cannot be terminated via /terminate.
                        </p>
                      </div>
                      <Switch
                        checked={isProtected}
                        onCheckedChange={setIsProtected}
                        disabled={isGod} // God is always protected
                      />
                    </div>

                    <div className="p-4 rounded-xl bg-secondary/20 border border-border/20 space-y-2">
                      <Label className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/50">
                        Agent Metadata
                      </Label>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-muted-foreground/40">ID:</span>{" "}
                          <span className="font-mono text-foreground/60">{agent.id}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground/40">Created by:</span>{" "}
                          <span className="font-mono text-foreground/60">{agent.createdBy}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground/40">Status:</span>{" "}
                          <Badge variant="outline" className="text-[8px] h-4 px-1 ml-1">
                            {agent.status}
                          </Badge>
                        </div>
                        <div>
                          <span className="text-muted-foreground/40">Health:</span>{" "}
                          <span className="font-mono text-emerald-400">{agent.health}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ─────────── AI ENGINE ─────────── */}
              {tab === "engine" && (
                <div className="space-y-5">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/50">
                    AI Provider & Model
                  </h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-widest font-bold text-foreground/90">
                        Provider
                      </Label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setProvider("gemini")}
                          className={cn(
                            "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                            provider === "gemini"
                              ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                              : "border-border/30 bg-secondary/20 hover:bg-secondary/40"
                          )}
                        >
                          <Globe className="w-5 h-5 text-sky-400" />
                          <span className="text-[10px] font-semibold">Gemini API</span>
                          <span className="text-[8px] text-muted-foreground/40">Cloud</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setProvider("ollama")}
                          className={cn(
                            "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                            provider === "ollama"
                              ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                              : "border-border/30 bg-secondary/20 hover:bg-secondary/40"
                          )}
                        >
                          <Cpu className="w-5 h-5 text-emerald-400" />
                          <span className="text-[10px] font-semibold">Ollama</span>
                          <span className="text-[8px] text-muted-foreground/40">Local</span>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs uppercase tracking-widest font-bold text-foreground/90">
                          Model Name
                        </Label>
                        {provider === "ollama" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={refreshOllamaModels}
                            disabled={isRefreshingOllama}
                            className="h-6 text-[9px] uppercase tracking-wider text-muted-foreground/50 hover:text-foreground"
                          >
                            {isRefreshingOllama ? (
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            ) : (
                              <RefreshCw className="w-3 h-3 mr-1" />
                            )}
                            Refresh
                          </Button>
                        )}
                      </div>
                      {provider === "gemini" ? (
                        <Select value={model} onValueChange={setModel}>
                          <SelectTrigger className="w-full bg-secondary/30 border-border/50 text-sm h-10">
                            <SelectValue placeholder="Select model" />
                          </SelectTrigger>
                          <SelectContent className="bg-[#1e1e24] border-border/50">
                            <SelectItem value="gemini-3.1-pro-preview" className="text-xs">
                              gemini-3.1-pro-preview (Best)
                            </SelectItem>
                            <SelectItem value="gemini-3.1-flash-lite-preview" className="text-xs">
                              gemini-3.1-flash-lite-preview (Fast)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Select value={model} onValueChange={setModel}>
                          <SelectTrigger className="w-full bg-secondary/30 border-border/50 text-sm h-10">
                            <SelectValue placeholder="Select a model" />
                          </SelectTrigger>
                          <SelectContent className="bg-[#1e1e24] border-border/50 max-h-60">
                            <SelectGroup>
                              <SelectLabel className="text-[9px] uppercase tracking-widest text-muted-foreground/40">
                                Local Models
                              </SelectLabel>
                              {ollamaModels.length > 0 ? (
                                ollamaModels.map((m) => (
                                  <SelectItem key={m.name} value={m.name} className="text-xs">
                                    <div className="flex items-center justify-between w-full gap-4">
                                      <span>{m.name}</span>
                                      <span className="text-[9px] text-muted-foreground/40">
                                        {(m.size / 1024 / 1024 / 1024).toFixed(1)}GB
                                      </span>
                                    </div>
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value={model || "gemma4:e4b"} className="text-xs">
                                  {model || "gemma4:e4b"} (Current)
                                </SelectItem>
                              )}
                            </SelectGroup>
                            <SelectSeparator />
                            <SelectGroup>
                              <SelectLabel className="text-[9px] uppercase tracking-widest text-muted-foreground/40">
                                Cloud Models
                              </SelectLabel>
                              {[{name: "gemma2:cloud"}, {name: "llama3:cloud"}, {name: "mistral:cloud"}].map((m) => (
                                <SelectItem key={m.name} value={m.name} className="text-xs">
                                  <div className="flex items-center justify-between w-full gap-4">
                                    <span>{m.name}</span>
                                    <Badge variant="secondary" className="text-[7px] h-3.5 px-1 bg-sky-500/10 text-sky-400 border-0">CLOUD</Badge>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    <div className="space-y-3 pt-2">
                      <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/50">
                        Jules Integration
                      </h4>
                      <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/20 border border-border/20">
                        <div className="space-y-1">
                          <Label className="text-xs font-semibold">Jules Sandbox</Label>
                          <p className="text-[10px] text-muted-foreground/50">
                            Connect to Jules for secure code execution.
                          </p>
                        </div>
                        <Switch
                          checked={julesEnabled}
                          onCheckedChange={setJulesEnabled}
                        />
                      </div>
                      {julesEnabled && (
                        <div className="space-y-2">
                          <Label className="text-xs uppercase tracking-widest font-bold text-foreground/90">
                            Jules Endpoint
                          </Label>
                          <Input
                            value={julesEndpoint}
                            onChange={(e) => setJulesEndpoint(e.target.value)}
                            placeholder="wss://jules.google.com/api/v1/sandbox/..."
                            className="bg-secondary/30 border-border/50 text-[10px] font-mono"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ─────────── HEARTBEAT ─────────── */}
              {tab === "heartbeat" && (
                <div className="space-y-5">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/50">
                    Heartbeat Configuration
                  </h3>
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-secondary/20 border border-border/20 space-y-3">
                      <div className="flex items-center gap-2">
                        <Heart
                          className={cn(
                            "w-4 h-4",
                            agent.heartbeat.status === "alive"
                              ? "text-emerald-400 heartbeat-pulse"
                              : agent.heartbeat.status === "degraded"
                              ? "text-amber-400"
                              : "text-rose-400"
                          )}
                        />
                        <span className="text-xs font-semibold">Current Status</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[9px] ml-auto",
                            agent.heartbeat.status === "alive"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : agent.heartbeat.status === "degraded"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                              : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                          )}
                        >
                          {agent.heartbeat.status.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="p-2 rounded-lg bg-secondary/30">
                          <div className="text-[8px] uppercase tracking-wider text-muted-foreground/40">
                            Uptime
                          </div>
                          <div className="text-sm font-mono font-semibold text-emerald-400">
                            {agent.heartbeat.uptimePercent}%
                          </div>
                        </div>
                        <div className="p-2 rounded-lg bg-secondary/30">
                          <div className="text-[8px] uppercase tracking-wider text-muted-foreground/40">
                            Avg Response
                          </div>
                          <div className="text-sm font-mono font-semibold">
                            {agent.heartbeat.avgResponseTime}ms
                          </div>
                        </div>
                        <div className="p-2 rounded-lg bg-secondary/30">
                          <div className="text-[8px] uppercase tracking-wider text-muted-foreground/40">
                            Missed Beats
                          </div>
                          <div className={cn(
                            "text-sm font-mono font-semibold",
                            agent.heartbeat.missedBeats > 0 ? "text-rose-400" : "text-foreground/60"
                          )}>
                            {agent.heartbeat.missedBeats}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-widest font-bold text-foreground/90">
                        Heartbeat Interval (minutes)
                      </Label>
                      <div className="flex items-center gap-3">
                        <Clock className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                        <Input
                          type="number"
                          step="0.1"
                          min="0.1"
                          value={hbIntervalMin}
                          onChange={(e) => setHbIntervalMin(e.target.value)}
                          className="bg-secondary/30 border-border/50 text-sm w-28"
                        />
                      </div>
                      <p className="text-[9px] text-muted-foreground/40">
                        How often the agent must send a liveness signal. Lower = more responsive monitoring.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-widest font-bold text-foreground/90">
                        Max Missed Beats Before Dead
                      </Label>
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                        <Input
                          type="number"
                          min="1"
                          max="20"
                          value={hbMaxMissed}
                          onChange={(e) => setHbMaxMissed(e.target.value)}
                          className="bg-secondary/30 border-border/50 text-sm w-28"
                        />
                        <span className="text-[10px] text-muted-foreground/40">
                          consecutive misses
                        </span>
                      </div>
                      <p className="text-[9px] text-muted-foreground/40">
                        After this many consecutive missed beats, the agent is declared dead and God-Agent intervenes.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* ─────────── SKILLS ─────────── */}
              {tab === "skills" && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/50">
                      Agent Skills ({skills.length})
                    </h3>
                  </div>

                  {/* Existing Skills */}
                  <div className="space-y-2">
                    {skills.map((skill) => (
                      <div
                        key={skill.id}
                        className="flex items-center gap-3 p-3 rounded-xl bg-secondary/20 border border-border/20 hover:bg-secondary/30 transition-colors group"
                      >
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">
                              {skill.name}
                            </span>
                            <Select
                              value={skill.category}
                              onValueChange={(v: SkillCategory) =>
                                handleSkillCategoryChange(skill.id, v)
                              }
                            >
                              <SelectTrigger
                                className={cn(
                                  "h-5 w-auto text-[8px] border px-1.5 rounded-md",
                                  skillCategoryBg[skill.category]
                                )}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-card border-border/50">
                                {SKILL_CATEGORIES.map((cat) => (
                                  <SelectItem key={cat} value={cat} className="text-xs capitalize">
                                    {cat}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          {skill.description && (
                            <p className="text-[10px] text-muted-foreground/40 truncate">
                              {skill.description}
                            </p>
                          )}
                          {/* XP bar */}
                          {skill.level < 5 && (
                            <div className="flex items-center gap-2">
                              <div className="h-[3px] flex-1 bg-secondary/40 rounded-full overflow-hidden max-w-40">
                                <div
                                  className="h-full bg-gradient-to-r from-violet-500 to-violet-400 rounded-full"
                                  style={{
                                    width: `${skill.xpToNext > 0 ? (skill.xp / skill.xpToNext) * 100 : 0}%`,
                                  }}
                                />
                              </div>
                              <span className="text-[8px] text-muted-foreground/30 font-mono">
                                {skill.xp}/{skill.xpToNext} XP
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Level stars */}
                        <div className="shrink-0 flex flex-col items-end gap-1">
                          <EditableStars
                            level={skill.level}
                            onChange={(l) => handleSkillLevelChange(skill.id, l)}
                          />
                          <span className="text-[7px] text-muted-foreground/30 uppercase">
                            {SKILL_LEVEL_NAMES[skill.level]}
                          </span>
                        </div>

                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={() => handleRemoveSkill(skill.id)}
                          className="p-1.5 rounded-md text-muted-foreground/20 hover:text-rose-400 hover:bg-rose-500/10 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}

                    {skills.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground/20 text-xs">
                        No skills configured. Add one below.
                      </div>
                    )}
                  </div>

                  {/* Add New Skill */}
                  <div className="p-4 rounded-xl border-2 border-dashed border-border/30 space-y-3">
                    <h4 className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/50 flex items-center gap-2">
                      <Plus className="w-3 h-3" />
                      Add New Skill
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-[9px] uppercase tracking-wider text-muted-foreground/40">
                          Skill Name
                        </Label>
                        <Input
                          value={newSkillName}
                          onChange={(e) => setNewSkillName(e.target.value)}
                          placeholder="e.g. React Development"
                          className="bg-secondary/30 border-border/50 text-xs h-8"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[9px] uppercase tracking-wider text-muted-foreground/40">
                          Category
                        </Label>
                        <Select
                          value={newSkillCategory}
                          onValueChange={(v: SkillCategory) => setNewSkillCategory(v)}
                        >
                          <SelectTrigger className="bg-secondary/30 border-border/50 text-xs h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border/50">
                            {SKILL_CATEGORIES.map((cat) => (
                              <SelectItem key={cat} value={cat} className="text-xs capitalize">
                                {cat}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-[9px] uppercase tracking-wider text-muted-foreground/40">
                          Starting Level
                        </Label>
                        <div className="flex items-center gap-2">
                          <EditableStars
                            level={newSkillLevel}
                            onChange={setNewSkillLevel}
                          />
                          <span className="text-[9px] text-muted-foreground/40">
                            {SKILL_LEVEL_NAMES[newSkillLevel]}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[9px] uppercase tracking-wider text-muted-foreground/40">
                          Description
                        </Label>
                        <Input
                          value={newSkillDesc}
                          onChange={(e) => setNewSkillDesc(e.target.value)}
                          placeholder="Optional description"
                          className="bg-secondary/30 border-border/50 text-xs h-8"
                        />
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={handleAddSkill}
                      className="w-full h-8 text-[10px] uppercase tracking-wider font-semibold bg-primary/90 hover:bg-primary"
                    >
                      <Plus className="w-3 h-3 mr-1.5" />
                      Add Skill
                    </Button>
                  </div>
                </div>
              )}

              {/* ─────────── BUDGET ─────────── */}
              {tab === "budget" && (
                <div className="space-y-5">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/50">
                    Resource Budget
                  </h3>
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-secondary/20 border border-border/20 space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground/50">Today's Usage</span>
                        <span className="font-mono">
                          {agent.budget.dailyTokensUsed.toLocaleString()} /{" "}
                          {agent.budget.dailyTokenLimit.toLocaleString()} tokens
                        </span>
                      </div>
                      <div className="h-2 w-full bg-secondary/40 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            agent.budget.dailyTokensUsed / agent.budget.dailyTokenLimit > 0.9
                              ? "bg-rose-500"
                              : agent.budget.dailyTokensUsed / agent.budget.dailyTokenLimit > 0.7
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                          )}
                          style={{
                            width: `${Math.min(100, (agent.budget.dailyTokensUsed / agent.budget.dailyTokenLimit) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-widest font-bold text-foreground/90">
                        Daily Token Limit
                      </Label>
                      <Input
                        type="number"
                        value={dailyTokenLimit}
                        onChange={(e) => setDailyTokenLimit(e.target.value)}
                        className="bg-secondary/30 border-border/50 text-sm"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-widest font-bold text-foreground/90">
                        Priority Level
                      </Label>
                      <Select value={budgetPriority} onValueChange={(v: any) => setBudgetPriority(v)}>
                        <SelectTrigger className="bg-secondary/30 border-border/50 text-sm h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border/50">
                          <SelectItem value="critical" className="text-xs">
                            🔴 Critical — Never throttled
                          </SelectItem>
                          <SelectItem value="high" className="text-xs">
                            🟠 High — Warn at limit
                          </SelectItem>
                          <SelectItem value="normal" className="text-xs">
                            🟡 Normal — Block at limit
                          </SelectItem>
                          <SelectItem value="low" className="text-xs">
                            ⚪ Low — First to throttle
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-widest font-bold text-foreground/90">
                        At Limit Behavior
                      </Label>
                      <Select value={budgetOverage} onValueChange={(v: any) => setBudgetOverage(v)}>
                        <SelectTrigger className="bg-secondary/30 border-border/50 text-sm h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border/50">
                          <SelectItem value="allow" className="text-xs">
                            Allow — Continue past limit (God-Agent only)
                          </SelectItem>
                          <SelectItem value="warn" className="text-xs">
                            Warn — Notify but continue
                          </SelectItem>
                          <SelectItem value="block" className="text-xs">
                            Block — Hard stop at limit
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {/* ─────────── TOOLS & CAPABILITIES ─────────── */}
              {tab === "tools" && (
                <div className="space-y-5">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/50">
                    Tools & Capabilities
                  </h3>
                  <p className="text-[10px] text-muted-foreground/40">
                    Capabilities define what high-level functions this agent can perform. These are shown
                    as badges on the agent card and used for task routing.
                  </p>

                  {/* Existing capabilities */}
                  <div className="flex flex-wrap gap-2">
                    {capabilities.map((cap) => (
                      <div
                        key={cap}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-secondary/30 border border-border/30 group hover:border-rose-500/30 hover:bg-rose-500/5 transition-colors"
                      >
                        <Wrench className="w-3 h-3 text-muted-foreground/40" />
                        <span className="text-xs">{cap}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveCapability(cap)}
                          className="p-0.5 rounded text-muted-foreground/20 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {capabilities.length === 0 && (
                      <p className="text-[10px] text-muted-foreground/20 italic">
                        No capabilities defined.
                      </p>
                    )}
                  </div>

                  {/* Add capability */}
                  <div className="flex items-center gap-2">
                    <Input
                      value={newCapability}
                      onChange={(e) => setNewCapability(e.target.value)}
                      placeholder="e.g. Code Generation, Security Audit"
                      className="bg-secondary/30 border-border/50 text-xs h-8 flex-1"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddCapability();
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleAddCapability}
                      className="h-8 text-[10px] uppercase tracking-wider shrink-0 border-border/50"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Add
                    </Button>
                  </div>

                  {/* Quick-add presets */}
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/40">
                      Quick-Add Presets
                    </Label>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        "Code Generation",
                        "Code Review",
                        "Bug Detection",
                        "Refactoring",
                        "Security Audit",
                        "API Integration",
                        "Testing",
                        "Documentation",
                        "UI/UX Design",
                        "DevOps",
                        "Data Analysis",
                        "Monitoring",
                      ]
                        .filter((p) => !capabilities.includes(p))
                        .map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() =>
                              setCapabilities((prev) => [...prev, preset])
                            }
                            className="text-[9px] px-2 py-1 rounded-md border border-dashed border-border/30 text-muted-foreground/40 hover:text-foreground hover:bg-secondary/40 hover:border-primary/30 transition-all"
                          >
                            + {preset}
                          </button>
                        ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ─────────── CREDENTIALS ─────────── */}
              {tab === "credentials" && (
                <div className="space-y-5">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/50">
                    Sovereign Agent Identity
                  </h3>

                  {/* ─── SOVEREIGN IDENTITY PANEL ─── */}
                  {(() => {
                    const authStatus = agent.credentials?.authStatus || 'unauthenticated';
                    const display = getAuthStatusDisplay(authStatus);
                    const isConnected = agent.credentials?.isAuthenticated || false;

                    const handleAuthenticate = async () => {
                      if (!credEmail.trim()) {
                        toast.error('Set a Gmail identity first before authenticating.');
                        return;
                      }
                      setIsAuthenticating(true);
                      try {
                        const tempAgent = {
                          ...agent,
                          credentials: {
                            ...(agent.credentials || { isAuthenticated: false, authStatus: 'unauthenticated' as const, google: { scopes: [], quotaUsed: 0 }, github: { scope: [], isConnected: false } }),
                            email: credEmail.trim(),
                          },
                        };
                        const result = await initiateGoogleAuth(tempAgent, ['jules', 'profile', 'email']);
                        if (result.success) {
                          const updatedCreds = buildAuthenticatedCredentials(
                            tempAgent.credentials!,
                            result
                          );
                          onSave({
                            ...agent,
                            credentials: updatedCreds,
                          });
                          toast.success(`${agent.name} is now SOVEREIGN as ${credEmail}`);
                        } else {
                          toast.error(`Auth failed: ${result.error}`);
                        }
                      } catch (err) {
                        toast.error('Authentication failed unexpectedly');
                      } finally {
                        setIsAuthenticating(false);
                      }
                    };

                    const handleDisconnect = () => {
                      disconnectGoogleAuth(agent.id);
                      onSave({
                        ...agent,
                        credentials: {
                          ...(agent.credentials || { isAuthenticated: false, authStatus: 'unauthenticated' as const, google: { scopes: [], quotaUsed: 0 }, github: { scope: [], isConnected: false } }),
                          isAuthenticated: false,
                          authStatus: 'unauthenticated',
                          google: { scopes: [], quotaUsed: 0 },
                        },
                      });
                      toast.info(`${agent.name} Google identity disconnected`);
                    };

                    return (
                      <div className={cn(
                        "rounded-xl border p-4 space-y-3 transition-all",
                        isConnected
                          ? "bg-emerald-500/5 border-emerald-500/20"
                          : "bg-secondary/20 border-border/30"
                      )}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="relative flex h-3 w-3">
                              {isConnected && (
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40" />
                              )}
                              <span className={cn(
                                "relative inline-flex rounded-full h-3 w-3",
                                isConnected ? "bg-emerald-400" : isAuthenticating ? "bg-amber-400 animate-pulse" : "bg-zinc-500"
                              )} />
                            </div>
                            <div>
                              <span className="text-xs font-semibold">
                                {isConnected ? 'Sovereign Identity Active' : 'Not Authenticated'}
                              </span>
                              {isConnected && agent.credentials?.authenticatedAt && (
                                <p className="text-[9px] text-muted-foreground/40 font-mono">
                                  Since {new Date(agent.credentials.authenticatedAt).toLocaleString()}
                                </p>
                              )}
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[8px] h-5 px-2 font-semibold uppercase tracking-wider",
                              display.bgColor, display.color
                            )}
                          >
                            {display.label}
                          </Badge>
                        </div>

                        {isConnected && agent.credentials?.google?.scopes && (
                          <div className="flex flex-wrap gap-1.5">
                            {agent.credentials.google.scopes.map((scope: string) => (
                              <Badge key={scope} variant="outline" className="text-[8px] h-4 px-1.5 bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                                {scope}
                              </Badge>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center gap-2 pt-1">
                          {!isConnected ? (
                            <Button
                              size="sm"
                              className="h-8 text-[11px] font-medium bg-emerald-600 hover:bg-emerald-500 text-white"
                              onClick={handleAuthenticate}
                              disabled={isAuthenticating || !credEmail.trim()}
                            >
                              {isAuthenticating ? (
                                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                              ) : (
                                <LogIn className="w-3.5 h-3.5 mr-1.5" />
                              )}
                              {isAuthenticating ? 'Authenticating...' : 'Authenticate Google'}
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 text-[11px] font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                              onClick={handleDisconnect}
                            >
                              <Unlink className="w-3.5 h-3.5 mr-1.5" />
                              Disconnect
                            </Button>
                          )}
                          {!credEmail.trim() && !isConnected && (
                            <span className="text-[9px] text-amber-400/60 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Set Gmail identity below first
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  <p className="text-[10px] text-muted-foreground/40 flex items-center justify-between">
                    <span>Configure this agent's Google account, API keys, and model preferences.</span>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-7 text-[10px] bg-primary/10 border-primary/20 text-primary hover:bg-primary/20 hover:text-primary transition-colors"
                      onClick={handleStartProvisioning}
                    >
                      <Sparkles className="w-3 h-3 mr-1.5" />
                      Provision Wizard
                    </Button>
                  </p>

                  {/* ─── PROVISIONING WIZARD ─── */}
                  {showProvisionWizard && (
                    <div className="bg-secondary/40 border border-primary/20 rounded-md p-4 space-y-4 relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/50 to-violet-500/50" />
                      
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold uppercase tracking-widest text-primary flex items-center gap-1.5">
                          <Crown className="w-3.5 h-3.5" /> Automated Provisioning
                        </h4>
                        <div className="flex gap-1">
                          <div className={cn("w-2 h-2 rounded-full", wizardStep >= 1 ? "bg-primary" : "bg-muted-foreground/30")} />
                          <div className={cn("w-2 h-2 rounded-full", wizardStep >= 2 ? "bg-primary" : "bg-muted-foreground/30")} />
                          <div className={cn("w-2 h-2 rounded-full", wizardStep >= 3 ? "bg-primary" : "bg-muted-foreground/30")} />
                        </div>
                      </div>

                      {wizardStep === 1 && (
                        <div className="space-y-3 animate-in fade-in slide-in-from-right-4 duration-300">
                          <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
                            To create an independent identity for this worker, you need a free Google AI Studio API key.
                            <br/><br/>
                            1. Open an incognito window or use a different browser profile.
                            <br/>
                            2. Sign in or create a new Google Account.
                            <br/>
                            3. Go to Google AI Studio and generate a new API key.
                          </p>
                          <div className="flex items-center gap-3 pt-2">
                            <Button 
                              size="sm" 
                              variant="secondary"
                              className="h-8 text-[11px] font-medium"
                              onClick={() => window.open("https://aistudio.google.com/app/apikey", "_blank")}
                            >
                              Open AI Studio <ExternalLink className="w-3 h-3 ml-1.5 opacity-50" />
                            </Button>
                            <Button 
                              size="sm" 
                              className="h-8 text-[11px] font-medium"
                              onClick={() => setWizardStep(2)}
                            >
                              I have my key <ArrowRight className="w-3 h-3 ml-1.5" />
                            </Button>
                          </div>
                        </div>
                      )}

                      {wizardStep === 2 && (
                        <div className="space-y-3 animate-in fade-in slide-in-from-right-4 duration-300">
                          <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-semibold text-muted-foreground/60">Paste API Key</Label>
                            <Input
                              type="password"
                              value={credGeminiKey}
                              onChange={(e) => setCredGeminiKey(e.target.value)}
                              placeholder="AIza..."
                              className="bg-background/50 border-border/50 text-xs font-mono h-8"
                            />
                            {wizardError && (
                              <p className="text-[10px] text-rose-400 flex items-center gap-1 mt-1">
                                <AlertTriangle className="w-3 h-3" /> {wizardError}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-3 pt-2">
                            <Button 
                              size="sm" 
                              variant="ghost"
                              className="h-8 text-[11px]"
                              onClick={() => setWizardStep(1)}
                            >
                              <ChevronLeft className="w-3 h-3 mr-1" /> Back
                            </Button>
                            <Button 
                              size="sm" 
                              className="h-8 text-[11px] font-medium"
                              onClick={handleTestKeyAndComplete}
                              disabled={isTestingKey}
                            >
                              {isTestingKey ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : <ShieldCheck className="w-3 h-3 mr-1.5" />}
                              Validate Identity
                            </Button>
                          </div>
                        </div>
                      )}

                      {wizardStep === 3 && (
                        <div className="py-2 text-center space-y-2 animate-in zoom-in-95 duration-300">
                          <div className="mx-auto w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3">
                            <CheckCircle2 className="w-5 h-5" />
                          </div>
                          <p className="text-[11px] font-medium text-emerald-400">Identity Provisioned</p>
                          <p className="text-[10px] text-muted-foreground/60">
                            Virtual identity assigned to {credEmail || "agent"}.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-4">
                    {/* Email */}
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-widest font-bold text-foreground/90 flex items-center gap-1.5">
                        <Mail className="w-3 h-3" /> Gmail Identity
                      </Label>
                      <Input
                        value={credEmail}
                        onChange={(e) => setCredEmail(e.target.value)}
                        placeholder="asclepius.god.agent@gmail.com"
                        className="bg-secondary/30 border-border/50 text-sm font-mono h-10"
                      />
                      <p className="text-[9px] text-muted-foreground/40">
                        The Google account this agent authenticates as. Used for Jules sandbox and Gemini API.
                      </p>
                    </div>

                    {/* Gemini API Key */}
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-widest font-bold text-foreground/90 flex items-center gap-1.5">
                        <KeyRound className="w-3 h-3" /> Personal Gemini API Key
                      </Label>
                      <Input
                        type="password"
                        value={credGeminiKey}
                        onChange={(e) => setCredGeminiKey(e.target.value)}
                        placeholder="AIza..."
                        className="bg-secondary/30 border-border/50 text-sm font-mono h-10"
                      />
                      <p className="text-[9px] text-muted-foreground/40">
                        This agent's own API key. Each key gets 1,500 free requests/day. Falls back to global key if empty.
                      </p>
                    </div>

                    {/* Gemini Model */}
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-widest font-bold text-foreground/90">
                        Preferred Gemini Model
                      </Label>
                      <Select value={credGeminiModel} onValueChange={setCredGeminiModel}>
                        <SelectTrigger className="w-full bg-secondary/30 border-border/50 text-sm h-10">
                          <SelectValue placeholder="Use global default" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1e1e24] border-border/50">
                          <SelectItem value=" " className="text-xs">Use global default</SelectItem>
                          <SelectItem value="gemini-3.1-pro-preview" className="text-xs">gemini-3.1-pro-preview (Best)</SelectItem>
                          <SelectItem value="gemini-3.1-flash-lite-preview" className="text-xs">gemini-3.1-flash-lite-preview (Fast)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="border-t border-border/20 pt-4 space-y-4">
                      <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/50">
                        Ollama Fallback
                      </h4>

                      {/* Ollama URL */}
                      <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-widest font-bold text-foreground/90">
                          Ollama Endpoint
                        </Label>
                        <Input
                          value={credOllamaUrl}
                          onChange={(e) => setCredOllamaUrl(e.target.value)}
                          placeholder="http://localhost:11434 (global default)"
                          className="bg-secondary/30 border-border/50 text-sm font-mono h-10"
                        />
                      </div>

                      {/* Ollama Model */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs uppercase tracking-widest font-bold text-foreground/90">
                            Ollama Model
                          </Label>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={refreshOllamaModels}
                            disabled={isRefreshingOllama}
                            className="h-6 text-[9px] uppercase tracking-wider text-muted-foreground/50 hover:text-foreground"
                          >
                            {isRefreshingOllama ? (
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            ) : (
                              <RefreshCw className="w-3 h-3 mr-1" />
                            )}
                            Refresh
                          </Button>
                        </div>
                        <Select value={credOllamaModel} onValueChange={setCredOllamaModel}>
                          <SelectTrigger className="w-full bg-secondary/30 border-border/50 text-sm h-10">
                            <SelectValue placeholder="Use global default" />
                          </SelectTrigger>
                          <SelectContent className="bg-[#1e1e24] border-border/50 max-h-60">
                            <SelectGroup>
                              <SelectLabel className="text-[9px] uppercase tracking-widest text-muted-foreground/40">
                                Local Models
                              </SelectLabel>
                              <SelectItem value=" " className="text-xs">Use global default</SelectItem>
                              {ollamaModels.length > 0 ? (
                                ollamaModels.map((m) => (
                                  <SelectItem key={m.name} value={m.name} className="text-xs">
                                    <div className="flex items-center justify-between w-full gap-4">
                                      <span>{m.name}</span>
                                      <span className="text-[9px] text-muted-foreground/40">
                                        {(m.size / 1024 / 1024 / 1024).toFixed(1)}GB
                                      </span>
                                    </div>
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value={credOllamaModel || "gemma4:e4b"} className="text-xs" disabled>
                                  {credOllamaModel || "gemma4:e4b"} (Current)
                                </SelectItem>
                              )}
                            </SelectGroup>
                            <SelectSeparator />
                            <SelectGroup>
                              <SelectLabel className="text-[9px] uppercase tracking-widest text-muted-foreground/40">
                                Cloud Models
                              </SelectLabel>
                              {[{name: "gemma2:cloud"}, {name: "llama3:cloud"}, {name: "mistral:cloud"}].map((m) => (
                                <SelectItem key={m.name} value={m.name} className="text-xs">
                                  <div className="flex items-center justify-between w-full gap-4">
                                    <span>{m.name}</span>
                                    <Badge variant="secondary" className="text-[7px] h-3.5 px-1 bg-sky-500/10 text-sky-400 border-0">CLOUD</Badge>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Quota Display */}
                    <div className="border-t border-border/20 pt-4">
                      <div className="p-4 rounded-xl bg-secondary/20 border border-border/20 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/50">Personal Quota</span>
                          <span className="text-xs font-mono text-foreground/60">
                            {agent.credentials?.quotaUsed || 0} / {agent.credentials?.quotaLimit || 1500}
                          </span>
                        </div>
                        <div className="h-2 w-full bg-secondary/40 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              ((agent.credentials?.quotaUsed || 0) / (agent.credentials?.quotaLimit || 1500)) > 0.9
                                ? "bg-rose-500"
                                : ((agent.credentials?.quotaUsed || 0) / (agent.credentials?.quotaLimit || 1500)) > 0.7
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                            )}
                            style={{ width: `${Math.min(100, ((agent.credentials?.quotaUsed || 0) / (agent.credentials?.quotaLimit || 1500)) * 100)}%` }}
                          />
                        </div>
                        <p className="text-[9px] text-muted-foreground/40">
                          Resets daily. Each Google account provides 1,500 free Gemini requests/day.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/20 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-[10px] uppercase tracking-wider text-muted-foreground/50 hover:text-foreground"
          >
            <RotateCcw className="w-3 h-3 mr-1.5" />
            Reset
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-[10px] uppercase tracking-wider border-border/50"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              className="text-[10px] uppercase tracking-wider bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
            >
              <Save className="w-3 h-3 mr-1.5" />
              Save Configuration
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
