# Asclepius Context Map & Architecture Guide

This document maps the technical implementation of the Asclepius Command Center as it exists in the `dev_asclepius` branch.

## 1. Tech Stack

- **Frontend:** Vite, React, TypeScript.
- **Styling:** Tailwind CSS (Dark Mode, Glassmorphism, Zinc/Emerald palettes).
- **Icons:** Lucide-React.
- **State Management:** Custom `usePersistentState` hook (binds React state to browser `localStorage`).

## 2. Core Directory Structure

```text
f:\012A_Github\asclepius\
├── src/
│   ├── main.tsx              # React mounting point (Force remounts done here)
│   ├── App.tsx               # The Monolithic Dashboard (Routing, State, UI)
│   ├── config/
│   │   └── fleet.json        # Initial roster state (God Agent + Workers)
│   ├── services/
│   │   └── ProjectStore.ts   # Per-project filesystem persistence
│   └── index.css             # Tailwind directives
```

### Per-Project Data (auto-created inside each managed repo):
```text
{projectPath}/.asclepius/
├── conversations.json   # Full Lead Agent chat history (survives branch switches)
├── dag-tasks.json       # Current and historical DAG task state
└── settings.json        # Project-level settings (team, branch configs)
```

## 3. Data Models (App.tsx)

The UI state currently relies on shared types that must be carefully handled to avoid conflation.

- **`Worker` Type:** Currently acts as the base object for both Agents and Workers in the state array.
  - _Agents_ are identified by `w.role === 'God-Agent'` OR by possessing a `w.systemPrompt`.
  - _Workers_ are identified by possessing external credentials/endpoints and lacking a system prompt.
- **`Project` Type:** Tracks `id`, `name`, `localPath`, and `assignedWorkerIds` (the Project Team).

## 4. Known Pitfalls & Development Lessons

1.  **HMR State Caching:** Vite's Hot Module Replacement preserves React state across reloads. If you change a `usePersistentState` key to invalidate a cache, the browser will NOT pick up the new default value unless the user performs a hard refresh (F5), or you force a component remount by updating the `key` prop on `<App />` in `main.tsx`.
2.  **The Conflation Trap:** Never blindly `.map()` over the global `workers` array in the UI. Because Agents and Workers currently share the same array, rendering them in the same list will cause extreme UX confusion. Always filter them explicitly:
    - `workers.filter(w => w.role === 'God-Agent' || w.systemPrompt !== undefined)` -> Intelligence Brains.
    - `workers.filter(w => w.role !== 'God-Agent' && w.systemPrompt === undefined)` -> Execution Seats.
3.  **Data Deletion:** Do not "clean up" the UI by deleting objects from the global state array, as they may be actively referenced in other tabs (e.g., Projects). Always use UI filters to manage visibility.

## 5. The Unified Workflow Engine (Hardened State Machine) — FINALIZED

The execution of autonomous tasks operates as an Asynchronous State Machine built to withstand API drops, Git conflicts, LLM hallucinations, and billing exhaustion.

### Phase 1 — Blueprinting (Actor: God Agent)
The God Agent scans the target repository via SkillSeekers/Graphify, generates the global `SKILL.md` knowledge map, and injects it into the Lead Agent (COO). The COO now has full architectural awareness of the project.

### Phase 2 — DAG Construction (Actor: COO / Lead Agent)
The COO decomposes the high-level directive into a **Directed Acyclic Graph (DAG)** of hyper-granular tasks with explicit dependencies. Each task payload includes the exact file paths, the injected `SKILL PROMPT`, and the dependency chain.
*   _Safeguard 1:_ **Cyclic Deadlock Validation** — The DAG is validated before dispatch to ensure no task depends on itself.
*   _Safeguard 2:_ **File Path Recon** — Every file path referenced in a task is cross-checked against the real project directory tree to prevent hallucinated targeting.

### Phase 3 — The Deterministic Queue (Actor: COO drops, Workers pull)
To preserve the **Token Economy**, the COO never "talks" to a Worker. The COO simply drops the task payload into a data queue. Unintelligent Worker Adapters independently pull from the queue and self-manage execution.
*   _Safeguard 1:_ **Proactive Throttling** — Workers use an internal `throttleMs` metronome to smoothly pace payloads at the exact maximum speed the API allows, completely preventing HTTP 429 (Too Many Requests) errors before they happen.
*   _Safeguard 2:_ **Power State Auto-Management** — Workers manage three hardcoded power states without AI involvement:
    *   `ONLINE` — Tool is healthy. Worker pulls and fires payloads.
    *   `SLEEP` — Temporary cooldown (e.g., minor rate spike). Worker pauses for a short interval, then auto-resumes.
    *   `HIBERNATING` — Quota fully exhausted (HTTP 403/402). Worker reads the `X-RateLimit-Reset` header, physically disconnects from the queue, and sets a timer to auto-wake at the exact reset timestamp.

### Phase 4 — The Waiting Room & Cloud Catcher (Actor: COO, active listener)
The COO yields execution and places the task into `[waiting_on_pr]`. To catch asynchronous Cloud PRs (like Jules) without connecting to the internet via CLI, the Orchestrator initiates an offline PR Poller:
*   _Safeguard 1:_ **The Offline Git Catcher** — Every 15 seconds, the Orchestrator forces a local `git fetch` and uses the native Vite Filesystem parser to check `.git/refs/remotes/origin/jules-*` for new branches, completely bypassing the `gh` CLI.
*   _Safeguard 2:_ **Timeout Protocol** — If no PR arrives within a reasonable timeout, the task is marked `[FAILED: TIMEOUT]`. Once caught, the code is locally checked out (`git checkout`) so the sandbox has the files before moving to Phase 5.

### Phase 5 — Sandbox Verification (Actor: COO, active)
The PR is detected and checked out locally. The COO isolates the environment (cleans dirty state, purges `node_modules`) and runs a two-stage test:
1.  **Static Analysis:** `tsc --noEmit` and `npm run lint`. If this fails, the PR is instantly rejected without wasting Dynamic test resources.
2.  **Dynamic Test:** `npm run dev` / `npm run build` / `npm run test`. Validates runtime behavior.
*   _Safeguard:_ **3-Strike Revision Loop** — On failure, the error log is packaged and sent back through the Worker for Jules to retry. After 3 consecutive failures, the task is marked `[BLOCKED]` and escalated to the human Watcher.

### Phase 6 — Rebase, Merge & Cache Bust (Actor: COO)
Before merging, the COO executes `git rebase main` on the PR branch to resolve any stale parallel conflicts introduced by other Workers completing tasks on the same codebase.
*   On **clean rebase + merge**: The COO triggers an immediate `SKILL.md` cache-bust (re-scanning the codebase via SkillSeekers/Graphify) to ensure the next DAG task is planned against the absolute latest codebase reality.
*   On **rebase conflict**: The conflict diff is packaged and sent back through the Worker as a Revision Task.

### Phase 7 — Meta-Learning Feedback (Actor: God Agent) [FUTURE]
The entire Phase 1–6 execution log (including failure logs, 3-Strike outcomes, API timeouts, and Worker hibernation events) is streamed back to the God Agent. The God Agent analyzes patterns, creates new structural knowledge, and proactively suggests workflow optimizations — creating a truly self-healing development platform.
