import { describe, expect, it } from "vitest";
import { buildCorpusEngine, cosineEngine, tokenWeights } from "../src/core/similarity";
import { normalizeQuery } from "../src/core/normalize";
import { DEFAULT_CONFIG, emptyState } from "../src/core/types";
import { integrateSearches } from "../src/core/clustering";
import { toSearchRecord } from "../src/core/ingest";

function score(a: string, b: string): number {
  return cosineEngine.score(normalizeQuery(a).tokens, normalizeQuery(b).tokens);
}

const THRESHOLD = DEFAULT_CONFIG.similarityThreshold;

describe("similarity scoring", () => {
  it("scores identical queries as 1", () => {
    expect(score("mac storage full", "mac storage full")).toBe(1);
  });

  it("groups the spec fixture: mac storage searches", () => {
    expect(score("why is my mac storage full", "applications taking too much space mac")).toBeGreaterThanOrEqual(
      THRESHOLD,
    );
    expect(
      score("applications taking too much space mac", "docker using too much disk space mac"),
    ).toBeGreaterThanOrEqual(THRESHOLD);
  });

  it("does not group unrelated queries", () => {
    expect(score("mac storage full", "best restaurants in paris")).toBe(0);
  });

  it("does not group queries sharing only a generic platform word", () => {
    expect(score("mac storage full", "mac wifi keeps disconnecting")).toBeLessThan(THRESHOLD);
  });

  it("is symmetric", () => {
    const a = "free custom domain email";
    const b = "cheapest email hosting for domain";
    expect(score(a, b)).toBeCloseTo(score(b, a));
    expect(score(a, b)).toBeGreaterThanOrEqual(THRESHOLD);
  });

  it("returns 0 for empty token lists", () => {
    expect(cosineEngine.score([], ["a"])).toBe(0);
  });
});

describe("corpus-weighted engine", () => {
  const DAY = 24 * 60 * 60 * 1000;
  const NOON = new Date(2026, 6, 15, 12, 0, 0).getTime();

  function g(q: string): string {
    return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
  }

  /** Several distinct mac problems, so "mac" is corpus-common. */
  function macHeavyState() {
    const state = emptyState();
    integrateSearches(state, [
      toSearchRecord(g("mac storage full"), NOON - 9 * DAY, [])!,
      toSearchRecord(g("mac wifi keeps disconnecting"), NOON - 8 * DAY, [])!,
      toSearchRecord(g("mac battery draining fast"), NOON - 7 * DAY, [])!,
      toSearchRecord(g("mac screen flickering external monitor"), NOON - 6 * DAY, [])!,
      toSearchRecord(g("docker compose volumes not mounting"), NOON - 5 * DAY, [])!,
    ]);
    return state;
  }

  it("down-weights generic product words even before a corpus exists", () => {
    const engine = buildCorpusEngine(emptyState());
    const a = normalizeQuery("mac storage full").tokens;
    const b = normalizeQuery("applications taking too much space mac").tokens;
    expect(engine.score(a, b)).toBeGreaterThan(cosineEngine.score(a, b));
    expect(
      engine.score(normalizeQuery("k3 code ai").tokens, normalizeQuery("searchzgpt code ai").tokens),
    ).toBeLessThan(DEFAULT_CONFIG.similarityThreshold);
  });

  it("weights corpus-common tokens below distinctive ones", () => {
    const weights = tokenWeights(macHeavyState());
    expect(weights.get("mac")!).toBeLessThan(weights.get("docker")!);
  });

  it("scores a shared generic token lower than a shared distinctive token", () => {
    const engine = buildCorpusEngine(macHeavyState());
    // Both pairs share exactly one token out of comparable set sizes...
    const sharedGeneric = engine.score(
      normalizeQuery("mac storage full").tokens,
      normalizeQuery("mac fan loud").tokens,
    );
    const sharedRare = engine.score(
      normalizeQuery("docker storage full").tokens,
      normalizeQuery("docker fan loud").tokens,
    );
    // ...but sharing "docker" says much more than sharing "mac".
    expect(sharedRare).toBeGreaterThan(sharedGeneric);
  });

  it("gives partial credit for typo'd tokens", () => {
    const engine = buildCorpusEngine(emptyState());
    const score = engine.score(
      normalizeQuery("remove claude contributor github").tokens,
      normalizeQuery("remove lcuade github contributors").tokens,
    );
    expect(score).toBeGreaterThanOrEqual(DEFAULT_CONFIG.similarityThreshold);
  });
});
