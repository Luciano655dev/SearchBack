const iconUrl = "/icons/icon128.png";

export function PrivacyPolicy() {
  return (
    <div className="policy-page">
      <header className="policy-header">
        <a className="wordmark" href="/" aria-label="Searchback home">
          <img src={iconUrl} alt="" />
          <span>Searchback</span>
        </a>
        <a href="/">Back to website</a>
      </header>

      <main className="policy-layout">
        <aside>
          <p className="section-label">Privacy policy</p>
          <p>Effective July 19, 2026</p>
        </aside>

        <article>
          <h1>Your research stays on your device.</h1>
          <p className="policy-lead">
            Searchback uses browsing metadata to recognize research you have done before. It processes
            and stores that information locally in your browser. Searchback has no account system,
            analytics service, advertising system, or remote database.
          </p>

          <PolicySection title="Information Searchback handles">
            <ul>
              <li>Google search queries contained in search result URLs.</li>
              <li>URLs, page titles, domains, and visit times from browser history.</li>
              <li>Prompts sent on supported AI chatbot sites and the resulting conversation URL.</li>
              <li>Your Searchback settings, notes, confirmed solutions, and ignored problems.</li>
            </ul>
            <p>
              While you type on a supported search or chatbot page, Searchback reads the current input
              locally to check for a match. Typed text is not saved unless you send the prompt.
            </p>
          </PolicySection>

          <PolicySection title="How the information is used">
            <p>
              Searchback uses this information only to group repeated research, associate useful pages
              with it, rank likely solutions, and show prior research when a related problem returns.
            </p>
          </PolicySection>

          <PolicySection title="Storage, sharing, and retention">
            <ul>
              <li>Data is stored in Chrome's local extension storage on your device.</li>
              <li>Searchback does not transmit this data to the developer or any third party.</li>
              <li>Searchback does not sell data or use it for advertising or profiling.</li>
              <li>No human can access your saved research through Searchback.</li>
              <li>You can delete individual problems or all Searchback data from the extension.</li>
            </ul>
          </PolicySection>

          <PolicySection title="Chrome permissions">
            <p>
              Searchback requests history, storage, tabs, notifications, alarms, favicon, and limited
              access to supported Google and chatbot pages. Each permission is used only to provide the
              reminder and research-recovery features described above.
            </p>
          </PolicySection>

          <PolicySection title="Limited Use">
            <p>
              The use of information received from Chrome APIs adheres to the Chrome Web Store User Data
              Policy, including the Limited Use requirements.
            </p>
          </PolicySection>

          <PolicySection title="Changes and contact">
            <p>
              Material changes will be posted on this page before a release using the changed practice.
              For privacy questions, open an issue in the Searchback extension repository on GitHub.
            </p>
            <a className="policy-contact" href="https://github.com/luciano655dev/searchback-extension/issues">
              github.com/luciano655dev/searchback-extension/issues
            </a>
          </PolicySection>
        </article>
      </main>
    </div>
  );
}

function PolicySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="policy-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
