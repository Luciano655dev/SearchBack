/**
 * Typo-tolerant token equality: small edit distance, or an anagram of the
 * same letters — which catches transposition typos like "lcuade" for
 * "claude". Short tokens are never fuzzed.
 */
export function tokensFuzzyEqual(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 2) return false;
  if (a.length >= 6 && b.length >= 6 && isAnagram(a, b)) return true;
  const maxDistance = a.length >= 8 && b.length >= 8 ? 2 : a.length >= 5 && b.length >= 5 ? 1 : 0;
  if (maxDistance === 0) return false;
  return editDistance(a, b, maxDistance) <= maxDistance;
}

function isAnagram(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return [...a].sort().join("") === [...b].sort().join("");
}

/** Damerau-Levenshtein (OSA) distance, early-exiting above `max`. */
export function editDistance(a: string, b: string, max: number): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  let prevPrev: number[] = [];
  let prev = Array.from({ length: cols }, (_, j) => j);
  for (let i = 1; i < rows; i++) {
    const curr = [i];
    let rowMin = i;
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, prevPrev[j - 2] + 1);
      }
      curr.push(value);
      rowMin = Math.min(rowMin, value);
    }
    if (rowMin > max) return max + 1;
    prevPrev = prev;
    prev = curr;
  }
  return prev[cols - 1];
}
