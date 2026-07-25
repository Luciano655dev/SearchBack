import { tokensFuzzyEqual } from "./fuzzy";
import {
  FUZZY_CREDIT,
  isDistinctiveToken,
  weightForToken,
} from "./similarity";

export type MatchMode = "query" | "live" | "page";

export type MatchEvidence = {
  score: number;
  sourceCoverage: number;
  targetCoverage: number;
  matchedTokens: string[];
  distinctiveMatches: number;
  exactTokenSet: boolean;
  accepted: boolean;
};

const PREFIX_CREDIT = 0.9;

const MODE_LIMITS: Record<MatchMode, { sourceCoverage: number; targetCoverage: number }> = {
  query: { sourceCoverage: 0.45, targetCoverage: 0.35 },
  live: { sourceCoverage: 0.45, targetCoverage: 0.35 },
  page: { sourceCoverage: 0.24, targetCoverage: 0.15 },
};

/**
 * Produces both a score and the evidence needed to decide whether that score
 * is trustworthy. A shared generic term can contribute a little, but it can
 * never be the reason a match is accepted.
 */
export function evaluateMatch(
  source: string[],
  target: string[],
  weights: Map<string, number> | undefined,
  threshold: number,
  mode: MatchMode,
): MatchEvidence {
  const sourceSet = [...new Set(source)];
  const targetSet = [...new Set(target)];
  if (sourceSet.length === 0 || targetSet.length === 0) return emptyEvidence();

  const targetLookup = new Set(targetSet);
  const usedTarget = new Set<string>();
  const matches: Array<{ source: string; target: string; credit: number }> = [];
  const lastSourceIndex = sourceSet.length - 1;

  sourceSet.forEach((token, index) => {
    if (targetLookup.has(token) && !usedTarget.has(token)) {
      usedTarget.add(token);
      matches.push({ source: token, target: token, credit: 1 });
      return;
    }
    if (mode === "live" && index === lastSourceIndex && token.length >= 3) {
      const prefix = targetSet.find((candidate) => !usedTarget.has(candidate) && candidate.startsWith(token));
      if (prefix) {
        usedTarget.add(prefix);
        matches.push({ source: token, target: prefix, credit: PREFIX_CREDIT });
        return;
      }
    }
    const fuzzy = targetSet.find(
      (candidate) => !usedTarget.has(candidate) && tokensFuzzyEqual(token, candidate),
    );
    if (fuzzy) {
      usedTarget.add(fuzzy);
      matches.push({ source: token, target: fuzzy, credit: FUZZY_CREDIT });
    }
  });

  if (matches.length === 0) return emptyEvidence();
  const w = (token: string) => weightForToken(token, weights);
  const matchedSource = new Set(matches.map((match) => match.source));

  // Keep long chat prompts from drowning a precise match, as before. The
  // actual matched terms can never be removed by the cap.
  let normSourceTokens = sourceSet;
  if (mode === "live") {
    const cap = Math.min(sourceSet.length, targetSet.length * 2);
    const heaviest = [...sourceSet].sort((a, b) => w(b) - w(a)).slice(0, cap);
    normSourceTokens = [...new Set([...heaviest, ...matchedSource])];
  }

  const sourceNormSq = normSourceTokens.reduce((sum, token) => sum + w(token) ** 2, 0);
  const targetNormSq = targetSet.reduce((sum, token) => sum + w(token) ** 2, 0);
  const dot = matches.reduce(
    (sum, match) => sum + match.credit * w(match.source) * w(match.target),
    0,
  );
  const sourceMatchedSq = matches.reduce((sum, match) => sum + w(match.source) ** 2, 0);
  const targetMatchedSq = matches.reduce((sum, match) => sum + w(match.target) ** 2, 0);
  const score = Math.min(1, dot / Math.sqrt(sourceNormSq * targetNormSq));
  const sourceCoverage = Math.min(1, sourceMatchedSq / sourceNormSq);
  const targetCoverage = Math.min(1, targetMatchedSq / targetNormSq);
  const distinctiveMatches = matches.filter(
    (match) => isDistinctiveToken(match.source) || isDistinctiveToken(match.target),
  ).length;
  const exactTokenSet =
    sourceSet.length === targetSet.length && sourceSet.every((token) => targetLookup.has(token));
  const limits = MODE_LIMITS[mode];
  const accepted =
    exactTokenSet ||
    (score >= threshold &&
      sourceCoverage >= limits.sourceCoverage &&
      targetCoverage >= limits.targetCoverage &&
      distinctiveMatches > 0);

  return {
    score,
    sourceCoverage,
    targetCoverage,
    matchedTokens: matches.map((match) => match.source),
    distinctiveMatches,
    exactTokenSet,
    accepted,
  };
}

function emptyEvidence(): MatchEvidence {
  return {
    score: 0,
    sourceCoverage: 0,
    targetCoverage: 0,
    matchedTokens: [],
    distinctiveMatches: 0,
    exactTokenSet: false,
    accepted: false,
  };
}
