import { describe, expect, it } from "vitest";
import { extractGoogleQuery, isGoogleSearchUrl } from "../src/core/extractQuery";

describe("extractGoogleQuery", () => {
  it("extracts the q parameter from a Google search URL", () => {
    expect(extractGoogleQuery("https://www.google.com/search?q=mac+storage+full")).toBe("mac storage full");
  });

  it("handles encoded characters", () => {
    expect(extractGoogleQuery("https://www.google.com/search?q=what%27s%20new%20in%20node")).toBe(
      "what's new in node",
    );
  });

  it("supports country Google domains", () => {
    expect(extractGoogleQuery("https://www.google.com.br/search?q=erro+docker")).toBe("erro docker");
    expect(extractGoogleQuery("https://google.de/search?q=fehler+beheben")).toBe("fehler beheben");
  });

  it("returns null for non-search Google pages", () => {
    expect(extractGoogleQuery("https://www.google.com/maps")).toBeNull();
    expect(extractGoogleQuery("https://mail.google.com/mail/u/0/")).toBeNull();
    expect(extractGoogleQuery("https://www.google.com/")).toBeNull();
  });

  it("returns null for non-Google sites, including lookalikes", () => {
    expect(extractGoogleQuery("https://www.bing.com/search?q=hello+world")).toBeNull();
    expect(extractGoogleQuery("https://notgoogle.com/search?q=phish")).toBeNull();
    expect(extractGoogleQuery("https://google.evil.com/search?q=phish")).toBeNull();
  });

  it("returns null for empty queries and invalid URLs", () => {
    expect(extractGoogleQuery("https://www.google.com/search?q=")).toBeNull();
    expect(extractGoogleQuery("https://www.google.com/search?q=%20%20")).toBeNull();
    expect(extractGoogleQuery("not a url")).toBeNull();
  });

  it("isGoogleSearchUrl rejects chrome-internal urls", () => {
    expect(isGoogleSearchUrl("chrome://settings")).toBe(false);
  });
});
