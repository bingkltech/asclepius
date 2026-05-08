# 🏛️ Asclepius — Autonomous Development Command Center

> *"Named after the Greek god of healing — Asclepius heals code, evolves software, and builds apps while you sleep."*

Asclepius is a **local-first, autonomous development orchestrator** that turns one developer into a self-healing engineering team. It does not just assist with coding — it **creates entire applications from scratch**, **repairs its own source code**, and **compounds intelligence with every execution**. It runs on your machine, not someone else's cloud.

---

## 🎯 The North Star (What This Actually Does)

Asclepius has **three core capabilities** that separate it from every AI coding tool:

| Capability | What It Means |
|---|---|
| **🏗️ Build Apps** | Given a goal like `"Build me a Mandelbrot Explorer"`, Asclepius decomposes it, assigns specialists, writes the code, tests it, and commits it — entirely autonomously. For ANY project, not just itself. |
| **🔧 Self-Repair** | Hermes (the God Agent) continuously scans its own source code for TypeScript errors, broken tests, stale docs, and dead logic — then patches them without being asked. |
| **🧠 Self-Learn** | Every execution — successes, failures, retries, API timeouts — is logged back into Hermes' memory. The system gets smarter on every run. It never breaks the same thing twice. |

---

## ⚙️ The Core Architecture: Brains vs. Hands

The single most important rule: **Intelligence and Execution are physically separated.**

### 🧠 Agents (Intelligence Brains)
Pure AI profiles. They hold system prompts, LLM credentials, skills, and architectural knowledge. They **think** — they never touch files, terminals, or APIs directly.

- **God Agent / Hermes** — Top of the hierarchy. Forges new agents, reads SOUL.md, runs the OODA loop, self-heals.
- **COO / Lead Agent** — Receives the goal, decomposes into a DAG, assigns tasks, manages the pipeline lifecycle.
- **Specialist Agents** — Frontend Dev, Backend Dev, Architect, QA, etc. Each has domain-specific system instructions.

### 🤲 Workers (Execution Hands)
Dumb adapters. Zero intelligence. A worker is just a named URL + auth token for a tool (Jules API, local executor, etc.). They pull tasks from a queue and fire payloads.

> **The Iron Rule:** A Worker can NEVER secretly fall back to an LLM. If its tool fails — the task crashes and is escalated. No silent substitution.

---

## 🔄 The Golden Loop (How a Project Gets Built)

```
GOAL: "Build a trading dashboard with live charts"
       │
       ▼
Phase 1 — BLUEPRINT
  Hermes scans the target repo, reads the constitution,
  generates a SKILL.md knowledge graph of the codebase.
       │
       ▼
Phase 2 — DAG CONSTRUCTION (COO)
  Decomposes into hyper-granular tasks with dependencies.
  Validates: no cycles, no hallucinated file paths,
  injects SKILL PROMPT into every task payload.
       │
       ▼
Phase 3 — DETERMINISTIC QUEUE (Workers pull, COO never talks to them)
  Workers self-manage: throttle, sleep, hibernate.
  Token economy preserved. No wasted LLM calls.
       │
       ▼
Phase 4 — CLOUD CATCHER (for async workers like Jules)
  COO yields. Polls local .git/refs/remotes every 15s.
  NO gh CLI. NO GitHub cloud connection. Pure filesystem.
       │
       ▼
Phase 5 — SANDBOX VERIFICATION
  PR checked out locally. Static (tsc, lint) → Dynamic (tests).
  3-Strike Revision Loop: errors sent back to worker for retry.
  After 3 failures → [BLOCKED] → escalate to human.
       │
       ▼
Phase 6 — REBASE, MERGE & CACHE BUST
  Rebase PR against latest main. Merge. Immediately re-scan
  codebase (cache bust) so next DAG task has fresh context.
       │
       ▼
Phase 7 — META-LEARNING (Hermes OODA reflection)
  Full execution log → Hermes. Pattern analysis. New knowledge
  written to memory. GOALS.md updated. System gets smarter.
```

---

## 🖥️ Dashboard Features (Vite + React Frontend)

| Section | What You Get |
|---|---|
| **Agent Fleet Forge** | Create, configure, and manage Intelligence Brains. God Agent protected at top. Multi-provider LLM switching (Gemini, Claude, OpenAI, Ollama). |
| **Projects** | Track multiple local repos. Each project has its own team, DAG, and conversation history stored in `.asclepius/`. |
| **Project Orchestrator** | The command center for a single project. Issue directives via Lead Agent chat. Watch the DAG execute in real-time. |
| **GitHub Sync Center** | Branch selector (reads local `.git` directly — no CLI needed). One-click GitHub Desktop launch. |
| **Pipeline Monitor** | Live terminal-style telemetry. Every API call, task state change, and error logged in real time. |

---

## 🧬 The Hierarchy of Intent

Every action in Asclepius flows through this chain. No layer may contradict a layer above it.

```
SOUL.md       → Why does Asclepius exist?          (immutable identity)
MISSION.md    → What are we becoming this quarter?  (quarterly direction)
GOALS.md      → What are the measurable milestones? (runtime goals, parsed by COO)
CONSTITUTION  → What are the unbreakable laws?      (architectural laws)
HERMES.md     → How does the God Agent behave?      (operational directives)
CONTEXT_MAP   → What is the current code structure? (living architecture doc)
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vite + React + TypeScript |
| Styling | Tailwind CSS (Dark Mode, Glassmorphism, Zinc/Emerald palette) |
| State | Custom `usePersistentState` hook → browser `localStorage` |
| Backend Bridge | Vite plugin (`asclepiusBackendPlugin`) — runs Node.js server-side APIs for file I/O, command execution, git parsing |
| LLM Routing | Multi-provider abstraction: Gemini, Claude, OpenAI, Ollama (local + cloud) |
| Git Integration | Native `.git` filesystem parser — no CLI dependency |
| Knowledge | Graphify architecture scanner + `.asclepius/skills/SKILL.md` per project |

---

## 🚀 Quick Start

```bash
# Clone and install
git clone https://github.com/BinqQarenYu/asclepius.git
cd asclepius
npm install

# Start the command center
npm run dev
# → http://localhost:5173
```

> **No cloud required for core operation.** Install [Ollama](https://ollama.ai) locally and Asclepius runs entirely on your hardware.

---

## 📂 Project Structure

```
asclepius/
├── src/
│   ├── App.tsx                 # Main dashboard — routing, state, UI
│   ├── agents/
│   │   ├── BaseAgent.ts        # LLM abstraction, file-writing, context gathering
│   │   ├── GodAgent.ts         # Hermes — self-healing, blueprinting, OODA
│   │   ├── LeadAgent.ts        # COO — decomposition, DAG, auto-assign
│   │   ├── ArchitectAgent.ts   # System design specialist
│   │   ├── FrontendAgent.ts    # React/CSS/UI specialist
│   │   ├── BackendAgent.ts     # API/database specialist
│   │   └── QAAgent.ts          # Testing and validation specialist
│   ├── tools/
│   │   ├── TerminalBridge.ts   # File I/O and command execution via Vite backend
│   │   ├── OllamaManager.ts    # Ollama queue, model selection, health checks
│   │   └── ResourceGovernor.ts # Adaptive context/timeout under CPU pressure
│   ├── services/
│   │   └── ProjectStore.ts     # Per-project .asclepius/ persistence
│   ├── hooks/
│   │   └── usePersistentState.ts  # localStorage-bound React state
│   ├── config/
│   │   └── fleet.json          # Initial agent/worker roster
│   └── types/
│       └── pipeline.ts         # Core type definitions
├── vite.config.ts              # Backend plugin (file I/O, git, command runner)
├── SOUL.md                     # Immutable identity kernel
├── MISSION.md                  # Current quarterly direction
├── GOALS.md                    # Parsed by COO — active work backlog
├── CONSTITUTION.md             # Unbreakable architectural laws
├── HERMES.md                   # God Agent operational directives
└── CONTEXT_MAP.md              # Living architecture reference
```

---

*Branch: `dev_asclepius` | This README is automatically kept accurate by Hermes' OODA self-documentation duty.*
