/**
 * Navigational queries: the user is going somewhere, not solving a problem.
 * Users can extend this via config.extraStopQueries.
 */
export const DEFAULT_STOP_QUERIES = [
  "youtube",
  "gmail",
  "github",
  "google",
  "facebook",
  "instagram",
  "twitter",
  "x",
  "reddit",
  "linkedin",
  "netflix",
  "amazon",
  "whatsapp",
  "telegram",
  "spotify",
  "maps",
  "translate",
  "weather",
  "news",
  "chatgpt",
  "claude",
  "outlook",
  "hotmail",
  "yahoo",
  "twitch",
  "tiktok",
  "pinterest",
  "ebay",
  "wikipedia",
];

const NAVIGATIONAL_SUFFIXES = ["login", "sign in", "signin", "app", "com", "website", "site"];

/**
 * A query is navigational when it is just a known destination, optionally
 * followed by a trivial suffix like "login". Runs on the raw lowercase query
 * (not the normalized one) so stemming can't mangle brand names.
 */
export function isNavigationalQuery(rawQuery: string, extraStopQueries: string[] = []): boolean {
  const cleaned = rawQuery.toLowerCase().replace(/[^a-z0-9\s.]/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return true;
  const stoplist = new Set([...DEFAULT_STOP_QUERIES, ...extraStopQueries.map((q) => q.toLowerCase())]);
  const noTld = cleaned.replace(/\.(com|org|net|io|dev|app|ai|br|co)$/g, "");
  if (stoplist.has(cleaned) || stoplist.has(noTld)) return true;
  for (const suffix of NAVIGATIONAL_SUFFIXES) {
    if (cleaned.endsWith(` ${suffix}`) && stoplist.has(cleaned.slice(0, -suffix.length - 1).trim())) {
      return true;
    }
  }
  return false;
}

/** Extremely short queries carry too little signal to group reliably. */
export function isTooShort(rawQuery: string): boolean {
  return rawQuery.trim().length < 4;
}
