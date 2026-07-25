import { useEffect, useState } from "react";
import type { SearchbackState } from "../../core/types";
import { seedDemoData } from "../../demo/seed";
import { repository } from "../../storage/repository";

const TEST_QUERY = "why is my mac storage full again";

export function TestView({ state, onChanged }: { state: SearchbackState; onChanged: () => void | Promise<void> }) {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const hasResearch = Object.keys(state.clusters).length > 0;

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const loadSample = async () => {
    if (hasResearch || loading) return;
    setLoading(true);
    try {
      await seedDemoData(repository);
      await onChanged();
    } finally {
      setLoading(false);
    }
  };

  const copyQuery = async () => {
    try {
      await navigator.clipboard.writeText(TEST_QUERY);
      setCopied(true);
    } catch {
      /* The query remains selectable when clipboard access is unavailable. */
    }
  };

  return (
    <div className="page test-page">
      <a className="back-link" href="#/">
        ← Back to dashboard
      </a>
      <p className="test-kicker">Hackathon test guide</p>
      <h1>See Searchback work in two minutes.</h1>
      <p className="page-sub">
        Real recurring research normally develops over several days. This guide adds an optional
        local example so you can test the complete flow now.
      </p>

      <ol className="test-steps">
        <li className="card test-step">
          <span className="test-step-number">1</span>
          <div>
            <h2>Add previous research</h2>
            {hasResearch ? (
              <p className="test-success">Research is ready. Your existing data will be used.</p>
            ) : (
              <>
                <p>
                  Add several realistic, pre-dated research trails to this device. They use the same
                  matching pipeline as normal browser history and are never uploaded.
                </p>
                <button className="btn btn-primary" onClick={loadSample} disabled={loading}>
                  {loading ? "Adding sample…" : "Load sample research"}
                </button>
              </>
            )}
          </div>
        </li>

        <li className="card test-step">
          <span className="test-step-number">2</span>
          <div>
            <h2>Repeat one of the problems</h2>
            <p>Copy this text, then use it in Google Search, ChatGPT, or Claude:</p>
            <div className="test-query">
              <code>{TEST_QUERY}</code>
              <button className="btn btn-sm" onClick={copyQuery}>{copied ? "Copied" : "Copy"}</button>
            </div>
            <div className="test-actions">
              <a
                className="btn btn-primary"
                href={`https://www.google.com/search?q=${encodeURIComponent(TEST_QUERY)}`}
                target="_blank"
                rel="noreferrer"
              >
                Test on Google ↗
              </a>
              <a className="btn" href="https://chatgpt.com/" target="_blank" rel="noreferrer">
                Test on ChatGPT ↗
              </a>
              <a className="btn" href="https://claude.ai/new" target="_blank" rel="noreferrer">
                Test on Claude ↗
              </a>
            </div>
          </div>
        </li>

        <li className="card test-step">
          <span className="test-step-number">3</span>
          <div>
            <h2>Check the recovery</h2>
            <p>
              Searchback should surface the earlier Mac storage research. On chatbots, the reminder
              spans the composer before you send the prompt. Open a result, confirm the solution,
              dismiss this reminder, or return here to inspect the full trail.
            </p>
            <div className="test-actions">
              <a className="btn" href="#/">Open dashboard</a>
              <a className="btn" href="#/settings">Review reminder settings</a>
            </div>
          </div>
        </li>
      </ol>

      <p className="test-note">
        Sample and real research stay in Chrome's local extension storage. Remove everything from
        <a href="#/privacy"> Privacy &amp; data</a> when you finish.
      </p>
    </div>
  );
}
