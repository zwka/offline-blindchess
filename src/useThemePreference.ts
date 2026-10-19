import { useEffect, useLayoutEffect, useState } from "react";
import {
  applyTheme,
  readSystemTheme,
  readThemePreference,
  saveThemePreference,
  subscribeToSystemTheme
} from "./preferences";
import type { ResolvedTheme, ThemePreference } from "./preferences";

export function useThemePreference() {
  const [preference, setPreferenceState] = useState<ThemePreference>(readThemePreference);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(readSystemTheme);

  useEffect(() => subscribeToSystemTheme(setSystemTheme), []);

  useLayoutEffect(() => {
    applyTheme(preference, systemTheme);
  }, [preference, systemTheme]);

  const setPreference = (next: ThemePreference) => {
    setPreferenceState(next);
    saveThemePreference(next);
  };

  return { preference, setPreference };
}
