import { describe, expect, it } from "vitest";
import { emptyState } from "../src/core/types";
import { ingestVisits } from "../src/core/ingest";
import { rankSolutionCandidates, likelySolution } from "../src/core/solutionInference";
import type { HistoryVisit } from "../src/core/sessionTracker";

const DAY = 24 * 60 * 60 * 1000;
const MIN = 60 * 1000;
const NOON = new Date(2026, 6, 15, 12, 0, 0).getTime();

function g(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function build(visits: HistoryVisit[]) {
  const state = emptyState();
  ingestVisits(state, visits);
  const cluster = Object.values(state.clusters)[0];
  return { state, cluster };
}

describe("solution inference", () => {
  it("prefers a page the user returned to in a later research session", () => {
    const { state, cluster } = build([
      { url: g("mac storage full"), title: "s", visitedAt: NOON - 2 * DAY },
      { url: "https://a.example/once", title: "Mac storage seen once", visitedAt: NOON - 2 * DAY + 2 * MIN },
      { url: "https://b.example/twice", title: "Mac storage seen twice", visitedAt: NOON - 2 * DAY + 4 * MIN },
      { url: g("mac storage cleanup"), title: "s", visitedAt: NOON - DAY },
      { url: "https://b.example/twice", title: "Mac storage seen twice", visitedAt: NOON - DAY + 2 * MIN },
      { url: "https://c.example/recent", title: "Mac storage most recent", visitedAt: NOON - DAY + 5 * MIN },
    ]);
    const ranked = rankSolutionCandidates(cluster, state);
    expect(ranked[0].page.url).toBe("https://b.example/twice");
    expect(ranked[0].visitCount).toBe(2);
    expect(ranked[0].reason).toBe("matches this search and you came back to this page");
  });

  it("falls back to the page the user ended on when nothing was revisited", () => {
    const { state, cluster } = build([
      { url: g("mac storage full"), title: "s", visitedAt: NOON - 2 * DAY },
      { url: "https://a.example/first", title: "Mac storage first", visitedAt: NOON - 2 * DAY + 2 * MIN },
      { url: g("mac storage cleanup"), title: "s", visitedAt: NOON - DAY },
      { url: "https://b.example/last", title: "Mac storage last", visitedAt: NOON - DAY + 6 * MIN },
    ]);
    const likely = likelySolution(cluster, state)!;
    expect(likely.page.url).toBe("https://b.example/last");
    expect(likely.endedLatestSession).toBe(true);
    expect(likely.reason).toBe("matches this search and the last page you stayed on");
  });

  it("ranks a long read above a page the user bounced off", () => {
    const { state, cluster } = build([
      { url: g("mac storage full"), title: "s", visitedAt: NOON - 2 * DAY },
      { url: "https://a.example/bounce", title: "Mac storage bounced", visitedAt: NOON - 2 * DAY + 1 * MIN },
      { url: "https://b.example/long-read", title: "Mac storage long read", visitedAt: NOON - 2 * DAY + 2 * MIN },
      { url: "https://c.example/end", title: "Mac storage end", visitedAt: NOON - 2 * DAY + 9 * MIN },
      { url: g("mac storage cleanup"), title: "s", visitedAt: NOON - DAY },
    ]);
    const ranked = rankSolutionCandidates(cluster, state);
    // 1st: the page the session ended on; 2nd: the 7-minute read; last: the 1-minute bounce.
    expect(ranked.map((c) => c.page.url)).toEqual([
      "https://c.example/end",
      "https://b.example/long-read",
      "https://a.example/bounce",
    ]);
    expect(ranked[1].dwellMs).toBe(7 * MIN);
    expect(ranked[1].reason).toBe("matches this search and you spent a while here");
  });

  it("returns null for a cluster with no pages", () => {
    const { state, cluster } = build([
      { url: g("mac storage full"), title: "s", visitedAt: NOON - 2 * DAY },
      { url: g("mac storage cleanup"), title: "s", visitedAt: NOON - DAY },
    ]);
    expect(likelySolution(cluster, state)).toBeNull();
  });

  it("deduplicates by URL so one page never appears as two candidates", () => {
    const { state, cluster } = build([
      { url: g("mac storage full"), title: "s", visitedAt: NOON - 2 * DAY },
      { url: "https://a.example/page", title: "Mac storage A", visitedAt: NOON - 2 * DAY + MIN },
      { url: g("mac storage cleanup"), title: "s", visitedAt: NOON - DAY },
      { url: "https://a.example/page", title: "Mac storage A", visitedAt: NOON - DAY + MIN },
    ]);
    expect(rankSolutionCandidates(cluster, state)).toHaveLength(1);
  });

  it("keeps unrelated pages as research but never promotes them", () => {
    const { state, cluster } = build([
      { url: g("codex desktop app"), title: "s", visitedAt: NOON - 2 * DAY },
      {
        url: "https://example.com/produtividade",
        title: "Produtividade para TDAH e Autismo",
        visitedAt: NOON - 2 * DAY + MIN,
      },
      { url: g("openai codex desktop app"), title: "s", visitedAt: NOON - DAY },
    ]);
    expect(cluster.pageIds).toHaveLength(1);
    expect(rankSolutionCandidates(cluster, state)).toHaveLength(0);
    expect(likelySolution(cluster, state)).toBeNull();
  });
});
