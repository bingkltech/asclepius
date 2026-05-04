# Asclepius Command Center

Asclepius is a local, UI-driven command center for orchestrating autonomous development tasks. 

## The Core Architecture: Brains vs. Seats

Asclepius operates on a strict **Resource-Oriented Workforce** model. The most critical rule of the system is the absolute separation of Intelligence from Execution.

*   **Agents (Intelligence Brains):** 
    Pure AI profiles. They define *how* to think and hold the intelligence context (Skills). They possess the LLM API credentials (e.g., Gemini, Claude, local Ollama). Agents do NOT possess tool execution accounts (like GitHub or `jules.google.com`).
    *Example:* The "God Agent", "COO/Lead Agent", or a custom "Senior React Developer".

*   **Workers (Execution Seats / Adapter Keepers):** 
    Persistent, named identities (e.g., James, Athena). Workers are *not* AIs — they have **zero intelligence**. They are strictly dumb adapters that hold a tool's URL endpoint and auth token. 
    *   *The Strict No-Fallback Rule:* Workers are mapped 1-to-1 with their tool. If a Worker is assigned a task, it *must* execute it via its configured endpoint. It is never permitted to secretly fallback to a local LLM to write code. If the tool fails, the task crashes.
    *   Their hardcoded duties include **Proactive Throttling** (pacing payloads via an internal metronome) and **Power State Management** (auto-hibernating when quotas are exhausted, auto-waking when limits reset).

## The Asclepius Unified Workflow (The Golden Loop)
Asclepius operates on a hardened, asynchronous, multi-worker Event Loop driven by a strict Directed Acyclic Graph (DAG):
1. **Phase 1 — Blueprinting:** The God Agent scans the target repository, generates the global `SKILL.md`, and passes it to the Lead Agent (COO).
2. **Phase 2 — DAG Construction:** The COO granularizes the directive into a task graph with explicit dependencies. _Safeguards: Cyclic Deadlock validation, File Path Recon against the real directory tree, and Skill Prompt injection into each task payload._
3. **Phase 3 — The Deterministic Queue:** The COO drops task payloads into a data queue — it never "talks" to Workers (saving LLM tokens). Unintelligent Workers pull from the queue and self-manage execution. _Safeguards: Proactive Throttling via internal `throttleMs` metronome; Power State management (ONLINE / SLEEP / HIBERNATING) with auto-wake based on `X-RateLimit-Reset` headers._
4. **Phase 4 — The Waiting Room (The Cloud Catcher):** The COO yields execution and enters an asynchronous waiting state (`[waiting_on_pr]`). 
    *   *The Offline Catcher Pattern:* Asclepius never connects to GitHub Cloud directly via the `gh` CLI. Instead, it periodically forces the local system to `git fetch` and uses a Native Filesystem Parser to watch the `.git/refs/remotes/origin` folder. Once GitHub Desktop syncs the cloud PR, Asclepius checks it out locally and resumes the pipeline.
5. **Phase 5 — Sandbox Verification:** PR detected and checked out locally. The COO isolates the environment (clean state) and runs Static then Dynamic tests. _Safeguard: 3-Strike Revision Loop — errors are sent back through the Worker for retry; after 3 failures the task is marked [BLOCKED] and escalated to the human._
6. **Phase 6 — Rebase, Merge & Cache Bust:** The COO rebases the PR branch against the latest `main` to prevent stale conflicts. On clean merge, an immediate `SKILL.md` cache-bust re-scans the codebase before the next DAG task is unlocked.

## Current Application Features (dev_asclepius)

1. **The Dashboard (Vite/React):**
   A premium, dark-mode futuristic UI that serves as the central hub for managing your workforce and projects.

2. **Agent Fleet Forge:**
   A dedicated interface exclusively for managing Intelligence Brains.
   *   **The GOD AGENT:** Protected at the top of the roster, representing the core orchestrator.
   *   **Core Intelligence Engine Selector:** One-click switching between Gemini, Claude, OpenAI, and local Ollama.
   *   **Forge New Brains:** Ability to register new Agents by defining their Specialized Role and custom System Instructions.
   *   **Worker Power Controls:** Each Execution Seat has an interactive Adapter Status panel with Power State toggle (ONLINE/SLEEP/HIBERNATE) and a Proactive Throttle slider.

3. **Project Orchestrator:**
   A module to track multiple local repositories (Asclepius, DeerFlow, Mandelbrot Explorer) and manage the specific "Project Team" assigned to each repo.
   *   **Lead Agent Chat:** A live conversation interface to issue directives to the COO. Directives are decomposed into a DAG of tasks via the configured LLM.
   *   **Smart Task Assignment:** Tasks are auto-assigned to Execution Seats (Workers) based on skill-matching — never to Intelligence Brains.
   *   **Per-Project Persistence:** All conversations and DAG tasks are saved as JSON files inside each project's `.asclepius/` directory, surviving across branches and sessions.

4. **LLM Infrastructure & Offline Polling:**
   *   **Server-Side Proxy (`/api/llm-proxy`):** All LLM calls are routed through the Vite backend to avoid CORS.
   *   **Strict Failover Boundaries:** Intelligence Brains (planning) can automatically fallback to local Ollama. Execution Seats (coding) strictly fail if their API drops, never secretly substituting a tool.
   *   **The PR Poller Loop:** Actively syncs asynchronous Cloud Worker code (like Google Jules PRs) directly into the local sandbox via standard Git fetching, completely bypassing the need for cloud-connected CLIs.

## Core Integrations

Asclepius utilizes two primary intelligence-gathering tools to feed context into the Agents:

1. **Graphify Architecture Access:**
   Used by the COO / Lead Agent to understand the entire codebase structure. It compiles a Knowledge Graph mapping cross-file context, giving the Agent a complete architectural overview without reading every file linearly.

2. **Skill Seekers (`skill-seekers`):**
   Integrated to provide Agents with specialized "Skills." Instead of bloating the System Prompts with massive documentation, Agents use Skill Seekers to inject framework-specific knowledge and best practices directly into their reasoning context.

## Future Capabilities: The God Agent Self-Healing Workflow
While the Unified Workflow Engine actively manages token economy and mitigates Git/Sandbox edge cases, unforeseeable failures are inevitable in autonomous systems. 
* **The Meta-Architect Loop:** In the future, the entire Phase 1-6 workflow execution (including failure logs, 3-Strike revision outcomes, and API timeouts) will be continuously streamed back to the **God Agent**.
* **Autonomous Evolution:** The God Agent will monitor the performance of the COO and the Workers. By learning from edge cases and creating new structural knowledge, the God Agent will proactively suggest architectural upgrades and workflow optimizations, creating a truly self-healing development platform.

---
*(This README reflects only the currently implemented features and strict definitions as of the `dev_asclepius` branch.)*
