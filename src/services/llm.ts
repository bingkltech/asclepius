/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { analyzeCode as analyzeWithGemini, chatWithAgent as chatWithGeminiAgent } from "./gemini";
import { chatWithOllama, generateOllamaContent, listOllamaModels, OllamaModel } from "./ollama";
import { LLMSettings, CodeAnalysis, Agent } from "../types";
import { Content } from "@google/genai";
import { recordAPICall } from "./apiBudget";
import { type CallPurpose } from "../types";

// ─── Per-Agent Credential Resolver ───
// Merges an agent's personal credentials with global settings.
// Priority: Agent credentials → Agent model field → Global settings.
// 
// KEY DESIGN: The global Settings API key is the "company credit card" — used by
// God-Agent and newly created agents by default. Each agent can have their own
// personal Gemini API key (from their own Gmail account), which gives them their
// own independent 5-hour quota. This multiplies the fleet's total API budget.
export function resolveAgentSettings(agent: Agent | undefined, globalSettings: LLMSettings): LLMSettings {
  if (!agent?.credentials) return globalSettings;

  const creds = agent.credentials;

  // Reset per-agent quota if it's a new day
  if (creds.lastQuotaReset) {
    const lastReset = new Date(creds.lastQuotaReset).toDateString();
    const today = new Date().toDateString();
    if (lastReset !== today) {
      creds.quotaUsed = 0;
      creds.lastQuotaReset = new Date().toISOString();
    }
  }

  // Determine provider: respect 'auto' (Smart Router) even if agent has personal key
  // If the global setting is 'auto', keep it as 'auto' — the Smart Router will decide.
  // If the global setting is 'gemini' or 'ollama', use the agent's key for that provider.
  const resolvedProvider = globalSettings.provider; // Always respect global routing strategy
  const hasPersonalKey = !!creds.geminiApiKey;

  return {
    provider: resolvedProvider,
    geminiApiKey: creds.geminiApiKey || globalSettings.geminiApiKey,
    geminiModel: creds.geminiModel || agent.model || globalSettings.geminiModel,
    ollamaBaseUrl: creds.ollamaBaseUrl || globalSettings.ollamaBaseUrl,
    ollamaModel: creds.ollamaModel || agent.model || globalSettings.ollamaModel,
    autoHeal: globalSettings.autoHeal,
    usage: globalSettings.usage,
    _keySource: hasPersonalKey ? 'personal' : 'global',
  };
}

// Track usage for a specific agent's personal quota
export function trackAgentQuota(agent: Agent): void {
  if (!agent.credentials) return;
  agent.credentials.quotaUsed = (agent.credentials.quotaUsed || 0) + 1;
  if (!agent.credentials.lastQuotaReset) {
    agent.credentials.lastQuotaReset = new Date().toISOString();
  }
}

// ─── Gemini Rate Limit Tracker ───
// Persisted in localStorage so it survives page reloads.
interface RateLimitState {
  isLimited: boolean;
  hitAt: number;       // timestamp when 429 was detected
  cooldownMs: number;  // how long to wait before retrying Gemini
  refreshAt: number;   // timestamp when Gemini quota resets
}

const RATE_LIMIT_KEY = "asclepius_gemini_rate_limit";
const DEFAULT_COOLDOWN_MS = 60 * 1000; // Start with 1 minute cooldown
const MAX_COOLDOWN_MS = 5 * 60 * 1000; // Cap at 5 minutes for periodic re-attempts

function getRateLimitState(): RateLimitState {
  try {
    const stored = localStorage.getItem(RATE_LIMIT_KEY);
    if (stored) {
      const state: RateLimitState = JSON.parse(stored);
      // Auto-clear if cooldown has expired
      if (state.isLimited && Date.now() >= state.refreshAt) {
        clearRateLimit();
        return { isLimited: false, hitAt: 0, cooldownMs: DEFAULT_COOLDOWN_MS, refreshAt: 0 };
      }
      return state;
    }
  } catch { /* ignore */ }
  return { isLimited: false, hitAt: 0, cooldownMs: DEFAULT_COOLDOWN_MS, refreshAt: 0 };
}

function setRateLimit(): RateLimitState {
  const prev = getRateLimitState();
  // Exponential backoff: double cooldown each consecutive hit, cap at MAX
  const nextCooldown = prev.isLimited
    ? Math.min(prev.cooldownMs * 2, MAX_COOLDOWN_MS)
    : DEFAULT_COOLDOWN_MS;

  const now = Date.now();
  const state: RateLimitState = {
    isLimited: true,
    hitAt: now,
    cooldownMs: nextCooldown,
    refreshAt: now + nextCooldown,
  };
  localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(state));
  return state;
}

function clearRateLimit(): void {
  localStorage.removeItem(RATE_LIMIT_KEY);
}

/** Returns human-readable time until Gemini refreshes */
export function getGeminiRefreshInfo(): { isLimited: boolean; refreshAt: number; timeLeft: string } {
  const state = getRateLimitState();
  if (!state.isLimited) {
    return { isLimited: false, refreshAt: 0, timeLeft: "" };
  }
  const remaining = Math.max(0, state.refreshAt - Date.now());
  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  return {
    isLimited: true,
    refreshAt: state.refreshAt,
    timeLeft: mins > 0 ? `${mins}m ${secs}s` : `${secs}s`,
  };
}

/** Detect if an error warrants immediate failover (429, 401, timeout, network) */
function isFailoverCondition(error: any): boolean {
  if (!error) return false;
  const msg = error?.message || "";
  const str = typeof error === "string" ? error : JSON.stringify(error);
  
  // Rate Limits (429)
  if (msg.includes("429") || error?.status === 429 || str.includes("429") || str.includes("RESOURCE_EXHAUSTED") || str.includes("quota")) return true;
  
  // Auth Errors (401 / Missing Key)
  if (msg.includes("401") || error?.status === 401 || str.includes("401") || str.includes("API key") || str.includes("API_KEY")) return true;
  
  // Network & Timeouts
  if (msg.toLowerCase().includes("timeout") || msg.toLowerCase().includes("network") || msg.toLowerCase().includes("fetch failed")) return true;

  return false;
}

// ─── Public API ───

export const testConnection = async (settings: LLMSettings): Promise<{ success: boolean; message: string }> => {
  try {
    if (settings.provider === 'gemini') {
      if (!settings.geminiApiKey) {
        return { success: false, message: "Gemini API Key is missing." };
      }
      const limitInfo = getGeminiRefreshInfo();
      if (limitInfo.isLimited) {
        return { success: false, message: `Gemini is rate-limited. Refreshes in ${limitInfo.timeLeft}. System is using Ollama as fallback.` };
      }
      await chatWithGeminiAgent("ping", [], "Respond with 'pong'", settings.geminiApiKey);
      return { success: true, message: "Gemini API connected successfully." };
    } else {
      if (!settings.ollamaBaseUrl) {
        return { success: false, message: "Ollama Base URL is missing." };
      }
      const models = await listOllamaModels(settings.ollamaBaseUrl);
      if (!models.some((m: OllamaModel) => m.name === settings.ollamaModel)) {
        return { success: false, message: `Ollama is reachable, but model '${settings.ollamaModel}' is not installed.` };
      }
      return { success: true, message: `Ollama connected successfully (Model: ${settings.ollamaModel}).` };
    }
  } catch (error) {
    if (isFailoverCondition(error)) {
      const state = setRateLimit();
      const info = getGeminiRefreshInfo();
      return { success: false, message: `Gemini unavailable (Disruption/429/401). Auto-fallback to Ollama activated. Gemini reconnect attempt in ${info.timeLeft}.` };
    }
    const errorMsg = error instanceof Error ? error.message : String(error);
    return { success: false, message: `Connection failed: ${errorMsg}` };
  }
};

export const getUnifiedCodeAnalysis = async (settings: LLMSettings, code: string): Promise<CodeAnalysis> => {
  let routedProvider = settings.provider;
  if (routedProvider === 'auto') {
    // Cognitive Load Balancer: Code analysis is highly complex, always use Gemini unless it's a tiny snippet
    routedProvider = code.length > 500 ? 'gemini' : 'ollama';
  }

  const limitInfo = getGeminiRefreshInfo();
  const useGemini = routedProvider === 'gemini' && !limitInfo.isLimited;

  if (useGemini) {
    try {
      const result = await analyzeWithGemini(code, settings.geminiApiKey);
      recordAPICall({
        agentId: 'system', agentName: 'Sandbox',
        provider: 'gemini', requestedProvider: settings.provider,
        routedBy: settings.provider === 'auto' ? 'smart_router' : 'user',
        keySource: settings._keySource || 'global',
        purpose: 'sandbox_analysis', outcome: 'success',
        promptLength: code.length, responseLength: JSON.stringify(result).length,
        productive: true, description: `Sandbox code analysis (${code.length} chars)`,
      });
      return result;
    } catch (error) {
      if (isFailoverCondition(error)) {
        setRateLimit();
        recordAPICall({
          agentId: 'system', agentName: 'Sandbox',
          provider: 'gemini', requestedProvider: settings.provider,
          routedBy: settings.provider === 'auto' ? 'smart_router' : 'user',
          keySource: settings._keySource || 'global',
          purpose: 'sandbox_analysis', outcome: 'failed_429',
          promptLength: code.length, responseLength: 0,
          productive: false, description: `Sandbox analysis FAILED (429/rate limit)`,
        });
        console.warn("[FALLBACK_INIT] Gemini disruption detected (Network/401/429). Falling back to Ollama.");
        // Fall through to Ollama below
      } else {
        throw error;
      }
    }
  }

  // Ollama path (either primary or fallback)
  try {
    const prompt = `Analyze the following code for bugs, suggest improvements, and provide a brief explanation. 
    Return the result in JSON format with the following structure:
    {
      "bugs": ["list of bugs"],
      "suggestions": ["list of improvements"],
      "explanation": "brief explanation",
      "refactoredCode": "the improved code"
    }
    
    Code:
    ${code}`;
    
    const response = await generateOllamaContent(settings.ollamaBaseUrl, settings.ollamaModel, prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      recordAPICall({
        agentId: 'system', agentName: 'Sandbox',
        provider: 'ollama', requestedProvider: settings.provider,
        routedBy: settings.provider === 'auto' ? 'smart_router' : 'user',
        keySource: 'global', // Ollama is always free/local
        purpose: 'sandbox_analysis', outcome: limitInfo.isLimited ? 'fallback_ollama' : 'success',
        promptLength: code.length, responseLength: response.length,
        productive: true, description: `Sandbox analysis via Ollama (${code.length} chars)`,
      });
      if (limitInfo.isLimited) {
        result.explanation = `*[⚡ Gemini rate-limited. Using Ollama (${settings.ollamaModel}). Gemini refreshes in ${limitInfo.timeLeft}.]*\n\n` + result.explanation;
      }
      return result;
    }
    throw new Error("Could not parse JSON from Ollama response");
  } catch (ollamaError) {
    console.warn("Ollama Analysis also failed:", ollamaError);
    return {
      bugs: ["Analysis unavailable"],
      suggestions: [],
      explanation: limitInfo.isLimited
        ? `⚠️ Gemini is rate-limited (refreshes in ${limitInfo.timeLeft}). Ollama fallback also failed. Please ensure Ollama is running.`
        : "Analysis service unavailable.",
    };
  }
};

export const getUnifiedChatResponse = async (
  settings: LLMSettings, 
  message: string, 
  history: any[], 
  systemContext: string,
  agentName: string = "hermes.ai",
  agentRole: string = "Overseer Agent"
): Promise<string> => {
  let systemInstruction = `You are ${agentName}, an autonomous AI agent with the role: ${agentRole}. You have access to the system logs and agent status. Current system context: ${systemContext}`;

  let routedProvider = settings.provider;
  
  if (routedProvider === 'auto') {
    // Cognitive Load Balancer: Only analyze the USER'S message, NOT the systemContext.
    const contentToAnalyze = message.toLowerCase();
    
    if (contentToAnalyze.includes("error") || contentToAnalyze.includes("failed") || contentToAnalyze.includes("bug") || contentToAnalyze.includes("critical") || contentToAnalyze.includes("exception")) {
      routedProvider = 'gemini';
    } else if (message.length > 500) {
      routedProvider = 'gemini';
    } else if (contentToAnalyze.includes("[system_audit_due]")) {
      routedProvider = 'gemini';
    } else {
      routedProvider = 'ollama';
    }
  }

  const limitInfo = getGeminiRefreshInfo();

  // ─── Helper: Try Gemini ───
  const tryGemini = async (): Promise<string | null> => {
    if (!settings.geminiApiKey || limitInfo.isLimited) return null;
    try {
      const geminiHistory: Content[] = history.map(h => ({
        role: h.role === 'model' ? 'model' : 'user',
        parts: [{ text: h.content }]
      }));
      const response = await chatWithGeminiAgent(message, geminiHistory, systemInstruction, settings.geminiApiKey, settings.geminiModel);
      let purpose: CallPurpose = 'human_command';
      const ctx = message.toLowerCase();
      if (ctx.includes('[system_audit_due]')) purpose = 'god_audit';
      else if (ctx.includes('error') || ctx.includes('failed') || ctx.includes('bug')) purpose = 'error_fix';
      else if (ctx.includes('perform task:')) purpose = 'scheduled_task';
      
      recordAPICall({
        agentId: agentName, agentName,
        provider: 'gemini', requestedProvider: settings.provider,
        routedBy: settings.provider === 'auto' ? 'smart_router' : 'user',
        keySource: settings._keySource || 'global',
        purpose, outcome: 'success',
        promptLength: message.length + systemContext.length,
        responseLength: response.length,
        productive: true, description: `${agentName}: ${message.slice(0, 80)}`,
      });
      return response;
    } catch (error) {
      if (isFailoverCondition(error)) {
        setRateLimit();
        recordAPICall({
          agentId: agentName, agentName,
          provider: 'gemini', requestedProvider: settings.provider,
          routedBy: settings.provider === 'auto' ? 'smart_router' : 'user',
          keySource: settings._keySource || 'global',
          purpose: 'unknown', outcome: 'failed_429',
          promptLength: message.length, responseLength: 0,
          productive: false, description: `${agentName}: FAILED 429 rate limit`,
        });
        console.warn(`[FALLBACK_INIT] Gemini disruption detected.`);
      }
      return null;
    }
  };

  // ─── Helper: Try Ollama ───
  const tryOllama = async (): Promise<string | null> => {
    if (!settings.ollamaBaseUrl) return null;
    try {
      const ollamaHistory = history.map(h => ({
        role: h.role === 'model' ? 'assistant' : 'user',
        content: h.content
      }));
      ollamaHistory.push({ role: 'user', content: message });
      
      const response = await chatWithOllama(settings.ollamaBaseUrl, settings.ollamaModel, ollamaHistory, systemInstruction);
      
      let ollamaPurpose: CallPurpose = 'human_command';
      const ctx = message.toLowerCase();
      if (ctx.includes('perform task:')) ollamaPurpose = 'scheduled_task';
      else if (ctx.includes('error') || ctx.includes('bug')) ollamaPurpose = 'error_fix';

      recordAPICall({
        agentId: agentName, agentName,
        provider: 'ollama', requestedProvider: settings.provider,
        routedBy: settings.provider === 'auto' ? 'smart_router' : 'user',
        keySource: 'global',
        purpose: ollamaPurpose, outcome: limitInfo.isLimited ? 'fallback_ollama' : 'success',
        promptLength: message.length, responseLength: response.length,
        productive: true, description: `${agentName} via Ollama: ${message.slice(0, 80)}`,
      });

      if (limitInfo.isLimited) {
        return `*[⚡ Gemini rate-limited. Running on Ollama (${settings.ollamaModel}). Gemini refreshes in ${limitInfo.timeLeft}.]*\n\n${response}`;
      }
      return response;
    } catch (ollamaError) {
      console.warn(`[OLLAMA_FAIL] ${ollamaError instanceof Error ? ollamaError.message : 'Connection failed'}`);
      return null;
    }
  };

  // ─── Bidirectional Fallback: Try primary, then fallback to the other ───
  let response: string | null = null;

  if (routedProvider === 'gemini') {
    // Primary: Gemini → Fallback: Ollama
    response = await tryGemini();
    if (response) return response;
    
    response = await tryOllama();
    if (response) return response;
  } else {
    // Primary: Ollama → Fallback: Gemini (THE FIX)
    response = await tryOllama();
    if (response) return response;
    
    if (!limitInfo.isLimited && settings.geminiApiKey) {
      console.warn('[FALLBACK_INIT] Ollama failed. Attempting Gemini as fallback.');
      response = await tryGemini();
      if (response) return `*[⚡ Ollama unavailable. Using Gemini as fallback.]*\n\n${response}`;
    }
  }

  const ollamaStatus = settings.ollamaBaseUrl ? `Model "${settings.ollamaModel}" failed or timed out` : 'No Ollama URL configured';
  const geminiStatus = limitInfo.isLimited ? `Quota exhausted (refreshes in ${limitInfo.timeLeft})` : (!settings.geminiApiKey ? 'No API key configured' : 'Failed');
  return `⚠️ **Both providers failed.**\n\n- **Ollama:** ${ollamaStatus}\n- **Gemini:** ${geminiStatus}\n\nCheck: Is Ollama running? Is "${settings.ollamaModel}" available?`;
};
