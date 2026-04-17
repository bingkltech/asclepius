# 🤖 Agent Fleet — Context Document

> **PURPOSE:** This file is the single-source-of-truth for the Asclepius Agent Fleet architecture. It provides the fleet overview, the shared type system, lifecycle mechanics, and links to individual agent context documents. Any AI model reading this file gains complete fleet awareness.

---

## Fleet Hierarchy

```
                    GOD-AGENT (Apex) 👑
                    ┌───────────┐
                    │ Absolute  │
                    │ Authority │
                    │ gemini-pro│
                    └─────┬─────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
    COO-Agent       Jules-Bridge      Healer-01
    Operations      Integration       Repair
    gemma4 (local)  flash-lite        gemini-pro
    🛡️ Protected     Terminable        Terminable
```

> ⚠️ **Each agent has its own detailed context document.** This file covers fleet-level architecture only.

---

## Agent Registry (Quick Reference)

| Agent | ID | Model | Provider | Budget | Protected | Context Doc |
|---|---|---|---|---|---|---|
| **God-Agent** | `god` | `gemini-3.1-pro-preview` | Gemini (→Ollama) | 500K/day | ✅ | [GOD_AGENT.md](../GOD_AGENT.md) |
| **COO-Agent** | `coo` | `gemma4` | Ollama | 200K/day | ✅ | [COO_AGENT.md](COO_AGENT.md) |
| **Jules-Bridge** | `a2` | `gemini-3.1-flash-lite-preview` | Gemini | 100K/day | ❌ | [JULES_BRIDGE.md](JULES_BRIDGE.md) |
| **Healer-01** | `a3` | `gemini-3.1-pro-preview` | Gemini | 200K/day | ❌ | [HEALER_AGENT.md](HEALER_AGENT.md) |

> **Dynamically spawned agents** (via God-Agent's `SPAWN_AGENT` action) do not have pre-written context docs. Their identity is defined at spawn time.

---

## The Agent Type System

All agents share the same TypeScript interface, defined in `src/types.ts`:

```typescript
interface Agent {
  id: string;                    // Unique identifier ("god", "coo", "a2", "a3")
  name: string;                  // Display name
  role: string;                  // Job description
  status: AgentStatus;           // idle | working | healing | learning | error | paused
  lastAction: string;            // Most recent action description
  health: number;                // 0-100 percentage
  capabilities: string[];        // Broad categories
  skills: AgentSkill[];          // Granular leveled competencies (1-5)
  heartbeat: AgentHeartbeat;     // Liveness monitoring (interval, missed beats, sparkline)
  budget: AgentBudget;           // { dailyTokenLimit, dailyTokensUsed, priority, overage }
  reputation: AgentReputation;   // { successRate, totalTasks, failedTasks, trend }
  metrics: AgentMetrics;         // { cpu, memory, latency }
  provider?: LLMProvider;        // 'gemini' | 'ollama'
  model?: string;                // Model identifier string
  julesConfig?: JulesConfig;     // Jules sandbox WebSocket connection
  createdBy: 'system' | 'god';  // Who spawned this agent
  isProtected: boolean;          // Cannot be terminated
  delegations?: Delegation[];    // Delegated authority from God-Agent
}
```

---

## Agent Statuses

| Status | Meaning | Visual |
|---|---|---|
| `idle` | Standby, waiting for commands | Muted icon |
| `working` | Actively executing a task | Yellow pulse |
| `healing` | Performing self-repair | Red bounce |
| `learning` | Analyzing patterns, training | Blue glow |
| `error` | Critical failure state | Red alert |
| `paused` | Tactical hibernation (alive but dormant) | Amber dim |

---

## Heartbeat System

Every agent emits periodic liveness signals:

| Agent | Interval | Max Missed | Reason |
|---|---|---|---|
| God-Agent | 5s | 5 | Critical — faster pulse, higher tolerance |
| All Workers | 10s | 3 | Standard monitoring |

**Degradation cascade:** Alive → Degraded (1 miss) → Unresponsive (2+ miss) → Dead (max miss exceeded)

---

## Skills System

Skills are leveled competencies (1-5):

| Level | Name | XP to Next |
|---|---|---|
| 1 | Novice | 100 XP |
| 2 | Apprentice | 300 XP |
| 3 | Competent | 600 XP |
| 4 | Expert | 1000 XP |
| 5 | Master | MAX |

**Skill Categories:** `engineering` (violet), `analysis` (sky), `operations` (amber), `security` (rose), `creative` (emerald), `meta` (gold, God-Agent only)

---

## Token Budget System

Each agent has a daily token budget that controls workload distribution:

```typescript
interface AgentBudget {
  dailyTokenLimit: number;    // Max tokens per day
  dailyTokensUsed: number;   // Current usage
  priority: 'critical' | 'high' | 'normal' | 'low';
  overage: 'block' | 'warn' | 'allow';
}
```

The Sandbox's `findBestAgent()` applies:
- **Hard Block:** Agents at 100% utilization with `overage: "block"` are skipped entirely.
- **Soft Penalty:** Agents approaching limits receive up to 50% score reduction.

---

## Spawning New Agents

### Via God-Agent JSON Action (Autonomous)
```json
{ "type": "SPAWN_AGENT", "payload": { "name": "Data-Miner", "role": "Data Collection", "skills": ["Web Scraping", "Python"] } }
```

### Via Code (`App.tsx → INITIAL_AGENTS`)
Add a new entry to the array. The agent auto-appears in Dashboard, Agents tab, Command Center, and Task Scheduler.

---

## Persistence

- All agent state persists in `localStorage` under key `asclepius_agents`.
- On page reload, the system loads from localStorage first, falling back to `INITIAL_AGENTS`.
- This means skill grants, status changes, and spawned agents survive browser restarts.

---

## File References

| File | What It Contains |
|---|---|
| `src/App.tsx` | `INITIAL_AGENTS[]` array, `createSkill()`, `createHeartbeat()` |
| `src/types.ts` | All agent-related interfaces |
| `src/components/AgentCard.tsx` | Agent card UI, health bars, sparklines, skill badges |
| `src/components/AgentConfig.tsx` | Agent configuration dialog (edit capabilities, model, provider) |
| `src/components/CommandCenter.tsx` | Agent routing, system context injection, JSON action parsing |
| `src/components/Sandbox.tsx` | `findBestAgent()` — skill-based error-to-agent routing |
| `src/components/TaskScheduler.tsx` | Agent task assignment and scheduling |

---

## Per-Agent Context Documents

For detailed context on each agent (designed to be fed directly to an AI model):

- [GOD_AGENT.md](../GOD_AGENT.md) — God-Agent: Apex authority, self-healing, dual-core routing
- [COO_AGENT.md](COO_AGENT.md) — COO-Agent: Operations, delegation, task decomposition
- [HEALER_AGENT.md](HEALER_AGENT.md) — Healer-01: Code analysis, repair, Sandbox integration
- [JULES_BRIDGE.md](JULES_BRIDGE.md) — Jules-Bridge: WebSocket sync, platform connector
