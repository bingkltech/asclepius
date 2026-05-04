export class OllamaManager {
  private static queue: (() => Promise<void>)[] = [];
  private static isProcessing = false;

  /**
   * Enqueue a task that communicates with Ollama.
   * This guarantees that Ollama only processes one request at a time globally.
   */
  static enqueue<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await task();
          resolve(result);
        } catch (err) {
          reject(err);
        }
      });

      if (!this.isProcessing) {
        this.processQueue();
      } else {
        console.log(`[OllamaMutex] Task queued. Current queue depth: ${this.queue.length}`);
      }
    });
  }

  private static async processQueue() {
    this.isProcessing = true;
    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        await task();
      }
    }
    this.isProcessing = false;
  }

  static async getAvailableModels(endpoint: string = 'http://localhost:11434'): Promise<string[]> {
    try {
      const res = await fetch(`${endpoint}/api/tags`);
      if (!res.ok) throw new Error(`Ollama responded with ${res.status}`);
      const data = await res.json();
      return data.models.map((m: any) => m.name);
    } catch (err: any) {
      console.warn(`[OllamaManager] Failed to fetch models from ${endpoint}: ${err.message}`);
      return [];
    }
  }

  static async selectBestModel(endpoint: string = 'http://localhost:11434'): Promise<string> {
    const models = await this.getAvailableModels(endpoint);
    if (models.length === 0) return 'llama3'; // Fallback

    // Priorities: hermes3, hermes-pro, llama3.1, llama3, qwen, anything else
    if (models.some(m => m.includes('hermes3'))) return models.find(m => m.includes('hermes3'))!;
    if (models.some(m => m.includes('hermes-pro'))) return models.find(m => m.includes('hermes-pro'))!;
    if (models.some(m => m.includes('hermes'))) return models.find(m => m.includes('hermes'))!;
    if (models.some(m => m.includes('llama3.1'))) return models.find(m => m.includes('llama3.1'))!;
    if (models.some(m => m.includes('llama3'))) return models.find(m => m.includes('llama3'))!;
    if (models.some(m => m.includes('qwen'))) return models.find(m => m.includes('qwen'))!;

    return models[0]; // Just return the first available model
  }
}
