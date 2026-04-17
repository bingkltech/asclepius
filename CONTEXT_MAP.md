# ⚕️ Asclepius — Living Context Map & System Architecture

> **VERSION:** v2.8 · **LAST AUDIT:** 2026-04-17  
> **PURPOSE:** This document is the Amnesia Guard. Any AI model reading this file gains total system awareness without hallucination risk. Every claim is traced to an exact file and line range.

---

## 1. CORE PHILOSOPHY — How The Agents Actually Interact

### The Three-Body Orchestration

Asclepius is not a chatbot with multiple personas. It is a **hierarchical autonomous workforce** where each agent has distinct authority, distinct credentials, and distinct cognitive models.

```
   ┌─────────────────────────────────────────────────────────────┐
   │                    HUMAN OPERATOR                           │
   │              (Types into Command Center)                    │
   └─────────────────────────┬───────────────────────────────────┘
                             │
                             ▼
   ┌─────────────────────────────────────────────────────────────┐
   │                    GOD-AGENT 👑                              │
   │  ─ Default recipient of ALL commands (no prefix needed)     │
   │  ─ Gemini 3.1 Pro brain (hardcoded override)                │
   │  ─ Fallback: Ollama gemma4:e4b                              │
   │  ─ ONLY agent that can: /spawn, /terminate, /evolve         │
   │  ─ ONLY agent that auto-heals on log errors                 │
   │  ─ Enters Tactical Hibernation after delegation             │
   │  ─ Wakes on: error interrupt OR 5-hour timer                │
   └─────────┬───────────────┬───────────────┬───────────────────┘
             │               │               │
    ┌────────▼──────┐ ┌──────▼──────┐ ┌──────▼───────┐
    │  COO-Agent    │ │Jules-Bridge │ │  Healer-01   │
    │  ─────────    │ │ ──────────  │ │  ──────────  │
    │  gemma4 local │ │ flash-lite  │ │ gemini-pro   │
    │  "Always On"  │ │ "Always     │ │ "On Demand"  │
    │  orchestrator │ │  Syncing"   │ │ code repair  │
    └───────────────┘ └─────────────┘ └──────────────┘
```

### Communication Flow (Exactly How State Passes)

**Step 1: User types message → CommandCenter.tsx:handleSendMessage() (line ~600)**  
**Step 2: Agent prefix detection → fuzzy match against `agents[].name`**  
**Step 3: Context construction → builds `systemContext` string (line ~635-700)**  
This context includes:
- All agents with skills, status, health, budgets (the "Hive-Mind Window")
- All active projects with milestones and progress
- Last 5 sandbox test runs with critical/warning counts
- Last 15 system log entries
- Recent multi-agent chat transcript (so agents "hear" each other)

**Step 4: Per-agent credential resolution → `resolveAgentSettings()` in llm.ts**  
**Step 5: LLM call → `getUnifiedChatResponse()` with failover cascade**  
**Step 6: JSON action interception → regex parse `json:action` blocks**  
**Step 7: Execute side effects → spawn agents, schedule tasks, update goals**  

### The Jules-Bridge State Protocol

Jules-Bridge does **not** relay state between agents. It maintains a persistent WebSocket to the Jules sandbox platform (`wss://jules.google.com/api/v1/sandbox/bridge`). State between agents is passed exclusively through:

1. **The System Context String** — injected into every LLM call (agents read each other's recent output)
2. **The Chat Transcript** — shared message stream all agents can see
3. **localStorage** — all state persists under `asclepius_*` keys

> **INVARIANT:** Jules-Bridge is a platform connector, NOT a message bus. Agent-to-agent communication happens through the shared context window, not through Jules.

---

## 2. SYSTEM HEALTH — What The Metrics Actually Represent

### Agent Health (The `health: number` field)

**Source of Truth:** `App.tsx → INITIAL_AGENTS[].health`

The `health` field is a **static initialization value** set to 100 at boot. It is **not dynamically updated** by any running system process. The only way `health` changes is:
- Manual edit via AgentConfig
- Future: could be derived from heartbeat uptime + reputation

> **⚠️ CONTEXT LEAK IDENTIFIED:** `agent.health` is displayed on cards but never computed from live data. It should be derived from `heartbeat.uptimePercent` and `reputation.successRate` for accuracy.

### The 99% Health Metric (Dashboard Card)

**Source of Truth:** `App.tsx` lines 892-893

```typescript
const avgHealth = Math.round(
  agents.reduce((sum, a) => sum + a.health, 0) / agents.length
);
```

This is a simple average of all agents' `health` field. Since all agents initialize at `health: 100` and the field is never dynamically reduced, the dashboard will always show ~100% unless manually altered.

### CPU / Memory / Latency Metrics

**Source of Truth:** `App.tsx` lines 855-878 (the 8-second simulation loop)

These are **simulated fluctuations**, not real system metrics:

```typescript
const newCpu = Math.max(1, Math.min(100, a.metrics.cpu + (Math.random() * 10 - 5)));
const newMem = Math.max(100, Math.min(4096, a.metrics.memory + (Math.random() * 50 - 25)));
const newLat = Math.max(5, Math.min(500, a.metrics.latency + (Math.random() * 20 - 10)));
```

**Bounds:**
- CPU: 1-100% (random walk, ±5 per tick)
- Memory: 100-4096 MB (random walk, ±25 per tick)
- Latency: 5-500 ms (random walk, ±10 per tick)

> **INVARIANT:** God-Agent initializes with `cpu: 2, memory: 4096, latency: 5` — the lowest CPU and latency to signify supreme efficiency. This baseline must be preserved.

### Heartbeat System (The Only Real Health Signal)

**Source of Truth:** `App.tsx` lines 428-514 (3-second global tick)

This is **actually live**. Every 3 seconds:
1. Each non-paused agent gets a simulated heartbeat response
2. 98% chance: healthy beat (randomized response time)
3. 2% chance: missed beat
4. Missed beats cascade: alive → degraded (1) → unresponsive (2+) → dead (maxMissed)
5. History kept as last 20 entries for sparkline visualization
6. Uptime = `(healthyBeats / totalBeats) * 100`

**Response time baselines:**
- God-Agent: 8ms base + 0-15ms jitter
- COO-Agent: 25ms base + 0-15ms jitter
- Others: 15-55ms base + 0-15ms jitter

---

## 3. RECURSIVE CONTEXT MAP — The Amnesia Guard

### 3.1 Command Center (`CommandCenter.tsx` — 58KB, 1173 lines)

**The 'What':** Military-grade terminal UI where humans talk to agents. Contains the routing engine, auto-heal pipeline, JSON action parser, and quota management.

**The 'How':**
- **Routing:** Line ~600 — prefix match (`god:`, `coo:`, `healer:`) or default to God-Agent
- **Auto-Heal:** Lines 153-163 — `useEffect` watches `logs[]` for `type: 'error'` or text containing "error"/"failed"
- **Deduplication:** `lastProcessedLogId` ref prevents re-processing the same log
- **JSON Actions:** Line ~745 — regex `json:action\n([\s\S]*?)` extracts structured commands
- **Context Window:** Lines 635-700 — constructs the full system snapshot injected as `systemContext`
- **Quota:** Lines 101-147 — `trackUsage()` increments daily counter, warns at 90%, blocks at 100%

**State Variables:**
| Variable | Type | Purpose |
|---|---|---|
| `input` | string | Current user input |
| `isLoading` | boolean | LLM request in-flight |
| `defaultOllamaModel` | string | First model from Ollama /api/tags |
| `ollamaModels` | OllamaModel[] | Available local models |
| `lastProcessedLogId` | ref(string) | Auto-heal dedup guard |
| `connectionStatus` | object | Last connection test result |

**Never-Forget Invariants:**
1. `targetAgent` defaults to God-Agent when no prefix is detected
2. The `systemContext` string MUST include fleet status, projects, sandbox, logs, and chat transcript — removing ANY section breaks the Lookback protocol
3. `lastProcessedLogId` MUST be a ref, not state — using state causes infinite re-render loops
4. The JSON action regex MUST use `json:action` (not `json` alone) to prevent false positives on normal code blocks
5. Per-agent credential resolution via `resolveAgentSettings()` MUST happen before the God-Agent override

### 3.2 Sandbox (`Sandbox.tsx` — 32KB, 671 lines)

**The 'What':** Code analysis workbench with project scoping, structured error parsing, skill-based agent routing, and Manual Routing Override modal.

**The 'How':**
- **Error Parsing:** Lines 84-123 — regex extracts `line N`, `column N`, `filePath` from AI analysis text
- **Severity Classification:** Line 95 — "security"/"vulnerab" keywords → `critical`, else → `warning`
- **Agent Routing:** `findBestAgent()` scores agents by skill match (security→security, bugs→analysis, performance→analysis)
- **Manual Override:** `showRoutingModal` state gates a Dialog where the user can reassign agents before dispatch
- **Event Feed:** Lines 177-188 — posts [CRITICAL]/[WARNING]/[PASS] events to Command Center

**Never-Forget Invariants:**
1. Error IDs are prefixed with `err-` (bugs) or `info-` (suggestions) — other code depends on this format
2. Sandbox runs are capped at 50 in localStorage to prevent quota overflow
3. The `onPostSystemMessage` callback is the ONLY bridge between Sandbox and Command Center
4. `findBestAgent()` MUST exclude God-Agent unless no other agent scores > 0

### 3.3 Heartbeat Monitor (`App.tsx` lines 425-519)

**The 'What':** Global 3-second tick that simulates liveness signals for all active agents.

**The 'How':**
- Single `setInterval(fn, 3000)` in a `useEffect` with empty deps
- Skips agents where `status === "paused"`
- History capped at 20 entries (`.slice(-20)`)
- Uptime calculated from rolling window, not lifetime

**Never-Forget Invariants:**
1. The global tick is 3 seconds — this is independent of individual agent heartbeat `interval` settings
2. The 2% miss chance is hardcoded (`Math.random() > 0.02`)
3. Paused agents MUST be skipped entirely — not given missed beats
4. God-Agent's base response time (8ms) MUST remain lowest in the fleet

### 3.4 LLM Service (`llm.ts` — 288 lines)

**The 'What':** Dual-core routing engine: Gemini (cloud) with automatic failover to Ollama (local).

**The 'How':**
- `resolveAgentSettings()` — merges per-agent credentials with global settings
- `isFailoverCondition()` — detects 429, 401, timeout, network errors
- `setRateLimit()` — exponential backoff (1m → 2m → 4m → 5m cap)
- `getGeminiRefreshInfo()` — returns human-readable countdown
- Rate limit state persisted in localStorage under `asclepius_gemini_rate_limit`

**Never-Forget Invariants:**
1. `resolveAgentSettings()` priority: Agent credentials → Agent model → Global settings — NEVER reverse this
2. `isFailoverCondition()` MUST check for "RESOURCE_EXHAUSTED" (Gemini's actual error string)
3. Max cooldown is 5 minutes (not higher) — this is the recovery heartbeat
4. Ollama `num_ctx` is set to 128000 — reducing this breaks long-context agent interactions

---

## 4. CODE STRUCTURAL AUDIT

### Context Leaks Identified

| # | Leak | Location | Status |
|---|---|---|---|
| 1 | **`agent.health` was never computed** | `App.tsx` stat cards | ✅ **FIXED** — now `60% heartbeat.uptimePercent + 40% reputation.successRate` |
| 2 | **Metrics are random walks, not real** | `App.tsx` lines 855-878 | 📋 By design (simulation mode) |
| 3 | **`createSkill()` duplicated** | `App.tsx` AND `CommandCenter.tsx` | ✅ **FIXED** — consolidated to `types.ts`, both files import |
| 4 | **Auto-heal didn't use per-agent creds** | `CommandCenter.tsx` handleAutoHeal | ✅ **FIXED** — now resolves God-Agent's credentials via `resolveAgentSettings()` |
| 5 | **`AI-Studio-Agent` dead code** | `llm.ts` getUnifiedChatResponse | ✅ **FIXED** — removed (agent never existed in INITIAL_AGENTS) |
| 6 | **Sandbox didn't use per-agent creds** | `Sandbox.tsx` handleAnalyze | ✅ **FIXED** — now resolves Healer-01's credentials for analysis |

### Proposed Fix for Leak #3: `createSkill()` Consolidation

Move `createSkill()` to `types.ts` and import in both files:

```typescript
// types.ts — add:
export function createSkill(
  name: string,
  category: AgentSkill["category"],
  level: number,
  description: string,
  xp = 0
): AgentSkill {
  return {
    id: `skill-${name.toLowerCase().replace(/\s+/g, "-")}-${Math.random().toString(36).slice(2, 6)}`,
    name, category,
    level: Math.min(5, Math.max(1, level)),
    xp, xpToNext: SKILL_XP_TABLE[Math.min(5, Math.max(1, level))] || 0,
    description, acquiredAt: new Date().toISOString(),
    usageCount: 0, cooldown: 0,
  };
}
```

### Strict Schema: Registering New Agent Skills

When adding skills (via spawn, grant, or config), the following schema MUST be enforced:

```typescript
// REQUIRED fields:
{
  id: string,          // Format: "skill-{kebab-name}-{4-char-random}"
  name: string,        // Human-readable, Title Case
  category: SkillCategory, // MUST be one of: engineering|analysis|operations|security|creative|meta
  level: number,       // MUST be 1-5 (clamped)
  xp: number,          // MUST start at 0 for new skills
  xpToNext: number,    // MUST equal SKILL_XP_TABLE[level]
  description: string, // Non-empty
  acquiredAt: string,  // ISO 8601 timestamp
  usageCount: 0,       // MUST start at 0
  cooldown: 0,         // MUST start at 0
}
```

**Metric Impact Rule:** Skills do NOT directly affect CPU/MEM/Latency metrics. Metrics are simulation-driven. However, `findBestAgent()` in Sandbox.tsx uses skill categories and levels for routing scores — so incorrect skill registration will route errors to wrong agents.

---

## 5. SCALING STRATEGY

### Context Window Management

**Current state:** The system context string injected per-LLM-call includes:
- All agents (verbose for ≤6, compressed for 7+)
- All active projects (unbounded)
- Last 5 sandbox runs
- Last 10 log entries (relevance-filtered)
- Recent chat transcript (last 15 messages, truncated to 300 chars each)

**Problem:** As the fleet grows to 10+ agents and 5+ projects, the context string will exceed 8KB — consuming significant portions of the model's context window and degrading response quality.

### Context Pruning Protocol

#### Tier 1: Automatic Caps (Implemented)
| Data | Cap | Location |
|---|---|---|
| System logs | 50 entries in memory, 10 relevance-filtered | `App.tsx` line 316, `CommandCenter.tsx` |
| Chat messages | 100 in localStorage, 15 injected (300 char cap) | `App.tsx` line 317 |
| Sandbox runs | 50 in localStorage, 5 injected | `App.tsx` line 338, `CommandCenter.tsx` |

#### Tier 2: Agent Context Compression (✅ Implemented)

When fleet exceeds 6 agents, automatic compression activates:
```
// VERBOSE (≤6 agents):
"- **God-Agent** (Lead Architect): Status: paused, Heartbeat: alive.
   Skills: System Architecture(L5), Self-Healing(L5)..."

// COMPRESSED (7+ agents):
"- God-Agent [paused] 8 skills (max L5) 🛡️"
```

#### Tier 3: Log Relevance Filtering (✅ Implemented)

Instead of injecting the last 15 logs blindly:
1. ✅ Always include the 5 most recent logs
2. ✅ Always include logs with `type: 'error'` (up to 4)
3. ✅ Deprioritize repetitive `[SCHEDULED]` task logs
4. ✅ Cap at 10 entries total (reduced from 15)

#### Tier 4: Project Context Scoping (Recommended)

When the user is working in a specific project context (e.g., via Sandbox project selector):
1. Inject FULL context for the active project only
2. Inject ONE-LINE summaries for other projects
3. Omit milestone details for inactive projects

---

## 6. PERSISTENCE MAP

Every piece of state and its localStorage key:

| Key | Data | Cap | Written By |
|---|---|---|---|
| `asclepius_agents` | Agent[] (full fleet) | Unlimited | `App.tsx` useEffect |
| `asclepius_agent_order` | string[] (display order) | Unlimited | `App.tsx` useEffect |
| `asclepius_logs` | LogEntry[] | 100 entries | `App.tsx` useEffect |
| `asclepius_messages` | ChatMessage[] | 100 messages | `App.tsx` useEffect |
| `asclepius_tasks` | ScheduledTask[] | Unlimited | `App.tsx` useEffect |
| `asclepius_projects` | Project[] | Unlimited | `App.tsx` useEffect |
| `asclepius_sandbox_runs` | SandboxRun[] | 50 runs | `App.tsx` useEffect |
| `antigravity_llm_settings` | LLMSettings | Single object | `App.tsx` useEffect |
| `asclepius_gemini_rate_limit` | RateLimitState | Single object | `llm.ts` setRateLimit() |

> **INVARIANT:** All `asclepius_*` keys are owned by `App.tsx` persistence effects. The `antigravity_llm_settings` key name is a legacy from the original project name and MUST NOT be renamed (would orphan existing user data).

---

## 7. TIMER & INTERVAL REGISTRY

Every active timer in the system:

| Timer | Interval | Location | Purpose |
|---|---|---|---|
| Heartbeat Engine | 3,000ms | `App.tsx` line 429 | Global liveness tick for all agents |
| Agent Simulation | 8,000ms | `App.tsx` line 825 | Random agent activity + metric fluctuation |
| Task Scheduler | 5,000ms | `App.tsx` line 594 | Check and execute scheduled tasks |
| Boot Sequence | 2,000ms (once) | `App.tsx` line 343 | God-Agent initial Lookback sweep |
| Hibernation | 4,000ms (once) | `App.tsx` line 356 | God-Agent enters Tactical Hibernation |
| 5-Hour Audit | 18,000,000ms | `App.tsx` line 384 | Mandatory wake cycle |

> **INVARIANT:** The heartbeat tick (3s) MUST be faster than the agent simulation tick (8s). If reversed, heartbeat status would lag behind visible agent activity.

---

## 8. FILE INDEX WITH COMPLEXITY RATING

| File | Lines | KB | Risk | Primary Responsibility |
|---|---|---|---|---|
| `App.tsx` | 1434 | 56 | 🔴 | ALL state, INITIAL_AGENTS, persistence, heartbeat, simulation, lifecycle commands |
| `CommandCenter.tsx` | 1173 | 58 | 🔴 | Chat UI, routing, auto-heal, JSON actions, system context, quota |
| `AgentConfig.tsx` | 1268 | 51 | 🟡 | Agent edit dialog (7 tabs: general, engine, heartbeat, skills, budget, tools, credentials) |
| `ProjectsPage.tsx` | ~680 | 35 | 🟡 | Project CRUD, milestones, GitHub sync, health cards |
| `Sandbox.tsx` | 671 | 32 | 🟡 | Code analysis, error parsing, agent routing, Manual Override |
| `AgentCard.tsx` | ~700 | 28 | 🟡 | Agent card UI, sparklines, health bars, skill badges |
| `Settings.tsx` | ~500 | 20 | 🟢 | Global LLM settings, API key input |
| `TaskScheduler.tsx` | ~350 | 13 | 🟢 | Task list UI, add/edit/delete |
| `llm.ts` | 288 | 11 | 🟡 | Dual-core routing, failover, rate limiting, credential resolution |
| `types.ts` | 280 | 7 | 🟢 | ALL interfaces (but every file depends on this) |
| `gemini.ts` | 99 | 4 | 🟢 | Gemini API wrapper |
| `ollama.ts` | 75 | 2 | 🟢 | Ollama API wrapper |
