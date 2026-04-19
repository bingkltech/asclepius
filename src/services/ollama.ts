/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// ─── TIMEOUT: Max wait for Ollama API responses (cloud models can be slow) ───
const OLLAMA_TIMEOUT_MS = 60_000; // 60 seconds

export interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
}

/**
 * Resolve the Ollama API base URL.
 * Uses Vite dev proxy for localhost to avoid CORS issues.
 */
const resolveOllamaUrl = (baseUrl: string): string => {
  if (!baseUrl) return '/ollama-api';
  return baseUrl.includes('localhost:11434') ? '/ollama-api' : baseUrl;
};

/**
 * Create an AbortController with a timeout.
 * Returns the signal for fetch and a cleanup function.
 */
const createTimeout = (ms: number): { signal: AbortSignal; clear: () => void } => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
};

export const listOllamaModels = async (baseUrl: string): Promise<OllamaModel[]> => {
  const targetUrl = resolveOllamaUrl(baseUrl);
  const { signal, clear } = createTimeout(10_000); // 10s for listing
  try {
    const response = await fetch(`${targetUrl}/api/tags`, { signal });
    clear();
    if (!response.ok) return [];
    const data = await response.json();
    return data.models || [];
  } catch (error) {
    clear();
    return [];
  }
};

export const generateOllamaContent = async (baseUrl: string, model: string, prompt: string, system?: string) => {
  const targetUrl = resolveOllamaUrl(baseUrl);
  const { signal, clear } = createTimeout(OLLAMA_TIMEOUT_MS);
  try {
    const response = await fetch(`${targetUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        model,
        prompt,
        system,
        stream: false,
        options: {
          num_ctx: 8192
        }
      }),
    });
    clear();

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama generation failed (${response.status}): ${errorText}`);
    }
    const data = await response.json();
    return data.response;
  } catch (error: any) {
    clear();
    if (error.name === 'AbortError') {
      throw new Error(`Ollama timed out after ${OLLAMA_TIMEOUT_MS / 1000}s. Model "${model}" may be loading or the cloud endpoint is unresponsive.`);
    }
    throw error;
  }
};

export const chatWithOllama = async (baseUrl: string, model: string, messages: { role: string, content: string }[], system?: string) => {
  const targetUrl = resolveOllamaUrl(baseUrl);
  const { signal, clear } = createTimeout(OLLAMA_TIMEOUT_MS);
  try {
    const response = await fetch(`${targetUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        model,
        messages: [
          ...(system ? [{ role: 'system', content: system }] : []),
          ...messages
        ],
        stream: false,
        options: {
          num_ctx: 8192
        }
      }),
    });
    clear();

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama chat failed (${response.status}): ${errorText}`);
    }
    const data = await response.json();
    return data.message.content;
  } catch (error: any) {
    clear();
    if (error.name === 'AbortError') {
      throw new Error(`Ollama timed out after ${OLLAMA_TIMEOUT_MS / 1000}s. Model "${model}" may be loading or the cloud endpoint is unresponsive.`);
    }
    throw error;
  }
};
