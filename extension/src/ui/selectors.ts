import type { SearchbackState, ProblemCluster } from "../core/types";
import { clusterDays, isVisibleProblem, lastSearchedAt } from "../core/clustering";

export type ProblemSummary = {
  cluster: ProblemCluster;
  searchCount: number;
  dayCount: number;
  pageCount: number;
  lastSearchedAt: number;
};

export type ProblemSections = {
  resurfaced: ProblemSummary[];
  unresolved: ProblemSummary[];
  solved: ProblemSummary[];
  ignored: ProblemSummary[];
};

export function countLabel(n: number, singular: string, plural = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

export function statusLabel(status: ProblemCluster["status"]): string {
  switch (status) {
    case "resurfaced":
      return "happening again";
    case "unresolved":
      return "still looking";
    case "solved":
      return "solved";
    case "ignored":
      return "ignored";
  }
}

export function summarizeCluster(cluster: ProblemCluster, state: SearchbackState): ProblemSummary {
  return {
    cluster,
    searchCount: cluster.searchRecordIds.length,
    dayCount: clusterDays(cluster, state).length,
    pageCount: cluster.pageIds.length,
    lastSearchedAt: lastSearchedAt(cluster, state),
  };
}

export function sectionedProblems(state: SearchbackState): ProblemSections {
  const sections: ProblemSections = { resurfaced: [], unresolved: [], solved: [], ignored: [] };
  for (const cluster of Object.values(state.clusters)) {
    // The two-day rule filters auto-detected noise; anything the user acted
    // on (solved, ignored, annotated) stays visible regardless.
    const userTouched = cluster.status !== "unresolved" || Boolean(cluster.note);
    if (!isVisibleProblem(cluster, state) && !userTouched) continue;
    sections[cluster.status].push(summarizeCluster(cluster, state));
  }
  for (const list of Object.values(sections)) {
    list.sort((a, b) => b.lastSearchedAt - a.lastSearchedAt);
  }
  return sections;
}

export function visibleProblemCount(state: SearchbackState): number {
  const sections = sectionedProblems(state);
  return sections.resurfaced.length + sections.unresolved.length + sections.solved.length;
}

/** The problem the popup should surface: most recently active, not ignored. */
export function mostRecentProblem(state: SearchbackState): ProblemSummary | null {
  const sections = sectionedProblems(state);
  const all = [...sections.resurfaced, ...sections.unresolved, ...sections.solved];
  all.sort((a, b) => b.lastSearchedAt - a.lastSearchedAt);
  return all[0] ?? null;
}
