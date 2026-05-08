# ASCLEPIUS_EVOLUTION: The Continuous Self-Improvement Loop

_Architected by the Asclepius Expert Consultant Panel_

In the spirit of advanced agentic CLI systems (like Claude Code), the Asclepius God Agent must transcend mere execution. This workflow defines the **Test-Driven Self-Improvement Loop**. Hermes does not just blindly write code; she writes the workflows that test her own code, ensuring continuous, unbroken evolution.

## Phase 1: The Iterative Test Loop (The Claude Code Method)

**Consultant in Charge:** 🔀 The Sandbox & Version Control Engineer
_Philosophy:_ "Code without a passing test is a hallucination."

1. **Hypothesis Generation:** When Hermes decides to improve the Asclepius dashboard or orchestrator, she first writes a clear specification of the intended behavior.
2. **Test-First Implementation (TDD):** The assigned Worker MUST write the unit/integration test _before_ the core implementation.
3. **The Execution Sandbox:** The Worker runs the test via terminal commands.
4. **The Revision Loop:** If the test fails, the Worker analyzes the terminal `stderr` output, modifies the implementation, and loops. This cycle repeats autonomously until the test passes. **No code is considered complete unless the test passes.**

## Phase 2: Workflow Meta-Generation

**Consultant in Charge:** 🧠 The AI Orchestration Specialist
_Philosophy:_ "An agent is only as good as the tools it builds for itself."

1. **Identifying Bottlenecks:** Hermes actively monitors the DAG execution times. If she notices a specific type of task is failing frequently or taking too long, she flags a workflow bottleneck.
2. **Tool Creation:** Hermes is authorized to autonomously create new `.ts` scripts in the `scripts/` or `src/tools/` directory that automate or streamline these bottlenecks.
3. **Self-Wiring:** After creating a new tool, Hermes modifies her own `GodAgent.ts` or `LeadAgent.ts` to explicitly include this new tool in her `systemPrompt` or JSON function schemas.

## Phase 3: The UI/UX Aesthetic Refinement Loop

**Consultant in Charge:** 🎨 The UI/UX Architect
_Philosophy:_ "Perfection is a moving target."

1. **Component Isolation:** Hermes spawns a UI expert to isolate a single component in the React tree (e.g., the Widget, the Project Board).
2. **Design Heuristics Test:** The component is evaluated against the Asclepius UI standards: Premium Glassmorphism, True Dark-Mode, and non-blocking rendering.
3. **Iterative Refinement:** The expert injects richer CSS/Tailwind utilities to push the component towards a more futuristic feel, constantly testing the UI output.

---

## The Evolution Mandate

This workflow is chained directly into Hermes's infinite background loop. Once the `asclepius_audit` confirms the system is stable and bug-free, Hermes immediately transitions into `asclepius_evolution` to expand her capabilities, test her logic, and evolve into a better application.
