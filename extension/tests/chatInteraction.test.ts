import { describe, expect, it } from "vitest";
import { emptyState } from "../src/core/types";
import { ingestVisits, recordChatInteraction } from "../src/core/ingest";
import { matchLiveQuery } from "../src/core/liveMatch";
import { rankSolutionCandidates } from "../src/core/solutionInference";
import type { HistoryVisit } from "../src/core/sessionTracker";

const DAY = 24 * 60 * 60 * 1000;
const MIN = 60 * 1000;
const NOON = new Date(2026, 6, 15, 12, 0, 0).getTime();

function g(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function baseState() {
  const state = emptyState();
  const visits: HistoryVisit[] = [
    { url: g("why is my mac storage full"), title: "search", visitedAt: NOON - 2 * DAY },
    { url: "https://support.apple.com/102624", title: "Free up storage - Apple", visitedAt: NOON - 2 * DAY + 2 * MIN },
  ];
  ingestVisits(state, visits);
  return state;
}

describe("recordChatInteraction", () => {
  it("records a sent prompt as a search and joins the right problem", () => {
    const state = baseState();
    const clusterId = recordChatInteraction(state, {
      prompt: "how do I fix my mac storage being full",
      askedAt: NOON - DAY,
      url: "https://chatgpt.com/c/abc123",
      title: "Mac storage cleanup - ChatGPT",
    });
    expect(clusterId).not.toBeNull();
    expect(Object.keys(state.clusters)).toHaveLength(1);
    expect(state.clusters[clusterId!].searchRecordIds).toHaveLength(2);
  });

  it("attaches the conversation URL as a revisitable page", () => {
    const state = baseState();
    const clusterId = recordChatInteraction(state, {
      prompt: "how do I fix my mac storage being full",
      askedAt: NOON - DAY,
      url: "https://chatgpt.com/c/abc123",
      title: "Mac storage cleanup - ChatGPT",
    })!;
    const pages = state.clusters[clusterId].pageIds.map((id) => state.pages[id]);
    const chat = pages.find((p) => p.domain === "chatgpt.com");
    expect(chat).toBeDefined();
    expect(chat!.url).toBe("https://chatgpt.com/c/abc123");
    expect(chat!.title).toBe("Mac storage cleanup - ChatGPT");
  });

  it("replaces a generic site title with a prompt-based one", () => {
    const state = baseState();
    const clusterId = recordChatInteraction(state, {
      prompt: "how do I fix my mac storage being full",
      askedAt: NOON - DAY,
      url: "https://claude.ai/chat/xyz",
      title: "Claude",
    })!;
    const chat = state.clusters[clusterId].pageIds.map((id) => state.pages[id]).find((p) => p.domain === "claude.ai");
    expect(chat!.title).toBe('Chat: "how do I fix my mac storage being full"');
  });

  it("does not attach site roots or new-chat pages as conversations", () => {
    const state = baseState();
    const clusterId = recordChatInteraction(state, {
      prompt: "how do I fix my mac storage being full",
      askedAt: NOON - DAY,
      url: "https://chatgpt.com/",
      title: "ChatGPT",
    })!;
    expect(state.clusters[clusterId].pageIds.map((id) => state.pages[id]).some((p) => p.domain === "chatgpt.com")).toBe(
      false,
    );
    // The prompt itself still counts as research.
    expect(state.clusters[clusterId].searchRecordIds).toHaveLength(2);
  });

  it("merges double-fired send detection into one search", () => {
    const state = baseState();
    recordChatInteraction(state, {
      prompt: "how do I fix my mac storage being full",
      askedAt: NOON - DAY,
      url: "https://chatgpt.com/",
      title: "ChatGPT",
    });
    // Enter-capture fired first with the root URL; clear-capture fires
    // seconds later once the SPA assigned the conversation permalink.
    const clusterId = recordChatInteraction(state, {
      prompt: "how do I fix my mac storage being full",
      askedAt: NOON - DAY + 3000,
      url: "https://chatgpt.com/c/abc123",
      title: "ChatGPT",
    })!;
    expect(state.clusters[clusterId].searchRecordIds).toHaveLength(2);
    expect(state.clusters[clusterId].pageIds.map((id) => state.pages[id]).filter((p) => p.domain === "chatgpt.com")).toHaveLength(1);
  });

  it("filters navigational prompts", () => {
    const state = baseState();
    expect(
      recordChatInteraction(state, { prompt: "youtube", askedAt: NOON, url: "https://chatgpt.com/c/x", title: "" }),
    ).toBeNull();
  });
});

describe("cross-bot re-asking (the ChatGPT -> Groq loop)", () => {
  // The user's real scenario: asked ChatGPT, then minutes later asks
  // another bot the same thing (with a typo). The new prompt must
  // reference the previous ChatGPT conversation.
  function askedChatGpt(minutesAgo: number) {
    const state = emptyState();
    recordChatInteraction(state, {
      prompt: "how do I remove claude as a contributor on github",
      askedAt: NOON - minutesAgo * MIN,
      url: "https://chatgpt.com/c/remove-claude",
      title: "Removing a contributor - ChatGPT",
    });
    return state;
  }

  it("matches a re-ask on another bot minutes later, despite the typo", () => {
    const state = askedChatGpt(10);
    const match = matchLiveQuery(state, "how to remove lcuade from github contributors", NOON, "https://groq.com/");
    expect(match).not.toBeNull();
    expect(match!.lastChat).toBeDefined();
    expect(match!.lastChat!.url).toBe("https://chatgpt.com/c/remove-claude");
  });

  it("presents the chat as the likely solution when research ended there", () => {
    const state = askedChatGpt(10);
    const match = matchLiveQuery(state, "remove claude github contributor", NOON, "https://groq.com/")!;
    // No article pages -> the conversation is the best guess.
    expect(match.candidates).toHaveLength(0);
    expect(match.lastChat).toBeDefined();
  });

  it("never offers the conversation the user is currently typing in", () => {
    const state = askedChatGpt(10);
    const match = matchLiveQuery(
      state,
      "remove claude github contributor",
      NOON,
      "https://chatgpt.com/c/remove-claude",
    );
    // Only content is the current conversation itself -> nothing to remind.
    expect(match).toBeNull();
  });

  it("still suppresses same-session Google research without any chat", () => {
    const state = emptyState();
    ingestVisits(state, [
      { url: g("mac storage full"), title: "s", visitedAt: NOON - 10 * MIN },
      { url: "https://support.apple.com/102624", title: "Apple", visitedAt: NOON - 8 * MIN },
    ]);
    expect(matchLiveQuery(state, "mac storage full", NOON, "https://www.google.com/search?q=x")).toBeNull();
  });
});

describe("last chat in live matches", () => {
  function stateWithChat() {
    const state = baseState();
    recordChatInteraction(state, {
      prompt: "how do I fix my mac storage being full",
      askedAt: NOON - DAY,
      url: "https://chatgpt.com/c/abc123",
      title: "Mac storage cleanup - ChatGPT",
    });
    return state;
  }

  it("offers the link to the last chat next time the user asks", () => {
    const match = matchLiveQuery(stateWithChat(), "mac storage full again", NOON);
    expect(match).not.toBeNull();
    expect(match!.lastChat).toBeDefined();
    expect(match!.lastChat!.url).toBe("https://chatgpt.com/c/abc123");
  });

  it("keeps chat conversations out of the likely-solution candidates", () => {
    const state = stateWithChat();
    const match = matchLiveQuery(state, "mac storage full again", NOON)!;
    expect(match.candidates.every((c) => c.domain !== "chatgpt.com")).toBe(true);
    const cluster = Object.values(state.clusters)[0];
    expect(rankSolutionCandidates(cluster, state).every((c) => c.page.domain !== "chatgpt.com")).toBe(true);
  });
});
