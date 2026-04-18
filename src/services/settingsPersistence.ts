/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Settings Persistence Service
 * 
 * Manages reading and writing the encrypted settings file (asclepius.config.enc).
 * This file is the single source of truth for all app configuration:
 *   - LLM settings (API keys, models, provider)
 *   - Agent credentials (per-agent API keys)
 *   - Agent fleet state (skills, budgets, order)
 *   - UI preferences (active tab, etc.)
 * 
 * The file is AES-256 encrypted on disk. The backend handles the
 * encryption/decryption so API keys never travel in plain text.
 * 
 * Flow:
 *   Boot → loadSettingsFromFile() → hydrate React state
 *   Change → saveSettingsToFile() → encrypt → write to disk
 */

import type { LLMSettings, Agent } from '@/src/types';

/**
 * The shape of the settings file. Everything the app needs to
 * fully restore its state without re-entering anything.
 */
export interface PersistedSettings {
  // Core LLM config
  llmSettings: LLMSettings;

  // Agent fleet (credentials, skills, budgets, order)
  agents: Agent[];
  agentOrder: string[];

  // UI state
  activeTab: string;

  // Metadata
  version: number;        // Schema version for future migrations
  savedAt: string;        // ISO timestamp of last save
}

const SETTINGS_ENDPOINT = '/api/settings';

/**
 * Loads the encrypted settings file from disk via the backend API.
 * Returns null if no file exists (first boot).
 */
export async function loadSettingsFromFile(): Promise<PersistedSettings | null> {
  try {
    const res = await fetch(SETTINGS_ENDPOINT);
    if (!res.ok) {
      console.warn('[Settings] Failed to load from file:', res.status);
      return null;
    }
    const { exists, data } = await res.json();
    if (!exists || !data) {
      console.log('[Settings] No config file found — first boot');
      return null;
    }
    console.log(`[Settings] Loaded from asclepius.config.enc (saved ${data.savedAt})`);
    return data as PersistedSettings;
  } catch (err) {
    console.warn('[Settings] Could not reach settings API:', err);
    return null;
  }
}

/**
 * Saves all settings to the encrypted config file on disk.
 * Called on settings change (debounced in App.tsx).
 */
export async function saveSettingsToFile(settings: PersistedSettings): Promise<boolean> {
  try {
    const payload: PersistedSettings = {
      ...settings,
      version: 1,
      savedAt: new Date().toISOString(),
    };

    const res = await fetch(SETTINGS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: payload }),
    });

    if (!res.ok) {
      console.error('[Settings] Save failed:', await res.text());
      return false;
    }

    const result = await res.json();
    console.log(`[Settings] Saved to asclepius.config.enc (${result.size} bytes)`);
    return true;
  } catch (err) {
    console.error('[Settings] Could not save settings:', err);
    return false;
  }
}
