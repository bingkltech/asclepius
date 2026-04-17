# ⚕️ Asclepius — Autonomous AI Agent Orchestrator

> *An autonomous AI agent workforce where a supreme God-Agent commands, spawns, heals, and evolves an entire fleet of specialized workers — each with their own Google identity, API quota, and cognitive model.*

**Version:** v2.8 · **Architecture:** Hierarchical Autonomous Workforce · **Last Audit:** 2026-04-17

---

## 🧬 Core Philosophy — How Agents Interact

Asclepius is not a chatbot with multiple personas. It is a **hierarchical workforce** where each agent:
- Has its own **Gmail account** and **Gemini API key** (individual free-tier quota)
- Runs its own **cognitive model** (Pro for architects, Flash for connectors, local Gemma for ops)
- Cannot be confused with another agent — each has distinct authority and constraints

### The Orchestration Hierarchy

```
   ┌──────────────────────────────────────────────────────┐
   │                   HUMAN OPERATOR                      │
   │            (Types into Command Center)                │
   └───────────────────────┬──────────────────────────────┘
                           │ Default route (no prefix)
                           ▼
   ┌──────────────────────────────────────────────────────┐
   │                   GOD-AGENT 👑                        │
   │  Brain: gemini-3.1-pro-preview                       │
   │  Fallback: gemma4:e4b (local)                        │
   │  Authority: Absolute. Can /spawn, /terminate, /evolve│
   │  Lifecycle: Boot → Sweep → Delegate → Hibernate      │
   │  Wakes on: Error interrupt OR 5-hour timer            │
   └────────┬────────────────┬────────────────┬───────────┘
            │ Delegation     │ Platform Sync  │ Error Route
   ┌────────▼──────┐  ┌─────▼────────┐  ┌───▼──────────┐
   │  COO-Agent    │  │ Jules-Bridge  │  │  Healer-01   │
   │  gemma4 local │  │ flash-lite    │  │ gemini-pro   │
   │  "Always On"  │  │ "Always Sync" │  │ "On Demand"  │
   │  🛡️ Protected  │  │ Budget: 100K  │  │ /analyze,/fix│
   │  Orchestrate  │  │ WSS Connect   │  │ Code Repair  │
   └───────────────┘  └──────────────┘  └──────────────┘
```

### How State Passes Between Agents

Agents do **not** talk to each other directly. Communication happens through three mechanisms:

| Mechanism | How It Works |
|---|---|
| **System Context String** | Before every LLM call, a ~4KB context snapshot is injected containing all agent statuses, project milestones, sandbox results, and recent logs. Every agent "sees" the whole system. |
| **Hive-Mind Transcript** | The shared chat stream in CommandCenter — agents can read each other's recent outputs because the transcript is included in context. |
| **JSON Action Side-Effects** | Agents output `json:action` blocks that the system executes silently (spawn agents, schedule tasks, update goals). These mutations appear in the next agent's context window. |

> **Key Insight:** Jules-Bridge is a platform connector to the Jules sandbox — it is NOT a message bus between agents.

---

## 💓 System Health — What The Numbers Actually Mean

### The Dashboard "99% Health"

`avgHealth = average of all agents' health field`

The `health` field initializes at 100 and is **never dynamically reduced** by any process. The only live health signal is the **Heartbeat System**.

### Heartbeat System (Live)

Every 3 seconds, each non-paused agent receives a simulated heartbeat. 98% success rate, 2% miss chance.

| Status | Trigger | Visual |
|---|---|---|
| 🟢 Alive | 0 missed beats | Green pulse + sparkline |
| 🟡 Degraded | 1 missed beat | Amber pulse |
| 🟠 Unresponsive | 2+ missed beats | Red warning |
| 🔴 Dead | Exceeded maxMissed | Flatline, God-Agent intervenes |

**Response time baselines:** God-Agent: 8ms, COO: 25ms, Workers: 15-55ms (+ 0-15ms jitter)

### CPU / Memory / Latency

These are **simulated random walks** (±5 CPU, ±25 MB, ±10ms per 8-second tick). They do not reflect actual system resource usage.

---

## 🔑 Per-Agent Identity System (v2.8)

Each agent can have its own Google identity and API credentials:

| Agent | Email | API Key | Model | Free Quota |
|---|---|---|---|---|
| God-Agent | `asclepius.god@gmail.com` | `AIza...GOD` | gemini-3.1-pro | 1,500/day |
| COO-Agent | `asclepius.coo@gmail.com` | `AIza...COO` | gemma4 (local) | 1,500/day |
| Jules-Bridge | `asclepius.bridge@gmail.com` | `AIza...BRG` | flash-lite | 1,500/day |
| Healer-01 | `asclepius.healer@gmail.com` | `AIza...HLR` | gemini-3.1-pro | 1,500/day |

**Total fleet capacity: 6,000 free requests/day** (vs 1,500 with shared key).

Configure in: Agent Card → ⚙️ Settings → 🔑 Credentials tab.

### Credential Resolution Priority
```
Agent's personal API key → Agent's model field → Global settings (fallback)
```

---

## ⚡ Skills System

| Level | Name | XP to Next | Category Colors |
|---|---|---|---|
| 1 | Novice | 100 | `engineering` (violet), `analysis` (sky) |
| 2 | Apprentice | 300 | `operations` (amber), `security` (rose) |
| 3 | Competent | 600 | `creative` (emerald), `meta` (gold, God only) |
| 4 | Expert | 1000 | |
| 5 | Master | MAX | |

---

## 🎯 Lookback-Forward Execution Strategy

```
LOOKBACK    → Read full context (logs + history + fleet + projects)
COMPREHEND  → Map the landscape, understand what needs to happen
GRANULIZE   → Decompose into atomic, actionable tasks
FORWARD     → Execute with precision, then loop back
```

Every agent call receives: fleet status, active projects, sandbox health, last 15 logs, and chat transcript.

---

## 🖥️ Command Reference

| Command | Target | Description |
|---|---|---|
| `/spawn <name> <role>` | God-Agent | Create a new agent |
| `/terminate <agent>` | God-Agent | Destroy an agent (protected immune) |
| `/pause <agent>` | God-Agent | Hibernate agent |
| `/resume <agent>` | God-Agent | Wake agent |
| `/grant-skill <agent> <skill>` | God-Agent | Grant a leveled skill |
| `/evolve` | God-Agent | Recursive self-improvement |
| `/analyze <code>` | Healer-01 | Deep code analysis |
| `/fix <code>` | Healer-01 | Code repair |
| `God-Agent: <msg>` | God-Agent | Direct routing |
| `COO: <msg>` | COO-Agent | Direct routing |
| No prefix | God-Agent | Default target |

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, TypeScript |
| Styling | Tailwind CSS 4, shadcn/ui |
| Animation | Motion (Framer Motion) |
| AI (Cloud) | Google Gemini API (per-agent keys) |
| AI (Local) | Ollama (per-agent models) |
| Charts | Custom SVG sparklines |

---

## 🚀 Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

Set Gemini API key in: ⚙️ Settings → API Key, or per-agent in Agent Config → Credentials.

---

## 📁 Project Structure

```
asclepius/
├── CONTEXT_MAP.md                ← LIVING CONTEXT MAP — the Amnesia Guard
├── README.md                     ← This file
├── src/
│   ├── App.tsx                   ← [56KB] ALL state, agents, heartbeat, simulation, persistence
│   ├── types.ts                  ← ALL interfaces (Agent, AgentCredentials, Project, Sandbox, LLM)
│   ├── GOD_AGENT.md              ← God-Agent context document
│   ├── components/
│   │   ├── CommandCenter.tsx     ← [58KB] Chat, routing, auto-heal, JSON actions, quota
│   │   ├── AgentConfig.tsx       ← [51KB] Agent edit dialog (7 tabs incl. Credentials)
│   │   ├── AgentCard.tsx         ← [28KB] Agent card, sparklines, health bars
│   │   ├── Sandbox.tsx           ← [32KB] Code analysis, error routing, Manual Override
│   │   ├── ProjectsPage.tsx      ← [35KB] Projects, milestones, GitHub sync
│   │   ├── TaskScheduler.tsx     ← [13KB] Task scheduling
│   │   ├── Settings.tsx          ← [20KB] Global LLM settings
│   │   ├── AGENTS.md             ← Fleet context document
│   │   ├── COO_AGENT.md          ← COO-Agent context document
│   │   ├── HEALER_AGENT.md       ← Healer-01 context document
│   │   ├── JULES_BRIDGE.md       ← Jules-Bridge context document
│   │   └── COMMAND_CENTER.md     ← Command Center context document
│   └── services/
│       ├── llm.ts                ← [11KB] Dual-core routing, failover, credential resolver
│       ├── gemini.ts             ← [4KB] Gemini API wrapper
│       ├── ollama.ts             ← [2KB] Ollama wrapper
│       └── SERVICES.md           ← LLM services context document
└── docs/
    └── STRATEGY.md               ← Lookback-Forward execution philosophy
```

---

## 📚 Documentation Index

| Document | Purpose |
|---|---|
| [CONTEXT_MAP.md](CONTEXT_MAP.md) | **The Amnesia Guard** — deep-scan architecture, invariants, context leaks, scaling strategy |
| [GOD_AGENT.md](src/GOD_AGENT.md) | God-Agent identity, 11 skills, dual-core routing, 7 protocols |
| [COO_AGENT.md](src/components/COO_AGENT.md) | COO-Agent delegation protocol, task decomposition |
| [HEALER_AGENT.md](src/components/HEALER_AGENT.md) | Healer-01 analysis pipeline, Sandbox integration |
| [JULES_BRIDGE.md](src/components/JULES_BRIDGE.md) | Jules-Bridge WebSocket sync |
| [AGENTS.md](src/components/AGENTS.md) | Fleet overview, type system, heartbeats, skills, budgets |
| [COMMAND_CENTER.md](src/components/COMMAND_CENTER.md) | Terminal UI, routing, auto-heal, JSON actions |
| [SERVICES.md](src/services/SERVICES.md) | LLM backends, failover engine |
| [STRATEGY.md](docs/STRATEGY.md) | Lookback-Forward execution doctrine |

---

## License

Apache-2.0
