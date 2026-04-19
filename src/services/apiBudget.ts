/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * API Budget Ledger — Tracks every LLM call with metadata.
 * The God-Agent uses this data during reviews to provide hindsight
 * on API efficiency and recommend optimizations.
 */

// ─── Types moved to types.ts ───
import { APICallRecord, CallPurpose, CallOutcome, BudgetSummary } from '../types';

// ─── Storage (Migrated to Dexie) ───
import { db } from './neuralVault';

const MAX_RECORDS = 500; // Keep more records since Dexie handles it better

// ─── Public API ───

/** Record a single API call (fire-and-forget to avoid blocking) */
export function recordAPICall(call: Omit<APICallRecord, 'id' | 'timestamp'>): void {
  const record: APICallRecord = {
    ...call,
    id: `api-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
  };

  db.apiLedger.add(record).catch(err => console.error('[API Ledger] Failed to save record:', err));
  
  // Auto-prune periodically (fire-and-forget)
  pruneAPIRecords();
}

/** Keep DB size manageable */
async function pruneAPIRecords() {
  try {
    const count = await db.apiLedger.count();
    if (count > MAX_RECORDS) {
      const oldest = await db.apiLedger.orderBy('timestamp').limit(count - MAX_RECORDS).toArray();
      const idsToDelete = oldest.map(r => r.id);
      await db.apiLedger.bulkDelete(idsToDelete);
    }
  } catch (err) {
    // ignore
  }
}

/** Get all records (optionally filtered by time range) */
export async function getAPIRecords(sinceHoursAgo?: number): Promise<APICallRecord[]> {
  if (!sinceHoursAgo) return db.apiLedger.toArray();

  const cutoff = new Date(Date.now() - (sinceHoursAgo * 3600000)).toISOString();
  return db.apiLedger.where('timestamp').aboveOrEqual(cutoff).toArray();
}

/** Generate a budget summary for the God-Agent's review */
export async function generateBudgetSummary(sinceHoursAgo: number = 5): Promise<BudgetSummary> {
  const records = await getAPIRecords(sinceHoursAgo);
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

  // Key source breakdown
  const personalKeyCalls = records.filter(r => r.keySource === 'personal' && r.provider === 'gemini').length;
  const globalKeyCalls = records.filter(r => r.keySource === 'global' && r.provider === 'gemini').length;

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
export async function formatBudgetReportForAgent(): Promise<string> {
  const summary = await generateBudgetSummary(5); // Last 5 hours (one Gemini refresh cycle)
  const records = await getAPIRecords(5); // Get raw records for key source breakdown

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

  const globalKeyCount = records.filter(r => r.keySource === 'global' && r.provider === 'gemini').length;
  const personalKeyCount = records.filter(r => r.keySource === 'personal' && r.provider === 'gemini').length;

  return `═══ API BUDGET REPORT (Last 5hrs) ═══
EFFICIENCY: ${summary.efficiencyScore}%
Total Calls: ${summary.totalCalls} | Gemini: ${summary.geminiCalls} | Ollama: ${summary.ollamaCalls}
Productive: ${summary.productiveCalls} | Wasted: ${summary.wastedCalls} | 429 Errors: ${summary.failed429Count}

API Key Usage (Gemini only):
  Company Card (Global): ${globalKeyCount} calls
  Personal Agent Keys: ${personalKeyCount} calls

Calls by Purpose:
${purposeLines}

Calls by Agent:
${agentLines}

GOD-AGENT RECOMMENDATION: ${summary.topRecommendation}
═══════════════════════════════════════`;
}

/** Reset the budget ledger (for testing or manual clear) */
export async function clearBudgetLedger(): Promise<void> {
  await db.apiLedger.clear();
}
