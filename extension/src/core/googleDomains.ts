/**
 * Google domains where the in-page banner (content script) runs.
 * MUST stay in sync with content_scripts.matches in public/manifest.json.
 * On these domains the banner is the reminder; system notifications are
 * reserved for Google domains outside this list.
 */
export const BANNER_DOMAINS = [
  "google.com",
  "google.com.br",
  "google.co.uk",
  "google.ca",
  "google.com.au",
  "google.de",
  "google.fr",
  "google.es",
  "google.it",
  "google.nl",
  "google.pt",
  "google.com.mx",
  "google.com.ar",
  "google.co.in",
  "google.co.jp",
];

export function isBannerCoveredUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return BANNER_DOMAINS.some((d) => hostname === d || hostname.endsWith(`.${d}`));
  } catch {
    return false;
  }
}
