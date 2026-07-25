import { emptyState } from "../core/types";
import { ingestVisits } from "../core/ingest";
import type { HistoryVisit } from "../core/sessionTracker";
import type { Repository } from "../storage/repository";

/**
 * Optional local sample data. Runs the real ingestion pipeline over
 * fabricated history visits, so the demo shows exactly what the product
 * does — not hand-crafted state. The test guide offers it only when the
 * repository is empty, so existing user research is never overwritten.
 */

const DAY = 24 * 60 * 60 * 1000;
const MIN = 60 * 1000;

function g(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function demoVisits(now: number): HistoryVisit[] {
  return [
    // ---- Problem 1: Mac storage (3 days, resurfaced today) ----
    { url: g("why is my mac storage full"), title: "why is my mac storage full - Google Search", visitedAt: now - 7 * DAY },
    { url: "https://support.apple.com/en-us/102624", title: "Free up storage space on your Mac - Apple Support", visitedAt: now - 7 * DAY + 2 * MIN },
    { url: "https://www.macworld.com/article/668591/how-to-free-up-space-on-mac.html", title: "How to free up space on a Mac", visitedAt: now - 7 * DAY + 6 * MIN },
    { url: g("applications taking too much space mac"), title: "applications taking too much space mac - Google Search", visitedAt: now - 3 * DAY },
    { url: "https://discussions.apple.com/thread/254616973", title: "System Data taking huge space - Apple Community", visitedAt: now - 3 * DAY + 3 * MIN },
    { url: "https://www.reddit.com/r/mac/comments/storage_full_help/", title: "Mac storage full even after deleting files : r/mac", visitedAt: now - 3 * DAY + 8 * MIN },
    { url: g("docker using too much disk space mac"), title: "docker using too much disk space mac - Google Search", visitedAt: now - 20 * MIN },
    { url: "https://docs.docker.com/desktop/settings-and-maintenance/settings/#resources", title: "Docker Desktop settings - Docker Docs", visitedAt: now - 18 * MIN },
    { url: "https://stackoverflow.com/questions/44785585/docker-mac-disk-space", title: "How to clean up Docker disk space on Mac - Stack Overflow", visitedAt: now - 15 * MIN },

    // ---- Problem 2: Configure Apple Sign In (2 days, unresolved) ----
    { url: g("configure apple sign in web app"), title: "configure apple sign in web app - Google Search", visitedAt: now - 5 * DAY },
    { url: "https://developer.apple.com/sign-in-with-apple/get-started/", title: "Get Started - Sign in with Apple - Apple Developer", visitedAt: now - 5 * DAY + 2 * MIN },
    { url: g("apple sign in invalid_client error"), title: "apple sign in invalid_client error - Google Search", visitedAt: now - 2 * DAY },
    { url: "https://stackoverflow.com/questions/58018184/sign-in-with-apple-invalid-client", title: "Sign in with Apple: invalid_client - Stack Overflow", visitedAt: now - 2 * DAY + 4 * MIN },
    { url: "https://github.com/nextauthjs/next-auth/discussions/3982", title: "Apple provider invalid_client · next-auth discussion", visitedAt: now - 2 * DAY + 9 * MIN },

    // ---- Problem 3: Choose domain email provider (2 days, solved) ----
    { url: g("free custom domain email"), title: "free custom domain email - Google Search", visitedAt: now - 12 * DAY },
    { url: "https://www.zoho.com/mail/custom-domain-email.html", title: "Custom domain email - Zoho Mail", visitedAt: now - 12 * DAY + 3 * MIN },
    { url: g("cheapest email hosting for domain"), title: "cheapest email hosting for domain - Google Search", visitedAt: now - 10 * DAY },
    { url: "https://purelymail.com/", title: "Purelymail: cheap email hosting", visitedAt: now - 10 * DAY + 2 * MIN },
    { url: "https://www.migadu.com/pricing/", title: "Pricing - Migadu Email Hosting", visitedAt: now - 10 * DAY + 7 * MIN },
  ];
}

export async function seedDemoData(repository: Repository): Promise<void> {
  const now = Date.now();
  const existing = await repository.load();
  if (
    Object.keys(existing.searches).length > 0 ||
    Object.keys(existing.pages).length > 0 ||
    Object.keys(existing.clusters).length > 0
  ) {
    return;
  }
  const state = emptyState();
  state.config = existing.config;
  state.meta = { ...state.meta, ...existing.meta };
  ingestVisits(state, demoVisits(now));
  state.meta.onboarded = true;
  state.meta.lastScanAt = now;
  await repository.save(state);

  // Mark the email problem as solved via the real repository flow.
  const saved = await repository.load();
  const emailCluster = Object.values(saved.clusters).find((c) => c.title.toLowerCase().includes("email"));
  if (emailCluster) {
    const solutionPage = Object.values(saved.pages).find(
      (p) => p.domain === "purelymail.com" && emailCluster.pageIds.includes(p.id),
    );
    if (solutionPage) await repository.markSolved(emailCluster.id, solutionPage.id);
    await repository.setNote(emailCluster.id, "Went with Purelymail — ~$10/year, works fine with a custom domain.");
  }
}
