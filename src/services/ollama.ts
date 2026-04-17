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
  try {
    const response = await fetch(`${baseUrl}/api/tags`);
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
  const response = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      system,
      stream: false,
      options: {
        num_ctx: 128000 // Maximize context window
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
  const response = await fetch(`${baseUrl}/api/chat`, {
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
        num_ctx: 128000 // Maximize context window
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
