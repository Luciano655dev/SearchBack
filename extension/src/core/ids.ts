/**
 * Deterministic ids so re-scanning the same history never creates duplicates.
 * djb2 is enough here: ids only need to be stable and collision-rare at the
 * scale of one person's browsing history.
 */
function djb2(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

export function searchId(query: string, searchedAt: number): string {
  return `s-${djb2(`${query}|${searchedAt}`)}`;
}

export function pageId(url: string, searchRecordId: string): string {
  return `p-${djb2(`${url}|${searchRecordId}`)}`;
}

export function clusterId(seedSearchId: string): string {
  return `c-${djb2(seedSearchId)}`;
}
