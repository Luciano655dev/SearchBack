/**
 * Site icons come from Chrome's LOCAL favicon cache via the extension's
 * _favicon endpoint (requires the "favicon" permission). No network request
 * is ever made for them — important, because fetching icons from a remote
 * service would leak the user's research domains.
 */
export function faviconUrl(pageUrl: string): string | null {
  if (typeof chrome === "undefined" || !chrome.runtime?.getURL) return null;
  return `${chrome.runtime.getURL("_favicon/")}?pageUrl=${encodeURIComponent(pageUrl)}&size=32`;
}
