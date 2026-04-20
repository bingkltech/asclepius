# 📜 The Asclepius Constitution — Immutable Architectural Law

> **VERSION:** v1.1 · **RATIFIED:** 2026-04-18 · **AMENDED:** 2026-04-18  
> **PURPOSE:** This document defines the non-negotiable architectural principles governing the Asclepius system. Every feature, every agent, every line of code must comply with these articles. When in doubt, consult this Constitution. If a proposed change violates an article, the change is rejected — not the article.

---

## Preamble

Asclepius exists to solve one problem: **Autonomous software delivery at scale without destroying the machine it runs on.**

It achieves this by embodying a single, radical insight: **The application is the mind; the cloud is the muscle.** Asclepius thinks, plans, delegates, and verifies. External cloud workers (`jules.google`, Gemini API, future LLM providers) perform the raw cognitive labor. The local machine never bears the burden of inference.

---

## Article I — The Cognitive Management Plane

**Asclepius embodies the "God-Agent" (The Strategic Mind), but offloads inference compute to the cloud.**

While Asclepius performs high-level cognitive work — strategic planning, task decomposition, PR verification, and fleet management — the actual neural processing (inference) is offloaded to cloud APIs (`jules.google`, Google Gemini). The local application acts as a **Cognitive Control Plane**: it curates context, manages the Slow Loop, and executes file/Git operations locally.

This means:
- **The app's primary job is Management Quality, not raw compute.** The most complex code in Asclepius should be context window management, prompt engineering, and state orchestration — not neural inference.
- **The app's resource footprint must remain lightweight.** CPU and memory usage should be minimal during idle and moderate during active orchestration. If the app is consuming excessive resources, the architecture has drifted from this article.
- **The God-Agent IS the app.** The God-Agent is not a chatbot persona — it is the cognitive embodiment of Asclepius itself, using cloud APIs as its external brain to reason about the system it governs.

> **Test:** "Can a mid-range laptop run Asclepius with 10 concurrent agents for 24 hours without crashing?" If the answer is no, Article I is violated.

---

## Article II — The Resource-Oriented Architecture (Brains vs. Seats)

**An Agent is NOT a Worker. A Worker is NOT an Agent.**

The greatest architectural sin is conflating the intelligence with the executor. Asclepius strictly separates these concepts into the Resource-Oriented Workforce model:

### 1. Agents (The Brains)
The AI profiles. They contain the LLM provider configuration (Gemini, Claude, Ollama), the System Prompts, and the cognitive capabilities (Skills). 
*   **The God Agent** is the supreme orchestrator. It sits alone in the Agent Fleet initially, holding absolute authority.
*   More Agents (e.g., "Senior Frontend Dev") can be added to the Agent Fleet, but they possess no execution tools of their own.

### 2. Workers (The Seats / Identities)
Workers are persistent, named accounts (e.g., Athena, Artemis, James, Jasmine). They are not AIs. They are "seats" that can hold external credentials.
*   **A worker is an Identity.** James might be a `jules.google.com` account. Jasmine might be a CapCut API account.
*   Workers execute tasks by "wearing" an Agent Brain. 

### 3. Tools (The Hands)
The specific software endpoints and applications that Workers are authorized to use.
*   Examples: `jules.google` API, CapCut, Figma, Local Terminal, Browser.

### 4. Skills (The Knowledge)
Skill Seekers (`skill-seekers` python CLI) pre-compiles framework documentation into `.skill.md` assets. These are injected into an Agent's context window to provide instant domain expertise without permanent token bloat.

### 5. Graphify (The Map)
The underlying system that parses your local codebase to build a semantic Knowledge Graph, allowing the God Agent to understand cross-file dependencies and architecture before deploying Workers.

### Execution Flow
1. **God Agent** receives the goal and decomposes it.
2. It realizes it needs to edit a video. It selects the **Video Editor Agent** (Brain).
3. It assigns that Brain to **Jasmine** (Worker) because Jasmine possesses the **CapCut** (Tool).

> **Test:** "If you want to switch James from using Gemini to Claude, do you have to delete James?" If the answer is yes, Article II is violated. James is just a seat; the Brain is dynamically swappable.

---

## Article III — The Slow Loop Execution Engine

**Stability over raw speed. Always.**

Agentic loops can quickly overwhelm APIs (429 Rate Limits), exhaust memory, and hallucinate due to context degradation. To prevent this, Asclepius enforces a **Slow Loop** — a deliberately paced execution rhythm.

### The Three Pillars of the Slow Loop

#### 1. State-Backed Queueing
- The COO drops micro-tasks into a **persistent, disk-backed queue** (localStorage / IndexedDB / encrypted config).
- If the app crashes, it resumes exactly where it left off. No task is ever lost.
- Tasks are processed sequentially, never in parallel bursts that spike CPU.

#### 2. Deliberate Pacing
- The system intentionally **sleeps** between complex API calls and Git operations.
- Minimum 5-second gap between sequential LLM calls to the same provider.
- Minimum 3-second gap between sequential GitHub API calls.
- These delays are not bugs — they are architectural safeguards.

#### 3. Memory Flushing (Agent Lifecycle)
- Worker agents are **instantiated** for a single task scope.
- Upon task completion, the worker agent's context is **flushed** (garbage collected).
- A fresh worker with a clean context window is instantiated for the next task.
- This prevents context window pollution, memory leaks, and progressive hallucination.

### The Timer Registry (Enforcement)

| Timer | Interval | Purpose |
|---|---|---|
| Heartbeat | 3,000ms | Agent liveness detection |
| Agent Simulation | 8,000ms | Metric fluctuation + activity |
| Task Scheduler | 5,000ms | Check and execute queued tasks |
| Recovery Watchdog | 15,000ms | Auto-restart dead agents |
| Health Regen | 30,000ms | Passive HP regeneration |

> **INVARIANT:** The heartbeat (3s) MUST be faster than the watchdog (15s). The watchdog must never run before the heartbeat has had multiple chances to detect failure.

> **Test:** "Can the system run all agents for 8 hours without any 429 rate limit errors, without exceeding 2GB RAM, and without any agent producing hallucinated output?" If the answer is no, Article III is violated.

---

## Article IV — The Autonomous Delivery Pipeline (God-Agent → Jules → Sandbox → Main)

**Code flows in one direction: from granular task definition to verified production merge.**

This is the closed-loop autonomous delivery pipeline. The God-Agent orchestrates the entire flow:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        THE LEAN DELIVERY PIPELINE                       │
│                                                                         │
│  ① God-Agent receives Project Goal                                      │
│                              │                                          │
│                              ▼                                          │
│  ② God-Agent granularizes Goal into Tasks                               │
│                              │                                          │
│                              ▼                                          │
│  ③ God-Agent delegates tasks in parallel to Jules (Cloud Workers)       │
│    ├──► Account 1 (Jules) ──► Task A                                    │
│    ├──► Account 2 (Jules) ──► Task B                                    │
│    └──► Account N (Jules) ──► Task C                                    │
│                              │                                          │
│                              ▼                                          │
│  ④ Jules generates code (CLOUD COMPUTE) and pushes to branches          │
│                              │                                          │
│                              ▼                                          │
│  ⑤ God-Agent pulls branches via Git / GitHub Desktop                    │
│                              │                                          │
│                              ▼                                          │
│  ⑥ God-Agent runs Sandbox tests locally (build, lint, run)              │
│                              │                                          │
│                       ┌──────┴──────┐                                   │
│                       │             │                                   │
│                    PASS           FAIL                                  │
│                       │             │                                   │
│                       ▼             ▼                                   │
│               ⑦ God-Agent       ⑧ God-Agent rejects branch,             │
│                 merges to main    creates fix task for Jules            │
│                       │             │                                   │
│                       │             └──── loops back to ③               │
│                       ▼                                                 │
│               ⑨ Next task in queue                                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Pipeline Rules

1. **Jules NEVER merges directly to main.** Only the God-Agent can approve a merge after Sandbox verification.
2. **Failed Tests generate new tasks automatically.** The error output from the Sandbox is captured, parsed, and fed back to Jules as a new fix task — creating a self-healing loop.
3. **Parallel Delegation.** The God-Agent must utilize multiple Jules accounts to execute granular tasks in parallel, drastically reducing project delivery time.

> **Test:** "Can the system autonomously deliver a 10-task project to a GitHub repository over 2 hours, with zero manual intervention, and all code passing Sandbox tests?" If the answer is no, Article IV is violated.

---

## Article V — The Verifier Sandbox

**Trust, but verify. No code reaches production without automated validation.**

The Sandbox is not optional. It is the system's immune system.

### Verification Protocol

1. **Isolation:** The Sandbox operates in an isolated directory (`/test-projects/sandbox` or project-scoped directory). It never pollutes the main working tree.
2. **Automated Testing:** On every PR branch pull, the Sandbox executes: `npm install` → `npm run build` → `npm run lint` → `npm run test` (if available).
3. **Error Classification:** All failures are parsed into structured `SandboxError` objects with severity (`critical` / `warning`), file path, line number, and column.
4. **Agent Routing:** Errors are automatically routed to the best-fit agent using `findBestAgent()` skill matching (security bugs → security-skilled agents, logic bugs → analysis-skilled agents).
5. **Cross-Verification:** The COO can optionally send the Sandbox results to `antigravity.google` (a separate AI verifier) for an independent second opinion before merging.

### Sandbox ↔ Pipeline Integration

| Sandbox Output | Pipeline Action |
|---|---|
| ✅ All tests pass, 0 errors | COO merges PR to main |
| ⚠️ Warnings only | COO merges with warning logged |
| ❌ Critical errors | COO rejects PR, creates fix tasks |
| 💀 Build fails completely | COO rejects PR, escalates to God-Agent |

> **Test:** "Can the Sandbox catch a broken import, a type error, and a missing dependency — and autonomously generate fix tasks for each?" If the answer is no, Article V is violated.

---

## Article VI — Distributed Power, Local Management

**The compute is outside. The intelligence is here. Every agent connects directly to the cloud through its own identity.**

This is the foundational economic principle of Asclepius:

| Responsibility | Where It Happens | Why |
|---|---|---|
| **Neural inference** (code generation, reasoning) | ☁️ Cloud (`jules.google`, Gemini API) | GPU-intensive, scales infinitely |
| **jules.google instances** (cloud coding tasks) | ☁️ Cloud (per agent's own account) | Each agent creates its own instances |
| **Context preparation** (prompt engineering) | 💻 Local (Asclepius) | Requires deep system knowledge |
| **File system operations** (read/write/git) | 💻 Local (Asclepius) | Cloud cannot touch local disk |
| **Auth orchestration** (token refresh, health) | 💻 Local (Jules-Bridge) | Keeps all agent sessions alive |
| **Quality assurance** (Sandbox testing) | 💻 Local (Asclepius) | Tests must run against real project files |
| **State management** (task queues, agent health) | 💻 Local (Asclepius) | Single source of truth for orchestration |

### Every Agent Has Direct Cloud Access

Unlike traditional architectures where a single gateway bottlenecks all cloud requests, in Asclepius **every agent connects to the cloud through its own Google Identity** (Article II). There is no single point of failure:

```
God-Agent     ──► (own OAuth) ──► jules.google instance  ──► Gemini API
COO-Agent     ──► (own OAuth) ──► jules.google instance  ──► Ollama (local)
Healer-01     ──► (own OAuth) ──► jules.google instance  ──► Gemini API
Worker-05     ──► (own OAuth) ──► jules.google instance  ──► Gemini API
```

Jules-Bridge's role is **Auth Orchestrator** — it monitors all agent sessions, refreshes expiring tokens, and reports connection health. It does NOT bottleneck cloud requests.

### What the App Does NOT Do
- ❌ Run neural networks locally (unless Ollama fallback is active)
- ❌ Store credentials in plaintext
- ❌ Allow cloud workers to directly access the local file system
- ❌ Route all cloud requests through a single gateway agent

### What the App MUST Do
- ✅ Curate perfect context windows for every cloud API call
- ✅ Route each agent's credentials from the encrypted vault to the correct process
- ✅ Execute file writes and Git operations on behalf of cloud workers
- ✅ Verify all cloud-generated code in the Sandbox before merging
- ✅ Maintain the persistent task queue across crashes and restarts
- ✅ Keep all agent OAuth sessions alive via Jules-Bridge's token refresh service

> **Test:** "If the internet goes down, does the app gracefully degrade to local Ollama models without losing state? Can 5 agents each maintain independent jules.google sessions simultaneously?" If the answer is no, Article VI is violated.

---

## Article VII — The Lookback-Forward Doctrine

**No agent acts without full context. No task is monolithic. Every action feeds the next cycle.**

The Lookback-Forward Strategy is the operational doctrine embedded in every agent interaction:

```
LOOKBACK    → Read full context (logs + history + fleet + projects + sandbox)
COMPREHEND  → Map the landscape, understand what needs to happen next
GRANULIZE   → Decompose into atomic, single-agent, time-bounded tasks
FORWARD     → Execute one task, log the result, feed it back into LOOKBACK
```

### Enforcement in Code
- **Every LLM call** receives a system context string containing: fleet status, active projects, sandbox health, recent logs, and chat transcript.
- **Every completed task** generates a log entry that becomes input for the next LOOKBACK cycle.
- **No task description** may exceed 500 characters. If it does, it must be decomposed further.

> **Test:** "Does every agent response demonstrate awareness of the current fleet state, active projects, and recent errors?" If the answer is no, Article VII is violated.

---

## Article VIII: The Golden Path SOP (GitOps & Autonomous Production)

**The core directive:** Agents must never merge untested code directly into production. The system relies on a secure, verifiable, and sovereign Git pipeline for continuous autonomous development.

## Article VIII: The Lean Orchestrator (Single-Agent Doctrine)

**There is no internal fleet. There is only the God-Agent orchestrating external Cloud Workers.**

Asclepius has evolved from a simulated multi-agent chat room into a lean, single-agent backend orchestrator. Internal agent communication (Command Center chat) is eliminated as overhead. 

### The God-Agent (Lead Architect & Verifier)
The God-Agent is the single locus of control within Asclepius. It holds all credentials, controls all tools, and acts as the Lead Developer.
*   **Role:** Project Planning, Task Granularization, Delegation, and Quality Assurance.
*   **Capabilities:** 
    *   Breaks down complex project goals into granular, independent tasks.
    *   Controls multiple external identities (Gmail accounts / Jules access tokens).
    *   Operates GitHub Desktop / Git CLI for version control.
    *   Runs the local Sandbox testing environment.

### The Cloud Workers (Jules)
The "workers" are no longer internal Asclepius agents. They are stateless, specialized instances of Google's `jules.google.com` (Jules).
*   **Role:** Raw Code Generation and Heavy Compute.
*   **Capabilities:**
    *   The God-Agent delegates tasks in parallel to multiple Jules instances via different authenticated accounts.
    *   Jules acts as the pure "muscle", executing the coding tasks and submitting code.

### Enforcement in Code
- **Whitelisted Backend Commands:** The `/api/git/exec` endpoint strictly blocks destructive bash commands (`rm`, `del`, arbitrary scripts). It only allows specific `git` operations.
- **Merge Restrictions:** The `mergeBranch` function in `src/services/gitOps.ts` explicitly blocks any agent without the `git_merge` skill from executing a merge.

> **Test:** "Are all commits on GitHub attributed to the unique `[name].agent@gmail.com` identities rather than a generic bot? Are merges strictly controlled by the God-Agent?" If the answer is no, Article VIII is violated.

---

## Article IX: The Zero-Human Corporate Hierarchy (Project vs. Self)

**The system strictly segregates external Client Project code from internal Asclepius Self Code to eliminate the Ouroboros Problem.**

Asclepius operates as a Zero-Human Corporate Office. There are two distinct, parallel tracks of development:

### 1. Track 1: Client Projects (The Company Output)
- **Scope:** External repositories/folders assigned as Active Projects.
- **Workforce:** The COO-Agent and Employee Agents (Healer, Dev, etc.).
- **Protocol:** Workers are strictly sandboxed to project folders. They execute tasks, write code locally or via Jules, and push branches. If a worker creates a catastrophic syntax error, it only breaks the client project, preserving the Asclepius Command Center UI.

### 2. Track 2: Asclepius Core (The Self / Office Building)
- **Scope:** The Asclepius source code itself.
- **Workforce:** The God-Agent, AntiGravity (System Architect), and any specialized agent explicitly spawned/authorized by the God-Agent.
- **Protocol:** General employees (COO, Healers) are restricted from modifying Asclepius Core by default. The God-Agent holds absolute authority to SPAWN_AGENT or authorize existing workers to repair/upgrade the self-code. All self-code modifications must be dispatched via `jules.google` isolated cloud sandboxes or applied safely by AntiGravity to prevent Ouroboros UI crashes.

> **Test:** "Does the COO and Healer understand they are restricted to Project work and cannot modify the Asclepius Core?" If the answer is no, Article IX is violated.

---

## Constitutional Amendments

This document may only be amended by the Human Operator. No agent — including the God-Agent — may modify, override, or circumvent any article in this Constitution. The Constitution is the supreme law of the system.

Proposed amendments must:
1. Be discussed and rationalized (as this document was).
2. Include a new compliance test.
3. Not contradict existing articles (unless the existing article is explicitly repealed).

---

## Document Hierarchy

```
📜 CONSTITUTION.md           ← Supreme Law (this file)
 ├── 📋 CONTEXT_MAP.md       ← Deep technical implementation details
 ├── 📖 README.md            ← Public-facing overview and quick start
 ├── 🎯 docs/STRATEGY.md     ← Lookback-Forward execution doctrine
 ├── 🏛️ src/GOD_AGENT.md     ← God-Agent identity and protocols
 ├── 🛡️ src/components/COO_AGENT.md       ← COO delegation protocol
 ├── 🩺 src/components/HEALER_AGENT.md    ← Healer repair pipeline
 ├── 🌉 src/components/JULES_BRIDGE.md    ← Auth Orchestrator & connection health
 ├── 🤖 src/components/AGENTS.md          ← Fleet architecture
 ├── 📡 src/components/COMMAND_CENTER.md  ← Terminal interface
 └── 🧠 src/services/SERVICES.md          ← LLM service layer
```

> **All subordinate documents must align with this Constitution.** If a subordinate document contradicts an article, the Constitution prevails.
