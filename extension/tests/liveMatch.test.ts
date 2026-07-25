import { describe, expect, it } from "vitest";
import { emptyState } from "../src/core/types";
import { integrateSearches } from "../src/core/clustering";
import { matchLiveQuery, prefixAwareScore, tokensFuzzyEqual } from "../src/core/liveMatch";
import { ingestVisits, toSearchRecord } from "../src/core/ingest";
import type { HistoryVisit } from "../src/core/sessionTracker";

const DAY = 24 * 60 * 60 * 1000;
const MIN = 60 * 1000;
const NOON = new Date(2026, 6, 15, 12, 0, 0).getTime();

function g(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function macStorageState() {
  const state = emptyState();
  const visits: HistoryVisit[] = [
    { url: g("why is my mac storage full"), title: "search", visitedAt: NOON - 2 * DAY },
    { url: "https://support.apple.com/102624", title: "Free up storage - Apple", visitedAt: NOON - 2 * DAY + 2 * MIN },
    { url: g("applications taking too much space mac"), title: "search", visitedAt: NOON - DAY },
    { url: "https://stackoverflow.com/q/44785585", title: "Docker disk space - SO", visitedAt: NOON - DAY + 3 * MIN },
  ];
  ingestVisits(state, visits);
  return state;
}

describe("tokensFuzzyEqual", () => {
  it("catches transposition typos via anagram matching", () => {
    expect(tokensFuzzyEqual("lcuade", "claude")).toBe(true);
  });

  it("catches single-character typos on longer words", () => {
    expect(tokensFuzzyEqual("storge", "storage")).toBe(true);
    expect(tokensFuzzyEqual("contributer", "contributor")).toBe(true);
  });

  it("never fuzzes short tokens", () => {
    expect(tokensFuzzyEqual("mac", "map")).toBe(false);
    expect(tokensFuzzyEqual("git", "get")).toBe(false);
  });

  it("does not match genuinely different words", () => {
    expect(tokensFuzzyEqual("docker", "python")).toBe(false);
    expect(tokensFuzzyEqual("storage", "restore")).toBe(false);
  });
});

describe("prefixAwareScore", () => {
  it("treats the final token as a prefix while typing", () => {
    expect(prefixAwareScore(["mac", "stor"], ["mac", "storage", "full"])).toBeGreaterThan(0.7);
  });

  it("does not prefix-match earlier tokens", () => {
    expect(prefixAwareScore(["stor", "mac"], ["mac", "storage", "full"])).toBeLessThan(
      prefixAwareScore(["mac", "stor"], ["mac", "storage", "full"]),
    );
  });

  it("ignores prefixes shorter than 3 characters", () => {
    expect(prefixAwareScore(["mac", "st"], ["mac", "storage", "full"])).toBeLessThan(0.5);
  });

  it("does not let a long rambling prompt dilute the match", () => {
    const member = ["remove", "claude", "contributor", "github"];
    const rambling = [
      "hey", "wondering", "remove", "claude", "contributor", "github",
      "repo", "showing", "everywhere", "annoying", "morning", "coffee",
    ];
    // The denominator is capped, so the rambling prompt still clears the bar.
    expect(prefixAwareScore(rambling, member)).toBeGreaterThanOrEqual(0.7);
    expect(prefixAwareScore(member, member)).toBe(1);
  });
});

describe("matchLiveQuery", () => {
  it("matches a half-typed query against an existing problem", () => {
    const match = matchLiveQuery(macStorageState(), "mac stor");
    expect(match).not.toBeNull();
    expect(match!.title.toLowerCase()).toContain("storage");
    expect(match!.dayCount).toBe(2);
  });

  it("returns ranked likely-solution candidates with page ids for quick actions", () => {
    const match = matchLiveQuery(macStorageState(), "mac storage full");
    expect(match!.solution).toBeUndefined();
    expect(match!.candidates.length).toBeGreaterThan(0);
    expect(match!.candidates[0].domain).toBe("support.apple.com");
    expect(match!.candidates[0].pageId).toMatch(/^p-/);
    expect(match!.candidates[0].reason).toBeTruthy();
  });

  it("returns the saved solution page and note when solved", () => {
    const state = macStorageState();
    const cluster = Object.values(state.clusters)[0];
    cluster.status = "solved";
    cluster.solutionPageId = cluster.pageIds[0];
    cluster.note = "Ran docker system prune";
    const match = matchLiveQuery(state, "mac storage full again");
    expect(match!.status).toBe("solved");
    expect(match!.solution).toBeDefined();
    expect(match!.note).toBe("Ran docker system prune");
    expect(match!.candidates.every((p) => p.url !== match!.solution!.url)).toBe(true);
  });

  it("does not match unrelated queries", () => {
    expect(matchLiveQuery(macStorageState(), "best restaurants in paris")).toBeNull();
  });

  it("does not confuse a distinctive product with a generic AI-code search", () => {
    const state = emptyState();
    ingestVisits(state, [
      { url: g("searchzgpt code ai"), title: "search", visitedAt: NOON - 2 * DAY },
      { url: g("searchzgpt ai code tool"), title: "search", visitedAt: NOON - DAY },
      {
        url: "https://example.com/searchzgpt",
        title: "SearchzGPT AI coding tool",
        visitedAt: NOON - DAY + MIN,
      },
    ]);
    expect(matchLiveQuery(state, "k3 code ai", NOON)).toBeNull();
  });

  it("shows a research-only reminder when no prior page is relevant", () => {
    const state = emptyState();
    ingestVisits(state, [
      { url: g("codex desktop app"), title: "search", visitedAt: NOON - 2 * DAY },
      {
        url: "https://example.com/produtividade",
        title: "Produtividade para TDAH e Autismo",
        visitedAt: NOON - 2 * DAY + MIN,
      },
      { url: g("openai codex desktop app"), title: "search", visitedAt: NOON - DAY },
    ]);
    const match = matchLiveQuery(state, "codex desktop app", NOON);
    expect(match).not.toBeNull();
    expect(match!.candidates).toHaveLength(0);
  });

  it("abstains when two clusters are equally plausible", () => {
    const state = emptyState();
    const first = toSearchRecord(g("codex desktop app"), NOON - 2 * DAY, [])!;
    const second = toSearchRecord(g("codex desktop software"), NOON - DAY, [])!;
    state.searches = { [first.id]: first, [second.id]: second };
    state.clusters = {
      first: {
        id: "first",
        title: "Codex app",
        searchRecordIds: [first.id],
        pageIds: [],
        status: "solved",
        note: "First note",
        createdAt: first.searchedAt,
        updatedAt: first.searchedAt,
      },
      second: {
        id: "second",
        title: "Codex software",
        searchRecordIds: [second.id],
        pageIds: [],
        status: "solved",
        note: "Second note",
        createdAt: second.searchedAt,
        updatedAt: second.searchedAt,
      },
    };
    expect(matchLiveQuery(state, "codex desktop guide", NOON)).toBeNull();
  });

  it("keeps an explicitly confirmed page even when metadata looks unrelated", () => {
    const state = emptyState();
    ingestVisits(state, [
      { url: g("codex desktop app"), title: "search", visitedAt: NOON - 2 * DAY },
      {
        url: "https://example.com/produtividade",
        title: "Produtividade para TDAH e Autismo",
        visitedAt: NOON - 2 * DAY + MIN,
      },
      { url: g("openai codex desktop app"), title: "search", visitedAt: NOON - DAY },
    ]);
    const cluster = Object.values(state.clusters)[0];
    cluster.status = "solved";
    cluster.solutionPageId = cluster.pageIds[0];
    const match = matchLiveQuery(state, "codex desktop app", NOON);
    expect(match!.solution?.pageId).toBe(cluster.pageIds[0]);
  });

  it("never matches ignored problems", () => {
    const state = macStorageState();
    Object.values(state.clusters)[0].status = "ignored";
    expect(matchLiveQuery(state, "mac storage full")).toBeNull();
  });

  it("suppresses reminders for the session the user is in right now", () => {
    const state = emptyState();
    const HOUR = 60 * 60 * 1000;
    ingestVisits(state, [
      { url: g("mac storage full"), title: "search", visitedAt: NOON - 10 * MIN },
      { url: "https://support.apple.com/102624", title: "Apple", visitedAt: NOON - 8 * MIN },
    ]);
    expect(matchLiveQuery(state, "mac storage full", NOON)).toBeNull();
    // …but the same research from a few hours earlier IS worth surfacing.
    expect(matchLiveQuery(state, "mac storage full", NOON + 3 * HOUR)).not.toBeNull();
  });

  it("suppresses single-day problems with nothing useful to show", () => {
    const state = emptyState();
    integrateSearches(state, [
      toSearchRecord(g("mac storage full"), NOON - 2 * 60 * 60 * 1000, [])!,
      toSearchRecord(g("mac storage cleanup"), NOON - 60 * 60 * 1000, [])!,
    ]);
    expect(matchLiveQuery(state, "mac storage full", NOON)).toBeNull();
  });

  it("always matches solved problems, even single-day ones", () => {
    const state = emptyState();
    ingestVisits(state, [
      { url: g("mac storage full"), title: "search", visitedAt: NOON - 20 * MIN },
      { url: "https://support.apple.com/102624", title: "Apple", visitedAt: NOON - 18 * MIN },
    ]);
    const cluster = Object.values(state.clusters)[0];
    cluster.status = "solved";
    cluster.solutionPageId = cluster.pageIds[0];
    const match = matchLiveQuery(state, "mac storage full", NOON);
    expect(match).not.toBeNull();
    expect(match!.solution).toBeDefined();
  });

  it("requires at least two meaningful tokens", () => {
    expect(matchLiveQuery(macStorageState(), "mac")).toBeNull();
  });
});
