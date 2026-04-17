# ⚕️ Asclepius — Autonomous AI Agent Orchestrator

> *An autonomous AI agent orchestrator where a supreme God-Agent commands, spawns, heals, and evolves an entire fleet of specialized worker agents — with real-time heartbeat monitoring, leveled skills, and absolute lifecycle control.*

---

## 🧬 Architecture

```
                    ┌────────────────────────────────┐
                    │         GOD-AGENT 👑            │
                    │   Lead Architect & Orchestrator │
                    │   Model: gemini-3.1-pro-preview │
                    │                                │
                    │   POWERS:                      │
                    │   /spawn   /terminate           │
                    │   /pause   /resume              │
                    │   /grant-skill  /evolve         │
                    │   /fleet-status                 │
                    └────────┬───────────────────────┘
                             │ Absolute Authority
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
     ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
     │  COO-Agent   │ │ Jules-Bridge │ │  Healer-01   │
     │  Operations  │ │  Connector   │ │  Code Repair │
     │  🛡️ Protected │ │              │ │              │
     └──────────────┘ └──────────────┘ └──────────────┘
              ▲                                ▲
              │ Delegation                     │ Auto-Heal
              └── API Quota, Scheduling ───────┘
```

### God-Agent Supremacy

The God-Agent is not just an agent — it is the **runtime orchestrator** with absolute authority:

- **Spawn** new specialized agents dynamically (`/spawn <name> <role>`)
- **Terminate** agents no longer needed (`/terminate <agent>`)
- **Pause/Resume** agents to conserve resources (`/pause`, `/resume`)
- **Grant & Revoke Skills** on any agent (`/grant-skill`, `/revoke-skill`)
- **Self-Evolve** through recursive improvement (`/evolve`)
- **Fleet Status** — full diagnostic report (`/fleet-status`)

Protected agents (God-Agent, COO-Agent) cannot be terminated.

### v2.4 Autonomy Engines
- **Tactical Hibernation:** The God-Agent boots, sweeps the system, delegates to the COO-Agent, and autonomously switches off into hibernation to save CPU/Memory/API limits. It uniquely wakes on Error (Interrupt) or expiration of a mandatory 5-hour cycle.
- **Future Projection:** The God-Agent continually cross-references project requirements with active agent skills. If a technical gap exists, it bypasses the user and autonomously calls `[SPAWN_AGENT]` JSON payloads to manifest the required specialist.
- **COO JSON Scheduling:** The COO-Agent converts high-level instructions into concrete tasks via `[SCHEDULE_TASK]` actions, directly inserting processes into the UI's Background Scheduler Engine.
- **Hive-Mind Transcript:** Instead of isolated prompts, agents read a continuous multi-agent sliding context window, allowing them to read and react to the actual outputs of other agents in real-time.
- **Persistent Fleet Memory:** Supported by native `localStorage` architecture, closing tabs or instances prevents data loss. The God-Agent remembers exactly who it hired and the fleet picks up right where it left off.

### v2.5 — API Intelligence & Project Management
- **API Quota Management:** Gemini 429 rate limits are automatically detected, persisted in `localStorage` with exponential backoff (1m→15m cap), and the system seamlessly fails over to Ollama (`gemma4:e4b`) until the quota refreshes. The HUD shows a live countdown badge.
- **Projects Module:** Full CRUD project management with milestones, GitHub URL linking, agent assignment, tech stack tags, priority levels, and animated progress tracking. Agents are project-aware — every system prompt includes live project context.
- **Unified Sandbox:** Merged CodeAnalyzer + Sandbox into one testing workbench. Project-scoped AI analysis, structured error parsing (critical/warning/info), run history persistence, and one-click error-to-task conversion.
- **Self-Healing Development Loop:** Errors detected in Sandbox auto-create resolution tasks → assigned to agents → agents fix → progress flows back to Project dashboard. Closed-loop autonomous development.
- **`GRANT_SKILL` / `EVOLVE_AGENT` / `UPDATE_GOAL`:** God-Agent can autonomously grant skills to agents, evolve them (max all skills), and mark project milestones as completed via JSON actions.

### v2.6 — Closed-Loop Error Resolution
- **Smart Agent Routing:** Sandbox errors are routed to the best-fit agent using a skill-scoring algorithm (security bugs → security-skilled agents, code bugs → Healer-01, performance issues → performance specialists). God-Agent is only used as fallback.
- **Command Center Event Feed:** Every sandbox analysis posts results (`[CRITICAL]`, `[WARNING]`, `[PASS]`) and task creation summaries (`[AUTO-TASK]`) directly into the Command Center transcript. All agents can see and react.
- **Auto-Resolve Loop:** When a `[SANDBOX]` fix task completes, matching sandbox errors are automatically resolved. Project Health card updates in real-time.
- **`RESOLVE_ERROR` Action:** Agents can autonomously mark sandbox errors as resolved from within the Command Center via `json:action` blocks.
- **Health Badges:** Project list cards show live health indicators (green ✓ Clean / red ✗ N errors) based on most recent sandbox runs.

### v2.7 — System Resilience & Human-in-the-Loop
- **Precision AST Repair:** Sandbox errors now natively map `lineNumber`, `column`, and `filePath` directly into Healer-01's context window for surgical refactoring.
- **Token Budget Constraints:** Agent routing heuristics now actively calculate token usage; overworked agents receive a soft-penalty (up to 50%) or a hard-block, ensuring workload distribution across the entire fleet.
- **Manual Routing Override:** While the system auto-selects the optimal agent, clicking "Create Tasks" now opens a preview modal allowing human operators to manually re-route tasks via a UI dropdown prior to deployment.
- **GitHub Milestone Sync:** Projects with a valid `githubUrl` feature a one-click Sync button that automatically fetches open issues via the GitHub REST API and maps them directly into active `ProjectGoal` milestones for the God-Agent to orchestrate.
- **Aggressive Local Failover:** The `MODEL_FALLBACK_INIT` protocol instantly intercepts network drops, timeouts, and `401/403` API errors, migrating orchestration to local Ollama hardware (`gemma4:e4b`) while maintaining a silent 5-minute auto-recovery heartbeat to the cloud.

---

## 💓 Heartbeat System

Every agent emits a periodic liveness signal — a **heartbeat** — proving it's alive and responsive.

| Status | Meaning | Visual |
|---|---|---|
| 🟢 **Alive** | Agent is responsive | Green pulse + sparkline |
| 🟡 **Degraded** | 1 missed beat | Amber pulse |
| 🟠 **Unresponsive** | 2+ missed beats | Red warning |
| 🔴 **Dead** | Exceeded max missed beats | Flatline, God-Agent intervenes |

**Sparkline visualization** on each agent card shows the last 20 heartbeat response times as a live SVG chart. Uptime percentage is shown as a badge.

| Agent | Interval | Max Missed | Reason |
|---|---|---|---|
| God-Agent | 5s | 5 | Critical — faster pulse, higher tolerance |
| Workers | 10s | 3 | Standard monitoring |

---

## ⚡ Skills System

Skills are **specific, leveled competencies** — more granular than capabilities. Each skill has:

- **Level** (1-5): Novice → Apprentice → Competent → Expert → Master
- **XP**: Experience points toward next level
- **Category**: engineering, analysis, operations, security, creative, meta
- **Usage tracking**: Times used, last used timestamp

### Skill Categories & Colors

| Category | Color | Agents |
|---|---|---|
| `engineering` | Violet | All |
| `analysis` | Sky Blue | Healer-01, COO |
| `operations` | Amber | COO, God |
| `security` | Rose | Healer-01 |
| `creative` | Emerald | All |
| `meta` | Gold | God-Agent only (Self-Healing, Self-Evolution) |

### XP Thresholds

```
Level 1 → 2:   100 XP  (Novice → Apprentice)
Level 2 → 3:   300 XP  (Apprentice → Competent)
Level 3 → 4:   600 XP  (Competent → Expert)
Level 4 → 5:  1000 XP  (Expert → Master)
Level 5:       MAX      (No further leveling)
```

---

## 🎯 Lookback-Forward Execution Strategy

The core execution doctrine for all agents:

```
1. LOOKBACK   — Ingest full system context (logs + history + agent states)
2. COMPREHEND — Understand the current situation deeply
3. GRANULIZE  — Break down into atomic, actionable tasks
4. FORWARD    — Execute with precision, then verify
```

Every agent command is enriched with:
- Recent system logs (last 15 entries)
- All agent states, skills, and heartbeat status
- Target agent's role-specific system prompt
- Full conversation history for context continuity

---

## 🖥️ Command Reference

### Lifecycle Commands (God-Agent)
| Command | Description |
|---|---|
| `/spawn <name> <role>` | Create a new agent with role-based default skills |
| `/terminate <agent>` | Destroy an agent (protected agents immune) |
| `/pause <agent>` | Freeze agent, stop heartbeat, remove from pool |
| `/resume <agent>` | Unfreeze paused agent, restart heartbeat |

### Skill Commands
| Command | Description |
|---|---|
| `/grant-skill <agent> <skill> <category> <level>` | Grant a skill to an agent |
| `/revoke-skill <agent> <skill name>` | Remove a skill from an agent |
| `/evolve-agent <agent>` | Analyze performance, recommend upgrades |
| `/evolve` | God-Agent recursive self-improvement |

### Status Commands
| Command | Description |
|---|---|
| `/fleet-status` | Full fleet report with heartbeats, skills, budgets |
| `/help` | Show all available commands |

### Agent Routing
| Syntax | Target |
|---|---|
| `God-Agent: <message>` | Route to God-Agent |
| `COO: <message>` | Route to COO-Agent |
| `Healer: <message>` | Route to Healer-01 |
| `/analyze <code>` | Send to Healer for analysis |

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, TypeScript |
| Styling | Tailwind CSS 4, shadcn/ui |
| Animation | Motion (Framer Motion) |
| AI (Cloud) | Google Gemini API |
| AI (Local) | Ollama |
| Charts | Custom SVG sparklines |

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Set API key (optional — for cloud AI)
export GEMINI_API_KEY="your-key-here"

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 📁 Project Structure

```
src/
├── App.tsx                  # Main orchestrator — agents, heartbeat engine, sandbox wiring
├── types.ts                 # Complete type system (Agent, Heartbeat, Skills, Project, Sandbox)
├── index.css                # Premium dark theme design system
├── main.tsx                 # Entry point
├── components/
│   ├── AgentCard.tsx        # Agent card — heartbeat sparkline, skills, lifecycle controls
│   ├── AgentConfig.tsx      # Full agent configuration modal (model, skills, budget)
│   ├── Sidebar.tsx          # Collapsible navigation with tooltips
│   ├── CommandCenter.tsx    # Terminal — lifecycle/skill commands, LLM chat, action execution
│   ├── LogViewer.tsx        # Animated live log stream
│   ├── Sandbox.tsx          # Unified testing workbench — project-aware AI analysis
│   ├── ProjectsPage.tsx     # Full CRUD project management with health badges
│   ├── TaskScheduler.tsx    # Automated task scheduling
│   └── Settings.tsx         # Provider configuration (Gemini/Ollama)
├── services/
│   ├── llm.ts               # Unified LLM service (Gemini + Ollama)
│   ├── gemini.ts            # Gemini API client
│   └── ollama.ts            # Ollama local client
└── lib/
    └── utils.ts             # Utility functions
```

---

## 📚 Documentation

| Document | Description |
|---|---|
| [GOD_AGENT.md](src/GOD_AGENT.md) | God-Agent architecture, self-healing, self-evolution |
| [AGENTS.md](src/AGENTS.md) | Worker fleet, heartbeat simulation, agent types |
| [COMMAND_CENTER.md](src/COMMAND_CENTER.md) | Terminal interface, routing, auto-heal pipeline |
| [SERVICES.md](src/SERVICES.md) | LLM abstraction, provider switching, rate limits |
| [STRATEGY.md](docs/STRATEGY.md) | Lookback-Forward execution philosophy |

---

## License

Apache-2.0
