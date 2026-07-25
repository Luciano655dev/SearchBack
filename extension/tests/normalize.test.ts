import { describe, expect, it } from "vitest";
import { normalizeQuery, stem, tokenize } from "../src/core/normalize";

describe("tokenize", () => {
  it("lowercases and strips punctuation", () => {
    expect(tokenize("Why is my MAC storage full?!")).toEqual(["why", "is", "my", "mac", "storage", "full"]);
  });

  it("collapses duplicate whitespace", () => {
    expect(tokenize("docker   disk    space")).toEqual(["docker", "disk", "space"]);
  });
});

describe("stem", () => {
  it("merges plurals", () => {
    expect(stem("applications")).toBe("application");
    expect(stem("errors")).toBe("error");
  });

  it("does not mangle short words", () => {
    expect(stem("mac")).toBe("mac");
    expect(stem("ios")).toBe("ios");
    expect(stem("less")).toBe("less");
  });
});

describe("normalizeQuery", () => {
  it("removes filler words", () => {
    const { tokens } = normalizeQuery("why is my mac storage full");
    expect(tokens).toEqual(["mac", "storage", "full"]);
  });

  it("maps close synonyms onto one token", () => {
    const a = normalizeQuery("docker disk space");
    expect(a.tokens).toContain("storage");
  });

  it("deduplicates tokens", () => {
    const { tokens } = normalizeQuery("storage storage space disk");
    expect(tokens).toEqual(["storage"]);
  });

  it("produces identical normalizations for reworded searches", () => {
    const a = normalizeQuery("why is my mac storage full");
    const b = normalizeQuery("Mac storage full!!!");
    expect(a.normalized).toBe(b.normalized);
  });

  it("drops contraction debris", () => {
    expect(normalizeQuery("can't connect to wifi").tokens).toEqual(["connect", "wifi"]);
    expect(normalizeQuery("what's wrong with my dns").tokens).toEqual(["wrong", "dns"]);
    expect(normalizeQuery("mac won't boot").tokens).toEqual(["mac", "boot"]);
  });

  it("treats delete/uninstall as remove, and bug/issue as error", () => {
    expect(normalizeQuery("delete user from github").normalized).toBe(
      normalizeQuery("remove user from github").normalized,
    );
    expect(normalizeQuery("app bug on startup").normalized).toBe(
      normalizeQuery("app error on startup").normalized,
    );
  });
});
