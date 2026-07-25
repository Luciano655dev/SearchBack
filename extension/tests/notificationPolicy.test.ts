import { describe, expect, it } from "vitest";
import { emptyState } from "../src/core/types";
import { integrateSearches } from "../src/core/clustering";
import { shouldNotify } from "../src/core/notificationPolicy";
import { toSearchRecord } from "../src/core/ingest";

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const NOW = new Date(2026, 6, 15, 12, 0, 0).getTime();

function g(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function stateWithCluster(searchTimes: number[]) {
  const state = emptyState();
  integrateSearches(
    state,
    searchTimes.map((at, i) => toSearchRecord(g(`mac storage full ${i}`), at, [])!),
  );
  const cluster = Object.values(state.clusters)[0];
  return { state, cluster };
}

describe("shouldNotify", () => {
  it("notifies for a problem previously searched on an earlier day", () => {
    const { state, cluster } = stateWithCluster([NOW - 2 * DAY, NOW - DAY]);
    expect(shouldNotify(cluster, state, NOW)).toBe(true);
  });

  it("does not notify when all searches happened today", () => {
    const { state, cluster } = stateWithCluster([NOW - 2 * HOUR, NOW - HOUR]);
    expect(shouldNotify(cluster, state, NOW)).toBe(false);
  });

  it("never notifies for ignored problems", () => {
    const { state, cluster } = stateWithCluster([NOW - 2 * DAY, NOW - DAY]);
    cluster.status = "ignored";
    expect(shouldNotify(cluster, state, NOW)).toBe(false);
  });

  it("respects the cooldown", () => {
    const { state, cluster } = stateWithCluster([NOW - 2 * DAY, NOW - DAY]);
    cluster.lastNotifiedAt = NOW - HOUR; // default cooldown is 6h
    expect(shouldNotify(cluster, state, NOW)).toBe(false);
  });

  it("notifies again after the cooldown has passed", () => {
    const { state, cluster } = stateWithCluster([NOW - 2 * DAY, NOW - DAY]);
    cluster.lastNotifiedAt = NOW - 7 * HOUR;
    expect(shouldNotify(cluster, state, NOW)).toBe(true);
  });

  it("still notifies for solved problems (to offer the previous solution)", () => {
    const { state, cluster } = stateWithCluster([NOW - 2 * DAY, NOW - DAY]);
    cluster.status = "solved";
    expect(shouldNotify(cluster, state, NOW)).toBe(true);
  });
});
