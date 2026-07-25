import type { SearchbackState, ProblemCluster, ProblemStatus } from "./types";
import { normalizeQuery } from "./normalize";
import { clusterDays, clusterProfileTokens, isVisibleProblem, lastSearchedAt, tokensOf } from "./clustering";
import { rankSolutionCandidates } from "./solutionInference";
import { isChatHost } from "./chatHosts";
import { tokenWeights } from "./similarity";
import { evaluateMatch } from "./relevance";
import { pageRelevance } from "./pageRelevance";

/**
 * Searches newer than this are "the session the user is in right now";
 * reminding them of those would just echo what they are doing.
 */
const SAME_SESSION_MS = 30 * 60 * 1000;

export type LiveMatchPage = {
  pageId: string;
  title: string;
  url: string;
  domain: string;
  /** Why the ranking picked this page (only set on candidates). */
  reason?: string;
};

/** What the in-page banner needs to render, resolved from state. */
export type LiveMatch = {
  clusterId: string;
  title: string;
  status: ProblemStatus;
  searchCount: number;
  dayCount: number;
  /** The user's written solution, if any. */
  note?: string;
  /** The page the user confirmed as the solution, if any. */
  solution?: LiveMatchPage;
  /**
   * Automatically ranked likely solutions (best first), excluding the
   * confirmed one. Shown even when the user configured nothing.
   */
  candidates: LiveMatchPage[];
  /** The most recent AI chat conversation about this problem, if any. */
  lastChat?: LiveMatchPage;
};

/** Re-exported for convenience; implementation lives in fuzzy.ts. */
export { tokensFuzzyEqual } from "./fuzzy";

/** Minimum separation from the runner-up before a live guess is trustworthy. */
export const LIVE_MATCH_MARGIN = 0.1;

/**
 * Cosine similarity tuned for live typing:
 * - the FINAL typed token may be a prefix of a member token ("mac stor"
 *   matches "mac storage" while still typing);
 * - any token may match fuzzily (typos), at partial credit;
 * - IDF weights (from the user's problem history) make distinctive tokens
 *   count more than generic ones;
 * - long rambling chat prompts don't dilute the score: only the heaviest
 *   2×|member| typed tokens count toward the denominator.
 */
export function prefixAwareScore(
  typed: string[],
  member: string[],
  weights?: Map<string, number>,
): number {
  return evaluateMatch(typed, member, weights, 0, "live").score;
}

function chatPagesOf(cluster: ProblemCluster, state: SearchbackState) {
  return cluster.pageIds
    .map((id) => state.pages[id])
    .filter((p) => p && isChatHost(p.domain));
}

/**
 * Which problems the banner may remind the user about:
 * - anything the user solved or annotated (that IS the configured value);
 * - anything already ASKED to an AI elsewhere — re-asking another bot the
 *   same question minutes later is exactly the loop to catch, so the
 *   same-session rule never applies when a previous chat exists (unless
 *   the user is typing inside that very conversation);
 * - problems spanning two days (the standard visibility rule);
 * - earlier same-day research, as long as it is a previous session AND
 *   there is something useful to show (visited pages).
 */
function isBannerEligible(
  cluster: ProblemCluster,
  state: SearchbackState,
  now: number,
  currentUrl?: string,
): boolean {
  if (cluster.status === "ignored") return false;
  if (cluster.status === "solved" || cluster.note) return true;
  if (chatPagesOf(cluster, state).some((p) => p.url !== currentUrl)) return true;
  if (isVisibleProblem(cluster, state)) return true;
  return lastSearchedAt(cluster, state) <= now - SAME_SESSION_MS && cluster.pageIds.length > 0;
}

/**
 * Matches text from the Google search box (possibly mid-typing) against
 * existing problems. Read-only: typing never creates search records.
 * `currentUrl` is the page the user is typing on, so their own current
 * conversation is never offered back to them.
 */
export function matchLiveQuery(
  state: SearchbackState,
  rawQuery: string,
  now: number = Date.now(),
  currentUrl?: string,
): LiveMatch | null {
  const typed = normalizeQuery(rawQuery).tokens;
  if (typed.length < 2) return null;

  const weights = tokenWeights(state);
  const matches: Array<{ clusterId: string; score: number; exact: boolean }> = [];
  for (const cluster of Object.values(state.clusters)) {
    if (!isBannerEligible(cluster, state, now, currentUrl)) continue;
    let bestMemberScore = 0;
    let bestMemberAccepted = false;
    let exactMember = false;
    for (const searchRecordId of cluster.searchRecordIds) {
      const member = state.searches[searchRecordId];
      if (!member) continue;
      const evidence = evaluateMatch(
        typed,
        tokensOf(member),
        weights,
        state.config.similarityThreshold,
        "live",
      );
      if (evidence.score > bestMemberScore) {
        bestMemberScore = evidence.score;
        bestMemberAccepted = evidence.accepted;
      }
      if (evidence.exactTokenSet) exactMember = true;
    }
    if (!bestMemberAccepted) continue;
    const profileEvidence = evaluateMatch(
      typed,
      clusterProfileTokens(cluster, state, weights),
      weights,
      state.config.similarityThreshold,
      "live",
    );
    if (!exactMember && cluster.searchRecordIds.length > 1 && !profileEvidence.accepted) continue;
    matches.push({
      clusterId: cluster.id,
      score: exactMember ? bestMemberScore : (bestMemberScore + profileEvidence.score) / 2,
      exact: exactMember,
    });
  }
  matches.sort((a, b) => b.score - a.score);
  const best = matches[0];
  if (!best) return null;
  if (!best.exact && matches[1] && best.score - matches[1].score < LIVE_MATCH_MARGIN) return null;

  const cluster = state.clusters[best.clusterId];
  const solutionPage = cluster.solutionPageId ? state.pages[cluster.solutionPageId] : undefined;
  const lastChatPage = chatPagesOf(cluster, state)
    .filter((p) => p.url !== solutionPage?.url && p.url !== currentUrl)
    .filter((p) => pageRelevance(cluster, state, p).accepted)
    .sort((a, b) => b.visitedAt - a.visitedAt)[0];

  return {
    clusterId: cluster.id,
    title: cluster.title,
    status: cluster.status,
    searchCount: cluster.searchRecordIds.length,
    dayCount: clusterDays(cluster, state).length,
    note: cluster.note,
    solution: solutionPage ? toLivePage(solutionPage) : undefined,
    candidates: rankSolutionCandidates(cluster, state)
      .filter((c) => c.page.url !== solutionPage?.url)
      .slice(0, 4)
      .map((c) => ({ ...toLivePage(c.page), reason: c.reason })),
    lastChat: lastChatPage ? toLivePage(lastChatPage) : undefined,
  };
}

function toLivePage(page: { id: string; title: string; url: string; domain: string }): LiveMatchPage {
  return { pageId: page.id, title: page.title, url: page.url, domain: page.domain };
}
