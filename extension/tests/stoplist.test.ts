import { describe, expect, it } from "vitest";
import { isNavigationalQuery, isTooShort } from "../src/core/stoplist";
import { toSearchRecord } from "../src/core/ingest";

function g(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

describe("navigational search detection", () => {
  it("ignores plain destination searches", () => {
    for (const q of ["youtube", "gmail", "github", "weather", "YouTube"]) {
      expect(isNavigationalQuery(q), q).toBe(true);
    }
  });

  it("ignores destination + trivial suffix", () => {
    expect(isNavigationalQuery("gmail login")).toBe(true);
    expect(isNavigationalQuery("youtube.com")).toBe(true);
  });

  it("keeps problem searches that merely mention a destination", () => {
    expect(isNavigationalQuery("youtube videos not loading")).toBe(false);
    expect(isNavigationalQuery("github actions cache not working")).toBe(false);
  });

  it("supports user-configured extra stop queries", () => {
    expect(isNavigationalQuery("jira", ["jira"])).toBe(true);
    expect(isNavigationalQuery("jira", [])).toBe(false);
  });

  it("flags extremely short queries", () => {
    expect(isTooShort("ab")).toBe(true);
    expect(isTooShort("mac storage")).toBe(false);
  });
});

describe("toSearchRecord filtering", () => {
  it("returns null for navigational searches", () => {
    expect(toSearchRecord(g("youtube"), Date.now(), [])).toBeNull();
    expect(toSearchRecord(g("weather"), Date.now(), [])).toBeNull();
  });

  it("returns null for single-meaningful-token queries", () => {
    expect(toSearchRecord(g("docker"), Date.now(), [])).toBeNull();
  });

  it("creates a record for problem searches", () => {
    const record = toSearchRecord(g("why is my mac storage full"), 1000, []);
    expect(record).not.toBeNull();
    expect(record!.query).toBe("why is my mac storage full");
    expect(record!.normalizedQuery).toBe("mac storage full");
    expect(record!.searchedAt).toBe(1000);
  });

  it("gives the same record id for the same query and time", () => {
    const a = toSearchRecord(g("mac storage full"), 1000, []);
    const b = toSearchRecord(g("mac storage full"), 1000, []);
    expect(a!.id).toBe(b!.id);
  });
});
