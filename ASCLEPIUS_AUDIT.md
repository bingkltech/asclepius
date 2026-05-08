# ASCLEPIUS_AUDIT: The Comprehensive Self-Healing Workflow

_Designed by the Asclepius Expert Consultant Panel_

The `asclepius_audit` workflow is a continuous, multi-phased diagnostic loop designed to hunt down and eliminate blunders, architectural flaws, constitutional violations, and dead code within the Asclepius Command Center.

---

## Phase 1: The Dead Code & Dependency Purge (Static Analysis)

**Consultant in Charge:** 🏛️ The Software Architect & ⚙️ The Worker Reliability Engineer
_Philosophy:_ "Code that isn't running is code that is rotting."

1. **Unused Export Scan:** Traverse the `src/` directory to identify orphaned components, utilities, and agent classes that are exported but never imported.
2. **Dependency Audit:** Cross-reference `package.json` with actual usage. Strip out any bloated or unused NPM packages that slow down the Vite build or the Electron widget.
3. **Ghost Worker Check:** Audit the `fleet.json` (or equivalent registry). Any Worker Hand that lacks a functional endpoint or hasn't received a DAG task in 30 days is flagged for archiving.

## Phase 2: The Constitutional Compliance Check

**Consultant in Charge:** 🏛️ The Software Architect & 🔀 The Sandbox Engineer
_Philosophy:_ "The Red Lines are non-negotiable."

1. **The 'No-Fallback' Audit:** Scan Worker classes to ensure there is zero logic that attempts to fallback to Ollama or local LLMs if their remote tool API fails. If a worker fails, it must explicitly crash the task.
2. **The Cloud-Catcher Verification:** Audit the Git polling logic. Ensure there are absolutely NO `gh` CLI commands or direct GitHub API calls. The system must strictly use native `git fetch` and check local refs.
3. **Brains vs. Hands Validation:** Ensure the UI components and internal state managers never conflate Intelligence Brains with Execution Hands.

## Phase 3: The Logic Flaw & Blunder Hunt (Dynamic Analysis)

**Consultant in Charge:** 🧠 The AI Orchestration Specialist
_Philosophy:_ "Token efficiency is system stability."

1. **DAG Deadlock Detection:** Run a mock simulation of task dependencies. Check for cyclic dependencies (Task A waits for B, B waits for A) that would freeze the background daemon.
2. **Throttle Metronome Calibration:** Audit the Worker polling intervals. Are they hitting rate limits? The metronome logic must be evaluated to ensure `X-RateLimit-Reset` headers are properly parsed.
3. **State Corruption Sweep:** Check the local JSON storage (`.asclepius/` folders). Identify mismatches where a task was marked `[completed]` but the PR was never successfully merged locally.

## Phase 4: UI/UX Aesthetic Consistency

**Consultant in Charge:** 🎨 The UI/UX Architect
_Philosophy:_ "Inconsistency breeds user anxiety."

1. **Glassmorphism Check:** Audit all components to ensure the premium dark-mode, backdrop-blur aesthetics are universally applied without fallback generic colors.
2. **Widget Telemetry Accuracy:** Ensure the Electron widget's status (`Offline`, `Working`, etc.) perfectly mirrors the actual state of the PM2 daemon with zero latency.

---

## 🚀 Execution Strategy: How Hermes Runs This

To make this workflow efficient and automated, Hermes (The God Agent) should not run this linearly. Instead:

1. **Cron Trigger:** The audit runs autonomously every 48 hours, or immediately after a major architectural branch is merged.
2. **Parallel Sweeps:** Phase 1 (Static) and Phase 4 (UI) execute concurrently via the Workers, while Phase 2 and 3 require the God Agent's direct reasoning capabilities.
3. **Auto-Patching:** Trivial blunders (like unused imports) are auto-fixed via the `write_system_file` tool. Severe flaws (like a Constitutional breach) generate a Critical Alert and a suggested PR for human review.
