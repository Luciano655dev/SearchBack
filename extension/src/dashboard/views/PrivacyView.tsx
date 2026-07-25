import { useState } from "react";
import { repository } from "../../storage/repository";

export function PrivacyView({ onChanged }: { onChanged: () => void }) {
  const [deleted, setDeleted] = useState(false);

  const deleteAll = async () => {
    const confirmed = window.confirm(
      "Delete all Searchback data? This removes every detected problem, search, and page from this device. Your browser history itself is not touched.",
    );
    if (!confirmed) return;
    await repository.deleteAllData();
    setDeleted(true);
    onChanged();
  };

  return (
    <div className="page" style={{ maxWidth: 640 }}>
      <a className="back-link" href="#/">
        ← Back to dashboard
      </a>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Privacy &amp; data</h1>
      <p className="page-sub">Everything happens on this device. Nothing is ever sent anywhere.</p>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 className="subsection-title" style={{ marginTop: 0 }}>
          What Searchback reads
        </h2>
        <ul className="privacy-list yes">
          <li>Google search URLs in your browser history (to extract the search text)</li>
          <li>
            The text you are typing in the Google search box and in AI chat composers (ChatGPT,
            Claude, Gemini, Perplexity…), on those sites only, to show your previous research
            before you ask — this text is matched locally and is not stored unless you send it
          </li>
          <li>
            Titles and URLs of pages you open shortly after a search, checked locally against the
            search so unrelated pages are not suggested as solutions
          </li>
          <li>Visit timestamps, to know which searches happened on different days</li>
        </ul>

        <h2 className="subsection-title">What Searchback stores (locally only)</h2>
        <ul className="privacy-list yes">
          <li>Detected search queries and when they happened</li>
          <li>Prompts you send on supported chatbots and the resulting conversation URL</li>
          <li>Page titles, URLs and domains linked to those searches</li>
          <li>Your own choices: solved, still looking, ignored, notes</li>
        </ul>

        <h2 className="subsection-title">What Searchback never collects</h2>
        <ul className="privacy-list no">
          <li>Page contents, unsent chatbot text, or anything typed into unrelated forms</li>
          <li>Passwords or authentication tokens</li>
          <li>Incognito browsing (extensions do not see it unless you allow it)</li>
          <li>Anything sent to a server — there is no server</li>
        </ul>
      </div>

      <div className="card">
        <h2 className="subsection-title" style={{ marginTop: 0 }}>
          Delete everything
        </h2>
        <p className="problem-meta" style={{ marginBottom: 12 }}>
          Removes all Searchback data from this device immediately. Your browser history is not
          affected.
        </p>
        {deleted ? (
          <p style={{ color: "var(--success)", fontWeight: 600 }}>All Searchback data deleted.</p>
        ) : (
          <button className="btn btn-danger" onClick={deleteAll}>
            Delete all data
          </button>
        )}
      </div>
    </div>
  );
}
