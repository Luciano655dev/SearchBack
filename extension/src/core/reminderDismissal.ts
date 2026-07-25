/**
 * A dismissal belongs to the exact query being shown, not the whole problem
 * cluster. This lets a related but meaningfully different search remind again.
 */
export function reminderDismissKey(clusterId: string, query: string): string {
  const normalizedQuery = query.trim().toLowerCase().replace(/\s+/g, " ");
  return `${clusterId}|${normalizedQuery}`;
}
