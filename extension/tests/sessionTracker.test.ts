import { describe, expect, it } from "vitest";
import { collectPagesForSearches, type HistoryVisit } from "../src/core/sessionTracker";
import { toSearchRecord } from "../src/core/ingest";
import { DEFAULT_CONFIG } from "../src/core/types";

const MIN = 60 * 1000;
const T0 = 1_700_000_000_000;

function g(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function search(query: string, at: number) {
  const r = toSearchRecord(g(query), at, []);
  if (!r) throw new Error(`fixture query filtered out: ${query}`);
  return r;
}

function visit(url: string, at: number, title = "page"): HistoryVisit {
  return { url, title, visitedAt: at };
}

describe("collectPagesForSearches", () => {
  it("attributes pages opened within the session window to the search", () => {
    const s = search("mac storage full", T0);
    const pages = collectPagesForSearches(
      [s],
      [visit("https://support.apple.com/102624", T0 + 2 * MIN), visit("https://example.com/guide", T0 + 10 * MIN)],
      DEFAULT_CONFIG,
    );
    expect(pages).toHaveLength(2);
    expect(pages.every((p) => p.searchRecordId === s.id)).toBe(true);
    expect(pages[0].domain).toBe("support.apple.com");
  });

  it("ignores pages outside the session window", () => {
    const s = search("mac storage full", T0);
    const pages = collectPagesForSearches([s], [visit("https://example.com/late", T0 + 16 * MIN)], DEFAULT_CONFIG);
    expect(pages).toHaveLength(0);
  });

  it("hands pages to the newer search once another search starts", () => {
    const a = search("mac storage full", T0);
    const b = search("best pizza dough recipe", T0 + 5 * MIN);
    const pages = collectPagesForSearches(
      [a, b],
      [visit("https://apple.com/storage", T0 + 2 * MIN), visit("https://pizza.example/dough", T0 + 7 * MIN)],
      DEFAULT_CONFIG,
    );
    expect(pages.find((p) => p.url.includes("apple"))!.searchRecordId).toBe(a.id);
    expect(pages.find((p) => p.url.includes("pizza"))!.searchRecordId).toBe(b.id);
  });

  it("never records Google result pages or internal pages", () => {
    const s = search("mac storage full", T0);
    const pages = collectPagesForSearches(
      [s],
      [
        visit(g("mac storage full more results"), T0 + MIN),
        visit("chrome://settings", T0 + MIN),
        visit("chrome-extension://abc/dashboard.html", T0 + MIN),
        visit("about:blank", T0 + MIN),
      ],
      DEFAULT_CONFIG,
    );
    expect(pages).toHaveLength(0);
  });

  it("deduplicates repeated visits to the same URL within one search", () => {
    const s = search("mac storage full", T0);
    const pages = collectPagesForSearches(
      [s],
      [visit("https://example.com/a", T0 + MIN), visit("https://example.com/a", T0 + 3 * MIN)],
      DEFAULT_CONFIG,
    );
    expect(pages).toHaveLength(1);
  });

  it("ignores pages visited before the search", () => {
    const s = search("mac storage full", T0);
    const pages = collectPagesForSearches([s], [visit("https://example.com/early", T0 - MIN)], DEFAULT_CONFIG);
    expect(pages).toHaveLength(0);
  });
});
