import { describe, expect, it } from "vitest";
import { reminderDismissKey } from "../src/core/reminderDismissal";

describe("reminder dismissal", () => {
  it("normalizes harmless query formatting differences", () => {
    expect(reminderDismissKey("codex", "  App   Desktop CODEX ")).toBe(
      reminderDismissKey("codex", "app desktop codex"),
    );
  });

  it("does not silence a different query in the same cluster", () => {
    expect(reminderDismissKey("codex", "codex desktop app")).not.toBe(
      reminderDismissKey("codex", "codex cli authentication"),
    );
  });
});
