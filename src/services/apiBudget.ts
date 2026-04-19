/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * API Budget Ledger — Tracks every LLM call with metadata.
 * The God-Agent uses this data during reviews to provide hindsight
 * on API efficiency and recommend optimizations.
 */

// ─── Types ───

export type CallPurpose = 
  | 'human_command'      // User typed a message
  | 'scheduled_task'     // Orchestrator executed a scheduled task
  | 'sandbox_analysis'   // Sandbox code analysis
  | 'error_fix'          // Error detection/fix
  | 'god_audit'          // God-Agent 3-day review
  | 'simulation'         // Simulation activity (should be rare/free)
  | 'connection_test'    // Test Connection button
  | 'unknown';

export type CallOutcome = 'success' | 'failed_429' | 'failed_error' | 'fallback_ollama';

export interface APICallRecord {
  id: string;
  timestamp: string;
  agentId: string;
  agentName: string;
  provider: 'gemini' | 'ollama';      // Which provider actually handled it
  requestedProvider: 'gemini' | 'ollama' | 'auto';  // What was requested
  routedBy: 'user' | 'smart_router';  // Who decided the provider
  purpose: CallPurpose;
  outcome: CallOutcome;
  promptLength: number;                // Characters sent
  responseLength: number;              // Characters received
  productive: boolean;                 // Did this call produce deliverable output?
  description: string;                 // Human-readable summary
}

export interface BudgetSummary {
  totalCalls: number;
  geminiCalls: number;
  ollamaCalls: number;
  productiveCalls: number;
  wastedCalls: number;
  failed429Count: number;
  efficiencyScore: number;            // 0-100, percentage of productive calls
  callsByPurpose: Record<string, number>;
  callsByAgent: Record<string, number>;
  periodStart: string;
  periodEnd: string;
  topRecommendation: string;
}

// ─── Storage ───

const STORAGE_KEY = 'asclepius_api_budget';
const MAX_RECORDS = 200; // Keep last 200 calls

function loadRecords(): APICallRecord[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return [];
}

function saveRecords(records: APICallRecord[]): void {
  // Keep only the most recent records
  const trimmed = records.slice(-MAX_RECORDS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

// ─── Public API ───

/** Record a single API call */
export function recordAPICall(call: Omit<APICallRecord, 'id' | 'timestamp'>): APICallRecord {
  const record: APICallRecord = {
    ...call,
    id: `api-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
  };

  const records = loadRecords();
  records.push(record);
  saveRecords(records);

  return record;
}

/** Get all records (optionally filtered by time range) */
export function getAPIRecords(sinceHoursAgo?: number): APICallRecord[] {
  const records = loadRecords();
  if (!sinceHoursAgo) return records;

  const cutoff = Date.now() - (sinceHoursAgo * 3600000);
  return records.filter(r => new Date(r.timestamp).getTime() > cutoff);
}

/** Generate a budget summary for the God-Agent's review */
export function generateBudgetSummary(sinceHoursAgo: number = 5): BudgetSummary {
  const records = getAPIRecords(sinceHoursAgo);
  const now = new Date().toISOString();
  const periodStart = new Date(Date.now() - sinceHoursAgo * 3600000).toISOString();

  if (records.length === 0) {
    return {
      totalCalls: 0,
      geminiCalls: 0,
      ollamaCalls: 0,
      productiveCalls: 0,
      wastedCalls: 0,
      failed429Count: 0,
      efficiencyScore: 100,
      callsByPurpose: {},
      callsByAgent: {},
      periodStart,
      periodEnd: now,
      topRecommendation: 'No API calls recorded. System is idle.'
    };
  }

  const geminiCalls = records.filter(r => r.provider === 'gemini').length;
  const ollamaCalls = records.filter(r => r.provider === 'ollama').length;
  const productiveCalls = records.filter(r => r.productive).length;
  const wastedCalls = records.filter(r => !r.productive).length;
  const failed429Count = records.filter(r => r.outcome === 'failed_429').length;

  // Calls by purpose
  const callsByPurpose: Record<string, number> = {};
  records.forEach(r => {
    callsByPurpose[r.purpose] = (callsByPurpose[r.purpose] || 0) + 1;
  });

  // Calls by agent
  const callsByAgent: Record<string, number> = {};
  records.forEach(r => {
    callsByAgent[r.agentName] = (callsByAgent[r.agentName] || 0) + 1;
  });

  const efficiencyScore = records.length > 0
    ? Math.round((productiveCalls / records.length) * 100)
    : 100;

  // Generate recommendation
  let topRecommendation = '';
  if (failed429Count > 3) {
    topRecommendation = `CRITICAL: ${failed429Count} rate limit hits detected. Reduce Gemini call frequency or switch more tasks to Ollama.`;
  } else if (efficiencyScore < 50) {
    topRecommendation = `WARNING: Only ${efficiencyScore}% of API calls were productive. ${wastedCalls} calls were wasted on non-productive tasks. Review which agents are making unnecessary calls.`;
  } else if (geminiCalls > ollamaCalls * 3) {
    topRecommendation = `OPTIMIZATION: Gemini is handling ${geminiCalls} calls vs Ollama's ${ollamaCalls}. Consider routing more routine tasks to Ollama to preserve quota.`;
  } else if (efficiencyScore >= 80) {
    topRecommendation = `NOMINAL: ${efficiencyScore}% efficiency. API budget is being used wisely.`;
  } else {
    topRecommendation = `ACCEPTABLE: ${efficiencyScore}% efficiency. Room for improvement — review simulation and housekeeping calls.`;
  }

  return {
    totalCalls: records.length,
    geminiCalls,
    ollamaCalls,
    productiveCalls,
    wastedCalls,
    failed429Count,
    efficiencyScore,
    callsByPurpose,
    callsByAgent,
    periodStart,
    periodEnd: now,
    topRecommendation,
  };
}

/** Format the budget summary as a text block for injection into the God-Agent prompt */
export function formatBudgetReportForAgent(): string {
  const summary = generateBudgetSummary(5); // Last 5 hours (one Gemini refresh cycle)

  if (summary.totalCalls === 0) {
    return `═══ API BUDGET REPORT (Last 5hrs) ═══\nNo API calls recorded. System is idle. Budget: 100% preserved.`;
  }

  const purposeLines = Object.entries(summary.callsByPurpose)
    .sort((a, b) => b[1] - a[1])
    .map(([purpose, count]) => `  ${purpose}: ${count} calls`)
    .join('\n');

  const agentLines = Object.entries(summary.callsByAgent)
    .sort((a, b) => b[1] - a[1])
    .map(([agent, count]) => `  ${agent}: ${count} calls`)
    .join('\n');

  return `═══ API BUDGET REPORT (Last 5hrs) ═══
EFFICIENCY: ${summary.efficiencyScore}%
Total Calls: ${summary.totalCalls} | Gemini: ${summary.geminiCalls} | Ollama: ${summary.ollamaCalls}
Productive: ${summary.productiveCalls} | Wasted: ${summary.wastedCalls} | 429 Errors: ${summary.failed429Count}

Calls by Purpose:
${purposeLines}

Calls by Agent:
${agentLines}

GOD-AGENT RECOMMENDATION: ${summary.topRecommendation}
═══════════════════════════════════════`;
}

/** Reset the budget ledger (for testing or manual clear) */
export function clearBudgetLedger(): void {
  localStorage.removeItem(STORAGE_KEY);
}
