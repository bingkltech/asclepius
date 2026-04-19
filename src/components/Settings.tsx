/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { LLMSettings, LLMProvider } from "../types";
import { listOllamaModels, OllamaModel } from "../services/ollama";
import { testConnection, getGeminiRefreshInfo } from "../services/llm";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Cpu, Globe, Loader2, AlertTriangle, CheckCircle2, XCircle, Zap, ZapOff, Shield, Clock } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";

interface SettingsProps {
  settings: LLMSettings;
  onSettingsChange: (settings: LLMSettings) => void;
}

export function Settings({ settings, onSettingsChange }: SettingsProps) {
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const cloudModels = [
    { name: "gemma2:cloud", size: "Remote" },
    { name: "llama3:cloud", size: "Remote" },
    { name: "mistral:cloud", size: "Remote" },
  ];

  const refreshModels = async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const models = await listOllamaModels(settings.ollamaBaseUrl);
      setOllamaModels(models);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect to Ollama");
      setOllamaModels([]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await testConnection(settings);
      setTestResult(result);
    } catch (err) {
      setTestResult({ success: false, message: err instanceof Error ? err.message : "Test failed unexpectedly." });
    } finally {
      setIsTesting(false);
    }
  };

  // Clear test result when provider changes
  useEffect(() => {
    setTestResult(null);
  }, [settings.provider]);

  useEffect(() => {
    if (settings.provider === "ollama" || settings.provider === "auto") {
      refreshModels();
    }
    // Force legacy settings to 'auto' to enforce the implicit Smart Router
    if (settings.provider !== "auto") {
      onSettingsChange({ ...settings, provider: "auto" });
    }
  }, [settings.provider, settings.ollamaBaseUrl, onSettingsChange]);

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground/70">
          Configure your AI providers and system preferences.
        </p>
      </div>

      {/* Master API Keys Card */}
      <div className="gradient-border rounded-xl bg-card/80 overflow-hidden">
        <div className="px-5 py-4 border-b border-border/20 bg-primary/5">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" /> Master API Configuration
          </h3>
          <p className="text-[11px] text-muted-foreground/70 mt-1">
            These are the <b>Global Master Keys</b>. The Smart Router uses these keys by default for the God-Agent and any newly spawned agents. 
            Individual agents can override these with their own personal keys in their Agent Config panel to multiply your daily quota.
          </p>
        </div>
        <div className="p-5 space-y-6">

          <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/15 text-xs space-y-1">
            <div className="font-semibold text-amber-400 flex items-center gap-2">
              <Zap className="w-3.5 h-3.5" />
              Cognitive Load Balancer Active
            </div>
            <p className="text-muted-foreground/60 text-[10px] leading-relaxed">
              Routine tasks → Ollama (free). Errors, audits, and complex analysis → Gemini 3.1 Pro (paid). 
              Configure both providers below.
            </p>
          </div>

          {/* Gemini config */}
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="gemini-model" className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/60">
                Gemini Model
              </Label>
              <Input
                id="gemini-model"
                value={settings.geminiModel}
                onChange={(e) =>
                  onSettingsChange({ ...settings, geminiModel: e.target.value })
                }
                placeholder="gemini-3.1-pro-preview"
                className="bg-secondary/30 border-border/50 text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gemini-api-key" className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/60">
                Master Gemini API Key
              </Label>
              <Input
                id="gemini-api-key"
                type="password"
                value={settings.geminiApiKey || ""}
                onChange={(e) =>
                  onSettingsChange({ ...settings, geminiApiKey: e.target.value })
                }
                placeholder="Enter your Gemini API key..."
                className="bg-secondary/30 border-border/50 text-xs"
              />
              <p className="text-[9px] text-muted-foreground/40">
                This is the <strong className="text-amber-400">company credit card</strong>. Used by God-Agent
                and any agent without a personal key. Per-agent keys are set in Agent Config → Credentials tab.
              </p>
            </div>
          </div>

          {/* Ollama config */}
          <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="ollama-url" className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/60">
                  Ollama Base URL
                </Label>
                <Input
                  id="ollama-url"
                  value={settings.ollamaBaseUrl}
                  onChange={(e) =>
                    onSettingsChange({ ...settings, ollamaBaseUrl: e.target.value })
                  }
                  placeholder="http://localhost:11434"
                  className="bg-secondary/30 border-border/50 text-xs"
                />
              </div>

              {error && (
                <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/15 text-xs space-y-2">
                  <div className="font-semibold text-rose-400 flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Connection Error
                  </div>
                  <p className="text-muted-foreground/60">{error}</p>
                  <div className="pt-2 space-y-1">
                    <p className="font-semibold text-foreground/70 text-[10px]">How to fix:</p>
                    <ol className="list-decimal list-inside space-y-0.5 text-[10px] text-muted-foreground/50">
                      <li>Ensure Ollama is running locally.</li>
                      <li>
                        Set env variable:{" "}
                        <code className="bg-secondary/60 px-1 py-0.5 rounded text-violet-400 text-[8px]">
                          OLLAMA_ORIGINS="*"
                        </code>
                      </li>
                      <li>Restart Ollama.</li>
                    </ol>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="ollama-model" className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/60">
                    Ollama Model
                  </Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={refreshModels}
                    disabled={isRefreshing}
                    className="h-6 text-[9px] uppercase tracking-wider text-muted-foreground/50 hover:text-foreground"
                  >
                    {isRefreshing ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3 h-3 mr-1" />
                    )}
                    Refresh
                  </Button>
                </div>

                <Select
                  value={settings.ollamaModel}
                  onValueChange={(val) =>
                    onSettingsChange({ ...settings, ollamaModel: val })
                  }
                >
                  <SelectTrigger className="w-full bg-secondary/30 border-border/50 text-xs">
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1e1e24] border-border/50">
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
                                {m.name.includes('cloud') || m.size < 1048576 
                                  ? '☁️ Cloud' 
                                  : `${(m.size / 1024 / 1024 / 1024).toFixed(1)}GB`
                                }
                              </span>
                            </div>
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="gemma4:e4b" disabled className="text-xs">
                          gemma4:e4b (Default)
                        </SelectItem>
                      )}
                    </SelectGroup>
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel className="text-[9px] uppercase tracking-widest text-muted-foreground/40">
                        Cloud Models
                      </SelectLabel>
                      {cloudModels.map((m) => (
                        <SelectItem key={m.name} value={m.name} className="text-xs">
                          <div className="flex items-center justify-between w-full gap-4">
                            <span>{m.name}</span>
                            <Badge
                              variant="secondary"
                              className="text-[7px] h-3.5 px-1 bg-sky-500/10 text-sky-400 border-0"
                            >
                              CLOUD
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>

                <p className="text-[9px] text-muted-foreground/40 italic">
                  Active:{" "}
                  <span className="text-violet-400 font-mono not-italic">{settings.ollamaModel}</span>
                </p>
              </div>
            </div>

          {/* ─── Test Connection ─── */}
          <div className="pt-2 border-t border-border/15 space-y-3">
            <Button
              onClick={handleTestConnection}
              disabled={isTesting}
              className={cn(
                "w-full h-10 text-xs uppercase tracking-wider font-semibold transition-all duration-300",
                testResult?.success
                  ? "bg-emerald-600/90 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20"
                  : testResult?.success === false
                  ? "bg-rose-600/90 hover:bg-rose-600 shadow-lg shadow-rose-500/20"
                  : "bg-primary/90 hover:bg-primary shadow-lg shadow-primary/20"
              )}
            >
              {isTesting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                  Testing Connection...
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 mr-2" />
                  Test Connection
                </>
              )}
            </Button>

            <AnimatePresence mode="wait">
              {testResult && (
                <motion.div
                  initial={{ opacity: 0, y: -8, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: -8, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className={cn(
                    "p-4 rounded-xl border text-xs space-y-2",
                    testResult.success
                      ? "bg-emerald-500/5 border-emerald-500/20"
                      : "bg-rose-500/5 border-rose-500/20"
                  )}
                >
                  <div className={cn(
                    "font-semibold flex items-center gap-2",
                    testResult.success ? "text-emerald-400" : "text-rose-400"
                  )}>
                    {testResult.success ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                    {testResult.success ? "Connection Successful" : "Connection Failed"}
                  </div>
                  <p className="text-muted-foreground/60 text-[11px] leading-relaxed">
                    {testResult.message}
                  </p>
                  {testResult.success && (
                    <div className="flex items-center gap-2 pt-1">
                      <Badge variant="outline" className="text-[8px] h-4 bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                        {settings.provider === "gemini" ? settings.geminiModel : settings.ollamaModel}
                      </Badge>
                      <Badge variant="outline" className="text-[8px] h-4 bg-sky-500/10 text-sky-400 border-sky-500/20">
                        {settings.provider === "gemini" ? "CLOUD" : "LOCAL"}
                      </Badge>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* API Quota Status Card */}
      <div className="gradient-border rounded-xl bg-card/80 overflow-hidden">
        <div className="px-5 py-4 border-b border-border/20">
          <h3 className="text-sm font-semibold">API Quota Status</h3>
          <p className="text-[11px] text-muted-foreground/50 mt-0.5">
            Real-time Gemini quota monitoring and auto-failover status.
          </p>
        </div>
        <div className="p-5 space-y-4">
          {(() => {
            const quota = getGeminiRefreshInfo();
            if (quota.isLimited) {
              const totalCooldown = quota.refreshAt - (quota.refreshAt - 60000); // approximate
              const elapsed = Date.now() - (quota.refreshAt - 60000);
              const progress = Math.min(100, Math.max(0, (elapsed / 60000) * 100));
              return (
                <>
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/15">
                    <div className="p-2.5 rounded-lg bg-amber-500/10">
                      <ZapOff className="w-5 h-5 text-amber-400" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="text-xs font-semibold text-amber-400">Gemini Rate Limited (429)</div>
                      <div className="text-[10px] text-muted-foreground/50">
                        Auto-failover active. All requests routed to <span className="text-emerald-400 font-semibold">Ollama ({settings.ollamaModel})</span>.
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[9px] h-5 bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse">
                      <Clock className="w-3 h-3 mr-1" />
                      {quota.timeLeft}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[9px] uppercase tracking-widest font-semibold text-muted-foreground/50">
                      <span>Cooldown Progress</span>
                      <span className="text-amber-400">Refreshing...</span>
                    </div>
                    <div className="h-1.5 w-full bg-secondary/40 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 rounded-full"
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 60, ease: "linear" }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-secondary/20 border border-border/20 space-y-1">
                      <div className="text-[9px] uppercase tracking-widest text-muted-foreground/40">Active Provider</div>
                      <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                        <Cpu className="w-3.5 h-3.5" />
                        Ollama (Local)
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-secondary/20 border border-border/20 space-y-1">
                      <div className="text-[9px] uppercase tracking-widest text-muted-foreground/40">Active Model</div>
                      <div className="text-xs font-semibold text-violet-400 font-mono">{settings.ollamaModel}</div>
                    </div>
                  </div>
                </>
              );
            }
            return (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
                <div className="p-2.5 rounded-lg bg-emerald-500/10">
                  <Zap className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="text-xs font-semibold text-emerald-400">All Systems Nominal</div>
                  <div className="text-[10px] text-muted-foreground/50">
                    Gemini API is online and responding. No rate limits detected.
                  </div>
                </div>
                <Badge variant="outline" className="text-[9px] h-5 bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                  <Shield className="w-3 h-3 mr-1" />
                  Nominal
                </Badge>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
