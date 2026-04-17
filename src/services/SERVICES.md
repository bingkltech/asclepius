# 🧠 AI Services Layer

> *The dual-brain LLM abstraction that powers every agent in Asclepius.*

## Architecture

```
┌──────────────────────────────────────────────┐
│              Unified LLM Layer               │
│              (llm.ts)                        │
│                                              │
│  getUnifiedChatResponse()                    │
│  getUnifiedCodeAnalysis()                    │
│  testConnection()                            │
└────────────────┬─────────────────────────────┘
                 │
         ┌───────┴───────┐
         │               │
    ┌────▼────┐    ┌─────▼─────┐
    │ Gemini  │    │  Ollama   │
    │ (Cloud) │    │  (Local)  │
    │         │    │           │
    │ gemini  │    │  ollama   │
    │ .ts     │    │  .ts      │
    └─────────┘    └───────────┘
```

The services layer implements a **three-tier abstraction**:

1. **`llm.ts`** — The unified facade. All components call this. It decides which backend to use.
2. **`gemini.ts`** — Direct integration with the Google Gemini API via `@google/genai` SDK.
3. **`ollama.ts`** — HTTP client for local Ollama instances.

---

## File: `llm.ts` — The Unified Layer

### `getUnifiedChatResponse()`

The primary chat function used by the Command Center.

```typescript
getUnifiedChatResponse(
  settings: LLMSettings,  // Provider config + API keys
  message: string,        // User's input
  history: any[],         // Conversation history
  systemContext: string,  // Full system awareness context
  agentName: string,      // "God-Agent", "COO-Agent", etc.
  agentRole: string       // "Lead Architect", etc.
): Promise<string>
```

**Routing Logic:**
1. If `settings.provider === 'gemini'` → Call `chatWithGeminiAgent()` directly
2. If `settings.provider === 'ollama'` → Attempt `chatWithOllama()`
3. **Fallback:** If Ollama fails → Automatically fall back to Gemini with a `[Note: Falling back]` prefix

### `getUnifiedCodeAnalysis()`

Used by `Sandbox.tsx` (unified testing workbench) and the Healer-01 agent.

```typescript
getUnifiedCodeAnalysis(
  settings: LLMSettings,
  code: string
): Promise<CodeAnalysis>
```

Returns structured output:
```typescript
{
  bugs: string[];
  suggestions: string[];
  explanation: string;
  refactoredCode?: string;
}
```

**Routing Logic:**
1. Gemini: Uses structured JSON output with `responseMimeType: "application/json"` and a JSON schema
2. Ollama: Generates text, then extracts JSON via regex `/{[\s\S]*}/`
3. **Fallback:** If Ollama JSON parse fails → Fall back to Gemini

### `testConnection()`

Simple connectivity test for the currently configured provider:
- Gemini: Sends `"ping"` with system instruction `"Respond with 'pong'"`
- Ollama: Calls `generateOllamaContent()` with `"ping"`

---

## File: `gemini.ts` — Google Gemini Integration

### SDK

Uses the official `@google/genai` package:
```typescript
import { GoogleGenAI, Type, Content } from "@google/genai";
```

### API Key Resolution

```typescript
const getAI = (apiKey?: string) => {
  return new GoogleGenAI({
    apiKey: apiKey || process.env.GEMINI_API_KEY || ""
  });
};
```

Priority: Explicit key → Environment variable → Empty (will fail)

### Functions

#### `analyzeCode(code, apiKey?)`
- **Model:** `gemini-3.1-pro-preview`
- **Output:** Structured JSON via `responseMimeType: "application/json"` + schema
- **Error Handling:** Detects 429 rate limits and returns a quota exhaustion message

#### `generateAgentAction(agentName, context, apiKey?)`
- **Model:** `gemini-3.1-flash-lite-preview` (lightweight, for the simulation loop)
- **Purpose:** Generates short action descriptions for the agent heartbeat
- **Error Handling:** On rate limit → returns "System paused" message

#### `chatWithAgent(message, history, systemInstruction, apiKey?, model?)`
- **Model:** Configurable (defaults to `gemini-3.1-pro-preview`)
- **Mode:** Multi-turn chat via `ai.chats.create()` with history injection
- **Error Handling:** Rate limit detection with link to billing page

### Rate Limit Detection

All Gemini functions implement the same robust rate limit detection:
```typescript
const isRateLimit = error?.message?.includes("429")
  || error?.status === 429
  || JSON.stringify(error).includes("429")
  || JSON.stringify(error).includes("RESOURCE_EXHAUSTED");
```

---

## File: `ollama.ts` — Local LLM Integration

### API Endpoints

| Function | Endpoint | Purpose |
|---|---|---|
| `listOllamaModels()` | `GET /api/tags` | List installed models |
| `generateOllamaContent()` | `POST /api/generate` | One-shot text generation |
| `chatWithOllama()` | `POST /api/chat` | Multi-turn conversation |

### Configuration

All Ollama calls use:
```typescript
options: {
  num_ctx: 128000  // Maximize context window
}
```

### Error Handling

- `listOllamaModels()`: **Fails silently** → returns empty array (prevents UI breakage)
- `generateOllamaContent()`: **Throws** with HTTP status and error text
- `chatWithOllama()`: **Throws** with HTTP status and error text

Silent failure for model listing is intentional — it's called on mount and on URL change, and the user hasn't explicitly requested it.

---

## Fallback Chain

```
User Request
    │
    ├── Provider = Gemini ──────────► Gemini API
    │                                     │
    │                                 Success? → Return response
    │                                 Failure? → Return error message
    │
    └── Provider = Ollama ──────────► Ollama Instance
                                          │
                                      Success? → Return response
                                      Failure? → ┌─────────────────┐
                                                  │ AUTOMATIC       │
                                                  │ FALLBACK TO     │
                                                  │ GEMINI          │
                                                  └────────┬────────┘
                                                           │
                                                    Return with
                                                    "[Note: Falling
                                                    back to Gemini]"
                                                    prefix
```

The fallback is **transparent to the user** — the response appears with a note but the conversation continues seamlessly.

---

## Type Definitions

```typescript
type LLMProvider = 'gemini' | 'ollama';

interface LLMSettings {
  provider: LLMProvider;
  ollamaBaseUrl: string;       // e.g. "http://localhost:11434"
  ollamaModel: string;         // e.g. "gemma4"
  geminiModel: string;         // e.g. "gemini-3.1-pro-preview"
  geminiApiKey?: string;
  autoHeal?: boolean;          // Enable proactive error detection
  usage?: LLMUsageStats;       // Daily quota tracking
}

interface LLMUsageStats {
  requestsToday: number;
  lastResetDate: string;       // e.g. "Wed Apr 16 2026"
  limitPerDay: number;         // Default: 1500
}
```

---

## Related Documentation

- [God-Agent](../GOD_AGENT.md) — The primary consumer of the LLM layer
- [Command Center](../components/COMMAND_CENTER.md) — Where chat responses are displayed
- [Agent Fleet](../components/AGENTS.md) — All agents that use these services
