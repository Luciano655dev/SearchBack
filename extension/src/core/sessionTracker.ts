import type { SearchbackConfig, SearchRecord, VisitedPage } from "./types";
import { isGoogleSearchUrl } from "./extractQuery";
import { pageId } from "./ids";

export type HistoryVisit = {
  url: string;
  title: string;
  visitedAt: number;
};

const IGNORED_PROTOCOLS = ["chrome:", "chrome-extension:", "about:", "edge:", "brave:", "file:", "data:", "javascript:", "view-source:"];

export function isTrackablePage(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (IGNORED_PROTOCOLS.includes(parsed.protocol)) return false;
  // Search-result pages themselves are never "pages visited for a problem".
  if (isGoogleSearchUrl(url)) return false;
  return true;
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Attributes visited pages to searches. A page belongs to the most recent
 * search that happened before it, as long as the gap is within the session
 * window. A newer search naturally ends the previous session because it
 * becomes the "most recent search" for later visits.
 */
export function collectPagesForSearches(
  searches: SearchRecord[],
  visits: HistoryVisit[],
  config: Pick<SearchbackConfig, "sessionWindowMs">,
): VisitedPage[] {
  const orderedSearches = [...searches].sort((a, b) => a.searchedAt - b.searchedAt);
  const pages: VisitedPage[] = [];
  const seenPerSearch = new Map<string, Set<string>>();

  for (const visit of visits) {
    if (!isTrackablePage(visit.url)) continue;

    let owner: SearchRecord | null = null;
    for (const search of orderedSearches) {
      if (search.searchedAt > visit.visitedAt) break;
      if (visit.visitedAt - search.searchedAt <= config.sessionWindowMs) owner = search;
    }
    if (!owner) continue;

    const seen = seenPerSearch.get(owner.id) ?? new Set<string>();
    if (seen.has(visit.url)) continue;
    seen.add(visit.url);
    seenPerSearch.set(owner.id, seen);

    pages.push({
      id: pageId(visit.url, owner.id),
      title: visit.title || visit.url,
      url: visit.url,
      domain: domainOf(visit.url),
      visitedAt: visit.visitedAt,
      searchRecordId: owner.id,
    });
  }
  return pages;
}
