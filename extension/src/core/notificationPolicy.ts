import type { SearchbackConfig, SearchbackState, ProblemCluster } from "./types";
import { clusterDays } from "./clustering";
import { localDayKey } from "./dates";

/**
 * Whether a "You searched for this before" notification may be shown for a
 * cluster right now. The similarity check happened before calling this —
 * this gate is only about respecting the user.
 */
export function shouldNotify(
  cluster: ProblemCluster,
  state: SearchbackState,
  now: number,
  config: Pick<SearchbackConfig, "notificationCooldownMs"> = state.config,
): boolean {
  if (cluster.status === "ignored") return false;

  // Only remind about problems from a *previous* day; repeating a search
  // within the same day is normal research, not a loop.
  const today = localDayKey(now);
  const hasEarlierDay = clusterDays(cluster, state).some((day) => day < today);
  if (!hasEarlierDay) return false;

  if (cluster.lastNotifiedAt != null && now - cluster.lastNotifiedAt < config.notificationCooldownMs) {
    return false;
  }
  return true;
}
