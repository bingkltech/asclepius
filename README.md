# ⚕️ Asclepius — Autonomous AI Agent Orchestrator

> *A Cognitive Management Plane that orchestrates a fleet of cloud-powered AI agents — each with their own identity, API quota, and cognitive model — to autonomously deliver verified software through a closed-loop pipeline.*

**Version:** v3.0 · **Architecture:** Cognitive Management Plane · **Last Audit:** 2026-04-18

> [!IMPORTANT]
> **📜 [Read the Constitution](CONSTITUTION.md) first.** The Constitution is the supreme architectural law of this system. All code, features, and agents must comply with its 7 articles.

---

## 🧬 Core Philosophy

### What Asclepius IS

Asclepius is a **Cognitive Management Plane** — it embodies the strategic mind (the God-Agent) while offloading all neural inference to cloud APIs (`jules.google`, Google Gemini). The app thinks, plans, delegates, and verifies. The cloud performs the raw cognitive labor.

### What Asclepius is NOT

- ❌ A chatbot with multiple personas
- ❌ A local AI inference engine
- ❌ A monolithic code generator

### The Three Truths (from the [Constitution](CONSTITUTION.md))

1. **The app is the mind; the cloud is the muscle.** (Article I)
2. **Every agent IS a Google Identity — sovereign and self-authenticating.** (Article II)
3. **Stability over raw speed. Always.** (Article III)

---

## 🏗️ The Autonomous Delivery Pipeline

The defining feature of Asclepius: a closed-loop pipeline where code flows from task definition to verified production merge with zero manual intervention.

```
COO creates task
    │
    ▼
Worker Agent receives task ──► Sends to jules.google (Cloud)
    │                                    │
    │                          Jules generates code
    │                                    │
    ▼                                    ▼
Worker writes files locally ◄── Code returned from cloud
    │
    ▼
Worker creates PR branch → pushes to GitHub
    │
    ▼
COO pulls branch into Sandbox
    │
    ├── PASS → COO merges to main → Next task
    │
    └── FAIL → COO rejects PR → Creates fix task → Loop back
```

> See [Constitution Article IV](CONSTITUTION.md#article-iv--the-autonomous-delivery-pipeline-coo--agent--jules--pr--sandbox--main) for the full pipeline specification.

---

## 👑 The Orchestration Hierarchy

```
   ┌──────────────────────────────────────────────────────┐
   │                   HUMAN OPERATOR                      │
   │            (Types into Command Center)                │
   └───────────────────────┬──────────────────────────────┘
                           │ Default route (no prefix)
                           ▼
   ┌──────────────────────────────────────────────────────┐
   │                   GOD-AGENT 👑                        │
   │  The Cognitive Embodiment of Asclepius                │
   │  Brain: gemini-3.1-pro (cloud) / gemma4 (fallback)   │
   │  Authority: Absolute. Can /spawn, /terminate, /evolve│
   │  Role: Strategic planning, context brokering, QA      │
   └────────┬────────────────┬────────────────┬───────────┘
            │ Delegation     │ Platform Sync  │ Error Route
   ┌────────▼──────┐  ┌─────▼────────┐  ┌───▼──────────┐
   │  COO-Agent    │  │ Jules-Bridge  │  │  Healer-01   │
   │  gemma4 local │  │ flash-lite    │  │ gemini-pro   │
   │  "Always On"  │  │ Auth Orch.    │  │ "On Demand"  │
   │  🛡️ Protected  │  │ Token Mgmt   │  │ /analyze,/fix│
   │  Pipeline Mgr │  │ Session Hlth  │  │ Code Repair  │
   └───────────────┘  └──────────────┘  └──────────────┘
```

### How State Passes Between Agents

Agents do **not** talk to each other directly. Communication happens through three mechanisms:

| Mechanism | How It Works |
|---|---|
| **System Context String** | Before every LLM call, a ~4KB context snapshot is injected containing all agent statuses, project milestones, sandbox results, and recent logs. Every agent "sees" the whole system. |
| **Hive-Mind Transcript** | The shared chat stream in CommandCenter — agents can read each other's recent outputs because the transcript is included in context. |
| **JSON Action Side-Effects** | Agents output `json:action` blocks that the system executes silently (`SPAWN_AGENT`, `SCHEDULE_TASK`, `WRITE_FILE`, `EVOLVE_AGENT`). These mutations appear in the next agent's context window. |

> **Key Insight:** Every agent connects directly to the cloud through its own Google Identity (Article II). Jules-Bridge is the Auth Orchestrator that keeps all sessions alive, not a gateway bottleneck.

---

## 🔑 Sovereign Agent Identity System

Each agent **IS** a Google Identity — not just a credential holder (Constitution Article II):

| Agent | Identity (Gmail) | Model | Cloud Access | Free Quota |
|---|---|---|---|---|
| God-Agent | `asclepius.god@gmail.com` | gemini-3.1-pro | jules.google + Gemini API | 1,500/day |
| COO-Agent | `asclepius.coo@gmail.com` | gemma4 (local) | jules.google + Ollama | 1,500/day |
| Jules-Bridge | `asclepius.bridge@gmail.com` | flash-lite | Auth Orchestrator (monitors all sessions) | 1,500/day |
| Healer-01 | `asclepius.healer@gmail.com` | gemini-3.1-pro | jules.google + Gemini API | 1,500/day |

**Total fleet capacity: 6,000 free requests/day** (scales linearly with each new agent/account).

Once authenticated via OAuth, each agent can autonomously:
- Create its own `jules.google` coding instances
- (Future) Read its own Gmail inbox
- (Future) Access its own Google Drive
- Refresh its own tokens when they expire

### One-Time Auth Flow
```
Settings → Agent Credentials → "Authenticate" → Google OAuth → Tokens stored in encrypted vault
```

Configure in: Agent Card → ⚙️ Settings → 🔑 Credentials tab.

---

## 💓 System Health — What The Numbers Actually Mean

### The Dashboard "99% Health"

`avgHealth = average of all agents' health field`

The `health` field initializes at 100 and is **dynamically updated**:
- **Degrades** automatically when the agent misses heartbeats (status: `degraded`, `unresponsive`, or `dead`).
- **Passively Regenerates** by +5 HP every 30 seconds as long as the agent is alive and not paused.
- **Auto-Recovery:** Dead agents are caught by a 15-second watchdog loop that resets their heartbeat and partially restores their health, generating a system alert.

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

## ⚡ Skills & Autonomous Evolution

| Level | Name | XP to Next | Category Colors |
|---|---|---|---|
| 1 | Novice | 100 | `engineering` (violet), `analysis` (sky) |
| 2 | Apprentice | 300 | `operations` (amber), `security` (rose) |
| 3 | Competent | 600 | `creative` (emerald), `meta` (gold, God only) |
| 4 | Expert | 1000 | |
| 5 | Master | MAX | **Triggers Autonomous Evolution Loop** |

> **The Evolution Loop:** When an agent gains enough XP to reach Level 5 (Master) in any skill, it automatically spawns an `[AUTONOMOUS EVOLUTION]` task for itself to propose an architecture refactor or tool upgrade based on its mastery.

---

## 🎯 Lookback-Forward Execution Strategy (Constitution Article VII)

```
LOOKBACK    → Read full context (logs + history + fleet + projects + sandbox)
COMPREHEND  → Map the landscape, understand what needs to happen
GRANULIZE   → Decompose into atomic, actionable tasks
FORWARD     → Execute with precision, then loop back
```

Every agent call receives: fleet status, active projects, sandbox health, recent logs, and chat transcript.

> See [STRATEGY.md](docs/STRATEGY.md) for the full doctrine.

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
| AI (Cloud) | Google Gemini API (per-agent keys), jules.google |
| AI (Local) | Ollama (per-agent models) |
| Charts | Custom SVG sparklines |
| Persistence | localStorage (encrypted AES-GCM for credentials) |

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
├── CONSTITUTION.md               ← 📜 SUPREME LAW — 7 immutable articles
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

## 📚 Documentation Hierarchy (Constitution Supremacy)

| Document | Purpose | Authority |
|---|---|---|
| [📜 CONSTITUTION.md](CONSTITUTION.md) | **Supreme Law** — 7 immutable architectural articles | 👑 Supreme |
| [CONTEXT_MAP.md](CONTEXT_MAP.md) | **The Amnesia Guard** — deep-scan architecture, invariants, context leaks, scaling strategy | Implementation |
| [GOD_AGENT.md](src/GOD_AGENT.md) | God-Agent identity, 11 skills, dual-core routing, 8 protocols | Agent Spec |
| [COO_AGENT.md](src/components/COO_AGENT.md) | COO-Agent delegation protocol, pipeline management | Agent Spec |
| [HEALER_AGENT.md](src/components/HEALER_AGENT.md) | Healer-01 analysis pipeline, Sandbox integration | Agent Spec |
| [JULES_BRIDGE.md](src/components/JULES_BRIDGE.md) | Jules-Bridge cloud relay, WebSocket sync | Agent Spec |
| [AGENTS.md](src/components/AGENTS.md) | Fleet overview, type system, heartbeats, skills, budgets | Fleet Spec |
| [COMMAND_CENTER.md](src/components/COMMAND_CENTER.md) | Terminal UI, routing, auto-heal, JSON actions | Component Spec |
| [SERVICES.md](src/services/SERVICES.md) | LLM backends, failover engine, distributed compute | Service Spec |
| [STRATEGY.md](docs/STRATEGY.md) | Lookback-Forward execution doctrine | Doctrine |

---

## License

Apache-2.0
