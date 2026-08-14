import { useState } from "react";

const KEY = "prism-onboarded";

/** Tracks whether the user has completed the first-run splash + module walkthrough. */
export function useOnboarded() {
  const [onboarded, setOnboardedState] = useState<boolean>(() => {
    try {
      return localStorage.getItem(KEY) === "true";
    } catch {
      return false;
    }
  });

  function complete() {
    try {
      localStorage.setItem(KEY, "true");
    } catch {}
    setOnboardedState(true);
  }

  return { onboarded, complete };
}
