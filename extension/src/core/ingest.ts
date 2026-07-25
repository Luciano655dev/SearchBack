import type { SearchbackState, SearchRecord, VisitedPage } from "./types";
import { extractGoogleQuery } from "./extractQuery";
import { isNavigationalQuery, isTooShort } from "./stoplist";
import { normalizeQuery } from "./normalize";
import { pageId, searchId } from "./ids";
import { integrateSearches } from "./clustering";
import { collectPagesForSearches, type HistoryVisit } from "./sessionTracker";

/**
 * Turns problem-solving text (a Google query or an AI chat prompt) into a
 * SearchRecord; returns null for navigational, empty, or too-short text.
 */
export function promptToSearchRecord(
  text: string,
  searchedAt: number,
  sourceUrl: string,
  extraStopQueries: string[],
): SearchRecord | null {
  const query = text.trim().replace(/\s+/g, " ").slice(0, 200);
  if (!query) return null;
  if (isTooShort(query)) return null;
  if (isNavigationalQuery(query, extraStopQueries)) return null;
  const { tokens, normalized } = normalizeQuery(query);
  // Single-token queries group too aggressively; require two meaningful tokens.
  if (tokens.length < 2) return null;
  return {
    id: searchId(query, searchedAt),
    query,
    normalizedQuery: normalized,
    searchedAt,
    sourceUrl,
  };
}

/**
 * Turns a raw visit into a SearchRecord if it is a problem-solving Google
 * search; returns null otherwise.
 */
export function toSearchRecord(
  url: string,
  visitedAt: number,
  extraStopQueries: string[],
): SearchRecord | null {
  const query = extractGoogleQuery(url);
  if (!query) return null;
  return promptToSearchRecord(query, visitedAt, url, extraStopQueries);
}

/**
 * Full ingestion pass over a batch of history visits (sorted or not):
 * extract searches, attribute follow-up pages, cluster. Mutates state.
 */
export function ingestVisits(state: SearchbackState, visits: HistoryVisit[]): void {
  const ordered = [...visits].sort((a, b) => a.visitedAt - b.visitedAt);

  const suppressedSearches = new Set(state.meta.suppressedSearchIds);
  const newSearches: SearchRecord[] = [];
  for (const visit of ordered) {
    const record = toSearchRecord(visit.url, visit.visitedAt, state.config.extraStopQueries);
    if (record && !state.searches[record.id] && !suppressedSearches.has(record.id) && !isDuplicateSearch(state, record)) {
      newSearches.push(record);
    }
  }
  integrateSearches(state, newSearches);

  // Attribute pages against ALL known searches in the batch window, not just
  // new ones, so a re-scan can still attach pages to older searches.
  const windowStart = ordered.length > 0 ? ordered[0].visitedAt - state.config.sessionWindowMs : 0;
  const relevantSearches = Object.values(state.searches).filter((s) => s.searchedAt >= windowStart);
  const pages = collectPagesForSearches(relevantSearches, ordered, state.config);

  const searchToCluster = new Map<string, string>();
  for (const cluster of Object.values(state.clusters)) {
    for (const sid of cluster.searchRecordIds) searchToCluster.set(sid, cluster.id);
  }
  const suppressedPages = new Set(state.meta.suppressedPageIds);
  for (const page of pages) {
    if (state.pages[page.id] || suppressedPages.has(page.id)) continue;
    state.pages[page.id] = page;
    const cid = searchToCluster.get(page.searchRecordId);
    if (cid && !state.clusters[cid].pageIds.includes(page.id)) {
      state.clusters[cid].pageIds.push(page.id);
    }
  }
}

/**
 * The live tab listener and the periodic history scan can both observe the
 * same search with slightly different timestamps; treat same-query records
 * within 2 minutes as one search.
 */
function isDuplicateSearch(state: SearchbackState, record: SearchRecord): boolean {
  return findRecentTwin(state, record.normalizedQuery, record.searchedAt) !== null;
}

function findRecentTwin(state: SearchbackState, normalizedQuery: string, at: number): SearchRecord | null {
  return (
    Object.values(state.searches).find(
      (s) => s.normalizedQuery === normalizedQuery && Math.abs(s.searchedAt - at) < 2 * 60 * 1000,
    ) ?? null
  );
}

/** Site roots and "new chat" paths — not links to a specific conversation. */
const NON_CONVERSATION_SEGMENTS = new Set(["new", "app", "chat", "chats", "search", "c"]);

function isConversationUrl(url: string): boolean {
  try {
    const segments = new URL(url).pathname.split("/").filter(Boolean);
    if (segments.length === 0) return false;
    if (segments.length === 1 && NON_CONVERSATION_SEGMENTS.has(segments[0])) return false;
    return true;
  } catch {
    return false;
  }
}

const GENERIC_CHAT_TITLE = /^(chatgpt|claude|gemini|perplexity|copilot|grok|deepseek|new chat)\b/i;

export type ChatInteraction = {
  prompt: string;
  askedAt: number;
  /** The conversation URL, read a moment after sending (SPAs update it late). */
  url: string;
  /** document.title at that moment; may still be the generic site name. */
  title: string;
};

/**
 * A prompt the user actually SENT to an AI chatbot counts as researching
 * the problem, and the conversation itself becomes a revisitable page —
 * so next time Searchback can hand back the link to the last chat.
 * Mutates state; returns the cluster id the prompt landed in, or null if
 * the prompt was filtered out.
 */
export function recordChatInteraction(state: SearchbackState, interaction: ChatInteraction): string | null {
  const created = promptToSearchRecord(
    interaction.prompt,
    interaction.askedAt,
    interaction.url,
    state.config.extraStopQueries,
  );
  if (!created) return null;

  // Enter-key capture and composer-clear capture can both fire; reuse the
  // existing record so the conversation page attaches to one search.
  let record = findRecentTwin(state, created.normalizedQuery, created.searchedAt);
  if (!record) {
    integrateSearches(state, [created]);
    record = state.searches[created.id] ?? null;
  }
  if (!record) return null;

  const cluster = Object.values(state.clusters).find((c) => c.searchRecordIds.includes(record!.id));
  if (!cluster) return null;

  if (isConversationUrl(interaction.url)) {
    const rawTitle = interaction.title.trim();
    const title =
      rawTitle && !GENERIC_CHAT_TITLE.test(rawTitle)
        ? rawTitle
        : `Chat: "${interaction.prompt.trim().slice(0, 60)}"`;
    const page: VisitedPage = {
      id: pageId(interaction.url, record.id),
      title,
      url: interaction.url,
      domain: new URL(interaction.url).hostname.replace(/^www\./, ""),
      visitedAt: interaction.askedAt,
      searchRecordId: record.id,
    };
    if (!state.pages[page.id] && !state.meta.suppressedPageIds.includes(page.id)) {
      state.pages[page.id] = page;
      if (!cluster.pageIds.includes(page.id)) cluster.pageIds.push(page.id);
    }
  }
  return cluster.id;
}
