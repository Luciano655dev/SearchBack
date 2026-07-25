import type { SearchbackState, ProblemCluster, VisitedPage } from "./types";
import { isChatHost } from "./chatHosts";
import { pageRelevance } from "./pageRelevance";

/** Reading time longer than this stops earning extra points. */
export const DWELL_CAP_MS = 10 * 60 * 1000;
/**
 * The last page of a session has no "next visit" to measure against; the
 * user moved on to other tasks. Credit it with a solid default read.
 */
export const SESSION_END_DWELL_MS = 5 * 60 * 1000;

export type SolutionCandidate = {
  page: VisitedPage;
  /** How many research sessions included this URL. */
  visitCount: number;
  lastVisitedAt: number;
  /** Best estimated time spent reading this page. */
  dwellMs: number;
  /** This is the page the user's most recent research session ended on. */
  endedLatestSession: boolean;
  /** Existing revisit/end/dwell evidence before metadata relevance. */
  behaviorScore: number;
  /** Search-to-title/domain/path relevance, 0..1. */
  relevanceScore: number;
  score: number;
  /** Human-readable explanation of why this page is ranked here. */
  reason: string;
};

/**
 * Guesses which visited page most likely solved the problem, so the user
 * never HAS to mark anything. Deterministic and explainable, using three
 * behavioral signals:
 *  1. returning to a URL in a later research session (strongest);
 *  2. ending a session on it — researching stops when something works;
 *  3. estimated reading time (gap until the next page in the session).
 */
export function rankSolutionCandidates(cluster: ProblemCluster, state: SearchbackState): SolutionCandidate[] {
  // One session = the pages that followed one search.
  const sessions = new Map<string, VisitedPage[]>();
  for (const pageId of cluster.pageIds) {
    const page = state.pages[pageId];
    if (!page) continue;
    // AI chat conversations are research context, not solution articles;
    // they get their own dedicated slot in the banner instead.
    if (isChatHost(page.domain)) continue;
    // Pages remain attached to the problem for "all research", but timing
    // alone can no longer promote an unrelated page as a solution.
    if (!pageRelevance(cluster, state, page).accepted) continue;
    const group = sessions.get(page.searchRecordId) ?? [];
    group.push(page);
    sessions.set(page.searchRecordId, group);
  }

  let latestSessionId: string | null = null;
  let latestVisit = -1;
  for (const [sessionId, pages] of sessions) {
    pages.sort((a, b) => a.visitedAt - b.visitedAt);
    const end = pages[pages.length - 1].visitedAt;
    if (end > latestVisit) {
      latestVisit = end;
      latestSessionId = sessionId;
    }
  }

  const byUrl = new Map<
    string,
    { page: VisitedPage; visitCount: number; lastVisitedAt: number; dwellMs: number; endedLatestSession: boolean }
  >();
  for (const [sessionId, pages] of sessions) {
    pages.forEach((page, index) => {
      const isSessionEnd = index === pages.length - 1;
      const dwell = isSessionEnd
        ? SESSION_END_DWELL_MS
        : Math.min(pages[index + 1].visitedAt - page.visitedAt, DWELL_CAP_MS);
      const entry = byUrl.get(page.url);
      if (entry) {
        entry.visitCount++;
        entry.dwellMs = Math.max(entry.dwellMs, dwell);
        if (page.visitedAt > entry.lastVisitedAt) {
          entry.lastVisitedAt = page.visitedAt;
          entry.page = page;
        }
        if (isSessionEnd && sessionId === latestSessionId) entry.endedLatestSession = true;
      } else {
        byUrl.set(page.url, {
          page,
          visitCount: 1,
          lastVisitedAt: page.visitedAt,
          dwellMs: dwell,
          endedLatestSession: isSessionEnd && sessionId === latestSessionId,
        });
      }
    });
  }

  const candidates: SolutionCandidate[] = [...byUrl.values()].map((entry) => {
    // Note: ending an EARLIER session earns nothing — the user searched
    // again afterwards, so that page demonstrably did not stop the search.
    // Only revisits, ending the FINAL session, and reading time count.
    const behaviorScore =
      (entry.visitCount - 1) * 4 +
      (entry.endedLatestSession ? 3 : 0) +
      (Math.min(entry.dwellMs, DWELL_CAP_MS) / DWELL_CAP_MS) * 3;
    const relevanceScore = pageRelevance(cluster, state, entry.page).score;
    const score = relevanceScore * 0.6 + Math.min(1, behaviorScore / 10) * 0.4;
    return {
      page: entry.page,
      visitCount: entry.visitCount,
      lastVisitedAt: entry.lastVisitedAt,
      dwellMs: entry.dwellMs,
      endedLatestSession: entry.endedLatestSession,
      behaviorScore,
      relevanceScore,
      score,
      reason: `matches this search and ${reasonFor(entry)}`,
    };
  });

  return candidates.sort((a, b) => b.score - a.score || b.lastVisitedAt - a.lastVisitedAt);
}

function reasonFor(entry: {
  visitCount: number;
  endedLatestSession: boolean;
  dwellMs: number;
}): string {
  if (entry.visitCount > 1) return "you came back to this page";
  if (entry.endedLatestSession) return "the last page you stayed on";
  if (entry.dwellMs >= 3 * 60 * 1000) return "you spent a while here";
  return "from your research";
}

export function likelySolution(cluster: ProblemCluster, state: SearchbackState): SolutionCandidate | null {
  return rankSolutionCandidates(cluster, state)[0] ?? null;
}
