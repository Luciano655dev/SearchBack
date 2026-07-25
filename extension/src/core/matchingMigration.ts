import { integrateSearches, isVisibleProblem } from "./clustering";
import type { SearchbackState, ProblemCluster } from "./types";
import { CURRENT_MATCHING_MODEL_VERSION } from "./types";

/**
 * Rebuilds clusters under the stricter matcher while keeping every raw search
 * and page. User-authored decisions are applied after automatic state so they
 * remain authoritative.
 */
export function rebuildForCurrentMatchingModel(state: SearchbackState): void {
  const oldClusters = Object.values(state.clusters).map((cluster) => ({
    ...cluster,
    searchRecordIds: [...cluster.searchRecordIds],
    pageIds: [...cluster.pageIds],
  }));
  const records = Object.values(state.searches).sort((a, b) => a.searchedAt - b.searchedAt);
  const rebuilt: SearchbackState = {
    ...state,
    searches: {},
    clusters: {},
    pages: state.pages,
    meta: { ...state.meta },
  };

  // Recalculate corpus weights after each record. Migration happens once and
  // this avoids making the result depend on the size of the history batch.
  for (const record of records) integrateSearches(rebuilt, [record]);

  const clusterBySearch = new Map<string, ProblemCluster>();
  for (const cluster of Object.values(rebuilt.clusters)) {
    cluster.pageIds = [];
    for (const searchRecordId of cluster.searchRecordIds) clusterBySearch.set(searchRecordId, cluster);
  }
  for (const page of Object.values(rebuilt.pages)) {
    const cluster = clusterBySearch.get(page.searchRecordId);
    if (cluster && !cluster.pageIds.includes(page.id)) cluster.pageIds.push(page.id);
  }

  // Older annotations first, so the newest explicit decision wins if two old
  // polluted clusters happen to map onto the same repaired cluster.
  oldClusters.sort((a, b) => a.updatedAt - b.updatedAt);
  for (const old of oldClusters) {
    const primary = greatestOverlap(old, rebuilt.clusters);
    if (primary) {
      if (old.customTitle) {
        primary.title = old.title;
        primary.customTitle = true;
      }
      if (old.note) primary.note = old.note;
      if (old.lastNotifiedAt != null) {
        primary.lastNotifiedAt = Math.max(primary.lastNotifiedAt ?? 0, old.lastNotifiedAt);
      }
      if (old.status === "ignored") primary.status = "ignored";
      else if (old.status === "solved" && old.note) primary.status = "solved";
      else if (old.status === "resurfaced" && isVisibleProblem(primary, rebuilt)) {
        primary.status = "resurfaced";
      }
      primary.updatedAt = Math.max(primary.updatedAt, old.updatedAt);
    }

    if (old.solutionPageId) {
      const solutionPage = rebuilt.pages[old.solutionPageId];
      const solutionCluster = solutionPage ? clusterBySearch.get(solutionPage.searchRecordId) : undefined;
      if (solutionCluster && solutionCluster.pageIds.includes(old.solutionPageId)) {
        solutionCluster.solutionPageId = old.solutionPageId;
        solutionCluster.status = old.status === "ignored" ? "ignored" : "solved";
        solutionCluster.updatedAt = Math.max(solutionCluster.updatedAt, old.updatedAt);
      }
    }
  }

  state.searches = rebuilt.searches;
  state.clusters = rebuilt.clusters;
  state.meta.matchingModelVersion = CURRENT_MATCHING_MODEL_VERSION;
}

function greatestOverlap(
  old: ProblemCluster,
  candidates: Record<string, ProblemCluster>,
): ProblemCluster | null {
  const oldIds = new Set(old.searchRecordIds);
  let best: ProblemCluster | null = null;
  let bestCount = 0;
  for (const candidate of Object.values(candidates)) {
    const count = candidate.searchRecordIds.filter((id) => oldIds.has(id)).length;
    if (
      count > bestCount ||
      (count === bestCount && count > 0 && candidate.updatedAt > (best?.updatedAt ?? -1))
    ) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}
