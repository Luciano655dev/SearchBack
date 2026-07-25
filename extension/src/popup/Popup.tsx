import { useEffect, useState } from "react";
import type { SearchbackState } from "../core/types";
import { repository } from "../storage/repository";
import { countLabel, mostRecentProblem, visibleProblemCount, type ProblemSummary } from "../ui/selectors";
import { formatRelativeDay } from "../core/dates";
import { openDashboard, openExternal } from "../ui/chromeLinks";

export function Popup() {
  const [state, setState] = useState<SearchbackState | null>(null);

  useEffect(() => {
    void repository.load().then(setState);
  }, []);

  if (!state) return <div className="popup" />;

  const count = visibleProblemCount(state);
  const recent = mostRecentProblem(state);

  if (!state.meta.onboarded) {
    return (
      <div className="popup">
        <div className="popup-header"><h1>Searchback</h1></div>
        <p className="popup-empty">Finish setup before Searchback begins processing research on this device.</p>
        <div className="popup-actions">
          <button className="btn btn-primary" onClick={() => openDashboard("#/onboarding")}>Finish setup</button>
          <button className="btn btn-ghost" onClick={() => openExternal("https://searchback.vercel.app/privacy")}>
            Privacy
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="popup">
      <div className="popup-header">
        <h1>Searchback</h1>
      </div>
      <p className="popup-tagline">
        Searchback remembers problems you searched before, so you do not start from zero next time.
      </p>

      {count > 0 ? (
        <p className="popup-count">
          {count} recurring {count === 1 ? "problem" : "problems"} found
        </p>
      ) : (
        <p className="popup-empty">
          No recurring problems yet. Keep browsing normally — Searchback will notice when a search
          comes back on another day.
        </p>
      )}

      {recent && <RecentProblem summary={recent} />}

      <div className="popup-actions" style={{ marginTop: recent ? 0 : 4 }}>
        {recent && (
          <button
            className="btn btn-primary"
            onClick={() => openDashboard(`#/problem/${recent.cluster.id}`)}
          >
            View previous research
          </button>
        )}
        <button className="btn" onClick={() => openDashboard()}>
          Open dashboard
        </button>
        {!recent && (
          <button className="btn btn-primary" onClick={() => openDashboard("#/test")}>Test it now</button>
        )}
        <button className="btn" onClick={() => openDashboard("#/settings")}>
          Settings
        </button>
        <button className="btn btn-ghost" onClick={() => openExternal("https://searchback.vercel.app/")}>
          Website <span aria-hidden="true">↗</span>
        </button>
      </div>
    </div>
  );
}

function RecentProblem({ summary }: { summary: ProblemSummary }) {
  const solved = summary.cluster.status === "solved";
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className={`popup-kicker${solved ? " solved" : ""}`}>
        {solved
          ? "Solved before"
          : summary.cluster.status === "resurfaced"
            ? "You searched for this before"
            : "Most recent"}
      </div>
      <div className="popup-problem-title">{summary.cluster.title}</div>
      <div className="popup-problem-meta">
        {countLabel(summary.searchCount, "search", "searches")} across{" "}
        {countLabel(summary.dayCount, "day")} · last searched {formatRelativeDay(summary.lastSearchedAt)}
      </div>
    </div>
  );
}
