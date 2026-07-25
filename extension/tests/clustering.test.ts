import { describe, expect, it } from "vitest";
import { emptyState } from "../src/core/types";
import { integrateSearches, isVisibleProblem, clusterDays } from "../src/core/clustering";
import { ingestVisits, toSearchRecord } from "../src/core/ingest";
import type { HistoryVisit } from "../src/core/sessionTracker";

const DAY = 24 * 60 * 60 * 1000;
// Anchor at noon local time so day boundaries in tests are unambiguous.
const NOON = new Date(2026, 6, 15, 12, 0, 0).getTime();

function g(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function record(query: string, at: number) {
  const r = toSearchRecord(g(query), at, []);
  if (!r) throw new Error(`fixture query filtered out: ${query}`);
  return r;
}

describe("clustering", () => {
  it("groups the spec fixture searches into one cluster", () => {
    const state = emptyState();
    integrateSearches(state, [
      record("why is my mac storage full", NOON - 2 * DAY),
      record("applications taking too much space mac", NOON - 1 * DAY),
      record("docker using too much disk space mac", NOON),
    ]);
    expect(Object.keys(state.clusters)).toHaveLength(1);
    const cluster = Object.values(state.clusters)[0];
    expect(cluster.searchRecordIds).toHaveLength(3);
    expect(clusterDays(cluster, state)).toHaveLength(3);
  });

  it("keeps unrelated searches in separate clusters", () => {
    const state = emptyState();
    integrateSearches(state, [
      record("mac storage full", NOON - DAY),
      record("best restaurants in paris", NOON),
    ]);
    expect(Object.keys(state.clusters)).toHaveLength(2);
  });

  it("only makes a problem visible when searches span two different days", () => {
    const state = emptyState();
    integrateSearches(state, [
      record("mac storage full", NOON - 2 * 60 * 60 * 1000),
      record("mac storage almost full", NOON),
    ]);
    const cluster = Object.values(state.clusters)[0];
    expect(cluster.searchRecordIds).toHaveLength(2);
    expect(isVisibleProblem(cluster, state)).toBe(false);

    integrateSearches(state, [record("free up mac storage", NOON + DAY)]);
    expect(isVisibleProblem(cluster, state)).toBe(true);
  });

  it("marks a solved cluster as resurfaced when searched again on a later day", () => {
    const state = emptyState();
    integrateSearches(state, [
      record("mac storage full", NOON - 3 * DAY),
      record("mac storage cleanup", NOON - 2 * DAY),
    ]);
    const cluster = Object.values(state.clusters)[0];
    cluster.status = "solved";

    integrateSearches(state, [record("mac storage full again", NOON)]);
    expect(cluster.status).toBe("resurfaced");
  });

  it("keeps ignored clusters ignored when new searches arrive", () => {
    const state = emptyState();
    integrateSearches(state, [
      record("mac storage full", NOON - 3 * DAY),
      record("mac storage cleanup", NOON - 2 * DAY),
    ]);
    const cluster = Object.values(state.clusters)[0];
    cluster.status = "ignored";

    integrateSearches(state, [record("clean mac storage", NOON)]);
    expect(cluster.status).toBe("ignored");
  });

  it("clusters typo'd searches with the original problem", () => {
    const state = emptyState();
    integrateSearches(state, [
      record("remove claude as a contributor on github", NOON - DAY),
      record("how to remove lcuade from github contributors", NOON),
    ]);
    expect(Object.keys(state.clusters)).toHaveLength(1);
  });

  it("uses corpus weights: a generic shared token no longer over-groups", () => {
    const state = emptyState();
    // Build up several distinct mac problems first.
    integrateSearches(state, [
      record("mac storage full", NOON - 9 * DAY),
      record("mac wifi keeps disconnecting", NOON - 8 * DAY),
      record("mac battery draining fast", NOON - 7 * DAY),
      record("mac screen flickering external monitor", NOON - 6 * DAY),
    ]);
    const before = Object.keys(state.clusters).length;
    expect(before).toBe(4);
    // A new mac problem sharing ONLY the now-devalued "mac" token stays separate.
    integrateSearches(state, [record("mac trackpad not clicking", NOON)]);
    expect(Object.keys(state.clusters)).toHaveLength(before + 1);
  });

  it("generates a readable title from shared keywords", () => {
    const state = emptyState();
    integrateSearches(state, [
      record("why is my mac storage full", NOON - DAY),
      record("applications taking too much space mac", NOON),
    ]);
    const title = Object.values(state.clusters)[0].title.toLowerCase();
    expect(title).toContain("mac");
    expect(title).toContain("storage");
  });

  it("is idempotent across repeated ingestion of the same history", () => {
    const visits: HistoryVisit[] = [
      { url: g("mac storage full"), title: "search", visitedAt: NOON - DAY },
      { url: "https://support.apple.com/102624", title: "Free up storage", visitedAt: NOON - DAY + 60_000 },
      { url: g("mac storage cleanup"), title: "search", visitedAt: NOON },
    ];
    const state = emptyState();
    ingestVisits(state, visits);
    const after1 = JSON.stringify({ s: state.searches, c: state.clusters, p: state.pages });
    ingestVisits(state, visits);
    const after2 = JSON.stringify({ s: state.searches, c: state.clusters, p: state.pages });
    expect(after2).toBe(after1);
    expect(Object.keys(state.searches)).toHaveLength(2);
    expect(Object.keys(state.pages)).toHaveLength(1);
  });
});
