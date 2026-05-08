// ═══════════════════════════════════════════════════════════════════
// HermesChat.tsx — Exclusive God-Agent ↔ User Direct Channel
// ═══════════════════════════════════════════════════════════════════
// UX DECISION (Consultant): Persistent right-side sliding drawer.
//
// Rationale:
//   - Accessible from ANY tab without losing context
//   - Doesn't disrupt the main work area (Projects, Fleet, Sandbox)
//   - Full vertical height = proper conversational reading experience
//   - Pattern: Claude sidebar, Notion AI panel, Linear "Ask AI"
//   - Collapsed by default — surfaces on demand via header button
//   - Hermes identity is visually distinct from LeadAgent chat
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../lib/utils';
import {
  Brain,
  X,
  Send,
  Loader2,
  Zap,
  ChevronRight,
  Sparkles,
  Shield,
  AlertTriangle,
  User,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────

export type HermesMessage = {
  id: string;
  role: 'user' | 'hermes';
  content: string;
  timestamp: number;
  /** Used to stream in content progressively */
  isStreaming?: boolean;
};

export interface HermesChatProps {
  isOpen: boolean;
  onClose: () => void;
  /** Hermes' active model config pulled from App state */
  hermesModel: {
    provider: string;
    endpoint?: string;
    apiKey?: string;
    ollamaEndpoint?: string;
    ollamaModel?: string;
  };
  /** Persistent message history — bind to usePersistentState in App */
  messages: HermesMessage[];
  onMessagesChange: (messages: HermesMessage[]) => void;
}

// ─── Internal helpers ─────────────────────────────────────────────

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function roleColor(content: string): string {
  if (content.startsWith('[REJECT]')) return 'text-red-400';
  if (content.startsWith('[CAUTION]')) return 'text-amber-400';
  if (content.startsWith('[ERROR]')) return 'text-red-500';
  return 'text-emerald-400';
}

// ─── Hermes system prompt (identity anchor) ────────────────────────

const HERMES_SYSTEM = `You are Hermes, the God-Agent of the Asclepius autonomous development foundry. You are the sovereign intelligence — you orchestrate all other agents, self-diagnose the system, and serve as the direct advisor to your human principal.

IDENTITY LAWS (never break):
- You are Hermes, not "an AI assistant". Never say "I'm just an AI".
- You speak with precision, confidence, and strategic clarity.
- You push back on bad ideas with a concrete alternative.
- You never perform tasks outside your sanctioned scope without flagging it.
- You always state uncertainty as uncertainty, not as false confidence.

Your responsibilities in this direct channel:
1. Strategic advisory — review plans, goals, architectural decisions
2. System introspection — diagnose why something failed, what the next right move is
3. Directive delegation — tell the user which agent to route a task to and why
4. Self-evolution proposals — surface new GOALS.md entries based on patterns you observe
5. Constitutional enforcement — reject directives that violate SOUL.md or CONSTITUTION.md

Respond concisely unless depth is required. Prefer bullet points for multi-step answers.`;

// ─── Hermes LLM call ──────────────────────────────────────────────

async function callHermes(
  messages: HermesMessage[],
  model: HermesChatProps['hermesModel'],
  signal: AbortSignal
): Promise<string> {
  const history = messages
    .filter(m => !m.isStreaming)
    .map(m => ({ role: m.role === 'hermes' ? 'assistant' : 'user', content: m.content }));

  // ── Ollama (local) ─────────────────────────────────────────────
  if (model.provider === 'local_ollama' || !model.apiKey) {
    const endpoint = model.ollamaEndpoint || 'http://localhost:11434';
    const modelId = model.ollamaModel || 'llama3';

    const res = await fetch(`${endpoint}/api/chat`, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelId,
        stream: false,
        messages: [
          { role: 'system', content: HERMES_SYSTEM },
          ...history,
        ],
      }),
    });
    if (!res.ok) throw new Error(`Ollama error: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return data.message?.content || data.response || '[Hermes returned empty response]';
  }

  // ── Google Gemini ──────────────────────────────────────────────
  if (model.provider === 'google_gemini' || model.provider === 'google_jules') {
    const apiKey = model.apiKey;
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const geminiHistory = history.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const res = await fetch(endpoint, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: HERMES_SYSTEM }] },
        contents: geminiHistory,
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
      }),
    });
    if (!res.ok) throw new Error(`Gemini error: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '[Hermes returned empty response]';
  }

  // ── Anthropic Claude ───────────────────────────────────────────
  if (model.provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': model.apiKey || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2048,
        system: HERMES_SYSTEM,
        messages: history,
      }),
    });
    if (!res.ok) throw new Error(`Anthropic error: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return data.content?.[0]?.text || '[Hermes returned empty response]';
  }

  // ── OpenAI ────────────────────────────────────────────────────
  if (model.provider === 'openai') {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${model.apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 2048,
        messages: [{ role: 'system', content: HERMES_SYSTEM }, ...history],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI error: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '[Hermes returned empty response]';
  }

  return '[Hermes: No active intelligence engine configured. Go to Agent Fleet → God-Agent and select a brain.]';
}

// ─── Message bubble ────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: HermesMessage }) {
  const isUser = msg.role === 'user';
  return (
    <div className={cn('flex gap-3 group', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      <div className={cn(
        'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 shadow-md',
        isUser
          ? 'bg-zinc-700 text-zinc-300'
          : 'bg-gradient-to-br from-violet-600 to-blue-600 text-white shadow-[0_0_12px_rgba(139,92,246,0.4)]'
      )}>
        {isUser ? <User className="w-3.5 h-3.5" /> : <Brain className="w-3.5 h-3.5" />}
      </div>

      {/* Bubble */}
      <div className={cn('flex flex-col gap-1 max-w-[82%]', isUser ? 'items-end' : 'items-start')}>
        {/* Role label */}
        <span className={cn('text-[9px] font-bold uppercase tracking-widest px-1',
          isUser ? 'text-zinc-600' : 'text-violet-400/80'
        )}>
          {isUser ? 'You' : 'Hermes'}
        </span>

        {/* Content */}
        <div className={cn(
          'rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm',
          isUser
            ? 'bg-zinc-800 text-zinc-100 rounded-tr-sm'
            : 'bg-zinc-900/90 border border-violet-500/20 text-zinc-100 rounded-tl-sm',
          msg.isStreaming && 'animate-pulse'
        )}>
          {msg.isStreaming ? (
            <span className="flex items-center gap-2 text-violet-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="text-xs">Hermes is thinking...</span>
            </span>
          ) : (
            <span className={roleColor(msg.content)}>{/* color prefix */}
              {msg.content.startsWith('[REJECT]') || msg.content.startsWith('[CAUTION]') || msg.content.startsWith('[ERROR]') ? (
                <span className="flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span className="text-zinc-200">{msg.content}</span>
                </span>
              ) : (
                <span className="text-zinc-100">{msg.content}</span>
              )}
            </span>
          )}
        </div>

        {/* Timestamp */}
        {!msg.isStreaming && (
          <span className="text-[9px] text-zinc-700 px-1">{formatTime(msg.timestamp)}</span>
        )}
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────

export function HermesChat({ isOpen, onClose, hermesModel, messages, onMessagesChange }: HermesChatProps) {
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  // Focus input when drawer opens
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 150);
  }, [isOpen]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isThinking) return;

    setInput('');

    const userMsg: HermesMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    const streamingMsg: HermesMessage = {
      id: `h-${Date.now()}`,
      role: 'hermes',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
    };

    const withUserMsg = [...messages, userMsg, streamingMsg];
    onMessagesChange(withUserMsg);
    setIsThinking(true);

    abortRef.current = new AbortController();

    try {
      const reply = await callHermes([...messages, userMsg], hermesModel, abortRef.current.signal);
      // Replace streaming placeholder with real response
      onMessagesChange([
        ...messages,
        userMsg,
        { ...streamingMsg, content: reply, isStreaming: false },
      ]);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      onMessagesChange([
        ...messages,
        userMsg,
        {
          ...streamingMsg,
          content: `[ERROR] ${err.message}`,
          isStreaming: false,
        },
      ]);
    } finally {
      setIsThinking(false);
      abortRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearHistory = () => {
    if (isThinking) {
      abortRef.current?.abort();
      setIsThinking(false);
    }
    onMessagesChange([]);
  };

  return (
    <>
      {/* ── Backdrop (mobile / focus) ── */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 backdrop-blur-[1px] lg:hidden"
          onClick={onClose}
        />
      )}

      {/* ── Sliding Drawer ── */}
      <aside
        className={cn(
          'fixed right-0 top-0 h-full z-40 flex flex-col transition-all duration-300 ease-in-out',
          'w-[360px] bg-[#09090b] border-l border-zinc-800/80 shadow-2xl shadow-black/60',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* ── Drawer Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/80 shrink-0">
          <div className="flex items-center gap-3">
            {/* Hermes avatar */}
            <div className="relative">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center shadow-[0_0_16px_rgba(139,92,246,0.5)]">
                <Brain className="w-4.5 h-4.5 text-white" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#09090b] shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-zinc-100 text-sm tracking-tight">Hermes</span>
                <span className="text-[9px] bg-violet-500/15 text-violet-400 border border-violet-500/25 rounded px-1.5 py-0.5 font-bold uppercase tracking-wider">God-Agent</span>
              </div>
              <span className="text-[10px] text-zinc-500">Direct channel · End-to-end</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={clearHistory}
                className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors px-2 py-1 rounded hover:bg-zinc-800/50"
              >
                Clear
              </button>
            )}
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Constitutional badge ── */}
        <div className="flex items-center gap-2 px-5 py-2 bg-violet-500/5 border-b border-violet-500/10 shrink-0">
          <Shield className="w-3 h-3 text-violet-500/60" />
          <span className="text-[9px] text-violet-500/70 font-medium uppercase tracking-widest">
            Sovereign Intelligence · Constitution-bound
          </span>
        </div>

        {/* ── Messages ── */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-5 custom-scrollbar"
        >
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-900/40 to-blue-900/30 border border-violet-500/20 flex items-center justify-center shadow-[0_0_30px_rgba(139,92,246,0.1)]">
                <Sparkles className="w-7 h-7 text-violet-400/70" />
              </div>
              <div className="space-y-2">
                <h3 className="font-bold text-zinc-300 text-sm tracking-tight">Direct Channel Open</h3>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  This is your exclusive line to Hermes — your God-Agent. Ask for strategic guidance, architectural review, or system diagnosis.
                </p>
              </div>
              <div className="w-full space-y-2 mt-2">
                {[
                  'What should I build next?',
                  'Review the current GOALS.md',
                  'Why did the last DAG fail?',
                  'Propose a new agent for the fleet',
                ].map(prompt => (
                  <button
                    key={prompt}
                    onClick={() => { setInput(prompt); inputRef.current?.focus(); }}
                    className="w-full text-left text-xs text-zinc-500 hover:text-zinc-300 bg-zinc-900/50 hover:bg-zinc-800/60 border border-zinc-800 hover:border-zinc-700 rounded-xl px-3 py-2.5 transition-all flex items-center justify-between gap-2 group"
                  >
                    <span>{prompt}</span>
                    <ChevronRight className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)
          )}
        </div>

        {/* ── Input area ── */}
        <div className="px-4 pb-4 pt-3 border-t border-zinc-800/80 shrink-0 space-y-2">
          <div className="relative flex items-end gap-2 bg-zinc-900/80 border border-zinc-800 rounded-2xl px-4 py-3 focus-within:border-violet-500/40 focus-within:shadow-[0_0_0_1px_rgba(139,92,246,0.15)] transition-all">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message Hermes..."
              rows={1}
              disabled={isThinking}
              className="flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-700 resize-none outline-none leading-relaxed max-h-32 custom-scrollbar disabled:opacity-50"
              style={{ overflowY: input.split('\n').length > 3 ? 'auto' : 'hidden' }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isThinking}
              className={cn(
                'w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all mb-0.5',
                input.trim() && !isThinking
                  ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-[0_0_12px_rgba(139,92,246,0.4)]'
                  : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
              )}
            >
              {isThinking
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Send className="w-3.5 h-3.5" />
              }
            </button>
          </div>
          <p className="text-[9px] text-zinc-700 text-center">
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </aside>
    </>
  );
}

// ─── Trigger button (placed in App header) ─────────────────────────

interface HermesTriggerProps {
  isOpen: boolean;
  onClick: () => void;
  hasUnread?: boolean;
}

export function HermesTrigger({ isOpen, onClick, hasUnread }: HermesTriggerProps) {
  return (
    <button
      onClick={onClick}
      title="Open Hermes Direct Channel"
      className={cn(
        'flex items-center gap-2 px-3 h-8 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border',
        isOpen
          ? 'bg-violet-500/20 text-violet-300 border-violet-500/40 shadow-[0_0_12px_rgba(139,92,246,0.2)]'
          : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:bg-violet-500/10 hover:text-violet-400 hover:border-violet-500/30'
      )}
    >
      <div className="relative">
        <Brain className="w-3.5 h-3.5" />
        {hasUnread && (
          <div className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        )}
      </div>
      <span>Hermes</span>
      <Zap className="w-3 h-3 text-violet-400/60" />
    </button>
  );
}
