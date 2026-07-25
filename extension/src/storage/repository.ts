import {
  CURRENT_MATCHING_MODEL_VERSION,
  DEFAULT_CONFIG,
  emptyState,
  type SearchbackState,
  type ProblemStatus,
} from "../core/types";
import { rebuildForCurrentMatchingModel } from "../core/matchingMigration";

/**
 * Minimal async key-value contract so the same repository works against
 * chrome.storage.local, localStorage (vite dev server), or an in-memory
 * map (tests).
 */
export interface KeyValueStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
}

const STATE_KEY = "loopback:state";

function chromeStore(): KeyValueStore {
  return {
    async get(key) {
      const result = await chrome.storage.local.get(key);
      return result[key];
    },
    async set(key, value) {
      await chrome.storage.local.set({ [key]: value });
    },
    async remove(key) {
      await chrome.storage.local.remove(key);
    },
  };
}

function localStorageStore(): KeyValueStore {
  return {
    async get(key) {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : undefined;
    },
    async set(key, value) {
      localStorage.setItem(key, JSON.stringify(value));
    },
    async remove(key) {
      localStorage.removeItem(key);
    },
  };
}

export function memoryStore(): KeyValueStore {
  const map = new Map<string, unknown>();
  return {
    async get(key) {
      return map.get(key);
    },
    async set(key, value) {
      map.set(key, value);
    },
    async remove(key) {
      map.delete(key);
    },
  };
}

function defaultStore(): KeyValueStore {
  if (typeof chrome !== "undefined" && chrome.storage?.local) return chromeStore();
  return localStorageStore();
}

export class Repository {
  constructor(private store: KeyValueStore = defaultStore()) {}

  async load(): Promise<SearchbackState> {
    const raw = (await this.store.get(STATE_KEY)) as Partial<SearchbackState> | undefined;
    if (!raw) return emptyState();
    const base = emptyState();
    const storedMatchingVersion = raw.meta?.matchingModelVersion ?? 1;
    const state: SearchbackState = {
      searches: raw.searches ?? base.searches,
      pages: raw.pages ?? base.pages,
      clusters: raw.clusters ?? base.clusters,
      config: { ...DEFAULT_CONFIG, ...raw.config },
      meta: { ...base.meta, ...raw.meta },
    };
    if (storedMatchingVersion < CURRENT_MATCHING_MODEL_VERSION) {
      rebuildForCurrentMatchingModel(state);
      await this.store.set(STATE_KEY, state);
    }
    return state;
  }

  async save(state: SearchbackState): Promise<void> {
    await this.store.set(STATE_KEY, state);
  }

  async updateConfig(patch: Partial<SearchbackState["config"]>): Promise<SearchbackState> {
    return this.update((state) => {
      state.config = { ...state.config, ...patch };
    });
  }

  /** Load–mutate–save in one step. Returns the updated state. */
  async update(mutate: (state: SearchbackState) => void): Promise<SearchbackState> {
    const state = await this.load();
    mutate(state);
    await this.save(state);
    return state;
  }

  async setStatus(clusterId: string, status: ProblemStatus): Promise<SearchbackState> {
    return this.update((state) => {
      const cluster = state.clusters[clusterId];
      if (!cluster) return;
      cluster.status = status;
      cluster.updatedAt = Date.now();
      // Only "still looking" discards the solution; ignoring a solved
      // problem (or un-ignoring it back) must not lose it.
      if (status === "unresolved") cluster.solutionPageId = undefined;
    });
  }

  /** Marking solved always records WHICH page solved it. */
  async markSolved(clusterId: string, solutionPageId: string): Promise<SearchbackState> {
    return this.update((state) => {
      const cluster = state.clusters[clusterId];
      if (!cluster) return;
      if (!cluster.pageIds.includes(solutionPageId)) return;
      cluster.status = "solved";
      cluster.solutionPageId = solutionPageId;
      cluster.updatedAt = Date.now();
    });
  }

  /**
   * The user wrote the solution in their own words — that alone counts as
   * solving the problem, no page selection required.
   */
  async solveWithNote(clusterId: string, note: string): Promise<SearchbackState> {
    return this.update((state) => {
      const cluster = state.clusters[clusterId];
      const trimmed = note.trim();
      if (!cluster || !trimmed) return;
      cluster.note = trimmed;
      cluster.status = "solved";
      cluster.updatedAt = Date.now();
    });
  }

  async setNote(clusterId: string, note: string): Promise<SearchbackState> {
    return this.update((state) => {
      const cluster = state.clusters[clusterId];
      if (!cluster) return;
      cluster.note = note.trim() || undefined;
      cluster.updatedAt = Date.now();
    });
  }

  async setTitle(clusterId: string, title: string): Promise<SearchbackState> {
    return this.update((state) => {
      const cluster = state.clusters[clusterId];
      const trimmed = title.trim();
      if (!cluster || !trimmed) return;
      cluster.title = trimmed;
      cluster.customTitle = true;
      cluster.updatedAt = Date.now();
    });
  }

  /**
   * Deletes a problem permanently. Its search/page ids go on the
   * suppression list so the next history scan cannot resurrect it.
   */
  async deleteCluster(clusterId: string): Promise<SearchbackState> {
    return this.update((state) => {
      const cluster = state.clusters[clusterId];
      if (!cluster) return;
      const suppressedSearches = new Set(state.meta.suppressedSearchIds);
      const suppressedPages = new Set(state.meta.suppressedPageIds);
      for (const searchRecordId of cluster.searchRecordIds) {
        delete state.searches[searchRecordId];
        suppressedSearches.add(searchRecordId);
      }
      for (const pageId of cluster.pageIds) {
        delete state.pages[pageId];
        suppressedPages.add(pageId);
      }
      state.meta.suppressedSearchIds = [...suppressedSearches];
      state.meta.suppressedPageIds = [...suppressedPages];
      delete state.clusters[clusterId];
    });
  }

  /** Removes a wrongly-grouped page from a problem (and keeps it removed). */
  async removePage(clusterId: string, pageId: string): Promise<SearchbackState> {
    return this.update((state) => {
      const cluster = state.clusters[clusterId];
      if (!cluster || !cluster.pageIds.includes(pageId)) return;
      cluster.pageIds = cluster.pageIds.filter((id) => id !== pageId);
      delete state.pages[pageId];
      if (!state.meta.suppressedPageIds.includes(pageId)) {
        state.meta.suppressedPageIds.push(pageId);
      }
      if (cluster.solutionPageId === pageId) {
        cluster.solutionPageId = undefined;
        if (cluster.status === "solved" && !cluster.note) cluster.status = "unresolved";
      }
      cluster.updatedAt = Date.now();
    });
  }

  async deleteAllData(): Promise<void> {
    await this.store.remove(STATE_KEY);
  }
}

export const repository = new Repository();
