/**
 * APIDiscovery.ts — The API Arsenal
 *
 * Indexes the local API mega-list (api_db.json ~20K+ entries) and
 * the API-mega-list markdown catalogs into a searchable in-memory
 * catalog. Agents call discoverAPIs() to find relevant external
 * tools by natural language query.
 *
 * Constitutional compliance:
 *   - TOOL only (not a Brain or Hand)
 *   - All processing local (no cloud calls)
 *   - Stateless from the dashboard's perspective
 *
 * @module APIDiscovery
 */

import * as fs from 'fs';
import * as path from 'path';

// ─── Types ───────────────────────────────────────────────────────

export interface APIEntry {
  name: string;
  url: string;
  description: string;
  category: string;
  source: string;
}

export interface APISearchResult {
  entry: APIEntry;
  score: number;
  matchType: 'keyword' | 'fuzzy' | 'category';
}

export interface APIDiscoveryStats {
  totalEntries: number;
  categories: number;
  sources: number;
  indexedAt: string;
}

// ─── Configuration ───────────────────────────────────────────────

const DEFAULT_API_DB_PATH = 'F:\\012A_Github\\global_api_gateway\\global_api_gateway\\api_db.json';
const DEFAULT_MEGA_LIST_PATH = 'F:\\012A_Github\\API-mega-list';

// ─── Core Class ──────────────────────────────────────────────────

export class APIDiscovery {
  private entries: APIEntry[] = [];
  private categoryIndex: Map<string, APIEntry[]> = new Map();
  private invertedIndex: Map<string, Set<number>> = new Map(); // word → entry indices
  private initialized = false;
  private stats: APIDiscoveryStats = {
    totalEntries: 0,
    categories: 0,
    sources: 0,
    indexedAt: '',
  };

  constructor(
    private apiDbPath: string = DEFAULT_API_DB_PATH,
    private megaListPath: string = DEFAULT_MEGA_LIST_PATH,
  ) {}

  // ─── Initialization ──────────────────────────────────────────

  /**
   * Load and index the API database.
   * Call this once at boot.
   */
  async initialize(): Promise<APIDiscoveryStats> {
    if (this.initialized) return this.stats;

    console.log('🔌 [APIDiscovery] Loading API catalog...');

    // Load the main api_db.json
    try {
      if (fs.existsSync(this.apiDbPath)) {
        const raw = fs.readFileSync(this.apiDbPath, 'utf-8');
        const parsed: APIEntry[] = JSON.parse(raw);
        this.entries.push(...parsed);
        console.log(`🔌 [APIDiscovery] Loaded ${parsed.length} entries from api_db.json`);
      } else {
        console.warn(`🔌 [APIDiscovery] api_db.json not found at ${this.apiDbPath}`);
      }
    } catch (err: any) {
      console.error(`🔌 [APIDiscovery] Failed to load api_db.json: ${err.message}`);
    }

    // Scan API-mega-list markdown files for supplementary entries
    try {
      if (fs.existsSync(this.megaListPath)) {
        const dirs = fs.readdirSync(this.megaListPath, { withFileTypes: true })
          .filter(d => d.isDirectory() && !d.name.startsWith('.'));
        
        let supplementCount = 0;
        for (const dir of dirs) {
          const readmePath = path.join(this.megaListPath, dir.name, 'README.md');
          if (fs.existsSync(readmePath)) {
            const entries = this.parseMegaListMarkdown(readmePath, dir.name);
            this.entries.push(...entries);
            supplementCount += entries.length;
          }
        }
        if (supplementCount > 0) {
          console.log(`🔌 [APIDiscovery] Parsed ${supplementCount} entries from API-mega-list markdown`);
        }
      }
    } catch (err: any) {
      console.warn(`🔌 [APIDiscovery] Mega-list scan skipped: ${err.message}`);
    }

    // Deduplicate by URL
    const seen = new Set<string>();
    this.entries = this.entries.filter(e => {
      const key = e.url?.toLowerCase() || e.name?.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Build indices
    this.buildCategoryIndex();
    this.buildInvertedIndex();

    this.stats = {
      totalEntries: this.entries.length,
      categories: this.categoryIndex.size,
      sources: new Set(this.entries.map(e => e.source)).size,
      indexedAt: new Date().toISOString(),
    };

    this.initialized = true;
    console.log(`🔌 [APIDiscovery] Indexed ${this.stats.totalEntries} APIs across ${this.stats.categories} categories.`);
    return this.stats;
  }

  // ─── Search ──────────────────────────────────────────────────

  /**
   * Discover APIs matching a natural language query.
   * Uses keyword matching + category filtering + fuzzy scoring.
   *
   * @param query - Natural language query (e.g., "scrape instagram profiles")
   * @param maxResults - Maximum results to return (default 10)
   * @returns Ranked list of matching APIs
   */
  discoverAPIs(query: string, maxResults: number = 10): APISearchResult[] {
    if (!this.initialized) {
      console.warn('🔌 [APIDiscovery] Not initialized. Call initialize() first.');
      return [];
    }

    const queryLower = query.toLowerCase();
    const queryWords = this.tokenize(queryLower);
    const results: APISearchResult[] = [];

    // Phase 1: Exact keyword matches from inverted index
    const candidateIndices = new Map<number, number>(); // index → hit count
    for (const word of queryWords) {
      const matches = this.invertedIndex.get(word);
      if (matches) {
        for (const idx of matches) {
          candidateIndices.set(idx, (candidateIndices.get(idx) || 0) + 1);
        }
      }
      // Also check partial matches (prefix)
      for (const [indexedWord, indices] of this.invertedIndex) {
        if (indexedWord.startsWith(word) || word.startsWith(indexedWord)) {
          for (const idx of indices) {
            candidateIndices.set(idx, (candidateIndices.get(idx) || 0) + 0.5);
          }
        }
      }
    }

    // Phase 2: Score candidates
    for (const [idx, hitCount] of candidateIndices) {
      const entry = this.entries[idx];
      let score = hitCount;

      // Bonus: name match
      const nameLower = (entry.name || '').toLowerCase();
      if (queryWords.some(w => nameLower.includes(w))) {
        score += 3;
      }

      // Bonus: exact phrase in description
      if ((entry.description || '').toLowerCase().includes(queryLower)) {
        score += 5;
      }

      // Bonus: category match
      if (queryWords.some(w => (entry.category || '').toLowerCase().includes(w))) {
        score += 2;
      }

      results.push({
        entry,
        score,
        matchType: score >= 5 ? 'keyword' : 'fuzzy',
      });
    }

    // Phase 3: Category-level fallback if no keyword hits
    if (results.length === 0) {
      for (const word of queryWords) {
        for (const [cat, entries] of this.categoryIndex) {
          if (cat.includes(word)) {
            for (const entry of entries.slice(0, 5)) {
              results.push({ entry, score: 1, matchType: 'category' });
            }
          }
        }
      }
    }

    // Sort by score descending, deduplicate, limit
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, maxResults);
  }

  /**
   * Get a formatted context string for task injection.
   * Designed to be appended to task descriptions for agent use.
   */
  getContextForTask(taskGoal: string, maxAPIs: number = 5): string | null {
    const results = this.discoverAPIs(taskGoal, maxAPIs);
    if (results.length === 0) return null;

    const lines = [
      '🔌 [API Arsenal] Relevant external APIs discovered:',
      ...results.map((r, i) =>
        `  ${i + 1}. ${r.entry.name} — ${r.entry.description?.slice(0, 120) || 'No description'}\n     URL: ${r.entry.url} | Category: ${r.entry.category}`
      ),
    ];

    return lines.join('\n');
  }

  /**
   * List all available categories.
   */
  getCategories(): string[] {
    return Array.from(this.categoryIndex.keys()).sort();
  }

  /**
   * Get APIs by category.
   */
  getByCategory(category: string, limit: number = 20): APIEntry[] {
    const key = category.toLowerCase();
    for (const [cat, entries] of this.categoryIndex) {
      if (cat.includes(key)) {
        return entries.slice(0, limit);
      }
    }
    return [];
  }

  /**
   * Get current index statistics.
   */
  getStats(): APIDiscoveryStats {
    return this.stats;
  }

  // ─── Internal ────────────────────────────────────────────────

  private buildCategoryIndex(): void {
    this.categoryIndex.clear();
    for (const entry of this.entries) {
      const cat = (entry.category || 'uncategorized').toLowerCase();
      if (!this.categoryIndex.has(cat)) {
        this.categoryIndex.set(cat, []);
      }
      this.categoryIndex.get(cat)!.push(entry);
    }
  }

  private buildInvertedIndex(): void {
    this.invertedIndex.clear();
    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i];
      const text = `${entry.name || ''} ${entry.description || ''} ${entry.category || ''}`.toLowerCase();
      const words = this.tokenize(text);
      for (const word of words) {
        if (!this.invertedIndex.has(word)) {
          this.invertedIndex.set(word, new Set());
        }
        this.invertedIndex.get(word)!.add(i);
      }
    }
  }

  private tokenize(text: string): string[] {
    return text
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 3); // Skip tiny words
  }

  /**
   * Parse a mega-list README.md that contains tables of APIs.
   * Format: | [Name](url) | Description |
   */
  private parseMegaListMarkdown(filePath: string, category: string): APIEntry[] {
    const entries: APIEntry[] = [];
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      
      // Extract table rows with links
      const linkPattern = /\|\s*\[([^\]]+)\]\(([^)]+)\)\s*\|\s*([^|]*)\|?/;
      
      for (const line of lines) {
        const match = line.match(linkPattern);
        if (match) {
          entries.push({
            name: match[1].trim(),
            url: match[2].trim(),
            description: match[3].trim(),
            category: category.replace(/-apis-\d+$/, '').replace(/-/g, ' '),
            source: 'api-mega-list',
          });
        }
      }
    } catch {
      // Silently skip unparseable files
    }
    return entries;
  }
}
