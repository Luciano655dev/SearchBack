import { repository } from "../storage/repository";
import { ingestVisits, toSearchRecord, recordChatInteraction } from "../core/ingest";
import { integrateSearches, findBestCluster, isVisibleProblem, clusterDays } from "../core/clustering";
import { shouldNotify } from "../core/notificationPolicy";
import { matchLiveQuery } from "../core/liveMatch";
import { isBannerCoveredUrl } from "../core/googleDomains";
import type { SearchbackState, ProblemCluster } from "../core/types";
import type { HistoryVisit } from "../core/sessionTracker";
import { hostIsBlocked, hostnameOf, reminderAllowedAtUrl } from "../core/reminderVisibility";

const SCAN_ALARM = "loopback-scan";
const SCAN_PERIOD_MINUTES = 15;
// Re-scan slightly behind the last scan so a visit recorded while the
// service worker was asleep is never missed. Deterministic ids dedupe it.
const SCAN_OVERLAP_MS = 30 * 60 * 1000;

chrome.runtime.onInstalled.addListener(async (details) => {
  await chrome.alarms.create(SCAN_ALARM, { periodInMinutes: SCAN_PERIOD_MINUTES });
  if (details.reason === "install") {
    await chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html#/onboarding") });
    return;
  }
  await scanIfOnboarded();
});

chrome.runtime.onStartup.addListener(() => {
  void scanIfOnboarded();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SCAN_ALARM) void scanIfOnboarded();
});

// Live detection: react the moment a Google search loads in a tab, so the
// "You searched for this before" reminder appears while it is still useful.
chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  const url = changeInfo.url ?? (changeInfo.status === "loading" ? tab.url : undefined);
  if (url) void handlePossibleSearch(url);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "loopback:match") {
    // Content script asking whether typed/searched text matches a known
    // problem. Read-only — typing never creates search records.
    repository.load().then((state) => {
      sendResponse({
        match: state.meta.onboarded && reminderAllowedAtUrl(state.config, String(message.url ?? ""))
          ? matchLiveQuery(state, String(message.query ?? ""), Date.now(), String(message.url ?? "") || undefined)
          : null,
      });
    });
    return true;
  }
  if (message?.type === "loopback:open-problem") {
    void openProblem(String(message.clusterId ?? ""));
    return false;
  }
  // Quick actions from the banner, so nothing ever REQUIRES the dashboard.
  if (message?.type === "loopback:solve") {
    repository
      .markSolved(String(message.clusterId ?? ""), String(message.pageId ?? ""))
      .then((state) => updateBadge(state))
      .then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message?.type === "loopback:ignore") {
    repository
      .setStatus(String(message.clusterId ?? ""), "ignored")
      .then((state) => updateBadge(state))
      .then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message?.type === "loopback:unsolve") {
    repository
      .setStatus(String(message.clusterId ?? ""), "unresolved")
      .then((state) => updateBadge(state))
      .then(() => sendResponse({ ok: true }));
    return true;
  }
  // Used by the banner's Undo after "Don't remind me".
  if (message?.type === "loopback:set-status") {
    const status = String(message.status ?? "");
    if (status === "unresolved" || status === "resurfaced" || status === "solved" || status === "ignored") {
      repository
        .setStatus(String(message.clusterId ?? ""), status)
        .then((state) => updateBadge(state))
        .then(() => sendResponse({ ok: true }));
      return true;
    }
    return false;
  }
  // A prompt actually sent to an AI chatbot: record it as research and
  // remember the conversation URL so it can be offered back next time.
  if (message?.type === "loopback:chat-asked") {
    repository
      .update((state) => {
        if (!state.meta.onboarded) return;
        recordChatInteraction(state, {
          prompt: String(message.prompt ?? ""),
          askedAt: Date.now(),
          url: String(message.url ?? ""),
          title: String(message.title ?? ""),
        });
      })
      .then((state) => updateBadge(state))
      .then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message?.type === "loopback:rescan") {
    scanHistory().then(() => sendResponse({ ok: true }));
    return true; // keep the message channel open for the async response
  }
  if (message?.type === "loopback:refresh-badge") {
    repository.load().then((state) => updateBadge(state)).then(() => sendResponse({ ok: true }));
    return true;
  }
  return false;
});

chrome.notifications.onClicked.addListener((notificationId) => {
  const clusterId = clusterIdFromNotification(notificationId);
  if (clusterId) void openProblem(clusterId);
  chrome.notifications.clear(notificationId);
});

chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
  const clusterId = clusterIdFromNotification(notificationId);
  chrome.notifications.clear(notificationId);
  if (!clusterId) return;
  const state = await repository.load();
  const cluster = state.clusters[clusterId];
  if (!cluster) return;

  const solutionUrl = cluster.solutionPageId ? state.pages[cluster.solutionPageId]?.url : undefined;
  if (solutionUrl) {
    // Buttons: [Open previous solution, View research]
    if (buttonIndex === 0) await chrome.tabs.create({ url: solutionUrl });
    else await openProblem(clusterId);
  } else {
    // Buttons: [View research, Dismiss]
    if (buttonIndex === 0) await openProblem(clusterId);
  }
});

async function scanHistory(): Promise<void> {
  const state = await repository.load();
  if (!state.meta.onboarded) return;
  const startTime =
    state.meta.lastScanAt > 0
      ? state.meta.lastScanAt - SCAN_OVERLAP_MS
      : Date.now() - state.config.historyLookbackDays * 24 * 60 * 60 * 1000;

  const items = await chrome.history.search({ text: "", startTime, maxResults: 5000 });
  const withUrl = items.filter(
    (item): item is chrome.history.HistoryItem & { url: string } => Boolean(item.url),
  );
  const visits: HistoryVisit[] = withUrl
    .map((item) => ({ url: item.url, title: item.title ?? "", visitedAt: item.lastVisitTime ?? 0 }))
    .filter((visit) => visit.visitedAt > 0);

  // history.search returns only the LAST visit per URL, which hides the two
  // strongest signals Searchback has: the same search repeated on different
  // days, and pages the user came back to. Expand multi-visit URLs into
  // their real visit times (bounded, and duplicates are deduped downstream
  // by deterministic ids).
  const multiVisit = withUrl.filter((item) => (item.visitCount ?? 0) > 1).slice(0, 500);
  await Promise.all(
    multiVisit.map(async (item) => {
      try {
        const itemVisits = await chrome.history.getVisits({ url: item.url });
        for (const visit of itemVisits) {
          if (visit.visitTime && visit.visitTime >= startTime && visit.visitTime !== item.lastVisitTime) {
            visits.push({ url: item.url, title: item.title ?? "", visitedAt: visit.visitTime });
          }
        }
      } catch {
        /* URL no longer resolvable in history — skip */
      }
    }),
  );

  ingestVisits(state, visits);
  state.meta.lastScanAt = Date.now();
  await repository.save(state);
  await updateBadge(state);
}

async function handlePossibleSearch(url: string): Promise<void> {
  const state = await repository.load();
  if (!state.meta.onboarded) return;
  const record = toSearchRecord(url, Date.now(), state.config.extraStopQueries);
  if (!record) return;

  // On Google domains the content-script banner is the reminder; the system
  // notification only covers Google domains the banner doesn't run on.
  // Check against existing problems BEFORE integrating, so the new search
  // itself cannot satisfy the "seen on a previous day" requirement.
  const match = findBestCluster(record, state);
  const shouldRemind =
    state.config.remindersEnabled &&
    state.config.showOnGoogle &&
    !hostIsBlocked(hostnameOf(url), state.config.blockedReminderHosts) &&
    match !== null &&
    !isBannerCoveredUrl(url) &&
    isVisibleProblem(match.cluster, state) &&
    shouldNotify(match.cluster, state, Date.now());

  integrateSearches(state, [record]);
  if (shouldRemind && match) {
    state.clusters[match.cluster.id].lastNotifiedAt = Date.now();
  }
  await repository.save(state);
  await updateBadge(state);

  if (shouldRemind && match) {
    await showReminder(match.cluster, state);
  }
}

async function scanIfOnboarded(): Promise<void> {
  const state = await repository.load();
  if (state.meta.onboarded) await scanHistory();
}

async function showReminder(cluster: ProblemCluster, state: SearchbackState): Promise<void> {
  const hasSolution = Boolean(cluster.solutionPageId && state.pages[cluster.solutionPageId]);
  const dayCount = clusterDays(cluster, state).length;
  await chrome.notifications.create(`loopback|${cluster.id}`, {
    type: "basic",
    iconUrl: chrome.runtime.getURL("icons/icon128.png"),
    title: "You searched for this before",
    message: hasSolution
      ? `${cluster.title} — you already saved a solution for this.`
      : `${cluster.title} — ${cluster.searchRecordIds.length} searches across ${dayCount} days.`,
    buttons: hasSolution
      ? [{ title: "Open previous solution" }, { title: "View research" }]
      : [{ title: "View research" }, { title: "Dismiss" }],
    priority: 0,
  });
}

async function updateBadge(state: SearchbackState): Promise<void> {
  const resurfaced = Object.values(state.clusters).filter(
    (c) => c.status === "resurfaced" && isVisibleProblem(c, state),
  ).length;
  await chrome.action.setBadgeBackgroundColor({ color: "#d97706" });
  await chrome.action.setBadgeText({ text: resurfaced > 0 ? String(resurfaced) : "" });
}

function clusterIdFromNotification(notificationId: string): string | null {
  return notificationId.startsWith("loopback|") ? notificationId.slice("loopback|".length) : null;
}

async function openProblem(clusterId: string): Promise<void> {
  await chrome.tabs.create({ url: chrome.runtime.getURL(`dashboard.html#/problem/${clusterId}`) });
}
