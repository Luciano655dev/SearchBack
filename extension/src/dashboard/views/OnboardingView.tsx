import { useState } from "react";
import { repository } from "../../storage/repository";

const SCREENS = [
  {
    title: "Searchback remembers what you already researched",
    body: (
      <>
        <p>
          When you search for the same problem on different days, Searchback groups those searches
          and the pages you visited into one place.
        </p>
        <p>Next time the problem comes back, you do not start from zero.</p>
      </>
    ),
  },
  {
    title: "You choose when it starts",
    body: (
      <>
        <p>
          Searchback reads Google search URLs, the pages opened afterward, and prompts you send on
          supported chatbots. It uses this only to recover your previous research.
        </p>
        <p>
          Everything stays on this device. There are no accounts, servers, analytics, ads, or remote
          storage.
        </p>
      </>
    ),
  },
  {
    title: "Ready to try it",
    body: (
      <>
        <p>
          Select Start Searchback to allow local processing. You can turn reminders off or delete all
          saved Searchback data at any time.
        </p>
        <p>After setup, select <strong>Test Searchback</strong> to load a local example and verify the full flow in two minutes.</p>
        <p>
          Read the <a href="https://searchback.vercel.app/privacy" target="_blank" rel="noreferrer">privacy policy</a>.
        </p>
      </>
    ),
  },
];

export function OnboardingView({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const screen = SCREENS[step];
  const isLast = step === SCREENS.length - 1;

  const finish = async () => {
    await repository.update((state) => {
      state.meta.onboarded = true;
    });
    if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: "loopback:rescan" }, () => void chrome.runtime.lastError);
    }
    onDone();
    window.location.hash = "#/test";
  };

  return (
    <div className="onboarding">
      <img className="onboarding-logo" src="icons/icon128.png" alt="" />
      <h1>{screen.title}</h1>
      {screen.body}
      <div className="onboarding-actions">
        {step > 0 && (
          <button className="btn" onClick={() => setStep(step - 1)}>
            Back
          </button>
        )}
        {isLast ? (
          <button className="btn btn-primary" onClick={finish}>
            Start Searchback
          </button>
        ) : (
          <button className="btn btn-primary" onClick={() => setStep(step + 1)}>
            Next
          </button>
        )}
      </div>
      <div className="onboarding-dots">
        {SCREENS.map((_, i) => (
          <span key={i} className={`onboarding-dot${i === step ? " active" : ""}`} />
        ))}
      </div>
    </div>
  );
}
