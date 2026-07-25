import type { SearchbackState } from "./types";
import { tokensFuzzyEqual } from "./fuzzy";

/**
 * Terms which are useful prose but weak topic identifiers on their own.
 * This small, language-neutral-ish product vocabulary complements corpus
 * weighting when a user has too little history for IDF to be meaningful.
 */
export const GENERIC_MATCH_TOKENS = new Set([
  "ai", "app", "application", "assistant", "best", "cod", "code", "desktop",
  "download", "free", "gpt", "help", "online", "problem", "search", "software",
  "solution", "tool", "us", "use", "web", "website",
]);

export const GENERIC_TOKEN_MULTIPLIER = 0.25;

export function isDistinctiveToken(token: string): boolean {
  return token.length >= 3 && !GENERIC_MATCH_TOKENS.has(token);
}

/**
 * Similarity between two normalized queries. Deliberately deterministic and
 * explainable. Anything smarter (local embeddings, an LLM call) should
 * implement SimilarityEngine and be swapped in here.
 */
export interface SimilarityEngine {
  /** 0..1 similarity between two token sets. */
  score(a: string[], b: string[]): number;
}

/** Plain cosine similarity over token sets: |A ∩ B| / sqrt(|A| * |B|). */
export const cosineEngine: SimilarityEngine = {
  score(a, b) {
    if (a.length === 0 || b.length === 0) return 0;
    const setA = new Set(a);
    const setB = new Set(b);
    let intersection = 0;
    for (const token of setA) {
      if (setB.has(token)) intersection++;
    }
    if (intersection === 0) return 0;
    return intersection / Math.sqrt(setA.size * setB.size);
  },
};

export const defaultEngine: SimilarityEngine = cosineEngine;

/** Credit for a typo-level (fuzzy) token match, relative to an exact one. */
export const FUZZY_CREDIT = 0.85;

/**
 * Token weights from the user's own problem history: a token that appears
 * across MANY different problems ("mac", "error") identifies nothing, while
 * one confined to few problems ("docker", "claude") is a strong signal.
 * Frequency is counted per CLUSTER, not per search, so a problem's own
 * repetition never devalues its topic words. With no clusters yet, every
 * weight is 1 and scoring equals plain cosine.
 */
export function tokenWeights(state: SearchbackState): Map<string, number> {
  const clusterCountByToken = new Map<string, number>();
  const clusters = Object.values(state.clusters);
  for (const cluster of clusters) {
    const tokens = new Set<string>();
    for (const searchRecordId of cluster.searchRecordIds) {
      const search = state.searches[searchRecordId];
      if (!search) continue;
      for (const token of search.normalizedQuery.split(" ")) {
        if (token) tokens.add(token);
      }
    }
    for (const token of tokens) {
      clusterCountByToken.set(token, (clusterCountByToken.get(token) ?? 0) + 1);
    }
  }
  const total = clusters.length;
  const weights = new Map<string, number>();
  for (const [token, count] of clusterCountByToken) {
    weights.set(token, 1 + Math.log((total + 1) / (count + 1)));
  }
  return weights;
}

/** Unknown tokens are potentially important product/error names, not noise. */
export function weightForToken(token: string, weights?: Map<string, number>): number {
  const learnedMaximum = weights && weights.size > 0 ? Math.max(1, ...weights.values()) : 1;
  const learned = weights?.get(token) ?? learnedMaximum;
  return learned * (GENERIC_MATCH_TOKENS.has(token) ? GENERIC_TOKEN_MULTIPLIER : 1);
}

/**
 * The engine used for clustering and matching: cosine over IDF-weighted
 * token sets, with fuzzy (typo) matches earning partial credit so one
 * misspelled word cannot split or miss a problem.
 */
export function buildCorpusEngine(state: SearchbackState): SimilarityEngine {
  const weights = tokenWeights(state);
  const w = (token: string) => weightForToken(token, weights);
  return {
    score(a, b) {
      if (a.length === 0 || b.length === 0) return 0;
      const setA = [...new Set(a)];
      const setB = [...new Set(b)];
      const bSet = new Set(setB);
      const usedB = new Set<string>();
      let dot = 0;
      for (const token of setA) {
        if (bSet.has(token)) {
          dot += w(token) * w(token);
          usedB.add(token);
        }
      }
      for (const token of setA) {
        if (bSet.has(token)) continue;
        const partner = setB.find((other) => !usedB.has(other) && tokensFuzzyEqual(token, other));
        if (partner) {
          dot += FUZZY_CREDIT * w(token) * w(partner);
          usedB.add(partner);
        }
      }
      if (dot === 0) return 0;
      const normA = Math.sqrt(setA.reduce((sum, t) => sum + w(t) * w(t), 0));
      const normB = Math.sqrt(setB.reduce((sum, t) => sum + w(t) * w(t), 0));
      return Math.min(1, dot / (normA * normB));
    },
  };
}
