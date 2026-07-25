/** Navigation helpers that degrade gracefully in the vite dev server. */

function hasChromeTabs(): boolean {
  return typeof chrome !== "undefined" && Boolean(chrome.tabs?.create);
}

export function dashboardUrl(hash = "#/"): string {
  if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
    return chrome.runtime.getURL(`dashboard.html${hash}`);
  }
  return `/dashboard.html${hash}`;
}

export function openDashboard(hash = "#/"): void {
  if (hasChromeTabs()) {
    void chrome.tabs.create({ url: dashboardUrl(hash) });
    window.close();
  } else {
    window.location.href = dashboardUrl(hash);
  }
}

export function openExternal(url: string): void {
  if (hasChromeTabs()) {
    void chrome.tabs.create({ url });
  } else {
    window.open(url, "_blank", "noopener");
  }
}
