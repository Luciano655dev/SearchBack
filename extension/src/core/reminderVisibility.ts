import type { SearchbackConfig } from "./types";
import { isChatHost } from "./chatHosts";
import { isBannerCoveredUrl } from "./googleDomains";

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function hostIsBlocked(hostname: string, blockedHosts: string[]): boolean {
  return blockedHosts.some((blocked) => hostname === blocked || hostname.endsWith(`.${blocked}`));
}

/** Whether an in-page reminder may be rendered at this URL. */
export function reminderAllowedAtUrl(config: SearchbackConfig, url: string): boolean {
  if (!config.remindersEnabled) return false;
  const hostname = hostnameOf(url);
  if (!hostname || hostIsBlocked(hostname, config.blockedReminderHosts)) return false;
  if (isChatHost(hostname)) return config.showOnChatbots;
  if (isBannerCoveredUrl(url)) return config.showOnGoogle;
  return false;
}
