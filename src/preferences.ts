import { z } from "zod";

const THEME_PREFERENCE_KEY = "offline-blind-chess.theme.v1";
const ThemePreferenceSchema = z.enum(["system", "light", "dark"]);

export type ThemePreference = z.infer<typeof ThemePreferenceSchema>;
export type ResolvedTheme = Exclude<ThemePreference, "system">;

export function readThemePreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_PREFERENCE_KEY);
    const result = ThemePreferenceSchema.safeParse(stored);
    return result.success ? result.data : "system";
  } catch {
    return "system";
  }
}

export function saveThemePreference(preference: ThemePreference): boolean {
  try {
    window.localStorage.setItem(THEME_PREFERENCE_KEY, preference);
    return true;
  } catch {
    return false;
  }
}

export function resolveTheme(preference: ThemePreference, systemTheme: ResolvedTheme): ResolvedTheme {
  return preference === "system" ? systemTheme : preference;
}

export function readSystemTheme(): ResolvedTheme {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function subscribeToSystemTheme(onChange: (theme: ResolvedTheme) => void): () => void {
  try {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event: MediaQueryListEvent) => {
      onChange(event.matches ? "dark" : "light");
    };
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  } catch {
    return () => {};
  }
}

export function applyTheme(preference: ThemePreference, systemTheme: ResolvedTheme): ResolvedTheme {
  const theme = resolveTheme(preference, systemTheme);
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    "content",
    theme === "dark" ? "#141b17" : "#f4f3ee"
  );
  return theme;
}
