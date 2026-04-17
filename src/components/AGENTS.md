# 🤖 Agent Fleet

> *The autonomous workforce operating under the God-Agent's directive.*

## Agent Hierarchy

Asclepius operates a **strict hierarchical command structure**. The God-Agent sits at the apex; all other agents are worker-class entities with scoped roles and limited authority.

```
                    GOD-AGENT (Apex)
                    ┌───────────┐
                    │ Absolute  │
                    │ Authority │
                    └─────┬─────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
    COO-Agent       Jules-Bridge      Healer-01
    Operations      Integration       Repair
    Layer           Layer             Layer
```

> ⚠️ **The God-Agent is documented separately.** See [`GOD_AGENT.md`](../GOD_AGENT.md) for its complete architecture. This document covers the **worker agents only**.

---

## Worker Agent Registry

### COO-Agent — Chief Operating Officer

| Property | Value |
|---|---|
| **ID** | `coo` |
| **Role** | Chief Operating Officer |
| **Model** | `gemma4` (Ollama local) |
| **Provider** | Ollama |
| **Purpose** | Orchestrating agent workflows, task scheduling, resource management |

**Capabilities:**
- Orchestration
- Task Scheduling
- Resource Management
- System Analysis

**Design Rationale:** The COO runs on a local Ollama model intentionally. It handles high-frequency orchestration tasks that don't require the raw power of Gemini Pro, keeping API costs low and latency minimal.

---

### Jules-Bridge — Platform Connector

| Property | Value |
|---|---|
| **ID** | `a2` |
| **Role** | Platform Connector |
| **Model** | `gemini-3.1-flash-lite-preview` |
| **Provider** | Gemini |
| **Purpose** | Syncing with the Jules sandbox, API integration, maintaining sandbox sessions |

**Capabilities:**
- API Integration
- Sandbox Management

**Design Rationale:** Jules-Bridge uses Flash Lite for fast, lightweight API calls to the Jules platform. It acts as the bridge between Asclepius and external Google services. Its status often shows `syncing` because it maintains a continuous WebSocket connection.

---

### Healer-01 — Code Repair Specialist

| Property | Value |
|---|---|
| **ID** | `a3` |
| **Role** | Code Repair Specialist |
| **Model** | `gemini-3.1-pro-preview` |
| **Provider** | Gemini |
| **Purpose** | Analyzing code for bugs, suggesting improvements, refactoring, and deep analysis |

**Capabilities:**
- Code Analysis
- Refactoring
- Bug Detection

**Design Rationale:** Healer-01 uses the same powerful Pro model as the God-Agent because code analysis requires deep reasoning. It is the **only** agent that can be targeted directly via the `/analyze` and `/fix` commands. When Healer-01 is invoked, it returns structured JSON analysis results (bugs, suggestions, explanation, refactored code).

---

## The Agent Type System

All agents share the same TypeScript interface, defined in `types.ts`:

```typescript
interface Agent {
  id: string;                    // Unique identifier
  name: string;                  // Display name
  role: string;                  // Job description
  status: AgentStatus;           // idle | working | healing | learning | error
  lastAction: string;            // Most recent action description
  health: number;                // 0-100 percentage
  capabilities: string[];        // List of capabilities
  metrics: AgentMetrics;         // { cpu, memory, latency }
  provider?: LLMProvider;        // 'gemini' | 'ollama'
  model?: string;                // Model identifier
  julesConfig?: JulesConfig;     // Jules sandbox connection
}
```

### Agent Statuses

| Status | Icon | Color | Meaning |
|---|---|---|---|
| `idle` | Activity | Muted | Agent is standby, waiting for commands |
| `working` | Zap (pulsing) | Yellow | Actively executing a task |
| `healing` | ShieldAlert (bouncing) | Red | Performing self-repair |
| `learning` | Brain | Blue | Analyzing patterns, training |
| `error` | ShieldAlert | Destructive | Critical failure state |

---

## The AgentCard Component

**File:** `AgentCard.tsx`

Each agent is rendered through the `AgentCard` component, which provides:

### Visual Display
- Name, role, and status badge
- Health bar with animated fill (via Motion)
- Real-time CPU, Memory, and Latency metrics
- AI engine badge (Gemini/Ollama + model name)
- Jules Bridge connection indicator with animated ping dot
- Capability badges

### Agent Configuration Dialog
Hover over any agent card to reveal:
- **⚙️ Settings** — Edit capabilities, AI provider, and model
- **📜 History** — Review all commands and responses specific to this agent, with search

### History System
The history dialog filters `ChatMessage[]` by `targetAgentId`, showing:
- User commands directed at this agent
- Agent responses with full markdown rendering
- Searchable via text filter
- Chronological ordering

---

## Agent Simulation Loop

**File:** `App.tsx` → `useEffect` (lines 216-262)

Agents don't just sit idle. An 8-second heartbeat cycle simulates continuous activity:

```
Every 8 seconds:
    1. Pick a random agent
    2. Assign a random status (idle, working, learning)
    3. Generate an action description via Gemini Flash Lite
    4. Log the action to the system-wide log stream
    5. Fluctuate CPU/Memory/Latency metrics (±random delta)
    6. 10% chance: display a toast notification
```

This creates a living, breathing agent ecosystem where the dashboard always shows movement and activity.

---

## Adding New Agents

To add a new agent to the fleet:

1. Add a new entry to `INITIAL_AGENTS` in `App.tsx`:

```typescript
{
  id: "your-agent-id",
  name: "Agent-Name",
  role: "Specialized Role Description",
  status: "idle",
  lastAction: "Initializing...",
  health: 100,
  capabilities: ["Capability 1", "Capability 2"],
  metrics: { cpu: 5, memory: 1024, latency: 20 },
  provider: "gemini",        // or "ollama"
  model: "gemini-3.1-pro-preview",
  julesConfig: {
    enabled: true,
    endpoint: 'wss://jules.google.com/api/v1/sandbox/your-agent',
    status: 'connected'
  }
}
```

2. The agent will automatically appear in:
   - Dashboard → Managed Agents grid
   - Agents tab → Agent Fleet grid
   - Command Center → Targetable via `Agent-Name: [command]`
   - Task Scheduler → Available for scheduling

---

## Related Documentation

- [God-Agent](../GOD_AGENT.md) — The supreme agent that sits above this fleet
- [Command Center](COMMAND_CENTER.md) — How agents receive and respond to commands
- [AI Services](../services/SERVICES.md) — The LLM backends that power agent intelligence
