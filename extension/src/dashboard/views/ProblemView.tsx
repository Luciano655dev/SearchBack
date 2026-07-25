import { useState } from "react";
import type { SearchbackState, VisitedPage } from "../../core/types";
import { repository } from "../../storage/repository";
import { formatRelativeDay, localDayKey } from "../../core/dates";
import { likelySolution } from "../../core/solutionInference";
import { countLabel, statusLabel } from "../../ui/selectors";
import { openExternal } from "../../ui/chromeLinks";
import { faviconUrl } from "../../ui/favicon";

function Favicon({ url, domain }: { url: string; domain: string }) {
  const src = faviconUrl(url);
  if (!src) {
    return <span className="favicon favicon-fallback">{domain.charAt(0).toUpperCase() || "•"}</span>;
  }
  return <img className="favicon" src={src} alt="" />;
}

export function ProblemView({
  clusterId,
  state,
  solveMode,
  onChanged,
}: {
  clusterId: string;
  state: SearchbackState;
  solveMode: boolean;
  onChanged: () => void;
}) {
  const cluster = state.clusters[clusterId];
  const [note, setNote] = useState(cluster?.note ?? "");
  const [picking, setPicking] = useState(solveMode);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(cluster?.title ?? "");

  if (!cluster) {
    return (
      <div className="page">
        <a className="back-link" href="#/">
          ← Back to dashboard
        </a>
        <div className="empty-state card">
          <h2>Problem not found</h2>
          <p>It may have been removed or deleted.</p>
        </div>
      </div>
    );
  }

  const searches = cluster.searchRecordIds
    .map((id) => state.searches[id])
    .filter(Boolean)
    .sort((a, b) => b.searchedAt - a.searchedAt);
  const pages = cluster.pageIds
    .map((id) => state.pages[id])
    .filter(Boolean)
    .sort((a, b) => b.visitedAt - a.visitedAt);
  const solution = cluster.solutionPageId ? state.pages[cluster.solutionPageId] : undefined;
  const likely = !solution && cluster.status !== "solved" ? likelySolution(cluster, state) : null;
  const dayCount = new Set(searches.map((s) => localDayKey(s.searchedAt))).size;

  const markSolved = async (page: VisitedPage) => {
    await repository.markSolved(cluster.id, page.id);
    setPicking(false);
    onChanged();
  };

  const setStatus = async (status: "unresolved" | "ignored") => {
    await repository.setStatus(cluster.id, status);
    setPicking(false);
    onChanged();
  };

  const removePage = async (page: VisitedPage) => {
    await repository.removePage(cluster.id, page.id);
    onChanged();
  };

  const saveTitle = async () => {
    setEditingTitle(false);
    if (titleDraft.trim() && titleDraft.trim() !== cluster.title) {
      await repository.setTitle(cluster.id, titleDraft);
      onChanged();
    }
  };

  const deleteProblem = async () => {
    if (!window.confirm("Delete this problem and everything Searchback saved about it? It will not come back.")) return;
    await repository.deleteCluster(cluster.id);
    window.location.hash = "#/";
    onChanged();
  };

  return (
    <div className="page">
      <a className="back-link" href="#/">
        ← Back to dashboard
      </a>

      <div className="detail-header">
        <div style={{ minWidth: 0, flex: 1 }}>
          {editingTitle ? (
            <input
              className="title-edit"
              value={titleDraft}
              autoFocus
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveTitle();
                if (e.key === "Escape") {
                  setTitleDraft(cluster.title);
                  setEditingTitle(false);
                }
              }}
            />
          ) : (
            <h1>{cluster.title}</h1>
          )}
          <div className="problem-meta">
            <span>{countLabel(searches.length, "search", "searches")}</span>
            <span className="dot">·</span>
            <span>{countLabel(dayCount, "day")}</span>
            <span className="dot">·</span>
            <span>{countLabel(pages.length, "page")}</span>
            <span className="dot">·</span>
            <span className={`status status-${cluster.status}`}>{statusLabel(cluster.status)}</span>
            <span className="dot">·</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditingTitle(true)}>
              Rename
            </button>
          </div>
        </div>
        <div className="detail-status-controls">
          {cluster.status === "solved" && (
            <button className="btn btn-sm" onClick={() => setStatus("unresolved")}>
              Still looking
            </button>
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
          <button className="btn btn-danger btn-sm" onClick={deleteProblem}>
            Delete
          </button>
        </div>
      </div>

      {(solution || (cluster.status === "solved" && cluster.note)) && (
        <>
          <h2 className="subsection-title green">Solution</h2>
          {cluster.note && <div className="solution-note">{cluster.note}</div>}
          {solution && (
            <PageItem
              page={solution}
              kind="solution"
              onPick={markSolved}
              onRemove={removePage}
              onUnpick={() => setStatus("unresolved")}
            />
          )}
        </>
      )}

      {likely && (
        <>
          <h2 className="subsection-title amber">Likely solution — {likely.reason}</h2>
          <PageItem page={likely.page} kind="likely" onPick={markSolved} onRemove={removePage} />
        </>
      )}

      {picking && (
        <div className="card" style={{ margin: "16px 0", borderColor: "var(--text)" }}>
          Which page solved it? Pick one below.{" "}
          <button className="btn btn-ghost btn-sm" onClick={() => setPicking(false)}>
            Cancel
          </button>
        </div>
      )}

      <h2 className="subsection-title">Searches</h2>
      <div className="search-timeline">
        {searches.map((search) => (
          <div className="search-item" key={search.id}>
            <span>{search.query}</span>
            <span className="when">{formatRelativeDay(search.searchedAt)}</span>
          </div>
        ))}
      </div>

      <h2 className="subsection-title">Pages visited</h2>
      {pages.length === 0 ? (
        <p className="problem-meta">No pages tracked for this problem yet.</p>
      ) : (
        <div className="card-list">
          {pages.map((page) => (
            <PageItem
              key={page.id}
              page={page}
              kind={page.id === cluster.solutionPageId ? "solution" : "normal"}
              onPick={markSolved}
              onRemove={removePage}
              onUnpick={() => setStatus("unresolved")}
            />
          ))}
        </div>
      )}

      <h2 className="subsection-title">Solution in your own words (optional)</h2>
      <p className="problem-meta" style={{ marginBottom: 8 }}>
        Shown right on Google the next time this problem comes back.
      </p>
      <textarea
        className="note-field"
        placeholder="e.g. Ran `docker system prune -a`, freed 40 GB…"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={async () => {
          await repository.setNote(cluster.id, note);
          onChanged();
        }}
      />
      {cluster.status !== "solved" && note.trim().length > 0 && (
        <div style={{ marginTop: 8 }}>
          <button
            className="btn btn-primary btn-sm"
            onClick={async () => {
              await repository.solveWithNote(cluster.id, note);
              onChanged();
            }}
          >
            Save &amp; mark solved
          </button>
        </div>
      )}
    </div>
  );
}

function PageItem({
  page,
  kind,
  onPick,
  onRemove,
  onUnpick,
}: {
  page: VisitedPage;
  kind: "solution" | "likely" | "normal";
  onPick: (page: VisitedPage) => void;
  onRemove: (page: VisitedPage) => void;
  onUnpick?: () => void;
}) {
  return (
    <div className={`page-item${kind === "solution" ? " is-solution" : ""}${kind === "likely" ? " is-likely" : ""}`}>
      <div className="page-item-main">
        <div className="page-item-head">
          <Favicon url={page.url} domain={page.domain} />
          <div style={{ minWidth: 0 }}>
            <div className="page-item-title">
              <a
                href={page.url}
                onClick={(e) => {
                  e.preventDefault();
                  openExternal(page.url);
                }}
              >
                {page.title}
              </a>
            </div>
            <div className="page-item-domain">
              {page.domain} · {formatRelativeDay(page.visitedAt)}
            </div>
          </div>
        </div>
      </div>
      <div className="page-item-actions">
        {kind === "solution" ? (
          <>
            <span className="solution-badge">Solved it</span>
            {onUnpick && (
              <button className="btn btn-ghost btn-sm" onClick={onUnpick} title="Remove solution">
                Unmark
              </button>
            )}
          </>
        ) : (
          <button className="btn btn-solve btn-sm" onClick={() => onPick(page)}>
            ✓ This solved it
          </button>
        )}
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => onRemove(page)}
          title="Remove this page from the problem"
          aria-label={`Remove ${page.title} from this problem`}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
