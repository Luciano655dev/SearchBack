import type { SearchbackState, ProblemCluster, VisitedPage } from "./types";
import { clusterProfileTokens, tokensOf } from "./clustering";
import { normalizeQuery } from "./normalize";
import { evaluateMatch, type MatchEvidence } from "./relevance";
import { tokenWeights } from "./similarity";

export const PAGE_RELEVANCE_THRESHOLD = 0.3;

export type PageRelevance = MatchEvidence & {
  metadataTokens: string[];
};

const URL_NOISE = new Set([
  "com", "org", "net", "io", "dev", "www", "html", "htm", "php", "index",
]);

/** Page evidence available under Searchback's current, narrow permissions. */
export function pageMetadataTokens(page: Pick<VisitedPage, "title" | "url">): string[] {
  let urlText = "";
  try {
    const url = new URL(page.url);
    const hostname = url.hostname.replace(/^www\./, "").replace(/[.-]+/g, " ");
    let pathname = url.pathname;
    try {
      pathname = decodeURIComponent(pathname);
    } catch {
      // A malformed escape should not make the whole page unusable.
    }
    urlText = `${hostname} ${pathname.replace(/[-_/.]+/g, " ")}`;
  } catch {
    urlText = page.url;
  }
  return normalizeQuery(`${page.title} ${urlText}`).tokens.filter(
    (token) => !URL_NOISE.has(token) && !/^\d+$/.test(token),
  );
}

/**
 * A page may agree with the exact search that opened it or with the stable
 * cluster topic. Either is valid, but timing alone is never sufficient.
 */
export function pageRelevance(
  cluster: ProblemCluster,
  state: SearchbackState,
  page: VisitedPage,
): PageRelevance {
  const metadataTokens = pageMetadataTokens(page);
  const weights = tokenWeights(state);
  const owner = state.searches[page.searchRecordId];
  const ownerEvidence = evaluateMatch(
    owner ? tokensOf(owner) : [],
    metadataTokens,
    weights,
    PAGE_RELEVANCE_THRESHOLD,
    "page",
  );
  const profileEvidence = evaluateMatch(
    clusterProfileTokens(cluster, state, weights),
    metadataTokens,
    weights,
    PAGE_RELEVANCE_THRESHOLD,
    "page",
  );
  const best = ownerEvidence.score >= profileEvidence.score ? ownerEvidence : profileEvidence;
  return { ...best, metadataTokens };
}
