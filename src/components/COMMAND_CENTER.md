# 📡 Command Center

> *Military-grade terminal interface for direct human-to-agent communication.*

## Overview

The Command Center is the **primary interaction surface** between the human operator and the AI agent fleet. It presents a terminal-style chat interface with a scanline CRT effect, real-time message streaming, and full Markdown rendering.

**File:** `CommandCenter.tsx` (~1150 lines — the largest component in the system)

---

## Interface Design

```
┌─────────────────────────────────────────────────────┐
│ ● Command_Center_v2.0  │  Healer_Active  │ Agents: 4│  ← HUD Header
├─────────────────────────────────────────────────────┤
│                                                     │
│  CORE                          12:30:05             │
│  COMMAND CENTER ONLINE. GOD-AGENT & COO-AGENT       │
│  STANDING BY.                                       │
│                                                     │
│  USER                          12:31:12             │
│  Analyze the authentication flow                    │
│                                                     │
│  GOD-AGENT                     12:31:14             │
│  ### ANALYSIS_COMPLETE                              │
│  The authentication flow has the following...       │
│                                                     │
│  ░░░░░░░░░░░ scanline overlay ░░░░░░░░░░░░░░░░░░░░░ │
├─────────────────────────────────────────────────────┤
│ > ENTER_COMMAND_OR_MESSAGE_AGENTS...     [Execute]  │  ← Stealth Input
└─────────────────────────────────────────────────────┘
```

### Visual Features
- **Scanline CRT overlay** — CSS linear gradient creating a retro terminal effect
- **Animated focus line** — Input border pulses primary color on focus
- **Message rail** — Timeline-style indicator dots with connecting lines
- **Color-coded senders** — User (muted), Agent (primary), Monitor (red)
- **Full Markdown rendering** — Headers, code blocks, lists, emphasis via `react-markdown`

---

## Command Protocols

### Routing

```typescript
// Default: Routes to God-Agent
"analyze the codebase"
→ God-Agent receives: "analyze the codebase"

// Explicit targeting
"God-Agent: review the architecture"
→ God-Agent receives: "review the architecture"

"COO-Agent: schedule a security audit"
→ COO-Agent receives: "schedule a security audit"

// Smart matching (prefix matching)
"god: check logs"     → God-Agent
"coo: status report"  → COO-Agent
"healer: fix this"    → Healer-01

// Special commands
"/analyze [code]"     → Healer-01 (code analysis mode)
"/fix [code]"         → Healer-01 (code analysis mode)
"/evolve"             → God-Agent (self-evolution protocol)
```

### Agent Name Resolution

The routing system uses fuzzy matching:

```typescript
const foundAgent = agents.find(a =>
  a.name.toLowerCase() === prefix ||
  a.name.toLowerCase() === `${prefix}.ai` ||
  a.name.toLowerCase().startsWith(prefix + '-') ||
  a.name.toLowerCase().replace('-agent', '') === prefix
);
```

---

## Auto-Heal Pipeline

The Command Center contains a **proactive error detection system** that runs continuously:

```
                    System Logs
                        │
                        ▼
              ┌─────────────────┐
              │ Log Watcher     │
              │ (useEffect)     │
              │                 │
              │ Checks for:     │
              │ - type: 'error' │
              │ - "error" text  │
              │ - "failed" text │
              └────────┬────────┘
                       │
                 Error Detected?
                 /            \
               No              Yes
               │                │
            (skip)              ▼
                       ┌────────────────┐
                       │ MONITOR Alert  │
                       │ Posted to chat │
                       └────────┬───────┘
                                │
                                ▼
                       ┌────────────────┐
                       │ God-Agent      │
                       │ Invoked with   │
                       │ error context  │
                       └────────┬───────┘
                                │
                                ▼
                       ┌────────────────┐
                       │ HEAL_REPORT    │
                       │ Posted to chat │
                       └────────────────┘
```

### Deduplication

A `lastProcessedLogId` ref ensures each error log is only processed once, preventing infinite heal loops.

### Toggle

The auto-heal can be enabled/disabled via the Config dialog (`autoHeal` toggle). When active, the HUD shows a `Healer_Active` badge.

---

## Sandbox Event Feed (v2.6)

The Command Center now receives real-time events from the Sandbox via `onPostSystemMessage`:

| Event | Sender | Example |
|---|---|---|
| Analysis Critical | `SANDBOX` | `[CRITICAL] Analysis detected 3 critical and 2 warning(s) in Asclepius Core` |
| Analysis Warning | `SANDBOX` | `[WARNING] Analysis found 2 warning(s) in Test Project` |
| Analysis Pass | `SANDBOX` | `[PASS] Code analysis passed with 0 issues ✓` |
| Task Creation | `SANDBOX` | `[AUTO-TASK] 3 resolution tasks created from analysis: ...` |
| Error Resolution | `CORE` | `[SANDBOX] Error err-xxx in run run-xxx marked as RESOLVED` |

All agents can see these events in their system context, enabling proactive responses.

---

## Autonomous JSON Actions

Agents can output structured `json:action` blocks that the system intercepts and executes:

| Action | Payload | Effect |
|---|---|---|
| `SCHEDULE_TASK` | `{ agentId, description, type, time }` | Creates a scheduled task |
| `SPAWN_AGENT` | `{ name, role, skills[] }` | Spawns a new agent with skills |
| `PAUSE_AGENT` | `{ agentId }` | Puts agent into tactical hibernation |
| `GRANT_SKILL` | `{ agentId, skillName, category, level }` | Grants a skill to an agent |
| `EVOLVE_AGENT` | `{ agentId }` | Maxes all skills to level 5 |
| `UPDATE_GOAL` | `{ projectId, goalId, status }` | Updates a project milestone |
| `RESOLVE_ERROR` | `{ runId, errorId }` | Marks a sandbox error as resolved |

```json
// Example: Agent autonomously resolves a sandbox error
{ "type": "RESOLVE_ERROR", "payload": { "runId": "run-xxx", "errorId": "err-xxx" } }
```

---

## Context Construction

Before every agent call, the Command Center constructs a rich system context:

```typescript
const systemContext = `
  You are operating as ${targetAgent.name}.

  Available Agents & Their Skills:
  - God-Agent (Lead Architect): Status: paused, Health: 100%. 
    Skills: System Architecture(L5), Self-Healing(L5)...

  ═══ ACTIVE PROJECTS ═══
  📋 Project: "Asclepius Core" [ACTIVE] (Priority: critical) — 35% complete
    Tech: React, TypeScript, Vite
    Milestones:
    - [COMPLETED] Build REST API (100%)
    - [IN_PROGRESS] Auth System (50%) → Agent: healer-01

  ═══ SANDBOX HEALTH ═══
  Last 5 test runs:
    [ERROR] Asclepius Core — 2 critical, 1 warnings (11:30:42 AM)
    [SUCCESS] Test Project — 0 critical, 0 warnings (11:15:00 AM)

  Recent System Activity Logs:
  [11:30:42] god: Executing Lookback sweep...

  Recent Global Chat Transcript:
  [11:30:00] USER: Fix the auth bug
  [11:30:02] GOD-AGENT: Analyzing authentication flow...
`;
```

This is where the **Lookback** phase of the strategy manifests — every agent receives full system awareness (including project milestones and sandbox test results) before responding.

---

## Configuration Panel

The Config dialog (gear icon in HUD header) provides:

### Auto-Heal Toggle
Enable/disable the proactive error detection pipeline.

### Connection Test
Test connectivity to the currently selected LLM provider. Sends a `ping` → expects `pong`.

### Daily Quota Monitor
Visual progress bar showing `requestsToday / limitPerDay`:
- Green: Normal usage
- Yellow: >70% used
- Red: >90% used (triggers God-Agent quota warning)

### Provider Selection
Switch between Gemini API and Ollama with radio buttons.

### Model Selection
- **Gemini:** Dropdown with `gemini-3.1-pro-preview` and `gemini-3.1-flash-lite-preview`
- **Ollama:** Dynamic model list fetched from `ollama /api/tags` with refresh button

---

## Message Architecture

```typescript
interface ChatMessage {
  id: string;
  role: 'user' | 'model' | 'system';
  sender?: string;     // Display name: "USER", "GOD-AGENT", "MONITOR", "CORE"
  content: string;     // Markdown-capable content
  timestamp: string;
  targetAgentId?: string;  // Used for per-agent history filtering
}
```

### System Messages

System messages come from two sources:
- **CORE** — Initial protocol briefing on startup
- **MONITOR** — Auto-heal error alerts

### History Filtering

The Command Center maintains conversation history per-agent by filtering `messages` where `targetAgentId` matches. This means each agent has its own memory thread, even though all messages appear in a single unified stream.

---

## Related Documentation

- [God-Agent](../GOD_AGENT.md) — The default target and auto-heal responder
- [Agent Fleet](AGENTS.md) — The targetable agents
- [AI Services](../services/SERVICES.md) — The LLM backends powering responses
