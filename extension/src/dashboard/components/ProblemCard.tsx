import { repository } from "../../storage/repository";
import { formatRelativeDay } from "../../core/dates";
import { countLabel, statusLabel, type ProblemSummary } from "../../ui/selectors";

export function ProblemCard({ summary, onChanged }: { summary: ProblemSummary; onChanged: () => void }) {
  const { cluster } = summary;

  const setStatus = async (status: "unresolved" | "ignored") => {
    await repository.setStatus(cluster.id, status);
    onChanged();
  };

  return (
    <div className="card problem-card">
      <div className="problem-card-main">
        <h3>
          <a href={`#/problem/${cluster.id}`}>{cluster.title}</a>
        </h3>
        <div className="problem-meta">
          <span>{countLabel(summary.searchCount, "search", "searches")}</span>
          <span className="dot">·</span>
          <span>{countLabel(summary.dayCount, "day")}</span>
          <span className="dot">·</span>
          <span>{countLabel(summary.pageCount, "page")}</span>
          <span className="dot">·</span>
          <span>last searched {formatRelativeDay(summary.lastSearchedAt)}</span>
          <span className="dot">·</span>
          <span className={`status status-${cluster.status}`}>{statusLabel(cluster.status)}</span>
        </div>
      </div>
      <div className="problem-card-actions">
        <a className="btn btn-sm" href={`#/problem/${cluster.id}`}>
          Open
        </a>
        {cluster.status !== "solved" && cluster.status !== "ignored" && (
          <a className="btn btn-sm" href={`#/problem/${cluster.id}?solve=1`}>
            Mark solved
          </a>
        )}
        {cluster.status === "ignored" ? (
          <button className="btn btn-sm" onClick={() => setStatus("unresolved")}>
            Restore
          </button>
        ) : (
          <button className="btn btn-ghost btn-sm" onClick={() => setStatus("ignored")}>
            Ignore
          </button>
        )}
      </div>
    </div>
  );
}
