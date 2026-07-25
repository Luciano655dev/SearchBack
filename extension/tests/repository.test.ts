import { describe, expect, it } from "vitest";
import { Repository, memoryStore } from "../src/storage/repository";
import { DEFAULT_CONFIG, emptyState } from "../src/core/types";
import { ingestVisits, toSearchRecord } from "../src/core/ingest";
import type { HistoryVisit } from "../src/core/sessionTracker";

const DAY = 24 * 60 * 60 * 1000;
const MIN = 60 * 1000;
const NOW = new Date(2026, 6, 15, 12, 0, 0).getTime();

function g(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

async function seededRepo() {
  const repo = new Repository(memoryStore());
  const state = emptyState();
  const visits: HistoryVisit[] = [
    { url: g("mac storage full"), title: "search", visitedAt: NOW - DAY },
    { url: "https://support.apple.com/102624", title: "Free up storage on your Mac", visitedAt: NOW - DAY + 2 * MIN },
    { url: g("mac storage cleanup"), title: "search", visitedAt: NOW },
    { url: "https://example.com/cleanup-guide", title: "Cleanup guide", visitedAt: NOW + MIN },
  ];
  ingestVisits(state, visits);
  await repo.save(state);
  const saved = await repo.load();
  const cluster = Object.values(saved.clusters)[0];
  return { repo, clusterId: cluster.id, pageIds: cluster.pageIds };
}

describe("Repository", () => {
  it("fills new reminder defaults when loading legacy saved data", async () => {
    const store = memoryStore();
    const legacy = emptyState();
    const { remindersEnabled, showOnGoogle, showOnChatbots, blockedReminderHosts, ...legacyConfig } =
      legacy.config;
    void remindersEnabled;
    void showOnGoogle;
    void showOnChatbots;
    void blockedReminderHosts;
    await store.set("loopback:state", { ...legacy, config: legacyConfig });

    const loaded = await new Repository(store).load();
    expect(loaded.config.remindersEnabled).toBe(DEFAULT_CONFIG.remindersEnabled);
    expect(loaded.config.showOnGoogle).toBe(DEFAULT_CONFIG.showOnGoogle);
    expect(loaded.config.showOnChatbots).toBe(DEFAULT_CONFIG.showOnChatbots);
    expect(loaded.config.blockedReminderHosts).toEqual([]);
  });

  it("updates reminder settings without replacing the rest of the config", async () => {
    const repo = new Repository(memoryStore());
    const originalThreshold = (await repo.load()).config.similarityThreshold;
    await repo.updateConfig({
      showOnGoogle: false,
      blockedReminderHosts: ["chatgpt.com", "chat.openai.com"],
    });

    const loaded = await repo.load();
    expect(loaded.config.showOnGoogle).toBe(false);
    expect(loaded.config.blockedReminderHosts).toEqual(["chatgpt.com", "chat.openai.com"]);
    expect(loaded.config.similarityThreshold).toBe(originalThreshold);
  });

  it("round-trips state", async () => {
    const { repo, clusterId } = await seededRepo();
    const state = await repo.load();
    expect(state.clusters[clusterId]).toBeDefined();
    expect(Object.keys(state.searches)).toHaveLength(2);
  });

  it("marks a problem solved with the page that solved it", async () => {
    const { repo, clusterId, pageIds } = await seededRepo();
    await repo.markSolved(clusterId, pageIds[0]);
    const state = await repo.load();
    expect(state.clusters[clusterId].status).toBe("solved");
    expect(state.clusters[clusterId].solutionPageId).toBe(pageIds[0]);
  });

  it("refuses to mark solved with a page that does not belong to the problem", async () => {
    const { repo, clusterId } = await seededRepo();
    await repo.markSolved(clusterId, "p-not-a-real-page");
    const state = await repo.load();
    expect(state.clusters[clusterId].status).toBe("unresolved");
    expect(state.clusters[clusterId].solutionPageId).toBeUndefined();
  });

  it("clears the solution when the user is still looking", async () => {
    const { repo, clusterId, pageIds } = await seededRepo();
    await repo.markSolved(clusterId, pageIds[0]);
    await repo.setStatus(clusterId, "unresolved");
    const state = await repo.load();
    expect(state.clusters[clusterId].status).toBe("unresolved");
    expect(state.clusters[clusterId].solutionPageId).toBeUndefined();
  });

  it("marks solved with a written solution, no page required", async () => {
    const { repo, clusterId } = await seededRepo();
    await repo.solveWithNote(clusterId, "Ran docker system prune -a, freed 40 GB");
    const state = await repo.load();
    expect(state.clusters[clusterId].status).toBe("solved");
    expect(state.clusters[clusterId].note).toBe("Ran docker system prune -a, freed 40 GB");
    expect(state.clusters[clusterId].solutionPageId).toBeUndefined();
  });

  it("does not mark solved with an empty note", async () => {
    const { repo, clusterId } = await seededRepo();
    await repo.solveWithNote(clusterId, "   ");
    const state = await repo.load();
    expect(state.clusters[clusterId].status).toBe("unresolved");
  });

  it("keeps the saved solution when a solved problem is ignored and restored", async () => {
    const { repo, clusterId, pageIds } = await seededRepo();
    await repo.markSolved(clusterId, pageIds[0]);
    await repo.setStatus(clusterId, "ignored");
    await repo.setStatus(clusterId, "solved");
    const state = await repo.load();
    expect(state.clusters[clusterId].solutionPageId).toBe(pageIds[0]);
  });

  it("ignores and restores a problem", async () => {
    const { repo, clusterId } = await seededRepo();
    await repo.setStatus(clusterId, "ignored");
    expect((await repo.load()).clusters[clusterId].status).toBe("ignored");
    await repo.setStatus(clusterId, "unresolved");
    expect((await repo.load()).clusters[clusterId].status).toBe("unresolved");
  });

  it("renames a problem and keeps the custom title when new searches arrive", async () => {
    const { repo, clusterId } = await seededRepo();
    await repo.setTitle(clusterId, "My storage saga");
    let state = await repo.load();
    expect(state.clusters[clusterId].title).toBe("My storage saga");

    ingestVisits(state, [{ url: g("mac storage still full help"), title: "search", visitedAt: NOW + DAY }]);
    await repo.save(state);
    state = await repo.load();
    expect(state.clusters[clusterId].title).toBe("My storage saga");
    expect(state.clusters[clusterId].searchRecordIds).toHaveLength(3);
  });

  it("deletes a problem and prevents history re-scans from resurrecting it", async () => {
    const { repo, clusterId } = await seededRepo();
    await repo.deleteCluster(clusterId);
    let state = await repo.load();
    expect(state.clusters[clusterId]).toBeUndefined();
    expect(Object.keys(state.searches)).toHaveLength(0);

    // Same history arrives again on the next scan.
    ingestVisits(state, [
      { url: g("mac storage full"), title: "search", visitedAt: NOW - DAY },
      { url: g("mac storage cleanup"), title: "search", visitedAt: NOW },
    ]);
    expect(Object.keys(state.searches)).toHaveLength(0);
    expect(Object.keys(state.clusters)).toHaveLength(0);
  });

  it("removes a wrongly-grouped page for good", async () => {
    const { repo, clusterId, pageIds } = await seededRepo();
    await repo.removePage(clusterId, pageIds[0]);
    let state = await repo.load();
    expect(state.clusters[clusterId].pageIds).not.toContain(pageIds[0]);
    expect(state.pages[pageIds[0]]).toBeUndefined();

    // Re-ingesting the same visit must not re-attach the removed page.
    ingestVisits(state, [
      { url: "https://support.apple.com/102624", title: "Free up storage on your Mac", visitedAt: NOW - DAY + 2 * MIN },
    ]);
    expect(state.clusters[clusterId].pageIds).not.toContain(pageIds[0]);
  });

  it("clears the solution when its page is removed", async () => {
    const { repo, clusterId, pageIds } = await seededRepo();
    await repo.markSolved(clusterId, pageIds[0]);
    await repo.removePage(clusterId, pageIds[0]);
    const state = await repo.load();
    expect(state.clusters[clusterId].solutionPageId).toBeUndefined();
    expect(state.clusters[clusterId].status).toBe("unresolved");
  });

  it("deletes all data", async () => {
    const { repo } = await seededRepo();
    await repo.deleteAllData();
    const state = await repo.load();
    expect(Object.keys(state.clusters)).toHaveLength(0);
    expect(Object.keys(state.searches)).toHaveLength(0);
    expect(state.meta.onboarded).toBe(false);
  });

  it("rebuilds legacy polluted clusters once and preserves explicit decisions", async () => {
    const repo = new Repository(memoryStore());
    const state = emptyState();
    state.meta.matchingModelVersion = 1;
    const codexA = toSearchRecord(g("codex desktop app"), NOW - 3 * DAY, [])!;
    const codexB = toSearchRecord(g("openai codex desktop app"), NOW - 2 * DAY, [])!;
    const searchz = toSearchRecord(g("searchzgpt code ai"), NOW - DAY, [])!;
    state.searches = { [codexA.id]: codexA, [codexB.id]: codexB, [searchz.id]: searchz };
    const solutionPageId = "p-confirmed-codex";
    state.pages[solutionPageId] = {
      id: solutionPageId,
      title: "Introducing the Codex desktop app",
      url: "https://openai.com/codex/desktop",
      domain: "openai.com",
      visitedAt: NOW - 2 * DAY + MIN,
      searchRecordId: codexB.id,
    };
    state.clusters["legacy-polluted"] = {
      id: "legacy-polluted",
      title: "My Codex research",
      customTitle: true,
      note: "Use the OpenAI desktop app",
      searchRecordIds: [codexA.id, codexB.id, searchz.id],
      pageIds: [solutionPageId],
      solutionPageId,
      status: "solved",
      createdAt: codexA.searchedAt,
      updatedAt: NOW,
    };
    await repo.save(state);

    const migrated = await repo.load();
    expect(migrated.meta.matchingModelVersion).toBe(2);
    expect(Object.values(migrated.clusters)).toHaveLength(2);
    const codexCluster = Object.values(migrated.clusters).find((cluster) =>
      cluster.searchRecordIds.includes(codexB.id),
    )!;
    expect(codexCluster.searchRecordIds).toHaveLength(2);
    expect(codexCluster.solutionPageId).toBe(solutionPageId);
    expect(codexCluster.note).toBe("Use the OpenAI desktop app");
    expect(codexCluster.title).toBe("My Codex research");

    const once = JSON.stringify(migrated.clusters);
    expect(JSON.stringify((await repo.load()).clusters)).toBe(once);
  });
});
