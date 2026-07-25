import { useState } from "react";
import type { SearchbackState } from "../../core/types";
import { sectionedProblems, type ProblemSummary } from "../../ui/selectors";
import { ProblemCard } from "../components/ProblemCard";

export function DashboardView({ state, onChanged }: { state: SearchbackState; onChanged: () => void }) {
  const sections = sectionedProblems(state);
  const [showIgnored, setShowIgnored] = useState(false);
  const isEmpty =
    sections.resurfaced.length === 0 && sections.unresolved.length === 0 && sections.solved.length === 0;

  return (
    <div className="page">
      <header className="page-header">
        <h1>Searchback</h1>
        <div className="header-actions">
          <a className="btn btn-primary btn-sm" href="#/test">
            Test Searchback
          </a>
          <a className="btn btn-ghost btn-sm" href="#/privacy">
            Privacy &amp; data
          </a>
          <a className="btn btn-ghost btn-sm" href="#/settings">
            Settings
          </a>
          <a
            className="btn btn-ghost btn-sm"
            href="https://searchback.vercel.app/"
            target="_blank"
            rel="noreferrer"
          >
            Website <span aria-hidden="true">↗</span>
          </a>
        </div>
      </header>
      <p className="page-sub">Problems you searched on more than one day.</p>

      {isEmpty ? (
        <div className="empty-state card">
          <h2>Nothing recurring yet</h2>
          <p>
            Keep browsing normally. When you search for the same problem on two different days,
            it shows up here with everything you already found.
          </p>
          <p className="empty-hint">Searchback only looks at Google searches, and only on this device.</p>
          <a className="btn btn-primary empty-action" href="#/test">Try it with sample research</a>
        </div>
      ) : (
        <>
          <Section title="Happening again" items={sections.resurfaced} onChanged={onChanged} />
          <Section title="Still unresolved" items={sections.unresolved} onChanged={onChanged} />
          <Section title="Solved before" items={sections.solved} onChanged={onChanged} />
        </>
      )}

      {sections.ignored.length > 0 && (
        <section className="section">
          <button className="btn btn-ghost btn-sm" onClick={() => setShowIgnored((v) => !v)}>
            {showIgnored ? "Hide" : "Show"} ignored ({sections.ignored.length})
          </button>
          {showIgnored && (
            <div className="card-list" style={{ marginTop: 12 }}>
              {sections.ignored.map((summary) => (
                <ProblemCard key={summary.cluster.id} summary={summary} onChanged={onChanged} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Section({
  title,
  items,
  onChanged,
}: {
  title: string;
  items: ProblemSummary[];
  onChanged: () => void;
}) {
  if (items.length === 0) return null;
  return (
    <section className="section">
      <h2 className="section-title">
        {title} <span className="section-count">{items.length}</span>
      </h2>
      <div className="card-list">
        {items.map((summary) => (
          <ProblemCard key={summary.cluster.id} summary={summary} onChanged={onChanged} />
        ))}
      </div>
    </section>
  );
}
