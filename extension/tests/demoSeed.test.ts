import { describe, expect, it } from "vitest";
import { seedDemoData } from "../src/demo/seed";
import { matchLiveQuery } from "../src/core/liveMatch";
import { Repository, memoryStore } from "../src/storage/repository";

describe("sample research", () => {
  it("uses the production pipeline and preserves user settings", async () => {
    const repo = new Repository(memoryStore());
    await repo.updateConfig({ showOnGoogle: false, blockedReminderHosts: ["claude.ai"] });

    await seedDemoData(repo);

    const state = await repo.load();
    expect(Object.keys(state.clusters).length).toBeGreaterThanOrEqual(3);
    expect(Object.keys(state.searches).length).toBeGreaterThan(3);
    expect(Object.values(state.searches).some((search) => search.query === "why is my mac storage full")).toBe(true);
    expect(matchLiveQuery(state, "why is my mac storage full again")).not.toBeNull();
    expect(state.config.showOnGoogle).toBe(false);
    expect(state.config.blockedReminderHosts).toEqual(["claude.ai"]);
    expect(state.meta.onboarded).toBe(true);
  });

  it("never overwrites an existing research repository", async () => {
    const repo = new Repository(memoryStore());
    await seedDemoData(repo);
    const clusterId = Object.keys((await repo.load()).clusters)[0];
    await repo.setNote(clusterId, "Keep this note");
    const before = await repo.load();

    await seedDemoData(repo);

    expect(await repo.load()).toEqual(before);
  });
});
