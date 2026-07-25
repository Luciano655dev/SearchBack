/**
 * Google search detection. MVP supports Google only; other engines can be
 * added by extending GOOGLE_HOST with more matchers.
 */
const GOOGLE_HOST = /(^|\.)google\.[a-z]{2,3}(\.[a-z]{2})?$/;

export function isGoogleSearchUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return (
    (parsed.protocol === "https:" || parsed.protocol === "http:") &&
    GOOGLE_HOST.test(parsed.hostname) &&
    parsed.pathname === "/search" &&
    parsed.searchParams.has("q")
  );
}

/** Returns the raw query text of a Google search URL, or null. */
export function extractGoogleQuery(url: string): string | null {
  if (!isGoogleSearchUrl(url)) return null;
  const q = new URL(url).searchParams.get("q")?.trim() ?? "";
  return q.length > 0 ? q : null;
}
