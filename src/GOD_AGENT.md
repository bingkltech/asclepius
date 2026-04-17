# 🏛️ The God-Agent

> *"Absolute authority. Proactive self-healing. Recursive self-improvement."*

## Why The God-Agent Is Separate

The God-Agent is **not** an ordinary agent in the fleet. It exists on a fundamentally different plane:

| Property | God-Agent | Worker Agents |
|---|---|---|
| **Authority** | Absolute — overrides all others | Scoped to their role |
| **Model** | `gemini-3.1-pro-preview` (always the most powerful) | Varies (flash-lite, gemma4, etc.) |
| **Self-Healing** | ✅ Autonomous — auto-detects log errors and heals | ❌ Must be healed externally |
| **Self-Evolution** | ✅ Via `/evolve` protocol | ❌ Static capabilities |
| **Default Target** | All commands route to God-Agent by default | Must be explicitly targeted |
| **Quota Guardian** | ✅ Monitors and warns on API quota depletion | ❌ No quota awareness |
| **Emergency Powers** | Can force all agents to idle (EMERGENCY STOP) | No system-level control |
| **System Prompt** | "You have absolute authority and proactive self-healing capabilities" | Standard role-based prompts |

---

## Architecture

```
                    ┌───────────────────────┐
                    │      GOD-AGENT        │
                    │  ───────────────────  │
                    │  Lead Architect &     │
                    │  Expert Engineer      │
                    │                       │
                    │  Model: gemini-3.1-pro│
                    │  Health: 100%         │
                    │  Status: OVERSIGHT    │
                    └──────────┬────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
     ┌────────▼──────┐  ┌─────▼──────┐  ┌──────▼───────┐
     │  COO-Agent    │  │Jules-Bridge│  │ Healer-01    │
     │  Orchestrator │  │ Connector  │  │ Code Repair  │
     │  gemma4       │  │ flash-lite │  │ gemini-pro   │
     └───────────────┘  └────────────┘  └──────────────┘
```

The hierarchy is enforced by design:
- The God-Agent is hardcoded at index `0` in the `INITIAL_AGENTS` array with id `"god"`
- The Command Center defaults `targetAgentName` to `"God-Agent"` when no agent is explicitly specified
- The auto-heal system invokes **only** the God-Agent for error resolution

---

## Core Capabilities

```typescript
capabilities: [
  "Full-Stack Development",
  "UI/UX Design",
  "Code Generation",
  "System Architecture",
  "Proactive Self-Healing",     // ← Unique to God-Agent
  "Recursive Self-Improvement", // ← Unique to God-Agent
  "API Quota Management"        // ← Unique to God-Agent
]
```

### 1. Proactive Self-Healing

**Location:** `CommandCenter.tsx` → `handleAutoHeal()`

The God-Agent monitors the live system log stream. When any log entry contains the word "error" or "failed", the God-Agent **automatically wakes up**, analyzes the error, generates a root-cause analysis, and produces a fix — all without any human command.

```
Log Event (error detected)
    │
    ▼
MONITOR alert posted to Command Center
    │
    ▼
God-Agent receives error context
    │
    ▼
God-Agent generates HEAL_REPORT
    │
    ▼
Fix posted to Command Center with markdown formatting
```

The auto-heal loop is controlled by the `autoHeal` toggle in Settings. When enabled, a `useEffect` hook watches the `logs` array for any entry of type `'error'` or containing error keywords. A `lastProcessedLogId` ref ensures each log is only processed once.

### 2. Recursive Self-Evolution

**Location:** `CommandCenter.tsx` → `handleSelfEvolution()`

When a user types `/evolve`, the God-Agent enters a **self-improvement cycle**:

1. It analyzes its own current capabilities array
2. It reviews its own performance metrics (latency, memory)
3. It proposes a **new capability** to add to itself
4. It generates a "Level Up" report with metric optimizations

This is the only agent that can modify its own architecture description at runtime.

### 3. API Quota Management

**Location:** `CommandCenter.tsx` → `trackUsage()`, `checkQuota()`

The God-Agent acts as a guardian of system resources:

- Tracks daily API request count via `LLMUsageStats`
- At **90% quota usage**, posts a `[WARNING]` alert to the Command Center
- At **100% quota usage**, posts a `[CRITICAL]` alert and blocks further requests
- Resets the counter daily based on `lastResetDate`

### 4. Hibernation & Wake-Up Protocol (The Boot Sequence)

To conserve compute (and massive API costs) across the fleet, the God-Agent orchestrates a highly efficient, event-driven lifecycle:

**(1) System Initialization (Wake)**
- The system boots. The God-Agent is the first entity to come **Alive**.
- Executes a full Lookback: Sweeps all logs, agent metrics, skills, and pending task statuses.
- Assesses the central workload. 

**(2) Delegated Spawning**
- If there are active ops, the God-Agent wakes up (`/resume`) or spawns the **COO-Agent** and delegates execution oversight.

**(3) Tactical Hibernation (Sleep)**
- With the COO-Agent running routine orchestration, the God-Agent automatically puts *itself* into hibernation (`/pause`) to halt API polling.
- The God-Agent remains asleep for a maximum cycle length (e.g., up to 5 hours).

**(4) Interrupt Triggers (Emergency Wake)**
- The God-Agent remains dormant *unless* an interrupt occurs:
  1. **Error Detect:** The Auto-Heal monitor detects an error in the logs. The God-Agent instantly resumes, overriding the sleep state, to execute analysis and code repair.
  2. **Cycle Expiration:** The 5-hour timer expires, waking the God-Agent for a mandatory systemic health check and new Lookback cycle.

---

## Command Routing

All commands follow this routing logic:

```
User Input
    │
    ├── Starts with "God-Agent:" or "god:" → Routes to God-Agent
    ├── Starts with "COO-Agent:" or "coo:" → Routes to COO-Agent
    ├── Starts with "/analyze" or "/fix"   → Routes to Healer-01
    ├── Equals "/evolve"                   → Triggers God-Agent Self-Evolution
    └── No prefix                          → DEFAULT: Routes to God-Agent
```

The God-Agent is the **default recipient** of every command. This is intentional. The God-Agent is the primary interface between the human operator and the system.

---

## Jules Bridge Integration

```typescript
julesConfig: {
  enabled: true,
  endpoint: 'wss://jules.google.com/api/v1/sandbox/god',
  status: 'connected'
}
```

The God-Agent maintains a WebSocket connection to the Jules sandbox, allowing it to:
- Execute code in an isolated secure environment
- Validate fixes before deploying them
- Interface with the Google Jules platform for extended capabilities

---

## Configuration

The God-Agent's core identity is defined in `App.tsx` → `INITIAL_AGENTS[0]`:

```typescript
{
  id: "god",
  name: "God-Agent",
  role: "Lead Architect & Expert Engineer",
  status: "idle",
  lastAction: "System oversight active. Ready for high-level commands.",
  health: 100,
  capabilities: [...],
  metrics: { cpu: 2, memory: 4096, latency: 5 },
  provider: "gemini",
  model: "gemini-3.1-pro-preview",
  julesConfig: { ... }
}
```

> **Design Principle:** The God-Agent always uses the most powerful model available (`gemini-3.1-pro-preview`), always starts at 100% health, and always has the lowest baseline metrics (CPU: 2%, Latency: 5ms) to signify its efficiency as the supreme intelligence.

---

## Related Documentation

- [Agent Fleet](components/AGENTS.md) — The worker agents that operate under the God-Agent
- [Command Center](components/COMMAND_CENTER.md) — The interface through which the God-Agent communicates
- [AI Services](services/SERVICES.md) — The LLM layer that powers the God-Agent's brain
- [Execution Strategy](../docs/STRATEGY.md) — The Lookback-Forward methodology the God-Agent follows
