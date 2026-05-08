# Asclepius Context Map & Architecture Guide

> **Living Document.** Updated by Hermes' self-documentation duty.
> **Branch:** `dev_asclepius`
> **Last Updated:** 2026-05-08 (Overhaul Session — Tasks 1–11 of 12 complete)

This document is the technical ground truth for the Asclepius codebase. New contributors (human or agent) read this first.

---

## 1. What This App Does (One Paragraph)

Asclepius is a **local-first autonomous development orchestrator**. You give it a goal — "Build a trading dashboard", "Fix the broken auth in QuoLas", "Add dark mode to Mandelbrot" — and it decomposes that goal into a dependency-ordered task graph, assigns each task to a specialist AI agent, executes the tasks using real tools (file writes, terminal commands), tests the output, and commits the result to git. It does this for **any external project**, not just itself. It also runs a continuous OODA loop to self-diagnose and repair its own source code.

---

## 2. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | Vite + React + TypeScript | SPA, no SSR |
| Styling | Tailwind CSS v4 | Dark mode, glassmorphism, zinc/emerald palette |
| Icons | Lucide-React | |
| State | `usePersistentState` hook | Binds React state to `localStorage` — survives refresh |
| Backend Bridge | Vite plugin (`asclepiusBackendPlugin`) | Node.js middleware for file I/O, command execution, git parsing |
| LLM | Multi-provider abstraction | Gemini, Claude, OpenAI, Ollama (local + cloud) |
| Git | Native `.git` filesystem parser | No CLI dependency — reads `refs/heads/`, `refs/remotes/`, `packed-refs` |
| Agent Queue | In-memory JS | Ollama single-concurrency queue (prevents GPU thrash) |

---

## 3. Directory Structure (Authoritative)

```
f:\012A_Github\asclepius\
├── src/
│   ├── App.tsx                     # MONOLITH — dashboard routing, all UI panels, core state
│   ├── main.tsx                    # React mount point — force remount key lives here
│   ├── index.css                   # Tailwind directives
│   ├── App.css                     # Global overrides
│   │
│   ├── agents/                     # Intelligence Brains (never touch files directly)
│   │   ├── BaseAgent.ts            # Abstract base: LLM call, file-write parsing, context gathering
│   │   ├── GodAgent.ts             # Hermes: OODA loop, self-heal, blueprint generation, ML research
│   │   ├── LeadAgent.ts            # COO: DAG decomposition, auto-assign, tick loop
│   │   ├── ArchitectAgent.ts       # System design, tech selection, scaffold generation
│   │   ├── FrontendAgent.ts        # React, CSS, UI, accessibility
│   │   ├── BackendAgent.ts         # API, database, server-side logic
│   │   ├── QAAgent.ts              # Test writing, validation, regression detection
│   │   └── index.ts                # Agent factory and exports
│   │
│   ├── tools/                      # Execution-layer utilities (used by agents via BaseAgent)
│   │   ├── TerminalBridge.ts       # Calls Vite backend APIs (/api/read-file, /api/write-file, etc.)
│   │   ├── OllamaManager.ts        # Ollama queue, model selection, health monitor
│   │   ├── ResourceGovernor.ts     # Adaptive context/timeout based on CPU/GPU pressure
│   │   └── CommonSenseGate.ts      # Goal validation — ALLOW / CAUTION / SKIP / REJECT
│   │
│   ├── services/
│   │   └── ProjectStore.ts         # Reads/writes .asclepius/ inside each managed project
│   │
│   ├── hooks/
│   │   └── usePersistentState.ts   # localStorage-bound useState — the entire UI persistence layer
│   │
│   ├── config/
│   │   └── fleet.json              # Default agent/worker roster (seeded on first load)
│   │
│   ├── types/
│   │   └── pipeline.ts             # ALL shared types: AgentConfig, PipelineTask, Worker, Project
│   │
│   ├── components/                 # Extracted UI panels (extraction in progress — Task 12)
│   │   ├── ui.tsx                  # Shared Button primitive — import from here, never redefine
│   │   ├── SandboxPanel.tsx        # Agent Sandbox tab ✅ extracted
│   │   ├── ChronicleDebugger.tsx   # Debug inspector
│   │   └── FalconTelemetryWidget.tsx # Falcon trading widget
│   └── styles/                     # Additional style modules
│
├── vite.config.ts                  # Backend plugin + Jules API proxy
│
├── scripts/                        # Node.js background scripts (non-UI)
│   └── goal-orchestrator.ts        # Headless OODA runner (boots Hermes without the dashboard)
│
├── .asclepius/                     # Asclepius' own runtime data (auto-created)
│   ├── conversations.json          # Lead Agent chat history
│   ├── dag-tasks.json              # Current DAG state
│   ├── memory/                     # Hermes' learned lessons (compounding intelligence)
│   └── skills/SKILL.md             # Asclepius' own codebase knowledge graph
│
├── SOUL.md                         # Immutable identity kernel — never modified by agents
├── CONSTITUTION.md                 # Unbreakable architectural laws
├── MISSION.md                      # Current quarterly direction
├── GOALS.md                        # Active work backlog — parsed by COO
├── HERMES.md                       # God Agent operational directives
└── CONTEXT_MAP.md                  # This file — living architecture reference
```

### Per-Project Data (auto-created inside each managed repo)
```
{projectLocalPath}/.asclepius/
├── conversations.json   # Lead Agent chat history for this project
├── dag-tasks.json       # Task graph — current + historical
├── settings.json        # Project team config, branch target
└── skills/SKILL.md      # Codebase knowledge graph (generated by Graphify/GodAgent)
```

---

## 4. Core Data Models

All types live in `src/types/pipeline.ts`.

### `AgentConfig` (Intelligence Brain)
```typescript
{
  id: string;
  name: string;               // "Hermes", "Artemis", "James"
  role: string;               // "God-Agent", "Lead-Agent", "Senior Frontend Dev"
  isLeadAgent?: boolean;      // true = COO role
  skills: AgentSkill[];       // ['frontend', 'architecture', ...]
  model: ModelConfig;         // LLM credentials + endpoint
  systemPrompt?: string;      // Custom personality instructions
  knowledgeAssets?: string[]; // Paths to SKILL.md files loaded into context
  status: 'online' | 'offline' | 'busy';
  maxConcurrentTasks?: number;
}
```

### `Worker` (Unified Roster Type — category-discriminated)
`Workers` and `Agents` now share a single `Worker` type in `App.tsx` local state, **but are separated by the `category` field** — never by role heuristics.

```typescript
type Worker = {
  id: string;
  name: string;
  role: AgentRole;
  /** 'brain' = Intelligence Brain. 'hand' = Execution Hand. NEVER conflate. */
  category: 'brain' | 'hand';
  type: 'Cloud' | 'Local';
  status: 'idle' | 'busy' | 'offline';
  avatarColor: string;
  // Brain-only fields
  systemPrompt?: string;
  allowFallback?: boolean;
  // Hand-only fields
  endpoint?: string;
  token?: string;
  requiresQA?: boolean;
};
```

Two derived views are declared immediately after the state:
```typescript
const agentBrains = workers.filter(w => w.category === 'brain');
const workerHands  = workers.filter(w => w.category === 'hand');
```
> Use **only** `agentBrains` and `workerHands` — never filter the raw `workers[]` array by role or systemPrompt.

### `PipelineTask`
```typescript
{
  id: string;
  goal: string;               // "Add dark mode toggle to Navbar"
  description?: string;       // Detailed instructions + dependency handoff reports
  assignedAgentId: string | null;
  requiredSkills: AgentSkill[];
  dependencies: string[];     // Task IDs that must complete first
  status: TaskStatus;         // 'pending' | 'assigned' | 'working' | 'completed' | 'failed' | 'blocked' | 'waiting_on_pr'
  priority: 'critical' | 'high' | 'medium' | 'low';
  targetBranch: string;
  targetFiles?: string[];
  output?: string;            // LLM output + file write confirmation
  logs: string[];             // Timestamped execution log
  revisionCount: number;      // 3-Strike counter
  estimatedMinutes?: number;
}
```

### `Project`
```typescript
{
  id: string;
  name: string;               // "Mandelbrot Explorer"
  localPath: string;          // "F:\012A_Github\mandelbrot"  (local first — no GitHub URL)
  assignedWorkerIds: string[];// Workers recruited to this project's team
  activeBranch?: string;      // "dev_asclepius", "main", etc.
}
```

---

## 5. The Unified Workflow Engine (Phase-by-Phase)

### Phase 1 — Blueprinting (GodAgent)
- Reads `SOUL.md` and `CONSTITUTION.md` (identity anchoring)
- Calls `TerminalBridge.listDir()` on target project
- Generates `SKILL.md` knowledge graph (via Graphify or direct scan)
- Injects into LeadAgent context

### Phase 2 — DAG Construction (LeadAgent.decompose())
- LLM decomposes directive into JSON task array
- Builds dependency chain with UUIDs
- Sets initial status: `pending` (no deps) or `blocked` (has deps)
- Auto-assigns tasks to agents via `LeadAgent.autoAssign()`

### Phase 3 — Queue & Execution (Workers pull, COO doesn't talk)
- Workers (Jules adapter, local executor) pull from task queue
- `BaseAgent.execute()`: LLM call → parses `<file path="...">` XML blocks → writes via `TerminalBridge`
- `OllamaManager.enqueue()`: single-concurrency queue prevents GPU thrash
- `ResourceGovernor`: adaptive context size + timeout under load

### Phase 4 — Cloud Catcher (for async workers like Jules)
- Task enters `waiting_on_pr` state
- Every 15s: Vite backend `/api/get-branches` reads `.git/refs/remotes/` for new `jules-*` branches
- No `gh` CLI. No GitHub API. Pure filesystem.
- Timeout after N minutes → `FAILED: TIMEOUT`

### Phase 5 — Sandbox Verification
- `tsc --noEmit` → fail fast on type errors
- `npm run lint` → style gates
- `npm run test` → runtime validation
- On failure: error packed into task description → reassigned → `revisionCount++`
- At 3 failures: `BLOCKED` → escalate to human

### Phase 6 — Rebase, Merge & Cache Bust
- `git rebase main` on PR branch → prevents stale conflicts
- Clean merge → immediately re-scan codebase (invalidate `SKILL.md` cache)
- Unlock next blocked DAG tasks

### Phase 7 — Meta-Learning (GodAgent.analyzeWorkflow())
- Full log + task array → Hermes
- Pattern analysis → new lessons written to `.asclepius/memory/`
- New GOALS proposed if systemic issues detected

---

## 6. Known Pitfalls & Development Rules

### ⚠️ HMR State Caching
Vite HMR preserves React state across code reloads. If you change a `usePersistentState` key to force a reset, the browser will NOT pick up the new default unless you hard-refresh (F5) or update the `key` prop on `<App />` in `main.tsx`.

### ✅ Conflation Resolved (2026-05-08)
The `category: 'brain' | 'hand'` discriminator is now on every roster entry. Use the derived views:
```typescript
const agentBrains = workers.filter(w => w.category === 'brain'); // Planners
const workerHands  = workers.filter(w => w.category === 'hand');  // Executors
```
Never filter by `w.role === 'God-Agent'` or `w.systemPrompt !== undefined`. Those heuristics are gone.

### ⚠️ LocalStorage as Database
`usePersistentState` serializes to JSON. Do not store non-serializable types (Dates, Functions, class instances). Store timestamps as ISO strings or Unix ms numbers.

### ⚠️ Vite Backend APIs (Not Express)
The backend plugin in `vite.config.ts` is a middleware, not a real server. It only runs during `npm run dev`. For production or headless runs, use `scripts/goal-orchestrator.ts` which calls `TerminalBridge` directly via Node.js.

### ⚠️ App.tsx Partial Monolith (1,461 lines)
`src/App.tsx` has been reduced from 1,553 → 1,461 lines. `SandboxPanel` is extracted.
Remaining panels to extract: **FleetPanel** (~380 lines) and **ProjectsPanel** (~600 lines).
All new panels should be placed in `src/components/` and use `Button` from `src/components/ui.tsx`.

---

## 7. Architectural Flaws Registry

| # | Issue | Severity | Status | Fix Location |
|---|---|---|---|---|
| 1 | **Agent/Worker Conflation** — Both shared `workers[]`, distinguished by heuristics | 🔴 Critical | ✅ **FIXED 2026-05-08** | `App.tsx`: `category` field + `agentBrains`/`workerHands` derived views |
| 2 | **Hardcoded self-path in prompts** — LeadAgent/GodAgent always pointed at Asclepius | 🔴 Critical | ✅ **FIXED 2026-05-08** | `LeadAgent.ts` + `GodAgent.ts`: dynamic `this.projectPath` injection |
| 3 | **No CommonSenseGate wiring** — Gate existed but nothing called it | 🟠 High | ✅ **FIXED 2026-05-08** | `BaseAgent.execute()`: gate evaluates before every LLM call |
| 4 | **No DAG Cyclic Validation** — LLM JSON trusted for dependency order | 🟠 High | ✅ **FIXED 2026-05-08** | `LeadAgent.validateDAG()`: Kahn's algorithm, O(V+E) |
| 5 | **No 3-Strike Revision Loop** — Failed tasks stayed failed forever | 🟡 Medium | ✅ **FIXED 2026-05-08** | `LeadAgent.tick()`: retry up to `maxRetries`, then `blocked` + human escalation |
| 6 | **Template literal corruption in GodAgent** — Escaped backticks, Linux-only log append | 🟡 Medium | ✅ **FIXED 2026-05-08** | `GodAgent.runAutoresearchLoop()`: full rewrite, Windows-safe |
| 7 | **No token budget enforcement** — Context overflow crashed Ollama silently | 🟡 Medium | ✅ **FIXED 2026-05-08** | `BaseAgent.enforceTokenBudget()`: head+tail truncation with visible banner |
| 8 | **No unit tests** — Pure logic functions had zero coverage | 🟡 Medium | ✅ **FIXED 2026-05-08** | `src/agents/__tests__/`: 27 tests, vitest runner via `npm test` |
| 9 | **App.tsx Monolith** — 100KB single file | 🔴 Critical | ⏳ PENDING (Task 12) | Extract into `src/components/` |
| 10 | **PR Poller not wired** — Phase 4 Cloud Catcher defined but not in live UI | 🟡 Medium | ⏳ PENDING | Wire into DAG tick loop |
| 11 | **fleet.json not validated** — Loading bad JSON crashes the app silently | 🟡 Medium | ⏳ PENDING | Add schema validation on load |
| 12 | **Vite-only backend** — TerminalBridge calls fail silently in production build | 🟢 Low | ⏳ PENDING | Add runtime environment detection |

---

## 8. Security Hardening (Completed 2026-05-08)

| Control | Implementation | Location |
|---|---|---|
| Origin guard | Localhost-only check on all `/api/*` endpoints | `vite.config.ts` |
| Command allowlist | Only `git`, `npm`, `tsc`, `vitest`, `playwright` etc. permitted | `vite.config.ts` |
| Rate limiter | 20 req/min per endpoint, 429 on excess | `vite.config.ts` |
| Path traversal guard | All file paths validated against workspace roots via `isPathInWorkspace()` | `vite.config.ts` |
| Workspace roots | `F:\012A_Github`, `F:\012D_TRADE`, `C:\Users\likha` only | `vite.config.ts` |
