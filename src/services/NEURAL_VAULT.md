# 🧠 Neural Vault — Context Document

> **PURPOSE:** This file is the single-source-of-truth for the Neural Vault system. Any AI model reading this file should have complete understanding of the God-Agent's cognitive memory architecture, its storage engine, and its integration points.

---

## What is the Neural Vault?

The Neural Vault is the **persistent cognitive memory** of the Asclepius agent fleet. It transforms the God-Agent from a stateless chatbot into a **recursive learning system** that gets smarter with every interaction.

### The Problem It Solves
Without the Vault, agents "forget" everything between sessions. The God-Agent solves the same CORS bug 10 times, never learning from the first fix. The COO delegates tasks blindly, unaware that a worker failed the same task last week.

### The Solution
A **three-tiered memory system** backed by IndexedDB (via Dexie.js) with full-text semantic search (via FlexSearch).

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    NEURAL VAULT                          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Layer 3: Semantic Memory (knowledge table)              │
│  ┌─────────────────────────────────────────────────┐     │
│  │ KnowledgeNode: "How to solve CORS in Vite"      │     │
│  │   - Category: bugfix                            │     │
│  │   - Confidence: 95%                             │     │
│  │   - Tags: [cors, vite, proxy]                   │     │
│  │   - Connections: [node-about-jules, node-nginx]  │     │
│  └─────────────────────────────────────────────────┘     │
│                                                          │
│  Layer 2: Episodic Memory (episodes table)               │
│  ┌─────────────────────────────────────────────────┐     │
│  │ Episode: "COO fixed auth bug on Project Alpha"  │     │
│  │   - Agent: COO-Agent                            │     │
│  │   - Outcome: success                            │     │
│  │   - Lesson: "Always check token expiry first"   │     │
│  └─────────────────────────────────────────────────┘     │
│                                                          │
│  Skill Scripts (skillScripts table — Voyager Pattern)    │
│  ┌─────────────────────────────────────────────────┐     │
│  │ Script: "fix-cors-proxy"                        │     │
│  │   - Trigger: "CORS", "blocked by CORS"          │     │
│  │   - Solution: <code template>                   │     │
│  │   - Success Rate: 92%                           │     │
│  └─────────────────────────────────────────────────┘     │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  Storage: Dexie.js (IndexedDB)                           │
│  Search: FlexSearch (in-memory full-text index)          │
└──────────────────────────────────────────────────────────┘
```

---

## Memory Tiers Explained

### Layer 1: Working Memory (Chat Context)
- **Where:** The `messages[]` array in CommandCenter
- **Lifespan:** Current session only
- **Size:** Limited by LLM context window (~128K tokens for Gemini)
- **Not stored in the Vault** — this is the "live" conversation

### Layer 2: Episodic Memory (`episodes` table)
- **What:** Structured records of actions and their outcomes
- **Why:** Pattern recognition. "Every time Agent X does Y, the outcome is Z"
- **Retention:** Indefinite. Grows over time.
- **Used by:** God-Agent for decision-making, COO for delegation intelligence

### Layer 3: Semantic Memory (`knowledge` table)
- **What:** Distilled wisdom artifacts. Not raw logs — **concepts**
- **Why:** Reusable understanding. "How to solve CORS" not "Error at line 42"
- **Confidence:** 0.0 → 1.0. Decays over time if not validated/accessed
- **Neural Graph:** Nodes link to related nodes via `connections[]`

### Skill Scripts (`skillScripts` table)
- **What:** Reusable solution templates (the Voyager Pattern)
- **Why:** Instant re-application. Skip the "thinking" — use the proven fix
- **Success Rate:** Tracked. Scripts below 50% are deprioritized

---

## Key Functions

| Function | Layer | Purpose |
|----------|-------|---------|
| `addKnowledge()` | L3 | Store a new Wisdom Node |
| `recordEpisode()` | L2 | Store an action + outcome |
| `saveSkillScript()` | Scripts | Store a reusable solution |
| `searchKnowledge()` | L3 | Full-text search via FlexSearch |
| `getRelevantWisdom()` | L3 + Scripts | Context-aware retrieval for LLM injection |
| `findSkillScript()` | Scripts | Find a pre-built solution for an error |
| `applyConfidenceDecay()` | L3 | Reduce trust in old unvalidated knowledge |
| `validateKnowledge()` | L3 | Mark a node as confirmed correct |
| `connectKnowledge()` | L3 | Link two related concepts |
| `getVaultStats()` | All | Dashboard metrics |
| `initializeNeuralVault()` | All | App startup — rebuild search index |

---

## Integration Points

### 1. Sequential Orchestrator (`App.tsx`)
Before `executeSequentialTurn()` calls the LLM, it queries:
```typescript
const { wisdomBlock } = await getRelevantWisdom(taskDescription);
// wisdomBlock is injected into the system prompt
```

### 2. CommandCenter (`CommandCenter.tsx`)
The God-Agent can output a new JSON action:
```
```json:action
{ "type": "LEARN_WISDOM", "payload": { "topic": "...", "content": "...", "tags": [...], "category": "bugfix" } }
```
```

### 3. Auto-Learn (After Error Resolution)
When the auto-heal system successfully resolves an error, it automatically:
1. Records an `EpisodicEvent` with `outcome: 'success'`
2. Asks the God-Agent to distill the fix into a `KnowledgeNode`

### 4. Dashboard (`App.tsx`)
A "Neural Vault" stat card shows:
- Total knowledge nodes
- Average confidence
- Last learned topic

### 5. Chronicle Tab (`Chronicle.tsx`)
A dedicated UI page for browsing, searching, and curating the knowledge library.

---

## Confidence System

| Range | Label | Effect |
|-------|-------|--------|
| 0.8 - 1.0 | **High** | Actively injected into agent prompts |
| 0.5 - 0.79 | **Medium** | Available via search, not auto-injected |
| 0.3 - 0.49 | **Low** | Only shown in Chronicle, flagged for review |
| 0.0 - 0.29 | **Stale** | Candidates for deletion |

### Decay Rules
- Unvalidated nodes lose 2% confidence per decay cycle
- Decay only triggers if node hasn't been accessed in 7+ days
- Validated nodes are **immune** to decay
- Accessing a node (via search/injection) resets its decay timer

---

## Performance Budget

| Metric | Target |
|--------|--------|
| IndexedDB read | < 5ms per query |
| FlexSearch rebuild | ~50ms for 1000 nodes |
| Context injection | Max 3 nodes per turn |
| Storage limit | ~50MB (browser IndexedDB limit) |
| Search index memory | ~2KB per node |

---

## File References

| File | Purpose |
|------|---------|
| `src/services/neuralVault.ts` | Core service — all CRUD, search, stats |
| `src/types.ts` | `KnowledgeNode`, `EpisodicEvent`, `SkillScript`, `NeuralVaultStats` |
| `src/components/Chronicle.tsx` | UI for browsing the knowledge library |
| `src/App.tsx` | Orchestrator integration, vault initialization |
| `src/components/CommandCenter.tsx` | `LEARN_WISDOM` action handler |

---

## Related Context Documents

| Document | Purpose |
|----------|---------|
| [GOD_AGENT.md](../../GOD_AGENT.md) | God-Agent identity, powers, protocols |
| [COO_AGENT.md](../components/COO_AGENT.md) | COO-Agent delegation, task scheduling |
| [COMMAND_CENTER.md](../components/COMMAND_CENTER.md) | JSON action parsing, system prompt |
| [SERVICES.md](SERVICES.md) | LLM service layer, failover engine |
