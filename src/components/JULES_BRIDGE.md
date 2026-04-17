# 🌉 Jules-Bridge — Context Document

> **PURPOSE:** This file is the single-source-of-truth for Jules-Bridge. Any AI model reading this file should have complete, self-contained understanding of the Jules-Bridge agent's identity, WebSocket protocol, and platform integration — without needing to read any other file.

---

## Identity

| Property | Value |
|---|---|
| **ID** | `a2` |
| **Name** | `Jules-Bridge` |
| **Role** | Platform Connector |
| **Model** | `gemini-3.1-flash-lite-preview` via Gemini API |
| **Provider** | `gemini` |
| **Budget** | 100,000 tokens/day · Priority: `normal` · Overage: `block` |
| **Protected** | ❌ Can be terminated by God-Agent |
| **Created By** | `system` (hardcoded in `App.tsx → INITIAL_AGENTS[2]`) |

---

## Design Rationale

Jules-Bridge uses **Flash Lite** for fast, lightweight API calls to the Jules platform. It acts as the bridge between Asclepius and external Google services. Its status often shows `syncing` because it maintains a continuous WebSocket connection. It is intentionally given the lowest token budget with `overage: "block"` to prevent runaway API costs from sync loops.

---

## Capabilities (2)

```
API Integration      → REST/WebSocket API connections and management
Sandbox Management   → Jules platform synchronization and session lifecycle
```

---

## Skills (4)

| Skill | Category | Level | Description |
|---|---|---|---|
| API Integration | `engineering` | ★★★★☆ Expert | REST/WebSocket API connections and management |
| Sandbox Sync | `operations` | ★★★★☆ Expert | Jules platform synchronization and session management |
| Session Management | `operations` | ★★★☆☆ Competent | WebSocket session lifecycle and reconnection |
| Data Serialization | `engineering` | ★★☆☆☆ Apprentice | Request/response transformation and validation |

---

## Jules WebSocket Connection

```typescript
julesConfig: {
  enabled: true,
  endpoint: "wss://jules.google.com/api/v1/sandbox/bridge",
  status: "syncing"  // Usually syncing — maintains persistent connection
}
```

### Connection Lifecycle

```
System Boot
    │
    ▼
Jules-Bridge opens WSS connection to Jules platform
    │
    ├── Connected  → status: "connected", visual: green ping dot
    ├── Syncing    → status: "syncing", visual: amber pulse
    └── Dropped    → status: "disconnected", visual: red indicator
    │
    ▼
Auto-reconnect on disconnect (exponential backoff)
```

---

## Relationship to Other Agents

| Aspect | Behavior |
|---|---|
| **Reports to** | God-Agent, COO-Agent |
| **Receives tasks from** | God-Agent (direct), COO-Agent (scheduled) |
| **Cannot command** | Any other agent |
| **Special status** | Often in `working` state due to continuous sync |

---

## File References

| File | What It Contains |
|---|---|
| `src/App.tsx` | `INITIAL_AGENTS[2]` — Jules-Bridge definition |
| `src/types.ts` | `JulesConfig` interface |
| `src/components/AgentCard.tsx` | Jules connection badge rendering |

---

## Related Context Documents

| Document | Purpose |
|---|---|
| [GOD_AGENT.md](../GOD_AGENT.md) | The supreme authority that commands Jules-Bridge |
| [COO_AGENT.md](COO_AGENT.md) | The operations agent that schedules Jules-Bridge tasks |
| [COMMAND_CENTER.md](COMMAND_CENTER.md) | Where Jules-Bridge receives commands |
