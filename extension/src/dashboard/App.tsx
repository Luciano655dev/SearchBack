import { useCallback, useEffect, useState } from "react";
import type { SearchbackState } from "../core/types";
import { repository } from "../storage/repository";
import { DashboardView } from "./views/DashboardView";
import { ProblemView } from "./views/ProblemView";
import { OnboardingView } from "./views/OnboardingView";
import { PrivacyView } from "./views/PrivacyView";
import { SettingsView } from "./views/SettingsView";
import { TestView } from "./views/TestView";

function useHashRoute(): string {
  const [hash, setHash] = useState(window.location.hash || "#/");
  useEffect(() => {
    const onChange = () => setHash(window.location.hash || "#/");
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return hash;
}

export function App() {
  const route = useHashRoute();
  const [state, setState] = useState<SearchbackState | null>(null);

  const reload = useCallback(async () => {
    setState(await repository.load());
  }, []);

  useEffect(() => {
    void reload();
  }, [reload, route]);

  if (!state) return null;

  if (!state.meta.onboarded && !route.startsWith("#/privacy")) {
    return <OnboardingView onDone={reload} />;
  }

  if (route.startsWith("#/onboarding")) {
    return <OnboardingView onDone={reload} />;
  }
  if (route.startsWith("#/privacy")) {
    return <PrivacyView onChanged={reload} />;
  }
  if (route.startsWith("#/settings")) {
    return <SettingsView initialConfig={state.config} onChanged={reload} />;
  }
  if (route.startsWith("#/test")) {
    return <TestView state={state} onChanged={reload} />;
  }
  const problemMatch = route.match(/^#\/problem\/([^?]+)(\?.*)?$/);
  if (problemMatch) {
    const solveMode = (problemMatch[2] ?? "").includes("solve=1");
    return (
      <ProblemView clusterId={problemMatch[1]} state={state} solveMode={solveMode} onChanged={reload} />
    );
  }
  return <DashboardView state={state} onChanged={reload} />;
}
