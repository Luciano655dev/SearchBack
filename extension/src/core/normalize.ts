/**
 * Query normalization: lowercase, strip punctuation/accents, drop filler
 * words, light stemming, and a small alias map so obvious synonyms
 * ("disk space" vs "storage") land on the same token.
 */
const FILLER_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "my", "your", "our", "their", "his", "her",
  "i", "you", "we", "it", "its", "this", "that", "these", "those",
  "why", "what", "when", "where", "which", "who", "whom",
  "how", "do", "does", "did", "can", "cant", "could", "should", "would", "will",
  "to", "of", "in", "on", "for", "with", "at", "by", "from", "into",
  "and", "or", "so", "too", "very", "really", "please", "just",
  "me", "get", "got", "have", "has", "had", "there", "up", "out", "still", "keep", "keeps",
  "much", "many", "more", "most", "lot", "lots", "some", "any",
  "as", "if", "than", "then", "also", "else",
  // Contraction debris: apostrophes are stripped, so "can't" tokenizes to
  // "can" + "t", "what's" to "what" + "s" — drop the orphans and stubs.
  "t", "s", "d", "m", "ll", "re", "ve",
  "don", "didn", "doesn", "isn", "wasn", "aren", "won", "wont", "cannot",
  "couldn", "shouldn", "wouldn", "hasn", "haven", "im", "ive", "id",
]);

/**
 * Aliases are applied after stemming, so keys must be stems. Small on
 * purpose: this only bridges near-synonyms that show up constantly in
 * troubleshooting searches.
 */
const STEM_ALIASES: Record<string, string> = {
  space: "storage",
  disk: "storage",
  ssd: "storage",
  macos: "mac",
  osx: "mac",
  macbook: "mac",
  ram: "memory",
  err: "error",
  bug: "error",
  issue: "error",
  setup: "configure",
  config: "configure",
  configur: "configure",
  delete: "remove",
  delet: "remove",
  uninstall: "remove",
};

export function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Very light stemming — just enough to merge plurals and -ing/-ed forms. */
export function stem(word: string): string {
  if (word.length >= 5 && word.endsWith("ies")) return word.slice(0, -3) + "y";
  if (word.length >= 6 && word.endsWith("ing") && word.length - 3 >= 3) return word.slice(0, -3);
  if (word.length >= 5 && word.endsWith("ed") && word.length - 2 >= 3) return word.slice(0, -2);
  if (
    word.length >= 5 &&
    (word.endsWith("ses") || word.endsWith("xes") || word.endsWith("zes") || word.endsWith("ches") || word.endsWith("shes"))
  ) {
    return word.slice(0, -2);
  }
  if (word.length >= 4 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

export type NormalizedQuery = {
  /** Deduplicated meaning-bearing tokens, stemmed and aliased. */
  tokens: string[];
  /** tokens joined with single spaces — stored on SearchRecord. */
  normalized: string;
  /** stem token -> original surface word, used for readable titles. */
  surfaceByToken: Map<string, string>;
};

export function normalizeQuery(query: string): NormalizedQuery {
  const tokens: string[] = [];
  const surfaceByToken = new Map<string, string>();
  const seen = new Set<string>();
  for (const word of tokenize(query)) {
    if (FILLER_WORDS.has(word)) continue;
    const stemmed = stem(word);
    const token = STEM_ALIASES[stemmed] ?? stemmed;
    if (seen.has(token)) continue;
    seen.add(token);
    tokens.push(token);
    if (!surfaceByToken.has(token)) surfaceByToken.set(token, word);
  }
  return { tokens, normalized: tokens.join(" "), surfaceByToken };
}
