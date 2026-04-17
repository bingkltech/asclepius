# 🗺️ Asclepius Context Map — Anti-Hallucination Architecture

> **PURPOSE:** This is the master index for the Asclepius codebase. It maps every critical module to its self-contained context document. When working on any part of the system, **read the relevant context document FIRST** to prevent context loss, hallucination, or amnesia.

---

## The Problem This Solves

Large AI models (Gemini, Ollama, Claude) suffer from **context window limitations**:
- **Hallucination:** When context is too large, the model fills gaps with fabricated information.
- **Amnesia:** When a task spans multiple turns, the model forgets earlier decisions.
- **Drift:** When multiple files are loaded at once, the model conflates unrelated code.

### The Solution: Granular Context Documents

Instead of feeding the entire 56KB `App.tsx` or 57KB `CommandCenter.tsx` to an AI model, we maintain **focused, self-contained context documents** (`.md` files) at every critical junction. Each document:

1. **Is self-contained** — An AI model reading ONLY this file has full understanding.
2. **Is focused** — Covers exactly one module/agent/system.
3. **Has file references** — Points to the exact source files to edit.
4. **Has cross-links** — Links to related context documents for broader awareness.

---

## Context Document Index

### 🏛️ Agents (Critical Path)

| Document | Location | Covers |
|---|---|---|
| **God-Agent** | [src/GOD_AGENT.md](src/GOD_AGENT.md) | Identity, 11 skills, dual-core LLM routing, 7 protocols, JSON actions, command routing |
| **COO-Agent** | [src/components/COO_AGENT.md](src/components/COO_AGENT.md) | Identity, 5 skills, delegation protocol, task decomposition |
| **Healer-01** | [src/components/HEALER_AGENT.md](src/components/HEALER_AGENT.md) | Identity, 6 skills, analysis pipeline, Sandbox integration, precision repair |
| **Jules-Bridge** | [src/components/JULES_BRIDGE.md](src/components/JULES_BRIDGE.md) | Identity, 4 skills, WebSocket sync, platform connector |
| **Fleet Overview** | [src/components/AGENTS.md](src/components/AGENTS.md) | Registry, type system, heartbeats, skills, budgets, spawning |

### 📡 Systems

| Document | Location | Covers |
|---|---|---|
| **Command Center** | [src/components/COMMAND_CENTER.md](src/components/COMMAND_CENTER.md) | Terminal UI, routing, auto-heal, JSON actions, context construction |
| **LLM Services** | [src/services/SERVICES.md](src/services/SERVICES.md) | Gemini/Ollama providers, failover engine, rate limiting |
| **Execution Strategy** | [docs/STRATEGY.md](docs/STRATEGY.md) | Lookback-Forward methodology |

---

## Source File Map

### Root
```
asclepius/
├── README.md              ← Project overview, version history, tech stack
├── CONTEXT_MAP.md         ← THIS FILE — master index
├── index.html             ← Entry point, meta tags, font loading
├── package.json           ← Dependencies, scripts
├── vite.config.ts         ← Vite bundler configuration
└── tsconfig.json          ← TypeScript compiler options
```

### Source (`src/`)
```
src/
├── main.tsx               ← React root mount point
├── App.tsx                ← [56KB] CRITICAL: INITIAL_AGENTS[], all state, tabs, persistence
├── types.ts               ← ALL TypeScript interfaces (Agent, Project, Sandbox, LLM, etc.)
├── index.css              ← Global styles, animations, gradients
├── GOD_AGENT.md           ← God-Agent context document
├── components/
│   ├── CommandCenter.tsx   ← [57KB] CRITICAL: Chat, routing, auto-heal, JSON actions
│   ├── AgentCard.tsx       ← [28KB] Agent card UI, health bars, sparklines
│   ├── AgentConfig.tsx     ← [49KB] Agent configuration dialog
│   ├── Sandbox.tsx         ← [30KB] Code analysis, error routing, Manual Override modal
│   ├── ProjectsPage.tsx    ← [35KB] Project CRUD, milestones, GitHub sync
│   ├── TaskScheduler.tsx   ← [13KB] Scheduled task management
│   ├── Settings.tsx        ← [20KB] LLM provider config, API keys
│   ├── Sidebar.tsx         ← [5KB] Navigation tabs
│   ├── LogViewer.tsx       ← [3KB] System log display
│   ├── AGENTS.md           ← Fleet context document
│   ├── COO_AGENT.md        ← COO-Agent context document
│   ├── HEALER_AGENT.md     ← Healer-01 context document
│   ├── JULES_BRIDGE.md     ← Jules-Bridge context document
│   └── COMMAND_CENTER.md   ← Command Center context document
└── services/
    ├── llm.ts              ← [10KB] CRITICAL: Dual-core routing, failover, rate limiting
    ├── gemini.ts           ← [3KB] Gemini API wrapper
    ├── ollama.ts           ← [2KB] Ollama API wrapper
    └── SERVICES.md         ← LLM services context document
```

---

## Task Decomposition Guide

When an AI model receives a large task, use this guide to decompose it into focused sub-tasks:

### Step 1: Identify the Module
What part of the system does this task touch?

| If the task involves... | Read this context doc first |
|---|---|
| God-Agent behavior, authority, or model | [GOD_AGENT.md](src/GOD_AGENT.md) |
| COO-Agent scheduling or delegation | [COO_AGENT.md](src/components/COO_AGENT.md) |
| Code analysis, bug fixing, or repair | [HEALER_AGENT.md](src/components/HEALER_AGENT.md) |
| Jules platform or WebSocket sync | [JULES_BRIDGE.md](src/components/JULES_BRIDGE.md) |
| Chat interface, routing, or auto-heal | [COMMAND_CENTER.md](src/components/COMMAND_CENTER.md) |
| LLM providers, failover, or API keys | [SERVICES.md](src/services/SERVICES.md) |
| Agent skills, types, or budgets | [AGENTS.md](src/components/AGENTS.md) |
| Projects, milestones, or GitHub sync | Edit `ProjectsPage.tsx`, ref `types.ts` for `Project` |
| Sandbox errors, routing, or analysis | Edit `Sandbox.tsx`, ref `types.ts` for `SandboxError` |
| Scheduled tasks | Edit `TaskScheduler.tsx`, ref `types.ts` for `ScheduledTask` |

### Step 2: Read the Context Doc
Feed the relevant `.md` file to the AI model. It contains:
- The module's identity and purpose
- All interfaces and types it uses
- Exact file paths to edit
- Relationships to other modules

### Step 3: Edit with Precision
The context doc tells you exactly which files and line ranges to modify. Make surgical edits — don't rewrite entire files.

---

## Critical Files by Size (Complexity Indicator)

| File | Size | Risk Level | Notes |
|---|---|---|---|
| `CommandCenter.tsx` | 57KB | 🔴 HIGH | Largest component. Contains routing, auto-heal, JSON parser, system prompt |
| `App.tsx` | 56KB | 🔴 HIGH | All state management, INITIAL_AGENTS, persistence, tab routing |
| `AgentConfig.tsx` | 49KB | 🟡 MEDIUM | Agent edit dialog, skill management, model selection |
| `ProjectsPage.tsx` | 35KB | 🟡 MEDIUM | Project CRUD, milestones, GitHub sync, health cards |
| `Sandbox.tsx` | 30KB | 🟡 MEDIUM | Code analysis, error parsing, skill-based routing, Manual Override |
| `AgentCard.tsx` | 28KB | 🟡 MEDIUM | Agent card rendering, health bars, heartbeat sparklines |
| `Settings.tsx` | 20KB | 🟢 LOW | LLM provider config, API key input |
| `TaskScheduler.tsx` | 13KB | 🟢 LOW | Scheduled task list and management |
| `llm.ts` | 10KB | 🟡 MEDIUM | Dual-core routing engine, failover logic |
| `types.ts` | 7KB | 🟢 LOW | Type definitions only — but EVERY module depends on this |

---

## Version History

| Version | Codename | Key Features |
|---|---|---|
| v2.4 | Autonomy Engines | Tactical Hibernation, Future Projection, COO JSON Scheduling |
| v2.5 | API Intelligence | Gemini 429 failover, Projects Module, Unified Sandbox |
| v2.6 | Closed-Loop | Smart Agent Routing, Auto-Resolve Loop, RESOLVE_ERROR action |
| v2.7 | System Resilience | Precision AST Repair, Token Budgets, Manual Override, GitHub Sync, Local Failover |
