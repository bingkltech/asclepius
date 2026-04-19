/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
}

export const listOllamaModels = async (baseUrl: string): Promise<OllamaModel[]> => {
  const targetUrl = baseUrl.includes('localhost:11434') ? '/ollama-api' : baseUrl;
  try {
    const response = await fetch(`${targetUrl}/api/tags`);
    if (!response.ok) {
      return [];
    }
    const data = await response.json();
    return data.models || [];
  } catch (error) {
    // Fail silently to prevent console spam and breaking the UI, 
    // since we will fallback to Gemini anyway.
    return [];
  }
};

export const generateOllamaContent = async (baseUrl: string, model: string, prompt: string, system?: string) => {
  const targetUrl = baseUrl.includes('localhost:11434') ? '/ollama-api' : baseUrl;
  const response = await fetch(`${targetUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      system,
      stream: false,
      options: {
        num_ctx: 8192 // Safe context window for most local models
      }
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama generation failed (${response.status}): ${errorText}`);
  }
  const data = await response.json();
  return data.response;
};

export const chatWithOllama = async (baseUrl: string, model: string, messages: { role: string, content: string }[], system?: string) => {
  const targetUrl = baseUrl.includes('localhost:11434') ? '/ollama-api' : baseUrl;
  const response = await fetch(`${targetUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        ...messages
      ],
      stream: false,
      options: {
        num_ctx: 8192 // Safe context window for most local models
      }
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama chat failed (${response.status}): ${errorText}`);
  }
  const data = await response.json();
  return data.message.content;
};
