import { useEffect, useState } from "react";
import dashboardScreenshot from "../../docs/screenshots/2-dashboard.png";

const iconUrl = "/icons/icon128.png";
const chromeStoreUrl = "https://chromewebstore.google.com/detail/searchback/aiefiangapjlhohdlaabcgiakcapkekp";
const repositoryUrl = "https://github.com/Luciano655dev/searchback";

const steps = [
  {
    number: "01",
    title: "Search normally",
    body: "Searchback notices recurring Google searches and prompts you send to the AI tools you already use.",
  },
  {
    number: "02",
    title: "Find what works",
    body: "The pages you open stay connected to the problem. Confirm a solution once, or let Searchback rank the useful pages.",
  },
  {
    number: "03",
    title: "Get it back",
    body: "When the problem returns, your previous answer appears beside the search box before you start over.",
  },
];

const recurringProblems = [
  "The command that fixed Docker last month.",
  "The setting hidden three menus deep.",
  "The answer buried in an old chat.",
  "The guide you knew you had already found.",
];

const demoProblems = [
  {
    label: "Storage",
    query: "mac storage full again",
    title: "Mac storage problem",
    meta: "3 searches · 3 days",
    note: "Ran docker system prune. Freed 40 GB.",
    solution: "How to clean up Docker disk space on Mac",
    domain: "stackoverflow.com",
  },
  {
    label: "GitHub",
    query: "remove claude github contributor",
    title: "GitHub contributor problem",
    meta: "2 searches · 2 days",
    note: "Removed the commits from the default branch.",
    solution: "Removing a contributor from a repository",
    domain: "docs.github.com",
  },
  {
    label: "Domain email",
    query: "free email for custom domain",
    title: "Domain email problem",
    meta: "4 searches · 3 days",
    note: "Set up forwarding with ImprovMX.",
    solution: "Free email forwarding for custom domains",
    domain: "improvmx.com",
  },
];

export function LandingPage() {
  const [demoIndex, setDemoIndex] = useState(0);
  const demo = demoProblems[demoIndex];

  useEffect(() => {
    const root = document.documentElement;
    const sections = [...document.querySelectorAll<HTMLElement>("[data-reveal]")];
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      sections.forEach((section) => section.classList.add("is-visible"));
      return;
    }
    root.classList.add("motion-ready");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.14, rootMargin: "0px 0px -8%" },
    );
    sections.forEach((section) => observer.observe(section));
    return () => {
      observer.disconnect();
      root.classList.remove("motion-ready");
    };
  }, []);

  return (
    <div className="landing-page">
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="Searchback home">
          <img src={iconUrl} alt="" />
          <span>Searchback</span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#how">How it works</a>
          <a href="#privacy">Privacy</a>
          <a className="nav-cta" href="#install">Install</a>
        </nav>
      </header>

      <main id="top">
        <section className="hero page-grid" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="section-label">A memory for your browser</p>
            <h1 id="hero-title">Stop solving the same problem twice.</h1>
            <p className="hero-intro">
              Searchback remembers what you searched, what you opened, and what actually helped.
              When the problem comes back, so does the answer.
            </p>
            <div className="hero-actions">
              <a
                className="button button-primary"
                href={chromeStoreUrl}
                target="_blank"
                rel="noreferrer"
              >
                Add to Chrome
              </a>
              <a className="text-link" href="#how">See how it works</a>
            </div>
            <p className="hero-note">Free on the Chrome Web Store. Local storage. No account.</p>
          </div>

          <div className="product-scene" aria-label="Interactive examples of Searchback restoring a previous solution">
            <div className="scene-bar">
              <span />
              <span>google.com</span>
            </div>
            <div className="demo-content" key={demo.label} aria-live="polite">
              <div className="search-field">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m16 16 4 4" />
                </svg>
                <span>{demo.query}</span>
              </div>
              <div className="loopback-result">
                <p className="result-kicker">Searchback found your previous solution</p>
                <div className="result-title-row">
                  <strong>{demo.title}</strong>
                  <span>{demo.meta}</span>
                </div>
                <p className="result-note">{demo.note}</p>
                <a href="#install">{demo.solution}</a>
                <span className="result-domain">{demo.domain}</span>
                <div className="result-actions" aria-hidden="true">
                  <span>Open solution</span>
                  <span>View research</span>
                </div>
              </div>
            </div>
            <div className="search-lines" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div className="demo-picker" aria-label="Choose a recurring problem example">
              {demoProblems.map((problem, index) => (
                <button
                  type="button"
                  className={index === demoIndex ? "is-active" : ""}
                  aria-pressed={index === demoIndex}
                  onClick={() => setDemoIndex(index)}
                  key={problem.label}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {problem.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="manifesto" aria-labelledby="manifesto-title" data-reveal>
          <p className="section-label">Built for the background</p>
          <h2 id="manifesto-title">
            Most tools are used once, then forgotten.
            <br />
            Searchback is forgotten first, then used every day.
          </h2>
          <p>
            There is no new workspace to maintain, no inbox to clear, and no habit to build.
            Browse as usual. Searchback steps in only when your past work is useful again.
          </p>
        </section>

        <section className="how page-section" id="how" aria-labelledby="how-title" data-reveal>
          <div className="section-heading">
            <p className="section-label">How it works</p>
            <h2 id="how-title">Research once. Keep the result.</h2>
          </div>
          <div className="steps">
            {steps.map((step) => (
              <article className="step" key={step.number}>
                <span className="step-number">{step.number}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="daily page-grid" aria-labelledby="daily-title" data-reveal>
          <div className="daily-copy">
            <p className="section-label">Quietly useful</p>
            <h2 id="daily-title">Small problems are still worth remembering.</h2>
            <p>
              Searchback is not for one grand breakthrough. It is for the ordinary technical problems
              that keep coming back and taking twenty minutes with them.
            </p>
          </div>
          <ol className="problem-list">
            {recurringProblems.map((problem, index) => (
              <li key={problem}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                {problem}
              </li>
            ))}
          </ol>
        </section>

        <section className="dashboard-section page-section" aria-labelledby="dashboard-title" data-reveal>
          <div className="section-heading dashboard-heading">
            <div>
              <p className="section-label">Everything you found</p>
              <h2 id="dashboard-title">A record, not another task manager.</h2>
            </div>
            <p>
              Problems, searches, pages, and confirmed solutions stay organized automatically.
              Open the dashboard when you want the full trail. Ignore it when you do not.
            </p>
          </div>
          <div className="dashboard-frame">
            <img
              src={dashboardScreenshot}
              alt="Searchback dashboard listing recurring, unresolved, and solved searches"
            />
          </div>
        </section>

        <section className="privacy page-grid" id="privacy" aria-labelledby="privacy-title" data-reveal>
          <div>
            <p className="section-label">Private by design</p>
            <h2 id="privacy-title">Your history stays in your browser.</h2>
          </div>
          <div className="privacy-copy">
            <p>
              Searchback runs locally. It reads search URLs, page titles, page URLs, and visit times.
              It uses that metadata to match old research with a new search.
            </p>
            <ul>
              <li>No account</li>
              <li>No server</li>
              <li>No telemetry</li>
              <li>No page contents</li>
            </ul>
          </div>
        </section>

        <section className="maker page-section" aria-labelledby="maker-title" data-reveal>
          <div className="maker-heading">
            <p className="section-label">Made for Spark</p>
            <h2 id="maker-title">Built for a hackathon. Kept because it was useful.</h2>
          </div>
          <div className="maker-body">
            <p>
              I built Searchback for the{" "}
              <a
                className="inline-link"
                href="https://buildanything.so/hackathons/spark"
                target="_blank"
                rel="noreferrer"
              >
                BuildAnything Spark Hackathon
              </a>
              . It came from a simple frustration: I kept finding the same answers more than once.
            </p>
            <div className="maker-links">
              <a
                className="maker-link"
                href="https://github.com/luciano655dev"
                target="_blank"
                rel="noreferrer"
              >
                <GitHubIcon />
                <span>
                  <strong>Luciano Menezes</strong>
                  <small>github.com/luciano655dev</small>
                </span>
                <ExternalLinkIcon />
              </a>
              <a
                className="maker-link"
                href="https://buildanything.so/hackathons/spark"
                target="_blank"
                rel="noreferrer"
              >
                <SparkIcon />
                <span>
                  <strong>BuildAnything Spark</strong>
                  <small>Hackathon project</small>
                </span>
                <ExternalLinkIcon />
              </a>
            </div>
          </div>
        </section>

        <section className="install page-section" id="install" aria-labelledby="install-title" data-reveal>
          <div className="install-copy">
            <p className="section-label">Now on the Chrome Web Store</p>
            <h2 id="install-title">Install Searchback in one click.</h2>
            <p>
              Searchback is live on the Chrome Web Store. Add it to Chrome and it starts working
              in the background right away — no ZIP, no developer mode, no setup.
            </p>
            <div className="install-actions">
              <a
                className="button install-download"
                href={chromeStoreUrl}
                target="_blank"
                rel="noreferrer"
              >
                <DownloadIcon />
                Add to Chrome
              </a>
              <a className="install-source" href={repositoryUrl} target="_blank" rel="noreferrer">
                <GitHubIcon />
                View source
                <ExternalLinkIcon />
              </a>
            </div>
          </div>
          <div className="install-guide">
            <ol className="install-steps">
              <li><span>1</span><span className="step-text">Open the <strong>Chrome Web Store</strong> listing</span></li>
              <li><span>2</span><span className="step-text">Select <strong>Add to Chrome</strong></span></li>
              <li><span>3</span><span className="step-text">Confirm with <strong>Add extension</strong></span></li>
              <li><span>4</span><span className="step-text">Pin Searchback from the extensions menu</span></li>
              <li><span>5</span><span className="step-text">Keep searching — your solutions come back automatically</span></li>
            </ol>
            <p className="install-footnote">
              Searchback runs entirely in your browser. The built-in guide supplies optional local
              sample research so you can see the result immediately.
            </p>
          </div>
        </section>
      </main>

      <footer>
        <a className="wordmark footer-wordmark" href="#top">
          <img src={iconUrl} alt="" />
          <span>Searchback</span>
        </a>
        <p>Stop starting from zero.</p>
        <div className="footer-links">
          <a href={repositoryUrl} target="_blank" rel="noreferrer">GitHub</a>
          <a href="/privacy">Privacy policy</a>
          <a href="#top">Back to top</a>
        </div>
      </footer>
    </div>
  );
}

function GitHubIcon() {
  return (
    <svg className="maker-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.75a9.25 9.25 0 0 0-2.92 18.03c.46.08.63-.2.63-.45v-1.78c-2.56.56-3.1-1.09-3.1-1.09-.42-1.06-1.02-1.34-1.02-1.34-.84-.57.06-.56.06-.56.93.06 1.42.95 1.42.95.82 1.42 2.16 1.01 2.69.77.08-.6.32-1.01.59-1.24-2.04-.23-4.19-1.02-4.19-4.57 0-1 .36-1.83.95-2.47-.1-.23-.41-1.17.09-2.43 0 0 .78-.25 2.54.94A8.9 8.9 0 0 1 12 7.16a8.7 8.7 0 0 1 2.31.31c1.77-1.19 2.54-.94 2.54-.94.5 1.26.19 2.2.09 2.43.59.64.95 1.46.95 2.47 0 3.56-2.16 4.33-4.21 4.56.33.29.63.85.63 1.72v2.62c0 .25.16.54.63.45A9.25 9.25 0 0 0 12 2.75Z" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg className="maker-icon spark-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.5c.35 5.9 3.6 9.15 9.5 9.5-5.9.35-9.15 3.6-9.5 9.5-.35-5.9-3.6-9.15-9.5-9.5 5.9-.35 9.15-3.6 9.5-9.5Z" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg className="external-icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M7 4h9v9M16 4 5 15" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg className="download-icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 2v10m0 0 4-4m-4 4L6 8M3 16h14" />
    </svg>
  );
}
