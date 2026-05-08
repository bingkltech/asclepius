# Asclepius Goals

> **Authority:** Subordinate to [MISSION.md](MISSION.md). Goals are measurable milestones.
> **Format:** Each goal MUST have: Size, Project, Success Criteria, Scope, and Status.
> **Parser:** The COO reads `Status: PENDING` entries and decomposes them into DAG Tasks.
> **Last Updated:** 2026-05-08 (Overhaul Session — 8 goals completed)

---

## Active Goals (PENDING — COO Picks These Up)

### GOAL-007: Extract App.tsx Into Component Modules
- **Size:** L
- **Project:** asclepius (self)
- **Success:** `src/App.tsx` is under 500 lines. Each major panel (AgentFleet, ProjectOrchestrator, PipelineMonitor, GitSyncCenter) lives in its own file under `src/components/`. App.tsx is only routing + top-level state.
- **Scope:** `src/App.tsx`, `src/components/` (new files)
- **Status:** PENDING
- **Origin:** Expert audit 2026-05-08

### GOAL-010: Wire the PR Poller (Phase 4 Cloud Catcher)
- **Size:** M
- **Project:** asclepius (self)
- **Success:** When a task enters `waiting_on_pr`, the UI starts a 15-second polling loop that calls `/api/get-branches` on the project's local path, watching for new `jules-*` branches. When detected, task status changes to `pr_detected`. No `gh` CLI or GitHub API involved.
- **Scope:** `src/App.tsx` (or extracted component) + `vite.config.ts`
- **Status:** PENDING
- **Origin:** Architecture spec Phase 4

### GOAL-013: fleet.json Schema Validation
- **Size:** S
- **Project:** asclepius (self)
- **Success:** On app boot, `fleet.json` is validated against the `Worker` TypeScript schema before being loaded into state. Malformed entries are skipped with a visible console warning, not a crash. A `fleet.schema.json` file documents the contract.
- **Scope:** `src/App.tsx` fleet loader + `src/config/fleet.schema.json` (new)
- **Status:** PENDING
- **Origin:** Expert audit 2026-05-08

### GOAL-012: First External Project Build (Mandelbrot Explorer)
- **Size:** XL
- **Project:** `F:\012A_Github\mandelbrot`
- **Success:** Asclepius autonomously builds the Mandelbrot Explorer from a single directive: *"Create an interactive Mandelbrot Set explorer with zoom, color palettes, and a glassmorphic UI"*. No human code changes. DAG executes, files are written, `npm run build` passes, app renders correctly. This proves the system works on external projects.
- **Scope:** External project — `F:\012A_Github\mandelbrot`
- **Status:** PENDING
- **Origin:** Core capability proof-of-concept

---

## Completed Goals (Archive)

### GOAL-006: Separate Agent and Worker Data Models
- **Size:** M | **Status:** ✅ COMPLETED 2026-05-08
- **How:** `category: 'brain' | 'hand'` field added to `Worker` type. `agentBrains` and `workerHands` derived views in `App.tsx`. Heuristic role-based filtering eliminated.

### GOAL-008: CommonSenseGate Wired
- **Size:** M | **Status:** ✅ COMPLETED 2026-05-08
- **How:** `CommonSenseGate` and `MemoryBridge` already existed. Wired gate into `BaseAgent.execute()` — REJECT/SKIP short-circuits before LLM call. `recordSuccess()` feeds MemoryBridge after each task.

### GOAL-009: Memory Layer (MemoryBridge)
- **Size:** M | **Status:** ✅ COMPLETED 2026-05-08
- **How:** `MemoryBridge.ts` already existed with Ollama embedding + cosine similarity + JSON persistence. Wired into `CommonSenseGate.wire()` to enable automatic dedup across sessions.

### GOAL-011: DAG Cyclic Deadlock Validation
- **Size:** S | **Status:** ✅ COMPLETED 2026-05-08
- **How:** `LeadAgent.validateDAG()` implements Kahn's algorithm (BFS topological sort). Ghost reference detection included. `decompose()` throws `[DAG_CYCLE_DETECTED]` on violation. 13 unit tests passing.

### GOAL-014: Token Budget Enforcement
- **Size:** M | **Status:** ✅ COMPLETED 2026-05-08
- **How:** `BaseAgent.enforceTokenBudget()` truncates context to `maxTokens * 3` chars using head+tail strategy. Visible truncation banner appended so agent knows context is partial. 14 unit tests passing.

### GOAL-015: GodAgent Autoresearch Repair
- **Size:** S | **Status:** ✅ COMPLETED 2026-05-08
- **How:** Rewrote `GodAgent.runAutoresearchLoop()` — fixed escaped template literals, replaced Linux `echo -e >>` with `TerminalBridge.writeFile`, fixed `val_bpb` regex, added empty-response guard.

### GOAL-016: 3-Strike Revision Enforcement
- **Size:** S | **Status:** ✅ COMPLETED 2026-05-08
- **How:** `LeadAgent.tick()` resets failed tasks to `pending` up to `maxRetries`. On 3rd strike, marks `blocked` and surfaces for human intervention. Plan status correctly transitions to `failed` if any tasks permanently blocked.

### GOAL-017: Unit Test Suite
- **Size:** M | **Status:** ✅ COMPLETED 2026-05-08
- **How:** vitest installed, `npm test` script added. 27 tests across `LeadAgent.test.ts` (13) and `BaseAgent.test.ts` (14). All passing. Pre-existing broken `OllamaManager.test.ts` documented and skipped with TODO.

---

## Completed Goals (Archive)

### GOAL-001: Unit Test Coverage for Core Tools
- **Size:** M | **Status:** ✅ COMPLETED

### GOAL-002: Dashboard Widget Shows Full Telemetry
- **Size:** S | **Status:** ✅ COMPLETED

### GOAL-003: Identity Kernel Loaded at Boot
- **Size:** S | **Status:** ✅ COMPLETED

### GOAL-004: README Reflects Current Architecture
- **Size:** S | **Status:** ✅ COMPLETED (re-done in this overhaul — 2026-05-08)

### GOAL-A01: Glassmorphic Settings Panel for Mandelbrot
- **Size:** S | **Project:** `F:\012A_Github\mandelbrot` | **Status:** ✅ COMPLETED

### GOAL-A02: Hero Section for QuoQuo-Ten
- **Size:** S | **Project:** `F:\012A_Github\QuoQuo-Ten` | **Status:** ✅ COMPLETED

---

## Failed Goals (Post-Mortem)

### GOAL-005: Ollama Not Responding
- **Size:** S | **Status:** ❌ FAILED
- **Origin:** Hermes OODA observation at 2026-05-07T09:14:24.296Z
- **Post-Mortem:** Infrastructure issue — Ollama service not running. OllamaManager.selectBestModel() needs health-check retry logic before raising the alarm.

### GOAL-F01: Self-Heal + Redesign (Compound Goal)
- **Status:** ❌ FAILED
- **Post-Mortem:** Violated scope sanity — 3+ independent objectives in one directive. CommonSenseGate would reject this as a compound goal. Split into discrete goals first.

---

## Goal Format Reference

```markdown
### GOAL-NNN: [Clear, specific title]

- **Size:** S/M/L/XL
- **Project:** [local path or "asclepius (self)"]
- **Success:** [concrete, testable, binary criteria — "the test passes" not "it's better"]
- **Scope:** [exactly which files are in scope — prevent scope creep]
- **Status:** PENDING | IN_PROGRESS | COMPLETED | FAILED | BLOCKED
- **Origin:** [Hermes OODA observation | Human directive | COO proposal] at [timestamp]
```
