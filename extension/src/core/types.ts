export type SearchRecord = {
  id: string;
  query: string;
  normalizedQuery: string;
  searchedAt: number;
  sourceUrl: string;
};

export type VisitedPage = {
  id: string;
  title: string;
  url: string;
  domain: string;
  visitedAt: number;
  searchRecordId: string;
};

export type ProblemStatus = "resurfaced" | "unresolved" | "solved" | "ignored";

export type ProblemCluster = {
  id: string;
  title: string;
  searchRecordIds: string[];
  pageIds: string[];
  status: ProblemStatus;
  solutionPageId?: string;
  note?: string;
  /** Set when the user renamed the problem; stops auto title regeneration. */
  customTitle?: boolean;
  createdAt: number;
  updatedAt: number;
  lastNotifiedAt?: number;
};

export type SearchbackConfig = {
  /** Master switch for all in-page reminders and fallback notifications. */
  remindersEnabled: boolean;
  /** Whether reminders may appear on Google search pages. */
  showOnGoogle: boolean;
  /** Whether reminders may appear above supported AI chat composers. */
  showOnChatbots: boolean;
  /** Hostnames on which reminders are explicitly disabled. */
  blockedReminderHosts: string[];
  /** Minimum cosine similarity for two searches to join the same problem. */
  similarityThreshold: number;
  /** How long after a search a visited page still counts as part of it. */
  sessionWindowMs: number;
  /** Minimum time between two notifications for the same problem. */
  notificationCooldownMs: number;
  /** How far back the initial history scan looks. */
  historyLookbackDays: number;
  /** Queries matching these (after normalization) are treated as navigational. */
  extraStopQueries: string[];
};

export type SearchbackState = {
  searches: Record<string, SearchRecord>;
  pages: Record<string, VisitedPage>;
  clusters: Record<string, ProblemCluster>;
  config: SearchbackConfig;
  meta: {
    /** One-time rebuild version for matching/clustering behavior. */
    matchingModelVersion: number;
    lastScanAt: number;
    onboarded: boolean;
    /**
     * Ids the user explicitly deleted. History re-scans would otherwise
     * recreate them (ids are deterministic), so deletions are remembered.
     */
    suppressedSearchIds: string[];
    suppressedPageIds: string[];
  };
};

export const CURRENT_MATCHING_MODEL_VERSION = 2;

export const DEFAULT_CONFIG: SearchbackConfig = {
  remindersEnabled: true,
  showOnGoogle: true,
  showOnChatbots: true,
  blockedReminderHosts: [],
  similarityThreshold: 0.4,
  sessionWindowMs: 15 * 60 * 1000,
  notificationCooldownMs: 6 * 60 * 60 * 1000,
  historyLookbackDays: 30,
  extraStopQueries: [],
};

export function emptyState(): SearchbackState {
  return {
    searches: {},
    pages: {},
    clusters: {},
    config: { ...DEFAULT_CONFIG },
    meta: {
      matchingModelVersion: CURRENT_MATCHING_MODEL_VERSION,
      lastScanAt: 0,
      onboarded: false,
      suppressedSearchIds: [],
      suppressedPageIds: [],
    },
  };
}
