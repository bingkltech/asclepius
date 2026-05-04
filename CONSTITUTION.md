# The Asclepius Constitution

This document defines the unalterable architectural laws of the Asclepius Command Center. Any code written for this project must strictly adhere to these rules.

## Article I: The Hierarchy of Orchestration

The system operates on a strict top-down delegation structure to maintain modularity:

1.  **The GOD AGENT:** Sits protected at the absolute top of the hierarchy. Its _only_ role is to Forge and configure new Agents (Intelligence Brains). It does not decompose tasks or execute code. It cannot be deleted.
2.  **The COO / Lead Agent:** The operational director. It receives the high-level project goal and is strictly responsible for decomposing that goal into granular tasks.
3.  **The Agents (Brains):** The specialized intelligence profiles (e.g., Senior Frontend Dev, QA). They receive tasks from the COO, and they autonomously _choose_ which Worker (Execution Seat) has the required tools to execute the task.

## Article II: Strict Decoupling of Brains and Seats

The greatest architectural sin is conflating Intelligence with Execution. Asclepius utilizes a strict **Resource-Oriented Workforce** model:

1.  **Agents (The Brains):** Pure intelligence profiles. They define _how_ to think (System Instructions) and hold the intelligence context (**Skills** via Skill Seekers). They possess the **LLM API credentials and endpoints** (e.g., paid Gemini, Claude). *Exception:* Intelligence Brains (like the Lead Agent) ARE explicitly permitted to fall back to a local LLM (like Ollama) to decompose tasks if primary cloud APIs are unavailable.
2.  **Workers (The Seats / Adapter Keepers):** Persistent, named execution accounts (e.g., James, Athena). **Workers have ZERO intelligence.** A worker is strictly a dumb adapter that holds a URL (endpoint) and a token for a specific Tool (like the Jules API). 
    - **The Strict No-Fallback Rule:** Workers are strictly 1-to-1 with their tool. If Jules is assigned to write code, ONLY Jules writes code. A Worker is NEVER permitted to silently fall back to a local LLM (like Ollama) to execute a coding task. If the tool fails or disconnects, the task crashes and the worker is frozen.
    - **The Cloud Catcher Pattern (Future Upgrade):** Because Cloud Workers (like Jules) operate asynchronously, the Orchestrator must NEVER mark a task as `[completed]` just because the Cloud API returned `200 OK`. The task enters `[waiting_on_pr]`. However, **Asclepius must NEVER use the GitHub CLI (`gh`) or connect directly to GitHub Cloud APIs to check for PRs.** Asclepius is strictly a local orchestrator. It must monitor the local `.git/refs/remotes` folder and command the local git system to fetch updates (`git fetch`) at a reasonable interval to force the sync down to the local hard drive.
3.  **The Skill Distribution Pipeline:** Skills and intelligence are passed down hierarchically, never generated at the bottom:
    - **God Agent** injects the global repository `SKILL` into the **COO / Lead Agent**.
    - **COO / Lead Agent** decomposes tasks and injects the specific **SKILL PROMPTS** directly into the granular task payload.
    - **The Cloud Engine (e.g., jules.google):** When the task payload routes through the Worker (James) and reaches the remote execution endpoint, it arrives fully loaded with the exact instructions and proper skills. The cloud tool knows exactly what to do without needing further human or AI intervention.

> **The Violation Test:** If a Worker silently delegates its coding task to Ollama, or if the Orchestrator marks a Cloud API task as completed before pulling the remote PR to the local sandbox, you have critically violated Article II.

## Article III: UI Honesty

The application Dashboard must explicitly separate Agents from Workers visually and structurally. They must never be conflated in a single ambiguous list.

- The "Agent Fleet" forge is strictly for creating and configuring AI Brains.
- The "Projects" tab is where Workers are deployed into Teams.

## Article IV: Stateless Persistence

The local application relies entirely on browser `localStorage` (via custom `usePersistentState` hooks). The dashboard must remain highly responsive and completely independent of external databases until absolutely necessary.

## Article V: The Asynchronous Workflow Laws

To seamlessly scale from a single-worker to a multi-worker fleet, Asclepius orchestrates via a hardened Event Loop governed by the following unalterable laws:

1. **The DAG Dependency Manager:** The COO must strictly enforce task dependencies and perform Deadlock Detection before starting. Task B cannot be assigned until Task A's Pull Request is fully tested, merged, and committed to the main branch.
2. **Stateless Routing & Concurrency:** Workers (Execution Seats) are merely adapter keepers. The COO can assign multiple parallel tasks, but must enforce a Dispatch Concurrency Cap to protect external API rate limits.
3. **The Isolated Sandbox Coordinator:** The COO must never blind-merge. All remote-pushed PRs must be checked out locally into a "Clean State" Sandbox. Tests are split into Static (compile) and Dynamic (run). Failed tests execute a 3-Strike Revision Loop back to the Worker before being marked [BLOCKED].
4. **The Stale Branch Rebase Protocol:** To prevent parallel multi-worker Git conflicts, the COO MUST rebase incoming PR branches against the absolute latest `main` branch before testing or merging.
5. **The Mandatory Cache-Bust:** Immediately after successfully merging a task's PR, the COO _must_ trigger a codebase re-scan (via SkillSeekers/Graphify) to ensure the next task in the DAG is planned using the updated codebase reality.

## Article VI: The Duty of Pushback
Any AI operating within this repository is strictly forbidden from blindly agreeing with the User if the User's proposal introduces architectural flaws, breaks the decoupling of Brains and Seats, or degrades the token economy. The AI MUST proactively challenge the User, explicitly state why the idea is a mistake, and propose a mathematically or structurally superior alternative before writing any code.

## Article VII: The Boundary Between Law and Heuristics (Resolving Collision)
To resolve any future collision between the Constitution and Agent instructions:
1. **The Constitution (The Red Lines):** This document represents the absolute, immutable, and non-negotiable bounds of the system. An agent can *never* override these laws, regardless of how optimal or "best-case scenario" an alternative may seem.
2. **The Agents (The Dos and Don'ts):** Agents (specifically the God Agent) are empowered to define dynamic execution strategies, contextual "dos and don'ts", and coding heuristics based on the specific scenario at hand. 
3. **The Enforcement Protocol:** The God Agent MUST physically load and evaluate the Constitution during its Blueprint generation to ensure its dynamic advice never breaches the Red Lines. Dynamic optimization is encouraged, but it must operate strictly within the walled garden of these Constitutional laws.
