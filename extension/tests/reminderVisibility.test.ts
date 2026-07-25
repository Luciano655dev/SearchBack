import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "../src/core/types";
import { hostIsBlocked, hostnameOf, reminderAllowedAtUrl } from "../src/core/reminderVisibility";

describe("reminder visibility", () => {
  it("allows configured Google and chatbot surfaces", () => {
    expect(reminderAllowedAtUrl(DEFAULT_CONFIG, "https://www.google.com/search?q=codex")).toBe(true);
    expect(reminderAllowedAtUrl(DEFAULT_CONFIG, "https://chatgpt.com/c/123")).toBe(true);
  });

  it("respects the master never-show switch", () => {
    const config = { ...DEFAULT_CONFIG, remindersEnabled: false };
    expect(reminderAllowedAtUrl(config, "https://www.google.com/search?q=codex")).toBe(false);
    expect(reminderAllowedAtUrl(config, "https://claude.ai/new")).toBe(false);
  });

  it("controls Google and chatbot surfaces independently", () => {
    const noGoogle = { ...DEFAULT_CONFIG, showOnGoogle: false };
    const noChatbots = { ...DEFAULT_CONFIG, showOnChatbots: false };
    expect(reminderAllowedAtUrl(noGoogle, "https://google.com/search?q=codex")).toBe(false);
    expect(reminderAllowedAtUrl(noGoogle, "https://chatgpt.com/")).toBe(true);
    expect(reminderAllowedAtUrl(noChatbots, "https://google.com/search?q=codex")).toBe(true);
    expect(reminderAllowedAtUrl(noChatbots, "https://gemini.google.com/app")).toBe(false);
  });

  it("blocks an individual chatbot and its subdomains", () => {
    const config = { ...DEFAULT_CONFIG, blockedReminderHosts: ["chatgpt.com"] };
    expect(reminderAllowedAtUrl(config, "https://chatgpt.com/")).toBe(false);
    expect(reminderAllowedAtUrl(config, "https://workspace.chatgpt.com/")).toBe(false);
    expect(reminderAllowedAtUrl(config, "https://claude.ai/")).toBe(true);
    expect(hostIsBlocked("notchatgpt.com", config.blockedReminderHosts)).toBe(false);
  });

  it("rejects malformed and unrelated URLs", () => {
    expect(hostnameOf("not a url")).toBe("");
    expect(reminderAllowedAtUrl(DEFAULT_CONFIG, "https://example.com/")).toBe(false);
    expect(reminderAllowedAtUrl(DEFAULT_CONFIG, "not a url")).toBe(false);
  });
});
