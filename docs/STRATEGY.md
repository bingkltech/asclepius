# 🎯 The Lookback-Forward Execution Strategy

> *"Look back and read the whole context. Understand the future in order to move. Granulize all tasks. Move forward."*  
> **AUTHORITY:** Subordinate to [📜 CONSTITUTION.md](../CONSTITUTION.md). This document is the detailed specification of Constitution Article VII (Lookback-Forward Doctrine).

## Philosophy

The Lookback-Forward Strategy is the **operating doctrine** of Asclepius. It is not merely a feature or a technique — it is the fundamental way every agent, from the God-Agent down to the smallest worker, approaches every task. It is codified as **Article VII** of the [Asclepius Constitution](../CONSTITUTION.md).

It emerges from a simple observation: **most failures in AI agent systems stem from insufficient context, premature action, or vague task definitions.** The Lookback-Forward Strategy eliminates all three.

---

## The Four Phases

```
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║   ┌─────────┐     ┌───────────┐     ┌───────────┐     ┌────────┐ ║
║   │LOOKBACK │ ──► │COMPREHEND │ ──► │GRANULIZE  │ ──► │FORWARD │ ║
║   │         │     │           │     │           │     │        │ ║
║   │ Read the│     │ Map the   │     │ Decompose │     │Execute │ ║
║   │ past    │     │ landscape │     │ into atoms│     │& learn │ ║
║   └─────────┘     └───────────┘     └───────────┘     └────────┘ ║
║       ▲                                                   │       ║
║       └───────────────── feedback loop ───────────────────┘       ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
```

---

## Phase 1: LOOKBACK — *Read the Whole Context*

**Principle:** Before any action, the agent must absorb the full history. No assumptions. No shortcuts.

### How It Manifests

#### In the Command Center
Every time a user sends a message, the system constructs a context payload that includes:

```typescript
// Last 15 system log entries — the recent operational history
const recentLogs = logs.slice(0, 15).map(l =>
  `[${l.timestamp}] ${l.agentId}: ${l.message}`
).join("\n");

// Full per-agent conversation history
const agentHistory = messages.filter(m =>
  m.role === 'user' || m.sender === targetAgent.name
);
```

The agent **never responds in a vacuum**. It always has:
- The last 15 log events from the entire system
- The complete conversation history for its thread
- The current state of every agent in the fleet

#### In the Auto-Heal Pipeline
When the God-Agent detects an error, it doesn't just see the error message. It receives:
- The error text itself
- Which agent produced the error
- The full system context at the time of the error

```typescript
const prompt = `A system error was detected in the logs:
  "${log.message}" from agent "${log.agentId}".
  As the God-Agent, analyze this error and suggest a fix
  or explain the root cause.`;
```

#### In Self-Evolution
During `/evolve`, the God-Agent reviews its **own** capabilities and metrics before proposing changes:

```typescript
const prompt = `Analyze your current capabilities:
  ${godAgent.capabilities.join(", ")}.
  Current Metrics: Latency: ${godAgent.metrics.latency}ms,
  Memory: ${godAgent.metrics.memory}MB.`;
```

---

## Phase 2: COMPREHEND — *Understand the Future to Move*

**Principle:** Knowing the past is not enough. The agent must understand the current system state and anticipate what needs to happen next.

### How It Manifests

#### Agent Fleet Awareness
Every agent call includes a complete snapshot of all agents:

```typescript
const agentsContext = agents.map(a =>
  `- **${a.name}** (${a.role}): Status: ${a.status},
   Health: ${a.health}%.
   Capabilities: ${a.capabilities.join(", ")}`
).join("\n");
```

This means when the God-Agent answers a question about the system, it **knows**:
- Which agents are idle, working, learning, or in error
- What each agent can do
- The health of the entire fleet

#### Proactive Quota Comprehension
The God-Agent doesn't just track API usage — it **anticipates** quota exhaustion:

```typescript
// At 90% usage → WARNING
if (newUsage.requestsToday >= newUsage.limitPerDay * 0.9) {
  // Post proactive warning
}

// At 100% usage → BLOCK
if (settings.usage.requestsToday >= settings.usage.limitPerDay) {
  // Hibernate system
}
```

This is comprehension in action — the system understands the trajectory of resource consumption and acts **before** failure.

---

## Phase 3: GRANULIZE — *Decompose into Atomic Tasks*

**Principle:** Never attempt a monolithic action. Break every goal into the smallest possible independent tasks, each assigned to the right agent.

### How It Manifests

#### Task Scheduler
The `TaskScheduler` component is the physical embodiment of granulization:

```typescript
interface ScheduledTask {
  id: string;
  agentId: string;        // Specific agent assignment
  description: string;    // Single, clear task
  type: ScheduleType;     // 'interval' or 'once'
  intervalMs?: number;    // Granular timing
  scheduledTime?: string; // Precise execution time
  status: 'active' | 'paused' | 'completed';
}
```

A complex operation like "maintain code quality" is never given as a single task. Instead:
- **Task 1:** Healer-01 → Run security audit every 300 seconds
- **Task 2:** COO-Agent → Check agent health every 60 seconds
- **Task 3:** God-Agent → Review architecture daily at 09:00

Each micro-task is:
- Assigned to a **specific** agent with the right capabilities
- Given a **precise** schedule (not "whenever")
- Independently **pausable** and **deletable**
- **Trackable** with `lastRun` timestamps

#### Agent Capabilities as Boundaries
Each agent has a scoped capability list that naturally enforces granulization:

```
God-Agent:    ["System Architecture", "Self-Healing", ...]
COO-Agent:    ["Orchestration", "Task Scheduling", ...]
Jules-Bridge: ["API Integration", "Sandbox Management"]
Healer-01:    ["Code Analysis", "Refactoring", "Bug Detection"]
```

When the system needs to handle a complex request, it must distribute sub-tasks across agents based on their capabilities. A code fix goes to Healer-01. An orchestration question goes to COO. Architecture goes to God-Agent.

---

## Phase 4: FORWARD — *Execute, Report, Learn, Repeat*

**Principle:** Execute each micro-task with precision. Log every action. Feed results back into the Lookback phase for the next cycle.

### How It Manifests

#### The Heartbeat Loop
Every 8 seconds, the system:

```
1. Select a random agent
2. Generate an action via LLM
3. Log the action → feeds LOOKBACK for next cycle
4. Update agent metrics → feeds COMPREHEND
5. Fluctuate resource usage → simulates real workload
6. Potentially show toast → operator awareness
```

The logs generated in step 3 become the input for Phase 1 (Lookback) in the next cycle. This creates a **continuous feedback loop**.

#### Scheduled Task Execution
Every 5 seconds, the scheduler checks:

```typescript
const interval = setInterval(async () => {
  for (const task of scheduledTasks) {
    if (task.status !== 'active') continue;

    let shouldRun = false;
    // Check interval timing or one-time trigger
    // ...

    if (shouldRun) {
      const action = await generateAgentAction(
        agent.name,
        `Scheduled Task: ${task.description}`
      );
      // Log the action
      // Update lastRun timestamp
      // Mark one-time tasks as completed
    }
  }
}, 5000);
```

The `lastRun` timestamp is the learning mechanism — the system knows exactly when each task was last executed and uses this to calibrate future scheduling.

#### Auto-Heal as Forward Action
When the God-Agent heals an error, the heal report is:
1. Posted to the Command Center (visible to the operator)
2. Added to the message history (available for Lookback in future cycles)
3. Logged with a timestamp (trackable for metrics)

---

## The Complete Cycle

```
                    ┌─────────────┐
                    │   LOOKBACK  │
                    │             │
                    │ Read logs   │
                    │ Read history│
                    │ Read state  │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  COMPREHEND │
                    │             │
                    │ Map agents  │
                    │ Track quota │
                    │ Anticipate  │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  GRANULIZE  │
                    │             │
                    │ Decompose   │
                    │ Assign      │
                    │ Schedule    │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   FORWARD   │
                    │             │
                    │ Execute     │◄── Results feed back
                    │ Log         │    into LOOKBACK
                    │ Learn       │    for the next cycle
                    └──────┬──────┘
                           │
                           └──────────── loops back to LOOKBACK
```

---

## Why This Works

Traditional AI agent systems fail because they:

1. **Act without context** → They start doing things without understanding the current state
2. **Think in monoliths** → They try to solve everything in one step
3. **Don't learn from their actions** → Each invocation is stateless

The Lookback-Forward Strategy solves all three:

| Problem | Solution | Asclepius Implementation |
|---|---|---|
| No context | Phase 1: LOOKBACK | Every agent call includes 15 logs + full history + fleet status |
| Monolithic thinking | Phase 3: GRANULIZE | Task Scheduler decomposes work into atomic, agent-specific tasks |
| No learning | Phase 4: FORWARD | All actions are logged and become context for the next LOOKBACK |

---

## Applying This Strategy

When building new features or agents for Asclepius, always follow this pattern:

1. **Before building:** Read all related code, logs, and prior decisions (Lookback)
2. **Before coding:** Map dependencies, system state, and impacts (Comprehend)
3. **Before executing:** Break the work into the smallest possible tasks (Granulize)
4. **During execution:** Complete one task at a time, log results, iterate (Forward)

> *"The God-Agent doesn't rush. It observes, understands, decomposes, and then moves with surgical precision."*

---

## Related Documentation

- [📜 CONSTITUTION.md](../CONSTITUTION.md) — **Supreme Law** — Article VII codifies this doctrine as immutable law
- [God-Agent](../src/GOD_AGENT.md) — The supreme agent that embodies this strategy
- [Command Center](../src/components/COMMAND_CENTER.md) — Where the Lookback phase is constructed
- [Agent Fleet](../src/components/AGENTS.md) — The agents that execute the Forward phase
- [AI Services](../src/services/SERVICES.md) — The brains that power comprehension
