import type { SearchbackState, ProblemCluster, SearchRecord } from "./types";
import { clusterId } from "./ids";
import { distinctLocalDays, localDayKey } from "./dates";
import { generateTitle } from "./titles";
import { isDistinctiveToken, tokenWeights, weightForToken } from "./similarity";
import { evaluateMatch } from "./relevance";

export function tokensOf(record: SearchRecord): string[] {
  return record.normalizedQuery.split(" ").filter(Boolean);
}

/**
 * Single-linkage assignment: a new search joins the cluster containing its
 * most similar existing search, if that similarity clears the threshold.
 */
export function findBestCluster(
  record: SearchRecord,
  state: SearchbackState,
  weights: Map<string, number> = tokenWeights(state),
): { cluster: ProblemCluster; score: number } | null {
  const tokens = tokensOf(record);
  let best: { cluster: ProblemCluster; score: number } | null = null;
  for (const cluster of Object.values(state.clusters)) {
    let bestMemberScore = 0;
    let bestMemberAccepted = false;
    let exactMember = false;
    for (const searchRecordId of cluster.searchRecordIds) {
      const member = state.searches[searchRecordId];
      if (!member) continue;
      const evidence = evaluateMatch(
        tokens,
        tokensOf(member),
        weights,
        state.config.similarityThreshold,
        "query",
      );
      if (evidence.score > bestMemberScore) {
        bestMemberScore = evidence.score;
        bestMemberAccepted = evidence.accepted;
      }
      if (evidence.exactTokenSet) exactMember = true;
    }

    if (!bestMemberAccepted) continue;
    const profile = clusterProfileTokens(cluster, state, weights);
    const profileEvidence = evaluateMatch(
      tokens,
      profile,
      weights,
      state.config.similarityThreshold,
      "query",
    );
    // An exact repeat is authoritative. Otherwise a query must agree with
    // both one historical member and the cluster's stable topic profile.
    if (!exactMember && cluster.searchRecordIds.length > 1 && !profileEvidence.accepted) continue;
    const clusterScore = exactMember
      ? bestMemberScore
      : (bestMemberScore + profileEvidence.score) / 2;
    if (clusterScore > (best?.score ?? 0)) best = { cluster, score: clusterScore };
  }
  return best;
}

/** Dominant, distinctive topic terms used to stop single-linkage drift. */
export function clusterProfileTokens(
  cluster: ProblemCluster,
  state: SearchbackState,
  weights: Map<string, number> = tokenWeights(state),
): string[] {
  const frequency = new Map<string, number>();
  for (const searchRecordId of cluster.searchRecordIds) {
    const search = state.searches[searchRecordId];
    if (!search) continue;
    for (const token of new Set(tokensOf(search))) {
      frequency.set(token, (frequency.get(token) ?? 0) + 1);
    }
  }
  const minimumFrequency = Math.max(1, Math.ceil(cluster.searchRecordIds.length / 2));
  const dominant = [...frequency.entries()]
    .filter(([, count]) => count >= minimumFrequency)
    .sort((a, b) => b[1] - a[1] || weightForToken(b[0], weights) - weightForToken(a[0], weights))
    .map(([token]) => token);
  if (dominant.some(isDistinctiveToken)) return dominant;
  // Sparse or highly paraphrased clusters still need a stable anchor.
  return [...frequency.keys()]
    .filter(isDistinctiveToken)
    .sort((a, b) => weightForToken(b, weights) - weightForToken(a, weights))
    .slice(0, 3);
}

/**
 * Adds new search records into the cluster set, mutating `state` in place.
 * Records must not already exist in state.searches.
 */
export function integrateSearches(
  state: SearchbackState,
  newRecords: SearchRecord[],
  // Snapshot the corpus weights once per batch: deterministic given the
  // same input, and cluster-level IDF barely moves within one batch.
  weights: Map<string, number> = tokenWeights(state),
): void {
  const sorted = [...newRecords].sort((a, b) => a.searchedAt - b.searchedAt);
  for (const record of sorted) {
    if (state.searches[record.id]) continue;
    if (record.normalizedQuery.trim().length === 0) continue;
    state.searches[record.id] = record;

    const match = findBestCluster(record, state, weights);
    if (match) {
      addRecordToCluster(state, match.cluster, record);
    } else {
      const id = clusterId(record.id);
      state.clusters[id] = {
        id,
        title: generateTitle([record.query]),
        searchRecordIds: [record.id],
        pageIds: [],
        status: "unresolved",
        createdAt: record.searchedAt,
        updatedAt: record.searchedAt,
      };
    }
  }
}

function addRecordToCluster(state: SearchbackState, cluster: ProblemCluster, record: SearchRecord): void {
  const previousDays = clusterDays(cluster, state);
  cluster.searchRecordIds.push(record.id);
  cluster.updatedAt = Math.max(cluster.updatedAt, record.searchedAt);
  if (!cluster.customTitle) {
    cluster.title = generateTitle(
      cluster.searchRecordIds.map((id) => state.searches[id]?.query ?? "").filter(Boolean),
    );
  }
  // A solved problem searched again on a later day has come back.
  const recordDay = localDayKey(record.searchedAt);
  const isNewLaterDay = previousDays.length > 0 && recordDay > previousDays[previousDays.length - 1];
  if (cluster.status === "solved" && isNewLaterDay) {
    cluster.status = "resurfaced";
  } else if (cluster.status === "unresolved" && isNewLaterDay && previousDays.length >= 2) {
    cluster.status = "resurfaced";
  }
}

export function clusterDays(cluster: ProblemCluster, state: SearchbackState): string[] {
  return distinctLocalDays(
    cluster.searchRecordIds.map((id) => state.searches[id]?.searchedAt).filter((t): t is number => t != null),
  );
}

/**
 * A cluster only becomes a visible "problem" once its searches span at
 * least two different calendar days.
 */
export function isVisibleProblem(cluster: ProblemCluster, state: SearchbackState): boolean {
  return clusterDays(cluster, state).length >= 2;
}

export function lastSearchedAt(cluster: ProblemCluster, state: SearchbackState): number {
  return Math.max(0, ...cluster.searchRecordIds.map((id) => state.searches[id]?.searchedAt ?? 0));
}
