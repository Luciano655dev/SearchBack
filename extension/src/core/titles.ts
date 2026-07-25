import { normalizeQuery, tokenize, stem, type NormalizedQuery } from "./normalize";
import { isDistinctiveToken } from "./similarity";

/**
 * Generates a short readable title from the cluster's queries: the tokens
 * shared by the most searches, rendered with the original words the user
 * typed. Works fully offline; an AI-based generator could replace this
 * behind the same signature.
 */
export function generateTitle(queries: string[]): string {
  if (queries.length === 0) return "Untitled problem";
  const normalized: NormalizedQuery[] = queries.map(normalizeQuery);

  // Frequency of each token across queries, plus the earliest position it
  // appeared at (used as a tie-breaker so word order feels natural).
  const freq = new Map<string, number>();
  const firstPos = new Map<string, number>();
  const surface = new Map<string, string>();
  normalized.forEach((nq) => {
    nq.tokens.forEach((token, position) => {
      freq.set(token, (freq.get(token) ?? 0) + 1);
      if (!firstPos.has(token)) firstPos.set(token, position);
      if (!surface.has(token)) surface.set(token, preferSurface(queries, token));
    });
  });

  const ranked = [...freq.keys()].sort((a, b) => {
    const byFreq = (freq.get(b) ?? 0) - (freq.get(a) ?? 0);
    if (byFreq !== 0) return byFreq;
    return (firstPos.get(a) ?? 0) - (firstPos.get(b) ?? 0);
  });

  const sharedDistinctive = ranked.filter(
    (token) => isDistinctiveToken(token) && (freq.get(token) ?? 0) >= 2,
  );
  const distinctive = ranked.filter(isDistinctiveToken);
  const preferred = sharedDistinctive.length > 0 ? sharedDistinctive : distinctive;
  const chosen = preferred.slice(0, 3);
  if (chosen.length === 0) return "Untitled problem";

  const words = chosen.map((t) => surface.get(t) ?? t);
  let title = words.join(" ");
  if (words.length <= 2) title += " problem";
  return title.charAt(0).toUpperCase() + title.slice(1);
}

/** Finds the original (unstemmed) word behind a token for display. */
function preferSurface(queries: string[], token: string): string {
  for (const q of queries) {
    for (const word of tokenize(q)) {
      if (stem(word) === token || word === token) return word;
    }
  }
  return token;
}
