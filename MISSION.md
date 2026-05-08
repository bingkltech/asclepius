# Asclepius Mission

> **Authority:** Subordinate to [SOUL.md](SOUL.md). This document defines the *current direction*, not the permanent identity.
> **Review Cadence:** Quarterly.
> **Last Updated:** 2026-05-08

---

## Current Mission (Q2–Q3 2026)

**"Ship the first complete external project build, achieve full self-repair, and establish the learning memory layer."**

Asclepius must prove its three core capabilities are real — not theoretical:
1. **Build an external app** — autonomously complete a full project (Mandelbrot Explorer or equivalent) from a goal statement, without human code intervention.
2. **Self-repair without prompting** — Hermes detects and fixes its own TypeScript errors, stale docs, and broken tests on its OODA loop — unprompted.
3. **Learn and remember** — every execution writes structured lessons to `.asclepius/memory/`. The second run of the same type of project is measurably better than the first.

---

## Mission Success Criteria

This mission is COMPLETE when ALL of the following are true:

1. **External Build:** At least one external project (not Asclepius itself) has been built autonomously — full DAG execution, code written, tests passed, committed to git — with zero human code changes.

2. **Self-Healing:** The God Agent autonomously detects and fixes a TypeScript compilation error in its own source code without human prompting. Fix is verified by `tsc --noEmit` passing.

3. **Self-Testing:** Every module in `src/tools/` has at least one passing unit test, written by the system itself.

4. **Self-Evolving:** The system has autonomously created at least one new tool in `src/tools/` that was not planned by the human.

5. **Self-Documenting:** README.md and CONTEXT_MAP.md accurately reflect the current architecture — auto-updated by Hermes' documentation duty.

6. **Memory is Compounding:** `.asclepius/memory/` contains at least 5 structured lesson entries from real executions. The COO demonstrably uses these lessons when planning subsequent tasks.

7. **Zero Cloud Dependency:** The entire core system runs on local Ollama. Cloud APIs (Gemini, Claude, Jules) enhance but never gate functionality.

---

## Strategic Priorities

These guide the *character* of the work, beyond measurable criteria:

### Priority 1: External Projects First
The system's primary value is building OTHER software. Every architectural decision, every new feature, every optimization must make Asclepius better at managing projects it did NOT create itself. Self-improvement is a side effect of building this capability — not the goal.

### Priority 2: The Pipeline Must Be Reliable
A single broken DAG task that corrupts the project repository is catastrophic. The 3-Strike Revision Loop, Sandbox Verification, and Rebase Protocol are not optional niceties — they are the difference between a useful tool and a dangerous one.

### Priority 3: Beautiful Dashboard
Premium dark-mode, glassmorphic aesthetics. The command center should feel like piloting a starship. Operators should *want* to use it. An ugly interface undermines confidence in the underlying intelligence.

### Priority 4: Alive, Not Mechanical
The duty roster should feel like a living organism, not a cron job. Hermes should communicate clearly what it's doing and why. The pipeline monitor should make complex async orchestration legible to a human glancing at it for 5 seconds.

### Priority 5: Full Observability
Dashboard shows: what Hermes is thinking, which duty it's running, which task is executing, what the last 3 worker states were, what's in memory. No black boxes. The human is always the final authority.

---

## Previous Missions (Archive)

### Q1 2026: Foundation
*"Establish the core architecture: Brains vs. Hands separation, Constitutional framework, local orchestration pipeline, multi-provider LLM routing."*
**Status:** ✅ Complete — BaseAgent, GodAgent, LeadAgent, TerminalBridge, OllamaManager, ResourceGovernor, usePersistentState, vite backend plugin all implemented.
